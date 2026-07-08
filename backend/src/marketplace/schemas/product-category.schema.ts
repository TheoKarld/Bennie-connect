import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductCategoryDocument = ProductCategory & Document;

/**
 * Admin-owned product categories (data_structure.md §11.1). Seeded
 * idempotently on module init with the 8 locked frontend names.
 */
@Schema({ timestamps: true, collection: 'productCategories' })
export class ProductCategory {
  @Prop({ type: String, required: true, unique: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true })
  slug: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  icon?: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  /** ref adminUsers — null for seeded rows. */
  @Prop({ type: Types.ObjectId, default: null })
  createdBy?: Types.ObjectId | null;
}

export const ProductCategorySchema =
  SchemaFactory.createForClass(ProductCategory);

ProductCategorySchema.index({ isActive: 1, sortOrder: 1 });
