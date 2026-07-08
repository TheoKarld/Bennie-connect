import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductModerationDocument = ProductModeration & Document;

export const MODERATION_DECISIONS = [
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'AUTO_APPROVED',
] as const;

/**
 * Append-only moderation decision history (admin marketplace PRD §2.4).
 * `AUTO_APPROVED` records the create-time approval of admin-created products.
 */
@Schema({ timestamps: true, collection: 'productModeration' })
export class ProductModeration {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  /** Denormalized for filtering; null for ADMIN-source products. */
  @Prop({ type: Types.ObjectId, ref: 'Merchant', default: null })
  merchantId?: Types.ObjectId | null;

  @Prop({ type: String, enum: MODERATION_DECISIONS, required: true })
  decision: (typeof MODERATION_DECISIONS)[number];

  @Prop({ type: String })
  reason?: string;

  /** ref adminUsers; null when AUTO_APPROVED. */
  @Prop({ type: Types.ObjectId, default: null })
  reviewedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: () => new Date() })
  reviewedAt: Date;
}

export const ProductModerationSchema =
  SchemaFactory.createForClass(ProductModeration);

ProductModerationSchema.index({ productId: 1, createdAt: -1 });
ProductModerationSchema.index({ merchantId: 1, createdAt: -1 });
