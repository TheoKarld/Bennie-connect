import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MerchantEarningDocument = MerchantEarning & Document;

export const EARNING_TYPES = ['ORDER_EARNING', 'ADJUSTMENT'] as const;
export const EARNING_STATUSES = [
  'AVAILABLE',
  'LOCKED',
  'SETTLED',
  'REVERSED',
] as const;

/**
 * Merchant earnings ledger (data_structure.md §11.6) — NOT the wallet.
 * One ORDER_EARNING per DELIVERED MERCHANT order (idempotent per orderId);
 * ADJUSTMENT rows record refund clawbacks (net may be negative).
 */
@Schema({ timestamps: true, collection: 'merchantEarnings' })
export class MerchantEarning {
  @Prop({ type: Types.ObjectId, ref: 'Merchant', required: true })
  merchantId: Types.ObjectId;

  @Prop({ type: String, enum: EARNING_TYPES, required: true })
  type: (typeof EARNING_TYPES)[number];

  /** ref orders — UNIQUE per ORDER_EARNING (partial index below). */
  @Prop({ type: Types.ObjectId, ref: 'Order', default: null })
  orderId?: Types.ObjectId | null;

  /** Denormalized for display. */
  @Prop({ type: String, default: null })
  orderNumber?: string | null;

  /** NGN (order pricing.total). */
  @Prop({ type: Number, required: true })
  gross: number;

  @Prop({ type: Number, default: 0 })
  platformFeePercent: number;

  @Prop({ type: Number, default: 0 })
  platformFee: number;

  /** NGN — gross − platformFee; negative on clawback ADJUSTMENT. */
  @Prop({ type: Number, required: true })
  net: number;

  @Prop({ type: String, enum: EARNING_STATUSES, default: 'AVAILABLE' })
  status: (typeof EARNING_STATUSES)[number];

  /** ref merchantPayoutRequests (set when LOCKED/SETTLED). */
  @Prop({ type: Types.ObjectId, ref: 'MerchantPayoutRequest', default: null })
  payoutRequestId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  note?: string | null;

  @Prop({ type: Date, default: () => new Date() })
  bookedAt: Date;

  @Prop({ type: Date, default: null })
  settledAt?: Date | null;
}

export const MerchantEarningSchema =
  SchemaFactory.createForClass(MerchantEarning);

// Idempotent booking backstop: one ORDER_EARNING per order.
MerchantEarningSchema.index(
  { orderId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'ORDER_EARNING' },
  },
);
MerchantEarningSchema.index({ merchantId: 1, status: 1 });
MerchantEarningSchema.index({ merchantId: 1, createdAt: -1 });
MerchantEarningSchema.index({ payoutRequestId: 1 });
