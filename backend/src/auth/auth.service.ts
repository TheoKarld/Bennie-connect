import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomBytes } from 'crypto';
import axios from 'axios';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { MailService } from '../mail/mail.service';
import { NotificationService } from '../notifications/notification.service';
import { WalletService } from '../wallet/wallet.service';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthResult {
  success: true;
  message?: string;
  data: {
    user: Record<string, any>;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

interface GoogleProfile {
  googleId?: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient?: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  /**
   * Fire-and-forget: notify every admin that a new member has signed up. Never
   * blocks or fails the caller (mirrors the best-effort welcome email).
   */
  private notifyAdminsOfSignup(user: UserDocument): void {
    this.notificationService
      .notifyAdmins({
        event: 'user.signup',
        type: 'info',
        title: 'New member signup',
        body: `${user.firstName} ${user.lastName} (${user.email}) just created an account`,
        data: { userId: user._id.toString(), email: user.email },
      })
      .catch(() => undefined);
  }

  // ---------------------------------------------------------------------------
  // Public flows
  // ---------------------------------------------------------------------------

  async register(
    dto: RegisterDto,
    meta: RequestMeta = {},
  ): Promise<AuthResult> {
    const user = await this.usersService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: dto.password,
      phoneNumber: dto.phoneNumber,
      referralCode: dto.referralCode,
    } as any);

    // Ensure the account is a local, active account.
    if (user.authProvider !== 'local') {
      user.authProvider = 'local';
      await user.save();
    }

    const tokens = await this.issueTokens(user, meta);

    // Auto-create the wallet — best-effort, never blocks or fails registration.
    this.walletService
      .ensureWalletSafe(user._id, user.email)
      .catch(() => undefined);

    // Best-effort mail — never blocks or fails registration.
    this.mailService
      .sendWelcomeEmail({ email: user.email, firstName: user.firstName })
      .catch(() => undefined);

    // Best-effort admin fan-out — never blocks or fails registration.
    this.notifyAdminsOfSignup(user);

    const requireVerification = this.configService.get<boolean>(
      'configuration.requireEmailVerification',
    );
    if (requireVerification) {
      const token = randomBytes(3).toString('hex').toUpperCase();
      user.emailVerificationToken = token;
      user.emailVerificationExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      this.mailService
        .sendVerificationEmail(
          { email: user.email, firstName: user.firstName },
          token,
        )
        .catch(() => undefined);
    }

    return this.buildResult(user, tokens, 'Registration successful');
  }

  async login(dto: LoginDto, meta: RequestMeta = {}): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw new ForbiddenException(
        'Account temporarily locked due to failed login attempts. Try again later.',
      );
    }

    if (user.isSuspended || !user.isActive) {
      throw new ForbiddenException('Account is inactive or suspended');
    }

    const passwordMatches = await user.comparePassword(dto.password);
    if (!passwordMatches) {
      await this.usersService.incrementFailedLogin(user._id);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
      await this.usersService.resetFailedLogin(user._id);
    }

    await this.usersService.updateLastLogin(user._id, {
      ipAddress: meta.ipAddress || '',
      userAgent: meta.userAgent || '',
      success: true,
    });

    const tokens = await this.issueTokens(user, meta);
    return this.buildResult(user, tokens, 'Login successful');
  }

  async loginWithGoogle(
    input: { idToken?: string; accessToken?: string },
    meta: RequestMeta = {},
  ): Promise<AuthResult> {
    const clientId = this.configService.get<string>(
      'configuration.google.clientId',
    );
    if (!clientId) {
      throw new BadRequestException('Google sign-in is not configured');
    }

    let profile: GoogleProfile;
    if (input.accessToken) {
      profile = await this.googleProfileFromAccessToken(input.accessToken);
    } else if (input.idToken) {
      profile = await this.googleProfileFromIdToken(input.idToken, clientId);
    } else {
      throw new BadRequestException(
        'A Google idToken or accessToken is required',
      );
    }

    if (!profile.email || !profile.googleId) {
      throw new UnauthorizedException(
        'Google token did not contain the required profile data',
      );
    }

    const email = profile.email;
    const googleId = profile.googleId;
    const { givenName, familyName, picture } = profile;

    let user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      user = await this.usersService.createGoogleUser({
        email: email.toLowerCase(),
        firstName: givenName || email.split('@')[0],
        lastName: familyName || 'User',
        googleId,
        profileImageUrl: picture,
      });
      // Only on first creation (not returning Google login). Best-effort.
      this.notifyAdminsOfSignup(user);
      // Auto-create the wallet for the new Google user — best-effort.
      this.walletService
        .ensureWalletSafe(user._id, user.email)
        .catch(() => undefined);
    }

    if (user.isSuspended || !user.isActive) {
      throw new ForbiddenException('Account is inactive or suspended');
    }

    await this.usersService.updateLastLogin(user._id, {
      ipAddress: meta.ipAddress || '',
      userAgent: meta.userAgent || '',
      success: true,
    });

    const tokens = await this.issueTokens(user, meta);
    return this.buildResult(user, tokens, 'Google sign-in successful');
  }

  /** Verify a Google ID token (credential flow) and extract the profile. */
  private async googleProfileFromIdToken(
    idToken: string,
    clientId: string,
  ): Promise<GoogleProfile> {
    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(clientId);
    }
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      return {
        googleId: payload?.sub,
        email: payload?.email,
        givenName: payload?.given_name,
        familyName: payload?.family_name,
        picture: payload?.picture,
      };
    } catch (error: any) {
      this.logger.warn(
        `Google ID token verification failed: ${error?.message}`,
      );
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  /** Resolve a Google profile from an OAuth access token (implicit flow). */
  private async googleProfileFromAccessToken(
    accessToken: string,
  ): Promise<GoogleProfile> {
    try {
      const { data } = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      return {
        googleId: data.sub,
        email: data.email,
        givenName: data.given_name,
        familyName: data.family_name,
        picture: data.picture,
      };
    } catch (error: any) {
      this.logger.warn(
        `Google userinfo lookup failed: ${error?.response?.status || error?.message}`,
      );
      throw new UnauthorizedException('Invalid Google access token');
    }
  }

  async refresh(
    refreshToken: string | undefined,
    meta: RequestMeta = {},
  ): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>(
          'configuration.jwt.refreshSecret',
        ),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenModel.findOne({ tokenHash });

    if (
      !stored ||
      stored.isRevoked ||
      stored.expiresAt < new Date() ||
      stored.userId.toString() !== payload.sub
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findOne(payload.sub);
    if (!user || user.isSuspended || !user.isActive) {
      throw new UnauthorizedException('Account is inactive or suspended');
    }

    // Rotate: revoke the old token, issue a fresh pair.
    stored.isRevoked = true;
    await stored.save();

    const tokens = await this.issueTokens(user, meta);
    return this.buildResult(user, tokens, 'Token refreshed');
  }

  async logout(
    refreshToken: string | undefined,
  ): Promise<{ success: true; message: string }> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.refreshTokenModel.updateOne(
        { tokenHash },
        { $set: { isRevoked: true } },
      );
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async forgotPassword(
    email: string,
  ): Promise<{ success: true; message: string }> {
    const result = await this.usersService.generatePasswordResetToken(email);

    if (result) {
      const { user, rawToken } = result;
      const appUrl =
        this.configService.get<string>('configuration.app.url') ||
        'http://localhost:3000';
      const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Password reset link for ${email}: ${resetLink}`);
      }

      // Best-effort mail — never blocks or leaks the outcome to the caller.
      this.mailService
        .sendPasswordResetEmail(
          { email: user.email, firstName: user.firstName },
          resetLink,
        )
        .catch(() => undefined);
    }

    // Always the same response — no account enumeration.
    return {
      success: true,
      message:
        'If an account exists for that email, a reset link is on its way.',
    };
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ success: true; message: string }> {
    const user = await this.usersService.resetPassword(token, password);

    // Revoke every outstanding refresh token for this account.
    await this.refreshTokenModel.updateMany(
      { userId: user._id },
      { $set: { isRevoked: true } },
    );

    // Best-effort confirmation email.
    this.mailService
      .sendPasswordChangedEmail({
        email: user.email,
        firstName: user.firstName,
      })
      .catch(() => undefined);

    return {
      success: true,
      message: 'Password reset successful. Please sign in.',
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async issueTokens(
    user: UserDocument,
    meta: RequestMeta,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      scope: 'user',
      type: 'access',
    };

    const accessExpiration =
      this.configService.get<string>('configuration.jwt.expiration') || '15m';
    const refreshExpiration =
      this.configService.get<string>('configuration.jwt.refreshExpiration') ||
      '7d';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('configuration.jwt.secret'),
      expiresIn: accessExpiration,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user._id.toString(), scope: 'user', type: 'refresh' },
      {
        secret: this.configService.get<string>(
          'configuration.jwt.refreshSecret',
        ),
        expiresIn: refreshExpiration,
      },
    );

    await this.storeRefreshToken(user._id, refreshToken, meta);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.durationToSeconds(accessExpiration),
    };
  }

  private async storeRefreshToken(
    userId: Types.ObjectId,
    refreshToken: string,
    meta: RequestMeta,
  ): Promise<void> {
    const refreshExpiration =
      this.configService.get<string>('configuration.jwt.refreshExpiration') ||
      '7d';
    const expiresAt = new Date(
      Date.now() + this.durationToSeconds(refreshExpiration) * 1000,
    );

    await this.refreshTokenModel.create({
      userId,
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      isRevoked: false,
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildResult(
    user: UserDocument,
    tokens: { accessToken: string; refreshToken: string; expiresIn: number },
    message: string,
  ): AuthResult {
    return {
      success: true,
      message,
      data: {
        user: user.toJSON(),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  /**
   * Converts a JWT-style duration string (e.g. "15m", "7d", "900s", "3600")
   * into seconds.
   */
  private durationToSeconds(duration: string): number {
    if (/^\d+$/.test(duration)) {
      return parseInt(duration, 10);
    }
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      return 900;
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * multipliers[unit];
  }
}
