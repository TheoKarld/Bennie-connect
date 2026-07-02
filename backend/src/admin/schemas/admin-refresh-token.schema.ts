import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdminRefreshTokenDocument = AdminRefreshToken & Document;

@Schema({ timestamps: true, collection: 'adminRefreshTokens' })
export class AdminRefreshToken {
  @Prop({
    type: Types.ObjectId,
    ref: 'adminUsers',
    required: true,
    index: true,
  })
  adminId: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  tokenHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: String })
  userAgent?: string;

  @Prop({ type: String })
  ipAddress?: string;

  @Prop({ type: Boolean, default: false })
  isRevoked: boolean;
}

export const AdminRefreshTokenSchema =
  SchemaFactory.createForClass(AdminRefreshToken);

// TTL index — Mongo removes documents once expiresAt passes.
AdminRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
