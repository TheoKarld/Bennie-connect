import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { MustChangePasswordGuard } from '../guards/must-change-password.guard';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminUserDocument } from '../schemas/admin-user.schema';
import { ADMIN_COOKIE_PATH, ADMIN_REFRESH_COOKIE } from '../admin.constants';
import { clearRefreshCookie, setRefreshCookie } from '../../common/cookie.util';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  private meta(req: Request) {
    return {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || '',
    };
  }

  private secure(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private setRt(res: Response, token: string): void {
    setRefreshCookie(res, token, {
      name: ADMIN_REFRESH_COOKIE,
      path: ADMIN_COOKIE_PATH,
      secure: this.secure(),
    });
  }

  private readRt(req: Request): string | undefined {
    return req.cookies?.[ADMIN_REFRESH_COOKIE];
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Admin sign-in' })
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { admin, tokens } = await this.adminAuthService.login(
      dto,
      this.meta(req),
    );
    this.setRt(res, tokens.refreshToken);
    return {
      success: true,
      data: {
        admin,
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate admin tokens (reads refresh cookie)' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.adminAuthService.refresh(
      this.readRt(req),
      this.meta(req),
    );
    this.setRt(res, tokens.refreshToken);
    return {
      success: true,
      data: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the admin refresh session' })
  async logout(
    @CurrentAdmin() admin: AdminUserDocument,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.adminAuthService.logout(admin, this.readRt(req), this.meta(req));
    clearRefreshCookie(res, {
      name: ADMIN_REFRESH_COOKIE,
      path: ADMIN_COOKIE_PATH,
      secure: this.secure(),
    });
    return { success: true, message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated admin with permissions' })
  async me(@CurrentAdmin() admin: AdminUserDocument) {
    return {
      success: true,
      data: { admin: await this.adminAuthService.me(admin) },
    };
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminJwtGuard, MustChangePasswordGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the current admin password' })
  async changePassword(
    @CurrentAdmin() admin: AdminUserDocument,
    @Body() dto: AdminChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.adminAuthService.changePassword(admin, dto, this.meta(req));
    clearRefreshCookie(res, {
      name: ADMIN_REFRESH_COOKIE,
      path: ADMIN_COOKIE_PATH,
      secure: this.secure(),
    });
    return { success: true, message: 'Password changed successfully' };
  }
}
