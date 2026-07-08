import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GroupMemberDocument = GroupMember &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

export type GroupMemberStatus =
  'INVITED' | 'ACTIVE' | 'RECEIVED_PAYOUT' | 'EXITED' | 'REMOVED';

export type ContributionStatus = 'PENDING' | 'PAID' | 'LATE' | 'MISSED';

class MemberContribution {
  @Prop({ type: Number, required: true })
  cycle: number;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({
    type: String,
    enum: ['PENDING', 'PAID', 'LATE', 'MISSED'],
    default: 'PAID',
  })
  status: ContributionStatus;
}

@Schema({ timestamps: true, collection: 'groupMembers' })
export class GroupMember {
  @Prop({ type: Types.ObjectId, ref: 'contributionGroups', required: true })
  groupId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'users', required: true })
  userId: Types.ObjectId;

  /** Rotation position (1-based). Assigned on accept. */
  @Prop({ type: Number, required: true })
  position: number;

  @Prop({ type: Date, default: Date.now })
  joinedAt: Date;

  @Prop({
    type: String,
    enum: ['INVITED', 'ACTIVE', 'RECEIVED_PAYOUT', 'EXITED', 'REMOVED'],
    default: 'ACTIVE',
  })
  status: GroupMemberStatus;

  @Prop({ type: [MemberContribution], default: [] })
  contributions: MemberContribution[];

  @Prop({ type: Number, default: 0 })
  totalContributed: number;
}

export const GroupMemberSchema = SchemaFactory.createForClass(GroupMember);

GroupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
GroupMemberSchema.index({ userId: 1 });
GroupMemberSchema.index({ groupId: 1, status: 1 });
