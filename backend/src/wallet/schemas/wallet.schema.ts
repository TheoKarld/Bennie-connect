import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WalletDocument = Wallet & Document;

export type WalletStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

@Schema({ _id: false })
export class WalletBalance {
  @Prop({ type: Number, default: 0 })
  available: number;

  @Prop({ type: Number, default: 0 })
  pending: number;

  @Prop({ type: Number, default: 0 })
  locked: number;
}

const WalletBalanceSchema = SchemaFactory.createForClass(WalletBalance);

@Schema({ timestamps: true, collection: 'wallets' })
export class Wallet {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  walletNumber: string;

  @Prop({
    type: WalletBalanceSchema,
    default: () => ({ available: 0, pending: 0, locked: 0 }),
  })
  balance: WalletBalance;

  @Prop({ type: String, default: 'NGN' })
  currency: string;

  @Prop({
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'CLOSED'],
    default: 'ACTIVE',
  })
  status: WalletStatus;

  @Prop({
    type: String,
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    default: 'PENDING',
  })
  kycStatus: KycStatus;

  @Prop({ type: Date })
  kycVerifiedAt?: Date;

  @Prop({ type: Number, default: 500000 })
  dailyTransactionLimit: number;

  @Prop({ type: Number, default: 5000000 })
  monthlyTransactionLimit: number;

  @Prop({ type: Number, default: 0 })
  totalDeposited: number;

  @Prop({ type: Number, default: 0 })
  totalWithdrawn: number;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

// userId + walletNumber uniqueness declared inline on the @Prop above.
WalletSchema.index({ status: 1 });
