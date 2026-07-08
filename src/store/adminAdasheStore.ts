/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed ADMIN Adashe store (zustand) — source of truth for the
 * `/bennie/adashesu-contributions` groups directory + `:groupId` detail tabs
 * and the dashboard Adashe approval queues. Talks to the backend via
 * `src/services/adminAdashe.service.ts` (`adminApi`, `/admin` base).
 *
 * Mirrors the user `adasheStore` pattern but on the admin plane: cross-group
 * payout-request + slot-shift queues, per-group members/rotation/contributions/
 * chat/proposals, and live `group:*` folding (`applyActivity` / `addMessage`).
 *
 * Degrades gracefully: with no backend the store keeps empty collections, sets a
 * friendly error, and the UI renders loading/empty/error states (no crash).
 */

import { create } from "zustand";

import adminAdasheService, {
  extractAdminAdasheError,
} from "../services/adminAdashe.service";
import type {
  AdminCreateGroupPayload,
  AdminGroupDetail,
  AdminGroupListParams,
  AdminGroupMember,
  AdminGroupRow,
  AdminPayoutRequest,
  AdminProposal,
  ContributionAudit,
  GroupActivity,
  GroupMessage,
  GroupRules,
  Paginated,
} from "../types/adashe";

type Status = "idle" | "loading" | "ready" | "error";

interface AdminAdasheState {
  // Groups directory.
  groups: AdminGroupRow[];
  groupsTotal: number;
  groupsPage: number;
  groupsLimit: number;
  filters: AdminGroupListParams;
  listStatus: Status;
  listError: string | null;

  // Cross-group payout-request queue (dashboard-linked).
  payoutQueue: AdminPayoutRequest[];
  payoutQueueStatus: Status;

  // Cross-group slot-shift decision queue (dashboard-linked).
  proposalQueue: AdminProposal[];
  proposalQueueStatus: Status;

  // Current group detail.
  currentGroupId: string | null;
  detail: AdminGroupDetail | null;
  detailStatus: Status;
  detailError: string | null;

  // Per-group tab caches.
  members: AdminGroupMember[];
  membersLoaded: boolean;
  contributions: ContributionAudit | null;
  contributionsLoaded: boolean;
  groupPayouts: AdminPayoutRequest[];
  groupPayoutsLoaded: boolean;
  proposals: AdminProposal[];
  proposalsLoaded: boolean;
  messages: GroupMessage[];
  messagesLoaded: boolean;
}

interface AdminAdasheActions {
  // Directory.
  setFilters: (patch: Partial<AdminGroupListParams>) => void;
  fetchGroups: (opts?: { silent?: boolean }) => Promise<void>;
  createGroup: (payload: AdminCreateGroupPayload) => Promise<AdminGroupDetail>;

  // Cross-group queues.
  fetchPayoutQueue: (opts?: { silent?: boolean }) => Promise<void>;
  fetchProposalQueue: (opts?: { silent?: boolean }) => Promise<void>;

  // Group detail.
  loadGroup: (id: string) => Promise<void>;
  refreshDetail: () => Promise<void>;
  clearGroup: () => void;

  invite: (id: string, email: string) => Promise<void>;
  suspend: (id: string, reason: string) => Promise<void>;
  reinstate: (id: string) => Promise<void>;
  updateRules: (id: string, rules: Partial<GroupRules>) => Promise<void>;

  fetchMembers: (id: string) => Promise<void>;
  fetchContributions: (id: string, cycle?: number) => Promise<void>;

  fetchGroupPayouts: (id: string) => Promise<void>;
  markPayoutSent: (
    id: string,
    reqId: string,
    payload: { paymentReference: string; note?: string }
  ) => Promise<void>;
  cancelPayout: (id: string, reqId: string, reason: string) => Promise<void>;

  fetchProposals: (id: string) => Promise<void>;
  approveProposal: (id: string, pid: string, note?: string) => Promise<void>;
  rejectProposal: (id: string, pid: string, reason: string) => Promise<void>;

  fetchMessages: (id: string) => Promise<void>;
  addMessage: (message: GroupMessage) => void;

  /** Fold a live `group:activity` event into the open group + queues. */
  applyActivity: (activity: GroupActivity) => void;

  reset: () => void;
}

export type AdminAdasheStore = AdminAdasheState & AdminAdasheActions;

const INITIAL: AdminAdasheState = {
  groups: [],
  groupsTotal: 0,
  groupsPage: 1,
  groupsLimit: 12,
  filters: { page: 1, limit: 12 },
  listStatus: "idle",
  listError: null,

  payoutQueue: [],
  payoutQueueStatus: "idle",

  proposalQueue: [],
  proposalQueueStatus: "idle",

  currentGroupId: null,
  detail: null,
  detailStatus: "idle",
  detailError: null,

  members: [],
  membersLoaded: false,
  contributions: null,
  contributionsLoaded: false,
  groupPayouts: [],
  groupPayoutsLoaded: false,
  proposals: [],
  proposalsLoaded: false,
  messages: [],
  messagesLoaded: false,
};

/** Actions that should refresh the open group / queues when seen live. */
const REFRESH_ACTIONS = new Set([
  "member.joined",
  "invite.accepted",
  "contribution.paid",
  "proposal.created",
  "proposal.vote",
  "slot_shift.requested",
  "proposal.ready_for_admin",
  "proposal.passed",
  "proposal.rejected",
  "slot_shift.approved",
  "slot_shift.declined",
  "payout.requested",
  "payout.marked_sent",
  "payout.confirmed",
  "payout.disputed",
]);

export const useAdminAdasheStore = create<AdminAdasheStore>()((set, get) => ({
  ...INITIAL,

  // --- Directory -------------------------------------------------------------

  setFilters: (patch) =>
    set((prev) => ({ filters: { ...prev.filters, ...patch } })),

  fetchGroups: async (opts) => {
    if (!opts?.silent) set({ listStatus: "loading" });
    set({ listError: null });
    try {
      const { filters, groupsLimit } = get();
      const res: Paginated<AdminGroupRow> = await adminAdasheService.listGroups(
        { limit: groupsLimit, ...filters }
      );
      set({
        groups: res.items,
        groupsTotal: res.total,
        groupsPage: res.page,
        groupsLimit: res.limit,
        listStatus: "ready",
      });
    } catch (err) {
      set({
        listStatus: "error",
        listError: extractAdminAdasheError(
          err,
          "Unable to load contribution groups right now."
        ),
      });
    }
  },

  createGroup: async (payload) => {
    try {
      const detail = await adminAdasheService.createGroup(payload);
      void get().fetchGroups({ silent: true });
      return detail;
    } catch (err) {
      throw new Error(
        extractAdminAdasheError(err, "Could not create the circle.")
      );
    }
  },

  // --- Cross-group queues ----------------------------------------------------

  fetchPayoutQueue: async (opts) => {
    if (!opts?.silent) set({ payoutQueueStatus: "loading" });
    try {
      const res = await adminAdasheService.payoutRequestsQueue({ limit: 50 });
      set({ payoutQueue: res.items, payoutQueueStatus: "ready" });
    } catch {
      set({ payoutQueue: [], payoutQueueStatus: "error" });
    }
  },

  fetchProposalQueue: async (opts) => {
    if (!opts?.silent) set({ proposalQueueStatus: "loading" });
    try {
      const res = await adminAdasheService.proposalsQueue({ limit: 50 });
      set({ proposalQueue: res.items, proposalQueueStatus: "ready" });
    } catch {
      set({ proposalQueue: [], proposalQueueStatus: "error" });
    }
  },

  // --- Group detail ----------------------------------------------------------

  loadGroup: async (id) => {
    const switching = get().currentGroupId !== id;
    set({
      currentGroupId: id,
      detailStatus: "loading",
      detailError: null,
      ...(switching
        ? {
            detail: null,
            members: [],
            membersLoaded: false,
            contributions: null,
            contributionsLoaded: false,
            groupPayouts: [],
            groupPayoutsLoaded: false,
            proposals: [],
            proposalsLoaded: false,
            messages: [],
            messagesLoaded: false,
          }
        : {}),
    });
    try {
      const detail = await adminAdasheService.getGroup(id);
      set({ detail, detailStatus: "ready" });
    } catch (err) {
      set({
        detailStatus: "error",
        detailError: extractAdminAdasheError(
          err,
          "Unable to load this circle right now."
        ),
      });
    }
  },

  refreshDetail: async () => {
    const id = get().currentGroupId;
    if (!id) return;
    try {
      const detail = await adminAdasheService.getGroup(id);
      set({ detail, detailStatus: "ready" });
    } catch {
      /* keep last-known detail on transient failure */
    }
  },

  clearGroup: () =>
    set({
      currentGroupId: null,
      detail: null,
      detailStatus: "idle",
      detailError: null,
      members: [],
      membersLoaded: false,
      contributions: null,
      contributionsLoaded: false,
      groupPayouts: [],
      groupPayoutsLoaded: false,
      proposals: [],
      proposalsLoaded: false,
      messages: [],
      messagesLoaded: false,
    }),

  invite: async (id, email) => {
    try {
      await adminAdasheService.invite(id, email);
    } catch (err) {
      throw new Error(
        extractAdminAdasheError(err, "Could not send the invite.")
      );
    }
  },

  suspend: async (id, reason) => {
    try {
      await adminAdasheService.suspend(id, reason);
      void get().refreshDetail();
      void get().fetchGroups({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminAdasheError(err, "Could not suspend the group.")
      );
    }
  },

  reinstate: async (id) => {
    try {
      await adminAdasheService.reinstate(id);
      void get().refreshDetail();
      void get().fetchGroups({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdminAdasheError(err, "Could not reinstate the group.")
      );
    }
  },

  updateRules: async (id, rules) => {
    try {
      const updated = await adminAdasheService.updateRules(id, rules);
      set((prev) =>
        prev.detail && prev.detail.id === id
          ? { detail: { ...prev.detail, rules: { ...prev.detail.rules, ...updated } } }
          : {}
      );
    } catch (err) {
      throw new Error(
        extractAdminAdasheError(err, "Could not update the rules.")
      );
    }
  },

  // --- Members ---------------------------------------------------------------

  fetchMembers: async (id) => {
    try {
      const members = await adminAdasheService.getMembers(id);
      set({ members, membersLoaded: true });
    } catch {
      set({ members: [], membersLoaded: true });
    }
  },

  // --- Contributions ---------------------------------------------------------

  fetchContributions: async (id, cycle) => {
    set({ contributionsLoaded: false });
    try {
      const contributions = await adminAdasheService.getContributions(id, {
        cycle,
      });
      set({ contributions, contributionsLoaded: true });
    } catch {
      set({ contributions: null, contributionsLoaded: true });
    }
  },

  // --- Payout requests -------------------------------------------------------

  fetchGroupPayouts: async (id) => {
    try {
      const groupPayouts = await adminAdasheService.groupPayoutRequests(id);
      set({ groupPayouts, groupPayoutsLoaded: true });
    } catch {
      set({ groupPayouts: [], groupPayoutsLoaded: true });
    }
  },

  markPayoutSent: async (id, reqId, payload) => {
    try {
      const updated = await adminAdasheService.markPayoutSent(id, reqId, payload);
      set((prev) => ({
        groupPayouts: prev.groupPayouts.map((p) =>
          p.id === reqId ? { ...p, ...updated } : p
        ),
        payoutQueue: prev.payoutQueue.filter((p) => p.id !== reqId),
      }));
      void get().refreshDetail();
    } catch (err) {
      throw new Error(
        extractAdminAdasheError(err, "Could not mark the payout as sent.")
      );
    }
  },

  cancelPayout: async (id, reqId, reason) => {
    try {
      const updated = await adminAdasheService.cancelPayout(id, reqId, reason);
      set((prev) => ({
        groupPayouts: prev.groupPayouts.map((p) =>
          p.id === reqId ? { ...p, ...updated } : p
        ),
        payoutQueue: prev.payoutQueue.filter((p) => p.id !== reqId),
      }));
      void get().refreshDetail();
    } catch (err) {
      throw new Error(
        extractAdminAdasheError(err, "Could not cancel the payout request.")
      );
    }
  },

  // --- Proposals -------------------------------------------------------------

  fetchProposals: async (id) => {
    try {
      const proposals = await adminAdasheService.groupProposals(id);
      set({ proposals, proposalsLoaded: true });
    } catch {
      set({ proposals: [], proposalsLoaded: true });
    }
  },

  approveProposal: async (id, pid, note) => {
    try {
      const updated = await adminAdasheService.approveProposal(id, pid, note);
      set((prev) => ({
        proposals: prev.proposals.map((p) =>
          p.id === pid ? { ...p, ...updated } : p
        ),
        proposalQueue: prev.proposalQueue.filter((p) => p.id !== pid),
      }));
      void get().refreshDetail();
    } catch (err) {
      throw new Error(
        extractAdminAdasheError(err, "Could not approve the slot-shift.")
      );
    }
  },

  rejectProposal: async (id, pid, reason) => {
    try {
      const updated = await adminAdasheService.rejectProposal(id, pid, reason);
      set((prev) => ({
        proposals: prev.proposals.map((p) =>
          p.id === pid ? { ...p, ...updated } : p
        ),
        proposalQueue: prev.proposalQueue.filter((p) => p.id !== pid),
      }));
      void get().refreshDetail();
    } catch (err) {
      throw new Error(
        extractAdminAdasheError(err, "Could not reject the slot-shift.")
      );
    }
  },

  // --- Chat ------------------------------------------------------------------

  fetchMessages: async (id) => {
    try {
      const res = await adminAdasheService.getMessages(id, {
        page: 1,
        limit: 50,
      });
      set({ messages: res.items ?? [], messagesLoaded: true });
    } catch {
      set({ messages: [], messagesLoaded: true });
    }
  },

  addMessage: (message) => {
    set((prev) => {
      if (prev.messages.some((m) => m.id === message.id)) return prev;
      const withoutPendingMatch = prev.messages.filter(
        (m) =>
          !(
            m.pending &&
            m.message === message.message &&
            m.senderName === message.senderName
          )
      );
      return { messages: [...withoutPendingMatch, message] };
    });
  },

  // --- Live activity ---------------------------------------------------------

  applyActivity: (activity) => {
    const { currentGroupId } = get();
    if (!activity) return;

    if (activity.groupId !== currentGroupId) {
      // A background group changed — nudge the cross-group queues + directory.
      void get().fetchPayoutQueue({ silent: true });
      void get().fetchProposalQueue({ silent: true });
      void get().fetchGroups({ silent: true });
      return;
    }

    if (REFRESH_ACTIONS.has(activity.action)) {
      void get().refreshDetail();
      if (
        activity.action.startsWith("proposal") ||
        activity.action.startsWith("slot_shift")
      ) {
        if (get().proposalsLoaded) void get().fetchProposals(activity.groupId);
        void get().fetchProposalQueue({ silent: true });
      }
      if (activity.action.startsWith("payout")) {
        if (get().groupPayoutsLoaded)
          void get().fetchGroupPayouts(activity.groupId);
        void get().fetchPayoutQueue({ silent: true });
      }
      if (
        activity.action.startsWith("contribution") &&
        get().contributionsLoaded
      ) {
        void get().fetchContributions(activity.groupId);
      }
      if (activity.action.startsWith("member") && get().membersLoaded) {
        void get().fetchMembers(activity.groupId);
      }
    }
  },

  reset: () => set({ ...INITIAL }),
}));

export default useAdminAdasheStore;
