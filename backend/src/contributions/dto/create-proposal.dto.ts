import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProposalDto {
  @IsString()
  @MaxLength(160)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;
}
