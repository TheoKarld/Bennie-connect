import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { EQUIPMENT_CATEGORIES, EquipmentCategory } from './equipment.schema';

export type EquipmentRateConfigDocument = EquipmentRateConfig &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true, collection: 'equipmentRateConfig' })
export class EquipmentRateConfig {
  @Prop({
    type: String,
    enum: EQUIPMENT_CATEGORIES,
    required: true,
    unique: true,
  })
  category: EquipmentCategory;

  @Prop({ type: Number, default: 0 })
  defaultHourlyRate: number;

  @Prop({ type: Number, default: 0 })
  defaultDailyRate: number;

  @Prop({ type: Number, default: 20 })
  depositPercent: number;

  @Prop({ type: Number, default: 0 })
  minDepositNgn: number;

  @Prop({ type: Number, default: 0 })
  overdueFeePerDay: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'adminUsers' })
  updatedBy?: Types.ObjectId;
}

export const EquipmentRateConfigSchema =
  SchemaFactory.createForClass(EquipmentRateConfig);
