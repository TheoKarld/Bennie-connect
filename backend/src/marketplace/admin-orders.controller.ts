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
import { MustChangePasswordGuard } from '../admin/guards/must-change-password.guard';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { RequirePermissions } from '../admin/decorators/require-permissions.decorator';
import { CurrentAdmin } from '../admin/decorators/current-admin.decorator';
import { AdminUserDocument } from '../admin/schemas/admin-user.schema';
import { AdminAuditService } from '../admin/admin-audit.service';
import { AdminOrdersService } from './admin-orders.service';
import {
  AdminCancelOrderDto,
  AdminFulfillmentDto,
  AdminRefundDto,
  ListOrdersAdminDto,
} from './dto/admin-orders.dto';

/**
 * Admin orders console — cross-seller oversight of ALL marketplace orders.
 * Base `/api/v1/admin/orders` (PRD/admin_module/admin_orders/orders.md).
 * `orders:refund` is Super-Admin-only (enforced by the PermissionsGuard's
 * reserved-permission set). Every mutation writes an adminAuditLog entry.
 */
@ApiTags('admin-orders')
@ApiBearerAuth()
@Controller('admin/orders')
@UseGuards(AdminJwtGuard, MustChangePasswordGuard, PermissionsGuard)
export class AdminOrdersController {
  constructor(
    private readonly service: AdminOrdersService,
    private readonly audit: AdminAuditService,
  ) {}

  private meta(req: Request) {
    return {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || '',
    };
  }

  @Get()
  @RequirePermissions('orders:view')
  @ApiOperation({ summary: 'List/search ALL orders (faceted filters)' })
  async list(@Query() query: ListOrdersAdminDto) {
    const data = await this.service.listOrders(query);
    return { success: true, data };
  }

  // Declared before `:id` to avoid path shadowing.
  @Get('checkout-groups/:checkoutGroupId')
  @RequirePermissions('orders:view')
  @ApiOperation({ summary: 'All sibling orders of one checkout group' })
  async checkoutGroup(@Param('checkoutGroupId') checkoutGroupId: string) {
    const data = await this.service.checkoutGroup(checkoutGroupId);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('orders:view')
  @ApiOperation({
    summary: 'Order detail (items, buyer, seller, payment, refunds, timeline)',
  })
  async detail(@Param('id') id: string) {
    const data = await this.service.orderDetail(id);
    return { success: true, data };
  }

  @Patch(':id/fulfillment')
  @RequirePermissions('orders:update')
  @ApiOperation({
    summary:
      'Override fulfillmentStatus (backward = corrective, note required, high-severity audit; earnings-locked guard)',
  })
  async overrideFulfillment(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: AdminFulfillmentDto,
    @Req() req: Request,
  ) {
    const { view, corrective, before } = await this.service.overrideFulfillment(
      id,
      dto,
      admin._id.toString(),
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: corrective
        ? 'orders.fulfillment.override'
        : 'orders.fulfillment.update',
      permission: 'orders:update',
      resource: 'orders',
      targetId: id,
      before: { fulfillmentStatus: before },
      after: {
        fulfillmentStatus: dto.fulfillmentStatus,
        note: dto.note || null,
        severity: corrective ? 'high' : 'normal',
      },
      ...this.meta(req),
    });
    return { success: true, data: view };
  }

  @Post(':id/cancel')
  @RequirePermissions('orders:update')
  @ApiOperation({
    summary:
      'Admin-cancel (reason required) — triggers the mandatory full wallet refund automatically',
  })
  async cancel(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: AdminCancelOrderDto,
    @Req() req: Request,
  ) {
    const data = await this.service.cancelOrder(id, dto, admin._id.toString());
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'orders.cancel',
      permission: 'orders:update',
      resource: 'orders',
      targetId: id,
      after: {
        reason: dto.reason,
        refund: data.refund,
        severity: 'high',
      },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Post(':id/refund')
  @RequirePermissions('orders:refund')
  @ApiOperation({
    summary:
      'Discretionary refund — full/partial, restock option, earnings clawback (Super-Admin-only, non-delegable)',
  })
  async refund(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: AdminRefundDto,
    @Req() req: Request,
  ) {
    const data = await this.service.refundOrder(id, dto, admin._id.toString());
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'orders.refund',
      permission: 'orders:refund',
      resource: 'orders',
      targetId: id,
      after: {
        reason: dto.reason,
        refund: data.refund,
        overrideWindow: Boolean(dto.overrideWindow),
        earningsAdjusted: data.earningsAdjusted,
        severity: 'high',
      },
      ...this.meta(req),
    });
    return { success: true, data };
  }
}
