import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { MustChangePasswordGuard } from '../admin/guards/must-change-password.guard';
import { RequirePermissions } from '../admin/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../admin/decorators/current-admin.decorator';
import { AdminUserDocument } from '../admin/schemas/admin-user.schema';
import { AdminAuditService } from '../admin/admin-audit.service';
import { AdminContributionsService } from './admin-contributions.service';
import { AdminListGroupsDto } from './dto/admin-list-groups.dto';
import {
  AdminCreateGroupDto,
  AdminInviteDto,
} from './dto/admin-create-group.dto';
import {
  CancelPayoutDto,
  MarkPayoutSentDto,
  SuspendGroupDto,
} from './dto/suspend-group.dto';
import { DecideProposalDto } from './dto/decide-proposal.dto';
import { UpdateRulesDto } from './dto/update-rules.dto';

/**
 * Admin-plane API for Adashe contribution groups.
 * Base path `/api/v1/admin/contribution-groups`. Guarded by the admin JWT, the
 * mustChangePassword gate, and per-route permission checks. Every mutation
 * writes an `adminAuditLog` entry.
 */
@ApiTags('admin-contribution-groups')
@ApiBearerAuth()
@Controller('admin/contribution-groups')
@UseGuards(AdminJwtGuard, MustChangePasswordGuard, PermissionsGuard)
export class AdminContributionsController {
  constructor(
    private readonly service: AdminContributionsService,
    private readonly audit: AdminAuditService,
  ) {}

  private meta(req: Request) {
    return {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || '',
    };
  }

  // ===========================================================================
  // Groups
  // ===========================================================================

  @Get()
  @RequirePermissions('adashe-groups:view')
  @ApiOperation({ summary: 'List/search contribution groups' })
  async list(@Query() query: AdminListGroupsDto) {
    const data = await this.service.listGroups(query);
    return { success: true, data };
  }

  @Get('payout-requests')
  @RequirePermissions('adashe-contributions:mark-sent')
  @ApiOperation({
    summary: 'Cross-group payout-request queue (default REQUESTED)',
  })
  async payoutQueue(@Query('status') status?: string) {
    const data = await this.service.listPayoutRequests(status || 'REQUESTED');
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('adashe-groups:view')
  @ApiOperation({
    summary: 'Group detail (members, proposals, payout requests)',
  })
  async detail(@Param('id') id: string) {
    const data = await this.service.getGroup(id);
    return { success: true, data };
  }

  @Get(':id/messages')
  @RequirePermissions('adashe-groups:view')
  @ApiOperation({
    summary: 'Paginated group chat history (oversight; no membership check)',
  })
  async messages(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.service.listMessages(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 30,
    );
    return { success: true, data };
  }

  @Get(':id/members')
  @RequirePermissions('adashe-groups:view')
  @ApiOperation({ summary: 'Group member roster with contribution health' })
  async members(@Param('id') id: string) {
    const data = await this.service.listMembers(id);
    return { success: true, data };
  }

  @Get(':id/contributions')
  @RequirePermissions('adashe-groups:view')
  @ApiOperation({ summary: 'Per-cycle contribution audit trail' })
  async contributions(@Param('id') id: string, @Query('cycle') cycle?: string) {
    const data = await this.service.getContributionAudit(
      id,
      cycle ? parseInt(cycle, 10) : undefined,
    );
    return { success: true, data };
  }

  @Get(':id/payout-requests')
  @RequirePermissions('adashe-groups:view')
  @ApiOperation({ summary: "A single group's payout requests (all statuses)" })
  async groupPayoutRequests(@Param('id') id: string) {
    const data = await this.service.listGroupPayoutRequests(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('adashe-groups:create')
  @ApiOperation({ summary: 'Create a circle as admin overseer' })
  async create(
    @CurrentAdmin() admin: AdminUserDocument,
    @Body() dto: AdminCreateGroupDto,
    @Req() req: Request,
  ) {
    const data = await this.service.createGroup(admin._id.toString(), dto);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'adashe.group.create',
      permission: 'adashe-groups:create',
      resource: 'adashe-groups',
      targetId: data.id,
      after: { name: data.name, organizerType: 'admin' },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Post(':id/invite')
  @RequirePermissions('adashe-groups:create')
  @ApiOperation({ summary: 'Invite a registered user by email' })
  async invite(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: AdminInviteDto,
    @Req() req: Request,
  ) {
    const data = await this.service.inviteByEmail(
      id,
      admin._id.toString(),
      dto.email,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'adashe.invite.send',
      permission: 'adashe-groups:create',
      resource: 'adashe-groups',
      targetId: id,
      after: { email: dto.email },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Post(':id/suspend')
  @RequirePermissions('adashe-groups:configure')
  @ApiOperation({ summary: 'Suspend a group' })
  async suspend(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: SuspendGroupDto,
    @Req() req: Request,
  ) {
    const result = await this.service.suspendGroup(
      id,
      admin._id.toString(),
      dto.reason,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'adashe.group.suspend',
      permission: 'adashe-groups:configure',
      resource: 'adashe-groups',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.group };
  }

  @Post(':id/reinstate')
  @RequirePermissions('adashe-groups:configure')
  @ApiOperation({ summary: 'Reinstate a suspended group' })
  async reinstate(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.service.reinstateGroup(id, admin._id.toString());
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'adashe.group.reinstate',
      permission: 'adashe-groups:configure',
      resource: 'adashe-groups',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.group };
  }

  @Patch(':id/rules')
  @RequirePermissions('adashe-groups:configure')
  @ApiOperation({ summary: 'Update group rules' })
  async updateRules(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: UpdateRulesDto,
    @Req() req: Request,
  ) {
    const result = await this.service.updateRules(
      id,
      admin._id.toString(),
      dto,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'adashe.rules.update',
      permission: 'adashe-groups:configure',
      resource: 'adashe-groups',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.group };
  }

  // ===========================================================================
  // Payout requests
  // ===========================================================================

  @Post(':id/payout/:reqId/mark-sent')
  @RequirePermissions('adashe-contributions:mark-sent')
  @ApiOperation({
    summary: 'Mark a payout request as sent (funds wired off-platform)',
  })
  async markSent(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Param('reqId') reqId: string,
    @Body() dto: MarkPayoutSentDto,
    @Req() req: Request,
  ) {
    const result = await this.service.markPayoutSent(
      id,
      reqId,
      admin._id.toString(),
      dto.note,
      dto.paymentReference,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'adashe.payout.mark_sent',
      permission: 'adashe-contributions:mark-sent',
      resource: 'adashe-contributions',
      targetId: reqId,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.request };
  }

  @Post(':id/payout/:reqId/cancel')
  @RequirePermissions('adashe-contributions:mark-sent')
  @ApiOperation({ summary: 'Cancel a payout request (not yet confirmed)' })
  async cancelPayout(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Param('reqId') reqId: string,
    @Body() dto: CancelPayoutDto,
    @Req() req: Request,
  ) {
    const result = await this.service.cancelPayout(
      id,
      reqId,
      admin._id.toString(),
      dto.reason,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'adashe.payout.cancel',
      permission: 'adashe-contributions:mark-sent',
      resource: 'adashe-contributions',
      targetId: reqId,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.request };
  }

  // ===========================================================================
  // Proposals (slot-shift decisions)
  // ===========================================================================

  @Get(':id/proposals')
  @RequirePermissions('adashe-groups:view')
  @ApiOperation({ summary: 'List a group proposals' })
  async proposals(@Param('id') id: string) {
    const data = await this.service.listProposals(id);
    return { success: true, data };
  }

  @Post(':id/proposals/:pid/approve')
  @RequirePermissions('adashe-groups:configure')
  @ApiOperation({ summary: 'Approve an awaiting slot-shift proposal' })
  async approve(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: DecideProposalDto,
    @Req() req: Request,
  ) {
    const result = await this.service.approveProposal(
      id,
      pid,
      admin._id.toString(),
      dto.reason,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'adashe.slot_shift.approve',
      permission: 'adashe-groups:configure',
      resource: 'adashe-groups',
      targetId: pid,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.proposal };
  }

  @Post(':id/proposals/:pid/reject')
  @RequirePermissions('adashe-groups:configure')
  @ApiOperation({ summary: 'Reject an awaiting slot-shift proposal' })
  async reject(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: DecideProposalDto,
    @Req() req: Request,
  ) {
    const result = await this.service.rejectProposal(
      id,
      pid,
      admin._id.toString(),
      dto.reason,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'adashe.slot_shift.reject',
      permission: 'adashe-groups:configure',
      resource: 'adashe-groups',
      targetId: pid,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.proposal };
  }
}

/**
 * Cross-group slot-shift decisions queue. Base path `/api/v1/admin/proposals`
 * (the admin API base is `<API_URL>/admin`, so the client hits `/proposals`).
 * Read-only oversight endpoint — no audit entry. Same admin guard stack.
 */
@ApiTags('admin-contribution-groups')
@ApiBearerAuth()
@Controller('admin/proposals')
@UseGuards(AdminJwtGuard, MustChangePasswordGuard, PermissionsGuard)
export class AdminProposalsController {
  constructor(private readonly service: AdminContributionsService) {}

  @Get()
  @RequirePermissions('adashe-groups:view')
  @ApiOperation({
    summary: 'Cross-group slot-shift proposals awaiting an admin decision',
  })
  async list(@Query('page') page?: string, @Query('limit') limit?: string) {
    const data = await this.service.listAwaitingProposals({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { success: true, data };
  }
}
