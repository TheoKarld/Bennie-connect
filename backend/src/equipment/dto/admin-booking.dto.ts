import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  BOOKING_PAYMENT_STATUSES,
  BOOKING_STATUSES,
} from '../schemas/equipment-booking.schema';
import { GeoPointDto } from './create-booking.dto';

export class ListBookingsAdminDto {
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
  @IsMongoId()
  equipmentId?: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(BOOKING_PAYMENT_STATUSES)
  paymentStatus?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  overdue?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  awaitingPayment?: string;
}

export class OperatorFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  operatorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  operatorPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  operatorPlate?: string;
}

export class ApproveBookingDto extends OperatorFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectBookingDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class HandoverBookingDto extends OperatorFieldsDto {
  @IsOptional()
  @IsISO8601()
  actualStartDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class DamageReportDto {
  @IsString()
  @MaxLength(500)
  description: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  costEstimate: number;
}

export class CompleteBookingDto {
  @IsOptional()
  @IsISO8601()
  actualEndDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  returnLocation?: GeoPointDto;

  @IsOptional()
  @IsIn(['OK', 'DAMAGED'])
  condition?: 'OK' | 'DAMAGED';

  @IsOptional()
  @ValidateNested()
  @Type(() => DamageReportDto)
  damageReport?: DamageReportDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  usageHours?: number;
}

export class AdminCancelBookingDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class DepositRefundDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DepositDeductDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @MaxLength(500)
  description: string;
}
