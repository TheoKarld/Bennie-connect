import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DepositRequestDocument = DepositRequest & Document;

export type DepositMethod = 'CARD' | 'BANK_TRANSFER' | 'USSD';

export type DepositStatus =
  'PENDING' | 'INITIATED' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

@Schema({ _id: false })
export class DepositSeerBitData {
  @Prop({ type: String })
  checkoutUrl?: string;

  @Prop({ type: String })
  transactionRef?: string;

  @Prop({ type: String })
  orderId?: string;

  @Prop({ type: Date })
  expiresAt?: Date;
}

const DepositSeerBitDataSchema =
  SchemaFactory.createForClass(DepositSeerBitData);

@Schema({ timestamps: true, collection: 'depositRequests' })
export class DepositRequest {
  @Prop({ type: Types.ObjectId, ref: 'Wallet', required: true })
  walletId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({
    type: String,
    enum: ['CARD', 'BANK_TRANSFER', 'USSD'],
    default: 'CARD',
  })
  method: DepositMethod;

  @Prop({
    type: String,
    enum: ['PENDING', 'INITIATED', 'COMPLETED', 'FAILED', 'EXPIRED'],
    default: 'PENDING',
  })
  status: DepositStatus;

  @Prop({ type: String, required: true, unique: true })
  reference: string;

  @Prop({ type: DepositSeerBitDataSchema })
  seerBitData?: DepositSeerBitData;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: String })
  failureReason?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export const DepositRequestSchema =
  SchemaFactory.createForClass(DepositRequest);

// reference uniqueness declared inline on the @Prop above.
DepositRequestSchema.index({ walletId: 1 });
DepositRequestSchema.index({ status: 1 });
