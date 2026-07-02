import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  // Optional: the refresh token is normally read from the httpOnly
  // `bennie_user_rt` cookie. The body field is a fallback for pre-cookie
  // clients and for `/logout`.
  @ApiPropertyOptional({
    description: 'A valid refresh token (cookie fallback)',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
