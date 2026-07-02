import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService, AuthResult } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { clearRefreshCookie, setRefreshCookie } from '../common/cookie.util';

const USER_REFRESH_COOKIE = 'bennie_user_rt';
const USER_COOKIE_PATH = '/api/v1/auth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private meta(req: Request) {
    return {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip,
    };
  }

  private secure(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Moves the refresh token out of the response body and into the httpOnly
   * `bennie_user_rt` cookie. Returns the body-safe envelope (no refreshToken).
   */
  private withCookie(res: Response, result: AuthResult) {
    setRefreshCookie(res, result.data.refreshToken, {
      name: USER_REFRESH_COOKIE,
      path: USER_COOKIE_PATH,
      secure: this.secure(),
    });
    const { refreshToken, ...data } = result.data;
    void refreshToken;
    return { success: result.success, message: result.message, data };
  }

  private readRt(req: Request, body?: RefreshTokenDto): string | undefined {
    // Cookie-first, body-fallback (keeps the current SPA working until it
    // migrates to the cookie flow).
    return req.cookies?.[USER_REFRESH_COOKIE] || body?.refreshToken;
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new local account' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, this.meta(req));
    return this.withCookie(res, result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.meta(req));
    return this.withCookie(res, result);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login/register with a Google ID token' })
  async google(
    @Body() dto: GoogleAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWithGoogle(
      { idToken: dto.idToken, accessToken: dto.accessToken },
      this.meta(req),
    );
    return this.withCookie(res, result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate access + refresh tokens (reads cookie)' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refresh(
      this.readRt(req, dto),
      this.meta(req),
    );
    return this.withCookie(res, result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the presented refresh token' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(this.readRt(req, dto));
    clearRefreshCookie(res, {
      name: USER_REFRESH_COOKIE,
      path: USER_COOKIE_PATH,
      secure: this.secure(),
    });
    return result;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a password-reset link' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reset a password with a valid token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user' })
  me(@CurrentUser() user: UserDocument) {
    return { success: true, data: { user: user.toJSON() } };
  }
}
