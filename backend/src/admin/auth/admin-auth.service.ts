import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AdminUser, AdminUserDocument } from '../schemas/admin-user.schema';
import {
  AdminRefreshToken,
  AdminRefreshTokenDocument,
} from '../schemas/admin-refresh-token.schema';
import { AdminPermissionsService } from '../admin-permissions.service';
import { AdminAuditService } from '../admin-audit.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

interface AdminTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
// HTTP 423 Locked — not present in every @nestjs/common HttpStatus enum build.
const HTTP_LOCKED = 423;

/** Throws a standardized admin-auth error envelope. */
function adminAuthError(status: number, code: string, message: string): never {
  throw new HttpException({ success: false, error: { code, message } }, status);
}

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectModel(AdminUser.name)
    private readonly adminUserModel: Model<AdminUserDocument>,
    @InjectModel(AdminRefreshToken.name)
    private readonly refreshTokenModel: Model<AdminRefreshTokenDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly permissionsService: AdminPermissionsService,
    private readonly auditService: AdminAuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  async login(
    dto: AdminLoginDto,
    meta: RequestMeta,
  ): Promise<{ admin: Record<string, any>; tokens: AdminTokens }> {
    const admin = await this.adminUserModel.findOne({
      email: dto.email.toLowerCase().trim(),
    });

    if (!admin) {
      adminAuthError(
        HttpStatus.UNAUTHORIZED,
        'ADMIN_AUTH_001',
        'Invalid credentials',
      );
    }

    // Locked out?
    if (admin.lockoutUntil && admin.lockoutUntil > new Date()) {
      await this.audit(admin, meta, false);
      adminAuthError(HTTP_LOCKED, 'ADMIN_AUTH_002', 'Account locked');
    }

    if (admin.isBanned) {
      await this.audit(admin, meta, false);
      adminAuthError(
        HttpStatus.FORBIDDEN,
        'ADMIN_AUTH_004',
        'Admin account banned',
      );
    }
    if (!admin.isActive) {
      await this.audit(admin, meta, false);
      adminAuthError(
        HttpStatus.FORBIDDEN,
        'ADMIN_AUTH_005',
        'Admin account deactivated',
      );
    }

    const passwordMatches = await admin.comparePassword(dto.password);
    if (!passwordMatches) {
      await this.registerFailedLogin(admin);
      await this.audit(admin, meta, false);
      adminAuthError(
        HttpStatus.UNAUTHORIZED,
        'ADMIN_AUTH_001',
        'Invalid credentials',
      );
    }

    // 2FA gate (schema present; enforcement when enabled).
    if (admin.twoFactorEnabled) {
      if (!dto.twoFactorCode) {
        adminAuthError(
          HttpStatus.UNAUTHORIZED,
          'ADMIN_AUTH_009',
          'Two-factor code required',
        );
      }
      // TOTP verification is planned — until implemented, no code is valid.
      adminAuthError(
        HttpStatus.UNAUTHORIZED,
        'ADMIN_AUTH_009',
        'Two-factor code required or invalid',
      );
    }

    // Success — reset lockout, record login.
    admin.failedLoginAttempts = 0;
    admin.lockoutUntil = undefined;
    admin.lastLoginAt = new Date();
    admin.loginHistory.push({
      timestamp: new Date(),
      ipAddress: meta.ipAddress || '',
      userAgent: meta.userAgent || '',
      success: true,
    });
    if (admin.loginHistory.length > 10) {
      admin.loginHistory = admin.loginHistory.slice(-10);
    }
    await admin.save();

    const tokens = await this.issueTokens(admin, meta);
    await this.audit(admin, meta, true);

    const role = await this.permissionsService.getRole(admin);
    const adminView = admin.toJSON();

    return {
      admin: {
        adminId: adminView.adminId,
        email: adminView.email,
        firstName: adminView.firstName,
        lastName: adminView.lastName,
        role: role ? { name: role.name, permissions: role.permissions } : null,
        mustChangePassword: adminView.mustChangePassword,
        twoFactorEnabled: adminView.twoFactorEnabled,
      },
      tokens,
    };
  }

  // ---------------------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------------------

  async refresh(
    refreshToken: string | undefined,
    meta: RequestMeta,
  ): Promise<AdminTokens> {
    if (!refreshToken) {
      adminAuthError(
        HttpStatus.UNAUTHORIZED,
        'ADMIN_AUTH_010',
        'Invalid or expired refresh token',
      );
    }

    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>(
          'configuration.adminJwt.refreshSecret',
        ),
      });
    } catch {
      adminAuthError(
        HttpStatus.UNAUTHORIZED,
        'ADMIN_AUTH_010',
        'Invalid or expired refresh token',
      );
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenModel.findOne({ tokenHash });

    if (
      !stored ||
      stored.isRevoked ||
      stored.expiresAt < new Date() ||
      stored.adminId.toString() !== payload.sub
    ) {
      adminAuthError(
        HttpStatus.UNAUTHORIZED,
        'ADMIN_AUTH_010',
        'Invalid or expired refresh token',
      );
    }

    const admin = await this.adminUserModel.findById(payload.sub);
    if (!admin || admin.isBanned || !admin.isActive) {
      adminAuthError(
        HttpStatus.UNAUTHORIZED,
        'ADMIN_AUTH_010',
        'Invalid or expired refresh token',
      );
    }

    // Rotate.
    stored.isRevoked = true;
    await stored.save();

    const tokens = await this.issueTokens(admin, meta);
    await this.auditService.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'admin.token_refresh',
      resource: 'admins',
      targetId: admin.adminId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return tokens;
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  async logout(
    admin: AdminUserDocument,
    refreshToken: string | undefined,
    meta: RequestMeta,
  ): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.refreshTokenModel.updateOne(
        { tokenHash },
        { $set: { isRevoked: true } },
      );
    } else {
      // No cookie presented — revoke all of this admin's active sessions.
      await this.refreshTokenModel.updateMany(
        { adminId: admin._id, isRevoked: false },
        { $set: { isRevoked: true } },
      );
    }

    await this.auditService.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'admin.logout',
      resource: 'admins',
      targetId: admin.adminId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  // ---------------------------------------------------------------------------
  // Me
  // ---------------------------------------------------------------------------

  async me(admin: AdminUserDocument): Promise<Record<string, any>> {
    const role = await this.permissionsService.getRole(admin);
    const effectivePermissions =
      await this.permissionsService.getEffectivePermissions(admin);
    const adminView = admin.toJSON();

    return {
      adminId: adminView.adminId,
      email: adminView.email,
      firstName: adminView.firstName,
      lastName: adminView.lastName,
      role: role ? { name: role.name, isSystem: role.isSystem } : null,
      effectivePermissions,
      mustChangePassword: adminView.mustChangePassword,
      twoFactorEnabled: adminView.twoFactorEnabled,
    };
  }

  // ---------------------------------------------------------------------------
  // Change password
  // ---------------------------------------------------------------------------

  async changePassword(
    admin: AdminUserDocument,
    dto: AdminChangePasswordDto,
    meta: RequestMeta,
  ): Promise<void> {
    const matches = await admin.comparePassword(dto.currentPassword);
    if (!matches) {
      adminAuthError(
        HttpStatus.BAD_REQUEST,
        'ADMIN_AUTH_003',
        'Current password incorrect',
      );
    }

    if (dto.newPassword === dto.currentPassword) {
      adminAuthError(
        HttpStatus.BAD_REQUEST,
        'ADMIN_AUTH_011',
        'New password must differ from the current password',
      );
    }

    const saltRounds =
      this.configService.get<number>('configuration.bcrypt.saltRounds') || 10;
    admin.password = await bcrypt.hash(dto.newPassword, saltRounds);
    admin.passwordChangedAt = new Date();
    admin.mustChangePassword = false;
    admin.failedLoginAttempts = 0;
    admin.lockoutUntil = undefined;
    await admin.save();

    // Revoke all refresh tokens — force re-login on other sessions.
    await this.refreshTokenModel.updateMany(
      { adminId: admin._id, isRevoked: false },
      { $set: { isRevoked: true } },
    );

    await this.auditService.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'admin.change_password',
      resource: 'admins',
      targetId: admin.adminId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async registerFailedLogin(admin: AdminUserDocument): Promise<void> {
    admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
    if (admin.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      admin.lockoutUntil = new Date(Date.now() + LOCKOUT_MS);
    }
    await admin.save();
  }

  private async issueTokens(
    admin: AdminUserDocument,
    meta: RequestMeta,
  ): Promise<AdminTokens> {
    const accessExpiration =
      this.configService.get<string>('configuration.adminJwt.expiration') ||
      '15m';
    const refreshExpiration =
      this.configService.get<string>(
        'configuration.adminJwt.refreshExpiration',
      ) || '7d';

    const accessToken = await this.jwtService.signAsync(
      {
        sub: admin._id.toString(),
        adminId: admin.adminId,
        email: admin.email,
        roleId: admin.roleId?.toString(),
        scope: 'admin',
        type: 'access',
      },
      {
        secret: this.configService.get<string>('configuration.adminJwt.secret'),
        expiresIn: accessExpiration,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: admin._id.toString(), scope: 'admin', type: 'refresh' },
      {
        secret: this.configService.get<string>(
          'configuration.adminJwt.refreshSecret',
        ),
        expiresIn: refreshExpiration,
      },
    );

    await this.storeRefreshToken(
      admin._id,
      refreshToken,
      refreshExpiration,
      meta,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.durationToSeconds(accessExpiration),
    };
  }

  private async storeRefreshToken(
    adminId: Types.ObjectId,
    refreshToken: string,
    refreshExpiration: string,
    meta: RequestMeta,
  ): Promise<void> {
    const expiresAt = new Date(
      Date.now() + this.durationToSeconds(refreshExpiration) * 1000,
    );
    await this.refreshTokenModel.create({
      adminId,
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      isRevoked: false,
    });
  }

  private async audit(
    admin: AdminUserDocument,
    meta: RequestMeta,
    success: boolean,
  ): Promise<void> {
    await this.auditService.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'admin.login',
      resource: 'admins',
      targetId: admin.adminId,
      after: { success },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private durationToSeconds(duration: string): number {
    if (/^\d+$/.test(duration)) {
      return parseInt(duration, 10);
    }
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      return 900;
    }
    const value = parseInt(match[1], 10);
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * multipliers[match[2]];
  }
}
