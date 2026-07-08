import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SuspendGroupDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class MarkPayoutSentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CancelPayoutDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
