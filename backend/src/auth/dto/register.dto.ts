import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty({ message: 'Last name is required' })
  @IsString()
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'Str0ng@Pass' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_+=.])/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  @Transform(({ value }) => value?.trim())
  @Matches(/^\+234\d{10}$/, {
    message: 'Enter a valid Nigerian phone number, e.g. +2348012345678',
  })
  phoneNumber: string;

  @ApiPropertyOptional({ example: 'JOH1A2B3' })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
