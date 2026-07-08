import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class LatLngDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class CreateGeofenceDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsIn(['CIRCLE', 'POLYGON'])
  type: 'CIRCLE' | 'POLYGON';

  @IsOptional()
  @ValidateNested()
  @Type(() => LatLngDto)
  center?: LatLngDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  radiusMeters?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LatLngDto)
  polygon?: LatLngDto[];

  @IsOptional()
  @IsIn(['ALL', 'EQUIPMENT', 'CATEGORY'])
  appliesTo?: 'ALL' | 'EQUIPMENT' | 'CATEGORY';

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  equipmentIds?: string[];

  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateGeofenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(['CIRCLE', 'POLYGON'])
  type?: 'CIRCLE' | 'POLYGON';

  @IsOptional()
  @ValidateNested()
  @Type(() => LatLngDto)
  center?: LatLngDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  radiusMeters?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LatLngDto)
  polygon?: LatLngDto[];

  @IsOptional()
  @IsIn(['ALL', 'EQUIPMENT', 'CATEGORY'])
  appliesTo?: 'ALL' | 'EQUIPMENT' | 'CATEGORY';

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  equipmentIds?: string[];

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRateConfigDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultHourlyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultDailyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minDepositNgn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overdueFeePerDay?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
