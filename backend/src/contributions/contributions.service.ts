import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { NotificationService } from '../notifications/notification.service';
import { UsersService } from '../users/users.service';
import { ContributionsGateway } from './contributions.gateway';
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
  GroupAttendance,
  GroupAttendanceDocument,
} from './schemas/group-attendance.schema';
import {
  PayoutRequest,
  PayoutRequestDocument,
} from './schemas/payout-request.schema';
import {
  GroupActivityLog,
  GroupActivityLogDocument,
} from './schemas/group-activity-log.schema';
import { ADS_ERRORS, ADS_EVENTS } from './contributions.constants';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { serialize } from './contributions.serializer';

type ActorType = 'user' | 'admin' | 'system';

interface LogActivityInput {
  groupId: Types.ObjectId | string;
  actorType: ActorType;
  actorId?: Types.ObjectId | string;
  actorName: string;
  action: string;
  meta?: Record<string, any>;
}

@Injectable()
export class ContributionsService {
  private readonly logger = new Logger(ContributionsService.name);

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
    @InjectModel(GroupAttendance.name)
    private readonly attendanceModel: Model<GroupAttendanceDocument>,
    @InjectModel(PayoutRequest.name)
    private readonly payoutModel: Model<PayoutRequestDocument>,
    @InjectModel(GroupActivityLog.name)
    private readonly activityModel: Model<GroupActivityLogDocument>,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notifications: NotificationService,
    @Inject(forwardRef(() => ContributionsGateway))
    private readonly gateway: ContributionsGateway,
  ) {}

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private oid(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        success: false,
        error: ADS_ERRORS.INVALID_ID,
      });
    }
    return new Types.ObjectId(id);
  }

  private async userName(userId: Types.ObjectId | string): Promise<string> {
    const names = await this.usersService.resolveNames([userId]);
    return names.get(userId.toString()) || 'Member';
  }

  /**
   * Bulk-resolve a set of user ids to "First Last" names in one query.
   * Returns a Map keyed by stringified id; unresolved ids fall back to 'Member'
   * at read time via `nameOf`.
   */
  private async resolveNames(
    ids: (Types.ObjectId | string | undefined | null)[],
  ): Promise<Map<string, string>> {
    return this.usersService.resolveNames(
      ids.filter((id): id is Types.ObjectId | string => id != null),
    );
  }

  private nameOf(
    names: Map<string, string>,
    id?: Types.ObjectId | string | null,
  ): string {
    if (!id) {
      return 'Member';
    }
    return names.get(id.toString()) || 'Member';
  }

  /** Shape a PayoutRequest lean/doc into the frontend `PayoutRequest` type. */
  private shapePayoutRequest(pr: any): any {
    if (!pr) {
      return null;
    }
    const raw = typeof pr.toObject === 'function' ? pr.toObject() : pr;
    return {
      id: raw._id?.toString(),
      groupId: raw.groupId?.toString(),
      cycle: raw.cycle,
      position: raw.position,
      recipientMemberId: raw.recipientMemberId?.toString(),
      recipientUserId: raw.recipientUserId?.toString(),
      amount: raw.amount,
      status: raw.status,
      requestedAt: raw.requestedAt,
      markedSentAt: raw.markedSentAt,
      confirmedAt: raw.confirmedAt,
      note: raw.note,
    };
  }

  /** Append-only per-group activity log + live socket push. */
  async logActivity(input: LogActivityInput): Promise<void> {
    try {
      const doc = await this.activityModel.create({
        groupId: new Types.ObjectId(input.groupId),
        actorType: input.actorType,
        actorId: input.actorId ? new Types.ObjectId(input.actorId) : undefined,
        actorName: input.actorName,
        action: input.action,
        meta: input.meta || {},
      });
      this.gateway.emitGroupActivity(input.groupId.toString(), doc.toObject());
    } catch (error: any) {
      this.logger.warn(
        `logActivity(${input.action}) failed: ${error?.message}`,
      );
    }
  }

  /** Fan out an in-app + push notification to every ACTIVE member's user id. */
  async notifyGroup(
    groupId: Types.ObjectId | string,
    payload: {
      event: string;
      title: string;
      body: string;
      type?: 'info' | 'success' | 'warning' | 'alert';
      data?: Record<string, any>;
      exceptUserId?: string;
    },
  ): Promise<void> {
    const members = await this.memberModel
      .find({ groupId: new Types.ObjectId(groupId), status: 'ACTIVE' })
      .select('userId')
      .lean();
    for (const m of members) {
      const uid = m.userId.toString();
      if (payload.exceptUserId && uid === payload.exceptUserId) {
        continue;
      }
      this.notifications
        .notify({
          recipientType: 'user',
          recipientId: uid,
          event: payload.event,
          type: payload.type || 'info',
          title: payload.title,
          body: payload.body,
          data: { groupId: groupId.toString(), ...(payload.data || {}) },
        })
        .catch(() => undefined);
    }
  }

  private async findGroupOrThrow(
    groupId: string,
  ): Promise<ContributionGroupDocument> {
    const group = await this.groupModel.findById(this.oid(groupId));
    if (!group) {
      throw new NotFoundException({
        success: false,
        error: ADS_ERRORS.GROUP_NOT_FOUND,
      });
    }
    return group;
  }

  /** Returns the caller's membership doc, or throws NOT_A_MEMBER (unless admin). */
  private async requireMembership(
    groupId: string,
    userId: string,
  ): Promise<GroupMemberDocument> {
    const member = await this.memberModel.findOne({
      groupId: this.oid(groupId),
      userId: new Types.ObjectId(userId),
    });
    if (!member || ['REMOVED', 'EXITED'].includes(member.status)) {
      throw new ForbiddenException({
        success: false,
        error: ADS_ERRORS.NOT_A_MEMBER,
      });
    }
    return member;
  }

  async isActiveMember(groupId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(groupId) || !Types.ObjectId.isValid(userId)) {
      return false;
    }
    const member = await this.memberModel
      .findOne({
        groupId: new Types.ObjectId(groupId),
        userId: new Types.ObjectId(userId),
        status: { $in: ['ACTIVE', 'RECEIVED_PAYOUT'] },
      })
      .select('_id')
      .lean();
    return !!member;
  }

  private async activeMemberCount(
    groupId: Types.ObjectId,
    session?: any,
  ): Promise<number> {
    return this.memberModel
      .countDocuments({ groupId, status: 'ACTIVE' })
      .session(session || null);
  }

  // ===========================================================================
  // Groups
  // ===========================================================================

  async createGroup(userId: string, dto: CreateGroupDto) {
    const group = await this.groupModel.create({
      name: dto.name,
      description: dto.description || '',
      type: dto.type || 'ADASHE',
      organizerType: 'user',
      organizerId: new Types.ObjectId(userId),
      contributionAmount: dto.contributionAmount,
      frequency: dto.frequency || 'MONTHLY',
      maxSlots: dto.maxSlots,
      rules: dto.rules || {},
    });

    // Organizer becomes the first ACTIVE member at position 1.
    const member = await this.memberModel.create({
      groupId: group._id,
      userId: new Types.ObjectId(userId),
      position: 1,
      status: 'ACTIVE',
    });
    group.payoutOrder = [
      {
        position: 1,
        memberId: member._id,
        userId: new Types.ObjectId(userId),
        paid: false,
      } as any,
    ];
    await group.save();

    const name = await this.userName(userId);
    await this.logActivity({
      groupId: group._id,
      actorType: 'user',
      actorId: userId,
      actorName: name,
      action: 'group.created',
      meta: { name: group.name },
    });

    return serialize(group);
  }

  async listMyGroups(userId: string): Promise<any[]> {
    const uid = new Types.ObjectId(userId);
    const memberships = await this.memberModel
      .find({
        userId: uid,
        status: { $ne: 'REMOVED' },
      })
      .lean();
    const groupIds = memberships.map((m) => m.groupId);
    const groups = await this.groupModel
      .find({ _id: { $in: groupIds } })
      .sort({ createdAt: -1 })
      .lean();
    const membershipByGroup = new Map(
      memberships.map((m) => [m.groupId.toString(), m]),
    );

    // Pending action counts, per group, in bulk (no N+1).
    const [pendingProposals, pendingPayouts] = await Promise.all([
      // Proposals still open for my vote (ACTIVE and I haven't voted).
      this.proposalModel
        .find({ groupId: { $in: groupIds }, status: 'ACTIVE' })
        .select('groupId votes')
        .lean(),
      // A payout of mine awaiting my own confirm (MARKED_SENT).
      this.payoutModel
        .find({
          groupId: { $in: groupIds },
          recipientUserId: uid,
          status: { $in: ['REQUESTED', 'MARKED_SENT'] },
        })
        .lean(),
    ]);

    const awaitingMyVote = new Map<string, number>();
    for (const p of pendingProposals) {
      const iVoted = (p.votes || []).some(
        (v: any) => v.userId?.toString() === userId,
      );
      if (!iVoted) {
        const key = p.groupId.toString();
        awaitingMyVote.set(key, (awaitingMyVote.get(key) || 0) + 1);
      }
    }
    const myPayoutByGroup = new Map<string, any>();
    for (const pr of pendingPayouts) {
      // Keep the most recent per group.
      myPayoutByGroup.set(pr.groupId.toString(), pr);
    }

    return groups.map((g) => {
      const gid = g._id.toString();
      const m = membershipByGroup.get(gid);
      const myPosition = m?.position;
      const isMyTurn = myPosition === g.activePosition && g.status === 'ACTIVE';
      const hasContributedThisCycle = !!(m?.contributions || []).some(
        (c: any) => c.cycle === g.currentCycle && c.status === 'PAID',
      );
      const myPayout = myPayoutByGroup.get(gid);
      const awaitingConfirm = myPayout?.status === 'MARKED_SENT' ? 1 : 0;
      const pendingActionCount =
        (awaitingMyVote.get(gid) || 0) + awaitingConfirm;
      return {
        id: gid,
        name: g.name,
        type: g.type,
        status: g.status,
        frequency: g.frequency,
        contributionAmount: g.contributionAmount,
        maxSlots: g.maxSlots,
        currentCycle: g.currentCycle,
        poolBalance: g.poolBalance,
        myPosition,
        myStatus: m?.status,
        isMyTurn,
        hasContributedThisCycle,
        pendingActionCount,
        pendingPayoutRequest: this.shapePayoutRequest(myPayout),
      };
    });
  }

  async getGroup(groupId: string, userId: string) {
    const group = await this.findGroupOrThrow(groupId);
    const me = await this.requireMembership(groupId, userId);
    const g = group.toObject();

    const members = await this.memberModel
      .find({ groupId: group._id, status: { $ne: 'REMOVED' } })
      .lean();

    // Bulk-resolve every referenced user name (members + payoutOrder).
    const userIds: (Types.ObjectId | string)[] = [
      ...members.map((m) => m.userId),
      ...(g.payoutOrder || []).map((p: any) => p.userId),
    ];
    const names = await this.resolveNames(userIds);

    const hasPaidThisCycle = (m: any): boolean =>
      (m.contributions || []).some(
        (c: any) => c.cycle === g.currentCycle && c.status === 'PAID',
      );

    // members[] denormalized + sorted by position.
    const memberViews = members
      .slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((m) => ({
        memberId: m._id.toString(),
        userId: m.userId.toString(),
        name: this.nameOf(names, m.userId),
        position: m.position,
        status: m.status,
        totalContributed: m.totalContributed,
        hasContributedThisCycle: hasPaidThisCycle(m),
      }));

    // payoutOrder[] + resolved name.
    const payoutOrder = (g.payoutOrder || [])
      .slice()
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
      .map((p: any) => ({
        position: p.position,
        memberId: p.memberId?.toString(),
        userId: p.userId?.toString(),
        name: this.nameOf(names, p.userId),
        paid: p.paid,
        paidAt: p.paidAt,
      }));

    // caller-relative `me`.
    const isMyTurn = me.position === g.activePosition && g.status === 'ACTIVE';
    const meView = {
      memberId: me._id.toString(),
      position: me.position,
      status: me.status,
      isMyTurn,
      hasContributedThisCycle: (me.contributions || []).some(
        (c: any) => c.cycle === g.currentCycle && c.status === 'PAID',
      ),
    };

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

    const [pendingProposals, myPendingPayout] = await Promise.all([
      this.proposalModel.countDocuments({
        groupId: group._id,
        status: { $in: ['ACTIVE', 'AWAITING_ADMIN'] },
      }),
      this.payoutModel
        .findOne({
          groupId: group._id,
          recipientUserId: new Types.ObjectId(userId),
          status: { $in: ['REQUESTED', 'MARKED_SENT'] },
        })
        .sort({ requestedAt: -1 })
        .lean(),
    ]);

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
      me: meView,
      payoutOrder,
      members: memberViews,
      expectedPoolThisCycle,
      collectedThisCycle,
      arrears,
      pendingProposals,
      pendingPayoutRequest: this.shapePayoutRequest(myPendingPayout),
    };
  }

  // ===========================================================================
  // Invitations
  // ===========================================================================

  async invite(groupId: string, inviterUserId: string, email: string) {
    const group = await this.findGroupOrThrow(groupId);
    await this.requireMembership(groupId, inviterUserId);

    const normalized = email.toLowerCase().trim();
    const target = await this.usersService.findByEmail(normalized);
    if (!target) {
      throw new NotFoundException({
        success: false,
        error: ADS_ERRORS.INVITE_TARGET_NOT_REGISTERED,
      });
    }

    const existingMember = await this.memberModel.findOne({
      groupId: group._id,
      userId: target._id,
      status: { $nin: ['REMOVED', 'EXITED'] },
    });
    if (existingMember) {
      throw new ConflictException({
        success: false,
        error: ADS_ERRORS.ALREADY_MEMBER,
      });
    }

    const activeCount = await this.memberModel.countDocuments({
      groupId: group._id,
      status: { $in: ['ACTIVE', 'RECEIVED_PAYOUT'] },
    });
    const pendingCount = await this.invitationModel.countDocuments({
      groupId: group._id,
      status: 'PENDING',
    });
    if (activeCount + pendingCount >= group.maxSlots) {
      throw new ConflictException({
        success: false,
        error: ADS_ERRORS.GROUP_FULL,
      });
    }

    const dupe = await this.invitationModel.findOne({
      groupId: group._id,
      inviteeEmail: normalized,
      status: 'PENDING',
    });
    if (dupe) {
      throw new ConflictException({
        success: false,
        error: ADS_ERRORS.ALREADY_INVITED,
      });
    }

    const invitation = await this.invitationModel.create({
      groupId: group._id,
      inviterType: 'user',
      inviterId: new Types.ObjectId(inviterUserId),
      inviteeEmail: normalized,
      inviteeUserId: target._id,
      status: 'PENDING',
    });

    const inviterName = await this.userName(inviterUserId);
    this.notifications
      .notify({
        recipientType: 'user',
        recipientId: target._id.toString(),
        event: ADS_EVENTS.GROUP_INVITE,
        type: 'info',
        title: 'Contribution group invitation',
        body: `${inviterName} invited you to join "${group.name}".`,
        data: {
          groupId: group._id.toString(),
          invitationId: invitation._id.toString(),
        },
      })
      .catch(() => undefined);

    await this.logActivity({
      groupId: group._id,
      actorType: 'user',
      actorId: inviterUserId,
      actorName: inviterName,
      action: 'member.invited',
      meta: { email: normalized },
    });

    return serialize(invitation);
  }

  async listMyInvitations(userId: string): Promise<any[]> {
    const invitations = await this.invitationModel
      .find({
        inviteeUserId: new Types.ObjectId(userId),
        status: 'PENDING',
      })
      .sort({ createdAt: -1 })
      .lean();
    const groupIds = invitations.map((i) => i.groupId);
    const groups = await this.groupModel
      .find({ _id: { $in: groupIds } })
      .select('name description contributionAmount frequency type maxSlots')
      .lean();
    const groupById = new Map(groups.map((g) => [g._id.toString(), g]));
    const names = await this.resolveNames(invitations.map((i) => i.inviterId));

    return invitations.map((i) => {
      const g = groupById.get(i.groupId.toString());
      return {
        id: i._id.toString(),
        groupId: i.groupId.toString(),
        groupName: g?.name ?? '',
        type: g?.type,
        inviterName: this.nameOf(names, i.inviterId),
        contributionAmount: g?.contributionAmount,
        frequency: g?.frequency,
        maxSlots: g?.maxSlots,
        status: i.status,
        createdAt: (i as any).createdAt,
      };
    });
  }

  async acceptInvite(invitationId: string, userId: string) {
    const invitation = await this.invitationModel.findById(
      this.oid(invitationId),
    );
    if (!invitation) {
      throw new NotFoundException({
        success: false,
        error: ADS_ERRORS.INVITATION_NOT_FOUND,
      });
    }
    if (invitation.inviteeUserId?.toString() !== userId) {
      throw new ForbiddenException({
        success: false,
        error: ADS_ERRORS.INVITATION_NOT_YOURS,
      });
    }
    if (invitation.status !== 'PENDING') {
      throw new ConflictException({
        success: false,
        error: ADS_ERRORS.INVITATION_NOT_PENDING,
      });
    }

    const group = await this.groupModel.findById(invitation.groupId);
    if (!group) {
      throw new NotFoundException({
        success: false,
        error: ADS_ERRORS.GROUP_NOT_FOUND,
      });
    }

    // Re-activate a prior membership if one exists, else create ACTIVE member.
    let member = await this.memberModel.findOne({
      groupId: group._id,
      userId: new Types.ObjectId(userId),
    });

    const nextPosition =
      (group.payoutOrder?.length
        ? Math.max(...group.payoutOrder.map((p) => p.position))
        : 0) + 1;

    if (member) {
      member.status = 'ACTIVE';
      member.position = member.position || nextPosition;
      await member.save();
    } else {
      member = await this.memberModel.create({
        groupId: group._id,
        userId: new Types.ObjectId(userId),
        position: nextPosition,
        status: 'ACTIVE',
      });
    }

    // Append to payoutOrder if not present.
    const already = group.payoutOrder.some(
      (p) => p.userId.toString() === userId,
    );
    if (!already) {
      group.payoutOrder.push({
        position: member.position,
        memberId: member._id,
        userId: new Types.ObjectId(userId),
        paid: false,
      } as any);
      await group.save();
    }

    invitation.status = 'ACCEPTED';
    await invitation.save();

    const name = await this.userName(userId);

    // Notify inviter + broadcast to group.
    this.notifications
      .notify({
        recipientType: 'user',
        recipientId: invitation.inviterId.toString(),
        event: ADS_EVENTS.INVITE_ACCEPTED,
        type: 'success',
        title: 'Invitation accepted',
        body: `${name} joined "${group.name}".`,
        data: { groupId: group._id.toString() },
      })
      .catch(() => undefined);

    await this.notifyGroup(group._id, {
      event: ADS_EVENTS.MEMBER_JOINED,
      title: 'New member',
      body: `${name} joined the group.`,
      exceptUserId: userId,
    });

    await this.logActivity({
      groupId: group._id,
      actorType: 'user',
      actorId: userId,
      actorName: name,
      action: 'member.joined',
      meta: { position: member.position },
    });

    return serialize({ member: member.toObject(), group: group.toObject() });
  }

  async declineInvite(invitationId: string, userId: string) {
    const invitation = await this.invitationModel.findById(
      this.oid(invitationId),
    );
    if (!invitation) {
      throw new NotFoundException({
        success: false,
        error: ADS_ERRORS.INVITATION_NOT_FOUND,
      });
    }
    if (invitation.inviteeUserId?.toString() !== userId) {
      throw new ForbiddenException({
        success: false,
        error: ADS_ERRORS.INVITATION_NOT_YOURS,
      });
    }
    if (invitation.status !== 'PENDING') {
      throw new ConflictException({
        success: false,
        error: ADS_ERRORS.INVITATION_NOT_PENDING,
      });
    }
    invitation.status = 'DECLINED';
    await invitation.save();
    return serialize(invitation);
  }

  // ===========================================================================
  // Contributions (track-pool-only — NO wallet debit)
  // ===========================================================================

  async contribute(groupId: string, userId: string, amount?: number) {
    const group = await this.findGroupOrThrow(groupId);
    const member = await this.requireMembership(groupId, userId);
    if (member.status !== 'ACTIVE' && member.status !== 'RECEIVED_PAYOUT') {
      throw new ForbiddenException({
        success: false,
        error: ADS_ERRORS.NOT_ACTIVE_MEMBER,
      });
    }

    const value = amount && amount > 0 ? amount : group.contributionAmount;

    member.contributions.push({
      cycle: group.currentCycle,
      amount: value,
      paidAt: new Date(),
      status: 'PAID',
    } as any);
    member.totalContributed += value;
    await member.save();

    // Tracked pool counter — atomic increment, NOT a wallet balance.
    await this.groupModel.updateOne(
      { _id: group._id },
      { $inc: { poolBalance: value } },
    );

    const name = await this.userName(userId);
    await this.logActivity({
      groupId: group._id,
      actorType: 'user',
      actorId: userId,
      actorName: name,
      action: 'contribution.recorded',
      meta: { cycle: group.currentCycle, amount: value },
    });

    await this.notifyGroup(group._id, {
      event: ADS_EVENTS.CONTRIBUTION_RECORDED,
      type: 'success',
      title: 'Contribution recorded',
      body: `${name} contributed ₦${value.toLocaleString()} (cycle ${group.currentCycle}).`,
      exceptUserId: userId,
    });

    const fresh = await this.groupModel.findById(group._id).lean();
    return {
      cycle: group.currentCycle,
      amount: value,
      poolBalance: fresh?.poolBalance ?? group.poolBalance + value,
      totalContributed: member.totalContributed,
    };
  }

  // ===========================================================================
  // Chat
  // ===========================================================================

  async listMessages(groupId: string, userId: string, page = 1, limit = 30) {
    await this.findGroupOrThrow(groupId);
    await this.requireMembership(groupId, userId);
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    const filter = { groupId: this.oid(groupId) };
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

  /**
   * Persist a chat message from the gateway. Verifies access itself so the
   * gateway can call it directly. Returns the saved message (plain object).
   */
  async persistChatMessage(
    groupId: string,
    senderScope: 'user' | 'admin',
    senderId: string,
    message: string,
  ) {
    let senderName = 'Admin';
    if (senderScope === 'user') {
      const ok = await this.isActiveMember(groupId, senderId);
      if (!ok) {
        throw new ForbiddenException({
          success: false,
          error: ADS_ERRORS.NOT_ACTIVE_MEMBER,
        });
      }
      senderName = await this.userName(senderId);
    }
    const doc = await this.messageModel.create({
      groupId: this.oid(groupId),
      senderType: senderScope,
      senderId: new Types.ObjectId(senderId),
      senderName,
      message,
    });
    return serialize(doc);
  }

  // ===========================================================================
  // Proposals + voting
  // ===========================================================================

  async listProposals(groupId: string, userId: string) {
    await this.findGroupOrThrow(groupId);
    await this.requireMembership(groupId, userId);
    const proposals = await this.proposalModel
      .find({ groupId: this.oid(groupId) })
      .sort({ createdAt: -1 })
      .lean();

    // Bulk-resolve creator + slot-shift participant names.
    const userIds: (Types.ObjectId | string)[] = [];
    const memberIds: (Types.ObjectId | string)[] = [];
    for (const p of proposals) {
      userIds.push(p.createdByUserId);
      if (p.slotShift) {
        memberIds.push(
          p.slotShift.requesterMemberId,
          p.slotShift.targetMemberId,
        );
      }
    }
    // Map slot-shift memberIds -> userIds so we can name them.
    const members = memberIds.length
      ? await this.memberModel
          .find({ _id: { $in: memberIds.map((m) => new Types.ObjectId(m)) } })
          .select('userId')
          .lean()
      : [];
    const memberUserId = new Map(
      members.map((m) => [m._id.toString(), m.userId]),
    );
    for (const m of members) {
      userIds.push(m.userId);
    }
    const names = await this.resolveNames(userIds);
    const nameForMember = (memberId?: Types.ObjectId | string): string =>
      this.nameOf(
        names,
        memberId ? memberUserId.get(memberId.toString()) : null,
      );

    return proposals.map((p) => {
      const myVote =
        (p.votes || []).find((v: any) => v.userId?.toString() === userId)
          ?.vote ?? null;
      return {
        id: p._id.toString(),
        groupId: p.groupId.toString(),
        kind: p.kind,
        title: p.title,
        text: p.text,
        createdByUserId: p.createdByUserId?.toString(),
        createdByName: this.nameOf(names, p.createdByUserId),
        slotShift: p.slotShift
          ? {
              requesterMemberId: p.slotShift.requesterMemberId?.toString(),
              requesterPosition: p.slotShift.requesterPosition,
              requesterName: nameForMember(p.slotShift.requesterMemberId),
              targetMemberId: p.slotShift.targetMemberId?.toString(),
              targetPosition: p.slotShift.targetPosition,
              targetName: nameForMember(p.slotShift.targetMemberId),
            }
          : undefined,
        status: p.status,
        eligibleCount: p.eligibleCount,
        tally: { yes: p.tally?.yes ?? 0, no: p.tally?.no ?? 0 },
        myVote,
        createdAt: (p as any).createdAt,
      };
    });
  }

  async createProposal(
    groupId: string,
    userId: string,
    dto: CreateProposalDto,
  ) {
    const group = await this.findGroupOrThrow(groupId);
    await this.requireMembership(groupId, userId);
    const eligibleCount = await this.activeMemberCount(group._id);
    const proposal = await this.proposalModel.create({
      groupId: group._id,
      kind: 'GENERAL',
      title: dto.title,
      text: dto.text || '',
      createdByUserId: new Types.ObjectId(userId),
      status: 'ACTIVE',
      eligibleCount,
    });

    const name = await this.userName(userId);
    await this.notifyGroup(group._id, {
      event: ADS_EVENTS.PROPOSAL_CREATED,
      title: 'New proposal',
      body: `${name} raised a proposal: "${dto.title}".`,
      exceptUserId: userId,
    });
    await this.logActivity({
      groupId: group._id,
      actorType: 'user',
      actorId: userId,
      actorName: name,
      action: 'proposal.created',
      meta: { proposalId: proposal._id.toString(), kind: 'GENERAL' },
    });
    return serialize(proposal);
  }

  async vote(
    groupId: string,
    proposalId: string,
    userId: string,
    vote: 'yes' | 'no',
  ) {
    const group = await this.findGroupOrThrow(groupId);
    await this.requireMembership(groupId, userId);
    const proposal = await this.proposalModel.findOne({
      _id: this.oid(proposalId),
      groupId: group._id,
    });
    if (!proposal) {
      throw new NotFoundException({
        success: false,
        error: ADS_ERRORS.PROPOSAL_NOT_FOUND,
      });
    }
    if (proposal.status !== 'ACTIVE') {
      throw new ConflictException({
        success: false,
        error: ADS_ERRORS.PROPOSAL_NOT_ACTIVE,
      });
    }
    if (proposal.votes.some((v) => v.userId.toString() === userId)) {
      throw new ConflictException({
        success: false,
        error: ADS_ERRORS.ALREADY_VOTED,
      });
    }

    proposal.votes.push({
      userId: new Types.ObjectId(userId),
      vote,
      at: new Date(),
    } as any);
    proposal.tally.yes = proposal.votes.filter((v) => v.vote === 'yes').length;
    proposal.tally.no = proposal.votes.filter((v) => v.vote === 'no').length;

    // Recompute eligibility live in case membership changed.
    const eligibleCount = await this.activeMemberCount(group._id);
    proposal.eligibleCount = eligibleCount;

    const allVoted = proposal.votes.length >= eligibleCount;
    let escalated = false;

    if (allVoted) {
      if (proposal.kind === 'SLOT_SHIFT') {
        proposal.status = 'AWAITING_ADMIN';
        escalated = true;
      } else {
        proposal.status =
          proposal.tally.yes > proposal.tally.no ? 'PASSED' : 'REJECTED';
      }
    }
    await proposal.save();

    const name = await this.userName(userId);
    await this.logActivity({
      groupId: group._id,
      actorType: 'user',
      actorId: userId,
      actorName: name,
      action: 'proposal.voted',
      meta: {
        proposalId: proposal._id.toString(),
        vote,
        status: proposal.status,
      },
    });

    if (escalated) {
      this.notifications
        .notifyAdmins({
          event: ADS_EVENTS.PROPOSAL_AWAITING_ADMIN,
          type: 'warning',
          title: 'Slot-shift awaiting decision',
          body: `A slot-shift proposal in "${group.name}" has been voted on by all members and needs an admin decision.`,
          data: {
            groupId: group._id.toString(),
            proposalId: proposal._id.toString(),
          },
        })
        .catch(() => undefined);
    } else if (proposal.status !== 'ACTIVE') {
      await this.notifyGroup(group._id, {
        event: ADS_EVENTS.PROPOSAL_DECIDED,
        title: 'Proposal decided',
        body: `Proposal "${proposal.title}" is now ${proposal.status}.`,
      });
    }

    return serialize(proposal);
  }

  async requestSlotShift(
    groupId: string,
    userId: string,
    targetMemberId: string,
    reason?: string,
  ) {
    const group = await this.findGroupOrThrow(groupId);
    const requester = await this.requireMembership(groupId, userId);
    if (requester.status !== 'ACTIVE') {
      throw new ForbiddenException({
        success: false,
        error: ADS_ERRORS.NOT_ACTIVE_MEMBER,
      });
    }

    const target = await this.memberModel.findOne({
      _id: this.oid(targetMemberId),
      groupId: group._id,
      status: 'ACTIVE',
    });
    if (!target) {
      throw new BadRequestException({
        success: false,
        error: ADS_ERRORS.SLOT_SHIFT_TARGET_INVALID,
      });
    }
    if (target._id.toString() === requester._id.toString()) {
      throw new BadRequestException({
        success: false,
        error: ADS_ERRORS.SLOT_SHIFT_SELF,
      });
    }

    const eligibleCount = await this.activeMemberCount(group._id);
    const proposal = await this.proposalModel.create({
      groupId: group._id,
      kind: 'SLOT_SHIFT',
      title: 'Slot swap request',
      text: reason || '',
      createdByUserId: new Types.ObjectId(userId),
      slotShift: {
        requesterMemberId: requester._id,
        requesterPosition: requester.position,
        targetMemberId: target._id,
        targetPosition: target.position,
      },
      status: 'ACTIVE',
      eligibleCount,
    });

    const name = await this.userName(userId);
    const targetName = await this.userName(target.userId);
    await this.notifyGroup(group._id, {
      event: ADS_EVENTS.SLOT_SHIFT_REQUESTED,
      type: 'warning',
      title: 'Slot swap requested',
      body: `${name} wants to swap rotation slots with ${targetName}. Please vote.`,
    });
    await this.logActivity({
      groupId: group._id,
      actorType: 'user',
      actorId: userId,
      actorName: name,
      action: 'slot_shift.requested',
      meta: {
        proposalId: proposal._id.toString(),
        targetMemberId: target._id.toString(),
      },
    });

    return serialize(proposal);
  }

  // ===========================================================================
  // Attendance
  // ===========================================================================

  async listAttendance(groupId: string, userId: string) {
    await this.findGroupOrThrow(groupId);
    await this.requireMembership(groupId, userId);
    const sessions = await this.attendanceModel
      .find({ groupId: this.oid(groupId) })
      .sort({ createdAt: -1 })
      .lean();
    return sessions.map((s) => ({
      id: s._id.toString(),
      groupId: s.groupId.toString(),
      sessionDate: s.sessionDate,
      title: s.title,
      presentCount: (s.presentUserIds || []).length,
      iAmPresent: (s.presentUserIds || []).some(
        (id) => id.toString() === userId,
      ),
    }));
  }

  async checkIn(groupId: string, sessionId: string, userId: string) {
    const group = await this.findGroupOrThrow(groupId);
    await this.requireMembership(groupId, userId);
    const session = await this.attendanceModel.findOne({
      _id: this.oid(sessionId),
      groupId: group._id,
    });
    if (!session) {
      throw new NotFoundException({
        success: false,
        error: ADS_ERRORS.ATTENDANCE_NOT_FOUND,
      });
    }
    const uid = new Types.ObjectId(userId);
    if (session.presentUserIds.some((id) => id.toString() === userId)) {
      throw new ConflictException({
        success: false,
        error: ADS_ERRORS.ALREADY_CHECKED_IN,
      });
    }
    session.presentUserIds.push(uid);
    await session.save();

    const name = await this.userName(userId);
    await this.logActivity({
      groupId: group._id,
      actorType: 'user',
      actorId: userId,
      actorName: name,
      action: 'attendance.check_in',
      meta: { sessionId: session._id.toString() },
    });
    return serialize(session);
  }

  // ===========================================================================
  // Payout lifecycle (manual, request → mark-sent → confirm-received)
  // ===========================================================================

  /** Member claims their matured rotation turn → creates a REQUESTED payout. */
  async requestPayout(groupId: string, userId: string) {
    const group = await this.findGroupOrThrow(groupId);
    const member = await this.requireMembership(groupId, userId);

    // The active rotation slot must be this member's, unpaid.
    const slot = group.payoutOrder.find(
      (p) => p.position === group.activePosition,
    );
    if (
      !slot ||
      slot.paid ||
      slot.userId.toString() !== userId ||
      member.status !== 'ACTIVE'
    ) {
      throw new ForbiddenException({
        success: false,
        error: ADS_ERRORS.PAYOUT_NOT_YOUR_TURN,
      });
    }

    const idempotencyKey = `payout:${group._id.toString()}:${group.currentCycle}:${group.activePosition}`;

    const existing = await this.payoutModel.findOne({ idempotencyKey });
    if (existing) {
      throw new ConflictException({
        success: false,
        error: ADS_ERRORS.PAYOUT_ALREADY_REQUESTED,
      });
    }

    let request: PayoutRequestDocument;
    try {
      request = await this.payoutModel.create({
        groupId: group._id,
        cycle: group.currentCycle,
        position: group.activePosition,
        recipientMemberId: member._id,
        recipientUserId: new Types.ObjectId(userId),
        amount: group.poolBalance,
        status: 'REQUESTED',
        idempotencyKey,
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException({
          success: false,
          error: ADS_ERRORS.PAYOUT_ALREADY_REQUESTED,
        });
      }
      throw error;
    }

    const name = await this.userName(userId);
    this.notifications
      .notifyAdmins({
        event: ADS_EVENTS.PAYOUT_REQUESTED,
        type: 'warning',
        title: 'Payout requested',
        body: `${name} requested their payout of ₦${group.poolBalance.toLocaleString()} in "${group.name}".`,
        data: {
          groupId: group._id.toString(),
          payoutRequestId: request._id.toString(),
        },
      })
      .catch(() => undefined);

    await this.logActivity({
      groupId: group._id,
      actorType: 'user',
      actorId: userId,
      actorName: name,
      action: 'payout.requested',
      meta: {
        payoutRequestId: request._id.toString(),
        amount: group.poolBalance,
        cycle: group.currentCycle,
      },
    });

    return serialize(request);
  }

  /**
   * Recipient confirms they received the payout → CONFIRMED_RECEIVED,
   * mark slot paid, member RECEIVED_PAYOUT, advance rotation. Transactional.
   */
  async confirmPayoutReceived(
    groupId: string,
    requestId: string,
    userId: string,
  ) {
    const group = await this.findGroupOrThrow(groupId);
    const request = await this.payoutModel.findOne({
      _id: this.oid(requestId),
      groupId: group._id,
    });
    if (!request) {
      throw new NotFoundException({
        success: false,
        error: ADS_ERRORS.PAYOUT_REQUEST_NOT_FOUND,
      });
    }
    if (request.recipientUserId.toString() !== userId) {
      throw new ForbiddenException({
        success: false,
        error: ADS_ERRORS.PAYOUT_NOT_RECIPIENT,
      });
    }
    if (request.status === 'CONFIRMED_RECEIVED') {
      return request.toObject(); // idempotent
    }
    if (request.status !== 'MARKED_SENT') {
      throw new ConflictException({
        success: false,
        error: ADS_ERRORS.PAYOUT_NOT_MARKED_SENT,
      });
    }

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        request.status = 'CONFIRMED_RECEIVED';
        request.confirmedAt = new Date();
        await request.save({ session });

        // Mark the paid slot, flip member status, reset pool, advance rotation.
        const g = await this.groupModel.findById(group._id).session(session);
        if (!g) {
          return;
        }
        const slot = g.payoutOrder.find((p) => p.position === request.position);
        if (slot) {
          slot.paid = true;
          slot.paidAt = new Date();
        }
        g.poolBalance = 0;

        await this.memberModel.updateOne(
          { _id: request.recipientMemberId },
          { $set: { status: 'RECEIVED_PAYOUT' } },
          { session },
        );

        // Advance to the next unpaid slot; if none, group COMPLETED.
        const nextSlot = g.payoutOrder
          .filter((p) => !p.paid)
          .sort((a, b) => a.position - b.position)[0];
        if (nextSlot) {
          g.activePosition = nextSlot.position;
          g.currentCycle += 1;
        } else {
          g.status = 'COMPLETED';
        }
        await g.save({ session });
      });
    } finally {
      await session.endSession();
    }

    const name = await this.userName(userId);
    await this.notifyGroup(group._id, {
      event: ADS_EVENTS.PAYOUT_CONFIRMED,
      type: 'success',
      title: 'Payout confirmed',
      body: `${name} confirmed receiving the payout for cycle ${request.cycle}.`,
    });
    this.notifications
      .notifyAdmins({
        event: ADS_EVENTS.PAYOUT_CONFIRMED,
        type: 'success',
        title: 'Payout confirmed',
        body: `${name} confirmed a payout of ₦${request.amount.toLocaleString()} in "${group.name}".`,
        data: {
          groupId: group._id.toString(),
          payoutRequestId: request._id.toString(),
        },
      })
      .catch(() => undefined);
    await this.logActivity({
      groupId: group._id,
      actorType: 'user',
      actorId: userId,
      actorName: name,
      action: 'payout.confirmed',
      meta: {
        payoutRequestId: request._id.toString(),
        amount: request.amount,
      },
    });

    const fresh = await this.payoutModel.findById(request._id).lean();
    return fresh;
  }
}
