/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed ADMIN Equipment store (zustand) — source of truth for the
 * `/bennie/equipment-booking` fleet table, booking approval queue, live GPS
 * map, alerts, geofences and rate config, plus the `:id` equipment detail.
 * Talks to the backend via `src/services/adminEquipment.service.ts`
 * (`adminApi`, `/admin/equipment` base).
 *
 * Degrades gracefully: with no backend the store keeps empty collections, sets a
 * friendly error, and the UI renders loading/empty/error states (no crash).
 * Live GPS positions/alerts fold in via `applyLivePosition` / `pushAlert`.
 */

import { create } from "zustand";

import adminEquipmentService, {
  extractAdminEquipmentError,
} from "../services/adminEquipment.service";
import type {
  AdminBookingListFilters,
  AdminEquipmentDetail,
  AdminEquipmentListFilters,
  AdminLivePosition,
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
  LiveAlert,
  MaintenanceItem,
  Paginated,
  RateConfigEntry,
  RateConfigPayload,
  ScheduleMaintenancePayload,
} from "../types/adminEquipment";

type Status = "idle" | "loading" | "ready" | "error";

interface AdminEquipmentState {
  // Fleet directory.
  equipment: Equipment[];
  fleetTotal: number;
  fleetPage: number;
  fleetLimit: number;
  fleetFilters: AdminEquipmentListFilters;
  fleetStatus: Status;
  fleetError: string | null;

  // Bookings.
  bookings: EquipmentBooking[];
  bookingsTotal: number;
  bookingFilters: AdminBookingListFilters;
  bookingsStatus: Status;
  bookingsError: string | null;

  // Live GPS fleet snapshot (keyed by bookingId when active).
  livePositions: FleetLivePosition[];
  liveStatus: Status;

  // Alerts.
  alerts: GpsAlert[];
  alertsStatus: Status;

  // Geofences.
  geofences: Geofence[];
  geofencesStatus: Status;

  // Rate config.
  rateConfig: RateConfigEntry[];
  rateConfigStatus: Status;

  // Current equipment detail.
  currentId: string | null;
  detail: AdminEquipmentDetail | null;
  detailStatus: Status;
  detailError: string | null;
  maintenance: MaintenanceItem[];
  maintenanceLoaded: boolean;
}

interface AdminEquipmentActions {
  // Fleet.
  setFleetFilters: (patch: Partial<AdminEquipmentListFilters>) => void;
  fetchFleet: (opts?: { silent?: boolean }) => Promise<void>;
  createEquipment: (payload: EquipmentFormPayload) => Promise<AdminEquipmentDetail>;
  updateEquipment: (
    id: string,
    payload: Partial<EquipmentFormPayload>
  ) => Promise<void>;
  retireEquipment: (id: string) => Promise<void>;

  // Detail.
  loadEquipment: (id: string) => Promise<void>;
  refreshDetail: () => Promise<void>;
  clearDetail: () => void;
  fetchMaintenance: (id: string) => Promise<void>;
  scheduleMaintenance: (
    id: string,
    payload: ScheduleMaintenancePayload
  ) => Promise<void>;
  completeMaintenance: (id: string, mIndex: number) => Promise<void>;

  // Bookings.
  setBookingFilters: (patch: Partial<AdminBookingListFilters>) => void;
  fetchBookings: (opts?: { silent?: boolean }) => Promise<void>;
  approveBooking: (
    id: string,
    payload: ApproveBookingPayload
  ) => Promise<ApproveBookingResult>;
  rejectBooking: (id: string, reason: string) => Promise<void>;
  handoverBooking: (id: string, payload?: HandoverBookingPayload) => Promise<void>;
  completeBooking: (
    id: string,
    payload: CompleteBookingPayload
  ) => Promise<CompleteBookingResult>;
  cancelBooking: (id: string, reason: string) => Promise<void>;
  refundDeposit: (id: string, payload: DepositRefundPayload) => Promise<void>;
  deductDeposit: (id: string, payload: DepositDeductPayload) => Promise<void>;

  // GPS.
  fetchLiveFleet: (opts?: { silent?: boolean }) => Promise<void>;
  applyLivePosition: (payload: AdminLivePosition) => void;
  fetchAlerts: (opts?: { silent?: boolean }) => Promise<void>;
  pushAlert: (alert: LiveAlert) => void;
  ackAlert: (id: string) => Promise<void>;

  // Geofences.
  fetchGeofences: (opts?: { silent?: boolean }) => Promise<void>;
  createGeofence: (payload: GeofencePayload) => Promise<void>;
  updateGeofence: (id: string, payload: Partial<GeofencePayload>) => Promise<void>;
  deleteGeofence: (id: string) => Promise<void>;

  // Rate config.
  fetchRateConfig: (opts?: { silent?: boolean }) => Promise<void>;
  updateRateConfig: (category: string, payload: RateConfigPayload) => Promise<void>;

  /** Refresh the surfaces relevant to a live `equipment.*` notification. */
  applyNotification: (topic?: string) => void;

  reset: () => void;
}

export type AdminEquipmentStore = AdminEquipmentState & AdminEquipmentActions;

const INITIAL: AdminEquipmentState = {
  equipment: [],
  fleetTotal: 0,
  fleetPage: 1,
  fleetLimit: 12,
  fleetFilters: { page: 1, limit: 12 },
  fleetStatus: "idle",
  fleetError: null,

  bookings: [],
  bookingsTotal: 0,
  bookingFilters: { page: 1, limit: 20 },
  bookingsStatus: "idle",
  bookingsError: null,

  livePositions: [],
  liveStatus: "idle",

  alerts: [],
  alertsStatus: "idle",

  geofences: [],
  geofencesStatus: "idle",

  rateConfig: [],
  rateConfigStatus: "idle",

  currentId: null,
  detail: null,
  detailStatus: "idle",
  detailError: null,
  maintenance: [],
  maintenanceLoaded: false,
};

export const useAdminEquipmentStore = create<AdminEquipmentStore>()((set, get) => ({
  ...INITIAL,

  // --- Fleet -----------------------------------------------------------------

  setFleetFilters: (patch) =>
    set((prev) => ({ fleetFilters: { ...prev.fleetFilters, ...patch } })),

  fetchFleet: async (opts) => {
    if (!opts?.silent) set({ fleetStatus: "loading" });
    set({ fleetError: null });
    try {
      const { fleetFilters, fleetLimit } = get();
      const res: Paginated<Equipment> = await adminEquipmentService.listEquipment({
        limit: fleetLimit,
        ...fleetFilters,
      });
      set({
        equipment: res.items,
        fleetTotal: res.total,
        fleetPage: res.page,
        fleetLimit: res.limit,
        fleetStatus: "ready",
      });
    } catch (err) {
      set({
        fleetStatus: "error",
        fleetError: extractAdminEquipmentError(
          err,
          "Unable to load the equipment fleet right now."
        ),
      });
    }
  },

  createEquipment: async (payload) => {
    try {
      const detail = await adminEquipmentService.createEquipment(payload);
      void get().fetchFleet({ silent: true });
      return detail;
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not add the equipment.")
      );
    }
  },

  updateEquipment: async (id, payload) => {
    try {
      const detail = await adminEquipmentService.updateEquipment(id, payload);
      set((prev) => ({
        detail: prev.detail && prev.detail.id === id ? { ...prev.detail, ...detail } : prev.detail,
      }));
      void get().fetchFleet({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not update the equipment.")
      );
    }
  },

  retireEquipment: async (id) => {
    try {
      await adminEquipmentService.retireEquipment(id);
      void get().fetchFleet({ silent: true });
      void get().refreshDetail();
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not retire the equipment.")
      );
    }
  },

  // --- Detail ----------------------------------------------------------------

  loadEquipment: async (id) => {
    const switching = get().currentId !== id;
    set({
      currentId: id,
      detailStatus: "loading",
      detailError: null,
      ...(switching
        ? { detail: null, maintenance: [], maintenanceLoaded: false }
        : {}),
    });
    try {
      const detail = await adminEquipmentService.getEquipment(id);
      set({ detail, detailStatus: "ready" });
    } catch (err) {
      set({
        detailStatus: "error",
        detailError: extractAdminEquipmentError(
          err,
          "Unable to load this equipment right now."
        ),
      });
    }
  },

  refreshDetail: async () => {
    const id = get().currentId;
    if (!id) return;
    try {
      const detail = await adminEquipmentService.getEquipment(id);
      set({ detail, detailStatus: "ready" });
    } catch {
      /* keep last-known detail on transient failure */
    }
  },

  clearDetail: () =>
    set({
      currentId: null,
      detail: null,
      detailStatus: "idle",
      detailError: null,
      maintenance: [],
      maintenanceLoaded: false,
    }),

  fetchMaintenance: async (id) => {
    try {
      const maintenance = await adminEquipmentService.getMaintenance(id);
      set({ maintenance, maintenanceLoaded: true });
    } catch {
      set({ maintenance: [], maintenanceLoaded: true });
    }
  },

  scheduleMaintenance: async (id, payload) => {
    try {
      await adminEquipmentService.scheduleMaintenance(id, payload);
      void get().fetchMaintenance(id);
      void get().refreshDetail();
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not schedule maintenance.")
      );
    }
  },

  completeMaintenance: async (id, mIndex) => {
    try {
      await adminEquipmentService.completeMaintenance(id, mIndex);
      void get().fetchMaintenance(id);
      void get().refreshDetail();
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not complete the maintenance item.")
      );
    }
  },

  // --- Bookings --------------------------------------------------------------

  setBookingFilters: (patch) =>
    set((prev) => ({ bookingFilters: { ...prev.bookingFilters, ...patch } })),

  fetchBookings: async (opts) => {
    if (!opts?.silent) set({ bookingsStatus: "loading" });
    set({ bookingsError: null });
    try {
      const { bookingFilters } = get();
      const res = await adminEquipmentService.listBookings(bookingFilters);
      set({
        bookings: res.items,
        bookingsTotal: res.total,
        bookingsStatus: "ready",
      });
    } catch (err) {
      set({
        bookingsStatus: "error",
        bookingsError: extractAdminEquipmentError(
          err,
          "Unable to load bookings right now."
        ),
      });
    }
  },

  approveBooking: async (id, payload) => {
    try {
      const result = await adminEquipmentService.approveBooking(id, payload);
      void get().fetchBookings({ silent: true });
      return result;
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not approve the booking.")
      );
    }
  },

  rejectBooking: async (id, reason) => {
    try {
      await adminEquipmentService.rejectBooking(id, reason);
      void get().fetchBookings({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not reject the booking.")
      );
    }
  },

  handoverBooking: async (id, payload) => {
    try {
      await adminEquipmentService.handoverBooking(id, payload);
      void get().fetchBookings({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not hand over the equipment.")
      );
    }
  },

  completeBooking: async (id, payload) => {
    try {
      const result = await adminEquipmentService.completeBooking(id, payload);
      void get().fetchBookings({ silent: true });
      void get().refreshDetail();
      return result;
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not complete the booking.")
      );
    }
  },

  cancelBooking: async (id, reason) => {
    try {
      await adminEquipmentService.cancelBooking(id, reason);
      void get().fetchBookings({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not cancel the booking.")
      );
    }
  },

  refundDeposit: async (id, payload) => {
    try {
      await adminEquipmentService.refundDeposit(id, payload);
      void get().fetchBookings({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not refund the deposit.")
      );
    }
  },

  deductDeposit: async (id, payload) => {
    try {
      await adminEquipmentService.deductDeposit(id, payload);
      void get().fetchBookings({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not record the deduction.")
      );
    }
  },

  // --- GPS -------------------------------------------------------------------

  fetchLiveFleet: async (opts) => {
    if (!opts?.silent) set({ liveStatus: "loading" });
    try {
      const livePositions = await adminEquipmentService.liveFleet();
      set({ livePositions, liveStatus: "ready" });
    } catch {
      set({ livePositions: [], liveStatus: "error" });
    }
  },

  applyLivePosition: (payload) => {
    if (!payload?.bookingId) return;
    set((prev) => {
      const idx = prev.livePositions.findIndex(
        (p) => p.bookingId === payload.bookingId
      );
      const nextPos = {
        lat: payload.lat,
        lng: payload.lng,
        heading: payload.heading,
        speed: payload.speed,
        at: payload.at,
      };
      if (idx === -1) {
        return {
          livePositions: [
            ...prev.livePositions,
            {
              equipmentId: payload.equipmentId ?? "",
              bookingId: payload.bookingId,
              position: nextPos,
            },
          ],
        };
      }
      const copy = [...prev.livePositions];
      copy[idx] = { ...copy[idx], position: nextPos };
      return { livePositions: copy };
    });
  },

  fetchAlerts: async (opts) => {
    if (!opts?.silent) set({ alertsStatus: "loading" });
    try {
      const alerts = await adminEquipmentService.listAlerts();
      set({ alerts, alertsStatus: "ready" });
    } catch {
      set({ alerts: [], alertsStatus: "error" });
    }
  },

  pushAlert: (alert) => {
    // Fold a live alert to the top of the list (synthetic id until refetch).
    set((prev) => ({
      alerts: [
        {
          id: `live-${alert.bookingId}-${Date.now()}`,
          equipmentId: alert.equipmentId ?? "",
          bookingId: alert.bookingId,
          type: alert.type,
          detail: alert.detail,
          position: alert.position,
          createdAt: new Date().toISOString(),
        },
        ...prev.alerts,
      ],
    }));
    void get().fetchAlerts({ silent: true });
  },

  ackAlert: async (id) => {
    try {
      await adminEquipmentService.ackAlert(id);
      set((prev) => ({
        alerts: prev.alerts.map((a) =>
          a.id === id
            ? { ...a, acknowledgedAt: new Date().toISOString() }
            : a
        ),
      }));
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not acknowledge the alert.")
      );
    }
  },

  // --- Geofences -------------------------------------------------------------

  fetchGeofences: async (opts) => {
    if (!opts?.silent) set({ geofencesStatus: "loading" });
    try {
      const geofences = await adminEquipmentService.listGeofences();
      set({ geofences, geofencesStatus: "ready" });
    } catch {
      set({ geofences: [], geofencesStatus: "error" });
    }
  },

  createGeofence: async (payload) => {
    try {
      await adminEquipmentService.createGeofence(payload);
      void get().fetchGeofences({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not create the geofence.")
      );
    }
  },

  updateGeofence: async (id, payload) => {
    try {
      await adminEquipmentService.updateGeofence(id, payload);
      void get().fetchGeofences({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not update the geofence.")
      );
    }
  },

  deleteGeofence: async (id) => {
    try {
      await adminEquipmentService.deleteGeofence(id);
      void get().fetchGeofences({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not delete the geofence.")
      );
    }
  },

  // --- Rate config -----------------------------------------------------------

  fetchRateConfig: async (opts) => {
    if (!opts?.silent) set({ rateConfigStatus: "loading" });
    try {
      const rateConfig = await adminEquipmentService.getRateConfig();
      set({ rateConfig, rateConfigStatus: "ready" });
    } catch {
      set({ rateConfig: [], rateConfigStatus: "error" });
    }
  },

  updateRateConfig: async (category, payload) => {
    try {
      const updated = await adminEquipmentService.updateRateConfig(
        category,
        payload
      );
      set((prev) => ({
        rateConfig: prev.rateConfig.some((r) => r.category === category)
          ? prev.rateConfig.map((r) =>
              r.category === category ? { ...r, ...updated } : r
            )
          : [...prev.rateConfig, updated],
      }));
    } catch (err) {
      throw new Error(
        extractAdminEquipmentError(err, "Could not update the rate config.")
      );
    }
  },

  // --- Live notifications ----------------------------------------------------

  applyNotification: (topic) => {
    // A background equipment.* event — nudge the relevant loaded surfaces.
    if (get().fleetStatus === "ready") void get().fetchFleet({ silent: true });
    if (get().bookingsStatus === "ready") void get().fetchBookings({ silent: true });
    if (topic?.includes("alert") && get().alertsStatus === "ready") {
      void get().fetchAlerts({ silent: true });
    }
    void get().refreshDetail();
  },

  reset: () => set({ ...INITIAL }),
}));

export default useAdminEquipmentStore;
