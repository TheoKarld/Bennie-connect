# Admin PRD: Cooperative Management

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no admin cooperative code exists yet)
>
> Live blueprint for `admin-dev` governing admin operations over the `Cooperative` collection —
> registration, approval workflow, leadership, membership settings (fees, share price, share
> caps, probation, guarantor rules), lifecycle status, and per-cooperative member overview.
> User-side spec: [`PRD/user_module/membership/membership-management.md`](../../user_module/membership/membership-management.md).

---

## 1. Overview

The admin cooperative surface lets operations staff and finance officers manage the platform's
**cooperative societies**: onboard/register a new cooperative, run the **approval workflow**
(pending → approve/reject), maintain leadership (chairman/secretary/treasurer), configure the
per-cooperative **membership settings** that drive downstream membership, shares, savings and
dividend behaviour, control **lifecycle status** (`ACTIVE`/`INACTIVE`/`SUSPENDED`), **ban** a
cooperative, and inspect the **member roster** and roll-up counts for each cooperative.

A cooperative is a top-level tenant-like entity: many downstream records (`Membership`,
`membershipTiers` eligibility, `SavingsPlan` scoping, shares & dividends) reference a
`cooperativeId`. Editing membership settings therefore has broad blast radius and is treated as a
high-severity, audited change.

**Conventions (shared — see [`PRD/admin_module/README.md`](../README.md) for the authoritative RBAC taxonomy):**

- Backend `/api/v1/admin/*`; admin frontend `/bennie/*` (this section: `/bennie/cooperative`).
- Admin identity = **`adminUsers`**; authz = **`adminRoles`** (`resource:action`) + per-admin
  overrides; **Super Admin = `*`**. **Every endpoint declares its required permission**, enforced by
  `PermissionsGuard` over the admin JWT guard.
- **Every mutation writes an `adminAuditLog`** entry (`actor`, `action`, `target`, `before/after`,
  `timestamp`, `ip`, `userAgent`).
- Money is whole **NGN**.
- Resource permission namespace: **`cooperatives:*`**. Destructive actions (`cooperatives:delete`,
  `cooperatives:ban`) are **Super-Admin-only and NOT delegable** per the
  [README Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable)
  (any `*:delete` / any `*:ban`).
- The user PRD already sketches `GET/POST /api/v1/admin/cooperatives` and
  `PUT /api/v1/admin/cooperatives/:id`; this doc consolidates and completes them (approval, status,
  ban, leadership, settings, members overview).

---

## 2. Collections / Schema

Reads/mutates the user-side `Cooperative` collection (canonical name **`Cooperative`**; defined in the
user PRD; re-stated here with the admin-added fields the approval workflow requires). The fields marked
**📄 admin-added** are now **adopted design** (owner-approved — see
[README → Adopted domain schema extensions](../README.md#adopted-domain-schema-extensions-finalized)):
the `Cooperative.status` enum is extended from `ACTIVE | INACTIVE | SUSPENDED` to also include
`PENDING | REJECTED | BANNED`, plus `approvedBy`/`approvedAt`/`rejectionReason`/`banReason`/`bannedAt`.
Field-level definitions live in [`PRD/data_structure.md`](../../data_structure.md) §7.

### 2.1 `Cooperative` (shared collection; admin-managed)

```typescript
{
  _id: ObjectId;
  name: string;
  code: string;                       // unique (e.g. "KNRICE-001")
  description: string;
  type: 'MULTI_PURPOSE' | 'CREDIT' | 'AGRICULTURAL' | 'CONSUMER';

  // ADOPTED: approval + ban states beyond the original user-PRD enum
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'REJECTED' | 'BANNED';
  rejectionReason?: string;           // set on REJECTED
  banReason?: string;                 // set on BANNED
  bannedAt?: Date;
  suspendedReason?: string;
  approvedBy?: ObjectId;              // ref adminUsers
  approvedAt?: Date;

  registrationNumber: string;         // CAC / cooperative registry number
  registeredDate: Date;
  address: {
    street: string; city: string; state: string; country: string;
    postalCode: string; coordinates?: { lat: number; lng: number };
  };
  contactInfo: { email: string; phone: string; website?: string };

  leadership: {
    chairman?: ObjectId;              // ref User
    secretary?: ObjectId;             // ref User
    treasurer?: ObjectId;             // ref User
  };

  membershipSettings: {
    minAge: number;
    maxAge?: number;
    registrationFee: number;          // NGN, one-time on approval
    annualDue: number;                // NGN, per anniversary
    sharePrice: number;               // NGN per share
    minShares: number;                // shares required for membership
    maxShares?: number;               // per-member cap (optional)
    probationPeriodDays: number;
    requiresGuarantor: boolean;
    guarantorCount: number;
  };

  totalMembers: number;               // denormalized roll-up
  activeMembers: number;              // denormalized roll-up
  logo?: string;
  metadata?: Record<string, any>;
  createdBy?: ObjectId;               // 📄 ref adminUsers (admin who created it)
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Existing schema relied upon

- `Membership.cooperativeId` — links members to a cooperative (see membership user PRD). The member
  overview endpoint ([§3.5](#35-members-overview-per-cooperative)) reads `Membership` filtered by
  `cooperativeId`.
- `Membership.status`: `PENDING | PROBATION | ACTIVE | SUSPENDED | TERMINATED | RESIGNED` — drives
  the `activeMembers` roll-up.
- `Cooperative.membershipSettings.sharePrice` / `minShares` / `maxShares` — consumed by the shares &
  dividends admin section (separate pass) and by membership issuance.

---

## 3. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission.

### 3.1 Cooperative CRUD (`cooperatives:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/cooperatives` | `cooperatives:view` | List/search cooperatives (filters below) |
| GET | `/cooperatives/:id` | `cooperatives:view` | Cooperative detail (settings, leadership, roll-ups) |
| POST | `/cooperatives` | `cooperatives:create` | Register a new cooperative (starts `PENDING`) |
| PATCH | `/cooperatives/:id` | `cooperatives:update` | Update profile / membership settings / leadership |
| DELETE | `/cooperatives/:id` | `cooperatives:delete` | Delete (soft) — blocked if it has any members (**Super-Admin-only, non-delegable**) |

**GET `/cooperatives` query params:** `page`, `limit`, `q` (name/code/registrationNumber),
`type`, `status`, `state`, `sortBy` (`createdAt|totalMembers|activeMembers|name`), `order`.

**POST `/cooperatives` — request:**
```json
{
  "name": "Kano Rice Growers Cooperative",
  "code": "KNRICE-001",
  "description": "Multi-purpose rice cooperative in Kano State",
  "type": "AGRICULTURAL",
  "registrationNumber": "RC-2039182",
  "registeredDate": "2026-01-10",
  "address": { "street": "12 Maiduguri Rd", "city": "Kano", "state": "Kano", "country": "NG", "postalCode": "700001" },
  "contactInfo": { "email": "info@knrice.coop", "phone": "+2348031221199" },
  "membershipSettings": {
    "minAge": 18, "registrationFee": 5000, "annualDue": 15000,
    "sharePrice": 500, "minShares": 20, "maxShares": 2000,
    "probationPeriodDays": 90, "requiresGuarantor": true, "guarantorCount": 2
  }
}
```
**Response 201:**
```json
{ "success": true, "data": { "id": "coop_1", "code": "KNRICE-001", "status": "PENDING" } }
```

### 3.2 Approval workflow (`cooperatives:approve` / `cooperatives:reject`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/cooperatives/pending` | `cooperatives:view` | Approval queue (status `PENDING`) |
| POST | `/cooperatives/:id/approve` | `cooperatives:approve` | Approve a `PENDING` cooperative → `ACTIVE` |
| POST | `/cooperatives/:id/reject` | `cooperatives:reject` | Reject a `PENDING` cooperative → `REJECTED` (reason required) |

**POST `/cooperatives/:id/approve` — request:**
```json
{ "notes": "CAC registration verified; leadership confirmed" }
```
**Response 200:**
```json
{ "success": true, "data": { "id": "coop_1", "status": "ACTIVE", "approvedBy": "adm_3", "approvedAt": "2026-07-01T10:00:00Z" } }
```

**POST `/cooperatives/:id/reject` — request:**
```json
{ "reason": "Registration number could not be verified with the cooperative registry" }
```

### 3.3 Lifecycle status & ban (`cooperatives:activate` / `deactivate` / `suspend` / `ban`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/cooperatives/:id/activate` | `cooperatives:activate` | `INACTIVE`/`SUSPENDED` → `ACTIVE` |
| POST | `/cooperatives/:id/deactivate` | `cooperatives:deactivate` | `ACTIVE` → `INACTIVE` (reason) |
| POST | `/cooperatives/:id/suspend` | `cooperatives:suspend` | `ACTIVE` → `SUSPENDED` (reason) |
| POST | `/cooperatives/:id/ban` | `cooperatives:ban` | Any → `BANNED` (**Super-Admin-only, non-delegable**; reason required) |

`ban` is terminal-ish and high-severity: it freezes onboarding of new members and blocks
member-facing operations scoped to the cooperative. Unbanning requires Super Admin `activate` after
review.

**POST `/cooperatives/:id/suspend` — request:**
```json
{ "reason": "Under regulatory review — dues remittance discrepancy" }
```

### 3.4 Leadership & settings (`cooperatives:update`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| PATCH | `/cooperatives/:id/leadership` | `cooperatives:update` | Set/replace chairman/secretary/treasurer |
| PATCH | `/cooperatives/:id/membership-settings` | `cooperatives:configure` | Update fees / share price / caps / probation / guarantor rules |

`membership-settings` uses the higher-intent `cooperatives:configure` permission (not plain
`update`) because it changes financial parameters (see [§4.3](#43-membership-settings-blast-radius)).

**PATCH `/cooperatives/:id/leadership` — request:**
```json
{ "chairman": "usr_1201", "secretary": "usr_1244", "treasurer": "usr_1310" }
```
Each referenced user MUST be an `ACTIVE` member of this cooperative (else `COOP_ADM_007`).

**PATCH `/cooperatives/:id/membership-settings` — request:**
```json
{ "sharePrice": 550, "minShares": 25, "maxShares": 2500, "annualDue": 18000, "probationPeriodDays": 60 }
```

### 3.5 Members overview per cooperative (`cooperatives:view` + `memberships:view`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/cooperatives/:id/members` | `cooperatives:view` | Member roster for the cooperative (filters below) |
| GET | `/cooperatives/:id/stats` | `cooperatives:view` | Roll-up: members by status/type, shares, dues outstanding |

**GET `/cooperatives/:id/members` query params:** `page`, `limit`, `status`, `type`, `q`
(member name / membershipNumber), `sortBy` (`joinedAt|sharesOwned`), `order`.

**GET `/cooperatives/:id/stats` — response 200:**
```json
{ "success": true, "data": {
  "totalMembers": 214, "activeMembers": 190,
  "byStatus": { "ACTIVE": 190, "PROBATION": 12, "SUSPENDED": 6, "TERMINATED": 4, "RESIGNED": 2 },
  "byType": { "REGULAR": 180, "ASSOCIATE": 20, "SENIOR": 10, "LIFETIME": 4 },
  "totalSharesOwned": 41200, "outstandingDuesNgn": 480000
} }
```

### 3.6 Export (`cooperatives:export`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/cooperatives/export` | `cooperatives:export` | CSV of cooperatives (respects list filters) |
| GET | `/cooperatives/:id/members/export` | `cooperatives:export` | CSV of a cooperative's member roster (PII — audited) |

---

## 4. Business rules & state machines

### 4.1 Cooperative lifecycle state machine

```
                    ┌──────────────── reject ───────────────► REJECTED (terminal)
                    │
   (create) ──► PENDING ──approve──► ACTIVE ⇄ INACTIVE
                                       │  ▲        ▲
                              suspend  │  │activate│ activate
                                       ▼  │        │
                                    SUSPENDED ─────┘
                                       │
                       ban (any state) ▼
                                     BANNED ──(Super Admin activate after review)──► ACTIVE
```

- `PENDING` is the only state from which `approve`/`reject` are valid.
- `deactivate` (`ACTIVE`→`INACTIVE`) is a soft pause (no new members, existing members read-only);
  `suspend` is punitive and carries a reason; `ban` is Super-Admin-only.
- A cooperative must be `ACTIVE` for members to be onboarded or membership settings to take effect
  on new applications.

### 4.2 Approval preconditions

Approval requires: non-empty `registrationNumber`, valid `contactInfo.email`/`phone`, and complete
`membershipSettings` (all required numeric fields present and valid). Missing data → `COOP_ADM_005`
with `details.missingFields`.

### 4.3 Membership-settings blast radius

- `sharePrice`, `minShares`, `maxShares`, `registrationFee`, `annualDue`, `probationPeriodDays`,
  `requiresGuarantor`, `guarantorCount` changes apply to **new applications and next renewals only**;
  existing `Membership` records keep their captured dues/share terms until renewal. This is a
  deliberate no-retroactive-repricing rule (mirrors equipment rate config).
- Reducing `maxShares` below some members' current `sharesOwned` does **not** claw back shares; it
  only caps future purchases — surfaced as a warning in the UI.

### 4.4 Delete / ban guards

- `DELETE /cooperatives/:id` is a **soft delete** and is **blocked** if any `Membership` references
  the cooperative (`COOP_ADM_006`). Deactivate or ban instead.
- `ban` freezes the cooperative but preserves all data for audit/compliance.

---

## 5. Validation

- `code`, `registrationNumber`: required, unique; `code` uppercase-alphanumeric with hyphens.
- `type`, `status`: must be within their enums.
- `membershipSettings`: `registrationFee`, `annualDue`, `sharePrice` integer NGN `>= 0`;
  `minShares >= 0`; `maxShares` (if present) `>= minShares`; `probationPeriodDays` `>= 0`;
  `guarantorCount >= 0` and `> 0` when `requiresGuarantor = true`; `minAge >= 16`, `maxAge` (if set)
  `> minAge`.
- `contactInfo.email`: valid email; `phone`: E.164.
- `leadership.*` refs must be ObjectIds of `ACTIVE` members of the cooperative.
- `reject`/`suspend`/`deactivate`/`ban` require a non-empty `reason`.
- All `:id` params validated as ObjectId; missing target → `COOP_ADM_001`.

---

## 6. Audit events

| Action | Trigger | Severity |
|--------|---------|----------|
| `cooperative.create` | register new cooperative | normal |
| `cooperative.update` | profile/leadership edit | normal |
| `cooperative.approve` / `.reject` | approval workflow | normal |
| `cooperative.activate` / `.deactivate` / `.suspend` | lifecycle change | normal |
| `cooperative.ban` | ban cooperative | **high** |
| `cooperative.membership_settings.update` | financial settings change | **high** |
| `cooperative.delete` | soft delete | **high** |
| `cooperative.members.export` | member roster export (PII) | **high** |

Each entry records `actor`, `targetType: "cooperative"`, `targetId`, `before`, `after`, `reason?`,
`timestamp`, `ip`, `userAgent`.

---

## 7. Error codes

```json
{ "success": false, "error": { "code": "COOP_ADM_005", "message": "Cooperative not ready for approval", "details": { "missingFields": ["membershipSettings.sharePrice"] } } }
```

| Code | Meaning |
|------|---------|
| `COOP_ADM_001` | Cooperative not found |
| `COOP_ADM_002` | Duplicate `code` or `registrationNumber` |
| `COOP_ADM_003` | Invalid status transition |
| `COOP_ADM_004` | Invalid membership settings (validation failure) |
| `COOP_ADM_005` | Not ready for approval (missing required data) |
| `COOP_ADM_006` | Cannot delete — cooperative has members |
| `COOP_ADM_007` | Leadership ref is not an active member of this cooperative |
| `COOP_ADM_008` | Reason required for this action |
| `COOP_ADM_009` | Cooperative is BANNED — operation blocked |
| `COOP_ADM_010` | Insufficient permission for action |

---

## 8. Admin UI / Section (premium UX)

Route base `/bennie/cooperative`. Rich ops console — no basic UI.

- **Cooperatives table** — pagination, search (name/code/reg number), filters (type, status, state).
  Status chips (Pending/Active/Inactive/Suspended/Rejected/Banned), member-count and active-member
  columns, quick actions (view, approve/reject when pending, suspend/ban with confirm modal).
- **Approval queue** — dedicated view of `PENDING` cooperatives with a review panel (registration
  details, uploaded documents if any, leadership), Approve / Reject actions; Reject opens a
  reason-required modal.
- **Cooperative detail drawer/page** — tabs:
  - *Overview* — profile, status, registration, contact, roll-up KPIs (total/active members, total
    shares, outstanding dues) with small charts.
  - *Leadership* — chairman/secretary/treasurer cards with member picker (search active members).
  - *Membership settings* — form for fees/share price/caps/probation/guarantor rules with a
    "applies to new applications & renewals only" banner and a warning when reducing `maxShares`
    below existing holdings. Confirm modal (high-severity).
  - *Members* — embedded member roster table (filters by status/type, search), row → link to User
    360 / membership detail.
  - *Activity* — audit trail filtered to this cooperative.
- **Confirm modals** for suspend/ban/delete, each requiring a typed reason; ban button hidden for
  admins lacking `cooperatives:ban`.
- **Charts** — membership growth over time, members-by-status donut, dues-outstanding trend.

---

## 9. Environment variables

Cooperative parameters are DB-driven per `Cooperative.membershipSettings`; env vars are bootstrap
defaults for newly created cooperatives:

```bash
COOP_CODE_PREFIX=COOP
DEFAULT_PROBATION_DAYS=90            # seeds membershipSettings.probationPeriodDays
DEFAULT_REGISTRATION_FEE=5000       # NGN
DEFAULT_ANNUAL_DUE=15000            # NGN
DEFAULT_SHARE_PRICE=500             # NGN
DEFAULT_MIN_SHARES=20
DEFAULT_REQUIRES_GUARANTOR=true
DEFAULT_GUARANTOR_COUNT=2
```

---

## 10. Open questions for the owner

1. **Status enum divergence — RESOLVED (adopted).** The extended `Cooperative.status`
   (`PENDING | REJECTED | BANNED` on top of `ACTIVE | INACTIVE | SUSPENDED`) plus
   `approvedBy`/`approvedAt`/`rejectionReason`/`banReason`/`bannedAt` is **owner-approved adopted
   design** (see [README](../README.md#adopted-domain-schema-extensions-finalized) and
   [`data_structure.md`](../../data_structure.md) §7). Approval state lives on the `Cooperative`
   document itself (no separate `CooperativeApplication` collection).
2. **Delete semantics.** Confirm soft-delete-blocked-if-members (this doc) vs. hard delete never
   allowed. Recommendation: never hard delete; ban instead for compliance/audit retention.
3. **Multi-tenant scoping.** Should `adminRoles` carry a cooperative scope so an ops manager only
   sees their assigned cooperatives, or is the admin plane global? (Cross-cuts equipment PRD Q3.)
4. **Leadership eligibility.** This doc requires leadership refs to be active members. Confirm
   whether leadership can be a non-member platform user (e.g. an appointed secretary).
5. **Repricing policy.** Confirm no-retroactive-repricing on membership-settings changes (existing
   members keep captured terms until renewal).
