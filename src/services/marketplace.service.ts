/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typed REST client for the LIVE Marketplace (storefront + cart + checkout +
 * orders) — base `/api/v1/marketplace`, user JWT via `src/lib/api.ts`.
 *
 * Every endpoint returns the `{ success, data }` envelope; each helper unwraps
 * `.data`. Errors bubble up as axios errors so callers can surface
 * `MKT_*` / `ORD_*` codes via `extractMarketplaceError(Code)`.
 */

import api from "../lib/api";
import type {
  CancelOrderResult,
  CartView,
  CheckoutResult,
  ConfirmReceivedResult,
  MarketplaceCategory,
  OrderDetail,
  OrderGroupsPage,
  Paginated,
  ProductFilters,
  StorefrontProduct,
} from "../types/marketplace";

/** Unwrap `{ success, data }`; tolerate a bare payload defensively. */
function unwrap<T>(payload: unknown): T {
  const body = payload as { data?: T } | T;
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

const BASE = "/marketplace";

export const marketplaceService = {
  // --- Storefront ---------------------------------------------------------------

  async categories(): Promise<MarketplaceCategory[]> {
    const res = await api.get(`${BASE}/categories`);
    const data = unwrap<{ items?: MarketplaceCategory[] }>(res.data);
    return data?.items ?? [];
  },

  async listProducts(
    filters: ProductFilters = {}
  ): Promise<Paginated<StorefrontProduct>> {
    const params: Record<string, string | number | boolean> = {};
    if (filters.q) params.q = filters.q;
    if (filters.category) params.category = filters.category;
    if (filters.sort) params.sort = filters.sort;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    if (filters.inStockOnly) params.inStockOnly = true;

    const res = await api.get(`${BASE}/products`, { params });
    const data = unwrap<Paginated<StorefrontProduct>>(res.data);
    return {
      items: data?.items ?? [],
      total: data?.total ?? 0,
      page: data?.page ?? filters.page ?? 1,
      limit: data?.limit ?? filters.limit ?? 20,
    };
  },

  async getProduct(id: string): Promise<StorefrontProduct> {
    const res = await api.get(`${BASE}/products/${id}`);
    return unwrap<StorefrontProduct>(res.data);
  },

  // --- Cart ---------------------------------------------------------------------

  async getCart(): Promise<CartView> {
    const res = await api.get(`${BASE}/cart`);
    return unwrap<CartView>(res.data);
  },

  /** Add a product (or increment its line). Returns the refreshed cart view. */
  async addCartItem(productId: string, quantity = 1): Promise<CartView> {
    const res = await api.post(`${BASE}/cart/items`, { productId, quantity });
    return unwrap<CartView>(res.data);
  },

  /** Set a line's absolute quantity. Returns the refreshed cart view. */
  async updateCartItem(itemId: string, quantity: number): Promise<CartView> {
    const res = await api.patch(`${BASE}/cart/items/${itemId}`, { quantity });
    return unwrap<CartView>(res.data);
  },

  async removeCartItem(itemId: string): Promise<CartView> {
    const res = await api.delete(`${BASE}/cart/items/${itemId}`);
    return unwrap<CartView>(res.data);
  },

  async clearCart(): Promise<CartView> {
    const res = await api.delete(`${BASE}/cart`);
    return unwrap<CartView>(res.data);
  },

  // --- Checkout -------------------------------------------------------------------

  /**
   * Split the cart into one order per seller + ONE wallet debit
   * (`MKTPAY<checkoutGroupId>`).
   */
  async checkout(deliveryAddress: string): Promise<CheckoutResult> {
    const res = await api.post(`${BASE}/checkout`, { deliveryAddress });
    return unwrap<CheckoutResult>(res.data);
  },

  // --- Orders ---------------------------------------------------------------------

  async myOrders(
    filters: { page?: number; limit?: number; status?: string } = {}
  ): Promise<OrderGroupsPage> {
    const res = await api.get(`${BASE}/orders`, { params: filters });
    const data = unwrap<OrderGroupsPage>(res.data);
    return {
      groups: data?.groups ?? [],
      total: data?.total ?? 0,
      page: data?.page ?? filters.page ?? 1,
      limit: data?.limit ?? filters.limit ?? 10,
    };
  },

  async getOrder(id: string): Promise<OrderDetail> {
    const res = await api.get(`${BASE}/orders/${id}`);
    return unwrap<OrderDetail>(res.data);
  },

  /** Cancel while PENDING → automatic wallet refund (`MKTREF<orderId>`). */
  async cancelOrder(id: string, reason?: string): Promise<CancelOrderResult> {
    const res = await api.post(`${BASE}/orders/${id}/cancel`, { reason });
    return unwrap<CancelOrderResult>(res.data);
  },

  /** Buyer confirms receipt after DELIVERED (idempotent). */
  async confirmReceived(id: string): Promise<ConfirmReceivedResult> {
    const res = await api.post(`${BASE}/orders/${id}/confirm-received`, {});
    return unwrap<ConfirmReceivedResult>(res.data);
  },
};

/** Pull a friendly message (MKT_* / ORD_*) out of an axios/API error. */
export function extractMarketplaceError(
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

/** Pull the raw MKT_* / ORD_* / WALLET_* code out of an axios/API error. */
export function extractMarketplaceErrorCode(err: unknown): string | null {
  const ax = err as {
    response?: { data?: { error?: { code?: string } } };
  };
  return ax?.response?.data?.error?.code ?? null;
}

/** Pull the error `details` payload (e.g. MKT_009 { required, available }). */
export function extractMarketplaceErrorDetails(
  err: unknown
): Record<string, unknown> | null {
  const ax = err as {
    response?: { data?: { error?: { details?: Record<string, unknown> } } };
  };
  return ax?.response?.data?.error?.details ?? null;
}

export default marketplaceService;
