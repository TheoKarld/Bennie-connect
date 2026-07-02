import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdminUserDocument = AdminUser &
  Document & {
    _id: Types.ObjectId;
    comparePassword(candidatePassword: string): Promise<boolean>;
    createdAt: Date;
    updatedAt: Date;
  };

class PermissionOverrides {
  @Prop({ type: [String], default: [] })
  granted: string[];

  @Prop({ type: [String], default: [] })
  revoked: string[];
}

class LoginHistoryEntry {
  @Prop({ type: Date })
  timestamp: Date;

  @Prop({ type: String })
  ipAddress: string;

  @Prop({ type: String })
  userAgent: string;

  @Prop({ type: Boolean })
  success: boolean;
}

@Schema({ timestamps: true, collection: 'adminUsers' })
export class AdminUser {
  @Prop({ type: String, required: true, unique: true })
  adminId: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ type: String, required: true, trim: true })
  firstName: string;

  @Prop({ type: String, required: true, trim: true })
  lastName: string;

  @Prop({ type: String, required: true })
  password: string;

  @Prop({ type: String, trim: true })
  phoneNumber?: string;

  @Prop({ type: Types.ObjectId, ref: 'adminRoles', required: true })
  roleId: Types.ObjectId;

  @Prop({
    type: PermissionOverrides,
    default: () => ({ granted: [], revoked: [] }),
  })
  permissionOverrides: PermissionOverrides;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isBanned: boolean;

  @Prop({ type: String })
  banReason?: string;

  @Prop({ type: Date })
  bannedAt?: Date;

  @Prop({ type: Boolean, default: false })
  isSuperAdmin: boolean;

  @Prop({ type: Boolean, default: true })
  mustChangePassword: boolean;

  @Prop({ type: Boolean, default: false })
  twoFactorEnabled: boolean;

  @Prop({ type: String })
  twoFactorSecret?: string;

  @Prop({ type: [String], default: [] })
  allowedIps: string[];

  @Prop({ type: Number, default: 0 })
  failedLoginAttempts: number;

  @Prop({ type: Date })
  lockoutUntil?: Date;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ type: [LoginHistoryEntry], default: [] })
  loginHistory: LoginHistoryEntry[];

  @Prop({ type: Date })
  passwordChangedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'adminUsers' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);

AdminUserSchema.index({ roleId: 1 });
AdminUserSchema.index({ isActive: 1 });

AdminUserSchema.pre('validate', function (next) {
  if (!this.adminId) {
    this.adminId = `ADM_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)
      .toUpperCase()}`;
  }
  next();
});

AdminUserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  const bcrypt = await import('bcrypt');
  return bcrypt.compare(candidatePassword, this.password);
};

AdminUserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactorSecret;
  return obj;
};
