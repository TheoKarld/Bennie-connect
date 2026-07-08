import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import {
  EquipmentBooking,
  EquipmentBookingDocument,
} from './schemas/equipment-booking.schema';
import { Equipment, EquipmentDocument } from './schemas/equipment.schema';
import { Geofence, GeofenceDocument } from './schemas/geofence.schema';
import {
  GpsAlert,
  GpsAlertDocument,
  GpsAlertType,
} from './schemas/gps-alert.schema';
import { NotificationService } from '../notifications/notification.service';

export interface PositionInput {
  bookingId: string;
  trackingToken: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  at?: string;
}

export interface IngestResult {
  ok: boolean;
  error?: 'EQP_013' | 'EQP_014' | 'EQP_002';
  booking?: EquipmentBookingDocument;
  position?: {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    at: Date;
  };
  alerts?: { type: GpsAlertType; detail: string }[];
}

/**
 * GPS ingestion + geofence/overspeed evaluation. Called by the EquipmentGateway
 * on each operator `equipment:position` push. Persists to the booking trail and
 * raises `gpsAlerts` on breaches. Kept out of the gateway so it is DI-testable.
 */
@Injectable()
export class EquipmentGpsService {
  private readonly logger = new Logger(EquipmentGpsService.name);

  constructor(
    @InjectModel(EquipmentBooking.name)
    private readonly bookingModel: Model<EquipmentBookingDocument>,
    @InjectModel(Equipment.name)
    private readonly equipmentModel: Model<EquipmentDocument>,
    @InjectModel(Geofence.name)
    private readonly geofenceModel: Model<GeofenceDocument>,
    @InjectModel(GpsAlert.name)
    private readonly gpsAlertModel: Model<GpsAlertDocument>,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  private cfg<T = any>(path: string, fallback: T): T {
    const v = this.configService.get<T>(`configuration.equipment.${path}`);
    return v === undefined || v === null ? fallback : v;
  }

  /**
   * Validate token + booking state, append the fix, evaluate rules, persist
   * any alerts. Returns the outcome for the gateway to broadcast.
   */
  async ingestPosition(input: PositionInput): Promise<IngestResult> {
    if (!input.bookingId || !Types.ObjectId.isValid(input.bookingId)) {
      return { ok: false, error: 'EQP_002' };
    }
    const booking = await this.bookingModel.findById(
      new Types.ObjectId(input.bookingId),
    );
    if (!booking) {
      return { ok: false, error: 'EQP_002' };
    }

    // Token validation (opaque, bound to the booking, unexpired).
    if (
      !booking.trackingToken ||
      booking.trackingToken !== input.trackingToken ||
      (booking.trackingTokenExpiresAt &&
        booking.trackingTokenExpiresAt.getTime() < Date.now())
    ) {
      return { ok: false, error: 'EQP_013' };
    }

    // Only accept positions while the booking is live.
    if (!['IN_USE', 'OVERDUE'].includes(booking.status)) {
      return { ok: false, error: 'EQP_014' };
    }

    const at = input.at ? new Date(input.at) : new Date();
    const fix = {
      lat: input.lat,
      lng: input.lng,
      heading: input.heading,
      speed: input.speed,
      at,
    };

    booking.currentPosition = fix as any;
    booking.gpsTracking.push(fix as any);
    await booking.save();

    await this.equipmentModel.updateOne(
      { _id: booking.equipmentId },
      { $set: { 'gpsTracker.lastUpdateAt': at, 'gpsTracker.isActive': true } },
    );

    const alerts = await this.evaluateAlerts(booking, fix);

    return { ok: true, booking, position: fix, alerts };
  }

  /**
   * Evaluate overspeed + geofence rules for a fix; persist + notify each alert.
   * Returns the alerts raised so the gateway can emit `equipment:alert`.
   */
  private async evaluateAlerts(
    booking: EquipmentBookingDocument,
    fix: { lat: number; lng: number; speed?: number },
  ): Promise<{ type: GpsAlertType; detail: string }[]> {
    const raised: { type: GpsAlertType; detail: string }[] = [];

    // Overspeed.
    const threshold = this.cfg('overspeedThresholdKmh', 80);
    if (typeof fix.speed === 'number' && fix.speed > threshold) {
      raised.push({
        type: 'OVERSPEED',
        detail: `Speed ${Math.round(fix.speed)} km/h exceeds ${threshold} km/h`,
      });
    }

    // Geofence breach.
    if (this.cfg('geofenceAlertEnabled', true)) {
      const breached = await this.isOutsideAllGeofences(booking, fix);
      if (breached) {
        raised.push({
          type: 'GEOFENCE_BREACH',
          detail: 'Equipment left its authorised operating zone',
        });
      }
    }

    for (const a of raised) {
      await this.persistAlert(booking, a.type, a.detail, {
        lat: fix.lat,
        lng: fix.lng,
      });
    }
    return raised;
  }

  /**
   * True when the fix is outside EVERY active geofence applicable to the
   * equipment. If no geofence applies, never a breach.
   */
  private async isOutsideAllGeofences(
    booking: EquipmentBookingDocument,
    fix: { lat: number; lng: number },
  ): Promise<boolean> {
    const equipment = await this.equipmentModel
      .findById(booking.equipmentId)
      .select('category')
      .lean();
    const category = equipment?.category;

    const applicable = await this.geofenceModel
      .find({
        isActive: true,
        $or: [
          { appliesTo: 'ALL' },
          { appliesTo: 'EQUIPMENT', equipmentIds: booking.equipmentId },
          ...(category ? [{ appliesTo: 'CATEGORY', category }] : []),
        ],
      })
      .lean();

    if (applicable.length === 0) {
      return false; // no zone defined → nothing to breach
    }
    // Inside ANY applicable zone → not a breach.
    const insideAny = applicable.some((g) => this.isInside(g, fix));
    return !insideAny;
  }

  private isInside(geofence: any, fix: { lat: number; lng: number }): boolean {
    if (
      geofence.type === 'CIRCLE' &&
      geofence.center &&
      geofence.radiusMeters
    ) {
      const dist = this.haversineMeters(
        geofence.center.lat,
        geofence.center.lng,
        fix.lat,
        fix.lng,
      );
      return dist <= geofence.radiusMeters;
    }
    if (geofence.type === 'POLYGON' && Array.isArray(geofence.polygon)) {
      return this.pointInPolygon(fix, geofence.polygon);
    }
    return false;
  }

  private haversineMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private pointInPolygon(
    point: { lat: number; lng: number },
    polygon: { lat: number; lng: number }[],
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;
      const intersect =
        yi > point.lat !== yj > point.lat &&
        point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /** Persist a gpsAlert row + fan out `equipment.gps.alert` to admins. */
  async persistAlert(
    booking: EquipmentBookingDocument,
    type: GpsAlertType,
    detail: string,
    position?: { lat: number; lng: number },
  ): Promise<GpsAlertDocument | null> {
    try {
      const alert = await this.gpsAlertModel.create({
        equipmentId: booking.equipmentId,
        bookingId: booking._id,
        type,
        detail,
        position,
      });
      this.notificationService
        .notifyAdmins({
          event: 'equipment.gps.alert',
          type: 'alert',
          title: `GPS alert: ${type}`,
          body: detail,
          data: {
            bookingId: booking._id.toString(),
            equipmentId: booking.equipmentId.toString(),
            type,
          },
        })
        .catch(() => undefined);
      return alert;
    } catch (error: any) {
      this.logger.warn(
        `Failed to persist gpsAlert (${type}): ${error?.message}`,
      );
      return null;
    }
  }

  /**
   * Authorize a viewer (user or admin) to join `track:<bookingId>`.
   * Users must own the booking; admins may join any booking.
   */
  async canViewTracking(
    bookingId: string,
    ctx: { sub: string; scope: 'user' | 'admin' },
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(bookingId)) return false;
    if (ctx.scope === 'admin') return true;
    const booking = await this.bookingModel
      .findById(new Types.ObjectId(bookingId))
      .select('userId')
      .lean();
    return !!booking && booking.userId.toString() === ctx.sub;
  }
}
