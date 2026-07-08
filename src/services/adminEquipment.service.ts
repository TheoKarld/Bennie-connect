/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typed REST client for the ADMIN Equipment / GPS surface
 * (base `<VITE_API_URL>/admin/equipment`, via `src/lib/adminApi.ts`).
 *
 * The admin-plane sibling of the user `equipment.service.ts` — but bound to
 * `adminApi` (admin token + `/admin` base) so the two dual sessions never bleed.
 * Do NOT import the user `equipment.service.ts` here.
 *
 * Every helper unwraps the `{ success, data }` envelope; list helpers tolerate
 * either a bare array or a `{ items, total, page, limit }` paginated shape.
 * Errors bubble up as axios errors so the store can surface `EQP_ADM_*`
 * codes/messages from `{ success:false, error:{ code, message, details } }`.
 */

import adminApi from "../lib/adminApi";
import type {
  AdminBookingListFilters,
  AdminEquipmentDetail,
  AdminEquipmentListFilters,
  ApproveBookingPayload,
  ApproveBookingResult,
  CompleteBookingPayload,
  CompleteBookingResult,
  DepositDeductPayload,
  DepositRefundPayload,
  Equipment,
  EquipmentBooking,
  EquipmentFormPayload,
  FleetLivePosition,
  Geofence,
  GeofencePayload,
  GpsAlert,
  HandoverBookingPayload,
  MaintenanceItem,
  Paginated,
  RateConfigEntry,
  RateConfigPayload,
  ScheduleMaintenancePayload,
} from "../types/adminEquipment";
import type { TrackingSnapshot } from "../types/equipment";

/** Unwrap `{ success, data }`; tolerate a bare payload defensively. */
function unwrap<T>(payload: unknown): T {
  const body = payload as { data?: T } | T;
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/** Coerce an unknown list payload into a normalised Paginated<T>. */
function toPaginated<T>(
  data: T[] | Partial<Paginated<T>> | undefined,
  fallbackPage = 1,
  fallbackLimit = 20
): Paginated<T> {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: fallbackPage, limit: fallbackLimit };
  }
  const items = data?.items ?? [];
  return {
    items,
    total: data?.total ?? items.length,
    page: data?.page ?? fallbackPage,
    limit: data?.limit ?? fallbackLimit,
  };
}

/**
 * Normalise an equipment record — the server may return `name`/`category` or
 * `equipmentName`/`equipmentCategory`; consumers read `equipmentName`.
 */
function normalizeEquipment<T extends Partial<Equipment> & Record<string, unknown>>(
  raw: T
): T & Equipment {
  const r = raw as Record<string, unknown>;
  return {
    ...(raw as object),
    id: (r.id as string) ?? (r._id as string) ?? "",
    equipmentName:
      (r.equipmentName as string) ?? (r.name as string) ?? "Unnamed unit",
    category: (r.category as Equipment["category"]) ?? "OTHER",
    hourlyRate: Number(r.hourlyRate ?? 0),
    dailyRate: Number(r.dailyRate ?? 0),
    depositRequired: Number(r.depositRequired ?? 0),
    images: Array.isArray(r.images) ? (r.images as string[]) : [],
  } as T & Equipment;
}

const BASE = "/equipment";

export const adminEquipmentService = {
  // --- Fleet -----------------------------------------------------------------

  async listEquipment(
    params: AdminEquipmentListFilters = {}
  ): Promise<Paginated<Equipment>> {
    const res = await adminApi.get(BASE, { params });
    const data = unwrap<Equipment[] | Partial<Paginated<Equipment>>>(res.data);
    const page = toPaginated<Equipment>(data, params.page ?? 1, params.limit ?? 20);
    return { ...page, items: page.items.map((e) => normalizeEquipment(e as never)) };
  },

  async getEquipment(id: string): Promise<AdminEquipmentDetail> {
    const res = await adminApi.get(`${BASE}/${id}`);
    return normalizeEquipment(
      unwrap<AdminEquipmentDetail>(res.data) as never
    ) as AdminEquipmentDetail;
  },

  async createEquipment(payload: EquipmentFormPayload): Promise<AdminEquipmentDetail> {
    const res = await adminApi.post(BASE, payload);
    return unwrap<AdminEquipmentDetail>(res.data);
  },

  async updateEquipment(
    id: string,
    payload: Partial<EquipmentFormPayload>
  ): Promise<AdminEquipmentDetail> {
    const res = await adminApi.patch(`${BASE}/${id}`, payload);
    return unwrap<AdminEquipmentDetail>(res.data);
  },

  /** Retire (soft-delete → status=RETIRED). */
  async retireEquipment(id: string): Promise<void> {
    await adminApi.delete(`${BASE}/${id}`);
  },

  // --- Maintenance -----------------------------------------------------------

  async getMaintenance(id: string): Promise<MaintenanceItem[]> {
    const res = await adminApi.get(`${BASE}/${id}/maintenance`);
    const data = unwrap<MaintenanceItem[] | { items?: MaintenanceItem[] }>(res.data);
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async scheduleMaintenance(
    id: string,
    payload: ScheduleMaintenancePayload
  ): Promise<void> {
    await adminApi.post(`${BASE}/${id}/maintenance`, payload);
  },

  async completeMaintenance(id: string, mIndex: number): Promise<void> {
    await adminApi.patch(`${BASE}/${id}/maintenance/${mIndex}/complete`);
  },

  // --- Bookings --------------------------------------------------------------

  async listBookings(
    params: AdminBookingListFilters = {}
  ): Promise<Paginated<EquipmentBooking>> {
    const res = await adminApi.get(`${BASE}/bookings`, { params });
    const data = unwrap<EquipmentBooking[] | Partial<Paginated<EquipmentBooking>>>(
      res.data
    );
    return toPaginated<EquipmentBooking>(data, params.page ?? 1, params.limit ?? 20);
  },

  async getBooking(id: string): Promise<EquipmentBooking> {
    const res = await adminApi.get(`${BASE}/bookings/${id}`);
    return unwrap<EquipmentBooking>(res.data);
  },

  async getBookingTracking(id: string): Promise<TrackingSnapshot> {
    const res = await adminApi.get(`${BASE}/bookings/${id}/tracking`);
    return unwrap<TrackingSnapshot>(res.data);
  },

  async approveBooking(
    id: string,
    payload: ApproveBookingPayload
  ): Promise<ApproveBookingResult> {
    const res = await adminApi.post(`${BASE}/bookings/${id}/approve`, payload);
    return unwrap<ApproveBookingResult>(res.data);
  },

  async rejectBooking(id: string, reason: string): Promise<EquipmentBooking> {
    const res = await adminApi.post(`${BASE}/bookings/${id}/reject`, { reason });
    return unwrap<EquipmentBooking>(res.data);
  },

  async handoverBooking(
    id: string,
    payload: HandoverBookingPayload = {}
  ): Promise<EquipmentBooking> {
    const res = await adminApi.post(`${BASE}/bookings/${id}/handover`, payload);
    return unwrap<EquipmentBooking>(res.data);
  },

  async completeBooking(
    id: string,
    payload: CompleteBookingPayload
  ): Promise<CompleteBookingResult> {
    const res = await adminApi.post(`${BASE}/bookings/${id}/complete`, payload);
    return unwrap<CompleteBookingResult>(res.data);
  },

  async cancelBooking(id: string, reason: string): Promise<EquipmentBooking> {
    const res = await adminApi.post(`${BASE}/bookings/${id}/cancel`, { reason });
    return unwrap<EquipmentBooking>(res.data);
  },

  // --- Deposit settlement (Super-Admin) --------------------------------------

  async refundDeposit(id: string, payload: DepositRefundPayload): Promise<void> {
    await adminApi.post(`${BASE}/bookings/${id}/deposit/refund`, payload);
  },

  async deductDeposit(id: string, payload: DepositDeductPayload): Promise<void> {
    await adminApi.post(`${BASE}/bookings/${id}/deposit/deduct`, payload);
  },

  // --- GPS -------------------------------------------------------------------

  async liveFleet(): Promise<FleetLivePosition[]> {
    const res = await adminApi.get(`${BASE}/gps/live`);
    const data = unwrap<FleetLivePosition[] | { items?: FleetLivePosition[] }>(
      res.data
    );
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async liveOne(id: string): Promise<FleetLivePosition | null> {
    const res = await adminApi.get(`${BASE}/${id}/gps/live`);
    return unwrap<FleetLivePosition | null>(res.data);
  },

  async listAlerts(params: { acknowledged?: boolean } = {}): Promise<GpsAlert[]> {
    const res = await adminApi.get(`${BASE}/gps/alerts`, { params });
    const data = unwrap<GpsAlert[] | { items?: GpsAlert[] }>(res.data);
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async ackAlert(id: string): Promise<void> {
    await adminApi.post(`${BASE}/gps/alerts/${id}/ack`);
  },

  // --- Geofences -------------------------------------------------------------

  async listGeofences(): Promise<Geofence[]> {
    const res = await adminApi.get(`${BASE}/geofences`);
    const data = unwrap<Geofence[] | { items?: Geofence[] }>(res.data);
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async createGeofence(payload: GeofencePayload): Promise<Geofence> {
    const res = await adminApi.post(`${BASE}/geofences`, payload);
    return unwrap<Geofence>(res.data);
  },

  async updateGeofence(
    id: string,
    payload: Partial<GeofencePayload>
  ): Promise<Geofence> {
    const res = await adminApi.patch(`${BASE}/geofences/${id}`, payload);
    return unwrap<Geofence>(res.data);
  },

  async deleteGeofence(id: string): Promise<void> {
    await adminApi.delete(`${BASE}/geofences/${id}`);
  },

  // --- Rate config -----------------------------------------------------------

  async getRateConfig(): Promise<RateConfigEntry[]> {
    const res = await adminApi.get(`${BASE}/rate-config`);
    const data = unwrap<RateConfigEntry[] | { items?: RateConfigEntry[] }>(res.data);
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async updateRateConfig(
    category: string,
    payload: RateConfigPayload
  ): Promise<RateConfigEntry> {
    const res = await adminApi.patch(`${BASE}/rate-config/${category}`, payload);
    return unwrap<RateConfigEntry>(res.data);
  },
};

/** Pull a friendly message (and EQP_ADM_* code) out of an axios/API error. */
export function extractAdminEquipmentError(
  err: unknown,
  fallback: string
): string {
  const ax = err as {
    response?: {
      data?: {
        error?: { code?: string; message?: string };
        message?: string | string[];
      };
    };
    message?: string;
  };
  const payload = ax?.response?.data;
  const apiErr = payload?.error;
  if (apiErr?.message) return apiErr.message;
  const msg = payload?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  if (ax?.message) return ax.message;
  return fallback;
}

export default adminEquipmentService;
