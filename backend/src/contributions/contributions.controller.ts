import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { ContributionsService } from './contributions.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { ContributeDto } from './dto/contribute.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { VoteDto } from './dto/vote.dto';
import { RequestSlotShiftDto } from './dto/request-slot-shift.dto';
import { ListMessagesDto } from './dto/list-messages.dto';

/**
 * User-plane API for Adashe / Esusu contribution groups.
 * Base path `/api/v1/contribution-groups`, guarded by the user JWT.
 * The authenticated user document is on `request.user`; `user._id` is the
 * canonical id passed to the service.
 */
@ApiTags('contribution-groups')
@ApiBearerAuth()
@Controller('contribution-groups')
@UseGuards(JwtAuthGuard)
export class ContributionsController {
  constructor(private readonly service: ContributionsService) {}

  private uid(user: UserDocument): string {
    return user._id.toString();
  }

  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------

  @Post()
  @ApiOperation({ summary: 'Create a contribution group (caller = organizer)' })
  async create(@CurrentUser() user: UserDocument, @Body() dto: CreateGroupDto) {
    const data = await this.service.createGroup(this.uid(user), dto);
    return { success: true, data };
  }

  @Get('my-groups')
  @ApiOperation({
    summary: 'List groups the caller organizes or is a member of',
  })
  async myGroups(@CurrentUser() user: UserDocument) {
    const data = await this.service.listMyGroups(this.uid(user));
    return { success: true, data };
  }

  // ---------------------------------------------------------------------------
  // Invitations (mine) — declared before `/:id` so they aren't shadowed
  // ---------------------------------------------------------------------------

  @Get('invitations')
  @ApiOperation({ summary: "The caller's PENDING invitations" })
  async myInvitations(@CurrentUser() user: UserDocument) {
    const data = await this.service.listMyInvitations(this.uid(user));
    return { success: true, data };
  }

  @Post('invitations/:invId/accept')
  @ApiOperation({ summary: 'Accept an invitation → become a member' })
  async acceptInvite(
    @CurrentUser() user: UserDocument,
    @Param('invId') invId: string,
  ) {
    const data = await this.service.acceptInvite(invId, this.uid(user));
    return { success: true, data };
  }

  @Post('invitations/:invId/decline')
  @ApiOperation({ summary: 'Decline an invitation' })
  async declineInvite(
    @CurrentUser() user: UserDocument,
    @Param('invId') invId: string,
  ) {
    const data = await this.service.declineInvite(invId, this.uid(user));
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Group detail (rotation, members, pool, my status)',
  })
  async detail(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const data = await this.service.getGroup(id, this.uid(user));
    return { success: true, data };
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite a registered user by email (organizer)' })
  async invite(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    const data = await this.service.invite(id, this.uid(user), dto.email);
    return { success: true, data };
  }

  // ---------------------------------------------------------------------------
  // Contributions (track-pool-only)
  // ---------------------------------------------------------------------------

  @Post(':id/contribute')
  @ApiOperation({ summary: 'Record a contribution for the current cycle' })
  async contribute(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: ContributeDto,
  ) {
    const data = await this.service.contribute(id, this.uid(user), dto.amount);
    return { success: true, data };
  }

  // ---------------------------------------------------------------------------
  // Chat history
  // ---------------------------------------------------------------------------

  @Get(':id/messages')
  @ApiOperation({ summary: 'Chat history (paginated, chronological)' })
  async messages(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Query() query: ListMessagesDto,
  ) {
    const data = await this.service.listMessages(
      id,
      this.uid(user),
      query.page,
      query.limit,
    );
    return { success: true, data };
  }

  // ---------------------------------------------------------------------------
  // Proposals + voting
  // ---------------------------------------------------------------------------

  @Get(':id/proposals')
  @ApiOperation({ summary: 'List proposals (general + slot-shift)' })
  async proposals(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const data = await this.service.listProposals(id, this.uid(user));
    return { success: true, data };
  }

  @Post(':id/proposals')
  @ApiOperation({ summary: 'Create a GENERAL proposal' })
  async createProposal(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: CreateProposalDto,
  ) {
    const data = await this.service.createProposal(id, this.uid(user), dto);
    return { success: true, data };
  }

  @Post(':id/proposals/:pid/vote')
  @ApiOperation({ summary: 'Cast a yes/no vote on a proposal' })
  async vote(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: VoteDto,
  ) {
    const data = await this.service.vote(id, pid, this.uid(user), dto.vote);
    return { success: true, data };
  }

  @Post(':id/slot-shift')
  @ApiOperation({ summary: 'Request a slot swap with a chosen member' })
  async slotShift(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: RequestSlotShiftDto,
  ) {
    const data = await this.service.requestSlotShift(
      id,
      this.uid(user),
      dto.targetMemberId,
      dto.reason,
    );
    return { success: true, data };
  }

  // ---------------------------------------------------------------------------
  // Attendance
  // ---------------------------------------------------------------------------

  @Get(':id/attendance')
  @ApiOperation({ summary: 'List attendance sessions' })
  async attendance(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const data = await this.service.listAttendance(id, this.uid(user));
    return { success: true, data };
  }

  @Post(':id/attendance/:sessionId/check-in')
  @ApiOperation({ summary: 'Check in to an open attendance session' })
  async checkIn(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ) {
    const data = await this.service.checkIn(id, sessionId, this.uid(user));
    return { success: true, data };
  }

  // ---------------------------------------------------------------------------
  // Payout lifecycle
  // ---------------------------------------------------------------------------

  @Post(':id/payout/request')
  @ApiOperation({ summary: 'Claim your matured turn → create a PayoutRequest' })
  async requestPayout(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    const data = await this.service.requestPayout(id, this.uid(user));
    return { success: true, data };
  }

  @Post(':id/payout/:reqId/confirm-received')
  @ApiOperation({ summary: 'Confirm you received the wired payout' })
  async confirmReceived(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('reqId') reqId: string,
  ) {
    const data = await this.service.confirmPayoutReceived(
      id,
      reqId,
      this.uid(user),
    );
    return { success: true, data };
  }
}
