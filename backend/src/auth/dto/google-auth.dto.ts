import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * The client may authenticate with either a Google ID token (from the
 * `<GoogleLogin>` credential flow) or an OAuth access token (from a custom
 * button using the implicit `useGoogleLogin` flow). At least one is required —
 * enforced in AuthService.loginWithGoogle.
 */
export class GoogleAuthDto {
  @ApiPropertyOptional({ description: 'Google ID token (credential flow)' })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional({
    description: 'Google OAuth access token (implicit flow)',
  })
  @IsOptional()
  @IsString()
  accessToken?: string;
}
