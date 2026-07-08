import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WithdrawalRequestDocument = WithdrawalRequest & Document;

export type WithdrawalStatus =
  'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED';

@Schema({ _id: false })
export class WithdrawalSeerBitData {
  @Prop({ type: String })
  transferRef?: string;

  @Prop({ type: String })
  batchId?: string;
}

const WithdrawalSeerBitDataSchema = SchemaFactory.createForClass(
  WithdrawalSeerBitData,
);

@Schema({ timestamps: true, collection: 'withdrawalRequests' })
export class WithdrawalRequest {
  @Prop({ type: Types.ObjectId, ref: 'Wallet', required: true })
  walletId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BankAccount' })
  bankAccountId?: Types.ObjectId;

  // Denormalized destination bank details (also captured on the ledger row).
  @Prop({ type: String })
  accountNumber?: string;

  @Prop({ type: String })
  accountName?: string;

  @Prop({ type: String })
  bankCode?: string;

  @Prop({ type: String })
  bankName?: string;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: Number, required: true, default: 0 })
  fee: number;

  @Prop({ type: Number, required: true })
  totalAmount: number;

  @Prop({
    type: String,
    enum: [
      'PENDING',
      'APPROVED',
      'PROCESSING',
      'COMPLETED',
      'REJECTED',
      'FAILED',
    ],
    default: 'PENDING',
  })
  status: WithdrawalStatus;

  @Prop({ type: String, required: true, unique: true })
  reference: string;

  @Prop({ type: String })
  narration?: string;

  @Prop({ type: Types.ObjectId, ref: 'AdminUser' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Date })
  processedAt?: Date;

  @Prop({ type: String })
  failureReason?: string;

  @Prop({ type: WithdrawalSeerBitDataSchema })
  seerBitData?: WithdrawalSeerBitData;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export const WithdrawalRequestSchema =
  SchemaFactory.createForClass(WithdrawalRequest);

// reference uniqueness declared inline on the @Prop above.
WithdrawalRequestSchema.index({ status: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ walletId: 1 });
WithdrawalRequestSchema.index({ userId: 1 });
