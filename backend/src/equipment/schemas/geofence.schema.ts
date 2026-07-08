import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GeofenceDocument = Geofence &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

export type GeofenceType = 'CIRCLE' | 'POLYGON';
export type GeofenceScope = 'ALL' | 'EQUIPMENT' | 'CATEGORY';

@Schema({ _id: false })
export class LatLng {
  @Prop({ type: Number, required: true })
  lat: number;

  @Prop({ type: Number, required: true })
  lng: number;
}
const LatLngSchema = SchemaFactory.createForClass(LatLng);

@Schema({ timestamps: true, collection: 'geofences' })
export class Geofence {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: ['CIRCLE', 'POLYGON'], required: true })
  type: GeofenceType;

  @Prop({ type: LatLngSchema })
  center?: LatLng;

  @Prop({ type: Number })
  radiusMeters?: number;

  @Prop({ type: [LatLngSchema], default: [] })
  polygon: LatLng[];

  @Prop({
    type: String,
    enum: ['ALL', 'EQUIPMENT', 'CATEGORY'],
    default: 'ALL',
    index: true,
  })
  appliesTo: GeofenceScope;

  @Prop({ type: [Types.ObjectId], ref: 'Equipment', default: [] })
  equipmentIds: Types.ObjectId[];

  @Prop({ type: String })
  category?: string;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'adminUsers' })
  createdBy?: Types.ObjectId;
}

export const GeofenceSchema = SchemaFactory.createForClass(Geofence);
