import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PayoutRequestDocument = PayoutRequest &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

export type PayoutRequestStatus =
  'REQUESTED' | 'MARKED_SENT' | 'CONFIRMED_RECEIVED' | 'DISPUTED' | 'CANCELLED';

@Schema({ timestamps: true, collection: 'payoutRequests' })
export class PayoutRequest {
  @Prop({ type: Types.ObjectId, ref: 'contributionGroups', required: true })
  groupId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  cycle: number;

  @Prop({ type: Number, required: true })
  position: number;

  @Prop({ type: Types.ObjectId, ref: 'groupMembers', required: true })
  recipientMemberId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'users', required: true })
  recipientUserId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({
    type: String,
    enum: [
      'REQUESTED',
      'MARKED_SENT',
      'CONFIRMED_RECEIVED',
      'DISPUTED',
      'CANCELLED',
    ],
    default: 'REQUESTED',
  })
  status: PayoutRequestStatus;

  @Prop({ type: Date, default: Date.now })
  requestedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'adminUsers' })
  markedSentBy?: Types.ObjectId;

  @Prop({ type: Date })
  markedSentAt?: Date;

  /** Off-platform bank/transfer reference recorded when an admin marks-sent. */
  @Prop({ type: String })
  paymentReference?: string;

  @Prop({ type: Date })
  confirmedAt?: Date;

  /** Reason recorded when an admin cancels the request. */
  @Prop({ type: String })
  cancelReason?: string;

  @Prop({ type: String })
  note?: string;

  @Prop({ type: String, required: true, unique: true })
  idempotencyKey: string;
}

export const PayoutRequestSchema = SchemaFactory.createForClass(PayoutRequest);

PayoutRequestSchema.index({ groupId: 1, status: 1 });
PayoutRequestSchema.index({ status: 1, requestedAt: 1 });
