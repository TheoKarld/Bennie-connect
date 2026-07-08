import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InitiateDepositDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsEnum(['CARD', 'BANK_TRANSFER', 'USSD'])
  method?: 'CARD' | 'BANK_TRANSFER' | 'USSD';
}

export class VerifyDepositDto {
  @IsString()
  reference: string;
}

export class InternalTransferDto {
  @IsEmail()
  recipientEmail: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  narration?: string;
}

export class WithdrawDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  bankCode: string;

  @IsString()
  @Matches(/^\d{10}$/, { message: 'accountNumber must be a 10-digit NUBAN' })
  accountNumber: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  narration?: string;
}

export class ListTransactionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(['CREDIT', 'DEBIT'])
  type?: 'CREDIT' | 'DEBIT';

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED'])
  status?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class ListWithdrawalsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum([
    'PENDING',
    'APPROVED',
    'PROCESSING',
    'COMPLETED',
    'REJECTED',
    'FAILED',
  ])
  status?: string;
}

export class ResolveTransferDto {
  @IsEmail()
  email: string;
}
