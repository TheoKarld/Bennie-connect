import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MerchantPayoutRequestDocument = MerchantPayoutRequest & Document;

export const PAYOUT_STATUSES = [
  'REQUESTED',
  'MARKED_SENT',
  'CONFIRMED_RECEIVED',
  'CANCELLED',
] as const;

/**
 * Manual, adashe-style payout lifecycle (data_structure.md §11.7):
 * REQUESTED (merchant; holds the amount + locks entries) → MARKED_SENT
 * (Super Admin, `merchants:mark-payout-sent`, funds wired OFF-platform) →
 * CONFIRMED_RECEIVED (merchant; entries settle). CANCELLED unlocks entries.
 * No wallet movement ever occurs.
 */
@Schema({ timestamps: true, collection: 'merchantPayoutRequests' })
export class MerchantPayoutRequest {
  /** Unique business id, "MPR_<ts>_<rand>". */
  @Prop({ type: String, required: true, unique: true })
  requestId: string;

  @Prop({ type: Types.ObjectId, ref: 'Merchant', required: true })
  merchantId: Types.ObjectId;

  /** NGN — the held amount. */
  @Prop({ type: Number, required: true })
  amount: number;

  /** merchantEarnings entries locked into this request. */
  @Prop({ type: [Types.ObjectId], default: [] })
  entryIds: Types.ObjectId[];

  @Prop({
    type: {
      bankName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      accountName: { type: String, required: true },
    },
    _id: false,
    required: true,
  })
  bankAccount: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };

  @Prop({ type: String, enum: PAYOUT_STATUSES, default: 'REQUESTED' })
  status: (typeof PAYOUT_STATUSES)[number];

  @Prop({ type: Date, default: () => new Date() })
  requestedAt: Date;

  /** ref adminUsers (Super Admin who wired the funds). */
  @Prop({ type: Types.ObjectId, default: null })
  markedSentBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  markedSentAt?: Date | null;

  /** Off-platform transfer reference — REQUIRED at mark-sent. */
  @Prop({ type: String, default: null })
  paymentReference?: string | null;

  /** Merchant confirms received (user plane). */
  @Prop({ type: Date, default: null })
  confirmedAt?: Date | null;

  /** 'merchant' or the cancelling admin's id string. */
  @Prop({ type: String, default: null })
  cancelledBy?: string | null;

  @Prop({ type: String, default: null })
  cancelReason?: string | null;
}

export const MerchantPayoutRequestSchema = SchemaFactory.createForClass(
  MerchantPayoutRequest,
);

MerchantPayoutRequestSchema.index({ merchantId: 1, status: 1 });
MerchantPayoutRequestSchema.index({ status: 1, requestedAt: 1 });
MerchantPayoutRequestSchema.index({ merchantId: 1, createdAt: -1 });
// One active request per merchant.
MerchantPayoutRequestSchema.index(
  { merchantId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['REQUESTED', 'MARKED_SENT'] },
    },
    name: 'one_active_payout_per_merchant',
  },
);
