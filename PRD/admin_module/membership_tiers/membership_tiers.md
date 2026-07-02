# Admin PRD: Membership Tiers

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no admin membership-tier code exists yet; tiers are currently
> hardcoded on the frontend)
>
> Live blueprint for `admin-dev` governing a **new** `membershipTiers` collection — the
> subscription tiers **Bronze / Silver / Gold / Platinum**, each with per-tier **privileges**
> (benefits + eligibility flags) and **pricing** (annual cost).
> Related user-side spec: [`PRD/user_module/membership/membership-management.md`](../../user_module/membership/membership-management.md).

---

## 1. Overview

The admin membership-tiers surface lets a Content/Operations manager define and maintain the
**paid subscription tiers** members subscribe to. Today these tiers are **hardcoded on the
frontend** in [`src/data.ts`](../../../src/data.ts) as `MEMBERSHIP_TIERS`
(Bronze/Silver/Gold/Platinum with `cost`, `benefits`, and display colours). This spec moves them
**DB-driven** into a new `membershipTiers` collection so pricing and privileges can be edited without
a code deploy.

Each tier carries structured **privileges** — machine-readable eligibility flags the app enforces
(savings-plan access, cooperative-share cap, service/input discounts, priority equipment booking,
dividend-payout priority, wallet-transfer fees) — plus a human-readable `benefits` list, and
**pricing** (annual `cost` in NGN).

> **IMPORTANT — divergence flagged (see [§4.1](#41-tier-vs-membership-type--the-two-axes)).** These
> subscription **tiers** (Bronze/Silver/Gold/Platinum) are a **different axis** from the membership
> PRD's `Membership.type` (`REGULAR | ASSOCIATE | SENIOR | LIFETIME`). Both exist; they are not the
> same field and must not be conflated. This document specifies the tiers and documents their
> relationship to `type` for the owner to reconcile.

**Conventions (shared — see [`PRD/admin_module/README.md`](../README.md) for the authoritative RBAC taxonomy):**

- Backend `/api/v1/admin/*`; admin frontend `/bennie/*` (this section: `/bennie/membership-tiers`).
- Admin identity = **`adminUsers`**; authz = **`adminRoles`** (`resource:action`) + per-admin
  overrides; **Super Admin = `*`**. **Every endpoint declares its required permission**, enforced by
  `PermissionsGuard` over the admin JWT guard.
- **Every mutation writes an `adminAuditLog`** entry (`actor`, `action`, `target`, `before/after`,
  `timestamp`, `ip`, `userAgent`).
- Money is whole **NGN**; `cost` is an annual subscription fee.
- Resource permission namespace: **`membership-tiers:*`**. Pricing changes are **high-severity**
  (they affect what members are charged); tier `delete` (any `*:delete`) is **Super-Admin-only and NOT
  delegable** per the
  [README Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable).
- **Config SSOT (finalized):** `membershipTiers` is the **authoritative source** for tier **pricing +
  privileges** — **not** `settings.membership.pricing`. Any tier pricing in the global `settings`
  collection is retired as an authoritative source (kept only as a convenience mirror if present); all
  consumers read tier pricing/privileges from `membershipTiers`. See
  [README → Configuration SSOT](../README.md#configuration-single-source-of-truth-ssot).

---

## 2. Collections / Schema

### 2.1 `membershipTiers` 📄 (NEW admin-owned collection)

```typescript
{
  _id: ObjectId;
  key: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';   // stable machine key (unique)
  name: string;                       // display name (e.g. "Gold")
  rank: number;                       // ordering: Bronze=1 ... Platinum=4 (unique)
  description?: string;

  pricing: {
    annualCost: number;               // NGN/year (Bronze = 0 free tier)
    currency: 'NGN';
  };

  privileges: {
    // savings access
    savingsPlanTypes: ('FLEX' | 'TARGET' | 'FIXED' | 'HARVEST')[]; // which plan types this tier may open
    // cooperative shares
    shareCap: number | null;          // max cooperative shares purchasable; null = unlimited
    // discounts (percent off)
    equipmentDiscountPercent: number; // % off equipment/service bookings
    inputDiscountPercent: number;     // % off marketplace input items
    // priority & fees
    priorityEquipmentBooking: boolean;
    dividendPriority: boolean;        // priority in dividend payout ordering
    walletTransferFeeWaived: boolean; // zero-fee internal transfers
    // group savings
    adasheAccess: boolean;            // Ajo/Esusu contribution-group access
    dedicatedRelationshipManager: boolean;
  };

  benefits: string[];                 // human-readable bullet list (mirrors frontend copy)

  // presentation (carried from frontend so UI need not hardcode)
  display: {
    color?: string;                   // tailwind classes
    badgeBg?: string;
  };

  status: 'ACTIVE' | 'INACTIVE';      // INACTIVE = not offered for new subscriptions
  isSystem: boolean;                  // true for the 4 seeded tiers; blocks delete/key-rename
  createdBy?: ObjectId;               // ref adminUsers
  updatedBy?: ObjectId;               // ref adminUsers
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Seeding from the frontend hardcoded tiers

On bootstrap, if `membershipTiers` is empty, seed the four tiers from `MEMBERSHIP_TIERS` in
`src/data.ts` (`isSystem: true`), mapping the current copy to the structured `privileges`:

| key | annualCost (NGN) | shareCap | equipDisc | inputDisc | priorityBooking | dividendPriority | transferFeeWaived | adashe |
|-----|-----------------:|:--------:|:---------:|:---------:|:---------------:|:----------------:|:-----------------:|:------:|
| Bronze | 0 | 0 | 0% | 0% | no | no | no | no |
| Silver | 15,000 | 2,000 | 5% | 0% | no | no | no | yes |
| Gold | 35,000 | null (unlimited) | 10% | 10% | yes | yes | no | yes |
| Platinum | 75,000 | null (unlimited) | 20% | 20% | yes | yes | yes | yes |

(Derived from the `benefits` copy in `src/data.ts`; the owner should confirm the exact
discount/cap/priority mapping — **flagged** [§10](#10-open-questions-for-the-owner).)

### 2.3 Relationship to existing schema

- **Subscription record.** A member's *current* tier is stored on their profile/membership (the
  frontend keeps it under `membership.tier`). Whether that lives on `users`, `Membership`, or a new
  `TierSubscription` collection is a user-side data-model decision — **flagged**
  ([§10](#10-open-questions-for-the-owner)). This admin section owns only the **tier catalog**, not
  the per-member subscription lifecycle (that is billing/renewals, a separate flow).
- **`Membership.type`** (`REGULAR | ASSOCIATE | SENIOR | LIFETIME`) is untouched by this section.

---

## 3. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission.

### 3.1 Tier catalog (`membership-tiers:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/membership-tiers` | `membership-tiers:view` | List tiers (ordered by `rank`) |
| GET | `/membership-tiers/:key` | `membership-tiers:view` | Tier detail (privileges, pricing, subscriber count) |
| POST | `/membership-tiers` | `membership-tiers:create` | Create a custom tier |
| PATCH | `/membership-tiers/:key` | `membership-tiers:update` | Update privileges / benefits / display |
| PATCH | `/membership-tiers/:key/pricing` | `membership-tiers:update` | Update `annualCost` (high-severity) |
| DELETE | `/membership-tiers/:key` | `membership-tiers:delete` | Delete a **non-system** tier with no subscribers (**Super-Admin-only, non-delegable**) |
| POST | `/membership-tiers/:key/activate` | `membership-tiers:activate` | `INACTIVE` → `ACTIVE` |
| POST | `/membership-tiers/:key/deactivate` | `membership-tiers:deactivate` | `ACTIVE` → `INACTIVE` (no new subscriptions) |

**GET `/membership-tiers` — response 200:**
```json
{ "success": true, "data": [
  { "key": "Bronze", "rank": 1, "pricing": { "annualCost": 0, "currency": "NGN" }, "status": "ACTIVE", "subscriberCount": 5120 },
  { "key": "Silver", "rank": 2, "pricing": { "annualCost": 15000, "currency": "NGN" }, "status": "ACTIVE", "subscriberCount": 1830 },
  { "key": "Gold",   "rank": 3, "pricing": { "annualCost": 35000, "currency": "NGN" }, "status": "ACTIVE", "subscriberCount": 640 },
  { "key": "Platinum","rank": 4,"pricing": { "annualCost": 75000, "currency": "NGN" }, "status": "ACTIVE", "subscriberCount": 88 }
] }
```

**PATCH `/membership-tiers/:key` — request (privileges edit):**
```json
{
  "privileges": {
    "savingsPlanTypes": ["FLEX", "TARGET", "HARVEST"],
    "shareCap": 2000,
    "equipmentDiscountPercent": 5,
    "inputDiscountPercent": 0,
    "priorityEquipmentBooking": false,
    "dividendPriority": false,
    "walletTransferFeeWaived": false,
    "adasheAccess": true,
    "dedicatedRelationshipManager": false
  },
  "benefits": ["Everything in Bronze", "5% discount on tractor & processing bookings", "..."]
}
```

**PATCH `/membership-tiers/:key/pricing` — request:**
```json
{ "annualCost": 18000 }
```
**Response 200:**
```json
{ "success": true, "data": { "key": "Silver", "previousCost": 15000, "annualCost": 18000, "appliesTo": "NEW_AND_RENEWAL" } }
```

### 3.2 Export (`membership-tiers:export`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/membership-tiers/export` | `membership-tiers:export` | CSV of the tier catalog |

---

## 4. Business rules & state machines

### 4.1 Tier vs. membership `type` — the two axes

There are **two distinct classification axes** on a member; documented here explicitly for the owner
to reconcile:

| Axis | Where | Values | Meaning | Owned by |
|------|-------|--------|---------|----------|
| **Subscription tier** | `membershipTiers` + a per-member subscription | Bronze / Silver / Gold / Platinum | **Paid** service level; drives privileges (discounts, share cap, priority, fees) and an **annual cost** | this admin section |
| **Membership `type`** | `Membership.type` (user PRD) | REGULAR / ASSOCIATE / SENIOR / LIFETIME | **Categorical** membership class (governance/voting/longevity), independent of paid tier | membership user PRD |

They are **orthogonal**: e.g. a `LIFETIME` member could hold a `Gold` tier, or a `REGULAR` member a
`Bronze` tier. Enforcement should read the **tier** for privilege/discount decisions and the **type**
for governance/voting decisions. **This divergence is flagged** — the owner must confirm the intended
relationship and whether `type` should also confer privileges (currently only `tier` does here).

### 4.2 Tier state machine

```
(create) ──► INACTIVE ⇄ ACTIVE
                 │
              delete (only if !isSystem AND subscriberCount == 0)
                 ▼
             (removed)
```

- The four seeded tiers are `isSystem: true` — their `key`/`rank` cannot be renamed and they cannot
  be deleted (only deactivated).
- `deactivate` stops **new** subscriptions to the tier; **existing** subscribers keep their tier and
  privileges until renewal/expiry.

### 4.3 Pricing-change policy

- `annualCost` changes apply to **new subscriptions and next renewals only** — never retroactively
  re-bill an active subscriber mid-term (mirrors the no-retroactive-repricing rule used across the
  admin module). The response reports `appliesTo: "NEW_AND_RENEWAL"`.
- Downgrading a tier's privileges is allowed but surfaced as a warning (affects existing subscribers
  at renewal).

### 4.4 Privilege enforcement contract

The structured `privileges` are the **authoritative source** for feature gating. Consuming modules
map as follows (informational, for `admin-dev` and downstream user-side devs):

- `privileges.savingsPlanTypes` ↔ `SavingsPlan.eligibility.minTier` gate.
- `privileges.shareCap` ↔ per-member share purchase cap (interacts with
  `Cooperative.membershipSettings.maxShares` — the **effective cap = min(tier cap, coop cap)**).
- `privileges.equipmentDiscountPercent` / `inputDiscountPercent` ↔ booking/order pricing.
- `privileges.priorityEquipmentBooking` / `dividendPriority` ↔ scheduling/payout ordering.
- `privileges.walletTransferFeeWaived` ↔ wallet transfer fee calculation.

---

## 5. Validation

- `key`: one of the four system keys or a new unique alphanumeric key; system keys immutable.
- `rank`: positive integer, unique.
- `pricing.annualCost`: integer NGN `>= 0` (Bronze free tier allows 0).
- `privileges.shareCap`: integer `>= 0` or `null` (unlimited).
- `privileges.equipmentDiscountPercent` / `inputDiscountPercent`: number `0–100`.
- `privileges.savingsPlanTypes`: subset of `FLEX|TARGET|FIXED|HARVEST`.
- boolean privilege flags required.
- `benefits`: array of non-empty strings.
- `delete`: allowed only when `isSystem === false` and no active subscribers.
- Missing target key → `TIER_ADM_001`.

---

## 6. Audit events

| Action | Trigger | Severity |
|--------|---------|----------|
| `membership_tier.create` | create custom tier | normal |
| `membership_tier.update` | privileges/benefits/display edit | normal |
| `membership_tier.pricing.update` | annual cost change | **high** |
| `membership_tier.activate` / `.deactivate` | tier status | normal |
| `membership_tier.delete` | delete tier | **high** |
| `membership_tier.export` | catalog export | normal |

Each entry records `actor`, `targetType: "membershipTier"`, `targetId: key`, `before`, `after`,
`timestamp`, `ip`, `userAgent`.

---

## 7. Error codes

```json
{ "success": false, "error": { "code": "TIER_ADM_005", "message": "Cannot delete a system tier", "details": { "key": "Gold" } } }
```

| Code | Meaning |
|------|---------|
| `TIER_ADM_001` | Membership tier not found |
| `TIER_ADM_002` | Duplicate `key` or `rank` |
| `TIER_ADM_003` | Invalid tier definition (validation failure) |
| `TIER_ADM_004` | Invalid status transition |
| `TIER_ADM_005` | Cannot delete a system tier |
| `TIER_ADM_006` | Cannot delete — tier has active subscribers |
| `TIER_ADM_007` | Cannot rename `key`/`rank` of a system tier |
| `TIER_ADM_008` | Insufficient permission for action |

---

## 8. Admin UI / Section (premium UX)

Route base `/bennie/membership-tiers`. Rich ops console — no basic UI.

- **Tier cards / comparison table** — the four tiers side-by-side (Bronze→Platinum) with a
  privilege-matrix table (rows = privileges, columns = tiers, check/value cells), annual cost, and
  live subscriber counts. Reorder by `rank`.
- **Tier editor drawer** — sections: Pricing (annual cost, with a "new & renewal only" banner and a
  high-severity confirm modal), Privileges (structured toggles/inputs: savings plan types multiselect,
  share cap, discount %s, priority/fee/adashe flags), Benefits (editable bullet list mirroring the
  member-facing copy), Display (badge colours). System tiers show `key`/`rank` as read-only.
- **Activate/Deactivate** toggle with confirm; deactivation warns that existing subscribers are
  unaffected until renewal.
- **Divergence banner** — an info banner in the section explaining tier vs. `Membership.type`, so
  operators don't confuse the two.
- **Charts** — subscribers per tier (donut), tier revenue (annualCost × subscribers) bar, upgrade
  funnel (Bronze→Silver→Gold→Platinum) if subscription history is available.

---

## 9. Environment variables

Tiers are DB-driven; env vars are bootstrap seed defaults derived from `src/data.ts`:

```bash
MEMBERSHIP_TIERS_SEED=true               # seed the 4 system tiers if collection empty
TIER_BRONZE_ANNUAL_COST=0                # NGN
TIER_SILVER_ANNUAL_COST=15000
TIER_GOLD_ANNUAL_COST=35000
TIER_PLATINUM_ANNUAL_COST=75000
```

---

## 10. Open questions for the owner

1. **Tier vs. `type` reconciliation (primary flag).** Confirm that subscription **tier**
   (Bronze/Silver/Gold/Platinum) and membership **`type`** (REGULAR/ASSOCIATE/SENIOR/LIFETIME) are
   two independent axes as documented in [§4.1](#41-tier-vs-membership-type--the-two-axes), and which
   one gates which privileges. If they should be merged, that is a user-side schema decision.
2. **Where the per-member tier lives.** The frontend keeps `membership.tier`. Confirm the backend
   home for the active subscription — a field on `Membership`, a field on `users`, or a new
   `TierSubscription` collection (needed for renewals/expiry/billing history).
3. **Seed mapping accuracy.** Confirm the structured `privileges` mapping in
   [§2.2](#22-seeding-from-the-frontend-hardcoded-tiers) matches intent (share caps, discount %s,
   which tiers get priority booking / dividend priority / fee waiver / adashe access).
4. **Effective share cap.** Confirm the rule `effective cap = min(tier.shareCap, coop.maxShares)`
   when both are set.
5. **Custom tiers.** Do you want operators to create custom tiers beyond the four, or lock the
   catalog to the seeded set (edit-only)?
6. **Discount stacking.** Do tier discounts stack with promotional/marketplace discounts, or is the
   larger applied? (Affects order/booking pricing in other sections.)
