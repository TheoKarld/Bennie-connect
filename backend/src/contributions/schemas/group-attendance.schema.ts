import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GroupAttendanceDocument = GroupAttendance &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true, collection: 'groupAttendance' })
export class GroupAttendance {
  @Prop({ type: Types.ObjectId, ref: 'contributionGroups', required: true })
  groupId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  sessionDate: Date;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: [Types.ObjectId], ref: 'users', default: [] })
  presentUserIds: Types.ObjectId[];
}

export const GroupAttendanceSchema =
  SchemaFactory.createForClass(GroupAttendance);

GroupAttendanceSchema.index({ groupId: 1, createdAt: -1 });
