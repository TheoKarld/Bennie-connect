/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed Merchant Hub store (zustand) — status-driven onboarding (KYC),
 * listings, order fulfilment, earnings and manual payouts for `/app/merchant`.
 * Talks to the backend via `src/services/merchant.service.ts`.
 *
 * This replaces the mock "Merchant Portal" tab handlers that lived in
 * `appStore` (`handleMerchantAddProduct` / `handleMerchantUpdateStock` /
 * `handleMerchantUpdateOrderStatus`). Nothing persists to localStorage.
 */

import { create } from "zustand";

import merchantService, {
  extractMerchantError,
  extractMerchantErrorCode,
} from "../services/merchant.service";
import type {
  EarningEntry,
  EarningsSummary,
  MerchantKycPayload,
  MerchantMe,
  MerchantOrder,
  MerchantProduct,
  MerchantProductCreatePayload,
  MerchantProductUpdatePayload,
  PayoutBankDetails,
  PayoutRequest,
} from "../types/merchant";

type Status = "idle" | "loading" | "ready" | "error";

/** Error carrying the raw MERCH_* code for branch-specific UI. */
export class MerchantActionError extends Error {
  code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = "MerchantActionError";
    this.code = code;
  }
}

function shapeError(err: unknown, fallback: string): MerchantActionError {
  return new MerchantActionError(
    extractMerchantError(err, fallback),
    extractMerchantErrorCode(err)
  );
}

interface MerchantState {
  // Lifecycle (GET /merchant/me).
  me: MerchantMe | null;
  meStatus: Status;
  meError: string | null;
  savingKyc: boolean;

  // Listings.
  products: MerchantProduct[];
  productsTotal: number;
  productsStatus: Status;
  productsError: string | null;

  // Received orders.
  orders: MerchantOrder[];
  ordersTotal: number;
  ordersStatus: Status;
  ordersError: string | null;

  // Earnings.
  earningsSummary: EarningsSummary | null;
  earnings: EarningEntry[];
  earningsTotal: number;
  earningsStatus: Status;
  earningsError: string | null;

  // Payouts.
  payouts: PayoutRequest[];
  payoutsStatus: Status;
  payoutsError: string | null;
}

interface MerchantActions {
  fetchMe: (opts?: { silent?: boolean }) => Promise<void>;
  saveKyc: (payload: MerchantKycPayload) => Promise<MerchantMe>;

  fetchProducts: (opts?: { silent?: boolean }) => Promise<void>;
  createProduct: (
    payload: MerchantProductCreatePayload
  ) => Promise<MerchantProduct>;
  updateProduct: (
    id: string,
    payload: MerchantProductUpdatePayload
  ) => Promise<MerchantProduct>;
  deleteProduct: (id: string) => Promise<void>;

  fetchOrders: (opts?: { silent?: boolean; status?: string }) => Promise<void>;
  advanceOrder: (
    id: string,
    status: "PROCESSING" | "SHIPPED" | "DELIVERED"
  ) => Promise<MerchantOrder>;

  fetchEarnings: (opts?: { silent?: boolean }) => Promise<void>;
  fetchPayouts: (opts?: { silent?: boolean }) => Promise<void>;
  requestPayout: (
    amount: number,
    bankDetails: PayoutBankDetails
  ) => Promise<void>;
  cancelPayout: (id: string) => Promise<void>;
  confirmPayoutReceived: (id: string) => Promise<void>;

  reset: () => void;
}

export type MerchantStore = MerchantState & MerchantActions;

const INITIAL: MerchantState = {
  me: null,
  meStatus: "idle",
  meError: null,
  savingKyc: false,

  products: [],
  productsTotal: 0,
  productsStatus: "idle",
  productsError: null,

  orders: [],
  ordersTotal: 0,
  ordersStatus: "idle",
  ordersError: null,

  earningsSummary: null,
  earnings: [],
  earningsTotal: 0,
  earningsStatus: "idle",
  earningsError: null,

  payouts: [],
  payoutsStatus: "idle",
  payoutsError: null,
};

/** Upsert an order into the received-orders list. */
function upsertOrder(
  list: MerchantOrder[],
  order: MerchantOrder
): MerchantOrder[] {
  const idx = list.findIndex((o) => o.id === order.id);
  if (idx === -1) return [order, ...list];
  const next = [...list];
  next[idx] = { ...next[idx], ...order };
  return next;
}

export const useMerchantStore = create<MerchantStore>()((set, get) => ({
  ...INITIAL,

  // --- Lifecycle -----------------------------------------------------------------

  fetchMe: async (opts) => {
    if (!opts?.silent) set({ meStatus: "loading" });
    set({ meError: null });
    try {
      const me = await merchantService.me();
      set({ me, meStatus: "ready" });
    } catch (err) {
      set({
        meStatus: "error",
        meError: extractMerchantError(
          err,
          "Unable to load your merchant profile right now."
        ),
      });
    }
  },

  saveKyc: async (payload) => {
    set({ savingKyc: true });
    try {
      const me = await merchantService.saveKyc(payload);
      set({ me, meStatus: "ready", savingKyc: false });
      return me;
    } catch (err) {
      set({ savingKyc: false });
      throw shapeError(err, "Could not save your application.");
    }
  },

  // --- Listings -------------------------------------------------------------------

  fetchProducts: async (opts) => {
    if (!opts?.silent) set({ productsStatus: "loading" });
    set({ productsError: null });
    try {
      const res = await merchantService.listProducts({ limit: 100 });
      set({
        products: res.items,
        productsTotal: res.total,
        productsStatus: "ready",
      });
    } catch (err) {
      set({
        productsStatus: "error",
        productsError: extractMerchantError(
          err,
          "Unable to load your listings right now."
        ),
      });
    }
  },

  createProduct: async (payload) => {
    try {
      const product = await merchantService.createProduct(payload);
      set((prev) => ({
        products: [product, ...prev.products],
        productsTotal: prev.productsTotal + 1,
      }));
      void get().fetchMe({ silent: true });
      return product;
    } catch (err) {
      throw shapeError(err, "Could not create this listing.");
    }
  },

  updateProduct: async (id, payload) => {
    try {
      const product = await merchantService.updateProduct(id, payload);
      set((prev) => ({
        products: prev.products.map((p) =>
          p.id === id ? { ...p, ...product } : p
        ),
      }));
      return product;
    } catch (err) {
      throw shapeError(err, "Could not update this listing.");
    }
  },

  deleteProduct: async (id) => {
    try {
      await merchantService.deleteProduct(id);
      set((prev) => ({
        products: prev.products.filter((p) => p.id !== id),
        productsTotal: Math.max(0, prev.productsTotal - 1),
      }));
      void get().fetchMe({ silent: true });
    } catch (err) {
      throw shapeError(err, "Could not delete this listing.");
    }
  },

  // --- Orders --------------------------------------------------------------------

  fetchOrders: async (opts) => {
    if (!opts?.silent) set({ ordersStatus: "loading" });
    set({ ordersError: null });
    try {
      const res = await merchantService.listOrders({
        limit: 100,
        status: opts?.status,
      });
      set({ orders: res.items, ordersTotal: res.total, ordersStatus: "ready" });
    } catch (err) {
      set({
        ordersStatus: "error",
        ordersError: extractMerchantError(
          err,
          "Unable to load your orders right now."
        ),
      });
    }
  },

  advanceOrder: async (id, status) => {
    try {
      const order = await merchantService.advanceFulfillment(id, status);
      set((prev) => ({ orders: upsertOrder(prev.orders, order) }));
      if (status === "DELIVERED") {
        // DELIVERED books earnings — refresh the money surfaces.
        void get().fetchEarnings({ silent: true });
        void get().fetchMe({ silent: true });
      }
      return order;
    } catch (err) {
      throw shapeError(err, "Could not update this order.");
    }
  },

  // --- Earnings & payouts -----------------------------------------------------------

  fetchEarnings: async (opts) => {
    if (!opts?.silent) set({ earningsStatus: "loading" });
    set({ earningsError: null });
    try {
      const res = await merchantService.earnings({ limit: 50 });
      set({
        earningsSummary: res.summary,
        earnings: res.entries,
        earningsTotal: res.total,
        earningsStatus: "ready",
      });
    } catch (err) {
      set({
        earningsStatus: "error",
        earningsError: extractMerchantError(
          err,
          "Unable to load your earnings right now."
        ),
      });
    }
  },

  fetchPayouts: async (opts) => {
    if (!opts?.silent) set({ payoutsStatus: "loading" });
    set({ payoutsError: null });
    try {
      const payouts = await merchantService.listPayoutRequests();
      set({ payouts, payoutsStatus: "ready" });
    } catch (err) {
      set({
        payoutsStatus: "error",
        payoutsError: extractMerchantError(
          err,
          "Unable to load your payout history right now."
        ),
      });
    }
  },

  requestPayout: async (amount, bankDetails) => {
    try {
      const result = await merchantService.createPayoutRequest(
        amount,
        bankDetails
      );
      set((prev) => ({
        payouts: [result.request, ...prev.payouts],
        earningsSummary: prev.earningsSummary
          ? { ...prev.earningsSummary, ...result.summary }
          : prev.earningsSummary,
      }));
      void get().fetchMe({ silent: true });
      void get().fetchEarnings({ silent: true });
    } catch (err) {
      throw shapeError(err, "Could not request this payout.");
    }
  },

  cancelPayout: async (id) => {
    try {
      const payout = await merchantService.cancelPayoutRequest(id);
      set((prev) => ({
        payouts: prev.payouts.map((p) => (p.id === id ? { ...p, ...payout } : p)),
      }));
      void get().fetchMe({ silent: true });
      void get().fetchEarnings({ silent: true });
    } catch (err) {
      throw shapeError(err, "Could not cancel this payout request.");
    }
  },

  confirmPayoutReceived: async (id) => {
    try {
      const payout = await merchantService.confirmPayoutReceived(id);
      set((prev) => ({
        payouts: prev.payouts.map((p) => (p.id === id ? { ...p, ...payout } : p)),
      }));
      void get().fetchMe({ silent: true });
      void get().fetchEarnings({ silent: true });
    } catch (err) {
      throw shapeError(err, "Could not confirm this payout.");
    }
  },

  reset: () => set({ ...INITIAL }),
}));

export default useMerchantStore;
