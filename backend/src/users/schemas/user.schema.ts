import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  collection: 'users',
})
export class User {
  @Prop({ type: String, required: true, unique: true })
  userId: string;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, required: true, trim: true })
  firstName: string;

  @Prop({ type: String, required: true, trim: true })
  lastName: string;

  @Prop({ type: String, required: true })
  password: string;

  @Prop({ type: String, trim: true })
  phoneNumber?: string;

  @Prop({ type: String, enum: ['farmer', 'agent', 'admin', 'super_admin'], default: 'farmer' })
  role: string;

  @Prop({ type: Boolean, default: false })
  isEmailVerified: boolean;

  @Prop({ type: Boolean, default: false })
  isPhoneVerified: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isSuspended: boolean;

  @Prop({ type: String })
  suspensionReason?: string;

  @Prop({ type: Date })
  suspendedAt?: Date;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ type: String })
  profileImageUrl?: string;

  @Prop({ type: String })
  address?: string;

  @Prop({ type: String })
  state?: string;

  @Prop({ type: String })
  lga?: string;

  @Prop({ type: String })
  farmName?: string;

  @Prop({ type: Number })
  farmSize?: number;

  @Prop({ type: String })
  farmSizeUnit?: string;

  @Prop({ type: [String] })
  cropsOfInterest?: string[];

  @Prop({ type: [String] })
  livestockOfInterest?: string[];

  @Prop({ type: Types.ObjectId, ref: 'Wallet' })
  wallet?: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Membership' })
  memberships?: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Shareholding' })
  shareholdings?: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'ContributionGroup' })
  contributionGroups?: Types.ObjectId[];

  @Prop({ type: String })
  referralCode?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  referredBy?: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'User' })
  referrals?: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'AgentCommission' })
  commissions?: Types.ObjectId[];

  @Prop({ type: Number, default: 0 })
  totalEarnings?: number;

  @Prop({ type: Number, default: 0 })
  loyaltyPoints?: number;

  @Prop({ type: [String], default: [] })
  permissions?: string[];

  @Prop({ type: [Object], default: [] })
  loginHistory?: Array<{
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
    location?: string;
    success: boolean;
  }>;

  @Prop({ type: Date })
  passwordChangedAt?: Date;

  @Prop({ type: String })
  resetPasswordToken?: string;

  @Prop({ type: Date })
  resetPasswordExpires?: Date;

  @Prop({ type: String })
  emailVerificationToken?: string;

  @Prop({ type: Date })
  emailVerificationExpires?: Date;

  @Prop({ type: Number, default: 0 })
  failedLoginAttempts?: number;

  @Prop({ type: Date })
  lockoutUntil?: Date;

  @Prop({ type: Boolean, default: false })
  twoFactorEnabled?: boolean;

  @Prop({ type: String })
  twoFactorSecret?: string;

  @Prop({ type: [String] })
  backupCodes?: string[];

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for performance
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ userId: 1 }, { unique: true });
UserSchema.index({ phoneNumber: 1 }, { sparse: true });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ wallet: 1 });
UserSchema.index({ referredBy: 1 });
UserSchema.index({ referralCode: 1 });

// Pre-save hook to generate userId
UserSchema.pre('save', function (next) {
  if (!this.userId) {
    this.userId = `USR_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
  
  // Generate referral code if not exists
  if (!this.referralCode) {
    this.referralCode = this.firstName.substring(0, 3).toUpperCase() + 
                        Math.random().toString(36).substr(2, 5).toUpperCase();
  }
  
  next();
});

// Method to check if password matches
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  const bcrypt = await import('bcrypt');
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to hide sensitive data
UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.twoFactorSecret;
  delete obj.backupCodes;
  return obj;
};
