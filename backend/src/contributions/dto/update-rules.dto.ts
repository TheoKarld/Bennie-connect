import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateRulesDto {
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
