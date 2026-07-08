/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LIVE Equipment Booking + GPS-tracking types (PRD 06).
 *
 * These mirror the server contract at `/api/v1/equipment/*` and the
 * `equipment:*` socket events on `/rt/user`. The mock `AgriBooking`
 * (`src/types.ts`) is SUPERSEDED by these shapes for the routed, server-backed
 * equipment surface — nothing here depends on `appStore`.
 *
 * Admin-dev note: this file is a SHARED, plane-agnostic reference. The admin
 * `/bennie` equipment screens (fleet CRUD, approvals, handover, completion, GPS
 * oversight) can reuse `Equipment`, `EquipmentBooking`, `TrackingSnapshot`,
 * `GpsPosition`, etc. Build the admin-plane service against `adminApi` rather
 * than importing `equipment.service.ts` (bound to the user `api`).
 */

// --- Enums -------------------------------------------------------------------

export type EquipmentCategory =
  | "TRACTOR"
  | "HARVESTER"
  | "PLANTER"
  | "SPRAYER"
  | "IRRIGATION"
  | "OTHER";

export type EquipmentStatus =
  | "AVAILABLE"
  | "BOOKED"
  | "MAINTENANCE"
  | "RETIRED";

export type BookingStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CONFIRMED"
  | "IN_USE"
  | "COMPLETED"
  | "CANCELLED"
  | "OVERDUE";

export type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED";

export type RateType = "HOURLY" | "DAILY";

// --- Shared geo --------------------------------------------------------------

export interface GeoPoint {
  lat: number;
  lng: number;
  address: string;
}

/** A single GPS ping in the trail / the live operator position. */
export interface GpsPosition {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  at: string; // ISO
}

// --- Equipment (fleet) -------------------------------------------------------

/**
 * A fleet item as returned by the user-plane list/detail endpoints. The server
 * may return either `equipmentName`/`equipmentCategory` or `name`/`category`;
 * the service normalises these — consumers read `equipmentName`/`category`.
 */
export interface Equipment {
  id: string;
  equipmentName: string;
  category: EquipmentCategory;
  model?: string;
  status?: EquipmentStatus;
  hourlyRate: number;
  dailyRate: number;
  depositRequired: number;
  location?: GeoPoint;
  images: string[];
  rating?: number;
  bookingHistory?: number;
  specifications?: Record<string, unknown>;
  yearOfManufacture?: number;
  serialNumber?: string;
  /** Only present when the list was queried with a date window. */
  available?: boolean;
  nextAvailableFrom?: string | null;
}

// --- Operator + tracking -----------------------------------------------------

export interface BookingOperator {
  name?: string;
  phone?: string;
  plate?: string;
}

/** The REST tracking snapshot (`GET /equipment/bookings/:id/tracking`). */
export interface TrackingSnapshot {
  bookingId: string;
  status?: BookingStatus;
  trackingToken?: string;
  operator?: BookingOperator | null;
  currentPosition?: GpsPosition | null;
  gpsTracking: GpsPosition[];
  socket?: {
    namespace: string;
    room: string;
    event: string;
  };
}

/** The live socket payload broadcast on `equipment:position:new`. */
export interface LivePosition extends GpsPosition {
  bookingId: string;
}

// --- Booking -----------------------------------------------------------------

export interface EquipmentBooking {
  id: string;
  bookingReference: string;
  equipmentId: string;
  /** Populated equipment summary when the server expands it (list/detail). */
  equipment?: Pick<
    Equipment,
    "id" | "equipmentName" | "category" | "images" | "model"
  > | null;
  equipmentName?: string;
  equipmentCategory?: EquipmentCategory;
  userId?: string;

  status: BookingStatus;
  paymentStatus: PaymentStatus;

  startDate: string;
  endDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  rateType?: RateType;

  // Costing (NGN).
  rentalCost: number;
  depositAmount: number;
  totalCost: number;
  amountPaid: number;

  walletPaymentRef?: string;
  refundRef?: string;

  pickupLocation?: GeoPoint;
  returnLocation?: GeoPoint;

  // Operator (admin-entered this phase).
  operatorName?: string;
  operatorPhone?: string;
  operatorPlate?: string;

  // Live GPS (denormalised snapshot; full trail via tracking endpoint).
  currentPosition?: GpsPosition | null;

  // Settlement.
  overdueCharges?: number;
  outstandingCharge?: number;
  damageReport?: {
    description: string;
    costEstimate: number;
    deductedFromDeposit: number;
  };
  cancellationReason?: string;
  rejectionReason?: string;

  // Review.
  rating?: number;
  ratingComment?: string;

  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// --- Request payloads --------------------------------------------------------

export interface CreateBookingPayload {
  equipmentId: string;
  startDate: string;
  endDate: string;
  rateType: RateType;
  pickupLocation?: GeoPoint;
  notes?: string;
}

export interface EquipmentListFilters {
  page?: number;
  limit?: number;
  category?: EquipmentCategory | "";
  q?: string;
  startDate?: string;
  endDate?: string;
  minRate?: number;
  maxRate?: number;
  sortBy?: "dailyRate" | "name" | "bookingHistory";
  order?: "asc" | "desc";
}

// --- Result shapes -----------------------------------------------------------

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** `POST /equipment/bookings/:id/pay` result — booking + fresh wallet balance. */
export interface PayResult {
  booking: EquipmentBooking;
  wallet?: {
    available?: number;
    balance?: number;
    ledgerBalance?: number;
  } | null;
}
