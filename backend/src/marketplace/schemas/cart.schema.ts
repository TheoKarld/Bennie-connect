import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CartDocument = Cart & Document;

/**
 * One live cart per user (data_structure.md §11.3). Prices are never stored —
 * the cart read enriches lines with the product's CURRENT price; prices are
 * only snapshotted into orders at checkout.
 */
@Schema({ timestamps: true, collection: 'carts' })
export class Cart {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({
    type: [
      {
        productId: { type: Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        addedAt: { type: Date, default: () => new Date() },
      },
    ],
    default: [],
  })
  items: {
    _id?: Types.ObjectId;
    productId: Types.ObjectId;
    quantity: number;
    addedAt: Date;
  }[];
}

export const CartSchema = SchemaFactory.createForClass(Cart);

CartSchema.index({ 'items.productId': 1 });
