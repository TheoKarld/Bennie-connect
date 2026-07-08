/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typed REST client for the ADMIN orders console
 * (base `<VITE_API_URL>/admin/orders`, via `src/lib/adminApi.ts`).
 *
 * Bound to `adminApi` (admin token + `/admin` base). Every helper unwraps the
 * `{ success, data }` envelope; errors bubble up so the store surfaces
 * `ORD_ADM_*` codes.
 */

import adminApi from "../lib/adminApi";
import type {
  AdminOrderDetail,
  AdminOrderListFilters,
  AdminOrderRow,
  CancelOrderPayload,
  CheckoutGroupView,
  FulfillmentPayload,
  Paginated,
  RefundOrderPayload,
  RefundResult,
} from "../types/adminMarketplace";

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

const BASE = "/orders";

export const adminOrdersService = {
  async listOrders(
    params: AdminOrderListFilters = {}
  ): Promise<Paginated<AdminOrderRow>> {
    const res = await adminApi.get(BASE, { params });
    const data = unwrap<AdminOrderRow[] | Partial<Paginated<AdminOrderRow>>>(
      res.data
    );
    return toPaginated<AdminOrderRow>(data, params.page ?? 1, params.limit ?? 20);
  },

  async getOrder(id: string): Promise<AdminOrderDetail> {
    const res = await adminApi.get(`${BASE}/${id}`);
    return unwrap<AdminOrderDetail>(res.data);
  },

  async getCheckoutGroup(checkoutGroupId: string): Promise<CheckoutGroupView> {
    const res = await adminApi.get(
      `${BASE}/checkout-groups/${checkoutGroupId}`
    );
    return unwrap<CheckoutGroupView>(res.data);
  },

  async updateFulfillment(
    id: string,
    payload: FulfillmentPayload
  ): Promise<AdminOrderDetail> {
    const res = await adminApi.patch(`${BASE}/${id}/fulfillment`, payload);
    return unwrap<AdminOrderDetail>(res.data);
  },

  async cancelOrder(
    id: string,
    payload: CancelOrderPayload
  ): Promise<Record<string, unknown>> {
    const res = await adminApi.post(`${BASE}/${id}/cancel`, payload);
    return unwrap(res.data);
  },

  async refundOrder(
    id: string,
    payload: RefundOrderPayload
  ): Promise<RefundResult> {
    const res = await adminApi.post(`${BASE}/${id}/refund`, payload);
    return unwrap<RefundResult>(res.data);
  },
};

/** Pull a friendly message (and ORD_ADM_* code) out of an axios/API error. */
export function extractAdminOrdersError(
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

export default adminOrdersService;
