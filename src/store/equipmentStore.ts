/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed Equipment Booking store (zustand) — the source of truth for the
 * routed, LIVE equipment surface (`/app/equipment`, `/app/equipment/bookings`,
 * `/app/equipment/bookings/:id/track`). Talks to the backend via
 * `src/services/equipment.service.ts`.
 *
 * This SUPERSEDES the mock `appStore` AgriBooking handlers — no localStorage
 * seeding, no simulated GPS, no client-side cost math (the server computes
 * rental/deposit/total). Live `equipment:position:new` socket events fold in via
 * `applyLivePosition`.
 *
 * Degrades gracefully: with no backend the store keeps empty collections, sets a
 * friendly `error`, and the UI renders loading/empty/error states (no crash, no
 * console spew).
 */

import { create } from "zustand";

import equipmentService, {
  extractEquipmentError,
  extractEquipmentErrorCode,
} from "../services/equipment.service";
import type {
  CreateBookingPayload,
  Equipment,
  EquipmentBooking,
  EquipmentListFilters,
  GpsPosition,
  LivePosition,
  PayResult,
  TrackingSnapshot,
} from "../types/equipment";
import { useWalletStore } from "./walletStore";

type Status = "idle" | "loading" | "ready" | "error";

/** Max points kept in the live trail so the polyline stays cheap to render. */
const MAX_TRAIL = 200;

interface EquipmentState {
  // Fleet list.
  equipment: Equipment[];
  total: number;
  filters: EquipmentListFilters;
  listStatus: Status;
  listError: string | null;

  // My bookings.
  myBookings: EquipmentBooking[];
  bookingsStatus: Status;
  bookingsError: string | null;

  // Current booking (detail / tracking page).
  currentBooking: EquipmentBooking | null;
  currentStatus: Status;
  currentError: string | null;

  // Live tracking.
  tracking: TrackingSnapshot | null;
  trackingStatus: Status;
  trackingError: string | null;
}

interface EquipmentActions {
  // Fleet.
  setFilters: (patch: Partial<EquipmentListFilters>) => void;
  fetchEquipment: (opts?: { silent?: boolean }) => Promise<void>;

  // Bookings.
  createBooking: (payload: CreateBookingPayload) => Promise<EquipmentBooking>;
  fetchMyBookings: (opts?: {
    silent?: boolean;
    status?: string;
  }) => Promise<void>;
  loadBooking: (id: string) => Promise<void>;
  clearCurrent: () => void;
  payBooking: (id: string) => Promise<PayResult>;
  cancelBooking: (id: string, reason?: string) => Promise<void>;
  rateBooking: (id: string, rating: number, comment?: string) => Promise<void>;

  // Tracking.
  loadTracking: (id: string) => Promise<void>;
  applyLivePosition: (pos: LivePosition) => void;
  clearTracking: () => void;

  reset: () => void;
}

export type EquipmentStore = EquipmentState & EquipmentActions;

const DEFAULT_FILTERS: EquipmentListFilters = {
  page: 1,
  limit: 12,
  category: "",
  q: "",
  sortBy: "dailyRate",
  order: "asc",
};

const INITIAL: EquipmentState = {
  equipment: [],
  total: 0,
  filters: { ...DEFAULT_FILTERS },
  listStatus: "idle",
  listError: null,

  myBookings: [],
  bookingsStatus: "idle",
  bookingsError: null,

  currentBooking: null,
  currentStatus: "idle",
  currentError: null,

  tracking: null,
  trackingStatus: "idle",
  trackingError: null,
};

/** Merge a fresh booking into the myBookings list (upsert). */
function upsertBooking(
  list: EquipmentBooking[],
  booking: EquipmentBooking
): EquipmentBooking[] {
  const idx = list.findIndex((b) => b.id === booking.id);
  if (idx === -1) return [booking, ...list];
  const next = [...list];
  next[idx] = { ...next[idx], ...booking };
  return next;
}

export const useEquipmentStore = create<EquipmentStore>()((set, get) => ({
  ...INITIAL,

  // --- Fleet -----------------------------------------------------------------

  setFilters: (patch) =>
    set((prev) => ({
      filters: {
        ...prev.filters,
        ...patch,
        // Any filter change (other than an explicit page) resets to page 1.
        page: patch.page ?? 1,
      },
    })),

  fetchEquipment: async (opts) => {
    if (!opts?.silent) set({ listStatus: "loading" });
    set({ listError: null });
    try {
      const res = await equipmentService.listEquipment(get().filters);
      set({
        equipment: res.items,
        total: res.total,
        listStatus: "ready",
      });
    } catch (err) {
      set({
        listStatus: "error",
        listError: extractEquipmentError(
          err,
          "Unable to load equipment right now."
        ),
      });
    }
  },

  // --- Bookings --------------------------------------------------------------

  createBooking: async (payload) => {
    try {
      const booking = await equipmentService.createBooking(payload);
      set((prev) => ({
        myBookings: upsertBooking(prev.myBookings, booking),
      }));
      return booking;
    } catch (err) {
      throw new Error(
        extractEquipmentError(err, "Could not request this booking.")
      );
    }
  },

  fetchMyBookings: async (opts) => {
    if (!opts?.silent) set({ bookingsStatus: "loading" });
    set({ bookingsError: null });
    try {
      const res = await equipmentService.myBookings({
        status: opts?.status,
        limit: 50,
      });
      set({ myBookings: res.items, bookingsStatus: "ready" });
    } catch (err) {
      set({
        bookingsStatus: "error",
        bookingsError: extractEquipmentError(
          err,
          "Unable to load your bookings right now."
        ),
      });
    }
  },

  loadBooking: async (id) => {
    const switching = get().currentBooking?.id !== id;
    set({
      currentStatus: "loading",
      currentError: null,
      ...(switching ? { currentBooking: null } : {}),
    });
    try {
      const booking = await equipmentService.getBooking(id);
      set((prev) => ({
        currentBooking: booking,
        currentStatus: "ready",
        myBookings: upsertBooking(prev.myBookings, booking),
      }));
    } catch (err) {
      set({
        currentStatus: "error",
        currentError: extractEquipmentError(
          err,
          "Unable to load this booking right now."
        ),
      });
    }
  },

  clearCurrent: () =>
    set({ currentBooking: null, currentStatus: "idle", currentError: null }),

  payBooking: async (id) => {
    try {
      const result = await equipmentService.payBooking(id);
      set((prev) => ({
        myBookings: upsertBooking(prev.myBookings, result.booking),
        currentBooking:
          prev.currentBooking?.id === id
            ? { ...prev.currentBooking, ...result.booking }
            : prev.currentBooking,
      }));
      // Reflect the new wallet balance immediately, then reconcile from source.
      void useWalletStore.getState().fetchWallet({ silent: true });
      return result;
    } catch (err) {
      const code = extractEquipmentErrorCode(err);
      const message = extractEquipmentError(
        err,
        "Payment could not be completed."
      );
      // Surface EQP_009 (insufficient funds) distinctly for the UI.
      const e = new Error(message) as Error & { code?: string };
      if (code) e.code = code;
      throw e;
    }
  },

  cancelBooking: async (id, reason) => {
    try {
      const booking = await equipmentService.cancelBooking(id, reason);
      set((prev) => ({
        myBookings: upsertBooking(prev.myBookings, booking),
        currentBooking:
          prev.currentBooking?.id === id
            ? { ...prev.currentBooking, ...booking }
            : prev.currentBooking,
      }));
      // A cancellation after payment refunds the wallet.
      void useWalletStore.getState().fetchWallet({ silent: true });
    } catch (err) {
      throw new Error(
        extractEquipmentError(err, "Could not cancel this booking.")
      );
    }
  },

  rateBooking: async (id, rating, comment) => {
    try {
      const booking = await equipmentService.rateBooking(id, rating, comment);
      set((prev) => ({
        myBookings: upsertBooking(prev.myBookings, booking),
        currentBooking:
          prev.currentBooking?.id === id
            ? { ...prev.currentBooking, ...booking }
            : prev.currentBooking,
      }));
    } catch (err) {
      throw new Error(
        extractEquipmentError(err, "Could not submit your rating.")
      );
    }
  },

  // --- Tracking --------------------------------------------------------------

  loadTracking: async (id) => {
    const switching = get().tracking?.bookingId !== id;
    set({
      trackingStatus: "loading",
      trackingError: null,
      ...(switching ? { tracking: null } : {}),
    });
    try {
      const snapshot = await equipmentService.getTracking(id);
      set({ tracking: snapshot, trackingStatus: "ready" });
    } catch (err) {
      set({
        trackingStatus: "error",
        trackingError: extractEquipmentError(
          err,
          "Unable to load live tracking right now."
        ),
      });
    }
  },

  applyLivePosition: (pos) => {
    set((prev) => {
      if (!prev.tracking || prev.tracking.bookingId !== pos.bookingId) {
        return {};
      }
      const point: GpsPosition = {
        lat: pos.lat,
        lng: pos.lng,
        heading: pos.heading,
        speed: pos.speed,
        at: pos.at,
      };
      const trail = [...prev.tracking.gpsTracking, point];
      if (trail.length > MAX_TRAIL) trail.splice(0, trail.length - MAX_TRAIL);
      return {
        tracking: {
          ...prev.tracking,
          currentPosition: point,
          gpsTracking: trail,
        },
      };
    });
  },

  clearTracking: () =>
    set({ tracking: null, trackingStatus: "idle", trackingError: null }),

  reset: () => set({ ...INITIAL, filters: { ...DEFAULT_FILTERS } }),
}));

export default useEquipmentStore;
