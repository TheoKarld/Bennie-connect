import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema({
  timestamps: true,
  collection: 'refreshtokens',
})
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

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

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// TTL index — Mongo removes documents once expiresAt passes.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// userId is already indexed via @Prop({ index: true }) above — do not re-declare
// it here or Mongoose warns about a duplicate index.
