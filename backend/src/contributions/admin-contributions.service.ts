import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { NotificationService } from '../notifications/notification.service';
import { UsersService } from '../users/users.service';
import { ContributionsService } from './contributions.service';
import {
  ContributionGroup,
  ContributionGroupDocument,
} from './schemas/contribution-group.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from './schemas/group-member.schema';
import {
  GroupInvitation,
  GroupInvitationDocument,
} from './schemas/group-invitation.schema';
import {
  GroupMessage,
  GroupMessageDocument,
} from './schemas/group-message.schema';
import {
  GroupProposal,
  GroupProposalDocument,
} from './schemas/group-proposal.schema';
import {
  PayoutRequest,
  PayoutRequestDocument,
} from './schemas/payout-request.schema';
import {
  AdminUser,
  AdminUserDocument,
} from '../admin/schemas/admin-user.schema';
import { ADS_ADM_ERRORS, ADS_EVENTS } from './contributions.constants';
import { AdminCreateGroupDto } from './dto/admin-create-group.dto';
import { AdminListGroupsDto } from './dto/admin-list-groups.dto';
import { UpdateRulesDto } from './dto/update-rules.dto';
import { serialize } from './contributions.serializer';

/**
 * Admin-plane operations over the Adashe collections. Pure domain logic — audit
 * writing and permission checks live in the controller/guards. Reuses
 * ContributionsService for shared logging/notification helpers.
 */
@Injectable()
export class AdminContributionsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ContributionGroup.name)
    private readonly groupModel: Model<ContributionGroupDocument>,
    @InjectModel(GroupMember.name)
    private readonly memberModel: Model<GroupMemberDocument>,
    @InjectModel(GroupInvitation.name)
    private readonly invitationModel: Model<GroupInvitationDocument>,
    @InjectModel(GroupMessage.name)
    private readonly messageModel: Model<GroupMessageDocument>,
    @InjectModel(GroupProposal.name)
    private readonly proposalModel: Model<GroupProposalDocument>,
    @InjectModel(PayoutRequest.name)
    private readonly payoutModel: Model<PayoutRequestDocument>,
    @InjectModel(AdminUser.name)
    private readonly adminUserModel: Model<AdminUserDocument>,
    private readonly usersService: UsersService,
    private readonly notifications: NotificationService,
    private readonly contributions: ContributionsService,
  ) {}

  private oid(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({
        success: false,
        error: ADS_ADM_ERRORS.INVALID_ID,
      });
    }
    return new Types.ObjectId(id);
  }

  private async findGroupOrThrow(
    groupId: string,
  ): Promise<ContributionGroupDocument> {
    const group = await this.groupModel.findById(this.oid(groupId));
    if (!group) {
      throw new NotFoundException({
        success: false,
        error: ADS_ADM_ERRORS.GROUP_NOT_FOUND,
      });
    }
    return group;
  }

  // ---------------------------------------------------------------------------
  // Reshaping helpers (admin-plane denormalization)
  // ---------------------------------------------------------------------------

  /** Bulk-resolve organizer display names across users + adminUsers. */
  private async resolveOrganizerNames(
    groups: { organizerType: string; organizerId?: Types.ObjectId }[],
  ): Promise<Map<string, string>> {
    const userIds: Types.ObjectId[] = [];
    const adminIds: Types.ObjectId[] = [];
    for (const g of groups) {
      if (!g.organizerId) {
        continue;
      }
      if (g.organizerType === 'admin') {
        adminIds.push(g.organizerId);
      } else {
        userIds.push(g.organizerId);
      }
    }
    const out = new Map<string, string>();
    const [userNames, admins] = await Promise.all([
      userIds.length
        ? this.usersService.resolveNames(userIds)
        : Promise.resolve(new Map<string, string>()),
      adminIds.length
        ? this.adminUserModel
            .find({ _id: { $in: adminIds } })
            .select('firstName lastName')
            .lean()
        : Promise.resolve([]),
    ]);
    for (const [k, v] of userNames) {
      out.set(k, v);
    }
    for (const a of admins) {
      const name = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || 'Admin';
      out.set(a._id.toString(), name);
    }
    return out;
  }

  /**
   * Derive per-cycle-and-lifetime contribution health for a member from its
   * embedded `contributions[]` and the group's current cycle.
   */
  private memberHealth(member: any, currentCycle: number) {
    const contributions: any[] = member.contributions || [];
    let paidCount = 0;
    let lateCount = 0;
    let missedCount = 0;
    let hasContributedThisCycle = false;
    for (const c of contributions) {
      if (c.status === 'PAID') {
        paidCount += 1;
        if (c.cycle === currentCycle) {
          hasContributedThisCycle = true;
        }
      } else if (c.status === 'LATE') {
        lateCount += 1;
        if (c.cycle === currentCycle) {
          hasContributedThisCycle = true;
        }
      } else if (c.status === 'MISSED') {
        missedCount += 1;
      }
    }
    return { paidCount, lateCount, missedCount, hasContributedThisCycle };
  }

  /** Shape a lean/doc PayoutRequest into the admin `AdminPayoutRequest` type. */
  private shapeAdminPayout(
    pr: any,
    groupNames: Map<string, string>,
    recipientNames: Map<string, string>,
  ): any {
    if (!pr) {
      return null;
    }
    const raw = typeof pr.toObject === 'function' ? pr.toObject() : pr;
    const groupId = raw.groupId?.toString();
    const recipientUserId = raw.recipientUserId?.toString();
    return {
      id: raw._id?.toString(),
      groupId,
      groupName: groupId ? groupNames.get(groupId) : undefined,
      cycle: raw.cycle,
      position: raw.position,
      recipientMemberId: raw.recipientMemberId?.toString(),
      recipientUserId,
      recipientName: recipientUserId
        ? recipientNames.get(recipientUserId)
        : undefined,
      poolAmount: raw.amount,
      status: raw.status,
      requestedAt: raw.requestedAt,
      markedSentAt: raw.markedSentAt,
      markedSentBy: raw.markedSentBy?.toString(),
      paymentReference: raw.paymentReference,
      confirmedAt: raw.confirmedAt,
      cancelReason: raw.cancelReason,
      note: raw.note,
    };
  }

  /** Shape a lean/doc GroupProposal into the admin `AdminProposal` type. */
  private shapeAdminProposal(
    p: any,
    groupNames: Map<string, string>,
    userNames: Map<string, string>,
    adminNames: Map<string, string>,
  ): any {
    const raw = typeof p.toObject === 'function' ? p.toObject() : p;
    const groupId = raw.groupId?.toString();
    const shift = raw.slotShift;
    const decidedBy = raw.adminDecision?.adminId?.toString();
    return {
      id: raw._id?.toString(),
      groupId,
      groupName: groupId ? groupNames.get(groupId) : undefined,
      kind: raw.kind,
      title: raw.title,
      text: raw.text,
      status: raw.status,
      requestedByName: userNames.get(raw.createdByUserId?.toString()),
      slotShift: shift
        ? {
            requesterMemberId: shift.requesterMemberId?.toString(),
            requesterPosition: shift.requesterPosition,
            targetMemberId: shift.targetMemberId?.toString(),
            targetPosition: shift.targetPosition,
          }
        : undefined,
      fromPosition: shift?.requesterPosition,
      toPosition: shift?.targetPosition,
      tally: {
        for: raw.tally?.yes ?? 0,
        against: raw.tally?.no ?? 0,
        eligible: raw.eligibleCount ?? 0,
      },
      votes: (raw.votes || []).map((v: any) => ({
        userId: v.userId?.toString(),
        vote: v.vote,
        at: v.at,
      })),
      decidedByName: decidedBy ? adminNames.get(decidedBy) : undefined,
      decisionReason: raw.adminDecision?.reason,
      decidedAt: raw.adminDecision?.at,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  // ===========================================================================
  // Groups
  // ===========================================================================

  async listGroups(dto: AdminListGroupsDto) {
    const page = Math.max(1, dto.page || 1);
    const limit = Math.min(100, Math.max(1, dto.limit || 20));
    const filter: Record<string, any> = {};
    if (dto.status) {
      filter.status = dto.status;
    }
    if (dto.type) {
      filter.type = dto.type;
    }
    if (dto.frequency) {
      filter.frequency = dto.frequency;
    }
    if (dto.q) {
      filter.name = { $regex: dto.q, $options: 'i' };
    }

    const [groups, total] = await Promise.all([
      this.groupModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.groupModel.countDocuments(filter),
    ]);

    const groupIds = groups.map((g) => g._id);

    // Bulk grouped queries — no N+1 per group.
    const [members, pendingPayoutsAgg, pendingShiftsAgg, organizerNames] =
      await Promise.all([
        this.memberModel
          .find({ groupId: { $in: groupIds }, status: { $ne: 'REMOVED' } })
          .select('groupId status contributions')
          .lean(),
        this.payoutModel.aggregate([
          {
            $match: {
              groupId: { $in: groupIds },
              status: { $in: ['REQUESTED', 'MARKED_SENT'] },
            },
          },
          { $group: { _id: '$groupId', count: { $sum: 1 } } },
        ]),
        this.proposalModel.aggregate([
          {
            $match: {
              groupId: { $in: groupIds },
              kind: 'SLOT_SHIFT',
              status: 'AWAITING_ADMIN',
            },
          },
          { $group: { _id: '$groupId', count: { $sum: 1 } } },
        ]),
        this.resolveOrganizerNames(groups),
      ]);

    // Fold member rows into per-group aggregates.
    const membersByGroup = new Map<string, any[]>();
    for (const m of members) {
      const key = m.groupId.toString();
      const arr = membersByGroup.get(key) || [];
      arr.push(m);
      membersByGroup.set(key, arr);
    }
    const pendingPayoutByGroup = new Map<string, number>(
      pendingPayoutsAgg.map((r: any) => [r._id.toString(), r.count]),
    );
    const pendingShiftByGroup = new Map<string, number>(
      pendingShiftsAgg.map((r: any) => [r._id.toString(), r.count]),
    );

    const items = groups.map((g) => {
      const gid = g._id.toString();
      const gMembers = membersByGroup.get(gid) || [];
      const activeMembers = gMembers.filter(
        (m) => m.status === 'ACTIVE' || m.status === 'RECEIVED_PAYOUT',
      ).length;
      const expectedPool =
        g.contributionAmount *
        gMembers.filter((m) => m.status === 'ACTIVE').length;
      const collected = gMembers.reduce((sum, m) => {
        const paid = (m.contributions || [])
          .filter((c: any) => c.cycle === g.currentCycle && c.status === 'PAID')
          .reduce((s: number, c: any) => s + (c.amount || 0), 0);
        return sum + paid;
      }, 0);
      const arrears = Math.max(0, expectedPool - collected);
      const paidPositions = (g.payoutOrder || []).filter(
        (p: any) => p.paid,
      ).length;
      return {
        id: gid,
        name: g.name,
        type: g.type,
        status: g.status,
        frequency: g.frequency,
        contributionAmount: g.contributionAmount,
        maxSlots: g.maxSlots,
        totalMembers: gMembers.length,
        activeMembers,
        currentCycle: g.currentCycle,
        poolBalance: g.poolBalance,
        organizerType: g.organizerType,
        organizerId: g.organizerId?.toString(),
        organizerName: g.organizerId
          ? organizerNames.get(g.organizerId.toString())
          : undefined,
        paidPositions,
        arrears,
        hasArrears: arrears > 0,
        pendingPayoutRequests: pendingPayoutByGroup.get(gid) || 0,
        pendingSlotShifts: pendingShiftByGroup.get(gid) || 0,
        createdAt: (g as any).createdAt,
      };
    });

    return { items, total, page, limit };
  }

  async getGroup(groupId: string) {
    const group = await this.findGroupOrThrow(groupId);
    const g = group.toObject();

    const [members, pendingPayouts, pendingShifts, organizerNames] =
      await Promise.all([
        this.memberModel
          .find({ groupId: group._id, status: { $ne: 'REMOVED' } })
          .lean(),
        this.payoutModel.countDocuments({
          groupId: group._id,
          status: { $in: ['REQUESTED', 'MARKED_SENT'] },
        }),
        this.proposalModel.countDocuments({
          groupId: group._id,
          kind: 'SLOT_SHIFT',
          status: 'AWAITING_ADMIN',
        }),
        this.resolveOrganizerNames([g as any]),
      ]);

    // Bulk-resolve member + payoutOrder names/emails in one shot.
    const profileIds: (Types.ObjectId | string)[] = [
      ...members.map((m) => m.userId),
      ...(g.payoutOrder || []).map((p: any) => p.userId),
    ];
    const profiles = await this.usersService.resolveProfiles(profileIds);
    const nameOf = (id?: Types.ObjectId | string): string =>
      (id ? profiles.get(id.toString())?.name : undefined) || 'Member';

    // Latest confirmed-received cycle per member (for payoutReceivedCycle).
    const memberViews = members
      .slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((m) => {
        const health = this.memberHealth(m, g.currentCycle);
        const profile = profiles.get(m.userId.toString());
        const arrears =
          m.status === 'ACTIVE' && !health.hasContributedThisCycle
            ? g.contributionAmount
            : 0;
        return {
          memberId: m._id.toString(),
          userId: m.userId.toString(),
          name: profile?.name || 'Member',
          email: profile?.email,
          position: m.position,
          status: m.status,
          totalContributed: m.totalContributed,
          paidCount: health.paidCount,
          lateCount: health.lateCount,
          missedCount: health.missedCount,
          arrears,
          hasContributedThisCycle: health.hasContributedThisCycle,
          payoutReceivedCycle:
            m.status === 'RECEIVED_PAYOUT'
              ? (g.payoutOrder || []).find(
                  (p: any) => p.userId?.toString() === m.userId.toString(),
                )?.position
              : undefined,
        };
      });

    const payoutOrder = (g.payoutOrder || [])
      .slice()
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
      .map((p: any) => ({
        position: p.position,
        memberId: p.memberId?.toString(),
        userId: p.userId?.toString(),
        name: nameOf(p.userId),
        paid: p.paid,
        paidAt: p.paidAt,
      }));

    // Cycle economics.
    const activeMembers = members.filter((m) => m.status === 'ACTIVE');
    const expectedPoolThisCycle = g.contributionAmount * activeMembers.length;
    const collectedThisCycle = members.reduce((sum, m) => {
      const paid = (m.contributions || [])
        .filter((c: any) => c.cycle === g.currentCycle && c.status === 'PAID')
        .reduce((s: number, c: any) => s + (c.amount || 0), 0);
      return sum + paid;
    }, 0);
    const arrears = Math.max(0, expectedPoolThisCycle - collectedThisCycle);

    // Next recipient = lowest unpaid ACTIVE payoutOrder position.
    const activeUserIds = new Set(
      activeMembers.map((m) => m.userId.toString()),
    );
    const nextSlot = (g.payoutOrder || [])
      .filter((p: any) => !p.paid && activeUserIds.has(p.userId?.toString()))
      .sort((a: any, b: any) => a.position - b.position)[0];

    return {
      id: group._id.toString(),
      name: g.name,
      description: g.description,
      type: g.type,
      status: g.status,
      frequency: g.frequency,
      contributionAmount: g.contributionAmount,
      maxSlots: g.maxSlots,
      currentCycle: g.currentCycle,
      activePosition: g.activePosition,
      poolBalance: g.poolBalance,
      rules: g.rules,
      organizerType: g.organizerType,
      organizerId: g.organizerId?.toString(),
      organizerName: g.organizerId
        ? organizerNames.get(g.organizerId.toString())
        : undefined,
      payoutOrder,
      members: memberViews,
      expectedPoolThisCycle,
      collectedThisCycle,
      arrears,
      nextRecipientName: nextSlot ? nameOf(nextSlot.userId) : undefined,
      nextRecipientPosition: nextSlot?.position,
      pendingPayoutRequests: pendingPayouts,
      pendingSlotShifts: pendingShifts,
      createdAt: (g as any).createdAt,
    };
  }

  /** Member roster only (GET /:id/members) as AdminGroupMember[]. */
  async listMembers(groupId: string) {
    const group = await this.findGroupOrThrow(groupId);
    const g = group.toObject();
    const members = await this.memberModel
      .find({ groupId: group._id, status: { $ne: 'REMOVED' } })
      .lean();
    const profiles = await this.usersService.resolveProfiles(
      members.map((m) => m.userId),
    );
    return members
      .slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((m) => {
        const health = this.memberHealth(m, g.currentCycle);
        const profile = profiles.get(m.userId.toString());
        const arrears =
          m.status === 'ACTIVE' && !health.hasContributedThisCycle
            ? g.contributionAmount
            : 0;
        return {
          memberId: m._id.toString(),
          userId: m.userId.toString(),
          name: profile?.name || 'Member',
          email: profile?.email,
          position: m.position,
          status: m.status,
          totalContributed: m.totalContributed,
          paidCount: health.paidCount,
          lateCount: health.lateCount,
          missedCount: health.missedCount,
          arrears,
          hasContributedThisCycle: health.hasContributedThisCycle,
          payoutReceivedCycle:
            m.status === 'RECEIVED_PAYOUT'
              ? (g.payoutOrder || []).find(
                  (p: any) => p.userId?.toString() === m.userId.toString(),
                )?.position
              : undefined,
        };
      });
  }

  /**
   * Cycle contribution audit (GET /:id/contributions) as `ContributionAudit`.
   * Defaults to the group's current cycle. Each ACTIVE/RECEIVED member yields a
   * row derived from its embedded contribution for that cycle.
   */
  async getContributionAudit(groupId: string, cycle?: number) {
    const group = await this.findGroupOrThrow(groupId);
    const g = group.toObject();
    const targetCycle = cycle && cycle > 0 ? cycle : g.currentCycle;
    const members = await this.memberModel
      .find({
        groupId: group._id,
        status: { $in: ['ACTIVE', 'RECEIVED_PAYOUT'] },
      })
      .lean();
    const profiles = await this.usersService.resolveProfiles(
      members.map((m) => m.userId),
    );

    let poolCollected = 0;
    const rows = members
      .slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((m) => {
        const contribution = (m.contributions || []).find(
          (c: any) => c.cycle === targetCycle,
        );
        const status = contribution?.status || 'PENDING';
        const amount =
          contribution?.amount ??
          (status === 'PAID' || status === 'LATE'
            ? g.contributionAmount
            : g.contributionAmount);
        if (status === 'PAID' || status === 'LATE') {
          poolCollected += contribution?.amount || 0;
        }
        return {
          memberId: m._id.toString(),
          userId: m.userId.toString(),
          name: profiles.get(m.userId.toString())?.name || 'Member',
          amount,
          dueDate: contribution?.dueDate,
          status,
          paidAt: contribution?.paidAt,
          lateFee:
            status === 'LATE'
              ? Math.round(
                  (g.contributionAmount * (g.rules?.lateFeePercent || 0)) / 100,
                )
              : undefined,
        };
      });
    const expectedPool =
      g.contributionAmount *
      members.filter((m) => m.status === 'ACTIVE').length;
    return {
      cycle: targetCycle,
      rows,
      poolCollected,
      expectedPool,
      arrears: Math.max(0, expectedPool - poolCollected),
    };
  }

  /** Admin creates a circle as a non-paying OVERSEER (organizerType='admin'). */
  async createGroup(adminId: string, dto: AdminCreateGroupDto) {
    const group = await this.groupModel.create({
      name: dto.name,
      description: dto.description || '',
      type: dto.type || 'ADASHE',
      organizerType: 'admin',
      organizerId: new Types.ObjectId(adminId),
      contributionAmount: dto.contributionAmount,
      frequency: dto.frequency || 'MONTHLY',
      maxSlots: dto.maxSlots,
      rules: dto.rules || {},
    });

    await this.contributions.logActivity({
      groupId: group._id,
      actorType: 'admin',
      actorId: adminId,
      actorName: 'Admin',
      action: 'group.created',
      meta: { name: group.name, organizerType: 'admin' },
    });

    // Optionally fan out immediate email-based invitations.
    if (dto.inviteEmails?.length) {
      for (const email of dto.inviteEmails) {
        await this.inviteByEmail(group._id.toString(), adminId, email).catch(
          () => undefined,
        );
      }
    }

    // Return the full admin detail shape (id, organizerName, members, ...) so
    // the frontend's post-create navigation has a valid `id`.
    return this.getGroup(group._id.toString());
  }

  /** Admin invites a registered user by email (invitee accepts to join). */
  async inviteByEmail(groupId: string, adminId: string, email: string) {
    const group = await this.findGroupOrThrow(groupId);
    const normalized = email.toLowerCase().trim();
    const target = await this.usersService.findByEmail(normalized);
    if (!target) {
      throw new NotFoundException({
        success: false,
        error: ADS_ADM_ERRORS.INVITE_TARGET_NOT_REGISTERED,
      });
    }

    const existing = await this.invitationModel.findOne({
      groupId: group._id,
      inviteeEmail: normalized,
      status: 'PENDING',
    });
    if (existing) {
      return existing.toObject();
    }

    const invitation = await this.invitationModel.create({
      groupId: group._id,
      inviterType: 'admin',
      inviterId: new Types.ObjectId(adminId),
      inviteeEmail: normalized,
      inviteeUserId: target._id,
      status: 'PENDING',
    });

    this.notifications
      .notify({
        recipientType: 'user',
        recipientId: target._id.toString(),
        event: ADS_EVENTS.GROUP_INVITE,
        type: 'info',
        title: 'Contribution group invitation',
        body: `You've been invited to join "${group.name}".`,
        data: {
          groupId: group._id.toString(),
          invitationId: invitation._id.toString(),
        },
      })
      .catch(() => undefined);

    await this.contributions.logActivity({
      groupId: group._id,
      actorType: 'admin',
      actorId: adminId,
      actorName: 'Admin',
      action: 'member.invited',
      meta: { email: normalized },
    });

    return invitation.toObject();
  }

  async suspendGroup(groupId: string, adminId: string, reason: string) {
    const group = await this.findGroupOrThrow(groupId);
    const before = { status: group.status };
    if (group.status === 'COMPLETED') {
      throw new ConflictException({
        success: false,
        error: ADS_ADM_ERRORS.INVALID_STATUS_TRANSITION,
      });
    }
    group.status = 'SUSPENDED';
    group.suspendReason = reason;
    await group.save();

    await this.contributions.logActivity({
      groupId: group._id,
      actorType: 'admin',
      actorId: adminId,
      actorName: 'Admin',
      action: 'group.suspended',
      meta: { reason },
    });
    await this.contributions.notifyGroup(group._id, {
      event: ADS_EVENTS.GROUP_SUSPENDED,
      type: 'warning',
      title: 'Group suspended',
      body: `"${group.name}" has been suspended by an admin.`,
    });

    return { before, after: { status: group.status }, group: serialize(group) };
  }

  async reinstateGroup(groupId: string, adminId: string) {
    const group = await this.findGroupOrThrow(groupId);
    const before = { status: group.status };
    if (group.status !== 'SUSPENDED') {
      throw new ConflictException({
        success: false,
        error: ADS_ADM_ERRORS.INVALID_STATUS_TRANSITION,
      });
    }
    // Return to ACTIVE if the rotation had started, else FORMING.
    const anyPaid = group.payoutOrder.some((p) => p.paid);
    const activeCount = await this.memberModel.countDocuments({
      groupId: group._id,
      status: { $in: ['ACTIVE', 'RECEIVED_PAYOUT'] },
    });
    group.status =
      anyPaid || activeCount >= group.maxSlots ? 'ACTIVE' : 'FORMING';
    group.suspendReason = undefined;
    await group.save();

    await this.contributions.logActivity({
      groupId: group._id,
      actorType: 'admin',
      actorId: adminId,
      actorName: 'Admin',
      action: 'group.reinstated',
      meta: { status: group.status },
    });
    await this.contributions.notifyGroup(group._id, {
      event: ADS_EVENTS.GROUP_REINSTATED,
      type: 'success',
      title: 'Group reinstated',
      body: `"${group.name}" has been reinstated.`,
    });

    return { before, after: { status: group.status }, group: serialize(group) };
  }

  async updateRules(groupId: string, adminId: string, dto: UpdateRulesDto) {
    const group = await this.findGroupOrThrow(groupId);
    const before = { ...group.rules };
    if (dto.lateFeePercent !== undefined) {
      group.rules.lateFeePercent = dto.lateFeePercent;
    }
    if (dto.missLimit !== undefined) {
      group.rules.missLimit = dto.missLimit;
    }
    if (dto.exitPenalty !== undefined) {
      group.rules.exitPenalty = dto.exitPenalty;
    }
    group.markModified('rules');
    await group.save();

    await this.contributions.logActivity({
      groupId: group._id,
      actorType: 'admin',
      actorId: adminId,
      actorName: 'Admin',
      action: 'rules.updated',
      meta: { before, after: { ...group.rules } },
    });
    await this.contributions.notifyGroup(group._id, {
      event: ADS_EVENTS.RULES_UPDATED,
      title: 'Group rules updated',
      body: `Rules for "${group.name}" were updated by an admin.`,
    });

    return {
      before,
      after: { ...group.rules },
      group: serialize(group),
      rules: { ...group.rules },
    };
  }

  // ===========================================================================
  // Payout requests (manual-payout work queue)
  // ===========================================================================

  /** Denormalize a set of payout-request docs with group + recipient names. */
  private async shapePayoutList(requests: any[]) {
    const groupIds = requests.map((r) => r.groupId);
    const recipientIds = requests.map((r) => r.recipientUserId);
    const [groups, recipientNames] = await Promise.all([
      groupIds.length
        ? this.groupModel
            .find({ _id: { $in: groupIds } })
            .select('name')
            .lean()
        : Promise.resolve([]),
      this.usersService.resolveNames(recipientIds),
    ]);
    const groupNames = new Map<string, string>(
      groups.map((g: any) => [g._id.toString(), g.name]),
    );
    return requests.map((r) =>
      this.shapeAdminPayout(r, groupNames, recipientNames),
    );
  }

  /** Cross-group queue of payout requests (default REQUESTED). */
  async listPayoutRequests(status = 'REQUESTED') {
    const filter: Record<string, any> = {};
    if (status && status !== 'ALL') {
      filter.status = status;
    }
    const requests = await this.payoutModel
      .find(filter)
      .sort({ requestedAt: 1 })
      .lean();
    return this.shapePayoutList(requests);
  }

  /** A single group's payout requests, all statuses (GET /:id/payout-requests). */
  async listGroupPayoutRequests(groupId: string) {
    const group = await this.findGroupOrThrow(groupId);
    const requests = await this.payoutModel
      .find({ groupId: group._id })
      .sort({ requestedAt: -1 })
      .lean();
    return this.shapePayoutList(requests);
  }

  /** Denormalize a single payout doc into `AdminPayoutRequest`. */
  private async shapeSinglePayout(pr: any) {
    const [list] = await this.shapePayoutList([pr]);
    return list;
  }

  /** Admin records that funds were wired off-platform: REQUESTED → MARKED_SENT. */
  async markPayoutSent(
    groupId: string,
    reqId: string,
    adminId: string,
    note?: string,
    paymentReference?: string,
  ) {
    const group = await this.findGroupOrThrow(groupId);
    if (group.status === 'SUSPENDED') {
      throw new ConflictException({
        success: false,
        error: ADS_ADM_ERRORS.INVALID_STATUS_TRANSITION,
      });
    }
    const request = await this.payoutModel.findOne({
      _id: this.oid(reqId),
      groupId: group._id,
    });
    if (!request) {
      throw new NotFoundException({
        success: false,
        error: ADS_ADM_ERRORS.PAYOUT_REQUEST_NOT_FOUND,
      });
    }
    const before = { status: request.status };
    if (request.status !== 'REQUESTED') {
      throw new ConflictException({
        success: false,
        error: ADS_ADM_ERRORS.PAYOUT_NOT_REQUESTED,
      });
    }

    request.status = 'MARKED_SENT';
    request.markedSentBy = new Types.ObjectId(adminId);
    request.markedSentAt = new Date();
    if (note) {
      request.note = note;
    }
    if (paymentReference) {
      request.paymentReference = paymentReference;
    }
    await request.save();

    this.notifications
      .notify({
        recipientType: 'user',
        recipientId: request.recipientUserId.toString(),
        event: ADS_EVENTS.PAYOUT_MARKED_SENT,
        type: 'success',
        title: 'Payout sent',
        body: `Your payout of ₦${request.amount.toLocaleString()} has been wired. Please confirm receipt.`,
        data: {
          groupId: group._id.toString(),
          payoutRequestId: request._id.toString(),
        },
      })
      .catch(() => undefined);

    await this.contributions.logActivity({
      groupId: group._id,
      actorType: 'admin',
      actorId: adminId,
      actorName: 'Admin',
      action: 'payout.marked_sent',
      meta: { payoutRequestId: request._id.toString(), note, paymentReference },
    });

    return {
      before,
      after: { status: request.status },
      request: await this.shapeSinglePayout(request),
    };
  }

  /** Admin cancels a payout request that hasn't been confirmed received. */
  async cancelPayout(
    groupId: string,
    reqId: string,
    adminId: string,
    reason: string,
  ) {
    const group = await this.findGroupOrThrow(groupId);
    const request = await this.payoutModel.findOne({
      _id: this.oid(reqId),
      groupId: group._id,
    });
    if (!request) {
      throw new NotFoundException({
        success: false,
        error: ADS_ADM_ERRORS.PAYOUT_REQUEST_NOT_FOUND,
      });
    }
    const before = { status: request.status };
    if (request.status === 'CONFIRMED_RECEIVED') {
      throw new ConflictException({
        success: false,
        error: ADS_ADM_ERRORS.INVALID_STATUS_TRANSITION,
      });
    }

    request.status = 'CANCELLED';
    request.cancelReason = reason;
    await request.save();

    this.notifications
      .notify({
        recipientType: 'user',
        recipientId: request.recipientUserId.toString(),
        event: ADS_EVENTS.PAYOUT_MARKED_SENT,
        type: 'warning',
        title: 'Payout request cancelled',
        body: `Your payout request in "${group.name}" was cancelled by an admin.`,
        data: {
          groupId: group._id.toString(),
          payoutRequestId: request._id.toString(),
        },
      })
      .catch(() => undefined);

    await this.contributions.logActivity({
      groupId: group._id,
      actorType: 'admin',
      actorId: adminId,
      actorName: 'Admin',
      action: 'payout.cancelled',
      meta: { payoutRequestId: request._id.toString(), reason },
    });

    return {
      before,
      after: { status: request.status },
      request: await this.shapeSinglePayout(request),
    };
  }

  // ===========================================================================
  // Chat (oversight)
  // ===========================================================================

  /**
   * Paginated group chat history for admin oversight. Unlike the user-facing
   * ContributionsService.listMessages, this performs NO membership check —
   * admins holding `adashe-groups:view` may read ANY group's thread. Returns
   * the same `{ items, total, page, limit }` shape (oldest-first within page).
   */
  async listMessages(groupId: string, page = 1, limit = 30) {
    const group = await this.findGroupOrThrow(groupId);
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    const filter = { groupId: group._id };
    const [items, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      this.messageModel.countDocuments(filter),
    ]);
    return {
      items: items.reverse().map((m) => serialize(m)),
      total,
      page: p,
      limit: l,
    };
  }

  // ===========================================================================
  // Proposals (slot-shift decisions)
  // ===========================================================================

  /** Denormalize proposal docs with group + creator + decider names. */
  private async shapeProposalList(proposals: any[]) {
    const groupIds = proposals.map((p) => p.groupId);
    const userIds = proposals.map((p) => p.createdByUserId);
    const adminIds = proposals
      .map((p) => p.adminDecision?.adminId)
      .filter(Boolean);
    const [groups, userNames, admins] = await Promise.all([
      groupIds.length
        ? this.groupModel
            .find({ _id: { $in: groupIds } })
            .select('name')
            .lean()
        : Promise.resolve([]),
      this.usersService.resolveNames(userIds),
      adminIds.length
        ? this.adminUserModel
            .find({ _id: { $in: adminIds } })
            .select('firstName lastName')
            .lean()
        : Promise.resolve([]),
    ]);
    const groupNames = new Map<string, string>(
      groups.map((g: any) => [g._id.toString(), g.name]),
    );
    const adminNames = new Map<string, string>(
      admins.map((a: any) => [
        a._id.toString(),
        `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || 'Admin',
      ]),
    );
    return proposals.map((p) =>
      this.shapeAdminProposal(p, groupNames, userNames, adminNames),
    );
  }

  async listProposals(groupId: string) {
    const group = await this.findGroupOrThrow(groupId);
    const proposals = await this.proposalModel
      .find({ groupId: group._id })
      .sort({ createdAt: -1 })
      .lean();
    return this.shapeProposalList(proposals);
  }

  /**
   * Cross-group decisions queue: SLOT_SHIFT proposals AWAITING_ADMIN across ALL
   * groups, newest-first, paginated. Group/participant names are bulk-resolved
   * by `shapeProposalList` (no N+1). Returns `{ items, total, page, limit }`.
   */
  async listAwaitingProposals({
    page,
    limit,
  }: {
    page?: number;
    limit?: number;
  }) {
    const p = Math.max(1, page || 1);
    const l = Math.min(100, Math.max(1, limit || 20));
    const filter = { kind: 'SLOT_SHIFT', status: 'AWAITING_ADMIN' };
    const [proposals, total] = await Promise.all([
      this.proposalModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      this.proposalModel.countDocuments(filter),
    ]);
    const items = await this.shapeProposalList(proposals);
    return { items, total, page: p, limit: l };
  }

  private async loadAwaitingSlotShift(
    groupId: string,
    pid: string,
  ): Promise<{
    group: ContributionGroupDocument;
    proposal: GroupProposalDocument;
  }> {
    const group = await this.findGroupOrThrow(groupId);
    const proposal = await this.proposalModel.findOne({
      _id: this.oid(pid),
      groupId: group._id,
    });
    if (!proposal) {
      throw new NotFoundException({
        success: false,
        error: ADS_ADM_ERRORS.PROPOSAL_NOT_FOUND,
      });
    }
    if (
      proposal.kind !== 'SLOT_SHIFT' ||
      proposal.status !== 'AWAITING_ADMIN'
    ) {
      throw new ConflictException({
        success: false,
        error: ADS_ADM_ERRORS.PROPOSAL_NOT_AWAITING_ADMIN,
      });
    }
    return { group, proposal };
  }

  /** Approve a slot-shift: atomically swap the two payoutOrder positions. */
  async approveProposal(
    groupId: string,
    pid: string,
    adminId: string,
    reason?: string,
  ) {
    const { group, proposal } = await this.loadAwaitingSlotShift(groupId, pid);
    const shift = proposal.slotShift!;
    const before = {
      requesterPosition: shift.requesterPosition,
      targetPosition: shift.targetPosition,
    };

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const g = await this.groupModel.findById(group._id).session(session);
        if (!g) {
          return;
        }
        const a = g.payoutOrder.find(
          (p) => p.position === shift.requesterPosition,
        );
        const b = g.payoutOrder.find(
          (p) => p.position === shift.targetPosition,
        );
        if (a && b) {
          const tmp = a.position;
          a.position = b.position;
          b.position = tmp;
          g.markModified('payoutOrder');
          // Re-point activePosition follows the same absolute position; the
          // occupant changed, so nothing to reassign on activePosition itself.
          await g.save({ session });

          // Mirror onto the groupMembers.position fields.
          await this.memberModel.updateOne(
            { _id: shift.requesterMemberId },
            { $set: { position: shift.targetPosition } },
            { session },
          );
          await this.memberModel.updateOne(
            { _id: shift.targetMemberId },
            { $set: { position: shift.requesterPosition } },
            { session },
          );
        }

        proposal.status = 'APPROVED';
        proposal.adminDecision = {
          adminId: new Types.ObjectId(adminId),
          decision: 'APPROVE',
          reason,
          at: new Date(),
        } as any;
        await proposal.save({ session });
      });
    } finally {
      await session.endSession();
    }

    await this.contributions.logActivity({
      groupId: group._id,
      actorType: 'admin',
      actorId: adminId,
      actorName: 'Admin',
      action: 'slot_shift.approved',
      meta: {
        proposalId: proposal._id.toString(),
        swapped: [shift.requesterPosition, shift.targetPosition],
      },
    });
    await this.contributions.notifyGroup(group._id, {
      event: ADS_EVENTS.PROPOSAL_DECIDED,
      type: 'success',
      title: 'Slot swap approved',
      body: `The slot swap in "${group.name}" was approved by an admin.`,
    });

    const [shaped] = await this.shapeProposalList([proposal.toObject()]);
    return {
      before,
      after: {
        requesterPosition: shift.targetPosition,
        targetPosition: shift.requesterPosition,
      },
      proposal: shaped,
    };
  }

  /** Reject a slot-shift: no rotation change. */
  async rejectProposal(
    groupId: string,
    pid: string,
    adminId: string,
    reason?: string,
  ) {
    const { group, proposal } = await this.loadAwaitingSlotShift(groupId, pid);
    const before = { status: proposal.status };
    proposal.status = 'DECLINED';
    proposal.adminDecision = {
      adminId: new Types.ObjectId(adminId),
      decision: 'REJECT',
      reason,
      at: new Date(),
    } as any;
    await proposal.save();

    await this.contributions.logActivity({
      groupId: group._id,
      actorType: 'admin',
      actorId: adminId,
      actorName: 'Admin',
      action: 'slot_shift.declined',
      meta: { proposalId: proposal._id.toString(), reason },
    });
    await this.contributions.notifyGroup(group._id, {
      event: ADS_EVENTS.PROPOSAL_DECIDED,
      type: 'info',
      title: 'Slot swap declined',
      body: `The slot swap in "${group.name}" was declined by an admin.`,
    });

    const [shaped] = await this.shapeProposalList([proposal.toObject()]);
    return {
      before,
      after: { status: proposal.status },
      proposal: shaped,
    };
  }
}
