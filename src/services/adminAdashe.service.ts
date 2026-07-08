/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typed REST client for the ADMIN Adashe / Esusu surface
 * (base `<VITE_API_URL>/admin/contribution-groups`, via `src/lib/adminApi.ts`).
 *
 * This is the admin-plane sibling of `src/services/adashe.service.ts` (the user
 * plane). It reuses the shared types in `src/types/adashe.ts` but is bound to
 * `adminApi` (admin token + `/admin` base) so the two dual sessions never bleed.
 *
 * Every helper unwraps the `{ success, data }` envelope; list helpers tolerate
 * either a bare array or a `{ items, total, page, limit }` paginated shape.
 * Errors bubble up as axios errors so the store can surface `ADS_ADM_*`
 * codes/messages from `{ success:false, error:{ code, message, details } }`.
 */

import adminApi from "../lib/adminApi";
import type {
  AdminCreateGroupPayload,
  AdminGroupDetail,
  AdminGroupListParams,
  AdminGroupMember,
  AdminGroupRow,
  AdminPayoutRequest,
  AdminProposal,
  ContributionAudit,
  GroupRules,
  Paginated,
} from "../types/adashe";

/** Unwrap `{ success, data }`; tolerate a bare payload defensively. */
function unwrap<T>(payload: unknown): T {
  const body = payload as { data?: T } | T;
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/** Coerce an unknown list payload into a normalised Paginated<T>. */
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

const BASE = "/contribution-groups";

export const adminAdasheService = {
  // --- Groups directory ------------------------------------------------------

  async listGroups(
    params: AdminGroupListParams = {}
  ): Promise<Paginated<AdminGroupRow>> {
    const res = await adminApi.get(BASE, { params });
    const data = unwrap<AdminGroupRow[] | Partial<Paginated<AdminGroupRow>>>(
      res.data
    );
    return toPaginated<AdminGroupRow>(data, params.page ?? 1, params.limit ?? 20);
  },

  async getGroup(id: string): Promise<AdminGroupDetail> {
    const res = await adminApi.get(`${BASE}/${id}`);
    return unwrap<AdminGroupDetail>(res.data);
  },

  async createGroup(
    payload: AdminCreateGroupPayload
  ): Promise<AdminGroupDetail> {
    const res = await adminApi.post(BASE, {
      organizerType: "admin",
      ...payload,
    });
    return unwrap<AdminGroupDetail>(res.data);
  },

  async invite(id: string, email: string): Promise<void> {
    await adminApi.post(`${BASE}/${id}/invite`, { email });
  },

  async suspend(id: string, reason: string): Promise<void> {
    await adminApi.post(`${BASE}/${id}/suspend`, { reason });
  },

  async reinstate(id: string): Promise<void> {
    await adminApi.post(`${BASE}/${id}/reinstate`);
  },

  async updateRules(id: string, rules: Partial<GroupRules>): Promise<GroupRules> {
    const res = await adminApi.patch(`${BASE}/${id}/rules`, rules);
    return unwrap<GroupRules>(res.data);
  },

  // --- Members ---------------------------------------------------------------

  async getMembers(id: string): Promise<AdminGroupMember[]> {
    const res = await adminApi.get(`${BASE}/${id}/members`);
    const data = unwrap<AdminGroupMember[] | { items?: AdminGroupMember[] }>(
      res.data
    );
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  // --- Contributions audit ---------------------------------------------------

  async getContributions(
    id: string,
    params: { cycle?: number } = {}
  ): Promise<ContributionAudit> {
    const res = await adminApi.get(`${BASE}/${id}/contributions`, { params });
    return unwrap<ContributionAudit>(res.data);
  },

  // --- Payout requests -------------------------------------------------------

  /** Cross-group REQUESTED queue (dashboard-linked). */
  async payoutRequestsQueue(
    params: { page?: number; limit?: number } = {}
  ): Promise<Paginated<AdminPayoutRequest>> {
    const res = await adminApi.get(`${BASE}/payout-requests`, { params });
    const data = unwrap<
      AdminPayoutRequest[] | Partial<Paginated<AdminPayoutRequest>>
    >(res.data);
    return toPaginated<AdminPayoutRequest>(
      data,
      params.page ?? 1,
      params.limit ?? 50
    );
  },

  /** A single group's payout requests (all statuses). */
  async groupPayoutRequests(id: string): Promise<AdminPayoutRequest[]> {
    const res = await adminApi.get(`${BASE}/${id}/payout-requests`);
    const data = unwrap<
      AdminPayoutRequest[] | { items?: AdminPayoutRequest[] }
    >(res.data);
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async markPayoutSent(
    id: string,
    reqId: string,
    payload: { paymentReference: string; note?: string }
  ): Promise<AdminPayoutRequest> {
    const res = await adminApi.post(
      `${BASE}/${id}/payout/${reqId}/mark-sent`,
      payload
    );
    return unwrap<AdminPayoutRequest>(res.data);
  },

  async cancelPayout(
    id: string,
    reqId: string,
    reason: string
  ): Promise<AdminPayoutRequest> {
    const res = await adminApi.post(
      `${BASE}/${id}/payout/${reqId}/cancel`,
      { reason }
    );
    return unwrap<AdminPayoutRequest>(res.data);
  },

  // --- Proposals / slot-shift decisions --------------------------------------

  /** Cross-group AWAITING_ADMIN slot-shift queue (dashboard-linked). */
  async proposalsQueue(
    params: { page?: number; limit?: number } = {}
  ): Promise<Paginated<AdminProposal>> {
    const res = await adminApi.get("/proposals", { params });
    const data = unwrap<AdminProposal[] | Partial<Paginated<AdminProposal>>>(
      res.data
    );
    return toPaginated<AdminProposal>(data, params.page ?? 1, params.limit ?? 50);
  },

  async groupProposals(id: string): Promise<AdminProposal[]> {
    const res = await adminApi.get(`${BASE}/${id}/proposals`);
    const data = unwrap<AdminProposal[] | { items?: AdminProposal[] }>(res.data);
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async approveProposal(
    id: string,
    pid: string,
    note?: string
  ): Promise<AdminProposal> {
    const res = await adminApi.post(
      `${BASE}/${id}/proposals/${pid}/approve`,
      note ? { note } : undefined
    );
    return unwrap<AdminProposal>(res.data);
  },

  async rejectProposal(
    id: string,
    pid: string,
    reason: string
  ): Promise<AdminProposal> {
    const res = await adminApi.post(
      `${BASE}/${id}/proposals/${pid}/reject`,
      { reason }
    );
    return unwrap<AdminProposal>(res.data);
  },

  // --- Chat ------------------------------------------------------------------

  async getMessages(
    id: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<Paginated<import("../types/adashe").GroupMessage>> {
    const res = await adminApi.get(`${BASE}/${id}/messages`, { params });
    const data = unwrap<
      | import("../types/adashe").GroupMessage[]
      | Partial<Paginated<import("../types/adashe").GroupMessage>>
    >(res.data);
    return toPaginated(data, params.page ?? 1, params.limit ?? 50);
  },
};

/** Pull a friendly message (and ADS_ADM_* code) out of an axios/API error. */
export function extractAdminAdasheError(
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

export default adminAdasheService;
