import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { MustChangePasswordGuard } from '../admin/guards/must-change-password.guard';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { RequirePermissions } from '../admin/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../admin/decorators/current-admin.decorator';
import { AdminUserDocument } from '../admin/schemas/admin-user.schema';
import { AdminAuditService } from '../admin/admin-audit.service';
import { AdminMerchantsService } from './admin-merchants.service';
import {
  CancelPayoutAdminDto,
  ListEarningsAdminDto,
  ListMerchantsAdminDto,
  ListPayoutsAdminDto,
  MarkPayoutSentDto,
  RejectMerchantDto,
  SuspendMerchantDto,
} from './dto/admin-merchants.dto';

/**
 * Admin merchants console — KYC review (approve/reject purge the private
 * KYC docs), suspension lifecycle, earnings ledger and the manual payout
 * queue. Base `/api/v1/admin/merchants`
 * (PRD/admin_module/merchants/merchants.md). `merchants:mark-payout-sent`
 * is Super-Admin-only (reserved set). Every mutation audits.
 */
@ApiTags('admin-merchants')
@ApiBearerAuth()
@Controller('admin/merchants')
@UseGuards(AdminJwtGuard, MustChangePasswordGuard, PermissionsGuard)
export class AdminMerchantsController {
  constructor(
    private readonly service: AdminMerchantsService,
    private readonly audit: AdminAuditService,
  ) {}

  private meta(req: Request) {
    return {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || '',
    };
  }

  @Get()
  @RequirePermissions('merchants:view')
  @ApiOperation({ summary: 'List/search merchants (filters)' })
  async list(@Query() query: ListMerchantsAdminDto) {
    const data = await this.service.listMerchants(query);
    return { success: true, data };
  }

  // ===========================================================================
  // Payout queue (declared before `:id` to avoid path shadowing)
  // ===========================================================================

  @Get('payout-requests')
  @RequirePermissions('merchants:view')
  @ApiOperation({
    summary: 'Cross-merchant payout queue (default status=REQUESTED)',
  })
  async payoutQueue(@Query() query: ListPayoutsAdminDto) {
    const data = await this.service.listPayoutRequests(query);
    return { success: true, data };
  }

  @Get('payout-requests/:reqId')
  @RequirePermissions('merchants:view')
  @ApiOperation({
    summary: 'Payout-request detail (locked entries, bank snapshot)',
  })
  async payoutDetail(@Param('reqId') reqId: string) {
    const data = await this.service.payoutRequestDetail(reqId);
    return { success: true, data };
  }

  @Post('payout-requests/:reqId/mark-sent')
  @RequirePermissions('merchants:mark-payout-sent')
  @ApiOperation({
    summary:
      'Mark funds wired (REQUESTED → MARKED_SENT; paymentReference required) — Super-Admin-only, non-delegable',
  })
  async markSent(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('reqId') reqId: string,
    @Body() dto: MarkPayoutSentDto,
    @Req() req: Request,
  ) {
    const data = await this.service.markPayoutSent(
      reqId,
      dto,
      admin._id.toString(),
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'merchants.payout.mark_sent',
      permission: 'merchants:mark-payout-sent',
      resource: 'merchants',
      targetId: reqId,
      after: {
        paymentReference: dto.paymentReference,
        note: dto.note || null,
        amount: data.amount,
        severity: 'high',
      },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Post('payout-requests/:reqId/cancel')
  @RequirePermissions('merchants:mark-payout-sent')
  @ApiOperation({
    summary:
      'Cancel/void a payout request (reason required; unlocks entries) — Super-Admin-only',
  })
  async cancelPayout(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('reqId') reqId: string,
    @Body() dto: CancelPayoutAdminDto,
    @Req() req: Request,
  ) {
    const data = await this.service.cancelPayoutRequest(
      reqId,
      dto,
      admin._id.toString(),
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'merchants.payout.cancel',
      permission: 'merchants:mark-payout-sent',
      resource: 'merchants',
      targetId: reqId,
      after: { reason: dto.reason, severity: 'high' },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  // ===========================================================================
  // Merchant detail + KYC review + suspension
  // ===========================================================================

  @Get(':id')
  @RequirePermissions('merchants:view')
  @ApiOperation({
    summary:
      'Merchant detail: profile, ID data, Prembly panel, KYC docs (view via /admin/upload/:id/signed-url)',
  })
  async detail(@Param('id') id: string) {
    const data = await this.service.merchantDetail(id);
    return { success: true, data };
  }

  @Get(':id/earnings')
  @RequirePermissions('merchants:view')
  @ApiOperation({ summary: 'Earnings ledger (paginated, filterable)' })
  async earnings(
    @Param('id') id: string,
    @Query() query: ListEarningsAdminDto,
  ) {
    const data = await this.service.merchantEarnings(id, query);
    return { success: true, data };
  }

  @Get(':id/payout-requests')
  @RequirePermissions('merchants:view')
  @ApiOperation({ summary: "One merchant's payout requests (all statuses)" })
  async merchantPayouts(@Param('id') id: string) {
    const data = await this.service.merchantPayoutRequests(id);
    return { success: true, data };
  }

  @Post(':id/approve')
  @RequirePermissions('merchants:approve')
  @ApiOperation({
    summary: 'Approve KYC (PENDING_REVIEW → APPROVED) — purges the KYC docs',
  })
  async approve(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { view, purgedDocIds } = await this.service.approveMerchant(
      id,
      admin._id.toString(),
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'merchants.kyc.approve',
      permission: 'merchants:approve',
      resource: 'merchants',
      targetId: id,
      after: { kycStatus: 'APPROVED', purgedDocIds, severity: 'high' },
      ...this.meta(req),
    });
    return { success: true, data: view };
  }

  @Post(':id/reject')
  @RequirePermissions('merchants:approve')
  @ApiOperation({
    summary:
      'Reject KYC (reason required; PENDING_REVIEW → REJECTED) — purges the KYC docs',
  })
  async reject(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: RejectMerchantDto,
    @Req() req: Request,
  ) {
    const { view, purgedDocIds } = await this.service.rejectMerchant(
      id,
      dto,
      admin._id.toString(),
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'merchants.kyc.reject',
      permission: 'merchants:approve',
      resource: 'merchants',
      targetId: id,
      after: {
        kycStatus: 'REJECTED',
        reason: dto.reason,
        purgedDocIds,
        severity: 'high',
      },
      ...this.meta(req),
    });
    return { success: true, data: view };
  }

  @Post(':id/suspend')
  @RequirePermissions('merchants:suspend')
  @ApiOperation({
    summary: 'Suspend an APPROVED merchant (reason required; delists products)',
  })
  async suspend(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: SuspendMerchantDto,
    @Req() req: Request,
  ) {
    const data = await this.service.suspendMerchant(
      id,
      dto,
      admin._id.toString(),
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'merchants.suspend',
      permission: 'merchants:suspend',
      resource: 'merchants',
      targetId: id,
      after: {
        reason: dto.reason,
        productsDelisted: data.productsDelisted,
        severity: 'high',
      },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Post(':id/reinstate')
  @RequirePermissions('merchants:suspend')
  @ApiOperation({
    summary: 'Lift suspension (SUSPENDED → APPROVED; relists products)',
  })
  async reinstate(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const data = await this.service.reinstateMerchant(id);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'merchants.reinstate',
      permission: 'merchants:suspend',
      resource: 'merchants',
      targetId: id,
      after: { productsRelisted: data.productsRelisted },
      ...this.meta(req),
    });
    return { success: true, data };
  }
}
