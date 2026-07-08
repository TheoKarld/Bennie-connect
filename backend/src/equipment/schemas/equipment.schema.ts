import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EquipmentDocument = Equipment &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

export type EquipmentCategory =
  'TRACTOR' | 'HARVESTER' | 'PLANTER' | 'SPRAYER' | 'IRRIGATION' | 'OTHER';

export type EquipmentStatus =
  'AVAILABLE' | 'BOOKED' | 'MAINTENANCE' | 'RETIRED';

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  'TRACTOR',
  'HARVESTER',
  'PLANTER',
  'SPRAYER',
  'IRRIGATION',
  'OTHER',
];

export const EQUIPMENT_STATUSES: EquipmentStatus[] = [
  'AVAILABLE',
  'BOOKED',
  'MAINTENANCE',
  'RETIRED',
];

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ type: Number, required: true })
  lat: number;

  @Prop({ type: Number, required: true })
  lng: number;

  @Prop({ type: String, default: '' })
  address: string;
}
export const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

@Schema({ _id: false })
export class GpsTracker {
  @Prop({ type: String, default: '' })
  deviceId: string;

  @Prop({ type: Boolean, default: false })
  isActive: boolean;

  @Prop({ type: Date })
  lastUpdateAt?: Date;
}
const GpsTrackerSchema = SchemaFactory.createForClass(GpsTracker);

@Schema({ _id: false })
export class MaintenanceEntry {
  @Prop({ type: String, required: true })
  type: string;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: String, default: '' })
  notes: string;
}
const MaintenanceEntrySchema = SchemaFactory.createForClass(MaintenanceEntry);

@Schema({ timestamps: true, collection: 'equipment' })
export class Equipment {
  @Prop({ type: Types.ObjectId, ref: 'Cooperative' })
  cooperativeId?: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: EQUIPMENT_CATEGORIES, required: true })
  category: EquipmentCategory;

  @Prop({ type: String, default: '' })
  model: string;

  @Prop({ type: String, default: '' })
  serialNumber: string;

  @Prop({ type: Number })
  yearOfManufacture?: number;

  @Prop({
    type: String,
    enum: EQUIPMENT_STATUSES,
    default: 'AVAILABLE',
    index: true,
  })
  status: EquipmentStatus;

  @Prop({ type: Number, default: 0 })
  hourlyRate: number;

  @Prop({ type: Number, default: 0 })
  dailyRate: number;

  @Prop({ type: Number, default: 0 })
  depositRequired: number;

  @Prop({ type: GeoPointSchema })
  location?: GeoPoint;

  @Prop({ type: GpsTrackerSchema, default: () => ({ isActive: false }) })
  gpsTracker: GpsTracker;

  @Prop({ type: Object, default: {} })
  specifications: Record<string, any>;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: [MaintenanceEntrySchema], default: [] })
  maintenanceSchedule: MaintenanceEntry[];

  @Prop({ type: Number, default: 0 })
  bookingHistory: number;

  // Aggregate rating derived from completed-booking reviews.
  @Prop({ type: Number, default: 0 })
  ratingAverage: number;

  @Prop({ type: Number, default: 0 })
  ratingCount: number;
}

export const EquipmentSchema = SchemaFactory.createForClass(Equipment);

EquipmentSchema.index({ category: 1 });
EquipmentSchema.index({ cooperativeId: 1 });
EquipmentSchema.index({ 'gpsTracker.isActive': 1 });
EquipmentSchema.index({ name: 'text', model: 'text' });
EquipmentSchema.index({ createdAt: -1 });
