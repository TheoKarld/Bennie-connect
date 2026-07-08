import { IsArray, IsEmail, IsOptional } from 'class-validator';
import { CreateGroupDto } from './create-group.dto';

export class AdminCreateGroupDto extends CreateGroupDto {
  /** Optional list of emails to invite immediately after creation. */
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  inviteEmails?: string[];
}

export class AdminInviteDto {
  @IsEmail()
  email: string;
}
