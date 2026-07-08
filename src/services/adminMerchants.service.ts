/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typed REST client for the ADMIN merchants console
 * (base `<VITE_API_URL>/admin/merchants`, via `src/lib/adminApi.ts`).
 *
 * Bound to `adminApi`. KYC documents are viewed via the admin upload service's
 * `signedUrl(fileId)` (private bucket, 10-minute V4 URLs) — never a public URL.
 * Every helper unwraps `{ success, data }`; errors surface `MERCH_ADM_*` codes.
 */

import adminApi from "../lib/adminApi";
import type {
  AdminMerchantDetail,
  AdminMerchantListFilters,
  AdminMerchantRow,
  AdminPayoutRequest,
  EarningsFilters,
  MarkPayoutSentPayload,
  MarkPayoutSentResult,
  MerchantEarningsPage,
  Paginated,
  PayoutQueueFilters,
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

const BASE = "/merchants";

export const adminMerchantsService = {
  // --- Directory + detail ----------------------------------------------------

  async listMerchants(
    params: AdminMerchantListFilters = {}
  ): Promise<Paginated<AdminMerchantRow>> {
    const res = await adminApi.get(BASE, { params });
    const data = unwrap<AdminMerchantRow[] | Partial<Paginated<AdminMerchantRow>>>(
      res.data
    );
    return toPaginated<AdminMerchantRow>(
      data,
      params.page ?? 1,
      params.limit ?? 20
    );
  },

  async getMerchant(id: string): Promise<AdminMerchantDetail> {
    const res = await adminApi.get(`${BASE}/${id}`);
    return unwrap<AdminMerchantDetail>(res.data);
  },

  // --- KYC decisions ---------------------------------------------------------

  async approveMerchant(id: string): Promise<Record<string, unknown>> {
    const res = await adminApi.post(`${BASE}/${id}/approve`);
    return unwrap(res.data);
  },

  async rejectMerchant(id: string, reason: string): Promise<Record<string, unknown>> {
    const res = await adminApi.post(`${BASE}/${id}/reject`, { reason });
    return unwrap(res.data);
  },

  async suspendMerchant(
    id: string,
    reason: string
  ): Promise<Record<string, unknown>> {
    const res = await adminApi.post(`${BASE}/${id}/suspend`, { reason });
    return unwrap(res.data);
  },

  async reinstateMerchant(id: string): Promise<Record<string, unknown>> {
    const res = await adminApi.post(`${BASE}/${id}/reinstate`);
    return unwrap(res.data);
  },

  // --- Earnings --------------------------------------------------------------

  async merchantEarnings(
    id: string,
    params: EarningsFilters = {}
  ): Promise<MerchantEarningsPage> {
    const res = await adminApi.get(`${BASE}/${id}/earnings`, { params });
    const data = unwrap<Partial<MerchantEarningsPage>>(res.data);
    return {
      summary: data?.summary ?? {
        availableBalance: 0,
        lifetimeEarned: 0,
        lifetimePaidOut: 0,
      },
      entries: data?.entries ?? [],
      total: data?.total ?? (data?.entries?.length ?? 0),
      page: data?.page ?? params.page ?? 1,
      limit: data?.limit ?? params.limit ?? 20,
    };
  },

  // --- Payout requests -------------------------------------------------------

  /** Cross-merchant payout queue (default filter status=REQUESTED). */
  async payoutQueue(
    params: PayoutQueueFilters = {}
  ): Promise<Paginated<AdminPayoutRequest>> {
    const res = await adminApi.get(`${BASE}/payout-requests`, { params });
    const data = unwrap<
      AdminPayoutRequest[] | Partial<Paginated<AdminPayoutRequest>>
    >(res.data);
    return toPaginated<AdminPayoutRequest>(
      data,
      params.page ?? 1,
      params.limit ?? 20
    );
  },

  /** One merchant's payout requests (all statuses). */
  async merchantPayoutRequests(id: string): Promise<AdminPayoutRequest[]> {
    const res = await adminApi.get(`${BASE}/${id}/payout-requests`);
    const data = unwrap<AdminPayoutRequest[] | { items?: AdminPayoutRequest[] }>(
      res.data
    );
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async payoutDetail(reqId: string): Promise<AdminPayoutRequest> {
    const res = await adminApi.get(`${BASE}/payout-requests/${reqId}`);
    return unwrap<AdminPayoutRequest>(res.data);
  },

  async markPayoutSent(
    reqId: string,
    payload: MarkPayoutSentPayload
  ): Promise<MarkPayoutSentResult> {
    const res = await adminApi.post(
      `${BASE}/payout-requests/${reqId}/mark-sent`,
      payload
    );
    return unwrap<MarkPayoutSentResult>(res.data);
  },

  async cancelPayout(
    reqId: string,
    reason: string
  ): Promise<Record<string, unknown>> {
    const res = await adminApi.post(
      `${BASE}/payout-requests/${reqId}/cancel`,
      { reason }
    );
    return unwrap(res.data);
  },
};

/** Pull a friendly message (and MERCH_ADM_* code) out of an axios/API error. */
export function extractAdminMerchantsError(
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

export default adminMerchantsService;
