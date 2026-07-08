import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MERCHANT_ID_TYPES } from '../marketplace.constants';

export class BusinessInfoDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  businessAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lga?: string;

  @IsOptional()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'phoneNumber must be a valid Nigerian mobile number',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @Matches(/^(RC|BN|rc|bn)\d{5,8}$/, {
    message: 'cacNumber must be RC/BN followed by 5–8 digits',
  })
  cacNumber?: string;
}

export class KycDocumentDto {
  @IsIn(['ID_FRONT', 'ID_BACK', 'SELFIE_WITH_ID'])
  label: string;

  @IsMongoId()
  fileId: string;
}

export class KycInfoDto {
  @IsOptional()
  @IsIn([...MERCHANT_ID_TYPES, 'DRIVERS_LICENSE'])
  idType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  idNumber?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KycDocumentDto)
  documents?: KycDocumentDto[];
}

export class MerchantKycDto {
  @IsOptional()
  @IsBoolean()
  submit?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BusinessInfoDto)
  businessInfo?: BusinessInfoDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => KycInfoDto)
  kyc?: KycInfoDto;
}

export class MerchantProductCreateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @IsMongoId()
  categoryId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  price: number;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unit: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock: number;

  /** Embedded FileMetadata objects (already uploaded, public bucket). */
  @IsArray()
  images: Record<string, any>[];

  @IsOptional()
  video?: Record<string, any> | null;
}

export class MerchantProductUpdateDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  price?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @IsOptional()
  @IsArray()
  images?: Record<string, any>[];

  @IsOptional()
  video?: Record<string, any> | null;
}

export class ListMerchantProductsDto {
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
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'])
  moderationStatus?: string;
}

export class ListMerchantOrdersDto {
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
  @IsIn(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
  status?: string;
}

export class MerchantFulfillmentDto {
  @IsIn(['PROCESSING', 'SHIPPED', 'DELIVERED'])
  status: string;
}

export class ListEarningsDto {
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
}

export class BankDetailsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  bankName: string;

  @Matches(/^\d{10}$/, { message: 'accountNumber must be a 10-digit NUBAN' })
  accountNumber: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  accountName: string;
}

export class CreatePayoutRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @IsObject()
  @ValidateNested()
  @Type(() => BankDetailsDto)
  bankDetails: BankDetailsDto;
}
