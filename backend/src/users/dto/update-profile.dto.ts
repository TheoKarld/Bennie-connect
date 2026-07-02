import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Self-service profile update. Deliberately excludes privileged fields such as
 * role, password, verification flags and balances.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lga?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  farmName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  farmSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  farmSizeUnit?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  cropsOfInterest?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  livestockOfInterest?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileImageUrl?: string;
}
