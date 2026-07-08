/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ADMIN-plane Equipment Booking + GPS types (PRD admin_module/equipment_booking).
 *
 * Extends the SHARED `src/types/equipment.ts` shapes with the admin-owned
 * config/collections (rate config, geofences, GPS alerts) and the operator /
 * tracking-token fields the admin sets on a booking. Bound to `adminApi`
 * (`/admin/equipment/*`) — see `src/services/adminEquipment.service.ts`.
 *
 * The base `Equipment` / `EquipmentBooking` / `GpsPosition` / `GeoPoint` shapes
 * are imported and re-exported so admin screens have one import surface.
 */

import type {
  BookingStatus,
  Equipment,
  EquipmentBooking,
  EquipmentCategory,
  GeoPoint,
  GpsPosition,
  PaymentStatus,
} from "./equipment";

export type {
  BookingStatus,
  Equipment,
  EquipmentBooking,
  EquipmentCategory,
  EquipmentStatus,
  GeoPoint,
  GpsPosition,
  PaymentStatus,
} from "./equipment";

// --- Fleet list / filters ----------------------------------------------------

export interface AdminEquipmentListFilters {
  page?: number;
  limit?: number;
  q?: string;
  category?: EquipmentCategory | "";
  status?: string; // AVAILABLE | BOOKED | MAINTENANCE | RETIRED | ""
  gpsActive?: boolean;
  dueForMaintenance?: boolean;
  sortBy?: "createdAt" | "bookingHistory";
  order?: "asc" | "desc";
}

// --- Create / update equipment payload ---------------------------------------

export interface EquipmentGpsTracker {
  deviceId?: string;
  isActive?: boolean;
  lastUpdateAt?: string;
}

/**
 * Rich create/edit payload (PRD §3.1). `images[]` are already-uploaded URLs
 * (via `adminUploadService.upload → FileMetadata.url`); no binary posted here.
 * `specifications` is a free-form key-value map.
 */
export interface EquipmentFormPayload {
  name: string;
  category: EquipmentCategory;
  model?: string;
  serialNumber?: string;
  yearOfManufacture?: number;
  hourlyRate: number;
  dailyRate: number;
  depositRequired: number;
  location?: GeoPoint;
  specifications?: Record<string, string | number>;
  images?: string[];
  gpsTracker?: EquipmentGpsTracker;
}

// --- Maintenance -------------------------------------------------------------

export interface MaintenanceItem {
  type: string;
  dueDate: string;
  completedAt?: string;
  notes?: string;
  /** Convenience index for the complete endpoint (server order). */
  index?: number;
}

export interface ScheduleMaintenancePayload {
  type: string;
  dueDate: string;
  notes?: string;
  blockNow?: boolean;
}

// --- Booking actions ---------------------------------------------------------

export interface AdminBookingListFilters {
  page?: number;
  limit?: number;
  equipmentId?: string;
  userId?: string;
  status?: BookingStatus | "";
  paymentStatus?: PaymentStatus | "";
  startDate?: string;
  endDate?: string;
  overdue?: boolean;
  awaitingPayment?: boolean;
}

export interface ApproveBookingPayload {
  operatorName?: string;
  operatorPhone?: string;
  operatorPlate?: string;
  note?: string;
}

export interface ApproveBookingResult {
  bookingId: string;
  status: BookingStatus;
  trackingToken?: string;
  trackingTokenExpiresAt?: string;
}

export interface HandoverBookingPayload {
  operatorName?: string;
  operatorPhone?: string;
  operatorPlate?: string;
  note?: string;
}

export interface CompleteBookingPayload {
  actualEndDate?: string;
  returnLocation?: GeoPoint;
  condition: "OK" | "DAMAGED";
  damageReport?: { description: string; costEstimate: number };
  usageHours?: number;
}

export interface CompleteBookingResult {
  bookingId: string;
  status: BookingStatus;
  totalPaid?: number;
  depositPortion?: number;
  damageDeducted?: number;
  depositRefunded?: number;
  refundTxnRef?: string;
}

export interface DepositRefundPayload {
  amount?: number;
  note?: string;
}

export interface DepositDeductPayload {
  description: string;
  costEstimate: number;
}

// --- GPS: live snapshot + alerts + geofences ---------------------------------

/** A single unit's live position within the fleet snapshot (`gps/live`). */
export interface FleetLivePosition {
  equipmentId: string;
  equipmentName?: string;
  category?: EquipmentCategory;
  bookingId?: string;
  bookingReference?: string;
  operatorName?: string;
  status?: BookingStatus;
  position: GpsPosition | null;
}

/** Live socket payload broadcast on `equipment:position:new` (admin plane). */
export interface AdminLivePosition extends GpsPosition {
  bookingId: string;
  equipmentId?: string;
}

export type GpsAlertType =
  | "GEOFENCE_BREACH"
  | "OVERSPEED"
  | "SIGNAL_LOST"
  | "IDLE_ANOMALY";

export interface GpsAlert {
  id: string;
  equipmentId: string;
  equipmentName?: string;
  bookingId?: string;
  type: GpsAlertType;
  position?: { lat: number; lng: number };
  detail: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

/** Live socket payload broadcast on `equipment:alert` (admin plane). */
export interface LiveAlert {
  bookingId: string;
  equipmentId?: string;
  type: GpsAlertType;
  detail: string;
  position?: { lat: number; lng: number };
}

export type GeofenceType = "CIRCLE" | "POLYGON";

export interface Geofence {
  id: string;
  name: string;
  type: GeofenceType;
  center?: { lat: number; lng: number };
  radiusMeters?: number;
  polygon?: { lat: number; lng: number }[];
  appliesTo: "ALL" | "EQUIPMENT" | "CATEGORY";
  equipmentIds?: string[];
  category?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GeofencePayload {
  name: string;
  type: GeofenceType;
  center?: { lat: number; lng: number };
  radiusMeters?: number;
  polygon?: { lat: number; lng: number }[];
  appliesTo: "ALL" | "EQUIPMENT" | "CATEGORY";
  equipmentIds?: string[];
  category?: string;
  isActive?: boolean;
}

// --- Rate config -------------------------------------------------------------

export interface RateConfigEntry {
  category: EquipmentCategory;
  defaultHourlyRate: number;
  defaultDailyRate: number;
  depositPercent: number;
  minDepositNgn?: number;
  overdueFeePerDay?: number;
  isActive?: boolean;
  updatedAt?: string;
}

export interface RateConfigPayload {
  defaultHourlyRate?: number;
  defaultDailyRate?: number;
  depositPercent?: number;
  minDepositNgn?: number;
  overdueFeePerDay?: number;
  isActive?: boolean;
}

// --- Detail aggregate --------------------------------------------------------

/** `GET /equipment/:id` — equipment with expanded maintenance + bookings. */
export interface AdminEquipmentDetail extends Equipment {
  maintenanceSchedule?: MaintenanceItem[];
  gpsTracker?: EquipmentGpsTracker;
  bookings?: EquipmentBooking[];
  cooperativeId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
