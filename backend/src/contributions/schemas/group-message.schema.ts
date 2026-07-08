import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GroupMessageDocument = GroupMessage &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

export type MessageSenderType = 'user' | 'admin' | 'system';

@Schema({ timestamps: true, collection: 'groupMessages' })
export class GroupMessage {
  @Prop({ type: Types.ObjectId, ref: 'contributionGroups', required: true })
  groupId: Types.ObjectId;

  @Prop({ type: String, enum: ['user', 'admin', 'system'], required: true })
  senderType: MessageSenderType;

  /** users._id or adminUsers._id; absent for system messages */
  @Prop({ type: Types.ObjectId })
  senderId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  senderName: string;

  @Prop({ type: String, required: true })
  message: string;
}

export const GroupMessageSchema = SchemaFactory.createForClass(GroupMessage);

GroupMessageSchema.index({ groupId: 1, createdAt: 1 });
