import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../../users/users.service';
import { AdminUser, AdminUserDocument } from '../schemas/admin-user.schema';
import { AdminRole, AdminRoleDocument } from '../schemas/admin-role.schema';
import {
  AdminAuditLog,
  AdminAuditLogDocument,
} from '../schemas/admin-audit-log.schema';

/**
 * Domains whose collections are not yet live. The frontend renders "module not
 * yet live" placeholders for any block flagged `available: false`. As each
 * domain ships, flip its flag to `true` and add its aggregation here.
 */
const PLACEHOLDER_MODULES = [
  'wallet',
  'savings',
  'shares',
  'equipment',
  'services',
  'marketplace',
  'adashe',
  'agents',
] as const;

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly usersService: UsersService,
    @InjectModel(AdminUser.name)
    private readonly adminUserModel: Model<AdminUserDocument>,
    @InjectModel(AdminRole.name)
    private readonly adminRoleModel: Model<AdminRoleDocument>,
    @InjectModel(AdminAuditLog.name)
    private readonly auditModel: Model<AdminAuditLogDocument>,
  ) {}

  async getOverview() {
    const [userStats, adminBlock, recentActivity] = await Promise.all([
      this.usersService.getDashboardStats(),
      this.getAdminBlock(),
      this.getRecentActivity(),
    ]);

    const modules = PLACEHOLDER_MODULES.reduce<
      Record<string, { available: false }>
    >((acc, key) => {
      acc[key] = { available: false };
      return acc;
    }, {});

    return {
      users: {
        available: true,
        total: userStats.total,
        active: userStats.active,
        verified: userStats.verified,
        unverified: userStats.unverified,
        newLast7d: userStats.newLast7d,
        newLast30d: userStats.newLast30d,
      },
      admins: adminBlock,
      recentActivity,
      modules,
      signupsTrend: userStats.signupsTrend,
    };
  }

  private async getAdminBlock(): Promise<{
    total: number;
    roles: { role: string; count: number }[];
  }> {
    const [total, grouped, roles] = await Promise.all([
      this.adminUserModel.countDocuments({ isActive: true }),
      this.adminUserModel.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { isActive: true } },
        { $group: { _id: '$roleId', count: { $sum: 1 } } },
      ]),
      this.adminRoleModel.find().select('_id name').lean(),
    ]);

    const roleNameById = new Map(
      roles.map((r) => [String(r._id), r.name as string]),
    );
    const roleCounts = grouped.map((g) => ({
      role: roleNameById.get(String(g._id)) ?? 'Unknown',
      count: g.count,
    }));

    return { total, roles: roleCounts };
  }

  private async getRecentActivity(): Promise<
    {
      actor: string;
      action: string;
      resource: string;
      targetId?: string;
      createdAt: Date;
    }[]
  > {
    const entries = await this.auditModel
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('actorEmail action resource targetId createdAt')
      .lean();

    return entries.map((e) => ({
      actor: e.actorEmail,
      action: e.action,
      resource: e.resource,
      targetId: e.targetId,
      createdAt: (e as unknown as { createdAt: Date }).createdAt,
    }));
  }
}
