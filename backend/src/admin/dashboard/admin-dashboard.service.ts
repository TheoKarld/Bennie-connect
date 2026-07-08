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
import {
  ContributionGroup,
  ContributionGroupDocument,
} from '../../contributions/schemas/contribution-group.schema';
import {
  PayoutRequest,
  PayoutRequestDocument,
} from '../../contributions/schemas/payout-request.schema';
import {
  GroupProposal,
  GroupProposalDocument,
} from '../../contributions/schemas/group-proposal.schema';

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
    @InjectModel(ContributionGroup.name)
    private readonly groupModel: Model<ContributionGroupDocument>,
    @InjectModel(PayoutRequest.name)
    private readonly payoutModel: Model<PayoutRequestDocument>,
    @InjectModel(GroupProposal.name)
    private readonly proposalModel: Model<GroupProposalDocument>,
  ) {}

  async getOverview() {
    const [userStats, adminBlock, recentActivity, adashe] = await Promise.all([
      this.usersService.getDashboardStats(),
      this.getAdminBlock(),
      this.getRecentActivity(),
      this.getAdasheBlock(),
    ]);

    const modules = PLACEHOLDER_MODULES.reduce<
      Record<string, { available: boolean }>
    >((acc, key) => {
      acc[key] = { available: false };
      return acc;
    }, {});
    // Adashe is live — flip its readiness flag on.
    modules.adashe = { available: true };

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
      adashe,
      recentActivity,
      modules,
      signupsTrend: userStats.signupsTrend,
    };
  }

  /**
   * Live Adashe (contribution circles) aggregates for the dashboard overview.
   * All read-only counts/sums — no permission trimming here because the
   * overview endpoint is gated as a whole by `dashboard:view`, matching how the
   * other live blocks (users, admins) are surfaced.
   */
  private async getAdasheBlock(): Promise<{
    available: true;
    activeGroups: number;
    totalGroups: number;
    poolBalance: number;
    payoutRequestsDue: number;
    slotShiftsAwaiting: number;
  }> {
    const [
      activeGroups,
      totalGroups,
      poolAgg,
      payoutRequestsDue,
      slotShiftsAwaiting,
    ] = await Promise.all([
      this.groupModel.countDocuments({ status: 'ACTIVE' }),
      this.groupModel.countDocuments({}),
      this.groupModel.aggregate<{ _id: null; total: number }>([
        { $group: { _id: null, total: { $sum: '$poolBalance' } } },
      ]),
      this.payoutModel.countDocuments({ status: 'REQUESTED' }),
      this.proposalModel.countDocuments({
        kind: 'SLOT_SHIFT',
        status: 'AWAITING_ADMIN',
      }),
    ]);

    return {
      available: true,
      activeGroups,
      totalGroups,
      poolBalance: poolAgg[0]?.total ?? 0,
      payoutRequestsDue,
      slotShiftsAwaiting,
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
