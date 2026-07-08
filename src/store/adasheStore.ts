/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed Adashe store (zustand) — the source of truth for the routed,
 * LIVE Adashe surface (`/app/adashe` + `/app/adashe/:groupId`) and the dashboard
 * Adashe widgets. Talks to the backend via `src/services/adashe.service.ts`.
 *
 * This SUPERSEDES the mock `appStore.contributionGroups` handlers for the Adashe
 * pages — no localStorage seeding, no simulated bot replies, no client-side
 * rotation math. Live `group:*` socket events fold in via `applyActivity` /
 * `addMessage`.
 *
 * Degrades gracefully: with no backend the store keeps empty collections, sets a
 * friendly `error`, and the UI renders loading/empty/error states (no crash, no
 * console spew).
 */

import { create } from "zustand";

import adasheService, {
  extractAdasheError,
} from "../services/adashe.service";
import type {
  AttendanceSession,
  ContributeResult,
  CreateGroupPayload,
  GroupActivity,
  GroupDetail,
  GroupInvitation,
  GroupMessage,
  GroupSummary,
  Proposal,
  VoteChoice,
} from "../types/adashe";

type Status = "idle" | "loading" | "ready" | "error";

interface AdasheState {
  // List page.
  myGroups: GroupSummary[];
  invitations: GroupInvitation[];
  listStatus: Status;
  listError: string | null;

  // Current workspace.
  currentGroupId: string | null;
  detail: GroupDetail | null;
  detailStatus: Status;
  detailError: string | null;

  // Workspace tabs.
  messages: GroupMessage[];
  messagesLoaded: boolean;
  proposals: Proposal[];
  proposalsLoaded: boolean;
  attendance: AttendanceSession[];
  attendanceLoaded: boolean;
}

interface AdasheActions {
  // List.
  fetchMyGroups: (opts?: { silent?: boolean }) => Promise<void>;
  fetchInvitations: () => Promise<void>;
  createGroup: (payload: CreateGroupPayload) => Promise<GroupDetail>;
  acceptInvitation: (invId: string) => Promise<void>;
  declineInvitation: (invId: string) => Promise<void>;

  // Workspace.
  loadWorkspace: (groupId: string) => Promise<void>;
  refreshDetail: () => Promise<void>;
  clearWorkspace: () => void;

  invite: (groupId: string, email: string) => Promise<void>;
  contribute: (groupId: string, amount?: number) => Promise<ContributeResult>;

  fetchMessages: (groupId: string) => Promise<void>;
  addMessage: (message: GroupMessage) => void;

  fetchProposals: (groupId: string) => Promise<void>;
  createProposal: (
    groupId: string,
    payload: { title: string; text?: string }
  ) => Promise<void>;
  voteProposal: (
    groupId: string,
    proposalId: string,
    vote: VoteChoice
  ) => Promise<void>;
  requestSlotShift: (
    groupId: string,
    payload: { targetMemberId: string; reason?: string }
  ) => Promise<void>;

  fetchAttendance: (groupId: string) => Promise<void>;
  checkIn: (groupId: string, sessionId: string) => Promise<void>;

  requestPayout: (groupId: string) => Promise<void>;
  confirmPayoutReceived: (groupId: string, reqId: string) => Promise<void>;

  /** Fold a live `group:activity` event into the open workspace + refresh. */
  applyActivity: (activity: GroupActivity) => void;

  reset: () => void;
}

export type AdasheStore = AdasheState & AdasheActions;

const INITIAL: AdasheState = {
  myGroups: [],
  invitations: [],
  listStatus: "idle",
  listError: null,

  currentGroupId: null,
  detail: null,
  detailStatus: "idle",
  detailError: null,

  messages: [],
  messagesLoaded: false,
  proposals: [],
  proposalsLoaded: false,
  attendance: [],
  attendanceLoaded: false,
};

/** Actions that should trigger a workspace refresh when seen live. */
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
  "attendance.session_opened",
  "attendance.check_in",
]);

export const useAdasheStore = create<AdasheStore>()((set, get) => ({
  ...INITIAL,

  // --- List ------------------------------------------------------------------

  fetchMyGroups: async (opts) => {
    if (!opts?.silent) set({ listStatus: "loading" });
    set({ listError: null });
    try {
      const myGroups = await adasheService.myGroups();
      set({ myGroups, listStatus: "ready" });
    } catch (err) {
      set({
        listStatus: "error",
        listError: extractAdasheError(
          err,
          "Unable to load your Adashe circles right now."
        ),
      });
    }
  },

  fetchInvitations: async () => {
    try {
      const invitations = await adasheService.myInvitations();
      set({ invitations });
    } catch {
      // Non-fatal: an empty invitations list is fine.
      set({ invitations: [] });
    }
  },

  createGroup: async (payload) => {
    try {
      const detail = await adasheService.createGroup(payload);
      // Refresh the list so the new circle shows immediately.
      void get().fetchMyGroups({ silent: true });
      return detail;
    } catch (err) {
      throw new Error(
        extractAdasheError(err, "Could not create the circle.")
      );
    }
  },

  acceptInvitation: async (invId) => {
    try {
      await adasheService.acceptInvitation(invId);
      set((prev) => ({
        invitations: prev.invitations.filter((i) => i.id !== invId),
      }));
      void get().fetchMyGroups({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdasheError(err, "Could not accept the invitation.")
      );
    }
  },

  declineInvitation: async (invId) => {
    try {
      await adasheService.declineInvitation(invId);
      set((prev) => ({
        invitations: prev.invitations.filter((i) => i.id !== invId),
      }));
    } catch (err) {
      throw new Error(
        extractAdasheError(err, "Could not decline the invitation.")
      );
    }
  },

  // --- Workspace -------------------------------------------------------------

  loadWorkspace: async (groupId) => {
    // Switching groups: reset tab caches so we do not show stale data.
    const switching = get().currentGroupId !== groupId;
    set({
      currentGroupId: groupId,
      detailStatus: "loading",
      detailError: null,
      ...(switching
        ? {
            detail: null,
            messages: [],
            messagesLoaded: false,
            proposals: [],
            proposalsLoaded: false,
            attendance: [],
            attendanceLoaded: false,
          }
        : {}),
    });
    try {
      const detail = await adasheService.getGroup(groupId);
      set({ detail, detailStatus: "ready" });
    } catch (err) {
      set({
        detailStatus: "error",
        detailError: extractAdasheError(
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
      const detail = await adasheService.getGroup(id);
      set({ detail, detailStatus: "ready" });
    } catch {
      /* keep the last-known detail on a transient failure */
    }
  },

  clearWorkspace: () =>
    set({
      currentGroupId: null,
      detail: null,
      detailStatus: "idle",
      detailError: null,
      messages: [],
      messagesLoaded: false,
      proposals: [],
      proposalsLoaded: false,
      attendance: [],
      attendanceLoaded: false,
    }),

  invite: async (groupId, email) => {
    try {
      await adasheService.invite(groupId, email);
    } catch (err) {
      throw new Error(extractAdasheError(err, "Could not send the invite."));
    }
  },

  contribute: async (groupId, amount) => {
    try {
      const result = await adasheService.contribute(groupId, amount);
      // Reflect the new pool immediately, then reconcile with a detail refresh.
      set((prev) =>
        prev.detail && prev.detail.id === groupId
          ? {
              detail: {
                ...prev.detail,
                poolBalance: result.poolBalance ?? prev.detail.poolBalance,
                collectedThisCycle:
                  result.collectedThisCycle ??
                  prev.detail.collectedThisCycle,
                me: {
                  ...prev.detail.me,
                  hasContributedThisCycle: true,
                },
              },
            }
          : {}
      );
      void get().refreshDetail();
      return result;
    } catch (err) {
      throw new Error(
        extractAdasheError(err, "Could not record your contribution.")
      );
    }
  },

  // --- Chat ------------------------------------------------------------------

  fetchMessages: async (groupId) => {
    try {
      const res = await adasheService.getMessages(groupId, {
        page: 1,
        limit: 50,
      });
      // Server returns oldest→newest within the page for straightforward render.
      set({ messages: res.items ?? [], messagesLoaded: true });
    } catch {
      set({ messages: [], messagesLoaded: true });
    }
  },

  addMessage: (message) => {
    set((prev) => {
      // De-dupe by id; reconcile an optimistic pending message when the real
      // one lands (same sender + text).
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

  // --- Proposals -------------------------------------------------------------

  fetchProposals: async (groupId) => {
    try {
      const proposals = await adasheService.getProposals(groupId);
      set({ proposals, proposalsLoaded: true });
    } catch {
      set({ proposals: [], proposalsLoaded: true });
    }
  },

  createProposal: async (groupId, payload) => {
    try {
      const proposal = await adasheService.createProposal(groupId, payload);
      set((prev) => ({ proposals: [proposal, ...prev.proposals] }));
    } catch (err) {
      throw new Error(
        extractAdasheError(err, "Could not post the proposal.")
      );
    }
  },

  voteProposal: async (groupId, proposalId, vote) => {
    try {
      const updated = await adasheService.voteProposal(
        groupId,
        proposalId,
        vote
      );
      set((prev) => ({
        proposals: prev.proposals.map((p) =>
          p.id === proposalId ? updated : p
        ),
      }));
    } catch (err) {
      throw new Error(extractAdasheError(err, "Could not cast your vote."));
    }
  },

  requestSlotShift: async (groupId, payload) => {
    try {
      const proposal = await adasheService.requestSlotShift(groupId, payload);
      set((prev) => ({ proposals: [proposal, ...prev.proposals] }));
    } catch (err) {
      throw new Error(
        extractAdasheError(err, "Could not request the slot-shift.")
      );
    }
  },

  // --- Attendance ------------------------------------------------------------

  fetchAttendance: async (groupId) => {
    try {
      const attendance = await adasheService.getAttendance(groupId);
      set({ attendance, attendanceLoaded: true });
    } catch {
      set({ attendance: [], attendanceLoaded: true });
    }
  },

  checkIn: async (groupId, sessionId) => {
    try {
      const updated = await adasheService.checkIn(groupId, sessionId);
      set((prev) => ({
        attendance: prev.attendance.map((s) =>
          s.id === sessionId ? updated : s
        ),
      }));
    } catch (err) {
      throw new Error(extractAdasheError(err, "Could not check in."));
    }
  },

  // --- Payouts ---------------------------------------------------------------

  requestPayout: async (groupId) => {
    try {
      const request = await adasheService.requestPayout(groupId);
      set((prev) =>
        prev.detail && prev.detail.id === groupId
          ? { detail: { ...prev.detail, pendingPayoutRequest: request } }
          : {}
      );
      void get().refreshDetail();
    } catch (err) {
      throw new Error(
        extractAdasheError(err, "Could not request your payout.")
      );
    }
  },

  confirmPayoutReceived: async (groupId, reqId) => {
    try {
      await adasheService.confirmPayoutReceived(groupId, reqId);
      void get().refreshDetail();
      void get().fetchMyGroups({ silent: true });
    } catch (err) {
      throw new Error(
        extractAdasheError(err, "Could not confirm the payout.")
      );
    }
  },

  // --- Live activity ---------------------------------------------------------

  applyActivity: (activity) => {
    const { currentGroupId } = get();
    if (!activity || activity.groupId !== currentGroupId) {
      // Still nudge the list so my-groups summaries stay fresh.
      void get().fetchMyGroups({ silent: true });
      return;
    }

    if (REFRESH_ACTIONS.has(activity.action)) {
      void get().refreshDetail();
      // Refresh the specific tab caches that are already loaded.
      if (
        activity.action.startsWith("proposal") ||
        activity.action.startsWith("slot_shift")
      ) {
        if (get().proposalsLoaded) void get().fetchProposals(activity.groupId);
      }
      if (activity.action.startsWith("attendance")) {
        if (get().attendanceLoaded)
          void get().fetchAttendance(activity.groupId);
      }
      void get().fetchMyGroups({ silent: true });
    }
  },

  reset: () => set({ ...INITIAL }),
}));

export default useAdasheStore;
