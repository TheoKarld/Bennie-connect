import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class GroupRulesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  lateFeePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  missLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  exitPenalty?: number;
}

export class CreateGroupDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(['ADASHE', 'ESUSU', 'CUSTOM'])
  type?: 'ADASHE' | 'ESUSU' | 'CUSTOM';

  @IsNumber()
  @Min(1)
  contributionAmount: number;

  @IsOptional()
  @IsEnum(['WEEKLY', 'MONTHLY'])
  frequency?: 'WEEKLY' | 'MONTHLY';

  @IsInt()
  @Min(2)
  maxSlots: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GroupRulesDto)
  rules?: GroupRulesDto;
}
