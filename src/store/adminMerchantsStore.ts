/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed ADMIN merchants store (zustand) — source of truth for the
 * `/bennie/merchants` directory, the cross-merchant payout queue, and the
 * `:id` merchant detail (KYC review, earnings ledger, payout requests). Talks
 * to the backend via `src/services/adminMerchants.service.ts` (`adminApi`,
 * `/admin/merchants` base).
 *
 * Degrades gracefully: with no backend the store keeps empty collections, sets
 * a friendly error, and the UI renders loading/empty/error states (no crash).
 */

import { create } from "zustand";

import adminMerchantsService, {
  extractAdminMerchantsError,
} from "../services/adminMerchants.service";
import type {
  AdminMerchantDetail,
  AdminMerchantListFilters,
  AdminMerchantRow,
  AdminPayoutRequest,
  EarningsFilters,
  MarkPayoutSentPayload,
  MarkPayoutSentResult,
  MerchantEarningsPage,
  PayoutQueueFilters,
} from "../types/adminMarketplace";

type Status = "idle" | "loading" | "ready" | "error";

interface State {
  merchants: AdminMerchantRow[];
  merchantsTotal: number;
  merchantsPage: number;
  merchantsLimit: number;
  merchantFilters: AdminMerchantListFilters;
  merchantsStatus: Status;
  merchantsError: string | null;

  // Cross-merchant payout queue.
  payoutQueue: AdminPayoutRequest[];
  payoutQueueTotal: number;
  payoutQueueStatus: Status;

  // Detail.
  currentId: string | null;
  detail: AdminMerchantDetail | null;
  detailStatus: Status;
  detailError: string | null;

  earnings: MerchantEarningsPage | null;
  earningsStatus: Status;

  merchantPayouts: AdminPayoutRequest[];
  merchantPayoutsStatus: Status;
}

interface Actions {
  setMerchantFilters: (patch: Partial<AdminMerchantListFilters>) => void;
  fetchMerchants: (opts?: { silent?: boolean }) => Promise<void>;

  fetchPayoutQueue: (
    params?: PayoutQueueFilters & { silent?: boolean }
  ) => Promise<void>;

  loadMerchant: (id: string) => Promise<void>;
  refreshDetail: () => Promise<void>;
  clearDetail: () => void;

  fetchEarnings: (id: string, params?: EarningsFilters) => Promise<void>;
  fetchMerchantPayouts: (id: string) => Promise<void>;

  approveMerchant: (id: string) => Promise<void>;
  rejectMerchant: (id: string, reason: string) => Promise<void>;
  suspendMerchant: (id: string, reason: string) => Promise<void>;
  reinstateMerchant: (id: string) => Promise<void>;

  markPayoutSent: (
    reqId: string,
    payload: MarkPayoutSentPayload
  ) => Promise<MarkPayoutSentResult>;
  cancelPayout: (reqId: string, reason: string) => Promise<void>;

  reset: () => void;
}

export type AdminMerchantsStore = State & Actions;

const INITIAL: State = {
  merchants: [],
  merchantsTotal: 0,
  merchantsPage: 1,
  merchantsLimit: 20,
  merchantFilters: { page: 1, limit: 20 },
  merchantsStatus: "idle",
  merchantsError: null,

  payoutQueue: [],
  payoutQueueTotal: 0,
  payoutQueueStatus: "idle",

  currentId: null,
  detail: null,
  detailStatus: "idle",
  detailError: null,

  earnings: null,
  earningsStatus: "idle",

  merchantPayouts: [],
  merchantPayoutsStatus: "idle",
};

export const useAdminMerchantsStore = create<AdminMerchantsStore>()(
  (set, get) => ({
    ...INITIAL,

    // --- Directory -----------------------------------------------------------

    setMerchantFilters: (patch) =>
      set((prev) => ({
        merchantFilters: { ...prev.merchantFilters, ...patch },
      })),

    fetchMerchants: async (opts) => {
      if (!opts?.silent) set({ merchantsStatus: "loading" });
      set({ merchantsError: null });
      try {
        const { merchantFilters, merchantsLimit } = get();
        const res = await adminMerchantsService.listMerchants({
          limit: merchantsLimit,
          ...merchantFilters,
        });
        set({
          merchants: res.items,
          merchantsTotal: res.total,
          merchantsPage: res.page,
          merchantsLimit: res.limit,
          merchantsStatus: "ready",
        });
      } catch (err) {
        set({
          merchantsStatus: "error",
          merchantsError: extractAdminMerchantsError(
            err,
            "Unable to load merchants right now."
          ),
        });
      }
    },

    // --- Payout queue --------------------------------------------------------

    fetchPayoutQueue: async (params) => {
      if (!params?.silent) set({ payoutQueueStatus: "loading" });
      try {
        const res = await adminMerchantsService.payoutQueue({
          limit: 50,
          status: params?.status,
          page: params?.page,
        });
        set({
          payoutQueue: res.items,
          payoutQueueTotal: res.total,
          payoutQueueStatus: "ready",
        });
      } catch {
        set({ payoutQueue: [], payoutQueueStatus: "error" });
      }
    },

    // --- Detail --------------------------------------------------------------

    loadMerchant: async (id) => {
      const switching = get().currentId !== id;
      set({
        currentId: id,
        detailStatus: "loading",
        detailError: null,
        ...(switching
          ? {
              detail: null,
              earnings: null,
              earningsStatus: "idle",
              merchantPayouts: [],
              merchantPayoutsStatus: "idle",
            }
          : {}),
      });
      try {
        const detail = await adminMerchantsService.getMerchant(id);
        set({ detail, detailStatus: "ready" });
      } catch (err) {
        set({
          detailStatus: "error",
          detailError: extractAdminMerchantsError(
            err,
            "Unable to load this merchant right now."
          ),
        });
      }
    },

    refreshDetail: async () => {
      const id = get().currentId;
      if (!id) return;
      try {
        const detail = await adminMerchantsService.getMerchant(id);
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
        earnings: null,
        earningsStatus: "idle",
        merchantPayouts: [],
        merchantPayoutsStatus: "idle",
      }),

    fetchEarnings: async (id, params) => {
      set({ earningsStatus: "loading" });
      try {
        const earnings = await adminMerchantsService.merchantEarnings(id, params);
        set({ earnings, earningsStatus: "ready" });
      } catch {
        set({ earnings: null, earningsStatus: "error" });
      }
    },

    fetchMerchantPayouts: async (id) => {
      set({ merchantPayoutsStatus: "loading" });
      try {
        const merchantPayouts =
          await adminMerchantsService.merchantPayoutRequests(id);
        set({ merchantPayouts, merchantPayoutsStatus: "ready" });
      } catch {
        set({ merchantPayouts: [], merchantPayoutsStatus: "error" });
      }
    },

    // --- KYC / suspension actions -------------------------------------------

    approveMerchant: async (id) => {
      try {
        await adminMerchantsService.approveMerchant(id);
        void get().refreshDetail();
        void get().fetchMerchants({ silent: true });
      } catch (err) {
        throw new Error(
          extractAdminMerchantsError(err, "Could not approve the merchant.")
        );
      }
    },

    rejectMerchant: async (id, reason) => {
      try {
        await adminMerchantsService.rejectMerchant(id, reason);
        void get().refreshDetail();
        void get().fetchMerchants({ silent: true });
      } catch (err) {
        throw new Error(
          extractAdminMerchantsError(err, "Could not reject the merchant.")
        );
      }
    },

    suspendMerchant: async (id, reason) => {
      try {
        await adminMerchantsService.suspendMerchant(id, reason);
        void get().refreshDetail();
        void get().fetchMerchants({ silent: true });
      } catch (err) {
        throw new Error(
          extractAdminMerchantsError(err, "Could not suspend the merchant.")
        );
      }
    },

    reinstateMerchant: async (id) => {
      try {
        await adminMerchantsService.reinstateMerchant(id);
        void get().refreshDetail();
        void get().fetchMerchants({ silent: true });
      } catch (err) {
        throw new Error(
          extractAdminMerchantsError(err, "Could not reinstate the merchant.")
        );
      }
    },

    // --- Payout actions ------------------------------------------------------

    markPayoutSent: async (reqId, payload) => {
      try {
        const result = await adminMerchantsService.markPayoutSent(reqId, payload);
        const id = get().currentId;
        if (id) void get().fetchMerchantPayouts(id);
        void get().fetchPayoutQueue({ silent: true });
        void get().refreshDetail();
        return result;
      } catch (err) {
        throw new Error(
          extractAdminMerchantsError(err, "Could not mark the payout sent.")
        );
      }
    },

    cancelPayout: async (reqId, reason) => {
      try {
        await adminMerchantsService.cancelPayout(reqId, reason);
        const id = get().currentId;
        if (id) void get().fetchMerchantPayouts(id);
        void get().fetchPayoutQueue({ silent: true });
        void get().refreshDetail();
      } catch (err) {
        throw new Error(
          extractAdminMerchantsError(err, "Could not cancel the payout request.")
        );
      }
    },

    reset: () => set({ ...INITIAL }),
  })
);

export default useAdminMerchantsStore;
