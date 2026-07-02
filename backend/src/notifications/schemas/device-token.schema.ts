import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { NotificationRecipientType } from './notification.schema';

export type DeviceTokenDocument = DeviceToken &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true, collection: 'deviceTokens' })
export class DeviceToken {
  @Prop({ type: String, enum: ['user', 'admin'], required: true })
  recipientType: NotificationRecipientType;

  @Prop({ type: Types.ObjectId, required: true })
  recipientId: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  token: string;

  @Prop({ type: String })
  userAgent?: string;

  @Prop({ type: Date, default: () => new Date() })
  lastSeenAt: Date;
}

export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);

// token uniqueness is already declared via @Prop({ unique: true }); do not
// re-declare it here or Mongoose warns about a duplicate index.
DeviceTokenSchema.index({ recipientType: 1, recipientId: 1 });
