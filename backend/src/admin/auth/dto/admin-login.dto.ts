import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class AdminLoginDto {
  @ApiProperty({ example: 'superadmin@bennieconnect.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'Bennie-2026' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  twoFactorCode?: string;
}
