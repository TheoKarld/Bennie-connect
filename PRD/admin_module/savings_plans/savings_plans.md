# Admin PRD: Savings Plans & Interest Operations

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no admin savings code exists yet)
>
> Live blueprint for `admin-dev` governing admin operations over `SavingsPlan` (product
> catalog), read-only oversight of `UserSavings` accounts and `SavingsTransaction` history,
> and control of the **interest-accrual batch job**.
> User-side spec: [`PRD/user_module/savings-products/savings-products.md`](../../user_module/savings-products/savings-products.md).

---

## 1. Overview

The admin savings surface lets finance/operations staff define and maintain the **savings product
catalog** (`SavingsPlan`) — Flex, Target, Fixed, and Harvest plans, each with amount bounds,
interest rate, tenure/lock, withdrawal restrictions and eligibility — and activate/deactivate plans
so members can (or cannot) open new accounts against them. Admins also get **read-only oversight** of
every member savings account (`UserSavings`) and its ledger (`SavingsTransaction`), and can
**trigger / monitor the interest-accrual batch job** that credits `INTEREST_CREDIT` transactions.

This DB-driven plan catalog **replaces the frontend hardcoded `COOP_RATES`** and the per-type default
rates baked into env vars — the source of truth for rates becomes the `SavingsPlan` documents.

**Conventions (shared — see [`PRD/admin_module/README.md`](../README.md) for the authoritative RBAC taxonomy):**

- Backend `/api/v1/admin/*`; admin frontend `/bennie/*` (this section: `/bennie/savings-plans`).
- Admin identity = **`adminUsers`**; authz = **`adminRoles`** (`resource:action`) + per-admin
  overrides; **Super Admin = `*`**. **Every endpoint declares its required permission**, enforced by
  `PermissionsGuard` over the admin JWT guard.
- **Every mutation writes an `adminAuditLog`** entry (`actor`, `action`, `target`, `before/after`,
  `timestamp`, `ip`, `userAgent`).
- Money is whole **NGN**; interest rates are annual percentages.
- Resource permission namespace: **`savings-plans:*`**. **`savings-plans:configure`** governs batch
  interest accrual and account force-close/force-mature/forfeit — because these change financial state
  at scale and can forfeit member funds, `savings-plans:configure` is **Super-Admin-only and NOT
  delegable** per the
  [README Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable).
  `savings-plans:delete` (any `*:delete`) is likewise Super-Admin-only. View/create/update/activate/
  deactivate of the plan catalog remain delegable to sub-admins (e.g. a Finance/Content role).
- Admin **does not** directly write member balances — interest credits and any adjustments flow
  through the savings/wallet service that writes `SavingsTransaction` records (never direct balance
  writes).

---

## 2. Collections / Schema

Reads/mutates the user-side `SavingsPlan` (admin-owned catalog) and reads `UserSavings` /
`SavingsTransaction` (defined in the user PRD). Adds one admin-owned job-run collection.

### 2.1 `SavingsPlan` (shared collection; admin-owned)

```typescript
{
  _id: ObjectId;
  name: string;                       // e.g. "Flex Save", "Harvest Season Save"
  type: 'FLEX' | 'TARGET' | 'FIXED' | 'HARVEST';
  description: string;
  minAmount: number;                  // NGN
  maxAmount?: number;                 // NGN
  interestRate: number;               // annual %
  tenureDays?: number;                // FIXED — required
  lockPeriodDays?: number;            // FIXED/HARVEST
  withdrawalRestrictions: {
    freeWithdrawals: number;          // per month
    penaltyPerWithdrawal: number;     // NGN or % (see validation)
    noticePeriodDays: number;
  };
  eligibility: {
    minMembershipDays: number;
    requiresActiveMembership: boolean;
    allowedRoles: string[];           // user roles allowed to open (e.g. ["farmer"])
    minTier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';  // 📄 optional membership-tier gate
    cooperativeId?: ObjectId;         // 📄 optional per-cooperative scoping
  };
  status: 'ACTIVE' | 'INACTIVE';      // INACTIVE = no new accounts; existing accounts unaffected
  createdBy?: ObjectId;               // 📄 ref adminUsers
  updatedBy?: ObjectId;               // 📄 ref adminUsers
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 `interestAccrualRun` 📄 (admin-owned; append-only job history)

```typescript
{
  _id: ObjectId;
  runId: string;                      // unique "IAR_<ts>"
  trigger: 'CRON' | 'MANUAL';
  triggeredBy?: ObjectId;             // ref adminUsers (null when CRON)
  scope: { planId?: ObjectId; type?: string; all: boolean };
  periodStart: Date;
  periodEnd: Date;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  accountsProcessed: number;
  accountsCredited: number;
  totalInterestCreditedNgn: number;
  errors?: [{ savingsId: ObjectId; message: string }];
  startedAt: Date;
  finishedAt?: Date;
  createdAt: Date;
}
```

### 2.3 Existing schema relied upon (read-only for admin)

- `UserSavings` — `status: ACTIVE | MATURED | CLOSED | FORFEITED`, `principalBalance`,
  `accruedInterest`, `totalBalance`, `lastInterestCalculationAt`, `withdrawalCount`.
- `SavingsTransaction` — `type: DEPOSIT | WITHDRAWAL | INTEREST_CREDIT | PENALTY_DEBIT`, amounts,
  `balanceBefore/After`, `reference` (unique), `status`.

---

## 3. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission.

### 3.1 Savings-plan catalog (`savings-plans:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/savings-plans` | `savings-plans:view` | List/search plans (filters below) |
| GET | `/savings-plans/:id` | `savings-plans:view` | Plan detail + account/AUM roll-ups |
| POST | `/savings-plans` | `savings-plans:create` | Create a savings plan (starts `INACTIVE`) |
| PATCH | `/savings-plans/:id` | `savings-plans:update` | Update plan fields (rate, bounds, restrictions, eligibility) |
| DELETE | `/savings-plans/:id` | `savings-plans:delete` | Delete plan — blocked if any account references it (**Super-Admin-only, non-delegable**) |
| POST | `/savings-plans/:id/activate` | `savings-plans:activate` | `INACTIVE` → `ACTIVE` (opens plan to new accounts) |
| POST | `/savings-plans/:id/deactivate` | `savings-plans:deactivate` | `ACTIVE` → `INACTIVE` (stops new accounts) |

**GET `/savings-plans` query params:** `page`, `limit`, `q`, `type`, `status`, `sortBy`
(`createdAt|interestRate|name`), `order`.

**POST `/savings-plans` — request:**
```json
{
  "name": "Harvest Season Save",
  "type": "HARVEST",
  "description": "Seasonal savings with withdrawal windows aligned to harvest",
  "minAmount": 5000,
  "interestRate": 12,
  "lockPeriodDays": 120,
  "withdrawalRestrictions": { "freeWithdrawals": 0, "penaltyPerWithdrawal": 500, "noticePeriodDays": 14 },
  "eligibility": { "minMembershipDays": 30, "requiresActiveMembership": true, "allowedRoles": ["farmer"], "minTier": "Silver" }
}
```
**Response 201:**
```json
{ "success": true, "data": { "id": "plan_1", "type": "HARVEST", "status": "INACTIVE" } }
```

### 3.2 UserSavings oversight (read-only) (`savings-plans:view`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/savings-accounts` | `savings-plans:view` | All member savings accounts (filters below) |
| GET | `/savings-accounts/:id` | `savings-plans:view` | Account detail (balances, interest, plan) |
| GET | `/savings-accounts/:id/transactions` | `savings-plans:view` | Ledger for an account (paginated) |

**GET `/savings-accounts` query params:** `page`, `limit`, `userId`, `planId`, `type`, `status`,
`minBalance`, `maxBalance`, `sortBy` (`openedAt|totalBalance|maturesAt`), `order`.

> Oversight is **read-only**. There is no admin deposit/withdraw on a member account here; any
> corrective adjustment is a separate, Super-Admin-gated financial-operations flow (out of scope for
> this section — flagged [§10](#10-open-questions-for-the-owner)).

### 3.3 Account lifecycle overrides (`savings-plans:configure` — Super-Admin-only, non-delegable)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/savings-accounts/:id/force-mature` | `savings-plans:configure` | Mark a `FIXED`/`HARVEST` account `MATURED` early (reason; **Super Admin only**) |
| POST | `/savings-accounts/:id/force-close` | `savings-plans:configure` | Force-close an account, releasing balance to wallet (**Super Admin only**) |

Both are **high-severity**, reason-required, audited, and settle balances via the savings/wallet
service. `force-close` on a locked `FIXED` account may apply forfeiture rules ([§4.3](#43-force-close--forfeiture)).

### 3.4 Interest accrual batch job (`savings-plans:configure` — Super-Admin-only for run/schedule)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/savings-plans/interest/run` | `savings-plans:configure` | Trigger an accrual run now (scope in body; **Super Admin only**) |
| GET | `/savings-plans/interest/runs` | `savings-plans:view` | List accrual run history (`interestAccrualRun`) |
| GET | `/savings-plans/interest/runs/:runId` | `savings-plans:view` | Run detail (counts, totals, errors) |
| POST | `/savings-plans/interest/schedule` | `savings-plans:configure` | Enable/disable/reschedule the cron (**Super Admin only**) |

**POST `/savings-plans/interest/run` — request:**
```json
{ "scope": { "all": true }, "periodStart": "2026-06-01", "periodEnd": "2026-06-30", "dryRun": false }
```
`dryRun: true` computes and returns projected credits **without** writing `SavingsTransaction`
records — used to preview end-of-month accrual. Response includes a `runId` for async runs.

**Response 202 (accepted, async):**
```json
{ "success": true, "data": { "runId": "IAR_1719830400", "status": "RUNNING", "scope": { "all": true } } }
```

### 3.5 Export (`savings-plans:export`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/savings-plans/export` | `savings-plans:export` | CSV of the plan catalog |
| GET | `/savings-accounts/export` | `savings-plans:export` | CSV of accounts (financial data — audited) |

---

## 4. Business rules & state machines

### 4.1 SavingsPlan state machine

```
(create) ──► INACTIVE ⇄ ACTIVE
                 │
              delete (only if no UserSavings references it)
                 ▼
             (removed)
```

- New plans start `INACTIVE`; only `ACTIVE` plans accept new accounts.
- `deactivate` stops **new** accounts; **existing** accounts continue accruing under their captured
  terms. Editing `interestRate` on a plan applies to **future accrual periods only** — never
  retroactively recomputes past `INTEREST_CREDIT` transactions.
- `delete` is blocked while any `UserSavings.planId` references the plan (`SAV_ADM_006`); deactivate
  instead.

### 4.2 Interest accrual rules (per user PRD business logic)

- **Flex:** daily-balance method; interest accrues on `principalBalance`, compounded monthly,
  credited on the last day of the month.
- **Fixed:** fixed rate, interest paid at maturity (or on force-mature).
- **Harvest / Target:** accrue per plan rate; Harvest respects seasonal withdrawal windows.
- Each accrual run computes interest since `UserSavings.lastInterestCalculationAt`, writes an
  `INTEREST_CREDIT` `SavingsTransaction`, updates `accruedInterest`/`totalBalance`, and advances
  `lastInterestCalculationAt`. Idempotency key `accrual:{savingsId}:{periodEnd}` prevents
  double-crediting the same period.
- A run only touches `status = ACTIVE` accounts (and `MATURED` Fixed accounts pending payout).

### 4.3 Force-close / forfeiture

- `force-mature`: allowed on `ACTIVE` `FIXED`/`HARVEST` accounts before `maturesAt`; credits accrued
  interest to date and sets `MATURED`.
- `force-close`: releases `totalBalance` to the member wallet and sets `CLOSED`. If the plan/account
  is under lock and forfeiture applies, a `PENALTY_DEBIT` is applied per
  `withdrawalRestrictions.penaltyPerWithdrawal` and status may be `FORFEITED` instead — the applied
  policy is returned in the response and audited.

### 4.4 Rate-source migration (replaces `COOP_RATES`)

Once plans are DB-driven, the frontend hardcoded `COOP_RATES` and the `DEFAULT_*_INTEREST_RATE` env
vars become **bootstrap seeds only**. The seeder creates one `SavingsPlan` per type from the env
defaults if the catalog is empty; thereafter the DB is authoritative. **Flagged for the owner**
([§10](#10-open-questions-for-the-owner)).

---

## 5. Validation

- `name`: required, unique per `type`.
- `type`, `status`: within enums.
- `minAmount` integer NGN `>= 0`; `maxAmount` (if set) `> minAmount`.
- `interestRate`: number `0–100` (annual %).
- `FIXED` plans require `tenureDays > 0`; `HARVEST`/`FIXED` `lockPeriodDays >= 0`.
- `withdrawalRestrictions.freeWithdrawals >= 0`; `penaltyPerWithdrawal >= 0` (declare units — NGN
  flat unless `penaltyIsPercent` flag added; **flagged** [§10](#10-open-questions-for-the-owner));
  `noticePeriodDays >= 0`.
- `eligibility.minMembershipDays >= 0`; `allowedRoles` ⊆ known user roles
  (`farmer|agent|admin|super_admin`); `minTier` (if set) within tier enum.
- Interest run: `periodStart < periodEnd`; scope must resolve to `all` or a valid `planId`/`type`.
- All `:id` params validated as ObjectId; missing target → `SAV_ADM_001`/`SAV_ADM_002`.

---

## 6. Audit events

| Action | Trigger | Severity |
|--------|---------|----------|
| `savings_plan.create` / `.update` | catalog CRUD | normal |
| `savings_plan.activate` / `.deactivate` | plan status | normal |
| `savings_plan.delete` | delete plan | **high** |
| `savings.interest.run` | manual accrual trigger | **high** |
| `savings.interest.schedule.update` | cron enable/reschedule | normal |
| `savings.account.force_mature` | early maturity override | **high** |
| `savings.account.force_close` | force close / forfeiture | **high** |
| `savings.accounts.export` | account export (financial) | **high** |

Automated CRON accrual runs also write an audit entry with `actorEmail: "system"` and the job name.
Each entry records `actor`, `targetType`, `targetId`, `before`, `after`, `reason?`, `timestamp`,
`ip`, `userAgent`.

---

## 7. Error codes

```json
{ "success": false, "error": { "code": "SAV_ADM_007", "message": "Interest already accrued for this period", "details": { "savingsId": "sav_9", "periodEnd": "2026-06-30" } } }
```

| Code | Meaning |
|------|---------|
| `SAV_ADM_001` | Savings plan not found |
| `SAV_ADM_002` | Savings account not found |
| `SAV_ADM_003` | Invalid plan status transition |
| `SAV_ADM_004` | Invalid plan definition (validation failure) |
| `SAV_ADM_005` | Duplicate plan name for type |
| `SAV_ADM_006` | Cannot delete plan — accounts reference it |
| `SAV_ADM_007` | Interest already accrued for period (idempotency conflict) |
| `SAV_ADM_008` | Invalid accrual run scope/period |
| `SAV_ADM_009` | Account not eligible for force-mature/close in current state |
| `SAV_ADM_010` | Reason required for this action |
| `SAV_ADM_011` | Insufficient permission for action |

---

## 8. Admin UI / Section (premium UX)

Route base `/bennie/savings-plans`. Rich ops console — no basic UI.

- **Plans table** — pagination, search, filters (type, status). Columns: name, type, rate,
  min/max, active-accounts count, AUM (assets under management, NGN). Status toggle
  (Activate/Deactivate) with confirm; quick edit.
- **Plan editor form** — sections for pricing (rate, bounds), tenure/lock, withdrawal restrictions,
  eligibility (membership days, active-membership, roles, min tier, cooperative scope). "Rate change
  applies to future accrual only" banner. Confirm modal on save.
- **Accounts oversight table** — all `UserSavings` with filters (plan, type, status, balance range,
  user search). Row → **account detail drawer**: balances, accrued interest, maturity, plan terms,
  and an embedded **transaction ledger** table. Force-mature / force-close buttons hidden unless
  admin holds `savings-plans:configure` (Super Admin), each behind a reason-required confirm modal.
- **Interest accrual center** — a batch-job control panel:
  - *Run now* form (scope: all / by plan / by type; period; **Dry-run** toggle showing projected
    credits before committing).
  - *Schedule* controls (enable/disable cron, next-run time).
  - *Run history* table (`interestAccrualRun`) with status, accounts processed/credited, total
    credited, and an errors drill-down.
- **Charts** — AUM by plan type, interest credited per month, new accounts per plan.

---

## 9. Environment variables

Rates are DB-driven via `SavingsPlan`; env vars are bootstrap seeds/defaults only:

```bash
DEFAULT_FLEX_INTEREST_RATE=8        # seeds a FLEX plan if catalog empty
DEFAULT_FIXED_INTEREST_RATE=15      # seeds a FIXED plan
DEFAULT_HARVEST_INTEREST_RATE=12    # seeds a HARVEST plan
DEFAULT_TARGET_INTEREST_RATE=10     # seeds a TARGET plan
INTEREST_CALCULATION_CRON=0 0 * * * # daily accrual sweep; monthly credit on last day
SAVINGS_ACCRUAL_DRY_RUN_DEFAULT=false
```

---

## 10. Open questions for the owner

1. **Penalty units.** `withdrawalRestrictions.penaltyPerWithdrawal` — is it a flat NGN amount or a
   percentage? Recommend adding an explicit `penaltyIsPercent: boolean` to remove ambiguity.
2. **`COOP_RATES` / env migration.** Confirm the plan catalog is seeded from the `DEFAULT_*_RATE`
   env vars on first boot and is authoritative thereafter (frontend `COOP_RATES` retired).
3. **Corrective adjustments — DIRECTION SET.** Read-only oversight here excludes admin
   deposit/withdraw on member accounts. Balance corrections belong to the separate financial-operations
   flow and require `transactions:reverse`, which is **Super-Admin-only and non-delegable**
   ([README](../README.md#super-admin-only-permission-set-finalized--not-delegable)). Account
   force-close/force-mature (`savings-plans:configure`) is likewise Super-Admin-only.
4. **Force-close forfeiture policy.** Confirm the forfeiture rule on force-closing a locked FIXED
   account (apply `penaltyPerWithdrawal` and set `FORFEITED`, vs. release full balance).
5. **Accrual transport.** Confirm accrual runs are async (return `runId`, poll `runs/:runId`) vs.
   synchronous for small scopes.
