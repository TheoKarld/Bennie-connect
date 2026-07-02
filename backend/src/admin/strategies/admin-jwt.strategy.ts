import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdminUser, AdminUserDocument } from '../schemas/admin-user.schema';

export interface AdminJwtPayload {
  sub: string;
  adminId: string;
  email: string;
  roleId: string;
  scope: string;
  type: string;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    configService: ConfigService,
    @InjectModel(AdminUser.name)
    private readonly adminUserModel: Model<AdminUserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('configuration.adminJwt.secret') ||
        'default-admin-secret-change-me',
    });
  }

  async validate(payload: AdminJwtPayload): Promise<AdminUserDocument> {
    // Cross-plane isolation: reject any token that is not admin-scoped.
    if (payload.scope !== 'admin') {
      throw new UnauthorizedException('Invalid token scope');
    }

    const admin = await this.adminUserModel
      .findById(payload.sub)
      .catch(() => null);

    if (!admin) {
      throw new UnauthorizedException('Admin account no longer exists');
    }
    if (admin.isBanned) {
      throw new UnauthorizedException('Admin account is banned');
    }
    if (!admin.isActive) {
      throw new UnauthorizedException('Admin account is deactivated');
    }
    return admin;
  }
}
