import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';
import { NotificationModule } from '../notifications/notification.module';
import {
  ContributionGroup,
  ContributionGroupSchema,
} from './schemas/contribution-group.schema';
import { GroupMember, GroupMemberSchema } from './schemas/group-member.schema';
import {
  GroupInvitation,
  GroupInvitationSchema,
} from './schemas/group-invitation.schema';
import {
  GroupMessage,
  GroupMessageSchema,
} from './schemas/group-message.schema';
import {
  GroupProposal,
  GroupProposalSchema,
} from './schemas/group-proposal.schema';
import {
  GroupAttendance,
  GroupAttendanceSchema,
} from './schemas/group-attendance.schema';
import {
  PayoutRequest,
  PayoutRequestSchema,
} from './schemas/payout-request.schema';
import {
  GroupActivityLog,
  GroupActivityLogSchema,
} from './schemas/group-activity-log.schema';
import { ContributionsService } from './contributions.service';
import { AdminContributionsService } from './admin-contributions.service';
import { ContributionsGateway } from './contributions.gateway';
import { ContributionsController } from './contributions.controller';
import {
  AdminContributionsController,
  AdminProposalsController,
} from './admin-contributions.controller';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    // JwtModule (empty registration) — the gateway passes secrets per-call in
    // verifyAsync, mirroring NotificationModule/AdminModule.
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: ContributionGroup.name, schema: ContributionGroupSchema },
      { name: GroupMember.name, schema: GroupMemberSchema },
      { name: GroupInvitation.name, schema: GroupInvitationSchema },
      { name: GroupMessage.name, schema: GroupMessageSchema },
      { name: GroupProposal.name, schema: GroupProposalSchema },
      { name: GroupAttendance.name, schema: GroupAttendanceSchema },
      { name: PayoutRequest.name, schema: PayoutRequestSchema },
      { name: GroupActivityLog.name, schema: GroupActivityLogSchema },
    ]),
    UsersModule,
    // AdminModule provides the admin guards + AdminAuditService and re-exports
    // the AdminUser model registration used by the admin controller.
    AdminModule,
    // NotificationModule exports NotificationService (notify/notifyAdmins).
    NotificationModule,
  ],
  controllers: [
    ContributionsController,
    AdminContributionsController,
    AdminProposalsController,
  ],
  providers: [
    ContributionsService,
    AdminContributionsService,
    ContributionsGateway,
  ],
  exports: [ContributionsService],
})
export class ContributionsModule {}
