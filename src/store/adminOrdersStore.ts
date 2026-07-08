/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed ADMIN orders store (zustand) — source of truth for the
 * `/bennie/orders` table + the `:id` order detail. Talks to the backend via
 * `src/services/adminOrders.service.ts` (`adminApi`, `/admin/orders` base).
 *
 * Degrades gracefully: with no backend the store keeps empty collections, sets
 * a friendly error, and the UI renders loading/empty/error states (no crash).
 */

import { create } from "zustand";

import adminOrdersService, {
  extractAdminOrdersError,
} from "../services/adminOrders.service";
import type {
  AdminOrderDetail,
  AdminOrderListFilters,
  AdminOrderRow,
  CancelOrderPayload,
  CheckoutGroupView,
  FulfillmentPayload,
  RefundOrderPayload,
  RefundResult,
} from "../types/adminMarketplace";

type Status = "idle" | "loading" | "ready" | "error";

interface State {
  orders: AdminOrderRow[];
  ordersTotal: number;
  ordersPage: number;
  ordersLimit: number;
  orderFilters: AdminOrderListFilters;
  ordersStatus: Status;
  ordersError: string | null;

  currentId: string | null;
  detail: AdminOrderDetail | null;
  detailStatus: Status;
  detailError: string | null;

  /** Sibling-order group for the ribbon, keyed off the current order. */
  group: CheckoutGroupView | null;
}

interface Actions {
  setOrderFilters: (patch: Partial<AdminOrderListFilters>) => void;
  fetchOrders: (opts?: { silent?: boolean }) => Promise<void>;

  loadOrder: (id: string) => Promise<void>;
  refreshDetail: () => Promise<void>;
  clearDetail: () => void;

  loadCheckoutGroup: (checkoutGroupId: string) => Promise<void>;

  updateFulfillment: (id: string, payload: FulfillmentPayload) => Promise<void>;
  cancelOrder: (id: string, payload: CancelOrderPayload) => Promise<void>;
  refundOrder: (id: string, payload: RefundOrderPayload) => Promise<RefundResult>;

  reset: () => void;
}

export type AdminOrdersStore = State & Actions;

const INITIAL: State = {
  orders: [],
  ordersTotal: 0,
  ordersPage: 1,
  ordersLimit: 20,
  orderFilters: { page: 1, limit: 20 },
  ordersStatus: "idle",
  ordersError: null,

  currentId: null,
  detail: null,
  detailStatus: "idle",
  detailError: null,

  group: null,
};

export const useAdminOrdersStore = create<AdminOrdersStore>()((set, get) => ({
  ...INITIAL,

  setOrderFilters: (patch) =>
    set((prev) => ({ orderFilters: { ...prev.orderFilters, ...patch } })),

  fetchOrders: async (opts) => {
    if (!opts?.silent) set({ ordersStatus: "loading" });
    set({ ordersError: null });
    try {
      const { orderFilters, ordersLimit } = get();
      const res = await adminOrdersService.listOrders({
        limit: ordersLimit,
        ...orderFilters,
      });
      set({
        orders: res.items,
        ordersTotal: res.total,
        ordersPage: res.page,
        ordersLimit: res.limit,
        ordersStatus: "ready",
      });
    } catch (err) {
      set({
        ordersStatus: "error",
        ordersError: extractAdminOrdersError(
          err,
          "Unable to load orders right now."
        ),
      });
    }
  },

  loadOrder: async (id) => {
    const switching = get().currentId !== id;
    set({
      currentId: id,
      detailStatus: "loading",
      detailError: null,
      ...(switching ? { detail: null, group: null } : {}),
    });
    try {
      const detail = await adminOrdersService.getOrder(id);
      set({ detail, detailStatus: "ready" });
    } catch (err) {
      set({
        detailStatus: "error",
        detailError: extractAdminOrdersError(
          err,
          "Unable to load this order right now."
        ),
      });
    }
  },

  refreshDetail: async () => {
    const id = get().currentId;
    if (!id) return;
    try {
      const detail = await adminOrdersService.getOrder(id);
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
      group: null,
    }),

  loadCheckoutGroup: async (checkoutGroupId) => {
    try {
      const group = await adminOrdersService.getCheckoutGroup(checkoutGroupId);
      set({ group });
    } catch {
      set({ group: null });
    }
  },

  updateFulfillment: async (id, payload) => {
    try {
      const detail = await adminOrdersService.updateFulfillment(id, payload);
      set({ detail });
      void get().fetchOrders({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminOrdersError(err, "Could not update fulfilment.")
      );
    }
  },

  cancelOrder: async (id, payload) => {
    try {
      await adminOrdersService.cancelOrder(id, payload);
      void get().refreshDetail();
      void get().fetchOrders({ silent: true });
    } catch (err) {
      throw new Error(extractAdminOrdersError(err, "Could not cancel the order."));
    }
  },

  refundOrder: async (id, payload) => {
    try {
      const result = await adminOrdersService.refundOrder(id, payload);
      void get().refreshDetail();
      void get().fetchOrders({ silent: true });
      return result;
    } catch (err) {
      throw new Error(extractAdminOrdersError(err, "Could not process the refund."));
    }
  },

  reset: () => set({ ...INITIAL }),
}));

export default useAdminOrdersStore;
