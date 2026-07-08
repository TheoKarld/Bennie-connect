import { IsNumber, IsOptional, Min } from 'class-validator';

export class ContributeDto {
  /** Optional override; defaults to the group's contributionAmount when omitted. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}
