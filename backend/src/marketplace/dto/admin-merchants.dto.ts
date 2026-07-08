import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListMerchantsAdminDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(['IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'])
  kycStatus?: string;

  @IsOptional()
  @IsIn(['NIN', 'BVN', 'DRIVERS_LICENCE', 'VOTERS_CARD', 'INTL_PASSPORT'])
  idType?: string;

  @IsOptional()
  @IsIn(['true', 'false', 'unchecked'])
  premblyVerified?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  hasPendingPayout?: string;

  @IsOptional()
  @IsIn(['createdAt', 'submittedAt', 'availableBalance'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string = 'desc';
}

export class RejectMerchantDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class SuspendMerchantDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class MarkPayoutSentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  paymentReference: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CancelPayoutAdminDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class ListPayoutsAdminDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['REQUESTED', 'MARKED_SENT', 'CONFIRMED_RECEIVED', 'CANCELLED', 'ALL'])
  status?: string;
}

export class ListEarningsAdminDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['AVAILABLE', 'LOCKED', 'SETTLED', 'REVERSED'])
  status?: string;

  @IsOptional()
  @IsIn(['ORDER_EARNING', 'ADJUSTMENT'])
  type?: string;
}
