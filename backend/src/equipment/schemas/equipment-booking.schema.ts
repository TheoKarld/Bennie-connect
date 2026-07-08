import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { GeoPoint, GeoPointSchema } from './equipment.schema';

export type EquipmentBookingDocument = EquipmentBooking &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

export type BookingStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONFIRMED'
  | 'IN_USE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OVERDUE';

export type BookingPaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

export const BOOKING_STATUSES: BookingStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CONFIRMED',
  'IN_USE',
  'COMPLETED',
  'CANCELLED',
  'OVERDUE',
];

export const BOOKING_PAYMENT_STATUSES: BookingPaymentStatus[] = [
  'UNPAID',
  'PAID',
  'REFUNDED',
];

@Schema({ _id: false })
export class GpsFix {
  @Prop({ type: Number, required: true })
  lat: number;

  @Prop({ type: Number, required: true })
  lng: number;

  @Prop({ type: Number })
  heading?: number;

  @Prop({ type: Number })
  speed?: number;

  @Prop({ type: Date, required: true })
  at: Date;
}
const GpsFixSchema = SchemaFactory.createForClass(GpsFix);

@Schema({ _id: false })
export class DamageReport {
  @Prop({ type: String, default: '' })
  description: string;

  @Prop({ type: Number, default: 0 })
  costEstimate: number;

  @Prop({ type: Number, default: 0 })
  deductedFromDeposit: number;
}
const DamageReportSchema = SchemaFactory.createForClass(DamageReport);

@Schema({ timestamps: true, collection: 'equipmentBookings' })
export class EquipmentBooking {
  @Prop({ type: Types.ObjectId, ref: 'Equipment', required: true, index: true })
  equipmentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'users', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  bookingReference: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: Date })
  actualStartDate?: Date;

  @Prop({ type: Date })
  actualEndDate?: Date;

  @Prop({
    type: String,
    enum: BOOKING_STATUSES,
    default: 'PENDING',
    index: true,
  })
  status: BookingStatus;

  @Prop({
    type: String,
    enum: BOOKING_PAYMENT_STATUSES,
    default: 'UNPAID',
    index: true,
  })
  paymentStatus: BookingPaymentStatus;

  @Prop({ type: String, enum: ['HOURLY', 'DAILY'], default: 'DAILY' })
  rateType: 'HOURLY' | 'DAILY';

  // ── Costing ──
  @Prop({ type: Number, default: 0 })
  rentalCost: number;

  @Prop({ type: Number, default: 0 })
  depositAmount: number;

  @Prop({ type: Number, default: 0 })
  totalCost: number;

  @Prop({ type: Number, default: 0 })
  amountPaid: number;

  // ── Wallet linkage ──
  @Prop({ type: String })
  walletPaymentRef?: string;

  @Prop({ type: String })
  refundRef?: string;

  @Prop({ type: GeoPointSchema })
  pickupLocation?: GeoPoint;

  @Prop({ type: GeoPointSchema })
  returnLocation?: GeoPoint;

  // ── Operator (admin-entered this phase) ──
  @Prop({ type: Types.ObjectId, ref: 'users' })
  operatorId?: Types.ObjectId;

  @Prop({ type: String })
  operatorName?: string;

  @Prop({ type: String })
  operatorPhone?: string;

  @Prop({ type: String })
  operatorPlate?: string;

  @Prop({ type: String })
  trackingToken?: string;

  @Prop({ type: Date })
  trackingTokenIssuedAt?: Date;

  @Prop({ type: Date })
  trackingTokenExpiresAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'adminUsers' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'adminUsers' })
  rejectedBy?: Types.ObjectId;

  // ── Live GPS ──
  @Prop({ type: GpsFixSchema })
  currentPosition?: GpsFix;

  @Prop({ type: [GpsFixSchema], default: [] })
  gpsTracking: GpsFix[];

  // ── Return / settlement ──
  @Prop({ type: DamageReportSchema })
  damageReport?: DamageReport;

  @Prop({ type: Number, default: 0 })
  overdueCharges: number;

  @Prop({ type: Number, default: 0 })
  outstandingCharge: number;

  @Prop({ type: String })
  cancellationReason?: string;

  @Prop({ type: String })
  rejectionReason?: string;

  // ── Post-completion review ──
  @Prop({ type: Number, min: 1, max: 5 })
  rating?: number;

  @Prop({ type: String })
  ratingComment?: string;

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export const EquipmentBookingSchema =
  SchemaFactory.createForClass(EquipmentBooking);

// `bookingReference` uniqueness is declared inline on the @Prop above.
EquipmentBookingSchema.index(
  { trackingToken: 1 },
  { unique: true, sparse: true },
);
EquipmentBookingSchema.index({ equipmentId: 1, startDate: 1, endDate: 1 });
EquipmentBookingSchema.index({ userId: 1, createdAt: -1 });
