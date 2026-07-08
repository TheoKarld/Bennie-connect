/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typed REST client for the ADMIN marketplace surface
 * (base `<VITE_API_URL>/admin/marketplace`, via `src/lib/adminApi.ts`).
 *
 * The admin-plane sibling of the user `marketplace.service.ts` — bound to
 * `adminApi` (admin token + `/admin` base) so the two dual sessions never
 * bleed. Do NOT import the user marketplace service here.
 *
 * Every helper unwraps the `{ success, data }` envelope; list helpers tolerate
 * either a bare array or an `{ items, total, page, limit }` paginated shape.
 * Errors bubble up as axios errors so the store surfaces `MKT_ADM_*`
 * codes/messages.
 */

import adminApi from "../lib/adminApi";
import type {
  AdminCategory,
  AdminProduct,
  AdminProductDetail,
  AdminProductListFilters,
  AdminProductPayload,
  CategoryPayload,
  InventoryPatchPayload,
  LowStockResult,
  Paginated,
  ProductInventory,
  SellerAggregate,
} from "../types/adminMarketplace";

/** Unwrap `{ success, data }`; tolerate a bare payload defensively. */
function unwrap<T>(payload: unknown): T {
  const body = payload as { data?: T } | T;
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

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

const BASE = "/marketplace";

export const adminMarketplaceService = {
  // --- Categories ------------------------------------------------------------

  async listCategories(): Promise<AdminCategory[]> {
    const res = await adminApi.get(`${BASE}/categories`);
    const data = unwrap<AdminCategory[] | { items?: AdminCategory[] }>(res.data);
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async createCategory(payload: CategoryPayload): Promise<AdminCategory> {
    const res = await adminApi.post(`${BASE}/categories`, payload);
    return unwrap<AdminCategory>(res.data);
  },

  async updateCategory(
    id: string,
    payload: Partial<CategoryPayload>
  ): Promise<AdminCategory> {
    const res = await adminApi.patch(`${BASE}/categories/${id}`, payload);
    return unwrap<AdminCategory>(res.data);
  },

  async deleteCategory(id: string): Promise<void> {
    await adminApi.delete(`${BASE}/categories/${id}`);
  },

  // --- Products --------------------------------------------------------------

  async listProducts(
    params: AdminProductListFilters = {}
  ): Promise<Paginated<AdminProduct>> {
    const res = await adminApi.get(`${BASE}/products`, { params });
    const data = unwrap<AdminProduct[] | Partial<Paginated<AdminProduct>>>(
      res.data
    );
    return toPaginated<AdminProduct>(data, params.page ?? 1, params.limit ?? 20);
  },

  async getProduct(id: string): Promise<AdminProductDetail> {
    const res = await adminApi.get(`${BASE}/products/${id}`);
    return unwrap<AdminProductDetail>(res.data);
  },

  async createProduct(payload: AdminProductPayload): Promise<AdminProductDetail> {
    const res = await adminApi.post(`${BASE}/products`, payload);
    return unwrap<AdminProductDetail>(res.data);
  },

  async updateProduct(
    id: string,
    payload: AdminProductPayload
  ): Promise<AdminProductDetail> {
    const res = await adminApi.patch(`${BASE}/products/${id}`, payload);
    return unwrap<AdminProductDetail>(res.data);
  },

  async deleteProduct(id: string): Promise<void> {
    await adminApi.delete(`${BASE}/products/${id}`);
  },

  async approveProduct(id: string): Promise<Record<string, unknown>> {
    const res = await adminApi.post(`${BASE}/products/${id}/approve`);
    return unwrap(res.data);
  },

  async rejectProduct(
    id: string,
    reason: string,
    requestChanges = false
  ): Promise<Record<string, unknown>> {
    const res = await adminApi.post(`${BASE}/products/${id}/reject`, {
      reason,
      requestChanges,
    });
    return unwrap(res.data);
  },

  async patchInventory(
    id: string,
    payload: InventoryPatchPayload
  ): Promise<ProductInventory> {
    const res = await adminApi.patch(`${BASE}/products/${id}/inventory`, payload);
    return unwrap<ProductInventory>(res.data);
  },

  // --- Moderation + inventory ------------------------------------------------

  async moderationQueue(
    params: { page?: number; limit?: number } = {}
  ): Promise<Paginated<AdminProduct>> {
    const res = await adminApi.get(`${BASE}/moderation-queue`, { params });
    const data = unwrap<AdminProduct[] | Partial<Paginated<AdminProduct>>>(
      res.data
    );
    return toPaginated<AdminProduct>(data, params.page ?? 1, params.limit ?? 20);
  },

  async lowStock(): Promise<LowStockResult> {
    const res = await adminApi.get(`${BASE}/inventory/low-stock`);
    const data = unwrap<LowStockResult>(res.data);
    return { items: data?.items ?? [], defaultThreshold: data?.defaultThreshold ?? 10 };
  },

  // --- Sellers (read-only) ---------------------------------------------------

  async listSellers(
    params: { page?: number; limit?: number; q?: string } = {}
  ): Promise<Paginated<SellerAggregate>> {
    const res = await adminApi.get(`${BASE}/sellers`, { params });
    const data = unwrap<SellerAggregate[] | Partial<Paginated<SellerAggregate>>>(
      res.data
    );
    return toPaginated<SellerAggregate>(data, params.page ?? 1, params.limit ?? 20);
  },
};

/** Pull a friendly message (and MKT_ADM_* code) out of an axios/API error. */
export function extractAdminMarketplaceError(
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

export default adminMarketplaceService;
