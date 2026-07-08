/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typed REST client for the LIVE Adashe / Esusu module
 * (base `/api/v1/contribution-groups`).
 *
 * Every endpoint requires the user JWT (attached by `src/lib/api.ts`) and
 * returns the `{ success, data }` envelope. Each helper unwraps `.data`. Errors
 * bubble up as axios errors so the store can surface `ADS_*` codes/messages from
 * `{ success:false, error:{ code, message, details } }`.
 *
 * Admin-dev: reuse the TYPES (`src/types/adashe.ts`) and this shape as a
 * reference, but build an admin-plane service against `adminApi`.
 */

import api from "../lib/api";
import type {
  AttendanceSession,
  ContributeResult,
  CreateGroupPayload,
  GroupDetail,
  GroupInvitation,
  GroupMessage,
  GroupSummary,
  Paginated,
  PayoutRequest,
  Proposal,
  VoteChoice,
} from "../types/adashe";

/** Unwrap `{ success, data }`; tolerate a bare payload defensively. */
function unwrap<T>(payload: unknown): T {
  const body = payload as { data?: T } | T;
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

const BASE = "/contribution-groups";

export const adasheService = {
  // --- Groups ----------------------------------------------------------------

  async createGroup(payload: CreateGroupPayload): Promise<GroupDetail> {
    const res = await api.post(BASE, payload);
    return unwrap<GroupDetail>(res.data);
  },

  async myGroups(): Promise<GroupSummary[]> {
    const res = await api.get(`${BASE}/my-groups`);
    const data = unwrap<GroupSummary[] | { items?: GroupSummary[] }>(res.data);
    if (Array.isArray(data)) return data;
    return data?.items ?? [];
  },

  async getGroup(id: string): Promise<GroupDetail> {
    const res = await api.get(`${BASE}/${id}`);
    return unwrap<GroupDetail>(res.data);
  },

  // --- Invitations -----------------------------------------------------------

  async myInvitations(): Promise<GroupInvitation[]> {
    const res = await api.get(`${BASE}/invitations`);
    const data = unwrap<GroupInvitation[] | { items?: GroupInvitation[] }>(
      res.data
    );
    if (Array.isArray(data)) return data;
    return data?.items ?? [];
  },

  async acceptInvitation(invId: string): Promise<GroupInvitation> {
    const res = await api.post(`${BASE}/invitations/${invId}/accept`);
    return unwrap<GroupInvitation>(res.data);
  },

  async declineInvitation(invId: string): Promise<GroupInvitation> {
    const res = await api.post(`${BASE}/invitations/${invId}/decline`);
    return unwrap<GroupInvitation>(res.data);
  },

  async invite(groupId: string, email: string): Promise<GroupInvitation> {
    const res = await api.post(`${BASE}/${groupId}/invite`, { email });
    return unwrap<GroupInvitation>(res.data);
  },

  // --- Contributions ---------------------------------------------------------

  async contribute(
    groupId: string,
    amount?: number
  ): Promise<ContributeResult> {
    const res = await api.post(`${BASE}/${groupId}/contribute`, { amount });
    return unwrap<ContributeResult>(res.data);
  },

  // --- Chat ------------------------------------------------------------------

  async getMessages(
    groupId: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<Paginated<GroupMessage>> {
    const res = await api.get(`${BASE}/${groupId}/messages`, { params });
    return unwrap<Paginated<GroupMessage>>(res.data);
  },

  // --- Proposals -------------------------------------------------------------

  async getProposals(groupId: string): Promise<Proposal[]> {
    const res = await api.get(`${BASE}/${groupId}/proposals`);
    const data = unwrap<Proposal[] | { items?: Proposal[] }>(res.data);
    if (Array.isArray(data)) return data;
    return data?.items ?? [];
  },

  async createProposal(
    groupId: string,
    payload: { title: string; text?: string }
  ): Promise<Proposal> {
    const res = await api.post(`${BASE}/${groupId}/proposals`, payload);
    return unwrap<Proposal>(res.data);
  },

  async voteProposal(
    groupId: string,
    proposalId: string,
    vote: VoteChoice
  ): Promise<Proposal> {
    const res = await api.post(
      `${BASE}/${groupId}/proposals/${proposalId}/vote`,
      { vote }
    );
    return unwrap<Proposal>(res.data);
  },

  async requestSlotShift(
    groupId: string,
    payload: { targetMemberId: string; reason?: string }
  ): Promise<Proposal> {
    const res = await api.post(`${BASE}/${groupId}/slot-shift`, payload);
    return unwrap<Proposal>(res.data);
  },

  // --- Attendance ------------------------------------------------------------

  async getAttendance(groupId: string): Promise<AttendanceSession[]> {
    const res = await api.get(`${BASE}/${groupId}/attendance`);
    const data = unwrap<AttendanceSession[] | { items?: AttendanceSession[] }>(
      res.data
    );
    if (Array.isArray(data)) return data;
    return data?.items ?? [];
  },

  async checkIn(
    groupId: string,
    sessionId: string
  ): Promise<AttendanceSession> {
    const res = await api.post(
      `${BASE}/${groupId}/attendance/${sessionId}/check-in`
    );
    return unwrap<AttendanceSession>(res.data);
  },

  // --- Payouts ---------------------------------------------------------------

  async requestPayout(groupId: string): Promise<PayoutRequest> {
    const res = await api.post(`${BASE}/${groupId}/payout/request`);
    return unwrap<PayoutRequest>(res.data);
  },

  async confirmPayoutReceived(
    groupId: string,
    reqId: string
  ): Promise<PayoutRequest> {
    const res = await api.post(
      `${BASE}/${groupId}/payout/${reqId}/confirm-received`
    );
    return unwrap<PayoutRequest>(res.data);
  },
};

/** Pull a friendly message (and ADS_* code) out of an axios/API error. */
export function extractAdasheError(err: unknown, fallback: string): string {
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

export default adasheService;
