import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}
