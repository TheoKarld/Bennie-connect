/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typed REST client for the LIVE Equipment Booking + GPS module
 * (base `/api/v1/equipment`).
 *
 * Every endpoint requires the user JWT (attached by `src/lib/api.ts`) and
 * returns the `{ success, data }` envelope. Each helper unwraps `.data`. Errors
 * bubble up as axios errors so the store can surface `EQP_*` codes/messages from
 * `{ success:false, error:{ code, message, details } }`.
 *
 * Admin-dev: reuse the TYPES (`src/types/equipment.ts`) and this shape as a
 * reference, but build an admin-plane service against `adminApi`.
 */

import api from "../lib/api";
import type {
  CreateBookingPayload,
  Equipment,
  EquipmentBooking,
  EquipmentCategory,
  EquipmentListFilters,
  Paginated,
  PayResult,
  TrackingSnapshot,
} from "../types/equipment";

/** Unwrap `{ success, data }`; tolerate a bare payload defensively. */
function unwrap<T>(payload: unknown): T {
  const body = payload as { data?: T } | T;
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/**
 * Normalise a raw fleet item — the server may use `name`/`category` or
 * `equipmentName`/`equipmentCategory`. Consumers read `equipmentName`/`category`.
 */
function normalizeEquipment(raw: Record<string, unknown>): Equipment {
  const equipmentName =
    (raw.equipmentName as string) ?? (raw.name as string) ?? "Equipment";
  const category =
    ((raw.category as EquipmentCategory) ??
      (raw.equipmentCategory as EquipmentCategory) ??
      "OTHER") as EquipmentCategory;
  const images = Array.isArray(raw.images) ? (raw.images as string[]) : [];
  return {
    ...(raw as unknown as Equipment),
    id: (raw.id as string) ?? (raw._id as string) ?? "",
    equipmentName,
    category,
    images,
    hourlyRate: Number(raw.hourlyRate ?? 0),
    dailyRate: Number(raw.dailyRate ?? 0),
    depositRequired: Number(raw.depositRequired ?? 0),
  };
}

/** Normalise a raw booking id (`id` or `_id`). */
function normalizeBooking(raw: Record<string, unknown>): EquipmentBooking {
  return {
    ...(raw as unknown as EquipmentBooking),
    id: (raw.id as string) ?? (raw._id as string) ?? "",
  };
}

const BASE = "/equipment";

export const equipmentService = {
  // --- Fleet -----------------------------------------------------------------

  async listEquipment(
    filters: EquipmentListFilters = {}
  ): Promise<Paginated<Equipment>> {
    const params: Record<string, string | number> = {};
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    if (filters.category) params.category = filters.category;
    if (filters.q) params.q = filters.q;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (typeof filters.minRate === "number") params.minRate = filters.minRate;
    if (typeof filters.maxRate === "number") params.maxRate = filters.maxRate;
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.order) params.order = filters.order;

    const res = await api.get(BASE, { params });
    const data = unwrap<Paginated<Record<string, unknown>>>(res.data);
    return {
      items: (data.items ?? []).map(normalizeEquipment),
      total: data.total ?? 0,
      page: data.page ?? filters.page ?? 1,
      limit: data.limit ?? filters.limit ?? 20,
    };
  },

  async getEquipment(id: string): Promise<Equipment> {
    const res = await api.get(`${BASE}/${id}`);
    return normalizeEquipment(unwrap<Record<string, unknown>>(res.data));
  },

  // --- Bookings --------------------------------------------------------------

  async createBooking(
    payload: CreateBookingPayload
  ): Promise<EquipmentBooking> {
    const res = await api.post(`${BASE}/bookings`, payload);
    return normalizeBooking(unwrap<Record<string, unknown>>(res.data));
  },

  async myBookings(
    filters: { page?: number; limit?: number; status?: string } = {}
  ): Promise<Paginated<EquipmentBooking>> {
    const res = await api.get(`${BASE}/my-bookings`, { params: filters });
    const data = unwrap<Paginated<Record<string, unknown>> | Record<string, unknown>[]>(
      res.data
    );
    if (Array.isArray(data)) {
      return {
        items: data.map(normalizeBooking),
        total: data.length,
        page: 1,
        limit: data.length,
      };
    }
    return {
      items: (data.items ?? []).map(normalizeBooking),
      total: data.total ?? 0,
      page: data.page ?? filters.page ?? 1,
      limit: data.limit ?? filters.limit ?? 20,
    };
  },

  async getBooking(id: string): Promise<EquipmentBooking> {
    const res = await api.get(`${BASE}/bookings/${id}`);
    return normalizeBooking(unwrap<Record<string, unknown>>(res.data));
  },

  async payBooking(id: string): Promise<PayResult> {
    const res = await api.post(`${BASE}/bookings/${id}/pay`, {});
    const data = unwrap<Record<string, unknown>>(res.data);
    // The server may return the booking fields at the top level with a nested
    // `wallet`, or a `{ booking, wallet }` envelope.
    const bookingRaw = (data.booking as Record<string, unknown>) ?? data;
    return {
      booking: normalizeBooking(bookingRaw),
      wallet: (data.wallet as PayResult["wallet"]) ?? null,
    };
  },

  async cancelBooking(id: string, reason?: string): Promise<EquipmentBooking> {
    const res = await api.post(`${BASE}/bookings/${id}/cancel`, { reason });
    return normalizeBooking(unwrap<Record<string, unknown>>(res.data));
  },

  async getTracking(id: string): Promise<TrackingSnapshot> {
    const res = await api.get(`${BASE}/bookings/${id}/tracking`);
    const data = unwrap<TrackingSnapshot>(res.data);
    return {
      ...data,
      bookingId: data.bookingId ?? id,
      gpsTracking: Array.isArray(data.gpsTracking) ? data.gpsTracking : [],
    };
  },

  async rateBooking(
    id: string,
    rating: number,
    comment?: string
  ): Promise<EquipmentBooking> {
    const res = await api.post(`${BASE}/bookings/${id}/rate`, {
      rating,
      comment,
    });
    return normalizeBooking(unwrap<Record<string, unknown>>(res.data));
  },
};

/** Pull a friendly message (and EQP_* code) out of an axios/API error. */
export function extractEquipmentError(err: unknown, fallback: string): string {
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

/** Pull the raw EQP_* / WALLET_* code out of an axios/API error, if present. */
export function extractEquipmentErrorCode(err: unknown): string | null {
  const ax = err as {
    response?: { data?: { error?: { code?: string } } };
  };
  return ax?.response?.data?.error?.code ?? null;
}

export default equipmentService;
