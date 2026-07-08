# PRD 09: Adashe / Esusu Contribution Groups (User Module)

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded · ⚠️ drift / open question
> **Overall module status: 📄** — the current UI (`src/pages/cooperative/AdasheView.tsx`) is a
> **client-only mock** driven by `FarmerAppState.contributionGroups` (`src/types.ts`). This document
> specifies the **as-built target** for the LIVE, server-backed module and supersedes that mock.
>
> **Owner:** user-prd-enricher (docs) · backend-dev (API) · user-dev (frontend).
> **Money model (locked with the owner):** **TRACK-POOL-ONLY + manual admin payout** — contributions
> are *recorded* into a tracked pool counter and logged; they do **not** debit the live wallet, and
> payouts are wired **off-platform** by an admin, then confirmed by the recipient.

Related specs:
- Admin oversight (aligns with, does not redefine, admin-owned parts):
  [`PRD/admin_module/adas_hesu_contributions/adas_hesu_contributions.md`](../../admin_module/adas_hesu_contributions/adas_hesu_contributions.md).
- Realtime transport: [`PRD/socket.io.md`](../../socket.io.md).
- Notification engine: [`PRD/notification.md`](../../notification.md).
- Data model catalog: [`PRD/data_structure.md`](../../data_structure.md) §1.6 (mock) + the LIVE
  Adashe collections (added by this PRD).
- Dashboard integration: [`PRD/user_module/dashboard/user_dashboard.md`](../dashboard/user_dashboard.md) §4.

---

## 1. Overview

Adashe / Esusu are Nigerian **rotating savings & credit associations (ROSCAs)**: a fixed set of
members each contribute a fixed amount every cycle into a shared **pool**, and each cycle the pool is
paid out to one member in a pre-agreed **rotation order** until every member has been paid once. The
LIVE module adds five capabilities on top of the mock:

1. **Consent-based membership** — organizers **invite by registered email**; the invitee must
   **accept** to join (no silent adds).
2. **Track-pool-only contributions** — a member records a contribution for a cycle; it increments the
   group `poolBalance` counter and is logged. It does **not** move wallet money (see §4.1).
3. **Manual payout lifecycle** — when a member's rotation turn matures they raise a **PayoutRequest**;
   an admin **marks it sent** (wires funds off-platform), and the recipient **confirms received**.
   Rotation only advances after confirmation (see §4.2).
4. **Slot-shift by member vote + admin approval** — a member proposes to **swap** their payout
   position with a chosen member; **all active members vote**, then an **admin approves/rejects** the
   tally; on approve the two positions swap (see §4.3).
5. **Live group chat + full activity feed** — chat streams over socket.io and persists to DB; every
   **non-chat** activity fires the notification engine (in-app + push) **and** writes an append-only
   `GroupActivityLog` row (see §5, §6).

**Conventions:**
- Base API path **`/api/v1/contribution-groups/*`**, guarded by the user **`JwtAuthGuard`**
  (`scope: "user"`). Admin actions live on the admin plane (`/api/v1/admin/…`) — see the admin PRD.
- Money is whole **NGN**. The pool is a **tracked counter** (`poolBalance`), not a wallet balance.
- All success responses use the standard envelope `{ success, message?, data }`
  (`data_structure.md` §2.3); errors use `{ success: false, error: { code, message, details? } }`.
- Timestamps are ISO-8601 UTC. All `:id` path params are validated as ObjectId.

---

## 2. Collections / Schema

Eight LIVE collections. Field types are TypeScript-style; `?` = optional. These are also catalogued
in `data_structure.md` (LIVE Adashe section). The mock `ContributionGroup` (`src/types.ts`,
`data_structure.md` §1.6) is **superseded** by `contributionGroups` + `groupMembers` below.

> ⚠️ **Field-name reconciliation with the earlier admin/data-structure draft.** The admin PRD §2 and
> `data_structure.md` §7.7.7 currently describe a `ContributionGroup` with `totalMembers`,
> `startDate`, `frequency` including `DAILY`, `walletId` (a group **wallet**), and `GroupMember` with
> an embedded `payoutReceived`. This LIVE spec **reconciles those** to: `maxSlots` (not
> `totalMembers`), no `startDate` (rotation is cycle-driven), `frequency` limited to `WEEKLY|MONTHLY`
> (no `DAILY`), a tracked **`poolBalance`** counter (not a `walletId` wallet — payouts are off-platform),
> and richer member/proposal/payout status enums. See §11 for the open items to confirm.

### 2.1 `contributionGroups` 📄

```typescript
{
  _id: ObjectId;
  name: string;                       // 3–80 chars
  description: string;                // 0–500 chars
  type: 'ADASHE' | 'ESUSU' | 'CUSTOM';
  organizerType: 'user' | 'admin';    // who created it
  organizerId: ObjectId;              // ref users (organizerType='user') or adminUsers ('admin')
  contributionAmount: number;         // NGN per member per cycle; >= 500
  frequency: 'WEEKLY' | 'MONTHLY';
  maxSlots: number;                   // 2..MAX_GROUP_SIZE (rotation length)
  currentCycle: number;               // 1-based; the cycle currently being collected
  activePosition: number;             // 1-based payoutOrder position whose turn it is
  status: 'FORMING' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED';
  payoutOrder: [{
    position: number;                 // 1..maxSlots, unique within the group
    memberId: ObjectId;               // ref groupMembers
    userId: ObjectId;                 // ref users (denormalized for fast reads)
    paid: boolean;                    // true once CONFIRMED_RECEIVED
    paidAt?: Date;
  }];
  poolBalance: number;                // NGN — TRACKED counter, not a wallet balance
  rules: {
    lateFeePercent: number;           // 0..100
    missLimit: number;                // integer >= 1
    exitPenalty: number;              // NGN >= 0 (flat) — see §11
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** `{ organizerId: 1 }`; `{ status: 1 }`; `{ 'payoutOrder.userId': 1 }`
(reverse lookup "which groups am I in / whose turn"); `{ type: 1, status: 1 }`.

### 2.2 `groupMembers` 📄

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;                  // ref contributionGroups
  userId: ObjectId;                   // ref users
  position: number;                   // payout-order slot (mirrors payoutOrder.position)
  joinedAt: Date;
  status: 'INVITED' | 'ACTIVE' | 'RECEIVED_PAYOUT' | 'EXITED' | 'REMOVED';
  contributions: [{
    cycle: number;
    amount: number;                   // NGN
    dueDate: Date;
    paidAt?: Date;
    status: 'PENDING' | 'PAID' | 'LATE' | 'MISSED';
  }];
  totalContributed: number;           // NGN, running sum of PAID/LATE contributions
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** **unique** compound `{ groupId: 1, userId: 1 }` (a user joins a group once);
`{ groupId: 1, status: 1 }`; `{ userId: 1 }`.

- `INVITED` = a `groupMembers` row is created (holding a reserved `position`) only **on invitation
  accept**; before acceptance the invite lives in `groupInvitations` (§2.3). Implementations may
  instead create the row lazily on accept — either way `position` is assigned at accept time.
- An active member counts toward `activeMemberCount` (used for expected-pool math in §4.1).

### 2.3 `groupInvitations` 📄

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;                  // ref contributionGroups
  inviterType: 'user' | 'admin';
  inviterId: ObjectId;                // ref users or adminUsers
  inviteeEmail: string;               // lowercased; must be a REGISTERED user's email
  inviteeUserId?: ObjectId;           // resolved ref users when the email matches an account
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;                   // optional TTL for PENDING (see §11)
}
```

**Indexes:** `{ inviteeUserId: 1, status: 1 }` (a user's pending invites for the dashboard/inbox);
`{ groupId: 1, status: 1 }`; partial-unique `{ groupId: 1, inviteeEmail: 1 }` on `status:'PENDING'`
(no duplicate live invites to the same email for one group).

### 2.4 `groupMessages` 📄 (chat, socket-persisted)

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;                  // ref contributionGroups
  senderType: 'user' | 'admin' | 'system';
  senderId?: ObjectId;               // ref users/adminUsers; absent for system
  senderName: string;                 // denormalized display name (avatar seed)
  message: string;                    // 1–2000 chars (system messages authored server-side)
  createdAt: Date;
}
```

**Indexes:** compound `{ groupId: 1, createdAt: 1 }` (paginated history, chronological).
Chat messages **do not** fire notifications (§5) but **do** stream over socket (§7).

### 2.5 `groupProposals` 📄 (general decisions + slot-shift)

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;                  // ref contributionGroups
  kind: 'GENERAL' | 'SLOT_SHIFT';
  title: string;                      // short label
  text: string;                       // proposal body (rationale / question)
  createdByUserId: ObjectId;          // ref users (the proposer; must be an ACTIVE member)
  slotShift?: {                       // present iff kind === 'SLOT_SHIFT'
    requesterMemberId: ObjectId;      // ref groupMembers (the proposer)
    requesterPosition: number;
    targetMemberId: ObjectId;         // ref groupMembers (the chosen swap partner)
    targetPosition: number;
  };
  status: 'ACTIVE'          // open for voting
        | 'PASSED'          // GENERAL: yes-majority reached, no admin step
        | 'REJECTED'        // GENERAL: no-majority reached
        | 'AWAITING_ADMIN'  // SLOT_SHIFT: every active member voted → queued for admin
        | 'APPROVED'        // SLOT_SHIFT: admin approved → positions swapped
        | 'DECLINED'        // SLOT_SHIFT: admin rejected
        | 'CANCELLED';      // proposer/admin cancelled before resolution
  votes: [{ userId: ObjectId; vote: 'yes' | 'no'; at: Date }];  // one entry per member (last-write per user)
  eligibleCount: number;              // active-member count snapshot when the proposal opened
  tally: { yes: number; no: number };
  adminDecision?: {                   // present once an admin resolves a SLOT_SHIFT
    adminId: ObjectId;                // ref adminUsers
    decision: 'APPROVE' | 'DECLINE';
    reason?: string;
    at: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** `{ groupId: 1, status: 1 }`; `{ groupId: 1, kind: 1, status: 1 }`;
`{ status: 1 }` (admin queue of `AWAITING_ADMIN` slot-shifts).

### 2.6 `groupAttendance` 📄

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;                  // ref contributionGroups
  sessionDate: Date;                  // the meeting/verification session date
  title: string;                      // session topic/agenda
  presentUserIds: ObjectId[];         // ref users who checked in
  createdBy?: ObjectId;               // organizer/admin who opened the session
  createdAt: Date;
}
```

**Indexes:** `{ groupId: 1, sessionDate: -1 }`.

### 2.7 `payoutRequests` 📄 (manual payout lifecycle)

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;                  // ref contributionGroups
  cycle: number;                      // the cycle this payout settles
  position: number;                   // payoutOrder position being paid
  recipientMemberId: ObjectId;        // ref groupMembers
  recipientUserId: ObjectId;          // ref users
  amount: number;                     // NGN payout snapshot (see §4.2 for the amount rule)
  status: 'REQUESTED' | 'MARKED_SENT' | 'CONFIRMED_RECEIVED' | 'DISPUTED';
  requestedAt: Date;
  markedSentBy?: ObjectId;            // ref adminUsers who wired funds off-platform
  markedSentAt?: Date;
  confirmedAt?: Date;                 // set when recipient confirms
  note?: string;                      // admin/recipient note (e.g. bank ref, dispute reason)
  idempotencyKey: string;             // "payout:{groupId}:{cycle}:{position}" — unique
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** **unique** `idempotencyKey`; `{ groupId: 1, cycle: 1 }`;
`{ status: 1 }` (admin queue of `REQUESTED`); `{ recipientUserId: 1, status: 1 }`.

> ⚠️ **Alignment with the admin `payoutRun` ledger.** The admin PRD §2.2 defines an append-only
> `payoutRun` written by the admin `process-payout` action. In this LIVE model there is **no
> pool-moving `process-payout`** — payouts are wired off-platform. `payoutRequests` is the source of
> truth for the payout lifecycle; the admin plane should either **retire `payoutRun`** or write it as
> a **derived record at `MARKED_SENT`** for reporting. Flagged for the owner (§11).

### 2.8 `groupActivityLogs` 📄 (append-only feed)

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;                  // ref contributionGroups
  actorType: 'user' | 'admin' | 'system';
  actorId?: ObjectId;                 // ref users/adminUsers; absent for system
  actorName: string;                  // denormalized display name
  action: string;                     // machine key — see §6 action catalog
  meta: Record<string, any>;          // action-specific payload (amounts, positions, ids)
  createdAt: Date;
}
```

**Indexes:** `{ groupId: 1, createdAt: -1 }` (group feed, newest first). **Append-only** — never
updated or deleted.

---

## 3. API Endpoints (user plane)

All under `/api/v1/contribution-groups`, guarded by `JwtAuthGuard` (`scope: "user"`). The caller
must be an **ACTIVE member** of the group for group-scoped reads/writes unless noted; the organizer
has the same member rights plus create/invite. Admins use the separate admin plane (admin PRD §3).

| # | Method | Path | Purpose | Membership required |
|---|--------|------|---------|---------------------|
| 1 | POST | `/` | Create a group (caller becomes organizer + position #1 member) | — |
| 2 | GET | `/my-groups` | List groups the caller organizes or is an ACTIVE member of | — |
| 3 | GET | `/:id` | Group detail (rotation, members, pool, my status) | member |
| 4 | POST | `/:id/invite` | Invite a registered user by email | organizer |
| 5 | GET | `/invitations` | The caller's own PENDING invitations | — |
| 6 | POST | `/invitations/:inviteId/accept` | Accept an invite → become a member | invitee |
| 7 | POST | `/invitations/:inviteId/decline` | Decline an invite | invitee |
| 8 | POST | `/:id/contribute` | Record a contribution for the current cycle (track-pool-only) | member |
| 9 | GET | `/:id/messages` | Chat history (paginated, chronological) | member |
| 10 | GET | `/:id/proposals` | List proposals (general + slot-shift) | member |
| 11 | POST | `/:id/proposals` | Create a GENERAL proposal | member |
| 12 | POST | `/:id/proposals/:pid/vote` | Cast/change a yes/no vote | member |
| 13 | POST | `/:id/slot-shift` | Request a slot swap with a chosen member (SLOT_SHIFT proposal) | member |
| 14 | GET | `/:id/attendance` | List attendance sessions | member |
| 15 | POST | `/:id/attendance/:sessionId/check-in` | Check in to an open session | member |
| 16 | POST | `/:id/payout/request` | Claim your matured turn → create a PayoutRequest | member (active turn) |
| 17 | POST | `/:id/payout/:reqId/confirm-received` | Confirm you received the wired payout | recipient |

> Chat **sending** is over socket (`group:message`, §7), not a REST endpoint. `GET /:id/messages` is
> the durable history for (re)load / infinite scroll.

### 3.1 Create group — `POST /`

**Request:**
```json
{
  "name": "Oyo Cocoa Harvesters Wheel",
  "description": "Monthly rotating pool for the 2026 cocoa season.",
  "type": "ADASHE",
  "contributionAmount": 20000,
  "frequency": "MONTHLY",
  "maxSlots": 10,
  "rules": { "lateFeePercent": 5, "missLimit": 3, "exitPenalty": 0 }
}
```
- Creates the group `status: "FORMING"`, `currentCycle: 1`, `activePosition: 1`, `poolBalance: 0`.
- The caller becomes a `groupMembers` row `status: "ACTIVE"`, `position: 1`, and `payoutOrder[0]`.
- Writes `groupActivityLogs` (`group.created`); no member-notification (only the creator exists).

**Response 201:** the created group detail (as §3.3).

### 3.2 My groups — `GET /my-groups`

Returns groups where the caller is organizer or an ACTIVE/INVITED member, each with a light summary
(`name`, `type`, `status`, `currentCycle/maxSlots`, `poolBalance`, `myPosition`, `myStatus`,
`isMyTurn`, `pendingActionCount`). Backs the dashboard live-Adashe widget (dashboard PRD §4).

### 3.3 Group detail — `GET /:id`

```json
{
  "success": true,
  "data": {
    "id": "cg_1", "name": "Oyo Cocoa Harvesters Wheel", "type": "ADASHE",
    "status": "ACTIVE", "frequency": "MONTHLY", "contributionAmount": 20000,
    "maxSlots": 10, "currentCycle": 4, "activePosition": 5, "poolBalance": 160000,
    "rules": { "lateFeePercent": 5, "missLimit": 3, "exitPenalty": 0 },
    "me": { "memberId": "gm_5", "position": 5, "status": "ACTIVE", "isMyTurn": true,
            "hasContributedThisCycle": true },
    "payoutOrder": [
      { "position": 1, "userId": "usr_1", "name": "Aisha B.", "paid": true, "paidAt": "2026-04-30T…" },
      { "position": 5, "userId": "usr_5", "name": "Aliyu (You)", "paid": false }
    ],
    "expectedPoolThisCycle": 200000, "collectedThisCycle": 160000, "arrears": 40000,
    "pendingProposals": 1, "pendingPayoutRequest": null
  }
}
```

### 3.4 Invite — `POST /:id/invite`

**Request:** `{ "email": "musa@example.com" }`
- Only the **organizer** may invite. Email must belong to a **registered** user
  (`ADS_009` otherwise). Rejects duplicates (`ADS_010`) and full groups (`ADS_011`).
- Creates `groupInvitations` `status: "PENDING"` (resolving `inviteeUserId`), writes
  `groupActivityLogs` (`invite.sent`), and fires `adashe.invite` to the invitee (in-app + push).

### 3.5 Invitations (mine) — `GET /invitations`, accept/decline

- `GET /invitations` → the caller's `PENDING` invitations (group name, inviter, amount, frequency).
- `POST /invitations/:inviteId/accept` → sets the invite `ACCEPTED`, creates/activates the caller's
  `groupMembers` row at the next free `position`, appends it to `payoutOrder`, flips the group to
  `ACTIVE` when `maxSlots` is reached (see §4.4). Logs `invite.accepted`; notifies organizer + all
  members (`adashe.member.joined`).
- `POST /invitations/:inviteId/decline` → sets `DECLINED`; logs `invite.declined`; notifies organizer.

### 3.6 Contribute — `POST /:id/contribute`

**Request:** `{ "cycle": 4 }` (defaults to `currentCycle` if omitted).
- **Track-pool-only:** validates the caller is ACTIVE and has not already paid this cycle
  (`ADS_014`), sets that member's `contributions[cycle]` to `PAID` (or `LATE` past `dueDate`),
  increments `contributionAmount` into `poolBalance` and the member's `totalContributed`. **No wallet
  debit occurs.**
- Writes `groupActivityLogs` (`contribution.paid`, meta `{ cycle, amount }`); fires
  `adashe.contribution.paid` to organizer + members.

**Response 200:** `{ poolBalance, collectedThisCycle, expectedPoolThisCycle, myContribution }`.

### 3.7 Messages — `GET /:id/messages`

Query: `?before=<ISO|messageId>&limit=<1..100, default 50>`. Returns messages **oldest→newest**
within the page for straightforward rendering; use `before` for older-page infinite scroll. Sending
is via socket (§7).

### 3.8 Proposals — `GET /:id/proposals`, `POST /:id/proposals`, vote

- `GET /:id/proposals` → all proposals with `kind`, `status`, `tally`, `eligibleCount`, and
  `myVote` for the caller.
- `POST /:id/proposals` (GENERAL) — body `{ "title": "...", "text": "..." }`. Opens `status: "ACTIVE"`,
  snapshots `eligibleCount` = active-member count. Logs `proposal.created`; notifies members
  (`adashe.proposal.created`).
- `POST /:id/proposals/:pid/vote` — body `{ "vote": "yes" | "no" }`. Upserts the caller's vote (a
  member may change their vote while `ACTIVE`); recomputes `tally`. Resolution rules in §4.5. Logs
  `proposal.vote`; notifies (`adashe.proposal.vote`). If the vote completes the tally, also fires the
  resolution notification (`adashe.proposal.ready_for_admin` for slot-shift, or pass/reject for
  general).

### 3.9 Slot-shift — `POST /:id/slot-shift`

**Request:** `{ "targetMemberId": "gm_8" }`
- Creates a `groupProposals` `kind: "SLOT_SHIFT"` with `slotShift` populated from the caller's and
  target's current positions. Opens `status: "ACTIVE"`, snapshots `eligibleCount`.
- The requester is auto-recorded as a `yes` vote (proposing = consenting). Logs
  `slot_shift.requested`; notifies members (`adashe.slot_shift.requested`) including the target.
- Validation: caller and target are distinct ACTIVE members whose positions are **not yet paid**
  (`ADS_017`); no other `ACTIVE` slot-shift may involve either member (`ADS_018`).

### 3.10 Attendance — `GET /:id/attendance`, check-in

- `GET /:id/attendance` → sessions with `sessionDate`, `title`, `presentCount`, and `iAmPresent`.
- `POST /:id/attendance/:sessionId/check-in` → adds the caller to `presentUserIds` (idempotent). Logs
  `attendance.check_in`; notifies organizer (`adashe.attendance.checkin`). Session creation is an
  organizer/admin action (admin plane / organizer variant — see §11).

### 3.11 Payout request — `POST /:id/payout/request`

- The caller must be the member at `activePosition` (`ADS_020` otherwise), not already paid.
- Creates a `payoutRequests` `status: "REQUESTED"` with `idempotencyKey =
  "payout:{groupId}:{cycle}:{position}"` (duplicate → `ADS_022`), `amount` per §4.2.
- Logs `payout.requested`; notifies **admins** (`adashe.payout.requested`, admin audience) so an
  admin can wire funds, and notifies group members that the turn is claimed.

**Response 201:** the created `payoutRequests` doc.

### 3.12 Confirm received — `POST /:id/payout/:reqId/confirm-received`

- Only the `recipientUserId` may confirm, and only when `status: "MARKED_SENT"` (`ADS_023`).
- Sets `status: "CONFIRMED_RECEIVED"`, `confirmedAt`; sets `payoutOrder[position].paid = true` +
  `paidAt`, member `status: "RECEIVED_PAYOUT"`, and **advances rotation** (`activePosition` →
  next unpaid ACTIVE position; `currentCycle += 1`; group → `COMPLETED` when all positions paid).
- Logs `payout.confirmed`; notifies members + admins (`adashe.payout.confirmed`).

> **Admin step (mark sent)** lives on the admin plane: `POST /api/v1/admin/…/payout/:reqId/mark-sent`
> sets `status: "MARKED_SENT"`, `markedSentBy/At`, logs `payout.marked_sent`, notifies the recipient
> (`adashe.payout.marked_sent`). See the admin PRD.

---

## 4. Business rules & state machines

### 4.1 Contributions — track-pool-only

- A contribution is a **ledger + counter** operation: it flips the member's `contributions[cycle]`
  status and increments `poolBalance` / `totalContributed`. **It never touches the wallet.** There is
  no `walletId` on the group; the pool is a pure tracked NGN counter.
- Expected pool for a cycle = `contributionAmount * activeMemberCount`. `arrears` =
  `expectedPool - collectedThisCycle`.
- A contribution is `PAID` if recorded on/before `dueDate`, else `LATE` (a late fee **may** be tracked
  per `rules.lateFeePercent` — accounting-only, since money is off-platform; see §11 for whether late
  fees add to the tracked pool). Unpaid past the grace window → `MISSED`.
- Reaching `rules.missLimit` MISSED cycles flags the member for admin review (admin plane handles
  removal; §11 for auto vs manual).

### 4.2 Payout lifecycle (manual, off-platform)

```
turn matures ──POST /payout/request──►  REQUESTED
   (member at activePosition)                │ admin wires funds off-platform
                                             ▼
                                      MARKED_SENT ──recipient confirms──► CONFIRMED_RECEIVED
                                             │                                    │
                                     (recipient disputes)                        ▼
                                             ▼                    payoutOrder[pos].paid = true,
                                          DISPUTED                 member → RECEIVED_PAYOUT,
                                     (admin resolves)              rotation advances
```

- **Log + notify at every transition** (`payout.requested` → admins; `payout.marked_sent` →
  recipient; `payout.confirmed` → members + admins; `payout.disputed` → admins).
- **Payout amount rule:** `amount` is snapshotted at request time. Baseline = the **tracked
  `poolBalance` for the cycle** (i.e. `contributionAmount * activeMemberCount`, less any policy
  deductions). Because funds are off-platform, `amount` is advisory to the wiring admin. **Confirm
  the exact amount rule with the owner (§11).**
- **Idempotency:** unique `idempotencyKey` guarantees one payout record per (group, cycle, position)
  even under retried requests (`ADS_022`).
- Rotation advances **only on `CONFIRMED_RECEIVED`** — a `REQUESTED`/`MARKED_SENT` payout does not
  move `activePosition`.

### 4.3 Slot-shift (swap by vote + admin approval)

```
POST /slot-shift ─► ACTIVE  ──every active member has voted──►  AWAITING_ADMIN
 (requester=yes)      │                                              │ admin approves / rejects
                      │                                              ▼
              (proposer/admin cancels)                        APPROVED  or  DECLINED
                      ▼                                        │
                  CANCELLED                    on APPROVE: swap the two payoutOrder positions
                                               (and the two groupMembers.position), re-sync
                                               activePosition if it pointed at either slot
```

- Voting closes when **every active member** has cast a vote (`votes.length === eligibleCount`), not
  on a simple majority — the swap needs the whole circle's input before an admin decides.
- On completion → `AWAITING_ADMIN`; fires `adashe.slot_shift.ready_for_admin` (admin audience). The
  admin **approves/rejects based on the tally** (admin plane `.../slot-shift/:pid/decide`); on
  approve the two positions swap and both members' `position` fields update; on reject → `DECLINED`.
- Log + notify **all members** on every step (requested, each vote, ready-for-admin, admin decision).
- Guard: a paid (already `RECEIVED_PAYOUT`) position cannot be swapped (`ADS_017`).

### 4.4 Group state machine

```
FORMING ──maxSlots members ACTIVE──► ACTIVE ──all payoutOrder paid──► COMPLETED
   │                                    │  ▲
 (organizer)                    suspend │  │ reinstate  (admin plane)
                                        ▼  │
                                    SUSPENDED
```

- `FORMING`: inviting/accepting members; **no contributions or payouts**. Reaching `maxSlots` ACTIVE
  members flips it to `ACTIVE` (position assignment order = join order unless a slot-shift changes it).
- `ACTIVE`: contributions recorded, proposals/votes, payout lifecycle run.
- `SUSPENDED` / ban: contributions, payout requests, and slot-shift decisions are blocked (admin
  plane, admin PRD §4.1); chat may remain readable. Reinstate returns to the prior state.
- `COMPLETED`: terminal; every `payoutOrder[].paid === true`.

### 4.5 Member state machine

```
INVITED ──accept──► ACTIVE ──receives + confirms payout──► RECEIVED_PAYOUT
   │  \               │  \
 decline           exit │   └── admin remove / miss > missLimit ──► REMOVED
   ▼                    ▼
 (invite DECLINED)    EXITED (exitPenalty)
```

- `INVITED` → `ACTIVE` on accept; `INVITED` → declined removes the invite (no member row persists, or
  the row is deleted).
- Removal/exit before payout: the position is vacated; §11 covers whether later positions re-sequence
  and how prior contributions settle (admin-owned decision, admin PRD §4.3).

### 4.6 Proposal resolution (GENERAL vs SLOT_SHIFT)

- **GENERAL:** resolves on a **majority of `eligibleCount`** — `PASSED` when
  `tally.yes > eligibleCount/2`, `REJECTED` when `tally.no >= eligibleCount/2` becomes unbeatable, or
  on full participation. No admin step; general proposals are advisory (they do not mutate rotation).
- **SLOT_SHIFT:** resolves only on **full participation** → `AWAITING_ADMIN` → admin decides
  (§4.3). The tally is informational for the admin, who makes the final call.

---

## 5. Chat vs. notifications (the rule)

| Activity | Socket | Notification (in-app + push) | `groupActivityLogs` |
|----------|:------:|:----------------------------:|:-------------------:|
| Group chat message | ✅ `group:message:new` | ❌ (no per-message notification) | ❌ (persisted in `groupMessages`) |
| invite sent | — | ✅ invitee | ✅ |
| invite accepted / declined | — | ✅ organizer + members | ✅ |
| member joined | — | ✅ members | ✅ |
| contribution paid | — | ✅ organizer + members | ✅ |
| proposal created | — | ✅ members | ✅ |
| vote cast | — | ✅ members | ✅ |
| slot-shift requested | — | ✅ members (incl. target) | ✅ |
| proposal ready-for-admin | — | ✅ admins | ✅ |
| admin decision (approve/decline) | — | ✅ members | ✅ |
| payout requested | — | ✅ admins (+ members: turn claimed) | ✅ |
| payout marked sent | — | ✅ recipient | ✅ |
| payout confirmed received | — | ✅ members + admins | ✅ |
| attendance session opened | — | ✅ members | ✅ |
| attendance check-in | — | ✅ organizer | ✅ |

**Rule of thumb:** *chat is socket-only; every other activity fires `NotificationService` AND writes
a `groupActivityLogs` row.* All notifications route through the single engine
([`notification.md`](../../notification.md)) so they land in the bell, over socket while a tab is
open, and via FCM push when it is not.

---

## 6. Activity-log action catalog (`groupActivityLogs.action`)

| `action` | Actor | `meta` keys |
|----------|-------|-------------|
| `group.created` | user/admin | `{ name, type, maxSlots, contributionAmount, frequency }` |
| `group.activated` | system | `{ maxSlots }` |
| `invite.sent` | user/admin | `{ inviteeEmail, invitationId }` |
| `invite.accepted` | user | `{ position }` |
| `invite.declined` | user | `{ inviteeEmail }` |
| `member.joined` | user | `{ userId, position }` |
| `contribution.paid` | user | `{ cycle, amount, status }` |
| `proposal.created` | user | `{ proposalId, kind, title }` |
| `proposal.vote` | user | `{ proposalId, vote, tally }` |
| `slot_shift.requested` | user | `{ proposalId, requesterPosition, targetPosition }` |
| `proposal.ready_for_admin` | system | `{ proposalId, tally }` |
| `proposal.passed` / `proposal.rejected` | system | `{ proposalId, tally }` |
| `slot_shift.approved` / `slot_shift.declined` | admin | `{ proposalId, reason?, swapped:[a,b] }` |
| `payout.requested` | user | `{ requestId, cycle, position, amount }` |
| `payout.marked_sent` | admin | `{ requestId, note? }` |
| `payout.confirmed` | user | `{ requestId, cycle, position, amount }` |
| `payout.disputed` | user | `{ requestId, reason }` |
| `attendance.session_opened` | organizer/admin | `{ sessionId, sessionDate, title }` |
| `attendance.check_in` | user | `{ sessionId }` |

`groupActivityLogs` is **append-only** — the immutable audit companion to the mutable domain
collections; the admin `adminAuditLog` (admin PRD §6) additionally records admin-initiated
mutations with `before/after`.

---

## 7. Realtime — socket group events

The Adashe module reuses the existing socket.io transport ([`socket.io.md`](../../socket.io.md));
this section adds the **group** room + events on top of the notification events already specified
there. No new namespaces — the same `/rt/user` and `/rt/admin` planes are used.

**Rooms:** `group:<groupId>` on **both** `/rt/user` and `/rt/admin`. A member's chat/activity is
broadcast to **both** namespaces so members and admins share **one** thread.

**Client → server** (on `/rt/user`; admins may also emit on `/rt/admin`):

| Event | Payload | Server behaviour |
|-------|---------|------------------|
| `group:join` | `{ groupId }` | Verify membership server-side (admins may join any group), then join `group:<groupId>`. Reject non-members (`connect`-level error). |
| `group:leave` | `{ groupId }` | Leave the room. |
| `group:message` | `{ groupId, message }` | Verify membership; persist a `groupMessages` doc (sender from `client.data.userId/adminId`, never the payload); broadcast `group:message:new` to `group:<groupId>` on **both** namespaces. **No notification.** |

**Server → client** (to `group:<groupId>` on both namespaces):

| Event | Payload | Emitted when |
|-------|---------|--------------|
| `group:message:new` | `{ groupId, message: <groupMessages doc> }` | a chat message is persisted |
| `group:activity` | `{ groupId, activity: <groupActivityLogs row> }` | any non-chat activity is logged (a live in-room mirror of §6; the durable feed is `groupActivityLogs`, and the same event **also** fires a `NotificationService` notification per §5) |

- **Membership is verified server-side before room join** — a user may only join `group:<groupId>`
  for a group they are an ACTIVE member of; **admins may join any group room**. Identity is taken from
  the handshake JWT (`client.data.userId` / `client.data.adminId`), never from the payload — matching
  the anti-spoofing rule in `socket.io.md`.
- Chat is **socket-first, DB-durable**: the socket delivers it live and `groupMessages` persists it;
  reconnecting clients re-sync via `GET /:id/messages` (nothing is replayed over the socket, per the
  `socket.io.md` reconnection model).
- `group:activity` is a **convenience mirror** for open workspaces; the authoritative feed is the
  `groupActivityLogs` collection and the authoritative alert is the bell notification.

---

## 8. Validation

- `name` 3–80; `description` ≤ 500; `contributionAmount` integer NGN `>= 500`;
  `maxSlots` `2..MAX_GROUP_SIZE`; `frequency ∈ {WEEKLY, MONTHLY}`; `type ∈ {ADASHE, ESUSU, CUSTOM}`.
- `rules.lateFeePercent` `0..100`; `rules.missLimit` integer `>= 1`; `rules.exitPenalty` NGN `>= 0`.
- `invite.email`: valid email, lowercased, must resolve to a **registered** user (`ADS_009`).
- `contribute`: caller ACTIVE, not already paid for the cycle, group `ACTIVE` (not FORMING/SUSPENDED).
- `vote`: `vote ∈ {yes, no}`; proposal `ACTIVE`; caller an ACTIVE member.
- `slot-shift`: `targetMemberId` is a distinct ACTIVE member with an **unpaid** position; no other
  live slot-shift involves either member.
- `payout/request`: caller is the member at `activePosition`, unpaid; unique idempotency key.
- `payout/confirm-received`: caller is `recipientUserId`; request is `MARKED_SENT`.
- All `:id / :pid / :reqId / :sessionId / :inviteId` validated as ObjectId; missing → `*_NOT_FOUND`.

---

## 9. Error codes

```json
{ "success": false, "error": { "code": "ADS_022", "message": "Payout already requested for this cycle/position", "details": { "cycle": 4, "position": 5 } } }
```

| Code | HTTP | Meaning |
|------|------|---------|
| `ADS_001` | 404 | Group not found |
| `ADS_002` | 404 | Member not found (or caller not a member of this group) |
| `ADS_003` | 404 | Invitation not found |
| `ADS_004` | 404 | Proposal not found |
| `ADS_005` | 404 | Payout request not found |
| `ADS_006` | 403 | Not a member / not authorized for this group action |
| `ADS_007` | 403 | Organizer-only action |
| `ADS_008` | 409 | Invalid group status for this action (FORMING/SUSPENDED/COMPLETED) |
| `ADS_009` | 422 | Invite email is not a registered user |
| `ADS_010` | 409 | A pending invite for this email already exists |
| `ADS_011` | 409 | Group is full (maxSlots reached) |
| `ADS_012` | 403 | Invitation is not addressed to the caller |
| `ADS_013` | 409 | Invitation already resolved (accepted/declined/expired) |
| `ADS_014` | 409 | Already contributed for this cycle |
| `ADS_015` | 409 | Proposal not open for voting |
| `ADS_016` | 409 | Slot-shift target invalid (self / not ACTIVE / not a member) |
| `ADS_017` | 409 | Cannot swap an already-paid position |
| `ADS_018` | 409 | Member already involved in an active slot-shift |
| `ADS_020` | 409 | Not your turn — payout can only be claimed at the active position |
| `ADS_021` | 409 | Payout already paid for this position |
| `ADS_022` | 409 | Payout already requested (idempotency conflict) |
| `ADS_023` | 409 | Payout is not in MARKED_SENT state — cannot confirm |
| `ADS_024` | 403 | Only the recipient may confirm this payout |
| `ADS_025` | 409 | Attendance session closed / already checked in (idempotent no-op may return 200) |

Admin-plane errors (`ADS_ADM_*`) are defined in the admin PRD §7 and are **not** duplicated here.

---

## 10. Frontend structure (LIVE — not single-page)

The mock single-file `src/pages/cooperative/AdasheView.tsx` (list + inline workspace + create modal +
simulated chat/votes/attendance + **Admin Sandbox Controls / Admin Force Shift Slot**) is
**replaced**. The LIVE surface is a routed, server-backed structure under
`src/pages/cooperative/adashe/`:

| File / component | Route | Purpose |
|------------------|-------|---------|
| `AdasheListPage` | `/app/adashe` | The member's circles (from `/my-groups`) + pending invitations; "Create Circle" and "Invite" entry points |
| `AdasheWorkspacePage` | `/app/adashe/:groupId` | One group; hosts the tab components below |
| `RotationsPayoutsTab` | tab | Payout order/ring, active turn, "Claim my payout" (payout request), confirm-received, contribute-this-cycle |
| `ChatTab` | tab | Live socket chat (`group:message` / `group:message:new`) + `GET /:id/messages` history |
| `ProposalsVotingTab` | tab | General proposals + slot-shift proposals; cast/change vote; admin-decision status |
| `AttendanceTab` | tab | Sessions + check-in |
| `PerformanceTab` | tab | Contribution consistency, cycles, `poolBalance`, personal ledger (from server data) |
| Modals | — | **Create Circle**, **Invite (by email)**, **Request Slot-Shift (choose member)** |

- State: a **server-backed `adasheStore`** (zustand) + **`adashe.service.ts`** (typed REST client for
  §3) + a socket client subscribing to `group:*` events for the open workspace. No `localStorage`
  seeding, no simulated bot replies, no client-side rotation math.
- **Removed for good:** the "Admin Sandbox Controls" block and the "Admin Force Shift Slot ⚡" button
  (mock-only admin actions) are **not** part of the user module — all admin actions live in the
  `/bennie` admin portal (admin PRD §8).
- `poolBalance`, rotation status, tallies, and payout state are **read from the server**; the UI
  renders them and calls the REST/socket actions — it does not compute or persist them locally.

---

## 11. Open reconciliation questions for the owner

1. **`payoutRun` vs `payoutRequests`.** The admin PRD §2.2 defines an append-only `payoutRun` written
   by a pool-**moving** `process-payout`. This LIVE model has **no on-platform fund movement** —
   payout is off-platform via the `payoutRequests` lifecycle (§2.7, §4.2). Retire `payoutRun`, or keep
   it as a derived report row written at `MARKED_SENT`?
2. **Payout RBAC wording.** Admin PRD marks `adashe-contributions:process-payout` as Super-Admin-only,
   non-delegable (it "moves pooled funds"). In this model the admin only **marks sent** (records an
   off-platform wire) and (for slot-shift) **decides** — no funds move on-platform. Confirm the
   permission that gates **mark-sent** and **slot-shift decide** (still Super-Admin-only, or a
   delegable `adashe-contributions:mark-sent` / `adashe-groups:slot-shift-decide`?).
3. **Schema drift (`totalMembers`/`startDate`/`DAILY`/`walletId`).** This PRD reconciles the earlier
   admin/data-structure draft to `maxSlots`, no `startDate`, `WEEKLY|MONTHLY` only, and a tracked
   `poolBalance` (no group wallet). Confirm so the admin PRD + `data_structure.md` §7.7.7 can be
   updated to match (or tell us to keep both).
4. **Payout amount rule.** Is the payout amount the full tracked `poolBalance` for the cycle
   (`contributionAmount * activeMemberCount`), or net of any deduction? Since money is off-platform,
   `amount` is advisory — confirm the number to display to the admin/recipient.
5. **Late fees with off-platform money.** With track-pool-only, do `LATE` contributions add a tracked
   late fee to `poolBalance` (accounting-only), or is `lateFeePercent` informational until real money
   moves? (Ties to admin PRD open Q2.)
6. **Exit/removal settlement.** When a member exits/is removed before payout, do later positions
   re-sequence (shortening the rotation) and are prior tracked contributions refunded/forfeited? This
   is an **admin-owned** decision (admin PRD §4.3, open Q3/Q4) — the user module just reflects it.
7. **Attendance session creation.** Sessions are opened by the organizer/admin. Confirm whether the
   **organizer** (user plane) may open a session, or only admins (admin plane).
8. **General-proposal effect.** GENERAL proposals are currently advisory (no rotation mutation). Should
   any general proposal type carry a binding effect, or remain discussion/consensus only?
9. **Invitation expiry.** Should `groupInvitations.expiresAt` enforce a TTL (auto-`EXPIRED`), or do
   invites remain PENDING indefinitely until accepted/declined?

---

## 12. Environment variables

```bash
CONTRIBUTION_GROUP_PREFIX=CGP     # id/display prefix for groups
MAX_GROUP_SIZE=50                 # upper bound for maxSlots
DEFAULT_LATE_FEE_PERCENT=5        # seeds rules.lateFeePercent when unset
DEFAULT_MISS_LIMIT=3              # seeds rules.missLimit when unset
```
> ⚠️ The mock/admin-draft `AUTO_DEBIT_ENABLED` is **not applicable** in the track-pool-only model
> (there is no wallet debit and no auto-collection). Drop it for the user module unless the owner
> reintroduces auto-collection (§11 Q1).

---

## 13. Relevant files

- `PRD/user_module/adashesu-contributions/adashesu-contributions.md` (this file)
- `PRD/admin_module/adas_hesu_contributions/adas_hesu_contributions.md` (admin oversight)
- `PRD/socket.io.md` · `PRD/notification.md` (realtime + notification engines)
- `PRD/data_structure.md` (LIVE Adashe collections + socket group events + notification triggers)
- `PRD/user_module/dashboard/user_dashboard.md` §4 (live Adashe + pending slot-shift widget)
- `src/pages/cooperative/AdasheView.tsx` (mock UI being replaced) · `src/types.ts` (mock
  `ContributionGroup`, superseded)
