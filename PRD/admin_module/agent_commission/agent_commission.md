# Admin PRD: Agents & Commission Operations

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no admin agent/commission code exists yet)
>
> Live blueprint for `admin-dev` governing admin operations over `AgentProfile`, `Referral`, and
> `CommissionPayment` — agent lifecycle (approve/activate/suspend/terminate), tier changes,
> **commission-rate configuration**, monthly commission **calculation**, **approval**, and
> **batch payouts** with tax withholding.
> User-side spec: [`PRD/user_module/agent-dashboard-commission/agent-dashboard-commission.md`](../../user_module/agent-dashboard-commission/agent-dashboard-commission.md).

---

## 1. Overview

The admin agents & commission surface lets operations and finance staff manage the platform's
**agent network** and its **commission economy**:

- **Agent lifecycle** — review agent applications, approve/activate, suspend, terminate, and move an
  agent up/down a **tier** (`BRONZE | SILVER | GOLD | PLATINUM`).
- **Commission configuration** — set the platform-wide **commission schedule** per commission type
  (`memberRecruitment`, `loanOrigination`, `productSales`, `savingsReferral`) as either a percentage
  or a fixed amount, **tiered by agent tier**, plus per-agent rate overrides.
- **Commission run** — trigger the **monthly `calculate`** job that materializes payable commissions
  from `Referral` records, **approve** the resulting commissions, and process **`pay-batch`** payouts
  with **tax withholding**.
- **Referral management** — inspect referrals and adjust referral/commission status (approve, reject,
  reverse).

Commission calculation and payout move real money to agent bank accounts; those actions are
high-severity, audited, and payout is **Super-Admin-only and non-delegable** (`commissions:pay-batch`).

**Conventions (shared — see [`PRD/admin_module/README.md`](../README.md) for the authoritative RBAC taxonomy):**

- Backend `/api/v1/admin/*`; admin frontend `/bennie/*` (this section: `/bennie/agent-commission`).
  Endpoints live under two API groups: **`/api/v1/admin/agents/*`** and
  **`/api/v1/admin/commissions/*`**.
- Admin identity = **`adminUsers`**; authz = **`adminRoles`** (`resource:action`) + per-admin
  overrides; **Super Admin = `*`**. **Every endpoint declares its required permission**, enforced by
  `PermissionsGuard` over the admin JWT guard.
- **Every mutation writes an `adminAuditLog`** entry (`actor`, `action`, `target`, `before/after`,
  `timestamp`, `ip`, `userAgent`).
- Money is whole **NGN**; commission rates are `%` or fixed NGN; tax withholding is a `%`.
- Resource permission namespace: **`agent-commission:*`**. Batch payout and reversal are
  **Super-Admin-only and NOT delegable** per the
  [README Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable).
  The canonical permission name for batch payout is **`commissions:pay-batch`** (the `agent-commission:payout`
  string used in earlier drafts is an **alias** for it, pending code); reversal is
  **`agent-commission:reverse`**. Neither can be granted to a sub-admin role. A dedicated Finance role
  may hold `agent-commission:approve`/`:reject` but never payout or reverse.
- The user PRD already sketches `GET /api/v1/admin/agents`, `PATCH /api/v1/admin/agents/:id/status`,
  `POST /api/v1/admin/commissions/calculate`, and `POST /api/v1/admin/commissions/pay-batch`; this
  doc consolidates and completes them (tiers, rate config, approval, referral adjustments).

---

## 2. Collections / Schema

Reads/mutates the user-side `AgentProfile`, `Referral`, and `CommissionPayment` collections (defined
in the user PRD; re-stated with admin-added fields). Adds one admin-owned rate-config collection.

### 2.1 `AgentProfile` (shared; admin-managed)

```typescript
{
  _id: ObjectId;
  userId: ObjectId;                   // ref User
  agentCode: string;                  // unique "AGT_..."
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  specialization: ('MEMBER_RECRUITMENT' | 'LOAN_ORIGINATION' | 'SALES' | 'SUPPORT')[];
  territory: { state: string; lga: string[] };
  commissionRates: {                  // per-agent override of the schedule (optional)
    memberRecruitment: number;
    loanOrigination: number;
    productSales: number;
    savingsReferral: number;
  };
  performanceMetrics: {
    totalReferrals: number; activeReferrals: number;
    totalCommission: number; paidCommission: number; pendingCommission: number;
    rating: { average: number; count: number };
  };
  bankDetails: { accountNumber: string; bankName: string; accountName: string };
  approvedBy?: ObjectId;              // ref adminUsers  (📄 was ref User in user PRD — see §10)
  approvedAt?: Date;
  suspendedReason?: string;           // 📄
  terminatedReason?: string;          // 📄
  taxId?: string;                     // 📄 for withholding remittance
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 `Referral` (shared; admin-managed)

```typescript
{
  _id: ObjectId;
  agentId: ObjectId;                  // ref AgentProfile
  referredUserId: ObjectId;           // ref User
  type: 'MEMBER' | 'CUSTOMER' | 'MERCHANT';
  status: 'PENDING' | 'ACTIVE' | 'CONVERTED' | 'REJECTED';
  commission: {
    amount: number;                   // NGN
    rate: number;                     // captured rate at calculation time
    status: 'PENDING' | 'APPROVED' | 'PAID' | 'REVERSED';
    calculatedAt?: Date;
    paidAt?: Date;
    reversedReason?: string;          // 📄
  };
  conversionData?: { convertedAt: Date; value: number; productType: string };
  createdAt: Date;
}
```

### 2.3 `CommissionPayment` (shared; admin-managed)

```typescript
{
  _id: ObjectId;
  agentId: ObjectId;                  // ref AgentProfile
  period: { startDate: Date; endDate: Date };
  totalAmount: number;                // gross NGN
  breakdown: [{ referralId: ObjectId; description: string; amount: number }];
  taxWithheld: number;                // NGN
  netAmount: number;                  // totalAmount - taxWithheld
  paymentStatus: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
  paymentReference?: string;
  processedBy?: ObjectId;             // ref adminUsers
  paidAt?: Date;
  batchId?: string;                   // 📄 groups a pay-batch run
  createdAt: Date;
}
```

### 2.4 `commissionRateConfig` 📄 (NEW admin-owned; the tiered schedule)

Platform-wide default schedule; per-agent `AgentProfile.commissionRates` overrides it when set.

```typescript
{
  _id: ObjectId;
  commissionType: 'memberRecruitment' | 'loanOrigination' | 'productSales' | 'savingsReferral';
  mode: 'PERCENT' | 'FIXED';          // PERCENT = % of conversion value; FIXED = flat NGN
  tiers: {
    BRONZE: number;                   // % (0–100) or NGN depending on mode
    SILVER: number;
    GOLD: number;
    PLATINUM: number;
  };
  minPayoutNgn?: number;              // floor before a commission is payable
  isActive: boolean;
  updatedBy: ObjectId;                // ref adminUsers
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.5 `commissionRun` 📄 (NEW admin-owned; append-only job history)

```typescript
{
  _id: ObjectId;
  runId: string;                      // "CMR_<ts>"
  trigger: 'CRON' | 'MANUAL';
  triggeredBy?: ObjectId;             // ref adminUsers
  period: { startDate: Date; endDate: Date };
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  referralsProcessed: number;
  commissionsCreated: number;
  grossNgn: number;
  errors?: [{ referralId: ObjectId; message: string }];
  startedAt: Date; finishedAt?: Date; createdAt: Date;
}
```

---

## 3. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission.

### 3.1 Agent lifecycle — `/agents/*` (`agent-commission:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/agents` | `agent-commission:view` | List/search agents (filters below) |
| GET | `/agents/:id` | `agent-commission:view` | Agent detail (profile, metrics, referrals, payouts) |
| GET | `/agents/pending` | `agent-commission:view` | Approval queue (status `PENDING`) |
| POST | `/agents/:id/approve` | `agent-commission:approve` | Approve a `PENDING` agent → `ACTIVE` |
| POST | `/agents/:id/reject` | `agent-commission:reject` | Reject a `PENDING` application (reason) |
| POST | `/agents/:id/activate` | `agent-commission:activate` | `SUSPENDED` → `ACTIVE` |
| POST | `/agents/:id/suspend` | `agent-commission:suspend` | `ACTIVE` → `SUSPENDED` (reason) |
| POST | `/agents/:id/terminate` | `agent-commission:terminate` | Any → `TERMINATED` (reason; Super Admin) |
| PATCH | `/agents/:id/tier` | `agent-commission:configure` | Change agent tier up/down |
| PATCH | `/agents/:id/rates` | `agent-commission:configure` | Set per-agent rate overrides |
| PATCH | `/agents/:id/status` | `agent-commission:update` | (Compat) direct status set from user PRD |

**GET `/agents` query params:** `page`, `limit`, `q` (name/agentCode), `status`, `tier`, `state`,
`specialization`, `sortBy` (`createdAt|totalCommission|totalReferrals|rating`), `order`.

**PATCH `/agents/:id/tier` — request:**
```json
{ "tier": "GOLD", "reason": "Exceeded 50 active referrals for 3 consecutive months" }
```

**POST `/agents/:id/suspend` — request:**
```json
{ "reason": "KYC re-verification required" }
```

### 3.2 Referral management — `/agents/referrals/*` (`agent-commission:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/agents/referrals` | `agent-commission:view` | All referrals (filters below) |
| GET | `/agents/referrals/:id` | `agent-commission:view` | Referral detail |
| PATCH | `/agents/referrals/:id/status` | `agent-commission:update` | Adjust referral status (`PENDING`→`ACTIVE`/`CONVERTED`/`REJECTED`) |
| POST | `/agents/referrals/:id/commission/reverse` | `agent-commission:reverse` | Reverse a referral's commission (**Super-Admin-only, non-delegable**; reason) |

**GET `/agents/referrals` query params:** `page`, `limit`, `agentId`, `type`, `status`,
`commissionStatus`, `startDate`, `endDate`.

### 3.3 Commission configuration — `/commissions/config/*` (`agent-commission:configure`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/commissions/config` | `agent-commission:view` | Read the tiered schedule (all commission types) |
| PATCH | `/commissions/config/:commissionType` | `agent-commission:configure` | Set mode + tiered rates for a type |

**PATCH `/commissions/config/memberRecruitment` — request:**
```json
{ "mode": "FIXED", "tiers": { "BRONZE": 2500, "SILVER": 3000, "GOLD": 3500, "PLATINUM": 4000 }, "minPayoutNgn": 0 }
```
**PATCH `/commissions/config/productSales` — request (percent):**
```json
{ "mode": "PERCENT", "tiers": { "BRONZE": 1.5, "SILVER": 2.0, "GOLD": 2.5, "PLATINUM": 3.0 } }
```

### 3.4 Commission calculation, approval & payout — `/commissions/*`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/commissions/calculate` | `agent-commission:configure` | Run monthly calculation for a period (materializes payable commissions) |
| GET | `/commissions/runs` | `agent-commission:view` | Calculation run history (`commissionRun`) |
| GET | `/commissions` | `agent-commission:view` | List `CommissionPayment` records (filters below) |
| GET | `/commissions/pending-approval` | `agent-commission:view` | Approval queue (calculated, unapproved) |
| POST | `/commissions/:id/approve` | `agent-commission:approve` | Approve a calculated `CommissionPayment` |
| POST | `/commissions/:id/reject` | `agent-commission:reject` | Reject a calculated commission (reason) |
| POST | `/commissions/pay-batch` | `commissions:pay-batch` | Pay a batch of approved commissions (**Super-Admin-only, non-delegable**) |
| POST | `/commissions/:id/reverse` | `agent-commission:reverse` | Reverse a paid commission (**Super-Admin-only, non-delegable**; reason) |
| GET | `/commissions/export` | `agent-commission:export` | CSV of commission payments (financial — audited) |

**POST `/commissions/calculate` — request:**
```json
{ "period": { "startDate": "2026-06-01", "endDate": "2026-06-30" }, "agentId": null, "dryRun": false }
```
`agentId: null` runs for all agents; `dryRun: true` returns projected `CommissionPayment` records
without persisting. **Response 202:**
```json
{ "success": true, "data": { "runId": "CMR_1719830400", "status": "RUNNING", "period": { "startDate": "2026-06-01", "endDate": "2026-06-30" } } }
```

**POST `/commissions/pay-batch` — request:**
```json
{ "commissionPaymentIds": ["cp_1", "cp_2", "cp_5"], "taxWithholdingPercent": 10 }
```
Server computes `taxWithheld` and `netAmount` per record, groups them under a `batchId`, initiates
bank payout for each, and sets `paymentStatus`. **Response 200:**
```json
{ "success": true, "data": {
  "batchId": "BATCH_20260705_01",
  "count": 3, "grossNgn": 21000, "taxWithheldNgn": 2100, "netNgn": 18900,
  "results": [
    { "id": "cp_1", "paymentStatus": "PROCESSING", "netAmount": 6300, "paymentReference": "PYT-cp_1" }
  ]
} }
```

**GET `/commissions` query params:** `page`, `limit`, `agentId`, `paymentStatus`, `batchId`,
`periodStart`, `periodEnd`, `sortBy` (`createdAt|totalAmount`), `order`.

---

## 4. Business rules & state machines

### 4.1 Agent status state machine

```
(apply) ──► PENDING ──approve──► ACTIVE ⇄ SUSPENDED
               │                    │
             reject                 └──terminate──► TERMINATED (terminal, Super Admin)
               ▼
           REJECTED (terminal)                (PENDING/SUSPENDED can also be terminated)
```

- Only `ACTIVE` agents accrue new referrals/commissions. `SUSPENDED` freezes accrual but preserves
  existing pending commissions. `TERMINATED` is terminal; any unpaid approved commissions are settled
  or written back per policy (**flagged** [§10](#10-open-questions-for-the-owner)).
- Tier changes (`up`/`down`) are independent of status and require a reason; they change which
  `commissionRateConfig.tiers[...]` rate applies to **future** calculations only.

### 4.2 Rate resolution

For a referral of a given commission type, the applied rate is resolved as:

```
rate = AgentProfile.commissionRates[type]   (if set / non-null)
     else commissionRateConfig[type].tiers[ agent.tier ]
```

- `mode: PERCENT` → `amount = round( conversionData.value * rate / 100 )`.
- `mode: FIXED` → `amount = rate` (flat NGN, independent of value).
- The resolved `rate` is **captured** onto `Referral.commission.rate` at calculation time so later
  config edits never retroactively change already-calculated commissions.

### 4.3 Commission lifecycle state machine (`Referral.commission.status` / `CommissionPayment`)

```
PENDING ──calculate──► (amount set) ──approve──► APPROVED ──pay-batch──► PAID
   │                                     │                                 │
   └──(referral REJECTED)                reject                         reverse (Super Admin)
                                          ▼                                 ▼
                                     (excluded)                         REVERSED
```

- **calculate:** aggregates each agent's eligible `Referral`s in the period (status `CONVERTED`,
  `commission.status = PENDING`) into a `CommissionPayment` with a `breakdown[]`. Below-`minPayoutNgn`
  totals are carried to the next period, not paid. Idempotent per `(agentId, period)` — re-running
  the same period does not duplicate (`AGT_ADM_007`).
- **approve/reject:** an approver (not the same admin who calculated, if separation-of-duties is
  enabled — **flagged**) moves a calculated payment to approved or rejected.
- **pay-batch:** only `APPROVED`/`PENDING`-approved-and-approved payments; applies
  `taxWithholdingPercent`, computes `netAmount`, initiates bank transfer, sets `PROCESSING`→`PAID`
  (or `FAILED`), stamps `paymentReference`, `paidAt`, `processedBy`, `batchId`, and marks the
  underlying `Referral.commission.status = PAID`. Idempotent per `batchId` + record.
- **reverse:** Super-Admin only; claws back a `PAID`/`APPROVED` commission, sets `REVERSED`, records
  `reversedReason`, and posts a compensating entry. High-severity audited.

### 4.4 Tax withholding

- `taxWithheld = round( totalAmount * taxWithholdingPercent / 100 )`; `netAmount = totalAmount -
  taxWithheld`. Default percent from `TAX_WITHHOLDING_PERCENT` env; overridable per batch.
- Withheld amounts are recorded per `CommissionPayment` for remittance reporting; `AgentProfile.taxId`
  supports downstream remittance. (Nigeria WHT context — confirm rate with owner/finance.)

### 4.5 Performance-driven tier automation (optional)

The user PRD mentions automatic tier upgrades/downgrades. This admin section supports **manual** tier
changes now; an **automated** tier-review job (thresholds on active referrals / revenue) is
**flagged** as optional ([§10](#10-open-questions-for-the-owner)).

---

## 5. Validation

- `tier`, `status`, `specialization`, referral `type`/`status`: within enums.
- `commissionRateConfig.mode`: `PERCENT` or `FIXED`; for `PERCENT`, each tier value `0–100`; for
  `FIXED`, each tier value integer NGN `>= 0`.
- `taxWithholdingPercent`: number `0–100`.
- `period.startDate < period.endDate`.
- `pay-batch`: `commissionPaymentIds` non-empty; every referenced payment must be in an approvable/
  payable state (else the item is skipped and reported, or the batch is rejected — see policy).
- `suspend`/`terminate`/`reject`/`reverse`/tier-change require a non-empty `reason`.
- `bankDetails` present and valid before an agent can be included in a payout batch (`AGT_ADM_010`).
- All `:id` params validated as ObjectId; missing target → `AGT_ADM_001`/`AGT_ADM_002`.

---

## 6. Audit events

| Action | Trigger | Severity |
|--------|---------|----------|
| `agent.approve` / `.reject` | agent onboarding | normal |
| `agent.activate` / `.suspend` | agent status | normal |
| `agent.terminate` | terminate agent | **high** |
| `agent.tier.change` | tier up/down | normal |
| `agent.rates.override` | per-agent rate override | **high** |
| `commission.config.update` | tiered schedule change | **high** |
| `commission.calculate` | run calculation | normal |
| `commission.approve` / `.reject` | commission approval | normal |
| `commission.pay_batch` | batch payout (money out) | **high** |
| `commission.reverse` | reverse a commission | **high** |
| `referral.status.update` | referral status adjustment | normal |
| `commission.export` | export payments (financial) | **high** |

Automated CRON calculation runs write an audit entry with `actorEmail: "system"`. Each entry records
`actor`, `targetType`, `targetId`, `before`, `after`, `reason?`, `timestamp`, `ip`, `userAgent`.

---

## 7. Error codes

```json
{ "success": false, "error": { "code": "AGT_ADM_010", "message": "Agent has no valid bank details for payout", "details": { "agentId": "agt_9" } } }
```

| Code | Meaning |
|------|---------|
| `AGT_ADM_001` | Agent not found |
| `AGT_ADM_002` | Referral / commission payment not found |
| `AGT_ADM_003` | Invalid agent status transition |
| `AGT_ADM_004` | Invalid commission status transition |
| `AGT_ADM_005` | Invalid rate config (mode/tier validation) |
| `AGT_ADM_006` | Invalid calculation period |
| `AGT_ADM_007` | Commissions already calculated for this agent/period (idempotency) |
| `AGT_ADM_008` | Commission not in an approvable/payable state |
| `AGT_ADM_009` | Payout batch already processed (idempotency) |
| `AGT_ADM_010` | Agent missing valid bank details for payout |
| `AGT_ADM_011` | Reason required for this action |
| `AGT_ADM_012` | Insufficient permission for action (e.g. payout/reverse not Super Admin) |

---

## 8. Admin UI / Section (premium UX)

Route base `/bennie/agent-commission`. Rich ops console — no basic UI.

- **Agents table** — pagination, search (name/code), filters (status, tier, state, specialization).
  Columns: agent, tier chip, status chip, active referrals, total/pending commission, rating.
  Quick actions (approve/reject when pending, suspend/activate, terminate) behind confirm modals.
- **Agent approval queue** — `PENDING` applications with KYC/bank-details review panel; Approve/Reject.
- **Agent detail drawer/page** — tabs: Overview (profile, territory, metrics), Referrals (embedded
  table), Commissions (payment history + status), Tier & Rates (tier changer with reason, per-agent
  rate override form), Bank details. Terminate button hidden unless Super Admin.
- **Commission configuration** — the tiered **rate matrix**: rows = commission types
  (memberRecruitment/loanOrigination/productSales/savingsReferral), a PERCENT/FIXED mode toggle per
  row, and columns for BRONZE/SILVER/GOLD/PLATINUM. Save → high-severity confirm; "future runs only"
  banner.
- **Commission run center** — batch-job panel: *Calculate* form (period, all/single agent, **Dry-run**
  preview of projected payments), run history table (`commissionRun`) with counts/errors.
- **Approval queue** — calculated, unapproved `CommissionPayment`s with breakdown drill-down;
  Approve/Reject (reason).
- **Payout batch** — select approved commissions → **pay-batch** modal showing gross, tax withheld
  (editable %), net per agent and totals; confirm required; Pay button hidden unless
  `commissions:pay-batch` (Super Admin only). Batch results table with per-agent status and reference.
- **Reversal** — from a paid commission, a Super-Admin-only reverse action with reason.
- **Charts** — commission paid per month, top agents by commission, referrals-by-type funnel,
  agents-by-tier donut.

---

## 9. Environment variables

Rates are DB-driven via `commissionRateConfig`; env vars are bootstrap seeds/defaults:

```bash
AGENT_CODE_PREFIX=AGT
COMMISSION_PAYOUT_DAY=5              # day of month the CRON pay run targets
COMMISSION_CALCULATION_CRON=0 2 1 * * # monthly calculation on the 1st
MIN_PAYOUT_AMOUNT=5000              # seeds commissionRateConfig.minPayoutNgn
TAX_WITHHOLDING_PERCENT=10          # default WHT % (confirm with finance)
```

---

## 10. Open questions for the owner

1. **`approvedBy` ref (flagged).** The user PRD types `AgentProfile.approvedBy` as `ref User`. In the
   admin plane the approver is an `adminUsers` account. Confirm the ref should be `adminUsers` (this
   doc assumes so) — the same drift the README flags for admin identity generally.
2. **Payout / reverse RBAC — RESOLVED.** `commissions:pay-batch` and `agent-commission:reverse` are
   **Super-Admin-only and non-delegable**
   ([README](../README.md#super-admin-only-permission-set-finalized--not-delegable)). A Finance role may
   hold `agent-commission:approve`/`:reject` but **never** payout or reverse.
3. **Separation of duties.** Should the admin who runs `calculate` be barred from `approve`, and the
   approver from `pay-batch`? (Recommended for financial controls; not assumed enforced yet.)
4. **Terminated-agent unpaid commissions.** On `terminate`, are already-approved-but-unpaid
   commissions still paid out, held, or written back? ([§4.1](#41-agent-status-state-machine))
5. **Tax withholding correctness.** Confirm the WHT rate/rule for agent commissions under Nigerian
   tax law (FIRS/state) and whether it varies by amount or agent `taxId` presence — this doc treats
   it as a flat, batch-overridable percent.
6. **Automated tiering.** Do you want the optional automated tier-review job
   ([§4.5](#45-performance-driven-tier-automation-optional)), and if so, what thresholds?
7. **Payout rail.** Confirm the payout mechanism — bank transfer via SeerBit (backend source of
   truth per CLAUDE.md) — and whether payouts credit the agent's platform wallet vs. an external
   bank account in `bankDetails`.
