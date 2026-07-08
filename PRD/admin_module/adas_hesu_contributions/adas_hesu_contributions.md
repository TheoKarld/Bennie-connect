# Admin PRD: Adashe / Esusu Contribution Groups Operations

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no admin contributions code exists yet)
>
> Live blueprint for `admin-dev` governing admin oversight of ROSCA-style contribution groups
> (`ContributionGroup`, `GroupMember`, plus the as-built `payoutRequests`, `GroupProposal`, and
> `groupMessages` collections), the **manual payout lifecycle**, **member-decided slot-shift
> rotation swaps**, **live group-chat oversight**, and group-rule configuration. User-side spec:
> [`PRD/user_module/adashesu-contributions/adashesu-contributions.md`](../../user_module/adashesu-contributions/adashesu-contributions.md).

> **⚠️ RECONCILED TO THE AS-BUILT MODEL (owner-confirmed).** This document has been reconciled to the
> **locked, as-built** Adashe model. Two areas changed materially from the earlier draft and are
> marked **~~SUPERSEDED~~** where they still appear for traceability:
> 1. **Money is track-pool-only + MANUAL admin payout.** There is **no** automated `process-payout`
>    that moves wallet funds. A matured turn creates a **`payoutRequest`** (`REQUESTED`) → admins are
>    notified → an admin **marks it SENT** (`MARKED_SENT`; funds wired off-platform) → the recipient
>    **confirms received** (`CONFIRMED_RECEIVED`) → the rotation advances. See [§3.3](#33-payout-requests-manual-payout-lifecycle--adashe-contributions) and [§4.5](#45-manual-payout-lifecycle-state-machine).
> 2. **Slot-shift is a member-voted, admin-decided swap.** The old "Admin Sandbox Controls" is
>    replaced by a **"Rotation & Slot-Shift Decisions"** panel: members request a swap → active members
>    vote → a fully-voted `GroupProposal(kind: SLOT_SHIFT)` reaches `AWAITING_ADMIN` → the admin
>    **approves/rejects** on the tally; approve swaps the two `payoutOrder` positions. See
>    [§3.5](#35-rotation--slot-shift-decisions-adashe-groupsconfigure) and [§4.6](#46-slot-shift-proposal-state-machine).
> Additionally: admins can **join any group's live chat** as `senderType: 'admin'` ([§3.6](#36-group-chat-oversight-adashe-groupsview--messaging)); an admin can **create a circle and invite members by email** as a non-paying overseer ([§3.7](#37-admin-created-circles--invitations-adashe-groupscreate)).

---

## 1. Overview

Adashe/Esusu are traditional rotating savings & credit associations (ROSCAs): members contribute a
fixed amount each cycle into a shared pool, and each cycle one member (in rotation order) receives
the pooled payout until every member has been paid. The admin surface lets operations staff
**govern groups** (approve/ban/suspend), **oversee members** (view/remove), **work the manual payout
queue** (`payoutRequests`: mark-sent → member confirms), **decide member-voted slot-shift swaps**
(`GroupProposal`), **oversee the live group chat** (join/read/post as admin), audit the
**contribution trail** (due/paid/late/missed + late fees), and configure **group rules**
(`lateFeePercent`, `missLimit`, `exitPenalty`).

**As-built money model (owner-confirmed).** The platform **tracks the pool** but does **not** move
member wallet funds on payout. When a member's turn matures, a `payoutRequest` is raised and admins are
notified; an admin **wires the funds off-platform** and marks the request `MARKED_SENT`; the recipient
then **confirms receipt** (`CONFIRMED_RECEIVED`), which advances the rotation. Marking-sent is the
sensitive, financial action — its permission gating is stated in [§3.3](#33-payout-requests-manual-payout-lifecycle--adashe-contributions).

**Conventions (shared — see `PRD/admin_module/README.md` for the authoritative RBAC taxonomy):**

- Backend `/api/v1/admin/*`; admin frontend `/bennie/*`.
- Admin identity = **`adminUsers`**; authz = **`adminRoles`** (`resource:action`) + per-admin
  overrides; **Super Admin = `*`**. **Every endpoint declares its required permission**, enforced by
  `PermissionsGuard`.
- **Every mutation writes an `adminAuditLog`** entry (`actor`, `action`, `target`, `before/after`,
  `timestamp`, `ip`, `userAgent`).
- Money is whole **NGN**.
- Base resource for groups is **`adashe-groups`**; contribution/payout actions use
  **`adashe-contributions`** (see [§10](#10-open-questions-for-the-owner) — confirm the split).
- Real-time chat + notifications ride the shared layer:
  [`PRD/socket.io.md`](../../socket.io.md) (admin namespace `/rt/admin`, `group:*` rooms) and
  [`PRD/notification.md`](../../notification.md) (`adashe.*` events).

---

## 2. Collections / Schema

Reads/mutates the user-side ROSCA collections (defined in the user PRD; **not redefined here**). Key
fields relied upon:

- `ContributionGroup.status`: `FORMING | ACTIVE | COMPLETED | SUSPENDED`.
- `ContributionGroup.organizerId` and **`organizerType`**: `'member' | 'admin'` (as-built; an
  admin-created circle has `organizerType: 'admin'` and the organizer is a **non-paying overseer** —
  see [§3.7](#37-admin-created-circles--invitations-adashe-groupscreate)).
- `ContributionGroup.payoutOrder[]`: `{ memberId, position, paid, paidAt? }` — the rotation array a
  slot-shift approval swaps.
- `ContributionGroup.rules`: `{ lateFeePercent, missLimit, exitPenalty }`.
- `ContributionGroup.walletId`: the **group tracking wallet** the pool accrues into (tracked, not the
  disbursement rail — see the money model above).
- `GroupMember.status`: `ACTIVE | RECEIVED_PAYOUT | EXITED | REMOVED`.
- `GroupMember.contributions[]`: `{ cycle, amount, dueDate, paidAt?, status: PENDING|PAID|LATE|MISSED, lateFee? }`.
- `GroupMember.payoutReceived?`: `{ cycle, amount, confirmedAt, payoutRequestId }`.

> **📄 As-built collections referenced but owned by the user module.** The manual-payout,
> slot-shift-vote, and chat features rely on three collections that are **as-built** in the user
> module but **not yet defined** in the user PRD / `data_structure.md`: **`payoutRequests`**,
> **`GroupProposal`**, and **`groupMessages`**. This admin PRD **references** them (shape sketched
> below for the fields the admin surface reads/writes) and does **not** redefine them.
> **Drift flag → user-prd-enricher / owner:** these three collections must be added to the user
> Adashe PRD and `data_structure.md` as the canonical definitions. See [§10](#10-open-questions-for-the-owner).

### 2.1 `payoutRequests` 📄 (user-owned; the admin's manual-payout work queue)

Referenced fields the admin surface reads/writes:

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;            // ref ContributionGroup
  cycle: number;
  position: number;             // payoutOrder position maturing this cycle
  recipientMemberId: ObjectId;  // ref GroupMember
  recipientUserId: ObjectId;    // ref User (the person owed the pool)
  poolAmount: number;           // NGN tracked as owed for the cycle
  status: 'REQUESTED' | 'MARKED_SENT' | 'CONFIRMED_RECEIVED' | 'DISPUTED' | 'CANCELLED';
  requestedAt: Date;
  markedSentBy?: ObjectId;      // ref adminUsers (who wired + marked sent)
  markedSentAt?: Date;
  paymentReference?: string;    // admin-entered off-platform transfer ref
  confirmedAt?: Date;           // set when recipient confirms received
  cancelledBy?: ObjectId;       // ref adminUsers (if cancelled)
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 `GroupProposal` 📄 (user-owned; slot-shift votes reach the admin decision queue)

Referenced fields:

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;            // ref ContributionGroup
  kind: 'SLOT_SHIFT';           // (other kinds may exist; admin queue handles SLOT_SHIFT)
  requestedBy: ObjectId;        // ref GroupMember (initiator)
  // SLOT_SHIFT payload: swap requester's position with a chosen member's position
  targetMemberId: ObjectId;     // ref GroupMember (the member to swap with)
  fromPosition: number;
  toPosition: number;
  votes: [{ memberId: ObjectId; vote: 'FOR' | 'AGAINST'; at: Date }];
  status: 'OPEN' | 'AWAITING_ADMIN' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  // OPEN while collecting votes; AWAITING_ADMIN once every ACTIVE member has voted
  tally?: { for: number; against: number; eligible: number };
  decidedBy?: ObjectId;         // ref adminUsers (approve/reject)
  decidedAt?: Date;
  decisionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.3 `groupMessages` 📄 (user-owned; persisted chat, admin can read + post)

Referenced fields:

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;            // ref ContributionGroup
  senderType: 'member' | 'admin';   // admin oversight messages carry 'admin'
  senderId: ObjectId;           // ref GroupMember (member) OR adminUsers (admin)
  senderName: string;           // denormalized display name
  body: string;
  createdAt: Date;
}
```

### 2.4 `groupModeration` 📄 (admin-owned; append-only)

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;            // ref ContributionGroup
  decision: 'APPROVED' | 'BANNED' | 'SUSPENDED' | 'REINSTATED';
  reason?: string;              // required for BAN / SUSPEND
  reviewedBy: ObjectId;         // ref adminUsers
  reviewedAt: Date;
  createdAt: Date;
}
```

### 2.5 `contributionGroupRulesDefaults` 📄 (admin-owned; may live in global `settings`)

Platform-wide defaults applied to new groups when a rule is unset.

```typescript
{
  defaultLateFeePercent: number;  // e.g. 5
  defaultMissLimit: number;       // e.g. 3 missed cycles → auto action
  defaultExitPenalty: number;     // NGN or % — see validation
  maxGroupSize: number;           // mirrors MAX_GROUP_SIZE
  requireGroupApproval: boolean;  // if true, new groups start FORMING and need admin approve
}
```

> **~~SUPERSEDED~~ `payoutRun` ledger (was §2.2 in the earlier draft).** The earlier draft defined an
> admin-owned `payoutRun` append-only ledger written by an automated `process-payout` that disbursed
> funds to the recipient's wallet. **The as-built model has no fund-moving payout**, so `payoutRun` is
> **retired** in favour of the user-owned **`payoutRequests`** queue ([§2.1](#21-payoutrequests--user-owned-the-admins-manual-payout-work-queue)),
> whose documents ARE the durable payout history (each carries `markedSentBy`, `paymentReference`,
> `confirmedAt`). Historical note only — do not implement `payoutRun`.

---

## 3. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission.

### 3.1 Group management (`adashe-groups:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/contribution-groups` | `adashe-groups:view` | List/search all groups (filters below) |
| GET | `/contribution-groups/:id` | `adashe-groups:view` | Group detail (members, rotation, pool, payout requests, proposals, audit) |
| POST | `/contribution-groups` | `adashe-groups:create` | Admin-create a circle as **overseer** (`organizerType: 'admin'`) — see [§3.7](#37-admin-created-circles--invitations-adashe-groupscreate) |
| PATCH | `/contribution-groups/:id` | `adashe-groups:update` | Edit group metadata (name, description, frequency) |
| DELETE | `/contribution-groups/:id` | `adashe-groups:delete` | Delete a `FORMING` group (blocked once ACTIVE; `*:delete` is **Super-Admin-only**) |
| POST | `/contribution-groups/:id/approve` | `adashe-groups:approve` | Approve a FORMING group → activation eligible |
| POST | `/contribution-groups/:id/ban` | `adashe-groups:ban` | Ban a group (**Super-Admin-only, non-delegable**; reason required; halts contributions/payout requests) |
| POST | `/contribution-groups/:id/suspend` | `adashe-groups:suspend` | Temporarily suspend a group (reversible; delegable) |
| POST | `/contribution-groups/:id/reinstate` | `adashe-groups:suspend` | Lift suspension (delegable); lifting a **ban** requires `adashe-groups:ban` (Super Admin) |

**GET `/contribution-groups` query params:** `page`, `limit`, `q`, `status`, `type`
(`ADASHE|ESUSU|CUSTOM`), `frequency`, `organizerType` (`member|admin`), `organizerId`, `minMembers`,
`hasArrears` (bool), `hasPendingPayout` (bool — has a `REQUESTED` `payoutRequest`),
`hasPendingSlotShift` (bool — has an `AWAITING_ADMIN` proposal), `sortBy`
(`createdAt|currentCycle|totalMembers`), `order`.

**POST `/contribution-groups/:id/ban` — request:**
```json
{ "reason": "Organizer flagged for fraudulent rotation manipulation", "freezePool": true }
```
`freezePool: true` locks the group so no further contributions or payout requests can advance pending review.

### 3.2 Member oversight (`adashe-groups:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/contribution-groups/:id/members` | `adashe-groups:view` | List members + per-member contribution status |
| GET | `/contribution-groups/:id/members/:memberId` | `adashe-groups:view` | Member detail (full contribution trail, payout history) |
| POST | `/contribution-groups/:id/members/:memberId/remove` | `adashe-groups:update` | Remove a member (reason + penalty handling) |

**POST `.../members/:memberId/remove` — request:**
```json
{ "reason": "Persistent default beyond missLimit", "applyExitPenalty": true, "settlePayoutOrder": true }
```
`settlePayoutOrder: true` re-sequences remaining `payoutOrder` positions to close the gap
([§4.3](#43-payout-rotation-logic)). Removing a member who has **not yet** received a payout differs
from one who has — see rotation rules.

### 3.3 Payout requests (manual-payout lifecycle) (`adashe-contributions:*`)

The admin's core financial work queue. **No endpoint here moves wallet funds** — the admin wires the
pool to the recipient **off-platform** and records the transfer; the recipient confirms receipt
in the user app.

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/contribution-groups/:id/payout-requests` | `adashe-contributions:view` | List a group's payout requests (all statuses) |
| GET | `/payout-requests` | `adashe-contributions:view` | **Cross-group queue** of `REQUESTED` items awaiting admin action (dashboard-linked) |
| GET | `/contribution-groups/:id/payout-requests/:reqId` | `adashe-contributions:view` | Payout-request detail |
| POST | `/contribution-groups/:id/payout-requests/:reqId/mark-sent` | `adashe-contributions:mark-sent` | **Mark funds wired** (`REQUESTED → MARKED_SENT`); records `paymentReference` (sensitive — gating below) |
| POST | `/contribution-groups/:id/payout-requests/:reqId/cancel` | `adashe-contributions:mark-sent` | Cancel/void a request (e.g. duplicate, dispute) — reason required, audited |

> **RBAC for mark-sent (owner-confirmed).** Marking a payout request **SENT** is the **sensitive,
> financially-consequential** admin action (it asserts real money left the cooperative's account and
> unblocks rotation advance). It is gated by **`adashe-contributions:mark-sent`**, which — like the
> other pooled-fund permission (`adashe-contributions:process-payout`, now retired) — is treated as
> part of the **Super-Admin-only, non-delegable** financial set per the
> [README Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable).
> Delegated finance sub-admins may **view** and **cancel-with-reason** the queue but **may not
> mark-sent** unless the owner explicitly downgrades this to a delegable finance permission
> (flagged — [§10](#10-open-questions-for-the-owner)). The `PermissionsGuard` MUST satisfy
> `adashe-contributions:mark-sent` only for an effective set containing `*` until that decision is made.

**Lifecycle transitions the admin participates in:**
- `REQUESTED → MARKED_SENT` — **admin** (`mark-sent`); recipient is notified to confirm.
- `MARKED_SENT → CONFIRMED_RECEIVED` — the **recipient** confirms in the user app (user-plane
  endpoint; not an admin action). On confirm the system sets `GroupMember.status = RECEIVED_PAYOUT`,
  marks `payoutOrder[position].paid = true`, and **advances `currentCycle`**.
- `REQUESTED|MARKED_SENT → CANCELLED` — **admin** (`cancel`), reason required.
- `DISPUTED` — recipient contests a `MARKED_SENT` (they never received the funds); surfaces to the
  admin as a high-priority queue item to re-mark or cancel.

**POST `.../payout-requests/:reqId/mark-sent` — request:**
```json
{ "paymentReference": "GTB-TRF-88231190", "note": "Bank transfer to recipient, 2026-07-02" }
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "payoutRequestId": "pr_1024",
    "status": "MARKED_SENT",
    "cycle": 4,
    "recipientUserId": "usr_2",
    "poolAmount": 15000,
    "paymentReference": "GTB-TRF-88231190",
    "markedSentAt": "2026-07-02T10:20:00Z",
    "awaitingRecipientConfirmation": true
  }
}
```
- Validates the request is `REQUESTED` (else `ADS_ADM_013`), the group is not suspended/banned (else
  `ADS_ADM_008`), and it targets the rotation-correct recipient/position (else `ADS_ADM_005`).
- Emits **`adashe.payout.marked_sent`** notification to the recipient (in-app + push) prompting them
  to confirm; writes `adminAuditLog` `adashe.payout.mark_sent` (**high** severity).

> **~~SUPERSEDED~~ `POST /contribution-groups/:id/process-payout`.** The earlier draft exposed an
> automated `process-payout` (permission `adashe-contributions:process-payout`) that **disbursed
> `netPayout` to the recipient's wallet**, wrote a `payoutRun`, and advanced the cycle in one call.
> **This endpoint is removed.** It is replaced by the manual `REQUESTED → MARKED_SENT →
> CONFIRMED_RECEIVED` lifecycle above. The `adashe-contributions:process-payout` permission is retired
> in favour of `adashe-contributions:mark-sent`; where the README still lists `process-payout` in the
> Super-Admin-only set, treat it as an **alias** for `mark-sent` pending README update (flagged for the
> README pass — [§10](#10-open-questions-for-the-owner)).

### 3.4 Contributions audit (`adashe-contributions:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/contribution-groups/:id/contributions` | `adashe-contributions:view` | Cycle-by-cycle contribution audit trail |
| GET | `/contribution-groups/:id/ledger` | `adashe-contributions:view` | Group tracking-wallet ledger (pool in; payout-request status) |
| POST | `/contribution-groups/:id/contributions/:memberId/mark-late-fee` | `adashe-contributions:update` | Apply/waive a late fee on a contribution |

**GET `.../contributions` response (audit trail):**
```json
{
  "success": true,
  "data": {
    "cycle": 4,
    "rows": [
      { "memberId": "gm_1", "userId": "usr_1", "name": "Aisha B.", "amount": 5000,
        "dueDate": "2026-06-30", "status": "PAID", "paidAt": "2026-06-29T09:00:00Z", "lateFee": 0 },
      { "memberId": "gm_2", "userId": "usr_2", "name": "John O.", "amount": 5000,
        "dueDate": "2026-06-30", "status": "LATE", "paidAt": "2026-07-01T11:00:00Z", "lateFee": 250 },
      { "memberId": "gm_3", "userId": "usr_3", "name": "Musa I.", "amount": 5000,
        "dueDate": "2026-06-30", "status": "MISSED", "lateFee": 250 }
    ],
    "poolCollected": 10250, "expectedPool": 15000, "arrears": 5000
  }
}
```

### 3.5 Rotation & Slot-Shift Decisions (`adashe-groups:configure`)

> **Renamed from the user module's "Admin Sandbox Controls".** In the as-built model the admin does
> **not** drag rotation slots ad hoc. Members request a swap → active members vote → a fully-voted
> `GroupProposal(kind: SLOT_SHIFT)` becomes `AWAITING_ADMIN` → the admin **approves or rejects** on the
> vote tally. Approve **swaps the two `payoutOrder` positions** (`fromPosition ↔ toPosition`).

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/contribution-groups/:id/proposals` | `adashe-groups:view` | List a group's proposals (filter `status`, `kind`) |
| GET | `/proposals` | `adashe-groups:view` | **Cross-group queue** of `AWAITING_ADMIN` slot-shift proposals (dashboard-linked) |
| GET | `/contribution-groups/:id/proposals/:pid` | `adashe-groups:view` | Proposal detail (vote tally, both members, positions) |
| POST | `/contribution-groups/:id/proposals/:pid/approve` | `adashe-groups:configure` | Approve an `AWAITING_ADMIN` slot-shift → swap `payoutOrder` positions |
| POST | `/contribution-groups/:id/proposals/:pid/reject` | `adashe-groups:configure` | Reject an `AWAITING_ADMIN` slot-shift → no rotation change |

> **RBAC for slot-shift decisions.** Approve/reject use **`adashe-groups:configure`** (a rotation-
> configuration permission), consistent with per-group rule configuration in [§3.8](#38-group-rule-configuration-adashe-groupsconfigure).
> This is **delegable** to a rotation/operations sub-admin — it changes payout *order* but, unlike
> mark-sent, **does not assert money movement**. (If the owner prefers a dedicated
> `adashe-groups:rotation` permission, that is the alternative — flagged, [§10](#10-open-questions-for-the-owner).)

**Preconditions for approve/reject:**
- Proposal must be `AWAITING_ADMIN` (every `ACTIVE` member has voted) — else `ADS_ADM_014`.
- Neither swap participant may have already received their payout (`RECEIVED_PAYOUT`) — else
  `ADS_ADM_015` (their slot is spent).
- The group must be `ACTIVE` and not banned/suspended — else `ADS_ADM_008`.

**POST `.../proposals/:pid/approve` — request:**
```json
{ "note": "Approved — 6 FOR / 1 AGAINST; requester has a medical need this cycle" }
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "proposalId": "gp_77",
    "status": "APPROVED",
    "swap": { "fromMemberId": "gm_5", "toMemberId": "gm_2", "fromPosition": 5, "toPosition": 2 },
    "tally": { "for": 6, "against": 1, "eligible": 7 }
  }
}
```
- Approve atomically swaps the two `payoutOrder[].position` values, sets proposal `APPROVED`, notifies
  both members + the group (`adashe.slot_shift.approved`), writes `adminAuditLog`
  `adashe.slot_shift.approve` (**high** — changes who gets paid when).
- Reject sets proposal `REJECTED` with `decisionReason`, notifies the group
  (`adashe.slot_shift.rejected`), writes `adashe.slot_shift.reject` (normal).

**POST `.../proposals/:pid/reject` — request:**
```json
{ "reason": "Vote too close and creates back-to-back payouts for one household" }
```

### 3.6 Group chat oversight (`adashe-groups:view` + messaging)

Admins can **join any group's live chat**, read the **full** persisted thread, and **post** as
`senderType: 'admin'`. Real-time transport is the admin socket namespace `/rt/admin` with `group:*`
rooms (see [`PRD/socket.io.md`](../../socket.io.md)); all messages persist to `groupMessages` so
neither members nor admins lose history.

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/contribution-groups/:id/messages` | `adashe-groups:view` | Paginated chat history (newest-first; full read access) |
| POST | `/contribution-groups/:id/messages` | `adashe-groups:message` | Post an admin oversight message (persisted `senderType: 'admin'`) |

**Socket (admin plane, `/rt/admin`):**

| Event | Direction | Room | Payload |
|-------|-----------|------|---------|
| `group:join` | admin → server | joins `group:<groupId>` | `{ groupId }` (server verifies the admin holds `adashe-groups:view`) |
| `group:message` | server → clients | `group:<groupId>` | the persisted `groupMessages` doc (with `senderType`, `senderName`) |
| `group:leave` | admin → server | leaves `group:<groupId>` | `{ groupId }` |

- An admin joining a group chat is itself an oversight event: a low-noise **`adashe.chat.join`**
  audit entry is written (actor, groupId, ip) so member privacy is accountable. Every admin **post**
  writes **`adashe.chat.message`** (normal severity) in addition to the `groupMessages` row.
- Admin messages are visible to all group members (they are not covert) and are clearly badged as
  admin/staff in both the admin console and the user circle workspace.
- Identity is server-derived (`client.data.adminId`), never trusted from payload — matching the
  socket.io security model.

> **Drift note (frontend, user side).** The user Adashe circle workspace must render admin messages
> distinctly (staff badge) and must **not** expose admin-only controls to members. Flagged for
> `user-dev` via the user PRD — this admin PRD only governs the admin surface.

### 3.7 Admin-created circles & invitations (`adashe-groups:create`)

An admin may **create a circle** and **invite members by email**; the invitee accepts to join. An
admin-created circle sets **`organizerType: 'admin'`** — the admin is the **overseer/creator, not a
paying rotation member** (they hold no `payoutOrder` position and make no contributions).

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/contribution-groups` | `adashe-groups:create` | Create a circle as overseer (`organizerType: 'admin'`, `organizerId = adminId`) |
| POST | `/contribution-groups/:id/invitations` | `adashe-groups:invite` | Invite one/many members by email (invitee accepts to join) |
| GET | `/contribution-groups/:id/invitations` | `adashe-groups:view` | List invitations + status (`PENDING|ACCEPTED|DECLINED|EXPIRED`) |
| POST | `/contribution-groups/:id/invitations/:invId/revoke` | `adashe-groups:invite` | Revoke a pending invitation |

**POST `.../invitations` — request:**
```json
{ "emails": ["aisha@example.com", "musa@example.com"], "message": "Join our monthly Adashe circle" }
```
- Each invite creates a pending invitation and sends an email + (if the invitee is an existing user)
  an in-app **`adashe.invite`** notification with an accept link. Acceptance is a **user-plane** action
  that creates the `GroupMember` and assigns the next `payoutOrder` position.
- Because the admin overseer does not contribute, `expectedPool = contributionAmount * activeMemberCount`
  counts **only paying members** (the overseer is excluded from the pool math).
- Audit: `adashe.group.create` (with `organizerType: 'admin'`), `adashe.invite.send`,
  `adashe.invite.revoke` (all normal severity).

> **Drift flag.** `ContributionGroup.organizerType` and the `invitations` sub-collection/array are
> **as-built** but not yet in the user PRD / `data_structure.md`. Flagged for user-prd-enricher.

### 3.8 Group-rule configuration (`adashe-groups:configure`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/contribution-groups/:id/rules` | `adashe-groups:view` | Read a group's rules |
| PATCH | `/contribution-groups/:id/rules` | `adashe-groups:configure` | Set `lateFeePercent`, `missLimit`, `exitPenalty` |
| GET | `/contribution-groups/rules/defaults` | `adashe-groups:view` | Read platform rule defaults |
| PATCH | `/contribution-groups/rules/defaults` | `adashe-groups:configure` | Update platform rule defaults |

Per-group rule changes apply to **future** cycles; already-accrued late fees are not recomputed.

---

## 4. Business rules & state machines

### 4.1 Group state machine

```
FORMING ──approve + full membership──► ACTIVE ──(all members paid out)──► COMPLETED
   │                                     │  ▲
 delete                          suspend │  │ reinstate
   │                                     ▼  │
 (removed)                          SUSPENDED
                                         │
                                    ban  │  (banned groups are SUSPENDED with a ban flag / reason)
                                         ▼
                                     SUSPENDED (banned)
```

- `FORMING`: accepting members; no contributions collected. Deletable.
- `ACTIVE`: rotation runs; contributions collected each cycle; matured turns raise `payoutRequests`.
- `SUSPENDED`: contributions and payout-request advancement halted; a ban is a suspension with a ban
  flag + reason recorded in `groupModeration`. Reinstating returns to the prior operational state.
- `COMPLETED`: terminal; every `payoutOrder` position `paid = true` (i.e. every payout request
  reached `CONFIRMED_RECEIVED`).

### 4.2 Member state machine

```
ACTIVE ──payout CONFIRMED_RECEIVED──► RECEIVED_PAYOUT ──(group completes)──► (terminal within group)
   │  \
   │   └──voluntary exit (exitPenalty)──► EXITED
   └──admin remove / miss > missLimit──► REMOVED
```

- A member is `ACTIVE` until their payout request is **confirmed received** (`RECEIVED_PAYOUT`), they
  exit (`EXITED`, charged `exitPenalty`), or are removed (`REMOVED`).
- Auto-escalation: when a member's `MISSED` count reaches `rules.missLimit`, the system flags them for
  removal (queued for admin action). Recorded in the audit trail.

### 4.3 Payout rotation logic

- Payout order is `ContributionGroup.payoutOrder[]` sorted by `position`. The **next recipient** is
  the lowest `position` with `paid = false` whose member is still `ACTIVE`.
- Each cycle: expected pool = `contributionAmount * activePayingMemberCount` (an admin overseer is
  excluded). Late fees are **added to the pool** (or to platform revenue — **flagged**, [§10](#10-open-questions-for-the-owner)).
- The rotation only advances when the current cycle's `payoutRequest` reaches `CONFIRMED_RECEIVED`
  (see [§4.5](#45-manual-payout-lifecycle-state-machine)) — a `MARKED_SENT`-but-unconfirmed request
  does **not** advance the cycle.
- **Slot-shift** ([§4.6](#46-slot-shift-proposal-state-machine)) is the only sanctioned way to reorder
  `payoutOrder`, and only via an approved member vote.
- **Member removed before their payout:** their `position` is removed and later positions shift up by
  one; the group's total cycle count decreases by one. Their contributions to date are handled per
  `exitPenalty` policy (refund minus penalty, or forfeit — **flagged**).
- **Member removed after their payout:** rotation length is unchanged; the member simply stops
  contributing (this creates a shortfall risk that the audit trail surfaces as `arrears`).

### 4.4 Late-fee & miss rules

- A contribution unpaid at `dueDate` becomes `LATE` (with `lateFee = amount * lateFeePercent/100`) if
  paid within the grace window, else `MISSED`.
- Admin `mark-late-fee` can **apply** or **waive** a late fee (waive = set `lateFee = 0`, reason
  required, audited).

### 4.5 Manual payout lifecycle state machine

```
                    (member's turn matures — system raises request)
                                     │
                                     ▼
                              REQUESTED  ──admin cancel (reason)──► CANCELLED
                                     │
                        admin mark-sent (adashe-contributions:mark-sent)
                        + paymentReference; funds wired off-platform
                                     ▼
                             MARKED_SENT ──admin cancel (reason)──► CANCELLED
                                 │      \
              recipient confirms │       └──recipient disputes──► DISPUTED ──► (re-mark or cancel)
              received (user app)│
                                 ▼
                        CONFIRMED_RECEIVED
                                 │
                                 ▼
       set GroupMember RECEIVED_PAYOUT · payoutOrder[pos].paid=true · advance currentCycle
```

- **`REQUESTED`** is created by the system (not the admin) when the next-in-rotation member's turn
  matures; **all admins are notified** (`adashe.payout.requested`) and it appears in the cross-group
  queue `GET /admin/payout-requests`.
- **`MARKED_SENT`** is the **admin's** action: they wire the tracked pool to the recipient
  **off-platform**, then record `paymentReference` via `mark-sent`. The recipient is prompted to
  confirm.
- **`CONFIRMED_RECEIVED`** is the **recipient's** action in the user app; only then does rotation
  advance. The admin does not confirm on the recipient's behalf (a `DISPUTED` path handles
  non-receipt).
- **Idempotency:** one active (`REQUESTED`/`MARKED_SENT`) request per `{groupId, cycle}`; a duplicate
  mark-sent is rejected (`ADS_ADM_009`).

### 4.6 Slot-shift proposal state machine

```
member requests swap-with-chosen-member
        │
        ▼
     OPEN  ──(all ACTIVE members have voted)──► AWAITING_ADMIN
        │                                            │
     EXPIRED (voting window lapses)     admin approve │ reject
                                                      ▼
                                         APPROVED  /  REJECTED
                                            │
                             swap payoutOrder[from].position ↔ [to].position
```

- `OPEN → AWAITING_ADMIN` is driven by the **vote count reaching every ACTIVE member** (user-plane);
  the admin only acts once `AWAITING_ADMIN`.
- The admin decision is **advisory-guided by the tally** but discretionary — the admin may **reject a
  passing vote** (with reason) if it harms group integrity (e.g. back-to-back payouts, collusion).
- **Approve** performs an atomic two-position swap on `payoutOrder`; neither participant may already
  be `RECEIVED_PAYOUT` (`ADS_ADM_015`).

---

## 5. Validation

- `lateFeePercent`: number `0–100`. `missLimit`: integer `>= 1`. `exitPenalty`: integer NGN `>= 0`
  (confirm whether percent or flat NGN — [§10](#10-open-questions-for-the-owner)).
- `maxGroupSize`: `2–MAX_GROUP_SIZE`.
- `ban`/`suspend`/`remove`/`waive`/`payout-request cancel`/`slot-shift reject` **require** a non-empty
  `reason` (`>= 5`).
- `mark-sent`: request must be `REQUESTED`; `paymentReference` required (non-empty string); recipient
  must be the rotation-correct member; group not suspended/banned.
- `proposal approve/reject`: proposal must be `AWAITING_ADMIN`; neither swap participant already
  `RECEIVED_PAYOUT`; group `ACTIVE`.
- `invitations`: each `email` valid; cannot invite a user already an `ACTIVE` member; group not
  `COMPLETED`/banned.
- Cannot `delete` a group once `ACTIVE` (`ADS_ADM_007`); cannot mark-sent / advance rotation on a
  `SUSPENDED`/banned group (`ADS_ADM_008`).
- All `:id`/`:memberId`/`:reqId`/`:pid`/`:invId` params validated as ObjectId; missing target →
  relevant `*_NOT_FOUND`.

---

## 6. Audit events

| Action | Trigger | Severity |
|--------|---------|----------|
| `adashe.group.create` / `.update` / `.delete` | group CRUD (`.create` records `organizerType`) | normal |
| `adashe.group.approve` | approve | normal |
| `adashe.group.ban` / `.suspend` / `.reinstate` | moderation | **high** |
| `adashe.member.remove` | member removal | **high** |
| `adashe.contribution.late_fee_apply` / `.late_fee_waive` | late-fee action | normal |
| `adashe.payout.mark_sent` | admin marks a payout request SENT (asserts funds wired) | **high** |
| `adashe.payout.cancel` | admin cancels/voids a payout request | **high** |
| `adashe.slot_shift.approve` | approve slot-shift proposal (changes payout order) | **high** |
| `adashe.slot_shift.reject` | reject slot-shift proposal | normal |
| `adashe.invite.send` / `.invite.revoke` | admin invites/revokes member | normal |
| `adashe.chat.join` | admin joins a group chat (oversight/privacy accountability) | normal |
| `adashe.chat.message` | admin posts a message in a group chat | normal |
| `adashe.rules.update` / `.defaults.update` | rule config | normal |

Each entry records `actor`, `targetType`, `targetId` (group/member/payoutRequest/proposal), `before`,
`after`, `reason?`, `timestamp`, `ip`, `userAgent`.

> **~~SUPERSEDED~~** the earlier `adashe.payout.process` audit event (automated disbursement) is
> replaced by `adashe.payout.mark_sent` above.

---

## 7. Error codes

```json
{ "success": false, "error": { "code": "ADS_ADM_013", "message": "Payout request is not in REQUESTED state", "details": { "current": "MARKED_SENT" } } }
```

| Code | Meaning |
|------|---------|
| `ADS_ADM_001` | Group not found |
| `ADS_ADM_002` | Member not found |
| `ADS_ADM_003` | Invalid group status transition |
| `ADS_ADM_004` | Invalid member status transition |
| `ADS_ADM_005` | Wrong payout recipient for rotation order |
| `ADS_ADM_006` | ~~Pool incomplete — payout blocked~~ *(retired: no automated disbursement; pool state is informational on the payout request)* |
| `ADS_ADM_007` | Cannot delete — group is ACTIVE |
| `ADS_ADM_008` | Group suspended/banned — action blocked |
| `ADS_ADM_009` | Duplicate/conflicting payout request for this cycle (idempotency) |
| `ADS_ADM_010` | Invalid rule value |
| `ADS_ADM_011` | Reason required for this action |
| `ADS_ADM_012` | Insufficient permission for action |
| `ADS_ADM_013` | Payout request not in the required state (e.g. mark-sent requires REQUESTED) |
| `ADS_ADM_014` | Proposal not AWAITING_ADMIN (voting incomplete) — cannot approve/reject |
| `ADS_ADM_015` | Slot-shift participant already received payout — cannot swap |
| `ADS_ADM_016` | Payout request not found |
| `ADS_ADM_017` | Proposal not found |
| `ADS_ADM_018` | Invitation invalid (bad email / already a member / group not joinable) |
| `ADS_ADM_019` | `paymentReference` required to mark a payout request SENT |

---

## 8. Admin UI / Section (premium UX)

> **Proper multi-page structure (owner-confirmed) — NOT the `sections.tsx` placeholder.** The admin
> Adashe surface is a real multi-page area, not a stub. `admin-dev` builds dedicated route components.

**Routes:**
- `/bennie/adashesu-contributions` — **groups list** (table + filters).
- `/bennie/adashesu-contributions/:groupId` — **group detail** with tabs:
  **Members · Rotation · Contributions · Payout Requests · Chat · Slot-Shift Decisions · Rules**.

**Groups list** — pagination, search, filters (status, type, frequency, organizerType, has-arrears,
**has-pending-payout**, **has-pending-slot-shift**, organizer). Status chips; progress indicator
(cycle X of N; % paid out); badges for pending payout requests and pending slot-shift decisions. Row
quick actions (approve / suspend / ban with confirm + reason modal). Primary **"Create circle"**
action opens the admin-overseer create + invite flow.

**Group detail tabs:**
- **Members** — table with per-member contribution health (paid/late/missed counts, arrears) and
  rotation position; remove action (confirm modal with penalty toggle); invite-more entry point.
- **Rotation** — visual **rotation timeline / ring** showing payout order, who's paid, who's next.
  **Read/oversight only** for reordering — the only way to change order is approving a slot-shift
  proposal (links to the Slot-Shift Decisions tab). No free-form admin drag.
- **Contributions** — the **audit trail** table filterable by cycle and status
  (due/paid/late/missed), late-fee apply/waive inline.
- **Payout Requests** — the **manual-payout work queue** for this group: cards/rows per request with
  status (`REQUESTED / MARKED_SENT / CONFIRMED_RECEIVED / DISPUTED / CANCELLED`), recipient, cycle,
  pool amount. **"Mark sent"** action (confirm modal capturing `paymentReference` + note; button
  hidden for admins lacking `adashe-contributions:mark-sent` — Super Admin only). Shows
  awaiting-recipient-confirmation state and a **cancel** action with reason.
- **Chat** — **live group chat** (admin `/rt/admin` `group:*` socket) with **full read history** from
  `groupMessages` and admin **send** (posts as `senderType: 'admin'`, staff-badged). Join is
  audit-logged. Message composer hidden for admins lacking `adashe-groups:message`.
- **Slot-Shift Decisions** — the renamed **"Rotation & Slot-Shift Decisions"** panel: queue of
  proposals with vote tally (FOR/AGAINST/eligible), both swap participants and their positions, and
  **Approve / Reject** actions (reason on reject; both audited). `AWAITING_ADMIN` items are highlighted;
  `OPEN` items are shown read-only (voting still in progress).
- **Rules** — form for `lateFeePercent` / `missLimit` / `exitPenalty` with "future cycles only" note.

**Cross-group queues (dashboard-linked):** the **Payout Requests** (`REQUESTED`) and **Slot-Shift
Decisions** (`AWAITING_ADMIN`) queues also surface as approval queues on the admin dashboard
([admin_dashboard.md](../admin_dashboard/admin_dashboard.md)) and deep-link into the relevant group
tab.

**Rule defaults** — platform-wide defaults form + charts (payout confirmation rate, default/arrears
rate, group completion funnel).

**Alerts** — groups with arrears / members over `missLimit` / **stale `MARKED_SENT` awaiting
confirmation** / **disputed payouts** surface in the dashboard alert center.

> **~~SUPERSEDED~~** the earlier "Payouts" tab with a fund-moving **Process payout** button, and the
> free-form rotation **drag-reorder**, are replaced by the **Payout Requests** and **Slot-Shift
> Decisions** tabs above.

---

## 9. Environment variables

DB-driven via `contributionGroupRulesDefaults` / global `settings`; env vars are bootstrap defaults:

```bash
CONTRIBUTION_GROUP_PREFIX=CGP
MAX_GROUP_SIZE=50               # seeds maxGroupSize
DEFAULT_LATE_FEE_PERCENT=5      # seeds defaultLateFeePercent
DEFAULT_MISS_LIMIT=3            # seeds defaultMissLimit
REQUIRE_GROUP_APPROVAL=true     # seeds requireGroupApproval
```

> **~~SUPERSEDED~~** `AUTO_DEBIT_ENABLED` is removed from this admin spec — the as-built model has no
> automated debit/disbursement pipeline; contributions and payouts are tracked, and payout is manual.
> (Retained in the user PRD env list only if the user side still models auto-collection — flagged.)

---

## 10. Open questions for the owner

1. **Permission resource split.** This doc uses `adashe-groups:*` for group/member/chat/rotation
   actions and `adashe-contributions:*` for contribution/payout actions. Confirm the README taxonomy
   matches, or collapse to a single resource. In particular, register the **new** actions
   `adashe-contributions:mark-sent`, `adashe-groups:message`, and `adashe-groups:invite` in the README
   permission catalog.
2. **`mark-sent` delegability — CONFIRM.** This doc treats `adashe-contributions:mark-sent` as
   **Super-Admin-only, non-delegable** (it asserts real money left the cooperative and unblocks
   rotation). Confirm, or authorize a delegable **Finance** permission for it (finance officers wire
   many payouts). Whichever is chosen must be reflected in the README Super-Admin-only set.
3. **Slot-shift decision permission.** This doc uses `adashe-groups:configure` (delegable). Confirm,
   or introduce a dedicated `adashe-groups:rotation` permission.
4. **Late-fee destination.** Do accrued late fees go into the group **pool** (benefiting the next
   recipient) or to **platform revenue**? Affects `expectedPool` math.
5. **`exitPenalty` unit.** Flat NGN or a percentage of contributions to date? The user PRD types it as
   `number` without a unit.
6. **Exit/removal settlement.** When a member exits/is removed before payout, are their prior
   contributions refunded (minus penalty) or forfeited to the pool?
7. **DISPUTED payout resolution.** What are the sanctioned admin actions on a `DISPUTED` request
   (re-mark with a new reference vs. cancel-and-re-request)? Define the runbook.
8. **User-PRD / `data_structure.md` drift (for user-prd-enricher).** The as-built collections
   **`payoutRequests`**, **`GroupProposal`**, **`groupMessages`**, and the `ContributionGroup`
   fields **`organizerType`** + invitations are **not yet** in the user Adashe PRD or
   `data_structure.md`. They must be added there as canonical; this admin PRD only references them.
9. **README alias cleanup.** The README Super-Admin-only set still lists
   `adashe-contributions:process-payout`; this doc retires it in favour of `adashe-contributions:mark-sent`.
   Update the README on the next admin pass.
</content>
</invoke>
