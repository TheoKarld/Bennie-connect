import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContributionGroupDocument = ContributionGroup &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

export type GroupType = 'ADASHE' | 'ESUSU' | 'CUSTOM';
export type GroupFrequency = 'WEEKLY' | 'MONTHLY';
export type GroupOrganizerType = 'user' | 'admin';
export type GroupStatus = 'FORMING' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED';

/** One slot in the rotation. `memberId` refs `groupMembers`, `userId` refs `users`. */
class PayoutOrderEntry {
  @Prop({ type: Number, required: true })
  position: number;

  @Prop({ type: Types.ObjectId, ref: 'groupMembers', required: true })
  memberId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'users', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  paid: boolean;

  @Prop({ type: Date })
  paidAt?: Date;
}

class GroupRules {
  @Prop({ type: Number, default: 0 })
  lateFeePercent: number;

  @Prop({ type: Number, default: 3 })
  missLimit: number;

  @Prop({ type: Number, default: 0 })
  exitPenalty: number;
}

@Schema({ timestamps: true, collection: 'contributionGroups' })
export class ContributionGroup {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, trim: true, default: '' })
  description: string;

  @Prop({
    type: String,
    enum: ['ADASHE', 'ESUSU', 'CUSTOM'],
    default: 'ADASHE',
  })
  type: GroupType;

  @Prop({ type: String, enum: ['user', 'admin'], required: true })
  organizerType: GroupOrganizerType;

  /** users._id when organizerType=user, adminUsers._id when organizerType=admin */
  @Prop({ type: Types.ObjectId, required: true })
  organizerId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  contributionAmount: number;

  @Prop({ type: String, enum: ['WEEKLY', 'MONTHLY'], default: 'MONTHLY' })
  frequency: GroupFrequency;

  @Prop({ type: Number, required: true, min: 2 })
  maxSlots: number;

  @Prop({ type: Number, default: 1 })
  currentCycle: number;

  /** The rotation position currently expecting/receiving payout (1-based). */
  @Prop({ type: Number, default: 1 })
  activePosition: number;

  @Prop({
    type: String,
    enum: ['FORMING', 'ACTIVE', 'COMPLETED', 'SUSPENDED'],
    default: 'FORMING',
  })
  status: GroupStatus;

  @Prop({ type: [PayoutOrderEntry], default: [] })
  payoutOrder: PayoutOrderEntry[];

  /** Tracked pool counter — NOT a wallet balance. Incremented on contribute. */
  @Prop({ type: Number, default: 0 })
  poolBalance: number;

  @Prop({ type: GroupRules, default: () => ({}) })
  rules: GroupRules;

  @Prop({ type: String })
  suspendReason?: string;
}

export const ContributionGroupSchema =
  SchemaFactory.createForClass(ContributionGroup);

ContributionGroupSchema.index({ organizerId: 1, organizerType: 1 });
ContributionGroupSchema.index({ status: 1 });
ContributionGroupSchema.index({ type: 1 });
