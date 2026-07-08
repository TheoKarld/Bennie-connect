import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { MERCHANT_ID_TYPES } from '../marketplace.constants';

export type MerchantDocument = Merchant & Document;

/**
 * Persisted KYC statuses. `NOT_STARTED` is virtual — reported by
 * `GET /merchant/me` when no merchants document exists yet.
 */
export const MERCHANT_KYC_STATUSES = [
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const;

/**
 * Seller identity + KYC (data_structure.md §11.5). One per users account.
 * KYC docs live in the PRIVATE bucket and are purged (GCS + files rows) on
 * the admin's final decision; the verified ID data lives on here.
 */
@Schema({ timestamps: true, collection: 'merchants' })
export class Merchant {
  /** Unique business id, "MCH_<ts>_<rand>". */
  @Prop({ type: String, required: true, unique: true })
  merchantId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: String, default: '' })
  businessName: string;

  @Prop({ type: String })
  businessDescription?: string;

  @Prop({
    type: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      lga: { type: String, default: '' },
    },
    _id: false,
    default: () => ({ street: '', city: '', state: '', lga: '' }),
  })
  businessAddress: {
    street: string;
    city: string;
    state: string;
    lga?: string;
  };

  @Prop({ type: String, default: '' })
  businessPhone: string;

  @Prop({ type: String })
  businessEmail?: string;

  @Prop({ type: Boolean, default: false })
  isRegisteredBusiness: boolean;

  @Prop({ type: String })
  cacRcNumber?: string;

  @Prop({ type: String, enum: MERCHANT_ID_TYPES })
  idType?: (typeof MERCHANT_ID_TYPES)[number];

  /** The verified ID data that persists after doc purge. */
  @Prop({ type: String })
  idNumber?: string;

  /**
   * ADVISORY Prembly snapshot — the admin makes the final decision.
   * { checked, status: VERIFIED|NOT_VERIFIED|ERROR|SKIPPED, verified?,
   *   endpoint?, checkedAt?, matchedName?, raw? (trimmed, no images) }
   */
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  premblyResult?: Record<string, any> | null;

  /** Same advisory shape for the optional CAC check. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  cacResult?: Record<string, any> | null;

  /**
   * PRIVATE-bucket uploads: embedded FileMetadata JSON + a `label`
   * (ID_FRONT | ID_BACK | SELFIE_WITH_ID). EMPTIED on the final decision.
   */
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  kycDocs: Record<string, any>[];

  @Prop({ type: Date, default: null })
  kycDocsPurgedAt?: Date | null;

  @Prop({ type: String, enum: MERCHANT_KYC_STATUSES, default: 'IN_PROGRESS' })
  kycStatus: (typeof MERCHANT_KYC_STATUSES)[number];

  @Prop({ type: Date, default: null })
  submittedAt?: Date | null;

  @Prop({ type: Types.ObjectId, default: null })
  reviewedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date | null;

  @Prop({ type: String, default: null })
  rejectionReason?: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  suspendedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  suspendedAt?: Date | null;

  @Prop({ type: String, default: null })
  suspensionReason?: string | null;

  @Prop({ type: Number, default: 0 })
  resubmissionCount: number;

  @Prop({
    type: {
      bankName: { type: String },
      accountNumber: { type: String },
      accountName: { type: String },
    },
    _id: false,
    default: null,
  })
  payoutBankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;

  /**
   * Denormalized mirrors — merchantEarnings is the source of truth.
   * `availableBalance` may go negative via refund clawbacks; `pendingPayout`
   * is the amount held by open (REQUESTED/MARKED_SENT) payout requests.
   */
  @Prop({
    type: {
      availableBalance: { type: Number, default: 0 },
      lifetimeEarned: { type: Number, default: 0 },
      lifetimePaidOut: { type: Number, default: 0 },
      pendingPayout: { type: Number, default: 0 },
    },
    _id: false,
    default: () => ({
      availableBalance: 0,
      lifetimeEarned: 0,
      lifetimePaidOut: 0,
      pendingPayout: 0,
    }),
  })
  earnings: {
    availableBalance: number;
    lifetimeEarned: number;
    lifetimePaidOut: number;
    pendingPayout: number;
  };
}

export const MerchantSchema = SchemaFactory.createForClass(Merchant);

MerchantSchema.index({ kycStatus: 1, submittedAt: 1 });
MerchantSchema.index({ businessName: 1 });
