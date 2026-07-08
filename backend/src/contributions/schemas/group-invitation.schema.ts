import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GroupInvitationDocument = GroupInvitation &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
export type InviterType = 'user' | 'admin';

@Schema({ timestamps: true, collection: 'groupInvitations' })
export class GroupInvitation {
  @Prop({ type: Types.ObjectId, ref: 'contributionGroups', required: true })
  groupId: Types.ObjectId;

  @Prop({ type: String, enum: ['user', 'admin'], required: true })
  inviterType: InviterType;

  /** users._id or adminUsers._id depending on inviterType */
  @Prop({ type: Types.ObjectId, required: true })
  inviterId: Types.ObjectId;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  inviteeEmail: string;

  @Prop({ type: Types.ObjectId, ref: 'users' })
  inviteeUserId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
    default: 'PENDING',
  })
  status: InvitationStatus;
}

export const GroupInvitationSchema =
  SchemaFactory.createForClass(GroupInvitation);

GroupInvitationSchema.index({ groupId: 1, inviteeEmail: 1 });
GroupInvitationSchema.index({ inviteeUserId: 1, status: 1 });
