/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LIVE Adashe / Esusu contribution-group types (PRD 09).
 *
 * These mirror the server contract at `/api/v1/contribution-groups/*` and the
 * `group:*` socket events on `/rt/user`. The mock `ContributionGroup`
 * (`src/types.ts`) is SUPERSEDED by these shapes for the routed, server-backed
 * Adashe surface — nothing here depends on `appStore`.
 *
 * Admin-dev note: this file is a safe shared reference. The admin `/bennie`
 * Adashe screens can reuse `GroupDetail`, `GroupMessage`, `Proposal`, etc., but
 * should build their own admin-plane service (against `adminApi`) rather than
 * import `adashe.service.ts` (bound to the user `api`).
 */

export type GroupType = "ADASHE" | "ESUSU" | "CUSTOM";
export type GroupFrequency = "WEEKLY" | "MONTHLY";
export type GroupStatus = "FORMING" | "ACTIVE" | "COMPLETED" | "SUSPENDED";

export type MemberStatus =
  | "INVITED"
  | "ACTIVE"
  | "RECEIVED_PAYOUT"
  | "EXITED"
  | "REMOVED";

export type ProposalKind = "GENERAL" | "SLOT_SHIFT";
export type ProposalStatus =
  | "ACTIVE"
  | "PASSED"
  | "REJECTED"
  | "AWAITING_ADMIN"
  | "APPROVED"
  | "DECLINED"
  | "CANCELLED";

export type VoteChoice = "yes" | "no";

export type PayoutStatus =
  | "REQUESTED"
  | "MARKED_SENT"
  | "CONFIRMED_RECEIVED"
  | "DISPUTED";

export interface GroupRules {
  lateFeePercent: number;
  missLimit: number;
  exitPenalty: number;
}

/** A single slot in the rotation order. */
export interface PayoutOrderSlot {
  position: number;
  memberId?: string;
  userId: string;
  name?: string;
  paid: boolean;
  paidAt?: string;
}

/** Light summary returned by GET /my-groups (backs the list + dashboard). */
export interface GroupSummary {
  id: string;
  name: string;
  type: GroupType;
  status: GroupStatus;
  frequency: GroupFrequency;
  contributionAmount: number;
  maxSlots: number;
  currentCycle: number;
  poolBalance: number;
  myPosition?: number;
  myStatus?: MemberStatus;
  isMyTurn?: boolean;
  hasContributedThisCycle?: boolean;
  pendingActionCount?: number;
  pendingPayoutRequest?: PayoutRequest | null;
}

/** The caller's own membership view inside a group detail. */
export interface GroupMe {
  memberId: string;
  position: number;
  status: MemberStatus;
  isMyTurn: boolean;
  hasContributedThisCycle: boolean;
}

/** Full detail returned by GET /:id. */
export interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  type: GroupType;
  status: GroupStatus;
  frequency: GroupFrequency;
  contributionAmount: number;
  maxSlots: number;
  currentCycle: number;
  activePosition: number;
  poolBalance: number;
  rules: GroupRules;
  me: GroupMe;
  payoutOrder: PayoutOrderSlot[];
  members?: GroupMemberView[];
  expectedPoolThisCycle?: number;
  collectedThisCycle?: number;
  arrears?: number;
  pendingProposals?: number;
  pendingPayoutRequest?: PayoutRequest | null;
}

/** A member row for the rotation/roster (denormalized). */
export interface GroupMemberView {
  memberId: string;
  userId: string;
  name: string;
  position: number;
  status: MemberStatus;
  totalContributed?: number;
  hasContributedThisCycle?: boolean;
}

/** An invitation the caller received (GET /invitations). */
export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  type?: GroupType;
  inviterName?: string;
  contributionAmount?: number;
  frequency?: GroupFrequency;
  maxSlots?: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  createdAt: string;
}

/** A persisted chat message (GET /:id/messages + group:message:new). */
export interface GroupMessage {
  id: string;
  groupId: string;
  senderType: "user" | "admin" | "system";
  senderId?: string;
  senderName: string;
  message: string;
  createdAt: string;
  /** Client-only: an optimistic message not yet acknowledged by the server. */
  pending?: boolean;
}

export interface ProposalVote {
  userId: string;
  vote: VoteChoice;
  at: string;
}

export interface SlotShiftInfo {
  requesterMemberId: string;
  requesterPosition: number;
  requesterName?: string;
  targetMemberId: string;
  targetPosition: number;
  targetName?: string;
}

/** A group proposal (general or slot-shift). */
export interface Proposal {
  id: string;
  groupId: string;
  kind: ProposalKind;
  title: string;
  text?: string;
  createdByUserId: string;
  createdByName?: string;
  slotShift?: SlotShiftInfo;
  status: ProposalStatus;
  eligibleCount: number;
  tally: { yes: number; no: number };
  myVote?: VoteChoice | null;
  adminDecision?: {
    decision: "APPROVE" | "DECLINE";
    reason?: string;
    at: string;
  };
  createdAt: string;
  updatedAt?: string;
}

/** An attendance session (GET /:id/attendance). */
export interface AttendanceSession {
  id: string;
  groupId: string;
  sessionDate: string;
  title: string;
  presentCount: number;
  iAmPresent: boolean;
}

/** A manual payout request (payoutRequests lifecycle). */
export interface PayoutRequest {
  id: string;
  groupId: string;
  cycle: number;
  position: number;
  recipientMemberId: string;
  recipientUserId: string;
  amount: number;
  status: PayoutStatus;
  requestedAt: string;
  markedSentAt?: string;
  confirmedAt?: string;
  note?: string;
}

/** Result of POST /:id/contribute. */
export interface ContributeResult {
  cycle: number;
  amount: number;
  poolBalance: number;
  totalContributed: number;
  collectedThisCycle?: number;
  expectedPoolThisCycle?: number;
}

/** A live activity event (group:activity). */
export interface GroupActivity {
  id?: string;
  groupId: string;
  actorType: "user" | "admin" | "system";
  actorId?: string;
  actorName: string;
  action: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

/** Payload to create a circle. */
export interface CreateGroupPayload {
  name: string;
  description: string;
  type: GroupType;
  contributionAmount: number;
  frequency: GroupFrequency;
  maxSlots: number;
  rules?: Partial<GroupRules>;
}

/** Generic paginated list envelope. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// ADMIN-PLANE additions (safe extension — the user side ignores these).
//
// The admin `/bennie/adashesu-contributions` surface reads the same ROSCA
// domain but with cross-group / oversight shapes the user plane never sees:
// organizer info, arrears, denormalized recipient/group names on payout
// requests, contribution audit rows, and slot-shift decision tallies.
// Mirrors PRD/admin_module/adas_hesu_contributions/adas_hesu_contributions.md.
// ---------------------------------------------------------------------------

export type OrganizerType = "member" | "admin";

export type PayoutRequestStatus =
  | "REQUESTED"
  | "MARKED_SENT"
  | "CONFIRMED_RECEIVED"
  | "DISPUTED"
  | "CANCELLED";

/** A row in the admin groups directory (GET /admin/contribution-groups). */
export interface AdminGroupRow {
  id: string;
  name: string;
  type: GroupType;
  status: GroupStatus;
  frequency: GroupFrequency;
  contributionAmount: number;
  maxSlots: number;
  totalMembers: number;
  activeMembers?: number;
  currentCycle: number;
  poolBalance: number;
  organizerType: OrganizerType;
  organizerId?: string;
  organizerName?: string;
  paidPositions?: number;
  arrears?: number;
  hasArrears?: boolean;
  pendingPayoutRequests?: number;
  pendingSlotShifts?: number;
  createdAt?: string;
}

/** Filters accepted by GET /admin/contribution-groups. */
export interface AdminGroupListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: GroupStatus;
  type?: GroupType;
  frequency?: GroupFrequency;
  organizerType?: OrganizerType;
  hasArrears?: boolean;
  hasPendingPayout?: boolean;
  hasPendingSlotShift?: boolean;
  sortBy?: "createdAt" | "currentCycle" | "totalMembers";
  order?: "asc" | "desc";
}

/** Full admin group detail (GET /admin/contribution-groups/:id). */
export interface AdminGroupDetail {
  id: string;
  name: string;
  description?: string;
  type: GroupType;
  status: GroupStatus;
  frequency: GroupFrequency;
  contributionAmount: number;
  maxSlots: number;
  currentCycle: number;
  activePosition?: number;
  poolBalance: number;
  rules: GroupRules;
  organizerType: OrganizerType;
  organizerId?: string;
  organizerName?: string;
  payoutOrder: PayoutOrderSlot[];
  members?: AdminGroupMember[];
  expectedPoolThisCycle?: number;
  collectedThisCycle?: number;
  arrears?: number;
  nextRecipientName?: string;
  nextRecipientPosition?: number;
  pendingPayoutRequests?: number;
  pendingSlotShifts?: number;
  banned?: boolean;
  banReason?: string;
  createdAt?: string;
}

/** A member row with admin-visible contribution health. */
export interface AdminGroupMember {
  memberId: string;
  userId: string;
  name: string;
  email?: string;
  position: number;
  status: MemberStatus;
  totalContributed?: number;
  paidCount?: number;
  lateCount?: number;
  missedCount?: number;
  arrears?: number;
  hasContributedThisCycle?: boolean;
  payoutReceivedCycle?: number;
}

/** A payout request in the admin manual-payout queue (cross-group or per-group). */
export interface AdminPayoutRequest {
  id: string;
  groupId: string;
  groupName?: string;
  cycle: number;
  position: number;
  recipientMemberId: string;
  recipientUserId: string;
  recipientName?: string;
  poolAmount: number;
  status: PayoutRequestStatus;
  requestedAt: string;
  markedSentAt?: string;
  markedSentBy?: string;
  paymentReference?: string;
  confirmedAt?: string;
  cancelReason?: string;
  note?: string;
}

/** Vote tally on a slot-shift proposal as the admin sees it. */
export interface ProposalTally {
  for: number;
  against: number;
  eligible: number;
}

/**
 * A proposal as the admin decision queue sees it. Extends the user `Proposal`
 * concept with the admin tally shape + swap participants. Tolerant of both the
 * user `{ yes, no }` tally and the admin `{ for, against, eligible }` tally.
 */
export interface AdminProposal {
  id: string;
  groupId: string;
  groupName?: string;
  kind: ProposalKind;
  title?: string;
  text?: string;
  status: ProposalStatus;
  requestedByName?: string;
  slotShift?: SlotShiftInfo;
  fromPosition?: number;
  toPosition?: number;
  tally?: ProposalTally;
  votes?: ProposalVote[];
  decidedByName?: string;
  decisionReason?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/** A single row in the cycle contribution audit trail. */
export interface ContributionAuditRow {
  memberId: string;
  userId: string;
  name: string;
  amount: number;
  dueDate?: string;
  status: "PENDING" | "PAID" | "LATE" | "MISSED";
  paidAt?: string;
  lateFee?: number;
}

/** GET /admin/contribution-groups/:id/contributions response. */
export interface ContributionAudit {
  cycle: number;
  rows: ContributionAuditRow[];
  poolCollected?: number;
  expectedPool?: number;
  arrears?: number;
}

/** Payload to admin-create a circle as a non-paying overseer. */
export interface AdminCreateGroupPayload {
  name: string;
  description?: string;
  type: GroupType;
  contributionAmount: number;
  frequency: GroupFrequency;
  maxSlots: number;
  organizerType?: OrganizerType;
  rules?: Partial<GroupRules>;
}
