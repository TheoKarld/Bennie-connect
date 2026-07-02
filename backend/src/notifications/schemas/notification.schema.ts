import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

export type NotificationRecipientType = 'user' | 'admin';
export type NotificationType = 'info' | 'success' | 'warning' | 'alert';
export type NotificationPriority = 'low' | 'normal' | 'high';

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: String, enum: ['user', 'admin'], required: true })
  recipientType: NotificationRecipientType;

  @Prop({ type: Types.ObjectId, required: true })
  recipientId: Types.ObjectId;

  @Prop({ type: String, required: true })
  event: string;

  @Prop({
    type: String,
    enum: ['info', 'success', 'warning', 'alert'],
    default: 'info',
  })
  type: NotificationType;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: Object, default: {} })
  data: Record<string, any>;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Date })
  readAt?: Date;

  @Prop({
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal',
  })
  priority: NotificationPriority;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({
  recipientType: 1,
  recipientId: 1,
  isRead: 1,
  createdAt: -1,
});
