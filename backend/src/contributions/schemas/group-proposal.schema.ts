import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GroupProposalDocument = GroupProposal &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

export type ProposalKind = 'GENERAL' | 'SLOT_SHIFT';
export type ProposalStatus =
  | 'ACTIVE'
  | 'PASSED'
  | 'REJECTED'
  | 'AWAITING_ADMIN'
  | 'APPROVED'
  | 'DECLINED'
  | 'CANCELLED';
export type VoteValue = 'yes' | 'no';
export type AdminDecisionKind = 'APPROVE' | 'REJECT';

class SlotShift {
  @Prop({ type: Types.ObjectId, ref: 'groupMembers', required: true })
  requesterMemberId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  requesterPosition: number;

  @Prop({ type: Types.ObjectId, ref: 'groupMembers', required: true })
  targetMemberId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  targetPosition: number;
}

class ProposalVote {
  @Prop({ type: Types.ObjectId, ref: 'users', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ['yes', 'no'], required: true })
  vote: VoteValue;

  @Prop({ type: Date, default: Date.now })
  at: Date;
}

class Tally {
  @Prop({ type: Number, default: 0 })
  yes: number;

  @Prop({ type: Number, default: 0 })
  no: number;
}

class AdminDecision {
  @Prop({ type: Types.ObjectId, ref: 'adminUsers', required: true })
  adminId: Types.ObjectId;

  @Prop({ type: String, enum: ['APPROVE', 'REJECT'], required: true })
  decision: AdminDecisionKind;

  @Prop({ type: String })
  reason?: string;

  @Prop({ type: Date, default: Date.now })
  at: Date;
}

@Schema({ timestamps: true, collection: 'groupProposals' })
export class GroupProposal {
  @Prop({ type: Types.ObjectId, ref: 'contributionGroups', required: true })
  groupId: Types.ObjectId;

  @Prop({ type: String, enum: ['GENERAL', 'SLOT_SHIFT'], required: true })
  kind: ProposalKind;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, default: '' })
  text: string;

  @Prop({ type: Types.ObjectId, ref: 'users', required: true })
  createdByUserId: Types.ObjectId;

  @Prop({ type: SlotShift })
  slotShift?: SlotShift;

  @Prop({
    type: String,
    enum: [
      'ACTIVE',
      'PASSED',
      'REJECTED',
      'AWAITING_ADMIN',
      'APPROVED',
      'DECLINED',
      'CANCELLED',
    ],
    default: 'ACTIVE',
  })
  status: ProposalStatus;

  @Prop({ type: [ProposalVote], default: [] })
  votes: ProposalVote[];

  /** Count of ACTIVE members eligible to vote at creation time. */
  @Prop({ type: Number, default: 0 })
  eligibleCount: number;

  @Prop({ type: Tally, default: () => ({ yes: 0, no: 0 }) })
  tally: Tally;

  @Prop({ type: AdminDecision })
  adminDecision?: AdminDecision;
}

export const GroupProposalSchema = SchemaFactory.createForClass(GroupProposal);

GroupProposalSchema.index({ groupId: 1, status: 1 });
GroupProposalSchema.index({ groupId: 1, createdAt: -1 });
