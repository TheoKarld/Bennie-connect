import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestSlotShiftDto {
  /** groupMembers._id of the member to swap rotation positions with. */
  @IsMongoId()
  targetMemberId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
