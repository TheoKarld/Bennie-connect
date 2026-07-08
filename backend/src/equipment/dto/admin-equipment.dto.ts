import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_STATUSES,
} from '../schemas/equipment.schema';
import { GeoPointDto } from './create-booking.dto';

export class GpsTrackerDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateEquipmentDto {
  @IsString()
  name: string;

  @IsIn(EQUIPMENT_CATEGORIES)
  category: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearOfManufacture?: number;

  @IsOptional()
  @IsMongoId()
  cooperativeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositRequired?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location?: GeoPointDto;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GpsTrackerDto)
  gpsTracker?: GpsTrackerDto;
}

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(EQUIPMENT_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearOfManufacture?: number;

  @IsOptional()
  @IsIn(EQUIPMENT_STATUSES)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositRequired?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location?: GeoPointDto;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GpsTrackerDto)
  gpsTracker?: GpsTrackerDto;
}

export class ListEquipmentAdminDto {
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
  q?: string;

  @IsOptional()
  @IsIn(EQUIPMENT_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsIn(EQUIPMENT_STATUSES)
  status?: string;

  @IsOptional()
  @IsMongoId()
  cooperativeId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  gpsActive?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  dueForMaintenance?: string;

  @IsOptional()
  @IsIn(['createdAt', 'bookingHistory'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

export class ScheduleMaintenanceDto {
  @IsString()
  type: string;

  @IsString()
  dueDate: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  blockNow?: boolean;
}
