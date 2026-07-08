import { IsEnum } from 'class-validator';

export class VoteDto {
  @IsEnum(['yes', 'no'])
  vote: 'yes' | 'no';
}
