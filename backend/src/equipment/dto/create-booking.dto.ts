import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class GeoPointDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}

export class CreateBookingDto {
  @IsMongoId()
  equipmentId: string;

  @IsISO8601()
  startDate: string;

  @IsISO8601()
  endDate: string;

  @IsIn(['HOURLY', 'DAILY'])
  rateType: 'HOURLY' | 'DAILY';

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  pickupLocation?: GeoPointDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
