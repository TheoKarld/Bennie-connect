import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BankAccountDocument = BankAccount & Document;

export type VerificationMethod = 'NAME_ENQUIRY' | 'PENNY_DROP';

@Schema({ timestamps: true, collection: 'bankAccounts' })
export class BankAccount {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  accountNumber: string;

  @Prop({ type: String, required: true })
  accountName: string;

  @Prop({ type: String, required: true })
  bankName: string;

  @Prop({ type: String, required: true })
  bankCode: string;

  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  @Prop({ type: Boolean, default: false })
  isVerified: boolean;

  @Prop({ type: String, enum: ['NAME_ENQUIRY', 'PENNY_DROP'] })
  verificationMethod?: VerificationMethod;

  @Prop({ type: Date })
  verifiedAt?: Date;
}

export const BankAccountSchema = SchemaFactory.createForClass(BankAccount);

// No duplicate saved accounts per user.
BankAccountSchema.index(
  { userId: 1, accountNumber: 1, bankCode: 1 },
  { unique: true },
);
