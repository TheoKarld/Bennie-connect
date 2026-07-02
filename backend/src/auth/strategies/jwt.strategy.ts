import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  scope?: string;
  type?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('configuration.jwt.secret') ||
        'default-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    // Cross-plane isolation: reject admin-scoped (or any non-user) tokens.
    // Tokens minted before the scope claim existed have no `scope` and remain
    // valid as user tokens.
    if (payload.scope && payload.scope !== 'user') {
      throw new UnauthorizedException('Invalid token scope');
    }

    const user = await this.usersService.findOne(payload.sub).catch(() => null);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (!user.isActive || user.isSuspended) {
      throw new UnauthorizedException('Account is inactive or suspended');
    }
    return user;
  }
}
