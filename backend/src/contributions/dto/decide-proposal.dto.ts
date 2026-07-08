import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideProposalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
