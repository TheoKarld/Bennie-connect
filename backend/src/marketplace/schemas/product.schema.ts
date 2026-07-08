import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ProductDocument = Product & Document;

export const PRODUCT_SOURCES = ['ADMIN', 'MERCHANT'] as const;
export const PRODUCT_MODERATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
] as const;
export const PRODUCT_STATUSES = ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'] as const;

/**
 * LIVE marketplace product (data_structure.md §11.2). Media is embedded as
 * full FileMetadata JSON (max 3 images + 1 video, public bucket); deletion
 * cascades media removal via UploadService.
 */
@Schema({ timestamps: true, collection: 'products' })
export class Product {
  /** Unique business id, "PRD_<ts>_<rand>". */
  @Prop({ type: String, required: true, unique: true })
  productId: string;

  /** ADMIN = platform product (skips moderation, sells as PLATFORM orders). */
  @Prop({ type: String, enum: PRODUCT_SOURCES, required: true })
  source: (typeof PRODUCT_SOURCES)[number];

  /** ref merchants — required when source = MERCHANT. */
  @Prop({ type: Types.ObjectId, ref: 'Merchant' })
  merchantId?: Types.ObjectId;

  /** ref adminUsers — set when source = ADMIN. */
  @Prop({ type: Types.ObjectId })
  createdByAdminId?: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, unique: true })
  slug: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'ProductCategory', required: true })
  categoryId: Types.ObjectId;

  /** Whole NGN per unit. */
  @Prop({ type: Number, required: true, min: 1 })
  price: number;

  @Prop({ type: String, required: true })
  unit: string;

  @Prop({
    type: {
      available: { type: Number, default: 0 },
      reserved: { type: Number, default: 0 },
      lowStockThreshold: { type: Number, default: null },
    },
    _id: false,
    default: () => ({ available: 0, reserved: 0, lowStockThreshold: null }),
  })
  inventory: {
    available: number;
    reserved: number;
    lowStockThreshold?: number | null;
  };

  /** Embedded FileMetadata JSON — max 3, public bucket. */
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  images: Record<string, any>[];

  /** Embedded FileMetadata JSON — max 1, public bucket. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  video?: Record<string, any> | null;

  @Prop({
    type: String,
    enum: PRODUCT_MODERATION_STATUSES,
    default: 'PENDING',
  })
  moderationStatus: (typeof PRODUCT_MODERATION_STATUSES)[number];

  @Prop({ type: String })
  moderationReason?: string;

  @Prop({ type: Types.ObjectId })
  moderatedBy?: Types.ObjectId;

  @Prop({ type: Date })
  moderatedAt?: Date;

  @Prop({ type: String, enum: PRODUCT_STATUSES, default: 'ACTIVE' })
  status: (typeof PRODUCT_STATUSES)[number];

  /** True while the owning merchant is suspended (delist). */
  @Prop({ type: Boolean, default: false })
  suspended: boolean;

  /** Units across DELIVERED orders (drives "popular" sort). */
  @Prop({ type: Number, default: 0 })
  totalSales: number;

  /** Merchant soft delete — hidden everywhere when set. */
  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ merchantId: 1, status: 1 });
ProductSchema.index({ moderationStatus: 1, createdAt: 1 });
ProductSchema.index({ categoryId: 1, status: 1 });
ProductSchema.index({ status: 1, moderationStatus: 1, suspended: 1 });
ProductSchema.index({ totalSales: -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ name: 'text', description: 'text' });
