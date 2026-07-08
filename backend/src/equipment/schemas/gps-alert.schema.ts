import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GpsAlertDocument = GpsAlert &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
  };

export type GpsAlertType =
  'GEOFENCE_BREACH' | 'OVERSPEED' | 'SIGNAL_LOST' | 'IDLE_ANOMALY';

export const GPS_ALERT_TYPES: GpsAlertType[] = [
  'GEOFENCE_BREACH',
  'OVERSPEED',
  'SIGNAL_LOST',
  'IDLE_ANOMALY',
];

@Schema({ _id: false })
export class AlertPosition {
  @Prop({ type: Number, required: true })
  lat: number;

  @Prop({ type: Number, required: true })
  lng: number;
}
const AlertPositionSchema = SchemaFactory.createForClass(AlertPosition);

// Append-only (createdAt only; no updatedAt).
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'gpsAlerts',
})
export class GpsAlert {
  @Prop({ type: Types.ObjectId, ref: 'Equipment', required: true, index: true })
  equipmentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'EquipmentBooking', index: true })
  bookingId?: Types.ObjectId;

  @Prop({ type: String, enum: GPS_ALERT_TYPES, required: true, index: true })
  type: GpsAlertType;

  @Prop({ type: AlertPositionSchema })
  position?: AlertPosition;

  @Prop({ type: String, default: '' })
  detail: string;

  @Prop({ type: Types.ObjectId, ref: 'adminUsers' })
  acknowledgedBy?: Types.ObjectId;

  @Prop({ type: Date, index: true })
  acknowledgedAt?: Date;
}

export const GpsAlertSchema = SchemaFactory.createForClass(GpsAlert);
GpsAlertSchema.index({ createdAt: -1 });
