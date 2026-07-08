import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { Equipment, EquipmentDocument } from './schemas/equipment.schema';
import {
  EquipmentBooking,
  EquipmentBookingDocument,
} from './schemas/equipment-booking.schema';
import {
  EquipmentRateConfig,
  EquipmentRateConfigDocument,
} from './schemas/equipment-rate-config.schema';
import { Geofence, GeofenceDocument } from './schemas/geofence.schema';
import { GpsAlert, GpsAlertDocument } from './schemas/gps-alert.schema';
import { WalletService } from '../wallet/wallet.service';
import { NotificationService } from '../notifications/notification.service';
import { EquipmentService } from './equipment.service';
import { EquipmentAdminException } from './equipment.errors';
import { serialize } from './equipment.serializer';

@Injectable()
export class AdminEquipmentService {
  private readonly logger = new Logger(AdminEquipmentService.name);

  constructor(
    @InjectModel(Equipment.name)
    private readonly equipmentModel: Model<EquipmentDocument>,
    @InjectModel(EquipmentBooking.name)
    private readonly bookingModel: Model<EquipmentBookingDocument>,
    @InjectModel(EquipmentRateConfig.name)
    private readonly rateConfigModel: Model<EquipmentRateConfigDocument>,
    @InjectModel(Geofence.name)
    private readonly geofenceModel: Model<GeofenceDocument>,
    @InjectModel(GpsAlert.name)
    private readonly gpsAlertModel: Model<GpsAlertDocument>,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly equipmentService: EquipmentService,
    private readonly configService: ConfigService,
  ) {}

  private cfg<T = any>(path: string, fallback: T): T {
    const v = this.configService.get<T>(`configuration.equipment.${path}`);
    return v === undefined || v === null ? fallback : v;
  }

  private genRef(prefix: string): string {
    return `${prefix}${Date.now()}${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private eqOid(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new EquipmentAdminException('EQP_ADM_001', HttpStatus.NOT_FOUND);
    }
    return new Types.ObjectId(id);
  }

  private bkOid(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new EquipmentAdminException('EQP_ADM_002', HttpStatus.NOT_FOUND);
    }
    return new Types.ObjectId(id);
  }

  // ===========================================================================
  // Equipment fleet CRUD
  // ===========================================================================

  async createEquipment(
    dto: Record<string, any>,
  ): Promise<Record<string, any>> {
    // Pre-fill unset rates/deposit from rate-config for the category.
    const rc = await this.rateConfigModel
      .findOne({ category: dto.category })
      .lean();
    const doc: Record<string, any> = {
      ...dto,
      cooperativeId: dto.cooperativeId
        ? new Types.ObjectId(dto.cooperativeId)
        : undefined,
      hourlyRate: dto.hourlyRate ?? rc?.defaultHourlyRate ?? 0,
      dailyRate: dto.dailyRate ?? rc?.defaultDailyRate ?? 0,
    };
    if (dto.depositRequired == null && rc) {
      // Deposit floor from config when not provided (percent applied at booking
      // time uses the per-unit depositRequired, so seed a sensible floor here).
      doc.depositRequired = rc.minDepositNgn ?? 0;
    }
    const created = await this.equipmentModel.create(doc);
    return serialize(created);
  }

  async updateEquipment(
    id: string,
    dto: Record<string, any>,
  ): Promise<{ before: Record<string, any>; after: Record<string, any> }> {
    const equipment = await this.equipmentModel.findById(this.eqOid(id));
    if (!equipment) {
      throw new EquipmentAdminException('EQP_ADM_001', HttpStatus.NOT_FOUND);
    }
    const before = serialize<any>(equipment.toObject());
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined) continue;
      if (k === 'gpsTracker') {
        equipment.gpsTracker = { ...equipment.gpsTracker, ...(v as any) };
      } else {
        (equipment as any)[k] = v;
      }
    }
    await equipment.save();
    return { before, after: serialize(equipment) };
  }

  async retireEquipment(
    id: string,
  ): Promise<{ before: Record<string, any>; after: Record<string, any> }> {
    const equipment = await this.equipmentModel.findById(this.eqOid(id));
    if (!equipment) {
      throw new EquipmentAdminException('EQP_ADM_001', HttpStatus.NOT_FOUND);
    }
    const active = await this.bookingModel.countDocuments({
      equipmentId: equipment._id,
      status: { $in: ['APPROVED', 'CONFIRMED', 'IN_USE', 'OVERDUE'] },
    });
    if (active > 0) {
      throw new EquipmentAdminException('EQP_ADM_007', HttpStatus.CONFLICT, {
        activeBookings: active,
      });
    }
    const before = { status: equipment.status };
    equipment.status = 'RETIRED';
    await equipment.save();
    return { before, after: { status: 'RETIRED' } };
  }

  async listEquipment(
    filters: Record<string, any>,
  ): Promise<Record<string, any>> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (filters.q) {
      query.$or = [
        { name: { $regex: filters.q, $options: 'i' } },
        { model: { $regex: filters.q, $options: 'i' } },
        { serialNumber: { $regex: filters.q, $options: 'i' } },
      ];
    }
    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    if (filters.cooperativeId && Types.ObjectId.isValid(filters.cooperativeId))
      query.cooperativeId = new Types.ObjectId(filters.cooperativeId);
    if (filters.gpsActive === 'true') query['gpsTracker.isActive'] = true;
    if (filters.gpsActive === 'false') query['gpsTracker.isActive'] = false;
    if (filters.dueForMaintenance === 'true') {
      query.maintenanceSchedule = {
        $elemMatch: {
          completedAt: { $exists: false },
          dueDate: { $lte: new Date() },
        },
      };
    }

    const sortField =
      filters.sortBy === 'bookingHistory' ? 'bookingHistory' : 'createdAt';
    const sortDir = filters.order === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.equipmentModel
        .find(query)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.equipmentModel.countDocuments(query),
    ]);
    return { items: items.map((e) => serialize(e)), total, page, limit };
  }

  async getEquipmentDetail(id: string): Promise<Record<string, any>> {
    const equipment = await this.equipmentModel.findById(this.eqOid(id)).lean();
    if (!equipment) {
      throw new EquipmentAdminException('EQP_ADM_001', HttpStatus.NOT_FOUND);
    }
    const bookings = await this.bookingModel
      .find({ equipmentId: equipment._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return {
      ...serialize<any>(equipment),
      recentBookings: bookings.map((b) => serialize(b)),
    };
  }

  // ===========================================================================
  // Maintenance
  // ===========================================================================

  async scheduleMaintenance(
    id: string,
    dto: { type: string; dueDate: string; notes?: string; blockNow?: boolean },
  ): Promise<Record<string, any>> {
    const equipment = await this.equipmentModel.findById(this.eqOid(id));
    if (!equipment) {
      throw new EquipmentAdminException('EQP_ADM_001', HttpStatus.NOT_FOUND);
    }
    const dueDate = new Date(dto.dueDate);
    // A blocking window may not overlap a CONFIRMED/IN_USE booking.
    if (dto.blockNow) {
      const conflict = await this.bookingModel.findOne({
        equipmentId: equipment._id,
        status: { $in: ['CONFIRMED', 'IN_USE', 'OVERDUE'] },
        startDate: { $lte: dueDate },
        endDate: { $gte: new Date() },
      });
      if (conflict) {
        throw new EquipmentAdminException('EQP_ADM_006', HttpStatus.CONFLICT, {
          conflictBookingId: conflict._id.toString(),
        });
      }
    }
    equipment.maintenanceSchedule.push({
      type: dto.type,
      dueDate,
      notes: dto.notes || '',
    } as any);
    if (dto.blockNow) {
      equipment.status = 'MAINTENANCE';
    }
    await equipment.save();
    return serialize(equipment);
  }

  async listMaintenance(id: string): Promise<Record<string, any>> {
    const equipment = await this.equipmentModel
      .findById(this.eqOid(id))
      .select('maintenanceSchedule status name')
      .lean();
    if (!equipment) {
      throw new EquipmentAdminException('EQP_ADM_001', HttpStatus.NOT_FOUND);
    }
    return serialize(equipment);
  }

  async completeMaintenance(
    id: string,
    mIndex: number,
  ): Promise<Record<string, any>> {
    const equipment = await this.equipmentModel.findById(this.eqOid(id));
    if (!equipment) {
      throw new EquipmentAdminException('EQP_ADM_001', HttpStatus.NOT_FOUND);
    }
    const entry = equipment.maintenanceSchedule[mIndex];
    if (!entry) {
      throw new EquipmentAdminException('EQP_ADM_009', HttpStatus.BAD_REQUEST, {
        reason: 'maintenance index out of range',
      });
    }
    entry.completedAt = new Date();
    // If no other open maintenance, free the unit.
    const stillBlocked = equipment.maintenanceSchedule.some(
      (m, i) => i !== mIndex && !m.completedAt && m.dueDate <= new Date(),
    );
    if (equipment.status === 'MAINTENANCE' && !stillBlocked) {
      equipment.status = 'AVAILABLE';
    }
    await equipment.save();
    return serialize(equipment);
  }

  // ===========================================================================
  // Booking management
  // ===========================================================================

  async listBookings(
    filters: Record<string, any>,
  ): Promise<Record<string, any>> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (filters.equipmentId && Types.ObjectId.isValid(filters.equipmentId))
      query.equipmentId = new Types.ObjectId(filters.equipmentId);
    if (filters.userId && Types.ObjectId.isValid(filters.userId))
      query.userId = new Types.ObjectId(filters.userId);
    if (filters.status) query.status = filters.status;
    if (filters.awaitingPayment === 'true') query.status = 'APPROVED';
    if (filters.overdue === 'true') query.status = 'OVERDUE';
    if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
    if (filters.startDate || filters.endDate) {
      query.startDate = {};
      if (filters.startDate) query.startDate.$gte = new Date(filters.startDate);
      if (filters.endDate) query.startDate.$lte = new Date(filters.endDate);
    }

    const [items, total] = await Promise.all([
      this.bookingModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.bookingModel.countDocuments(query),
    ]);
    return {
      items: await this.equipmentService.publicDecorateBookings(items),
      total,
      page,
      limit,
    };
  }

  async getBooking(id: string): Promise<Record<string, any>> {
    const booking = await this.bookingModel.findById(this.bkOid(id));
    if (!booking) {
      throw new EquipmentAdminException('EQP_ADM_002', HttpStatus.NOT_FOUND);
    }
    return this.equipmentService.publicDecorateBooking(booking);
  }

  private async loadBooking(id: string): Promise<EquipmentBookingDocument> {
    const booking = await this.bookingModel.findById(this.bkOid(id));
    if (!booking) {
      throw new EquipmentAdminException('EQP_ADM_002', HttpStatus.NOT_FOUND);
    }
    return booking;
  }

  async approveBooking(
    id: string,
    adminId: string,
    dto: {
      operatorName?: string;
      operatorPhone?: string;
      operatorPlate?: string;
      note?: string;
    },
  ): Promise<{ before: any; after: any; data: Record<string, any> }> {
    const booking = await this.loadBooking(id);
    if (booking.status !== 'PENDING') {
      throw new EquipmentAdminException('EQP_ADM_015', HttpStatus.CONFLICT, {
        status: booking.status,
      });
    }
    const before = { status: booking.status };

    const token = this.equipmentService.publicGenTrackingToken();
    const expires = new Date(booking.endDate.getTime() + 24 * 60 * 60 * 1000); // window + 24h grace

    booking.status = 'APPROVED';
    booking.approvedBy = new Types.ObjectId(adminId);
    booking.approvedAt = new Date();
    booking.trackingToken = token;
    booking.trackingTokenIssuedAt = new Date();
    booking.trackingTokenExpiresAt = expires;
    if (dto.operatorName !== undefined) booking.operatorName = dto.operatorName;
    if (dto.operatorPhone !== undefined)
      booking.operatorPhone = dto.operatorPhone;
    if (dto.operatorPlate !== undefined)
      booking.operatorPlate = dto.operatorPlate;
    if (dto.note) booking.notes = dto.note;
    await booking.save();

    this.equipmentService.publicNotifyUser(
      booking.userId.toString(),
      'equipment.booking.approved',
      'success',
      'Booking approved — pay to confirm',
      `Your booking ${booking.bookingReference} is approved. Pay ₦${booking.totalCost.toLocaleString()} from your wallet to confirm.`,
      {
        bookingId: booking._id.toString(),
        link: `/equipment/bookings/${booking._id}`,
      },
    );

    return {
      before,
      after: { status: 'APPROVED', trackingTokenIssued: true },
      data: {
        bookingId: booking._id.toString(),
        status: booking.status,
        trackingToken: token,
        trackingTokenExpiresAt: expires,
      },
    };
  }

  async rejectBooking(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<{ before: any; after: any; data: Record<string, any> }> {
    const booking = await this.loadBooking(id);
    if (booking.status !== 'PENDING') {
      throw new EquipmentAdminException('EQP_ADM_015', HttpStatus.CONFLICT, {
        status: booking.status,
      });
    }
    if (!reason || !reason.trim()) {
      throw new EquipmentAdminException('EQP_ADM_013', HttpStatus.BAD_REQUEST);
    }
    const before = { status: booking.status };
    booking.status = 'REJECTED';
    booking.rejectedBy = new Types.ObjectId(adminId);
    booking.rejectionReason = reason;
    booking.trackingToken = undefined;
    await booking.save();

    this.equipmentService.publicNotifyUser(
      booking.userId.toString(),
      'equipment.booking.rejected',
      'warning',
      'Booking rejected',
      `Your booking ${booking.bookingReference} was rejected: ${reason}`,
      {
        bookingId: booking._id.toString(),
        link: `/equipment/bookings/${booking._id}`,
      },
    );

    return {
      before,
      after: { status: 'REJECTED', reason },
      data: { bookingId: booking._id.toString(), status: 'REJECTED' },
    };
  }

  async handoverBooking(
    id: string,
    adminId: string,
    dto: {
      actualStartDate?: string;
      operatorName?: string;
      operatorPhone?: string;
      operatorPlate?: string;
      note?: string;
    },
  ): Promise<{ before: any; after: any; data: Record<string, any> }> {
    const booking = await this.loadBooking(id);
    if (booking.status !== 'CONFIRMED') {
      throw new EquipmentAdminException('EQP_ADM_010', HttpStatus.CONFLICT, {
        status: booking.status,
      });
    }
    // Re-check the conflict at handover.
    const conflict = await this.equipmentService.publicFindConflict(
      booking.equipmentId,
      booking.startDate,
      booking.endDate,
      booking._id,
    );
    if (conflict) {
      throw new EquipmentAdminException('EQP_ADM_005', HttpStatus.CONFLICT, {
        conflictBookingId: conflict,
      });
    }
    const before = { status: booking.status };
    booking.status = 'IN_USE';
    booking.actualStartDate = dto.actualStartDate
      ? new Date(dto.actualStartDate)
      : new Date();
    if (dto.operatorName !== undefined) booking.operatorName = dto.operatorName;
    if (dto.operatorPhone !== undefined)
      booking.operatorPhone = dto.operatorPhone;
    if (dto.operatorPlate !== undefined)
      booking.operatorPlate = dto.operatorPlate;
    // (Re)issue the tracking token if missing.
    if (!booking.trackingToken) {
      booking.trackingToken = this.equipmentService.publicGenTrackingToken();
      booking.trackingTokenIssuedAt = new Date();
      booking.trackingTokenExpiresAt = new Date(
        booking.endDate.getTime() + 24 * 60 * 60 * 1000,
      );
    }
    await booking.save();

    // Mark the tracker active for live GPS.
    await this.equipmentModel.updateOne(
      { _id: booking.equipmentId },
      { $set: { 'gpsTracker.isActive': true } },
    );

    this.equipmentService.publicNotifyUser(
      booking.userId.toString(),
      'equipment.booking.in_use',
      'info',
      'Equipment handed over',
      `Your booking ${booking.bookingReference} is now in use. Live tracking is available.`,
      {
        bookingId: booking._id.toString(),
        link: `/equipment/bookings/${booking._id}`,
      },
    );

    return {
      before,
      after: { status: 'IN_USE' },
      data: {
        bookingId: booking._id.toString(),
        status: 'IN_USE',
        trackingToken: booking.trackingToken,
      },
    };
  }

  /**
   * Complete an IN_USE/OVERDUE booking. Settles the deposit portion of the
   * already-paid full cost. Damage/overdue over deposit → outstandingCharge.
   * Idempotent on `refundRef` (deposit:{bookingId}).
   */
  async completeBooking(
    id: string,
    adminId: string,
    dto: {
      actualEndDate?: string;
      returnLocation?: { lat: number; lng: number; address?: string };
      condition?: 'OK' | 'DAMAGED';
      damageReport?: { description: string; costEstimate: number };
      usageHours?: number;
    },
    canSettleDeposit: boolean,
  ): Promise<{ before: any; after: any; data: Record<string, any> }> {
    const booking = await this.loadBooking(id);
    if (!['IN_USE', 'OVERDUE'].includes(booking.status)) {
      throw new EquipmentAdminException('EQP_ADM_004', HttpStatus.CONFLICT, {
        status: booking.status,
      });
    }
    const before = {
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    };

    const D = booking.depositAmount || 0;
    const damageEstimate = dto.damageReport?.costEstimate || 0;
    if (dto.damageReport && damageEstimate <= 0) {
      throw new EquipmentAdminException('EQP_ADM_009', HttpStatus.BAD_REQUEST);
    }

    // Overdue charges.
    const endDate = booking.endDate;
    const actualEnd = dto.actualEndDate
      ? new Date(dto.actualEndDate)
      : new Date();
    const overdueFeePerDay = this.cfg('overdueFeePerDay', 0);
    const overdueDays =
      actualEnd.getTime() > endDate.getTime()
        ? Math.ceil(
            (actualEnd.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;
    const overdueCharges = overdueDays * overdueFeePerDay;

    const damageDeducted = Math.min(damageEstimate, D);
    const totalDeductions = Math.min(damageDeducted + overdueCharges, D);
    const depositRefunded = Math.max(D - totalDeductions, 0);
    const outstandingCharge =
      Math.max(damageEstimate - D, 0) +
      Math.max(overdueCharges - (D - damageDeducted), 0);

    // A damage deduction that reduces the refund is a financial reversal → gated
    // to super-admin (equipment:settle-deposit). A clean full refund is allowed
    // under equipment:complete.
    if ((damageDeducted > 0 || outstandingCharge > 0) && !canSettleDeposit) {
      throw new EquipmentAdminException('EQP_ADM_014', HttpStatus.FORBIDDEN, {
        requiredPermission: 'equipment:settle-deposit',
      });
    }

    // Refund the deposit remainder to the user's wallet (idempotent).
    let refundRef: string | undefined = booking.refundRef;
    if (depositRefunded > 0) {
      refundRef = booking.refundRef || `deposit:${booking._id.toString()}`;
      await this.walletService.creditRefund(booking.userId.toString(), {
        amount: depositRefunded,
        reference: refundRef,
        description: `Deposit refund — booking ${booking.bookingReference}`,
        category: 'REFUND',
        metadata: { bookingId: booking._id.toString() },
      });
    }

    booking.status = 'COMPLETED';
    booking.paymentStatus = 'REFUNDED';
    booking.actualEndDate = actualEnd;
    booking.returnLocation = dto.returnLocation as any;
    booking.overdueCharges = overdueCharges;
    booking.outstandingCharge = outstandingCharge;
    if (refundRef) booking.refundRef = refundRef;
    if (dto.damageReport) {
      booking.damageReport = {
        description: dto.damageReport.description,
        costEstimate: damageEstimate,
        deductedFromDeposit: damageDeducted,
      } as any;
    }
    // Revoke tracking token.
    booking.trackingToken = undefined;
    await booking.save();

    // Free the equipment (MAINTENANCE if damaged).
    const nextStatus =
      dto.condition === 'DAMAGED' || damageEstimate > 0
        ? 'MAINTENANCE'
        : 'AVAILABLE';
    await this.equipmentModel.updateOne(
      { _id: booking.equipmentId },
      {
        $set: { status: nextStatus, 'gpsTracker.isActive': false },
        $inc: { bookingHistory: 1 },
      },
    );

    this.equipmentService.publicNotifyUser(
      booking.userId.toString(),
      'equipment.booking.completed',
      'success',
      'Booking completed',
      depositRefunded > 0
        ? `Your booking ${booking.bookingReference} is complete. ₦${depositRefunded.toLocaleString()} deposit refunded to your wallet.`
        : `Your booking ${booking.bookingReference} is complete.`,
      {
        bookingId: booking._id.toString(),
        link: `/equipment/bookings/${booking._id}`,
      },
    );

    return {
      before,
      after: {
        status: 'COMPLETED',
        depositRefunded,
        damageDeducted,
        outstandingCharge,
      },
      data: {
        bookingId: booking._id.toString(),
        status: 'COMPLETED',
        totalPaid: booking.amountPaid,
        depositPortion: D,
        damageDeducted,
        overdueCharges,
        depositRefunded,
        outstandingCharge,
        refundTxnRef: refundRef || null,
      },
    };
  }

  async cancelBookingAdmin(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<{ before: any; after: any; data: Record<string, any> }> {
    if (!reason || !reason.trim()) {
      throw new EquipmentAdminException('EQP_ADM_013', HttpStatus.BAD_REQUEST);
    }
    const booking = await this.loadBooking(id);
    const result = await this.equipmentService.performCancel(booking, reason, {
      actor: 'admin',
      adminId,
    });
    return {
      before: result._before,
      after: { status: 'CANCELLED', refund: result.refund || null },
      data: result,
    };
  }

  // ===========================================================================
  // Deposit settlement (standalone; super-admin)
  // ===========================================================================

  async refundDeposit(
    id: string,
    adminId: string,
    amount?: number,
    reason?: string,
  ): Promise<{ before: any; after: any; data: Record<string, any> }> {
    const booking = await this.loadBooking(id);
    const D = booking.depositAmount || 0;
    const already = booking.damageReport?.deductedFromDeposit || 0;
    const refundable = amount != null ? amount : Math.max(D - already, 0);
    if (refundable <= 0) {
      throw new EquipmentAdminException('EQP_ADM_008', HttpStatus.CONFLICT);
    }
    const ref = `deposit-adj:${booking._id.toString()}:${Date.now()}`;
    const credited = await this.walletService.creditRefund(
      booking.userId.toString(),
      {
        amount: refundable,
        reference: ref,
        description: `Deposit adjustment refund — booking ${booking.bookingReference}`,
        category: 'REFUND',
        metadata: { bookingId: booking._id.toString(), reason },
      },
    );
    booking.refundRef = credited.reference;
    if (booking.paymentStatus === 'PAID') booking.paymentStatus = 'REFUNDED';
    await booking.save();
    return {
      before: { refundRef: null },
      after: { refundRef: credited.reference, amount: refundable },
      data: {
        bookingId: booking._id.toString(),
        refunded: refundable,
        ref: credited.reference,
      },
    };
  }

  async deductDeposit(
    id: string,
    adminId: string,
    amount: number,
    description: string,
  ): Promise<{ before: any; after: any; data: Record<string, any> }> {
    const booking = await this.loadBooking(id);
    if (amount <= 0) {
      throw new EquipmentAdminException('EQP_ADM_009', HttpStatus.BAD_REQUEST);
    }
    const D = booking.depositAmount || 0;
    const deducted = Math.min(amount, D);
    const outstanding = Math.max(amount - D, 0);
    const before = { damageReport: booking.damageReport || null };
    booking.damageReport = {
      description,
      costEstimate: amount,
      deductedFromDeposit: deducted,
    } as any;
    booking.outstandingCharge = (booking.outstandingCharge || 0) + outstanding;
    await booking.save();
    return {
      before,
      after: { deducted, outstanding },
      data: {
        bookingId: booking._id.toString(),
        deductedFromDeposit: deducted,
        outstandingCharge: booking.outstandingCharge,
      },
    };
  }

  // ===========================================================================
  // GPS oversight
  // ===========================================================================

  async liveFleet(): Promise<Record<string, any>> {
    const bookings = await this.bookingModel
      .find({
        status: { $in: ['IN_USE', 'OVERDUE'] },
        currentPosition: { $ne: null },
      })
      .select(
        'equipmentId bookingReference currentPosition operatorName operatorPlate status userId',
      )
      .lean();
    const decorated =
      await this.equipmentService.publicDecorateBookings(bookings);
    return { items: decorated, total: decorated.length };
  }

  async liveForEquipment(id: string): Promise<Record<string, any>> {
    const equipment = await this.equipmentModel.findById(this.eqOid(id)).lean();
    if (!equipment) {
      throw new EquipmentAdminException('EQP_ADM_001', HttpStatus.NOT_FOUND);
    }
    const booking = await this.bookingModel
      .findOne({
        equipmentId: equipment._id,
        status: { $in: ['IN_USE', 'OVERDUE'] },
      })
      .sort({ createdAt: -1 })
      .lean();
    if (!booking || !booking.currentPosition) {
      throw new EquipmentAdminException('EQP_ADM_011', HttpStatus.NOT_FOUND);
    }
    return serialize(booking);
  }

  async listAlerts(filters: {
    page?: number;
    limit?: number;
    type?: string;
    acknowledged?: string;
    equipmentId?: string;
  }): Promise<Record<string, any>> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;
    const query: Record<string, any> = {};
    if (filters.type) query.type = filters.type;
    if (filters.acknowledged === 'true') query.acknowledgedAt = { $ne: null };
    if (filters.acknowledged === 'false') query.acknowledgedAt = null;
    if (filters.equipmentId && Types.ObjectId.isValid(filters.equipmentId))
      query.equipmentId = new Types.ObjectId(filters.equipmentId);

    const [items, total] = await Promise.all([
      this.gpsAlertModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.gpsAlertModel.countDocuments(query),
    ]);
    return { items: items.map((a) => serialize(a)), total, page, limit };
  }

  async ackAlert(id: string, adminId: string): Promise<Record<string, any>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new EquipmentAdminException('EQP_ADM_011', HttpStatus.NOT_FOUND);
    }
    const alert = await this.gpsAlertModel.findById(new Types.ObjectId(id));
    if (!alert) {
      throw new EquipmentAdminException('EQP_ADM_011', HttpStatus.NOT_FOUND);
    }
    alert.acknowledgedBy = new Types.ObjectId(adminId);
    alert.acknowledgedAt = new Date();
    await alert.save();
    return serialize(alert);
  }

  // ===========================================================================
  // Geofences
  // ===========================================================================

  async listGeofences(): Promise<Record<string, any>> {
    const items = await this.geofenceModel
      .find()
      .sort({ createdAt: -1 })
      .lean();
    return { items: items.map((g) => serialize(g)), total: items.length };
  }

  private validateGeofence(dto: Record<string, any>): void {
    if (dto.type === 'CIRCLE') {
      if (!dto.center || !dto.radiusMeters || dto.radiusMeters <= 0) {
        throw new EquipmentAdminException(
          'EQP_ADM_012',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    if (dto.type === 'POLYGON') {
      if (!Array.isArray(dto.polygon) || dto.polygon.length < 3) {
        throw new EquipmentAdminException(
          'EQP_ADM_012',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  async createGeofence(
    adminId: string,
    dto: Record<string, any>,
  ): Promise<Record<string, any>> {
    this.validateGeofence(dto);
    const created = await this.geofenceModel.create({
      ...dto,
      appliesTo: dto.appliesTo || 'ALL',
      equipmentIds: (dto.equipmentIds || []).map(
        (e: string) => new Types.ObjectId(e),
      ),
      createdBy: new Types.ObjectId(adminId),
    });
    return serialize(created);
  }

  async updateGeofence(
    id: string,
    dto: Record<string, any>,
  ): Promise<{ before: any; after: any }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new EquipmentAdminException('EQP_ADM_012', HttpStatus.NOT_FOUND);
    }
    const geofence = await this.geofenceModel.findById(new Types.ObjectId(id));
    if (!geofence) {
      throw new EquipmentAdminException('EQP_ADM_012', HttpStatus.NOT_FOUND);
    }
    const before = serialize<any>(geofence.toObject());
    const merged = { ...before, ...dto };
    if (dto.type || dto.center || dto.radiusMeters || dto.polygon) {
      this.validateGeofence(merged);
    }
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined) continue;
      if (k === 'equipmentIds') {
        geofence.equipmentIds = (v as string[]).map(
          (e) => new Types.ObjectId(e),
        );
      } else {
        (geofence as any)[k] = v;
      }
    }
    await geofence.save();
    return { before, after: serialize(geofence) };
  }

  async deleteGeofence(id: string): Promise<{ before: any }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new EquipmentAdminException('EQP_ADM_012', HttpStatus.NOT_FOUND);
    }
    const geofence = await this.geofenceModel.findByIdAndDelete(
      new Types.ObjectId(id),
    );
    if (!geofence) {
      throw new EquipmentAdminException('EQP_ADM_012', HttpStatus.NOT_FOUND);
    }
    return { before: serialize(geofence) };
  }

  // ===========================================================================
  // Rate config
  // ===========================================================================

  async listRateConfig(): Promise<Record<string, any>> {
    const items = await this.rateConfigModel.find().lean();
    return { items: items.map((r) => serialize(r)), total: items.length };
  }

  async updateRateConfig(
    category: string,
    adminId: string,
    dto: Record<string, any>,
  ): Promise<{ before: any; after: any }> {
    const existing = await this.rateConfigModel.findOne({ category });
    const before = existing ? serialize<any>(existing.toObject()) : null;
    const updated = await this.rateConfigModel.findOneAndUpdate(
      { category },
      {
        $set: {
          ...dto,
          category,
          updatedBy: new Types.ObjectId(adminId),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return { before, after: serialize(updated) };
  }
}
