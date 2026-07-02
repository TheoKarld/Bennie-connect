# Admin PRD: Adashe / Esusu Contribution Groups Operations

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no admin contributions code exists yet)
>
> Live blueprint for `admin-dev` governing admin oversight of ROSCA-style contribution groups
> (`ContributionGroup`, `GroupMember`), payout rotation, contribution audit trail, and group-rule
> configuration. User-side spec:
> [`PRD/user_module/adashesu-contributions/adashesu-contributions.md`](../../user_module/adashesu-contributions/adashesu-contributions.md).

---

## 1. Overview

Adashe/Esusu are traditional rotating savings & credit associations (ROSCAs): members contribute a
fixed amount each cycle into a shared pool, and each cycle one member (in rotation order) receives
the pooled payout until every member has been paid. The admin surface lets operations staff
**govern groups** (approve/ban), **oversee members** (view/remove), **process payouts** in rotation,
audit the **contribution trail** (due/paid/late/missed + late fees), and configure **group rules**
(`lateFeePercent`, `missLimit`, `exitPenalty`).

**Conventions (shared — see `PRD/admin_module/README.md` for the authoritative RBAC taxonomy):**

- Backend `/api/v1/admin/*`; admin frontend `/bennie/*`.
- Admin identity = **`adminUsers`**; authz = **`adminRoles`** (`resource:action`) + per-admin
  overrides; **Super Admin = `*`**. **Every endpoint declares its required permission**, enforced by
  `PermissionsGuard`.
- **Every mutation writes an `adminAuditLog`** entry (`actor`, `action`, `target`, `before/after`,
  `timestamp`, `ip`, `userAgent`).
- Money is whole **NGN**. **Payout processing moves pooled funds** — `adashe-contributions:process-payout`
  is **Super-Admin-only and NOT delegable** per the
  [README Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable).
- Base resource for groups is **`adashe-groups`**; contribution/payout actions use
  **`adashe-contributions`** (see [§10](#10-open-questions-for-the-owner) — confirm the split).

---

## 2. Collections / Schema

Reads/mutates the user-side `ContributionGroup` and `GroupMember` collections (defined in the user
PRD; not redefined). Key fields relied upon:

- `ContributionGroup.status`: `FORMING | ACTIVE | COMPLETED | SUSPENDED`.
- `ContributionGroup.payoutOrder[]`: `{ memberId, position, paid, paidAt? }`.
- `ContributionGroup.rules`: `{ lateFeePercent, missLimit, exitPenalty }`.
- `ContributionGroup.walletId`: the **group wallet** the pool accrues into.
- `GroupMember.status`: `ACTIVE | RECEIVED_PAYOUT | EXITED | REMOVED`.
- `GroupMember.contributions[]`: `{ cycle, amount, dueDate, paidAt?, status: PENDING|PAID|LATE|MISSED, lateFee? }`.
- `GroupMember.payoutReceived?`: `{ cycle, amount, paidAt, transactionRef }`.

Admin-owned additions:

### 2.1 `groupModeration` 📄 (admin-owned; append-only)

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

### 2.2 `payoutRun` 📄 (admin-owned; append-only ledger of processed payouts)

```typescript
{
  _id: ObjectId;
  groupId: ObjectId;            // ref ContributionGroup
  cycle: number;
  position: number;             // payout-order position paid this run
  recipientMemberId: ObjectId;  // ref GroupMember
  recipientUserId: ObjectId;    // ref User
  grossPool: number;            // NGN collected for the cycle
  deductions: number;           // any admin/platform deduction (usually 0)
  netPayout: number;            // NGN disbursed
  transactionRef: string;       // wallet REFUND/CONTRIBUTION-payout txn ref
  processedBy: ObjectId;        // ref adminUsers (or SYSTEM for auto)
  idempotencyKey: string;       // "payout:{groupId}:{cycle}" — unique
  createdAt: Date;
}
```

### 2.3 `contributionGroupRulesDefaults` 📄 (admin-owned; may live in global `settings`)

Platform-wide defaults applied to new groups when a rule is unset.

```typescript
{
  defaultLateFeePercent: number;  // e.g. 5
  defaultMissLimit: number;       // e.g. 3 missed cycles → auto action
  defaultExitPenalty: number;     // NGN or % — see validation
  maxGroupSize: number;           // mirrors MAX_GROUP_SIZE
  autoDebitEnabled: boolean;      // mirrors AUTO_DEBIT_ENABLED
  requireGroupApproval: boolean;  // if true, new groups start FORMING and need admin approve
}
```

---

## 3. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission.

### 3.1 Group management (`adashe-groups:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/contribution-groups` | `adashe-groups:view` | List/search all groups (filters below) |
| GET | `/contribution-groups/:id` | `adashe-groups:view` | Group detail (members, rotation, pool, audit) |
| POST | `/contribution-groups` | `adashe-groups:create` | Admin-create a group |
| PATCH | `/contribution-groups/:id` | `adashe-groups:update` | Edit group metadata (name, description, frequency) |
| DELETE | `/contribution-groups/:id` | `adashe-groups:delete` | Delete a `FORMING` group (blocked once ACTIVE) |
| POST | `/contribution-groups/:id/approve` | `adashe-groups:approve` | Approve a FORMING group → activation eligible |
| POST | `/contribution-groups/:id/ban` | `adashe-groups:ban` | Ban a group (**Super-Admin-only, non-delegable**; reason required; halts contributions/payouts) |
| POST | `/contribution-groups/:id/suspend` | `adashe-groups:suspend` | Temporarily suspend a group (reversible; delegable) |
| POST | `/contribution-groups/:id/reinstate` | `adashe-groups:suspend` | Lift suspension (delegable); lifting a **ban** requires `adashe-groups:ban` (Super Admin) |

**GET `/contribution-groups` query params:** `page`, `limit`, `q`, `status`, `type`
(`ADASHE|ESUSU|CUSTOM`), `frequency`, `organizerId`, `minMembers`, `hasArrears` (bool),
`sortBy` (`createdAt|currentCycle|totalMembers`), `order`.

**POST `/contribution-groups/:id/ban` — request:**
```json
{ "reason": "Organizer flagged for fraudulent rotation manipulation", "freezePool": true }
```
`freezePool: true` locks the group wallet so no further contributions/payouts occur pending review.

### 3.2 Member oversight (`adashe-groups:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/contribution-groups/:id/members` | `adashe-groups:view` | List members + per-member contribution status |
| GET | `/contribution-groups/:id/members/:memberId` | `adashe-groups:view` | Member detail (full contribution trail, payout) |
| POST | `/contribution-groups/:id/members/:memberId/remove` | `adashe-groups:update` | Remove a member (reason + penalty handling) |

**POST `.../members/:memberId/remove` — request:**
```json
{ "reason": "Persistent default beyond missLimit", "applyExitPenalty": true, "settlePayoutOrder": true }
```
`settlePayoutOrder: true` re-sequences remaining `payoutOrder` positions to close the gap
([§4.3](#43-payout-rotation-logic)). Removing a member who has **not yet** received a payout differs
from one who has — see rotation rules.

### 3.3 Contributions & payouts (`adashe-contributions:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/contribution-groups/:id/contributions` | `adashe-contributions:view` | Cycle-by-cycle contribution audit trail |
| GET | `/contribution-groups/:id/ledger` | `adashe-contributions:view` | Group wallet ledger (pool in/out) |
| GET | `/contribution-groups/:id/payouts` | `adashe-contributions:view` | `payoutRun` history |
| POST | `/contribution-groups/:id/process-payout` | `adashe-contributions:process-payout` | Process the current-cycle rotation payout (**Super-Admin-only, non-delegable**) |
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

**POST `.../process-payout` — request:**
```json
{ "cycle": 4, "confirmIncompletePool": false }
```
- Validates it is the correct next recipient by rotation order and that the pool is complete.
- `confirmIncompletePool: true` allows paying out despite arrears (explicit override, high-severity
  audited) — otherwise blocked with `ADS_ADM_006`.
- Disburses `netPayout` to the recipient's personal wallet via the user wallet service, writes a
  `payoutRun`, sets the member `status = RECEIVED_PAYOUT`, marks `payoutOrder[position].paid = true`,
  advances `currentCycle`. **Response 200:**
```json
{ "success": true, "data": { "cycle": 4, "recipientUserId": "usr_2", "netPayout": 15000,
    "transactionRef": "CGP-PAYOUT-4", "nextCycle": 5 } }
```

### 3.4 Group-rule configuration (`adashe-groups:configure`)

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
- `ACTIVE`: rotation runs; contributions collected each cycle; payouts processed in order.
- `SUSPENDED`: contributions/auto-debit and payouts halted; a ban is a suspension with a ban flag +
  reason recorded in `groupModeration`. Reinstating returns to the prior operational state.
- `COMPLETED`: terminal; every `payoutOrder` position `paid = true`.

### 4.2 Member state machine

```
ACTIVE ──receives rotation payout──► RECEIVED_PAYOUT ──(group completes)──► (terminal within group)
   │  \
   │   └──voluntary exit (exitPenalty)──► EXITED
   └──admin remove / miss > missLimit──► REMOVED
```

- A member is `ACTIVE` until they either receive their payout (`RECEIVED_PAYOUT`), exit
  (`EXITED`, charged `exitPenalty`), or are removed (`REMOVED`).
- Auto-escalation: when a member's `MISSED` count reaches `rules.missLimit`, the system flags them
  for removal (auto-remove if enabled, else queued for admin action). Recorded in the audit trail.

### 4.3 Payout rotation logic

- Payout order is `ContributionGroup.payoutOrder[]` sorted by `position`. The **next recipient** is
  the lowest `position` with `paid = false` whose member is still `ACTIVE`.
- Each cycle: expected pool = `contributionAmount * activeMemberCount`. Late fees are **added to the
  pool** (or to platform revenue — **flagged**, [§10](#10-open-questions-for-the-owner)).
- `process-payout` may only pay the correct next recipient; skipping requires an explicit
  reorder (`settlePayoutOrder`) which is audited.
- **Member removed before their payout:** their `position` is removed and later positions shift up by
  one; the group's total cycle count decreases by one. Their contributions to date are handled per
  `exitPenalty` policy (refund minus penalty, or forfeit — **flagged**).
- **Member removed after their payout:** rotation length is unchanged; the member simply stops
  contributing (this creates a shortfall risk that the audit trail surfaces as `arrears`).
- Idempotency: `payoutRun.idempotencyKey = "payout:{groupId}:{cycle}"` guarantees a cycle is paid
  once even under retries.

### 4.4 Late-fee & miss rules

- A contribution unpaid at `dueDate` becomes `LATE` (with `lateFee = amount * lateFeePercent/100`) if
  paid within the grace window, else `MISSED`.
- Admin `mark-late-fee` can **apply** or **waive** a late fee (waive = set `lateFee = 0`, reason
  required, audited).

---

## 5. Validation

- `lateFeePercent`: number `0–100`. `missLimit`: integer `>= 1`. `exitPenalty`: integer NGN `>= 0`
  (confirm whether percent or flat NGN — [§10](#10-open-questions-for-the-owner)).
- `maxGroupSize`: `2–MAX_GROUP_SIZE`.
- `ban`/`suspend`/`remove`/`waive`/`incomplete-pool payout` **require** a non-empty `reason` (`>= 5`).
- `process-payout`: `cycle` must equal the group's current unpaid cycle; recipient must be the
  rotation-correct member; pool complete unless `confirmIncompletePool`.
- Cannot `delete` a group once `ACTIVE` (`ADS_ADM_007`); cannot process payout on a `SUSPENDED`/banned
  group (`ADS_ADM_008`).
- All `:id`/`:memberId` params validated as ObjectId; missing target → relevant `*_NOT_FOUND`.

---

## 6. Audit events

| Action | Trigger | Severity |
|--------|---------|----------|
| `adashe.group.create` / `.update` / `.delete` | group CRUD | normal |
| `adashe.group.approve` | approve | normal |
| `adashe.group.ban` / `.suspend` / `.reinstate` | moderation | **high** |
| `adashe.member.remove` | member removal | **high** |
| `adashe.contribution.late_fee_apply` / `.late_fee_waive` | late-fee action | normal |
| `adashe.payout.process` | process-payout (**moves funds**) | **high** |
| `adashe.rules.update` / `.defaults.update` | rule config | normal |

Each entry records `actor`, `targetType`, `targetId` (group/member), `before`, `after`, `reason?`,
`timestamp`, `ip`, `userAgent`.

---

## 7. Error codes

```json
{ "success": false, "error": { "code": "ADS_ADM_006", "message": "Cannot process payout — pool incomplete", "details": { "expected": 15000, "collected": 10250, "arrears": 5000 } } }
```

| Code | Meaning |
|------|---------|
| `ADS_ADM_001` | Group not found |
| `ADS_ADM_002` | Member not found |
| `ADS_ADM_003` | Invalid group status transition |
| `ADS_ADM_004` | Invalid member status transition |
| `ADS_ADM_005` | Wrong payout recipient for rotation order |
| `ADS_ADM_006` | Pool incomplete — payout blocked (override with confirmIncompletePool) |
| `ADS_ADM_007` | Cannot delete — group is ACTIVE |
| `ADS_ADM_008` | Group suspended/banned — action blocked |
| `ADS_ADM_009` | Payout already processed for this cycle (idempotency conflict) |
| `ADS_ADM_010` | Invalid rule value |
| `ADS_ADM_011` | Reason required for this action |
| `ADS_ADM_012` | Insufficient permission for action |

---

## 8. Admin UI / Section (premium UX)

Route base `/bennie/contributions`. Rich ops console — no basic UI.

- **Groups table** — pagination, search, filters (status, type, frequency, has-arrears, organizer).
  Status chips; progress indicator (cycle X of N; % paid out). Row quick actions
  (approve / suspend / ban with confirm + reason modal).
- **Group detail** — header with pool balance, cycle progress, next recipient. Tabs:
  - **Members** — table with per-member contribution health (paid/late/missed counts, arrears),
    remove action (confirm modal with penalty toggle).
  - **Rotation** — visual **rotation timeline / ring** showing payout order, who's paid, who's next;
    reorder (drag) guarded by permission.
  - **Contributions** — the **audit trail** table filterable by cycle and status
    (due/paid/late/missed), late-fee apply/waive inline.
  - **Payouts** — `payoutRun` ledger; **Process payout** button (approval-style confirm modal showing
    recipient, pool, deductions, net; incomplete-pool override requires an extra confirm; button
    hidden for admins lacking `adashe-contributions:process-payout` — Super Admin only).
  - **Ledger** — group wallet in/out with running balance.
  - **Rules** — form for `lateFeePercent` / `missLimit` / `exitPenalty` with "future cycles only" note.
- **Rule defaults** — platform-wide defaults form + charts (payout success rate, default/arrears rate,
  group completion funnel).
- **Alerts** — groups with arrears / members over `missLimit` surface in the dashboard alert center.

---

## 9. Environment variables

DB-driven via `contributionGroupRulesDefaults` / global `settings`; env vars are bootstrap defaults:

```bash
CONTRIBUTION_GROUP_PREFIX=CGP
MAX_GROUP_SIZE=50               # seeds maxGroupSize
DEFAULT_LATE_FEE_PERCENT=5      # seeds defaultLateFeePercent
AUTO_DEBIT_ENABLED=true         # seeds autoDebitEnabled
DEFAULT_MISS_LIMIT=3            # seeds defaultMissLimit
REQUIRE_GROUP_APPROVAL=true     # seeds requireGroupApproval
```

---

## 10. Open questions for the owner

1. **Permission resource split.** This doc uses `adashe-groups:*` for group/member actions and
   `adashe-contributions:*` for contribution/payout actions. Confirm the README taxonomy matches, or
   collapse to a single resource.
2. **Late-fee destination.** Do accrued late fees go into the group **pool** (benefiting the next
   recipient) or to **platform revenue**? Affects `expectedPool`/`netPayout` math.
3. **`exitPenalty` unit.** Is `exitPenalty` a flat NGN amount or a percentage of contributions to
   date? The user PRD types it as `number` without a unit.
4. **Exit/removal settlement.** When a member exits/is removed before payout, are their prior
   contributions refunded (minus penalty) or forfeited to the pool?
5. **Auto vs. manual payout.** Should payouts run automatically on schedule (`AUTO_DEBIT_ENABLED`
   implies auto-collection) with admin only handling exceptions, or is every payout admin-triggered?
6. **Payout RBAC — RESOLVED.** `adashe-contributions:process-payout` is **Super-Admin-only and
   non-delegable** (financial — moves pooled funds; see
   [README](../README.md#super-admin-only-permission-set-finalized--not-delegable)). Group `ban` (any
   `*:ban`) is likewise Super-Admin-only; the reversible `suspend`/`reinstate` uses the delegable
   `adashe-groups:suspend` permission.
