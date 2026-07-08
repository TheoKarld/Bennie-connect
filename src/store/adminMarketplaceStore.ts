/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed ADMIN marketplace store (zustand) — source of truth for the
 * `/bennie/market-place` products table, categories manager, moderation queue,
 * low-stock view, sellers view, and the `:id` product detail. Talks to the
 * backend via `src/services/adminMarketplace.service.ts` (`adminApi`,
 * `/admin/marketplace` base).
 *
 * Degrades gracefully: with no backend the store keeps empty collections, sets
 * a friendly error, and the UI renders loading/empty/error states (no crash).
 */

import { create } from "zustand";

import adminMarketplaceService, {
  extractAdminMarketplaceError,
} from "../services/adminMarketplace.service";
import type {
  AdminCategory,
  AdminProduct,
  AdminProductDetail,
  AdminProductListFilters,
  AdminProductPayload,
  CategoryPayload,
  InventoryPatchPayload,
  LowStockRow,
  SellerAggregate,
} from "../types/adminMarketplace";

type Status = "idle" | "loading" | "ready" | "error";

interface State {
  // Products.
  products: AdminProduct[];
  productsTotal: number;
  productsPage: number;
  productsLimit: number;
  productFilters: AdminProductListFilters;
  productsStatus: Status;
  productsError: string | null;

  // Categories.
  categories: AdminCategory[];
  categoriesStatus: Status;

  // Moderation queue.
  queue: AdminProduct[];
  queueTotal: number;
  queueStatus: Status;

  // Low stock.
  lowStock: LowStockRow[];
  lowStockThreshold: number;
  lowStockStatus: Status;

  // Sellers.
  sellers: SellerAggregate[];
  sellersTotal: number;
  sellersStatus: Status;

  // Detail.
  currentId: string | null;
  detail: AdminProductDetail | null;
  detailStatus: Status;
  detailError: string | null;
}

interface Actions {
  setProductFilters: (patch: Partial<AdminProductListFilters>) => void;
  fetchProducts: (opts?: { silent?: boolean }) => Promise<void>;
  createProduct: (payload: AdminProductPayload) => Promise<AdminProductDetail>;
  updateProduct: (id: string, payload: AdminProductPayload) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  approveProduct: (id: string) => Promise<void>;
  rejectProduct: (
    id: string,
    reason: string,
    requestChanges?: boolean
  ) => Promise<void>;
  patchInventory: (id: string, payload: InventoryPatchPayload) => Promise<void>;

  fetchCategories: (opts?: { silent?: boolean }) => Promise<void>;
  createCategory: (payload: CategoryPayload) => Promise<void>;
  updateCategory: (id: string, payload: Partial<CategoryPayload>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  fetchQueue: (opts?: { silent?: boolean }) => Promise<void>;
  fetchLowStock: (opts?: { silent?: boolean }) => Promise<void>;
  fetchSellers: (opts?: { silent?: boolean; q?: string }) => Promise<void>;

  loadProduct: (id: string) => Promise<void>;
  refreshDetail: () => Promise<void>;
  clearDetail: () => void;

  reset: () => void;
}

export type AdminMarketplaceStore = State & Actions;

const INITIAL: State = {
  products: [],
  productsTotal: 0,
  productsPage: 1,
  productsLimit: 20,
  productFilters: { page: 1, limit: 20 },
  productsStatus: "idle",
  productsError: null,

  categories: [],
  categoriesStatus: "idle",

  queue: [],
  queueTotal: 0,
  queueStatus: "idle",

  lowStock: [],
  lowStockThreshold: 10,
  lowStockStatus: "idle",

  sellers: [],
  sellersTotal: 0,
  sellersStatus: "idle",

  currentId: null,
  detail: null,
  detailStatus: "idle",
  detailError: null,
};

export const useAdminMarketplaceStore = create<AdminMarketplaceStore>()(
  (set, get) => ({
    ...INITIAL,

    // --- Products ------------------------------------------------------------

    setProductFilters: (patch) =>
      set((prev) => ({ productFilters: { ...prev.productFilters, ...patch } })),

    fetchProducts: async (opts) => {
      if (!opts?.silent) set({ productsStatus: "loading" });
      set({ productsError: null });
      try {
        const { productFilters, productsLimit } = get();
        const res = await adminMarketplaceService.listProducts({
          limit: productsLimit,
          ...productFilters,
        });
        set({
          products: res.items,
          productsTotal: res.total,
          productsPage: res.page,
          productsLimit: res.limit,
          productsStatus: "ready",
        });
      } catch (err) {
        set({
          productsStatus: "error",
          productsError: extractAdminMarketplaceError(
            err,
            "Unable to load products right now."
          ),
        });
      }
    },

    createProduct: async (payload) => {
      try {
        const detail = await adminMarketplaceService.createProduct(payload);
        void get().fetchProducts({ silent: true });
        return detail;
      } catch (err) {
        throw new Error(
          extractAdminMarketplaceError(err, "Could not create the product.")
        );
      }
    },

    updateProduct: async (id, payload) => {
      try {
        await adminMarketplaceService.updateProduct(id, payload);
        void get().fetchProducts({ silent: true });
        void get().refreshDetail();
      } catch (err) {
        throw new Error(
          extractAdminMarketplaceError(err, "Could not update the product.")
        );
      }
    },

    deleteProduct: async (id) => {
      try {
        await adminMarketplaceService.deleteProduct(id);
        void get().fetchProducts({ silent: true });
      } catch (err) {
        throw new Error(
          extractAdminMarketplaceError(err, "Could not delete the product.")
        );
      }
    },

    approveProduct: async (id) => {
      try {
        await adminMarketplaceService.approveProduct(id);
        void get().fetchProducts({ silent: true });
        void get().fetchQueue({ silent: true });
        void get().refreshDetail();
      } catch (err) {
        throw new Error(
          extractAdminMarketplaceError(err, "Could not approve the listing.")
        );
      }
    },

    rejectProduct: async (id, reason, requestChanges) => {
      try {
        await adminMarketplaceService.rejectProduct(id, reason, requestChanges);
        void get().fetchProducts({ silent: true });
        void get().fetchQueue({ silent: true });
        void get().refreshDetail();
      } catch (err) {
        throw new Error(
          extractAdminMarketplaceError(err, "Could not reject the listing.")
        );
      }
    },

    patchInventory: async (id, payload) => {
      try {
        await adminMarketplaceService.patchInventory(id, payload);
        void get().fetchProducts({ silent: true });
        void get().refreshDetail();
      } catch (err) {
        throw new Error(
          extractAdminMarketplaceError(err, "Could not adjust inventory.")
        );
      }
    },

    // --- Categories ----------------------------------------------------------

    fetchCategories: async (opts) => {
      if (!opts?.silent) set({ categoriesStatus: "loading" });
      try {
        const categories = await adminMarketplaceService.listCategories();
        set({ categories, categoriesStatus: "ready" });
      } catch {
        set({ categories: [], categoriesStatus: "error" });
      }
    },

    createCategory: async (payload) => {
      try {
        await adminMarketplaceService.createCategory(payload);
        void get().fetchCategories({ silent: true });
      } catch (err) {
        throw new Error(
          extractAdminMarketplaceError(err, "Could not create the category.")
        );
      }
    },

    updateCategory: async (id, payload) => {
      try {
        await adminMarketplaceService.updateCategory(id, payload);
        void get().fetchCategories({ silent: true });
      } catch (err) {
        throw new Error(
          extractAdminMarketplaceError(err, "Could not update the category.")
        );
      }
    },

    deleteCategory: async (id) => {
      try {
        await adminMarketplaceService.deleteCategory(id);
        void get().fetchCategories({ silent: true });
      } catch (err) {
        throw new Error(
          extractAdminMarketplaceError(err, "Could not delete the category.")
        );
      }
    },

    // --- Queue / low-stock / sellers -----------------------------------------

    fetchQueue: async (opts) => {
      if (!opts?.silent) set({ queueStatus: "loading" });
      try {
        const res = await adminMarketplaceService.moderationQueue({ limit: 50 });
        set({ queue: res.items, queueTotal: res.total, queueStatus: "ready" });
      } catch {
        set({ queue: [], queueStatus: "error" });
      }
    },

    fetchLowStock: async (opts) => {
      if (!opts?.silent) set({ lowStockStatus: "loading" });
      try {
        const res = await adminMarketplaceService.lowStock();
        set({
          lowStock: res.items,
          lowStockThreshold: res.defaultThreshold,
          lowStockStatus: "ready",
        });
      } catch {
        set({ lowStock: [], lowStockStatus: "error" });
      }
    },

    fetchSellers: async (opts) => {
      if (!opts?.silent) set({ sellersStatus: "loading" });
      try {
        const res = await adminMarketplaceService.listSellers({
          limit: 50,
          q: opts?.q,
        });
        set({
          sellers: res.items,
          sellersTotal: res.total,
          sellersStatus: "ready",
        });
      } catch {
        set({ sellers: [], sellersStatus: "error" });
      }
    },

    // --- Detail --------------------------------------------------------------

    loadProduct: async (id) => {
      const switching = get().currentId !== id;
      set({
        currentId: id,
        detailStatus: "loading",
        detailError: null,
        ...(switching ? { detail: null } : {}),
      });
      try {
        const detail = await adminMarketplaceService.getProduct(id);
        set({ detail, detailStatus: "ready" });
      } catch (err) {
        set({
          detailStatus: "error",
          detailError: extractAdminMarketplaceError(
            err,
            "Unable to load this product right now."
          ),
        });
      }
    },

    refreshDetail: async () => {
      const id = get().currentId;
      if (!id) return;
      try {
        const detail = await adminMarketplaceService.getProduct(id);
        set({ detail, detailStatus: "ready" });
      } catch {
        /* keep last-known detail on transient failure */
      }
    },

    clearDetail: () =>
      set({ currentId: null, detail: null, detailStatus: "idle", detailError: null }),

    reset: () => set({ ...INITIAL }),
  })
);

export default useAdminMarketplaceStore;
