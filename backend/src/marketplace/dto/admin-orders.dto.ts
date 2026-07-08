import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const toBool = ({ value }: { value: any }) =>
  value === true || value === 'true' || value === '1';

export class ListOrdersAdminDto {
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
  @MaxLength(60)
  orderNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  checkoutGroupId?: string;

  @IsOptional()
  @IsMongoId()
  buyerId?: string;

  @IsOptional()
  @IsIn(['PLATFORM', 'MERCHANT'])
  sellerType?: string;

  @IsOptional()
  @IsMongoId()
  merchantId?: string;

  @IsOptional()
  @IsMongoId()
  productId?: string;

  @IsOptional()
  @IsIn(['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'])
  paymentStatus?: string;

  @IsOptional()
  @IsIn(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
  fulfillmentStatus?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxTotal?: number;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  buyerConfirmed?: boolean;

  @IsOptional()
  @IsIn(['createdAt', 'total'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string = 'desc';
}

export class AdminFulfillmentDto {
  @IsIn(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'])
  fulfillmentStatus: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsObject()
  trackingInfo?: { carrier?: string; trackingNumber?: string };
}

export class AdminCancelOrderDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsBoolean()
  restock?: boolean = true;
}

export class AdminRefundDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsBoolean()
  restock?: boolean;

  /** Super Admin may refund outside the window — audited with the reason. */
  @IsOptional()
  @IsBoolean()
  overrideWindow?: boolean;
}
