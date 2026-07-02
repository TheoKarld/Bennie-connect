import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdminRoleDocument = AdminRole &
  Document & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true, collection: 'adminRoles' })
export class AdminRole {
  @Prop({ type: String, required: true, unique: true, trim: true })
  name: string;

  @Prop({ type: String, default: '' })
  description: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ type: Boolean, default: false })
  isSystem: boolean;

  @Prop({ type: Types.ObjectId, ref: 'adminUsers' })
  createdBy?: Types.ObjectId;
}

export const AdminRoleSchema = SchemaFactory.createForClass(AdminRole);
