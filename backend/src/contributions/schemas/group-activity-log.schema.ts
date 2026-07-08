import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GroupActivityLogDocument = GroupActivityLog &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
  };

export type ActorType = 'user' | 'admin' | 'system';

/**
 * Append-only per-group activity feed. Written on every non-chat activity via
 * ContributionsService.logActivity(). No update/delete paths exposed.
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'groupActivityLogs',
})
export class GroupActivityLog {
  @Prop({ type: Types.ObjectId, ref: 'contributionGroups', required: true })
  groupId: Types.ObjectId;

  @Prop({ type: String, enum: ['user', 'admin', 'system'], required: true })
  actorType: ActorType;

  /** users._id or adminUsers._id; absent for system actions */
  @Prop({ type: Types.ObjectId })
  actorId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  actorName: string;

  @Prop({ type: String, required: true })
  action: string;

  @Prop({ type: Object, default: {} })
  meta: Record<string, any>;
}

export const GroupActivityLogSchema =
  SchemaFactory.createForClass(GroupActivityLog);

GroupActivityLogSchema.index({ groupId: 1, createdAt: -1 });
