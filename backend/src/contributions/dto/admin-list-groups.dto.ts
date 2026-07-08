import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminListGroupsDto {
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
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(['FORMING', 'ACTIVE', 'COMPLETED', 'SUSPENDED'])
  status?: 'FORMING' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED';

  @IsOptional()
  @IsEnum(['ADASHE', 'ESUSU', 'CUSTOM'])
  type?: 'ADASHE' | 'ESUSU' | 'CUSTOM';

  @IsOptional()
  @IsEnum(['WEEKLY', 'MONTHLY'])
  frequency?: 'WEEKLY' | 'MONTHLY';
}
