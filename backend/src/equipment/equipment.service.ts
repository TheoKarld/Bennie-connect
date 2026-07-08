import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection, Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { Equipment, EquipmentDocument } from './schemas/equipment.schema';
import {
  EquipmentBooking,
  EquipmentBookingDocument,
  BookingStatus,
} from './schemas/equipment-booking.schema';
import { WalletService } from '../wallet/wallet.service';
import { NotificationService } from '../notifications/notification.service';
import { UsersService } from '../users/users.service';
import { EquipmentException } from './equipment.errors';
import { serialize } from './equipment.serializer';

/** Statuses that block a unit for a window (availability conflict). */
const BLOCKING_STATUSES: BookingStatus[] = [
  'APPROVED',
  'CONFIRMED',
  'IN_USE',
  'OVERDUE',
];

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Equipment.name)
    private readonly equipmentModel: Model<EquipmentDocument>,
    @InjectModel(EquipmentBooking.name)
    private readonly bookingModel: Model<EquipmentBookingDocument>,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private cfg<T = any>(path: string, fallback: T): T {
    const v = this.configService.get<T>(`configuration.equipment.${path}`);
    return v === undefined || v === null ? fallback : v;
  }

  private genRef(prefix: string): string {
    return `${prefix}${Date.now()}${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private genTrackingToken(): string {
    return `trk_${randomBytes(24).toString('hex')}`;
  }

  private oid(id: string, code: 'EQP_001' | 'EQP_002'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new EquipmentException(code, HttpStatus.NOT_FOUND);
    }
    return new Types.ObjectId(id);
  }

  /** Hours (rounded up, min 1) between two dates. */
  private durationHours(start: Date, end: Date): number {
    const ms = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
  }

  /** Calendar days (rounded up, min 1) between two dates. */
  private durationDays(start: Date, end: Date): number {
    const ms = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  private computeRentalCost(
    equipment: EquipmentDocument,
    start: Date,
    end: Date,
    rateType: 'HOURLY' | 'DAILY',
  ): number {
    if (rateType === 'HOURLY') {
      return Math.round(this.durationHours(start, end) * equipment.hourlyRate);
    }
    return Math.round(this.durationDays(start, end) * equipment.dailyRate);
  }

  /**
   * Denormalize a booking for API responses: `_id → id`, plus the equipment
   * name/category and an operator object the frontends expect.
   */
  private async decorateBooking(
    booking: EquipmentBookingDocument | any,
  ): Promise<Record<string, any>> {
    const plain = serialize<any>(booking);
    const equipment = await this.equipmentModel
      .findById(plain.equipmentId)
      .select('name category images')
      .lean();
    if (equipment) {
      plain.equipmentName = equipment.name;
      plain.equipmentCategory = equipment.category;
      plain.equipmentImage = equipment.images?.[0] || null;
    }
    if (plain.operatorName || plain.operatorPhone || plain.operatorPlate) {
      plain.operator = {
        name: plain.operatorName || null,
        phone: plain.operatorPhone || null,
        plate: plain.operatorPlate || null,
      };
    }
    return plain;
  }

  private async decorateBookings(
    bookings: (EquipmentBookingDocument | any)[],
  ): Promise<Record<string, any>[]> {
    const eqIds = Array.from(
      new Set(
        bookings.map((b: any) => b.equipmentId?.toString()).filter(Boolean),
      ),
    ).map((id) => new Types.ObjectId(id));
    const equipment = eqIds.length
      ? await this.equipmentModel
          .find({ _id: { $in: eqIds } })
          .select('name category images')
          .lean()
      : [];
    const eqMap = new Map(equipment.map((e: any) => [e._id.toString(), e]));
    return bookings.map((b: any) => {
      const plain = serialize<any>(b);
      const eq = eqMap.get(plain.equipmentId?.toString());
      if (eq) {
        plain.equipmentName = eq.name;
        plain.equipmentCategory = eq.category;
        plain.equipmentImage = eq.images?.[0] || null;
      }
      if (plain.operatorName || plain.operatorPhone || plain.operatorPlate) {
        plain.operator = {
          name: plain.operatorName || null,
          phone: plain.operatorPhone || null,
          plate: plain.operatorPlate || null,
        };
      }
      return plain;
    });
  }

  private notifyUser(
    userId: string,
    event: string,
    type: any,
    title: string,
    body: string,
    data: Record<string, any>,
  ): void {
    this.notificationService
      .notify({
        recipientType: 'user',
        recipientId: userId,
        event,
        type,
        title,
        body,
        data,
      })
      .catch(() => undefined);
  }

  // ---------------------------------------------------------------------------
  // Availability
  // ---------------------------------------------------------------------------

  /**
   * Returns the id of a conflicting blocking booking for [start,end], or null.
   * Overlap: existing.start < end AND existing.end > start.
   */
  private async findConflict(
    equipmentId: Types.ObjectId,
    start: Date,
    end: Date,
    excludeBookingId?: Types.ObjectId,
  ): Promise<string | null> {
    const query: Record<string, any> = {
      equipmentId,
      status: { $in: BLOCKING_STATUSES },
      startDate: { $lt: end },
      endDate: { $gt: start },
    };
    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }
    const conflict = await this.bookingModel
      .findOne(query)
      .select('_id')
      .lean();
    return conflict ? conflict._id.toString() : null;
  }

  /** True if a blocking (uncompleted, due) maintenance entry overlaps the window. */
  private maintenanceBlocks(
    equipment: EquipmentDocument,
    start: Date,
    end: Date,
  ): boolean {
    return (equipment.maintenanceSchedule || []).some(
      (m) =>
        !m.completedAt && m.dueDate && m.dueDate <= end && m.dueDate >= start,
    );
  }

  // ---------------------------------------------------------------------------
  // User: fleet browse
  // ---------------------------------------------------------------------------

  async listAvailable(filters: {
    page?: number;
    limit?: number;
    category?: string;
    q?: string;
    startDate?: string;
    endDate?: string;
    minRate?: number;
    maxRate?: number;
    sortBy?: string;
    order?: string;
  }): Promise<Record<string, any>> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {
      status: { $nin: ['MAINTENANCE', 'RETIRED'] },
    };
    if (filters.category) query.category = filters.category;
    if (filters.q) {
      query.$or = [
        { name: { $regex: filters.q, $options: 'i' } },
        { model: { $regex: filters.q, $options: 'i' } },
      ];
    }
    if (filters.minRate != null || filters.maxRate != null) {
      query.dailyRate = {};
      if (filters.minRate != null) query.dailyRate.$gte = filters.minRate;
      if (filters.maxRate != null) query.dailyRate.$lte = filters.maxRate;
    }

    const sortField =
      filters.sortBy === 'name'
        ? 'name'
        : filters.sortBy === 'bookingHistory'
          ? 'bookingHistory'
          : 'dailyRate';
    const sortDir = filters.order === 'desc' ? -1 : 1;

    const [items, total] = await Promise.all([
      this.equipmentModel
        .find(query)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.equipmentModel.countDocuments(query),
    ]);

    // Date-availability filter when a window is supplied.
    let start: Date | undefined;
    let end: Date | undefined;
    if (filters.startDate && filters.endDate) {
      start = new Date(filters.startDate);
      end = new Date(filters.endDate);
    }

    const decorated = await Promise.all(
      items.map(async (e: any) => {
        const view = this.equipmentView(e);
        if (start && end) {
          const conflict = await this.findConflict(e._id, start, end);
          const maint = this.maintenanceBlocks(e, start, end);
          view.available = !conflict && !maint;
        }
        return view;
      }),
    );

    const filtered =
      start && end ? decorated.filter((e) => e.available) : decorated;

    return { items: filtered, total, page, limit };
  }

  private equipmentView(e: any): Record<string, any> {
    const plain = serialize<any>(e);
    plain.available = plain.status === 'AVAILABLE';
    plain.nextAvailableFrom = null;
    return plain;
  }

  async getEquipment(id: string): Promise<Record<string, any>> {
    const equipment = await this.equipmentModel
      .findById(this.oid(id, 'EQP_001'))
      .lean();
    if (!equipment || equipment.status === 'RETIRED') {
      throw new EquipmentException('EQP_001', HttpStatus.NOT_FOUND);
    }
    return this.equipmentView(equipment);
  }

  // ---------------------------------------------------------------------------
  // User: booking lifecycle
  // ---------------------------------------------------------------------------

  async requestBooking(
    userId: string,
    dto: {
      equipmentId: string;
      startDate: string;
      endDate: string;
      rateType: 'HOURLY' | 'DAILY';
      pickupLocation?: { lat: number; lng: number; address?: string };
      notes?: string;
    },
  ): Promise<Record<string, any>> {
    const equipment = await this.equipmentModel.findById(
      this.oid(dto.equipmentId, 'EQP_001'),
    );
    if (!equipment || equipment.status === 'RETIRED') {
      throw new EquipmentException('EQP_001', HttpStatus.NOT_FOUND);
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (
      isNaN(start.getTime()) ||
      isNaN(end.getTime()) ||
      start.getTime() >= end.getTime()
    ) {
      throw new EquipmentException('EQP_006', HttpStatus.BAD_REQUEST);
    }
    const maxDays = this.cfg('maxBookingDays', 30);
    if (this.durationDays(start, end) > maxDays) {
      throw new EquipmentException('EQP_006', HttpStatus.BAD_REQUEST, {
        maxBookingDays: maxDays,
      });
    }

    // Soft conflict check at request time (authoritative check is on approve/pay).
    const conflict = await this.findConflict(equipment._id, start, end);
    if (conflict || this.maintenanceBlocks(equipment, start, end)) {
      throw new EquipmentException('EQP_003', HttpStatus.CONFLICT, {
        conflictBookingId: conflict || undefined,
      });
    }

    const rentalCost = this.computeRentalCost(
      equipment,
      start,
      end,
      dto.rateType,
    );
    const depositAmount = equipment.depositRequired || 0;
    const totalCost = rentalCost + depositAmount;

    const booking = await this.bookingModel.create({
      equipmentId: equipment._id,
      userId: new Types.ObjectId(userId),
      bookingReference: this.genRef(this.cfg('bookingPrefix', 'EQB')),
      startDate: start,
      endDate: end,
      rateType: dto.rateType,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      rentalCost,
      depositAmount,
      totalCost,
      amountPaid: 0,
      pickupLocation: dto.pickupLocation,
      notes: dto.notes,
    });

    this.notifyUser(
      userId,
      'equipment.booking.requested',
      'info',
      'Booking requested',
      `Your booking for ${equipment.name} is awaiting admin approval.`,
      {
        bookingId: booking._id.toString(),
        link: `/equipment/bookings/${booking._id}`,
      },
    );
    this.notificationService
      .notifyAdmins({
        event: 'equipment.booking.requested',
        type: 'info',
        title: 'New equipment booking request',
        body: `A user requested ${equipment.name} (${booking.bookingReference}).`,
        data: {
          bookingId: booking._id.toString(),
          equipmentId: equipment._id.toString(),
        },
      })
      .catch(() => undefined);

    return this.decorateBooking(booking);
  }

  async listMyBookings(
    userId: string,
    filters: { page?: number; limit?: number; status?: string },
  ): Promise<Record<string, any>> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { userId: new Types.ObjectId(userId) };
    if (filters.status) query.status = filters.status;

    const [items, total] = await Promise.all([
      this.bookingModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.bookingModel.countDocuments(query),
    ]);

    return { items: await this.decorateBookings(items), total, page, limit };
  }

  /** Fetch a booking enforcing ownership (users) — throws EQP_002 otherwise. */
  private async getOwnedBooking(
    id: string,
    userId: string,
  ): Promise<EquipmentBookingDocument> {
    const booking = await this.bookingModel.findById(this.oid(id, 'EQP_002'));
    if (!booking) {
      throw new EquipmentException('EQP_002', HttpStatus.NOT_FOUND);
    }
    if (booking.userId.toString() !== userId) {
      // No cross-owner leakage — present as not-found.
      throw new EquipmentException('EQP_002', HttpStatus.NOT_FOUND);
    }
    return booking;
  }

  async getMyBooking(id: string, userId: string): Promise<Record<string, any>> {
    const booking = await this.getOwnedBooking(id, userId);
    return this.decorateBooking(booking);
  }

  async payBooking(id: string, userId: string): Promise<Record<string, any>> {
    const booking = await this.getOwnedBooking(id, userId);

    // Idempotency: already paid → return the confirmed state, no second debit.
    if (booking.paymentStatus === 'PAID' && booking.walletPaymentRef) {
      const view = await this.decorateBooking(booking);
      return { ...view, wallet: await this.walletBalance(userId) };
    }

    if (booking.status !== 'APPROVED' || booking.paymentStatus !== 'UNPAID') {
      throw new EquipmentException('EQP_008', HttpStatus.BAD_REQUEST);
    }

    // Re-check availability to guard the approve→pay race.
    const conflict = await this.findConflict(
      booking.equipmentId,
      booking.startDate,
      booking.endDate,
      booking._id,
    );
    if (conflict) {
      throw new EquipmentException('EQP_005', HttpStatus.CONFLICT, {
        conflictBookingId: conflict,
      });
    }

    const paymentRef = this.genRef('EQPAY');
    let debit: { reference: string; wallet: Record<string, any> };
    try {
      debit = await this.walletService.debitForPayment(userId, {
        amount: booking.totalCost,
        reference: paymentRef,
        description: `Equipment booking ${booking.bookingReference}`,
        category: 'PAYMENT',
        metadata: {
          bookingId: booking._id.toString(),
          equipmentId: booking.equipmentId.toString(),
        },
      });
    } catch (error: any) {
      // Wrap wallet insufficient-balance into EQP_009 with the required/available detail.
      const body = error?.getResponse?.();
      if (body?.error?.code === 'WALLET_001') {
        throw new EquipmentException(
          'EQP_009',
          HttpStatus.BAD_REQUEST,
          body.error.details,
        );
      }
      throw new EquipmentException('EQP_010', HttpStatus.BAD_REQUEST, {
        cause: body?.error?.code,
      });
    }

    booking.status = 'CONFIRMED';
    booking.paymentStatus = 'PAID';
    booking.amountPaid = booking.totalCost;
    booking.walletPaymentRef = debit.reference;
    await booking.save();

    // Reserve the equipment for the window.
    await this.equipmentModel.updateOne(
      { _id: booking.equipmentId },
      { $set: { status: 'BOOKED' } },
    );

    this.notifyUser(
      userId,
      'equipment.booking.confirmed',
      'success',
      'Booking confirmed',
      `Payment received. Your booking ${booking.bookingReference} is confirmed.`,
      {
        bookingId: booking._id.toString(),
        link: `/equipment/bookings/${booking._id}`,
      },
    );

    const view = await this.decorateBooking(booking);
    return { ...view, wallet: debit.wallet };
  }

  private async walletBalance(userId: string): Promise<Record<string, any>> {
    try {
      return await this.walletService.getBalanceView(userId);
    } catch {
      return {};
    }
  }

  async cancelBooking(
    id: string,
    userId: string,
    reason?: string,
  ): Promise<Record<string, any>> {
    const booking = await this.getOwnedBooking(id, userId);
    return this.performCancel(booking, reason, { actor: 'user' });
  }

  /**
   * Shared cancel path (user + admin). Refunds paid CONFIRMED bookings per the
   * cancellation policy. Idempotent on `refundRef`.
   */
  async performCancel(
    booking: EquipmentBookingDocument,
    reason: string | undefined,
    _ctx: { actor: 'user' | 'admin'; adminId?: string },
  ): Promise<Record<string, any>> {
    const before = {
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    };

    if (['IN_USE', 'OVERDUE'].includes(booking.status)) {
      throw new EquipmentException('EQP_011', HttpStatus.CONFLICT);
    }
    if (!['PENDING', 'APPROVED', 'CONFIRMED'].includes(booking.status)) {
      throw new EquipmentException('EQP_011', HttpStatus.CONFLICT);
    }

    let refund: { reference: string; amount: number } | undefined;

    // Refund only when the user already paid (CONFIRMED).
    if (booking.status === 'CONFIRMED' && booking.paymentStatus === 'PAID') {
      const fullRefundHours = this.cfg('cancellationFullRefundHours', 24);
      const hoursBeforeStart =
        (booking.startDate.getTime() - Date.now()) / (1000 * 60 * 60);
      // Default policy this phase: full refund. (A fee window can be enforced here.)
      const refundAmount =
        hoursBeforeStart >= fullRefundHours
          ? booking.amountPaid
          : booking.amountPaid; // full refund default; hook for future fee.

      const refundRef = booking.refundRef || this.genRef('EQREF');
      const credited = await this.walletService.creditRefund(
        booking.userId.toString(),
        {
          amount: refundAmount,
          reference: refundRef,
          description: `Refund — cancelled booking ${booking.bookingReference}`,
          category: 'REFUND',
          metadata: { bookingId: booking._id.toString() },
        },
      );
      booking.refundRef = credited.reference;
      booking.paymentStatus = 'REFUNDED';
      refund = { reference: credited.reference, amount: credited.amount };

      // Free the equipment.
      await this.equipmentModel.updateOne(
        { _id: booking.equipmentId, status: 'BOOKED' },
        { $set: { status: 'AVAILABLE' } },
      );
    }

    booking.status = 'CANCELLED';
    booking.cancellationReason = reason;
    // Revoke tracking token on terminal state.
    booking.trackingToken = undefined;
    await booking.save();

    this.notifyUser(
      booking.userId.toString(),
      'equipment.booking.cancelled',
      'info',
      'Booking cancelled',
      refund
        ? `Your booking ${booking.bookingReference} was cancelled and ₦${refund.amount.toLocaleString()} refunded to your wallet.`
        : `Your booking ${booking.bookingReference} was cancelled.`,
      {
        bookingId: booking._id.toString(),
        link: `/equipment/bookings/${booking._id}`,
      },
    );

    const view = await this.decorateBooking(booking);
    return { ...view, refund, _before: before };
  }

  async rateBooking(
    id: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<Record<string, any>> {
    const booking = await this.getOwnedBooking(id, userId);
    if (booking.status !== 'COMPLETED') {
      throw new EquipmentException('EQP_012', HttpStatus.BAD_REQUEST);
    }
    const hadRating = typeof booking.rating === 'number';
    booking.rating = rating;
    booking.ratingComment = comment;
    await booking.save();

    // Recompute the equipment aggregate rating (only counting new ratings once).
    if (!hadRating) {
      const equipment = await this.equipmentModel.findById(booking.equipmentId);
      if (equipment) {
        const newCount = (equipment.ratingCount || 0) + 1;
        const newAvg =
          ((equipment.ratingAverage || 0) * (equipment.ratingCount || 0) +
            rating) /
          newCount;
        equipment.ratingCount = newCount;
        equipment.ratingAverage = Math.round(newAvg * 100) / 100;
        await equipment.save();
      }
    }

    return this.decorateBooking(booking);
  }

  // ---------------------------------------------------------------------------
  // Tracking (user snapshot) — also used by the gateway/admin
  // ---------------------------------------------------------------------------

  /**
   * Tracking snapshot for a booking. `requester` gates ownership: a user must
   * own the booking; admins pass `{ isAdmin: true }`.
   */
  async getTracking(
    id: string,
    requester: { userId?: string; isAdmin?: boolean },
  ): Promise<Record<string, any>> {
    const booking = await this.bookingModel.findById(this.oid(id, 'EQP_002'));
    if (!booking) {
      throw new EquipmentException('EQP_002', HttpStatus.NOT_FOUND);
    }
    if (
      !requester.isAdmin &&
      booking.userId.toString() !== (requester.userId || '')
    ) {
      throw new EquipmentException('EQP_002', HttpStatus.NOT_FOUND);
    }
    const plain = serialize<any>(booking);
    return {
      bookingId: plain.id,
      status: plain.status,
      trackingToken: requester.isAdmin
        ? plain.trackingToken || null
        : plain.trackingToken || null,
      operator:
        plain.operatorName || plain.operatorPhone || plain.operatorPlate
          ? {
              name: plain.operatorName || null,
              phone: plain.operatorPhone || null,
              plate: plain.operatorPlate || null,
            }
          : null,
      currentPosition: plain.currentPosition || null,
      gpsTracking: plain.gpsTracking || [],
      socket: {
        namespace: '/rt/user',
        room: `track:${plain.id}`,
        event: 'equipment:position:new',
      },
    };
  }

  // Expose helpers the admin service / gateway reuse.
  get models() {
    return {
      equipment: this.equipmentModel,
      booking: this.bookingModel,
    };
  }

  publicDecorateBooking(b: any) {
    return this.decorateBooking(b);
  }

  publicDecorateBookings(b: any[]) {
    return this.decorateBookings(b);
  }

  publicFindConflict(
    equipmentId: Types.ObjectId,
    start: Date,
    end: Date,
    exclude?: Types.ObjectId,
  ) {
    return this.findConflict(equipmentId, start, end, exclude);
  }

  publicGenTrackingToken() {
    return this.genTrackingToken();
  }

  publicMaintenanceBlocks(e: EquipmentDocument, s: Date, en: Date) {
    return this.maintenanceBlocks(e, s, en);
  }

  publicNotifyUser(
    userId: string,
    event: string,
    type: any,
    title: string,
    body: string,
    data: Record<string, any>,
  ) {
    this.notifyUser(userId, event, type, title, body, data);
  }
}
