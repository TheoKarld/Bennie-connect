import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto } from './dto';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    try {
      // Check if user already exists
      const existingUser = await this.userModel.findOne({
        $or: [
          { email: createUserDto.email },
          { phoneNumber: createUserDto.phoneNumber },
        ],
      });

      if (existingUser) {
        throw new ConflictException(
          existingUser.email === createUserDto.email
            ? 'Email already registered'
            : 'Phone number already registered',
        );
      }

      // Hash password
      const saltRounds =
        this.configService.get<number>('configuration.bcrypt.saltRounds') || 10;
      const hashedPassword = await bcrypt.hash(
        createUserDto.password,
        saltRounds,
      );

      // Create user
      const createUser = {
        ...createUserDto,
        password: hashedPassword,
      };

      const createdUser = await this.userModel.create(createUser);

      // If referredBy is provided, update referrer's referrals
      if (createUserDto.referralCode) {
        const referrer = await this.userModel.findOne({
          referralCode: createUserDto.referralCode,
        });
        if (referrer) {
          createdUser.referredBy = referrer._id;
          if (!referrer.referrals) {
            referrer.referrals = [];
          }
          referrer.referrals.push(createdUser._id);
          await referrer.save();
        }
      }

      this.logger.log(`User created successfully with ID: ${createdUser._id}`);
      return createdUser;
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Error creating user:', error);
      throw new BadRequestException('Failed to create user');
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    filters?: any,
  ): Promise<{
    data: UserDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters?.role) {
      query.role = filters.role;
    }

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters?.search) {
      query.$or = [
        { firstName: { $regex: filters.search, $options: 'i' } },
        { lastName: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
        { userId: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.userModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.userModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email });
  }

  async findByUserId(userId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ userId });
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId });
  }

  /**
   * Create a user authenticated via Google. No password is set; the account is
   * marked as email-verified and active immediately.
   */
  async createGoogleUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    googleId: string;
    profileImageUrl?: string;
  }): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: data.email });
    if (existing) {
      // Link the Google identity to the pre-existing local account.
      existing.googleId = data.googleId;
      existing.authProvider = existing.authProvider || 'google';
      existing.isEmailVerified = true;
      if (data.profileImageUrl && !existing.profileImageUrl) {
        existing.profileImageUrl = data.profileImageUrl;
      }
      return existing.save();
    }

    const createdUser = await this.userModel.create({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      googleId: data.googleId,
      authProvider: 'google',
      isEmailVerified: true,
      isActive: true,
      profileImageUrl: data.profileImageUrl,
    });

    this.logger.log(
      `Google user created successfully with ID: ${createdUser._id}`,
    );
    return createdUser;
  }

  async update(
    id: string | Types.ObjectId,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    const user = await this.findOne(id);
    const updateData: any = { ...updateUserDto };

    // If password is being updated, hash it
    if (updateUserDto.password) {
      const saltRounds =
        this.configService.get<number>('configuration.bcrypt.saltRounds') || 10;
      updateData.password = await bcrypt.hash(
        updateUserDto.password,
        saltRounds,
      );
      updateData.passwordChangedAt = new Date();
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`User updated successfully with ID: ${updatedUser._id}`);
    return updatedUser;
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    await this.findOne(id);
    await this.userModel.findByIdAndDelete(id);
    this.logger.log(`User deleted successfully with ID: ${id}`);
  }

  async softDelete(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.findOne(id);
    user.isActive = false;
    return user.save();
  }

  async suspend(
    id: string | Types.ObjectId,
    reason: string,
  ): Promise<UserDocument> {
    const user = await this.findOne(id);
    user.isSuspended = true;
    user.suspensionReason = reason;
    user.suspendedAt = new Date();
    return user.save();
  }

  async unsuspend(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.findOne(id);
    user.isSuspended = false;
    user.suspensionReason = undefined;
    user.suspendedAt = undefined;
    return user.save();
  }

  async verifyEmail(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.findOne(id);
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    return user.save();
  }

  async updateLastLogin(
    id: string | Types.ObjectId,
    loginInfo: any,
  ): Promise<void> {
    const user = await this.userModel.findById(id);
    if (user) {
      user.lastLoginAt = new Date();

      if (!user.loginHistory) {
        user.loginHistory = [];
      }

      user.loginHistory.unshift({
        timestamp: new Date(),
        ...loginInfo,
      });

      // Keep only last 10 login records
      if (user.loginHistory.length > 10) {
        user.loginHistory = user.loginHistory.slice(0, 10);
      }

      await user.save();
    }
  }

  async incrementFailedLogin(
    id: string | Types.ObjectId,
  ): Promise<UserDocument> {
    const user = await this.findOne(id);
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

    // Lock account after 5 failed attempts
    if (user.failedLoginAttempts >= 5) {
      user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
    }

    return user.save();
  }

  async resetFailedLogin(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.findOne(id);
    user.failedLoginAttempts = 0;
    user.lockoutUntil = undefined;
    return user.save();
  }

  private hashResetToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generate a single-use password-reset token. Returns `null` when no account
   * matches the email (so callers can avoid account enumeration). On success,
   * only the SHA-256 hash of the raw token is persisted; the raw token is
   * returned to the caller for delivery via the reset link.
   */
  async generatePasswordResetToken(
    email: string,
  ): Promise<{ user: UserDocument; rawToken: string } | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const rawToken = randomBytes(32).toString('hex');
    user.resetPasswordToken = this.hashResetToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    return { user, rawToken };
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findOne({
      resetPasswordToken: this.hashResetToken(rawToken),
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const saltRounds =
      this.configService.get<number>('configuration.bcrypt.saltRounds') || 10;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockoutUntil = undefined;

    return user.save();
  }

  async changePassword(
    userId: string | Types.ObjectId,
    oldPassword: string,
    newPassword: string,
  ): Promise<UserDocument> {
    const user = await this.findOne(userId);

    if (!user.password) {
      throw new BadRequestException(
        'This account has no password set (Google sign-in). Use password reset instead.',
      );
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    const saltRounds =
      this.configService.get<number>('configuration.bcrypt.saltRounds') || 10;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.passwordChangedAt = new Date();
    return user.save();
  }

  /**
   * Live aggregates for the admin dashboard overview. Counts totals, active,
   * email-verified/unverified, new-signup windows (7d/30d), and a 14-day daily
   * signups trend from `createdAt`.
   */
  async getDashboardStats(): Promise<{
    total: number;
    active: number;
    verified: number;
    unverified: number;
    newLast7d: number;
    newLast30d: number;
    signupsTrend: { date: string; count: number }[];
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Start of the UTC day 13 days ago → 14-day inclusive window (ending today).
    // UTC is used throughout so the bucket boundaries match the `$dateToString`
    // labels below (which default to UTC), regardless of server timezone.
    const trendStart = new Date(now);
    trendStart.setUTCHours(0, 0, 0, 0);
    trendStart.setUTCDate(trendStart.getUTCDate() - 13);

    const [total, active, verified, newLast7d, newLast30d, trendRows] =
      await Promise.all([
        this.userModel.countDocuments(),
        this.userModel.countDocuments({ isActive: true }),
        this.userModel.countDocuments({ isEmailVerified: true }),
        this.userModel.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        this.userModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        this.userModel.aggregate<{ _id: string; count: number }>([
          { $match: { createdAt: { $gte: trendStart } } },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    // Back-fill every day in the window so the chart has no gaps.
    const counts = new Map(trendRows.map((r) => [r._id, r.count]));
    const signupsTrend: { date: string; count: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const day = new Date(trendStart);
      day.setUTCDate(trendStart.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      signupsTrend.push({ date: key, count: counts.get(key) ?? 0 });
    }

    return {
      total,
      active,
      verified,
      unverified: total - verified,
      newLast7d,
      newLast30d,
      signupsTrend,
    };
  }

  async getStatistics(): Promise<any> {
    const [totalUsers, activeUsers, verifiedUsers, farmers, agents, admins] =
      await Promise.all([
        this.userModel.countDocuments(),
        this.userModel.countDocuments({ isActive: true }),
        this.userModel.countDocuments({ isEmailVerified: true }),
        this.userModel.countDocuments({ role: 'farmer' }),
        this.userModel.countDocuments({ role: 'agent' }),
        this.userModel.countDocuments({
          role: { $in: ['admin', 'super_admin'] },
        }),
      ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      roleDistribution: {
        farmers,
        agents,
        admins,
      },
    };
  }
}
