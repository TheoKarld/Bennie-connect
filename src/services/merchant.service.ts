/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typed REST client for the LIVE Merchant Hub — base `/api/v1/merchant`,
 * user JWT via `src/lib/api.ts` (gated server-side on the caller's merchant
 * status). Returns the `{ success, data }` envelope; each helper unwraps
 * `.data`. Errors bubble up as axios errors carrying `MERCH_*` codes.
 */

import api from "../lib/api";
import type { Paginated } from "../types/marketplace";
import type {
  CreatePayoutResult,
  EarningsPage,
  KycDocumentUrlResult,
  MerchantKycPayload,
  MerchantMe,
  MerchantOrder,
  MerchantProduct,
  MerchantProductCreatePayload,
  MerchantProductUpdatePayload,
  PayoutBankDetails,
  PayoutRequest,
} from "../types/merchant";

/** Unwrap `{ success, data }`; tolerate a bare payload defensively. */
function unwrap<T>(payload: unknown): T {
  const body = payload as { data?: T } | T;
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

const BASE = "/merchant";

export const merchantService = {
  // --- Lifecycle -----------------------------------------------------------------

  /** Lifecycle status + profile + earnings summary. Never 404s. */
  async me(): Promise<MerchantMe> {
    const res = await api.get(`${BASE}/me`);
    return unwrap<MerchantMe>(res.data);
  },

  /** Save (draft), submit or resubmit the KYC application. */
  async saveKyc(payload: MerchantKycPayload): Promise<MerchantMe> {
    const res = await api.post(`${BASE}/kyc`, payload);
    return unwrap<MerchantMe>(res.data);
  },

  /** Short-lived signed URL for one of the caller's OWN KYC documents. */
  async kycDocumentUrl(fileId: string): Promise<KycDocumentUrlResult> {
    const res = await api.get(`${BASE}/kyc/documents/${fileId}/url`);
    return unwrap<KycDocumentUrlResult>(res.data);
  },

  // --- Products ------------------------------------------------------------------

  async listProducts(
    filters: { page?: number; limit?: number; moderationStatus?: string } = {}
  ): Promise<Paginated<MerchantProduct>> {
    const res = await api.get(`${BASE}/products`, { params: filters });
    const data = unwrap<Paginated<MerchantProduct>>(res.data);
    return {
      items: data?.items ?? [],
      total: data?.total ?? 0,
      page: data?.page ?? filters.page ?? 1,
      limit: data?.limit ?? filters.limit ?? 20,
    };
  },

  async createProduct(
    payload: MerchantProductCreatePayload
  ): Promise<MerchantProduct> {
    const res = await api.post(`${BASE}/products`, payload);
    return unwrap<MerchantProduct>(res.data);
  },

  async updateProduct(
    id: string,
    payload: MerchantProductUpdatePayload
  ): Promise<MerchantProduct> {
    const res = await api.patch(`${BASE}/products/${id}`, payload);
    return unwrap<MerchantProduct>(res.data);
  },

  async deleteProduct(id: string): Promise<{ id: string; deleted: boolean }> {
    const res = await api.delete(`${BASE}/products/${id}`);
    return unwrap<{ id: string; deleted: boolean }>(res.data);
  },

  // --- Orders --------------------------------------------------------------------

  async listOrders(
    filters: { page?: number; limit?: number; status?: string } = {}
  ): Promise<Paginated<MerchantOrder>> {
    const res = await api.get(`${BASE}/orders`, { params: filters });
    const data = unwrap<Paginated<MerchantOrder>>(res.data);
    return {
      items: data?.items ?? [],
      total: data?.total ?? 0,
      page: data?.page ?? filters.page ?? 1,
      limit: data?.limit ?? filters.limit ?? 20,
    };
  },

  /** Advance own order exactly one step forward (DELIVERED books earnings). */
  async advanceFulfillment(
    id: string,
    status: "PROCESSING" | "SHIPPED" | "DELIVERED"
  ): Promise<MerchantOrder> {
    const res = await api.patch(`${BASE}/orders/${id}/fulfillment`, { status });
    return unwrap<MerchantOrder>(res.data);
  },

  // --- Earnings & payouts -----------------------------------------------------------

  async earnings(
    filters: { page?: number; limit?: number } = {}
  ): Promise<EarningsPage> {
    const res = await api.get(`${BASE}/earnings`, { params: filters });
    const data = unwrap<EarningsPage>(res.data);
    return {
      summary: data?.summary ?? {
        totalEarned: 0,
        totalPaidOut: 0,
        pendingPayout: 0,
        available: 0,
      },
      entries: data?.entries ?? [],
      total: data?.total ?? 0,
      page: data?.page ?? filters.page ?? 1,
      limit: data?.limit ?? filters.limit ?? 20,
    };
  },

  async listPayoutRequests(): Promise<PayoutRequest[]> {
    const res = await api.get(`${BASE}/payout-requests`);
    const data = unwrap<{ items?: PayoutRequest[] }>(res.data);
    return data?.items ?? [];
  },

  async createPayoutRequest(
    amount: number,
    bankDetails: PayoutBankDetails
  ): Promise<CreatePayoutResult> {
    const res = await api.post(`${BASE}/payout-requests`, {
      amount,
      bankDetails,
    });
    return unwrap<CreatePayoutResult>(res.data);
  },

  async cancelPayoutRequest(id: string): Promise<PayoutRequest> {
    const res = await api.post(`${BASE}/payout-requests/${id}/cancel`, {});
    return unwrap<PayoutRequest>(res.data);
  },

  async confirmPayoutReceived(id: string): Promise<PayoutRequest> {
    const res = await api.post(
      `${BASE}/payout-requests/${id}/confirm-received`,
      {}
    );
    return unwrap<PayoutRequest>(res.data);
  },
};

/** Pull a friendly message (MERCH_* / MKT_*) out of an axios/API error. */
export function extractMerchantError(err: unknown, fallback: string): string {
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

/** Pull the raw MERCH_* code out of an axios/API error, if present. */
export function extractMerchantErrorCode(err: unknown): string | null {
  const ax = err as {
    response?: { data?: { error?: { code?: string } } };
  };
  return ax?.response?.data?.error?.code ?? null;
}

export default merchantService;
