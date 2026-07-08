import {
  Body,
  Controller,
  Delete,
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
import { AdminPermissionsService } from '../admin/admin-permissions.service';
import { hasPermission } from '../admin/permissions.util';
import { AdminEquipmentService } from './admin-equipment.service';
import { EquipmentService } from './equipment.service';
import {
  CreateEquipmentDto,
  ListEquipmentAdminDto,
  ScheduleMaintenanceDto,
  UpdateEquipmentDto,
} from './dto/admin-equipment.dto';
import {
  AdminCancelBookingDto,
  ApproveBookingDto,
  CompleteBookingDto,
  DepositDeductDto,
  DepositRefundDto,
  HandoverBookingDto,
  ListBookingsAdminDto,
  RejectBookingDto,
} from './dto/admin-booking.dto';
import {
  CreateGeofenceDto,
  UpdateGeofenceDto,
  UpdateRateConfigDto,
} from './dto/admin-gps.dto';

/**
 * Admin-plane equipment + booking + GPS API. Base path `/api/v1/admin/equipment`.
 * Guarded by the admin JWT, mustChangePassword gate, and per-route permissions.
 * Every mutation writes an `adminAuditLog` entry.
 */
@ApiTags('admin-equipment')
@ApiBearerAuth()
@Controller('admin/equipment')
@UseGuards(AdminJwtGuard, MustChangePasswordGuard, PermissionsGuard)
export class AdminEquipmentController {
  constructor(
    private readonly service: AdminEquipmentService,
    private readonly equipmentService: EquipmentService,
    private readonly audit: AdminAuditService,
    private readonly permissionsService: AdminPermissionsService,
  ) {}

  private meta(req: Request) {
    return {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || '',
    };
  }

  // ===========================================================================
  // GPS oversight (declared before `/:id` to avoid path shadowing)
  // ===========================================================================

  @Get('gps/live')
  @RequirePermissions('equipment:gps')
  @ApiOperation({
    summary: 'Live positions of all in-use equipment (fleet map)',
  })
  async gpsLive() {
    const data = await this.service.liveFleet();
    return { success: true, data };
  }

  @Get('gps/alerts')
  @RequirePermissions('equipment:gps')
  @ApiOperation({ summary: 'Geofence/overspeed/signal alerts (filterable)' })
  async gpsAlerts(@Query() query: Record<string, any>) {
    const data = await this.service.listAlerts(query);
    return { success: true, data };
  }

  @Post('gps/alerts/:id/ack')
  @RequirePermissions('equipment:gps')
  @ApiOperation({ summary: 'Acknowledge a GPS alert' })
  async ackAlert(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const data = await this.service.ackAlert(id, admin._id.toString());
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.gps.alert.ack',
      permission: 'equipment:gps',
      resource: 'equipment',
      targetId: id,
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Get('geofences')
  @RequirePermissions('equipment:view')
  @ApiOperation({ summary: 'List geofences' })
  async listGeofences() {
    const data = await this.service.listGeofences();
    return { success: true, data };
  }

  @Post('geofences')
  @RequirePermissions('equipment:configure')
  @ApiOperation({ summary: 'Create a geofence' })
  async createGeofence(
    @CurrentAdmin() admin: AdminUserDocument,
    @Body() dto: CreateGeofenceDto,
    @Req() req: Request,
  ) {
    const data = await this.service.createGeofence(admin._id.toString(), dto);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.geofence.create',
      permission: 'equipment:configure',
      resource: 'equipment',
      targetId: data.id,
      after: { name: data.name, type: data.type },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Patch('geofences/:id')
  @RequirePermissions('equipment:configure')
  @ApiOperation({ summary: 'Edit / toggle a geofence' })
  async updateGeofence(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: UpdateGeofenceDto,
    @Req() req: Request,
  ) {
    const result = await this.service.updateGeofence(id, dto);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.geofence.update',
      permission: 'equipment:configure',
      resource: 'equipment',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.after };
  }

  @Delete('geofences/:id')
  @RequirePermissions('equipment:configure')
  @ApiOperation({ summary: 'Delete a geofence' })
  async deleteGeofence(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.service.deleteGeofence(id);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.geofence.delete',
      permission: 'equipment:configure',
      resource: 'equipment',
      targetId: id,
      before: result.before,
      ...this.meta(req),
    });
    return { success: true, data: { deleted: true } };
  }

  // ===========================================================================
  // Rate config
  // ===========================================================================

  @Get('rate-config')
  @RequirePermissions('equipment:view')
  @ApiOperation({ summary: 'Read default rate config by category' })
  async rateConfig() {
    const data = await this.service.listRateConfig();
    return { success: true, data };
  }

  @Patch('rate-config/:category')
  @RequirePermissions('equipment:configure')
  @ApiOperation({ summary: 'Set default hourly/daily/deposit% for a category' })
  async updateRateConfig(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('category') category: string,
    @Body() dto: UpdateRateConfigDto,
    @Req() req: Request,
  ) {
    const result = await this.service.updateRateConfig(
      category,
      admin._id.toString(),
      dto,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.rate_config.update',
      permission: 'equipment:configure',
      resource: 'equipment',
      targetId: category,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.after };
  }

  // ===========================================================================
  // Bookings
  // ===========================================================================

  @Get('bookings')
  @RequirePermissions('equipment:view')
  @ApiOperation({ summary: 'List all bookings (filters/queues)' })
  async listBookings(@Query() query: ListBookingsAdminDto) {
    const data = await this.service.listBookings(query);
    return { success: true, data };
  }

  @Get('bookings/:id')
  @RequirePermissions('equipment:view')
  @ApiOperation({ summary: 'Booking detail + GPS trail + deposit ledger' })
  async bookingDetail(@Param('id') id: string) {
    const data = await this.service.getBooking(id);
    return { success: true, data };
  }

  @Get('bookings/:id/tracking')
  @RequirePermissions('equipment:gps')
  @ApiOperation({ summary: 'Full GPS trail for a booking (route playback)' })
  async bookingTracking(@Param('id') id: string) {
    const data = await this.equipmentService.getTracking(id, { isAdmin: true });
    return { success: true, data };
  }

  @Post('bookings/:id/approve')
  @RequirePermissions('equipment:approve')
  @ApiOperation({
    summary: 'Approve availability → APPROVED (issues trackingToken)',
  })
  async approve(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: ApproveBookingDto,
    @Req() req: Request,
  ) {
    const result = await this.service.approveBooking(
      id,
      admin._id.toString(),
      dto,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.booking.approve',
      permission: 'equipment:approve',
      resource: 'equipment',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.data };
  }

  @Post('bookings/:id/reject')
  @RequirePermissions('equipment:reject')
  @ApiOperation({
    summary: 'Reject a PENDING request → REJECTED (reason required)',
  })
  async reject(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
    @Req() req: Request,
  ) {
    const result = await this.service.rejectBooking(
      id,
      admin._id.toString(),
      dto.reason,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.booking.reject',
      permission: 'equipment:reject',
      resource: 'equipment',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.data };
  }

  @Post('bookings/:id/handover')
  @RequirePermissions('equipment:confirm')
  @ApiOperation({
    summary: 'Handover a CONFIRMED booking → IN_USE (GPS begins)',
  })
  async handover(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: HandoverBookingDto,
    @Req() req: Request,
  ) {
    const result = await this.service.handoverBooking(
      id,
      admin._id.toString(),
      dto,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.booking.handover',
      permission: 'equipment:confirm',
      resource: 'equipment',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.data };
  }

  @Post('bookings/:id/complete')
  @RequirePermissions('equipment:complete')
  @ApiOperation({
    summary:
      'Complete an IN_USE/OVERDUE booking (settle deposit; damage-over-deposit needs equipment:settle-deposit)',
  })
  async complete(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: CompleteBookingDto,
    @Req() req: Request,
  ) {
    // A damage deduction is a financial reversal → gate on equipment:settle-deposit.
    const effective =
      await this.permissionsService.getEffectivePermissions(admin);
    const canSettle = hasPermission(effective, 'equipment:settle-deposit');
    const result = await this.service.completeBooking(
      id,
      admin._id.toString(),
      dto,
      canSettle,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.booking.complete',
      permission: 'equipment:complete',
      resource: 'equipment',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.data };
  }

  @Post('bookings/:id/cancel')
  @RequirePermissions('equipment:cancel')
  @ApiOperation({ summary: 'Cancel a booking (reason required)' })
  async cancel(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: AdminCancelBookingDto,
    @Req() req: Request,
  ) {
    const result = await this.service.cancelBookingAdmin(
      id,
      admin._id.toString(),
      dto.reason,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.booking.cancel',
      permission: 'equipment:cancel',
      resource: 'equipment',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.data };
  }

  // ===========================================================================
  // Deposit settlement (Super-Admin-only via equipment:settle-deposit)
  // ===========================================================================

  @Post('bookings/:id/deposit/refund')
  @RequirePermissions('equipment:settle-deposit')
  @ApiOperation({ summary: 'Refund deposit (or remainder) to the user wallet' })
  async refundDeposit(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: DepositRefundDto,
    @Req() req: Request,
  ) {
    const result = await this.service.refundDeposit(
      id,
      admin._id.toString(),
      dto.amount,
      dto.reason,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.deposit.refund',
      permission: 'equipment:settle-deposit',
      resource: 'equipment',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.data };
  }

  @Post('bookings/:id/deposit/deduct')
  @RequirePermissions('equipment:settle-deposit')
  @ApiOperation({ summary: 'Record a damage deduction against the deposit' })
  async deductDeposit(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: DepositDeductDto,
    @Req() req: Request,
  ) {
    const result = await this.service.deductDeposit(
      id,
      admin._id.toString(),
      dto.amount,
      dto.description,
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.deposit.deduct',
      permission: 'equipment:settle-deposit',
      resource: 'equipment',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.data };
  }

  // ===========================================================================
  // Per-unit GPS + Maintenance
  // ===========================================================================

  @Get(':id/gps/live')
  @RequirePermissions('equipment:gps')
  @ApiOperation({ summary: 'Live position for one unit' })
  async gpsLiveForUnit(@Param('id') id: string) {
    const data = await this.service.liveForEquipment(id);
    return { success: true, data };
  }

  @Post(':id/maintenance')
  @RequirePermissions('equipment:maintenance')
  @ApiOperation({ summary: 'Schedule maintenance (blocks availability)' })
  async scheduleMaintenance(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: ScheduleMaintenanceDto,
    @Req() req: Request,
  ) {
    const data = await this.service.scheduleMaintenance(id, dto);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.maintenance.schedule',
      permission: 'equipment:maintenance',
      resource: 'equipment',
      targetId: id,
      after: { type: dto.type, dueDate: dto.dueDate, blockNow: !!dto.blockNow },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Get(':id/maintenance')
  @RequirePermissions('equipment:view')
  @ApiOperation({ summary: 'Maintenance schedule / history' })
  async listMaintenance(@Param('id') id: string) {
    const data = await this.service.listMaintenance(id);
    return { success: true, data };
  }

  @Patch(':id/maintenance/:mIndex/complete')
  @RequirePermissions('equipment:maintenance')
  @ApiOperation({ summary: 'Mark a maintenance item completed' })
  async completeMaintenance(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Param('mIndex') mIndex: string,
    @Req() req: Request,
  ) {
    const data = await this.service.completeMaintenance(
      id,
      parseInt(mIndex, 10),
    );
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.maintenance.complete',
      permission: 'equipment:maintenance',
      resource: 'equipment',
      targetId: id,
      after: { mIndex: parseInt(mIndex, 10) },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  // ===========================================================================
  // Equipment fleet CRUD (declared last — `/:id` catch-all)
  // ===========================================================================

  @Get()
  @RequirePermissions('equipment:view')
  @ApiOperation({ summary: 'List/search the equipment fleet' })
  async listEquipment(@Query() query: ListEquipmentAdminDto) {
    const data = await this.service.listEquipment(query);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('equipment:create')
  @ApiOperation({ summary: 'Add equipment (rich form)' })
  async createEquipment(
    @CurrentAdmin() admin: AdminUserDocument,
    @Body() dto: CreateEquipmentDto,
    @Req() req: Request,
  ) {
    const data = await this.service.createEquipment(dto);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.create',
      permission: 'equipment:create',
      resource: 'equipment',
      targetId: data.id,
      after: { name: data.name, category: data.category },
      ...this.meta(req),
    });
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('equipment:view')
  @ApiOperation({ summary: 'Equipment detail (specs, status, bookings, GPS)' })
  async equipmentDetail(@Param('id') id: string) {
    const data = await this.service.getEquipmentDetail(id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('equipment:update')
  @ApiOperation({ summary: 'Update equipment fields' })
  async updateEquipment(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
    @Req() req: Request,
  ) {
    const result = await this.service.updateEquipment(id, dto);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.update',
      permission: 'equipment:update',
      resource: 'equipment',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: result.after };
  }

  @Delete(':id')
  @RequirePermissions('equipment:delete')
  @ApiOperation({ summary: 'Retire equipment (status=RETIRED)' })
  async deleteEquipment(
    @CurrentAdmin() admin: AdminUserDocument,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.service.retireEquipment(id);
    await this.audit.record({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'equipment.retire',
      permission: 'equipment:delete',
      resource: 'equipment',
      targetId: id,
      before: result.before,
      after: result.after,
      ...this.meta(req),
    });
    return { success: true, data: { retired: true } };
  }
}
