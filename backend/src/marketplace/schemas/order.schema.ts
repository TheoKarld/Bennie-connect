import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type OrderDocument = Order & Document;

export const SELLER_TYPES = ['PLATFORM', 'MERCHANT'] as const;
export const PAYMENT_STATUSES = [
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
export const FULFILLMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;
export const TIMELINE_ACTORS = [
  'buyer',
  'merchant',
  'admin',
  'system',
] as const;

/**
 * Sub-schemas for embedded objects whose fields are literally named `type`
 * (seller.type / cancelledBy.type) — an inline object literal there is
 * misread by Mongoose as a SchemaType definition.
 */
const SellerSubSchema = new MongooseSchema(
  {
    type: { type: String, enum: SELLER_TYPES, required: true },
    merchantId: {
      type: MongooseSchema.Types.ObjectId,
      ref: 'Merchant',
      default: null,
    },
  },
  { _id: false },
);

const CancelledBySubSchema = new MongooseSchema(
  {
    type: { type: String, enum: ['buyer', 'merchant', 'admin'] },
    id: { type: String },
  },
  { _id: false },
);

/**
 * Marketplace order — ONE document per seller per checkout, linked to its
 * siblings by `checkoutGroupId` (data_structure.md §11.4). Wallet-only
 * payment: orders are born PAID from the checkout group's SINGLE wallet debit
 * (`walletPaymentRef = MKTPAY<checkoutGroupId>` — cart_checkout.md is the
 * canonical checkout contract and supersedes the per-order
 * `order-pay:{orderNumber}` wording in the admin orders PRD).
 */
@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ type: String, required: true, unique: true })
  orderNumber: string;

  @Prop({ type: String, required: true })
  checkoutGroupId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  buyerId: Types.ObjectId;

  @Prop({ type: SellerSubSchema, required: true })
  seller: {
    type: (typeof SELLER_TYPES)[number];
    merchantId?: Types.ObjectId | null;
  };

  /** Immutable snapshots taken at checkout. */
  @Prop({
    type: [
      {
        productId: { type: Types.ObjectId, required: true },
        productName: { type: String, required: true },
        imageUrl: { type: String, default: null },
        unit: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        subtotal: { type: Number, required: true },
      },
    ],
    default: [],
  })
  items: {
    _id?: Types.ObjectId;
    productId: Types.ObjectId;
    productName: string;
    imageUrl?: string | null;
    unit: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];

  @Prop({
    type: {
      subtotal: { type: Number, required: true },
      deliveryFee: { type: Number, default: 0 },
      total: { type: Number, required: true },
      platformFeePercent: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      merchantNet: { type: Number, default: null },
    },
    _id: false,
    required: true,
  })
  pricing: {
    subtotal: number;
    deliveryFee: number;
    total: number;
    platformFeePercent: number;
    platformFee: number;
    merchantNet?: number | null;
  };

  /** Wallet-only ⇒ orders are born PAID (no PENDING/FAILED). */
  @Prop({ type: String, enum: PAYMENT_STATUSES, default: 'PAID' })
  paymentStatus: (typeof PAYMENT_STATUSES)[number];

  /** The group's single debit reference: "MKTPAY<checkoutGroupId>". */
  @Prop({ type: String, required: true })
  walletPaymentRef: string;

  /** This order's cancel-refund credit reference ("MKTREF<orderId>"). */
  @Prop({ type: String, default: null })
  refundRef?: string | null;

  @Prop({ type: String, enum: FULFILLMENT_STATUSES, default: 'PENDING' })
  fulfillmentStatus: (typeof FULFILLMENT_STATUSES)[number];

  /** Buyer confirms receipt after DELIVERED (user plane). */
  @Prop({ type: Date, default: null })
  buyerConfirmedAt?: Date | null;

  /**
   * Free-text delivery address captured at checkout (10–300 chars — the
   * cart_checkout.md endpoint contract; one address per checkout group).
   */
  @Prop({ type: String, required: true })
  deliveryAddress: string;

  @Prop({
    type: {
      carrier: { type: String },
      trackingNumber: { type: String },
    },
    _id: false,
    default: null,
  })
  trackingInfo?: { carrier?: string; trackingNumber?: string } | null;

  /** Append-only status trail (drives the stepper UI). */
  @Prop({
    type: [
      {
        status: { type: String, required: true },
        at: { type: Date, default: () => new Date() },
        actorType: { type: String, enum: TIMELINE_ACTORS, required: true },
        actorId: { type: String, default: null },
        note: { type: String, default: null },
      },
    ],
    default: [],
    _id: false,
  })
  timeline: {
    status: string;
    at: Date;
    actorType: (typeof TIMELINE_ACTORS)[number];
    actorId?: string | null;
    note?: string | null;
  }[];

  /** Admin discretionary refunds (orders:refund — Super-Admin-only). */
  @Prop({
    type: [
      {
        amount: { type: Number, required: true },
        reason: { type: String, required: true },
        reference: { type: String, required: true },
        restock: { type: Boolean, default: false },
        refundedBy: { type: Types.ObjectId, required: true },
        at: { type: Date, default: () => new Date() },
      },
    ],
    default: [],
    _id: false,
  })
  refunds: {
    amount: number;
    reason: string;
    reference: string;
    restock: boolean;
    refundedBy: Types.ObjectId;
    at: Date;
  }[];

  /** Cumulative NGN refunded (incl. cancel refunds). */
  @Prop({ type: Number, default: 0 })
  refundedTotal: number;

  /** True once the DELIVERED transition booked the merchantEarnings row. */
  @Prop({ type: Boolean, default: false })
  earningsBooked: boolean;

  @Prop({ type: CancelledBySubSchema, default: null })
  cancelledBy?: { type: 'buyer' | 'merchant' | 'admin'; id?: string } | null;

  @Prop({ type: String, default: null })
  cancellationReason?: string | null;

  @Prop({ type: Date, default: null })
  deliveredAt?: Date | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata?: Record<string, any>;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ checkoutGroupId: 1 });
OrderSchema.index({ buyerId: 1, createdAt: -1 });
OrderSchema.index({ 'seller.merchantId': 1, fulfillmentStatus: 1 });
OrderSchema.index({ 'seller.type': 1, fulfillmentStatus: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ 'items.productId': 1, fulfillmentStatus: 1 });
