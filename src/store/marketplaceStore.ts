/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed Marketplace store (zustand) — the source of truth for the LIVE
 * storefront (`/app/marketplace`), product detail, the cart drawer, checkout
 * and the buyer order surfaces. Talks to the backend via
 * `src/services/marketplace.service.ts`.
 *
 * This SUPERSEDES the mock appStore marketplace slices (`products` / `orders` /
 * `cart`) and their handlers — the cart is fully server-side, checkout is a
 * real wallet debit, and NOTHING here persists to localStorage.
 */

import { create } from "zustand";

import marketplaceService, {
  extractMarketplaceError,
  extractMarketplaceErrorCode,
  extractMarketplaceErrorDetails,
} from "../services/marketplace.service";
import type {
  CartView,
  CheckoutResult,
  MarketplaceCategory,
  OrderDetail,
  OrderGroup,
  ProductFilters,
  StorefrontProduct,
} from "../types/marketplace";
import { useWalletStore } from "./walletStore";

type Status = "idle" | "loading" | "ready" | "error";

/** Error carrying the raw API code + details for branch-specific UI. */
export class MarketplaceActionError extends Error {
  code: string | null;
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    code: string | null,
    details: Record<string, unknown> | null
  ) {
    super(message);
    this.name = "MarketplaceActionError";
    this.code = code;
    this.details = details;
  }
}

function shapeError(err: unknown, fallback: string): MarketplaceActionError {
  return new MarketplaceActionError(
    extractMarketplaceError(err, fallback),
    extractMarketplaceErrorCode(err),
    extractMarketplaceErrorDetails(err)
  );
}

interface MarketplaceState {
  // Categories rail.
  categories: MarketplaceCategory[];
  categoriesStatus: Status;

  // Storefront grid.
  products: StorefrontProduct[];
  total: number;
  filters: ProductFilters;
  listStatus: Status;
  listError: string | null;
  /** True while a "load more" append is in flight. */
  appending: boolean;

  // Product detail.
  product: StorefrontProduct | null;
  productStatus: Status;
  productError: string | null;
  /** Raw API code for the detail failure (MKT_001 → unavailable panel). */
  productErrorCode: string | null;

  // Cart (server-side; drawer overlay).
  cart: CartView | null;
  cartStatus: Status;
  cartError: string | null;
  cartOpen: boolean;
  /** itemIds with a mutation in flight (per-line busy states). */
  cartBusy: Record<string, boolean>;

  // Checkout.
  placingOrder: boolean;
  lastCheckout: CheckoutResult | null;

  // My orders (grouped).
  orderGroups: OrderGroup[];
  ordersTotal: number;
  ordersPage: number;
  ordersStatusFilter: string;
  ordersStatus: Status;
  ordersError: string | null;
  ordersAppending: boolean;

  // Order detail.
  order: OrderDetail | null;
  orderStatus: Status;
  orderError: string | null;
}

interface MarketplaceActions {
  fetchCategories: () => Promise<void>;

  setFilters: (patch: Partial<ProductFilters>) => void;
  fetchProducts: (opts?: { append?: boolean; silent?: boolean }) => Promise<void>;

  loadProduct: (id: string) => Promise<void>;
  clearProduct: () => void;

  openCart: () => void;
  closeCart: () => void;
  fetchCart: (opts?: { silent?: boolean }) => Promise<void>;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateCartItem: (itemId: string, quantity: number) => Promise<void>;
  removeCartItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;

  checkout: (deliveryAddress: string) => Promise<CheckoutResult>;
  clearLastCheckout: () => void;

  setOrdersStatusFilter: (status: string) => void;
  fetchOrders: (opts?: { append?: boolean; silent?: boolean }) => Promise<void>;
  loadOrder: (id: string) => Promise<void>;
  clearOrder: () => void;
  cancelOrder: (id: string, reason?: string) => Promise<void>;
  confirmReceived: (id: string) => Promise<void>;

  reset: () => void;
}

export type MarketplaceStore = MarketplaceState & MarketplaceActions;

const DEFAULT_FILTERS: ProductFilters = {
  q: "",
  category: "",
  sort: "newest",
  page: 1,
  limit: 12,
  inStockOnly: false,
};

const ORDERS_PAGE_SIZE = 8;

const INITIAL: MarketplaceState = {
  categories: [],
  categoriesStatus: "idle",

  products: [],
  total: 0,
  filters: { ...DEFAULT_FILTERS },
  listStatus: "idle",
  listError: null,
  appending: false,

  product: null,
  productStatus: "idle",
  productError: null,
  productErrorCode: null,

  cart: null,
  cartStatus: "idle",
  cartError: null,
  cartOpen: false,
  cartBusy: {},

  placingOrder: false,
  lastCheckout: null,

  orderGroups: [],
  ordersTotal: 0,
  ordersPage: 1,
  ordersStatusFilter: "",
  ordersStatus: "idle",
  ordersError: null,
  ordersAppending: false,

  order: null,
  orderStatus: "idle",
  orderError: null,
};

/** Sync the detail page's `inCart` echo after a cart mutation. */
function syncProductInCart(
  product: StorefrontProduct | null,
  cart: CartView | null
): StorefrontProduct | null {
  if (!product) return product;
  const line = cart?.items.find((i) => i.product?.id === product.id) ?? null;
  return {
    ...product,
    inCart: line ? { itemId: line.itemId, quantity: line.quantity } : null,
  };
}

export const useMarketplaceStore = create<MarketplaceStore>()((set, get) => ({
  ...INITIAL,

  // --- Categories --------------------------------------------------------------

  fetchCategories: async () => {
    if (get().categoriesStatus === "loading") return;
    set({ categoriesStatus: "loading" });
    try {
      const categories = await marketplaceService.categories();
      set({ categories, categoriesStatus: "ready" });
    } catch {
      // Rail collapses to "All" only — the grid is unaffected.
      set({ categoriesStatus: "error" });
    }
  },

  // --- Storefront ---------------------------------------------------------------

  setFilters: (patch) =>
    set((prev) => ({
      filters: {
        ...prev.filters,
        ...patch,
        // Any filter change (other than an explicit page) resets to page 1.
        page: patch.page ?? 1,
      },
    })),

  fetchProducts: async (opts) => {
    const append = opts?.append === true;
    if (append) {
      set({ appending: true, listError: null });
    } else {
      set({
        ...(opts?.silent ? {} : { listStatus: "loading" }),
        listError: null,
      });
    }
    try {
      const res = await marketplaceService.listProducts(get().filters);
      set((prev) => ({
        products: append ? [...prev.products, ...res.items] : res.items,
        total: res.total,
        listStatus: "ready",
        appending: false,
      }));
    } catch (err) {
      set({
        listStatus: "error",
        appending: false,
        listError: extractMarketplaceError(
          err,
          "Unable to load the marketplace right now."
        ),
      });
    }
  },

  // --- Product detail -------------------------------------------------------------

  loadProduct: async (id) => {
    const switching = get().product?.id !== id;
    set({
      productStatus: "loading",
      productError: null,
      productErrorCode: null,
      ...(switching ? { product: null } : {}),
    });
    try {
      const product = await marketplaceService.getProduct(id);
      set({ product, productStatus: "ready" });
    } catch (err) {
      set({
        productStatus: "error",
        productError: extractMarketplaceError(
          err,
          "Unable to load this product right now."
        ),
        productErrorCode: extractMarketplaceErrorCode(err),
      });
    }
  },

  clearProduct: () =>
    set({
      product: null,
      productStatus: "idle",
      productError: null,
      productErrorCode: null,
    }),

  // --- Cart ---------------------------------------------------------------------

  openCart: () => {
    set({ cartOpen: true });
    void get().fetchCart({ silent: true });
  },

  closeCart: () => set({ cartOpen: false }),

  fetchCart: async (opts) => {
    if (!opts?.silent) set({ cartStatus: "loading" });
    set({ cartError: null });
    try {
      const cart = await marketplaceService.getCart();
      set((prev) => ({
        cart,
        cartStatus: "ready",
        product: syncProductInCart(prev.product, cart),
      }));
    } catch (err) {
      set({
        cartStatus: "error",
        cartError: extractMarketplaceError(
          err,
          "Unable to load your basket right now."
        ),
      });
    }
  },

  addToCart: async (productId, quantity = 1) => {
    try {
      const cart = await marketplaceService.addCartItem(productId, quantity);
      set((prev) => ({
        cart,
        cartStatus: "ready",
        product: syncProductInCart(prev.product, cart),
      }));
    } catch (err) {
      throw shapeError(err, "Could not add this item to your basket.");
    }
  },

  updateCartItem: async (itemId, quantity) => {
    set((prev) => ({ cartBusy: { ...prev.cartBusy, [itemId]: true } }));
    try {
      const cart = await marketplaceService.updateCartItem(itemId, quantity);
      set((prev) => ({
        cart,
        cartStatus: "ready",
        product: syncProductInCart(prev.product, cart),
      }));
    } catch (err) {
      // Reconcile from source on failure so the drawer never drifts.
      void get().fetchCart({ silent: true });
      throw shapeError(err, "Could not update the quantity.");
    } finally {
      set((prev) => {
        const next = { ...prev.cartBusy };
        delete next[itemId];
        return { cartBusy: next };
      });
    }
  },

  removeCartItem: async (itemId) => {
    set((prev) => ({ cartBusy: { ...prev.cartBusy, [itemId]: true } }));
    try {
      const cart = await marketplaceService.removeCartItem(itemId);
      set((prev) => ({
        cart,
        cartStatus: "ready",
        product: syncProductInCart(prev.product, cart),
      }));
    } catch (err) {
      void get().fetchCart({ silent: true });
      throw shapeError(err, "Could not remove this item.");
    } finally {
      set((prev) => {
        const next = { ...prev.cartBusy };
        delete next[itemId];
        return { cartBusy: next };
      });
    }
  },

  clearCart: async () => {
    try {
      const cart = await marketplaceService.clearCart();
      set((prev) => ({
        cart,
        cartStatus: "ready",
        product: syncProductInCart(prev.product, cart),
      }));
    } catch (err) {
      throw shapeError(err, "Could not empty your basket.");
    }
  },

  // --- Checkout -------------------------------------------------------------------

  checkout: async (deliveryAddress) => {
    set({ placingOrder: true });
    try {
      const result = await marketplaceService.checkout(deliveryAddress);
      set({ placingOrder: false, lastCheckout: result, cartOpen: false });
      // The cart is now empty server-side; reconcile the drawer + wallet.
      void get().fetchCart({ silent: true });
      void useWalletStore.getState().fetchWallet({ silent: true });
      // Newest purchase should appear on the orders page next visit.
      void get().fetchOrders({ silent: true });
      return result;
    } catch (err) {
      set({ placingOrder: false });
      // MKT_011 means lines changed under us — refresh the cart for the UI.
      if (extractMarketplaceErrorCode(err) === "MKT_011") {
        void get().fetchCart({ silent: true });
      }
      throw shapeError(err, "Checkout could not be completed.");
    }
  },

  clearLastCheckout: () => set({ lastCheckout: null }),

  // --- Orders ---------------------------------------------------------------------

  setOrdersStatusFilter: (status) =>
    set({ ordersStatusFilter: status, ordersPage: 1 }),

  fetchOrders: async (opts) => {
    const append = opts?.append === true;
    const page = append ? get().ordersPage + 1 : 1;
    if (append) {
      set({ ordersAppending: true, ordersError: null });
    } else {
      set({
        ...(opts?.silent ? {} : { ordersStatus: "loading" }),
        ordersError: null,
      });
    }
    try {
      const res = await marketplaceService.myOrders({
        page,
        limit: ORDERS_PAGE_SIZE,
        status: get().ordersStatusFilter || undefined,
      });
      set((prev) => ({
        orderGroups: append ? [...prev.orderGroups, ...res.groups] : res.groups,
        ordersTotal: res.total,
        ordersPage: page,
        ordersStatus: "ready",
        ordersAppending: false,
      }));
    } catch (err) {
      set({
        ordersStatus: "error",
        ordersAppending: false,
        ordersError: extractMarketplaceError(
          err,
          "Unable to load your orders right now."
        ),
      });
    }
  },

  loadOrder: async (id) => {
    const switching = get().order?.id !== id;
    set({
      orderStatus: "loading",
      orderError: null,
      ...(switching ? { order: null } : {}),
    });
    try {
      const order = await marketplaceService.getOrder(id);
      set({ order, orderStatus: "ready" });
    } catch (err) {
      set({
        orderStatus: "error",
        orderError: extractMarketplaceError(
          err,
          "Unable to load this order right now."
        ),
      });
    }
  },

  clearOrder: () => set({ order: null, orderStatus: "idle", orderError: null }),

  cancelOrder: async (id, reason) => {
    try {
      await marketplaceService.cancelOrder(id, reason);
      // Refresh the open order + groups + refunded wallet balance.
      await get().loadOrder(id);
      void get().fetchOrders({ silent: true });
      void useWalletStore.getState().fetchWallet({ silent: true });
    } catch (err) {
      throw shapeError(err, "Could not cancel this order.");
    }
  },

  confirmReceived: async (id) => {
    try {
      await marketplaceService.confirmReceived(id);
      await get().loadOrder(id);
      void get().fetchOrders({ silent: true });
    } catch (err) {
      throw shapeError(err, "Could not confirm receipt.");
    }
  },

  reset: () => set({ ...INITIAL, filters: { ...DEFAULT_FILTERS } }),
}));

export default useMarketplaceStore;
