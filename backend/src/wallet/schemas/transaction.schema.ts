import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TransactionDocument = Transaction & Document;

export type TransactionType = 'CREDIT' | 'DEBIT';

export type TransactionCategory =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'PAYMENT'
  | 'REFUND'
  | 'FEE'
  | 'INTEREST'
  | 'DIVIDEND'
  | 'SAVINGS_LOCK'
  | 'SAVINGS_UNLOCK'
  | 'CONTRIBUTION'
  | 'COMMISSION';

export type TransactionStatus =
  'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export const TRANSACTION_CATEGORIES: TransactionCategory[] = [
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'PAYMENT',
  'REFUND',
  'FEE',
  'INTEREST',
  'DIVIDEND',
  'SAVINGS_LOCK',
  'SAVINGS_UNLOCK',
  'CONTRIBUTION',
  'COMMISSION',
];

@Schema({ _id: false })
export class TransactionCounterparty {
  @Prop({ type: Types.ObjectId, ref: 'Wallet' })
  walletId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: String })
  name?: string;

  @Prop({ type: String })
  accountNumber?: string;

  @Prop({ type: String })
  bankName?: string;
}

const TransactionCounterpartySchema = SchemaFactory.createForClass(
  TransactionCounterparty,
);

@Schema({ _id: false })
export class SeerBitData {
  @Prop({ type: String })
  transactionRef?: string;

  @Prop({ type: String })
  orderId?: string;

  @Prop({ type: String })
  paymentMethod?: string;

  @Prop({ type: String })
  cardLast4?: string;

  @Prop({ type: String })
  bankName?: string;

  @Prop({ type: String })
  status?: string;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: Number })
  settlementAmount?: number;

  @Prop({ type: Number })
  fees?: number;
}

const SeerBitDataSchema = SchemaFactory.createForClass(SeerBitData);

@Schema({ timestamps: true, collection: 'transactions' })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'Wallet', required: true })
  walletId: Types.ObjectId;

  @Prop({ type: String, enum: ['CREDIT', 'DEBIT'], required: true })
  type: TransactionType;

  @Prop({ type: String, enum: TRANSACTION_CATEGORIES, required: true })
  category: TransactionCategory;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: Number, required: true })
  balanceBefore: number;

  @Prop({ type: Number, required: true })
  balanceAfter: number;

  @Prop({
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED'],
    default: 'PENDING',
  })
  status: TransactionStatus;

  @Prop({ type: String, required: true, unique: true })
  reference: string;

  @Prop({ type: String })
  externalReference?: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: String })
  narration?: string;

  @Prop({ type: TransactionCounterpartySchema })
  counterparty?: TransactionCounterparty;

  @Prop({ type: SeerBitDataSchema })
  seerBitData?: SeerBitData;

  @Prop({ type: String })
  failureReason?: string;

  @Prop({ type: String })
  reversalReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  processedBy?: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// reference uniqueness is declared inline on the @Prop above (idempotency backbone).
TransactionSchema.index({ walletId: 1, createdAt: -1 });
TransactionSchema.index({ category: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ externalReference: 1 }, { sparse: true });
