import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdminAuditLogDocument = AdminAuditLog & Document;

/**
 * Append-only audit trail. No update/delete paths are exposed for this
 * collection.
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'adminAuditLog',
})
export class AdminAuditLog {
  @Prop({ type: Types.ObjectId, ref: 'adminUsers', index: true })
  actorId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  actorEmail: string;

  @Prop({ type: String, required: true })
  action: string;

  @Prop({ type: String })
  permission?: string;

  @Prop({ type: String, required: true })
  resource: string;

  @Prop({ type: String })
  targetId?: string;

  @Prop({ type: Object })
  before?: Record<string, any>;

  @Prop({ type: Object })
  after?: Record<string, any>;

  @Prop({ type: String })
  ipAddress?: string;

  @Prop({ type: String })
  userAgent?: string;
}

export const AdminAuditLogSchema = SchemaFactory.createForClass(AdminAuditLog);

AdminAuditLogSchema.index({ resource: 1, targetId: 1 });
AdminAuditLogSchema.index({ action: 1 });
AdminAuditLogSchema.index({ createdAt: -1 });
