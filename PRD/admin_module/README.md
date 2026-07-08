# Bennie-connect — Admin Module (Master PRD)

## Overview

The **Admin Module** is the secure **overwatch and controller** of the Bennie-connect Cooperative Farming Portal. It is the operations backplane through which staff supervise every piece of platform data and activity: platform users (farmers/agents), the cooperative's financial operations (wallets, withdrawals, shares, dividends, Adashe payouts, agent commissions), marketplace content and orders, memberships and membership tiers, equipment bookings, agri-services, system configuration, analytics, and the audit trail itself.

It is a **fully independent identity plane** from the end-user app. `adminUsers` is the **sole admin identity plane** — admins do **not** live in the `users` collection and do **not** authenticate through `/api/v1/auth`. They live in a dedicated `adminUsers` collection, sign in through `/api/v1/admin/auth`, carry a distinct JWT scope, and are governed by a granular **role-based access control (RBAC)** model with per-user permission overrides.

> **Admin access does NOT derive from `users`.** A `users` document with `role = admin` or `role = super_admin` grants **no** admin-plane access whatsoever. That user-side enum value is **vestigial** for the admin plane — admin identity and authorization come exclusively from `adminUsers` + `adminRoles`. There is no bridge from `users.role` into the admin plane. (Owner decision — finalized.)

> **Documentation only.** This directory (`PRD/admin_module/`) is the contract for the `admin-dev` agent. It contains no application code. Per the project sequencing rule, admin work begins only after user-side work is resolved.

### Status legend
Throughout the admin PRDs, capabilities are tagged:
- ✅ **implemented** — exists on disk in `backend/src/` and/or `src/`.
- 📄 **planned** — specified here, not yet built.

At the time of writing, **nearly the entire admin module is 📄 planned**. The user-side `users` collection, `user.schema.ts`, SeerBit wallet config, and the user PRDs exist; no `adminUsers`, `adminRoles`, `adminAuditLog`, `/api/v1/admin/*` endpoints, or admin frontend surfaces exist yet.

---

## Role & Access-Control Model (RBAC)

The admin module uses a **two-collection RBAC** model plus optional **per-user overrides**:

1. **`adminRoles`** — named roles, each holding a set of granular permission strings (e.g. `Super Admin`, `Operations Manager`, `Finance Officer`, `Support Agent`). System roles are protected from edit/delete.
2. **`adminUsers`** — the admin/sub-admin accounts. Each references exactly one `role` and may carry `permissionOverrides` that grant or revoke individual permissions on top of the role.
3. **`adminAuditLog`** — an append-only record of every admin mutation.

**Effective permissions** for an admin user are computed as:

```
effective = ( role.permissions ∪ overrides.granted ) \ overrides.revoked
```

A permission string matches if the effective set contains: the exact string, a matching `resource:*` wildcard, or the global `*` wildcard. The **Super Admin** role holds `['*']` and therefore satisfies every check.

> **Relationship to the user-side `role` enum (finalized).** The live `user.schema.ts` defines `role: 'farmer' | 'agent' | 'admin' | 'super_admin'`. That enum governs **end-user** records only. The admin module deliberately does **not** reuse it as its authorization mechanism — admin authorization is driven by the `adminRoles`/`permissionOverrides` model described here, which is far more granular than a 4-value enum. **Owner decision (final):** the `admin` / `super_admin` values on `users` are **vestigial** — they grant **NO** admin-plane access and are not a path into the admin plane. An account cannot become an admin by having `role: 'admin'` on its `users` document. **Admin identity is exclusively the `adminUsers` collection; it is fully independent of the `users` collection.** There is no bridge. Where a spec says "reserve for Super Admin", that maps to the `Super Admin` **adminRole** (permissions `['*']`), not to a `users.role` value.

### Permission taxonomy (`resource:action`)

Permissions are granular strings of the form `resource:action`. Wildcards are `resource:*` (all actions on a resource) and `*` (everything, Super Admin only).

**Resources**

| Resource | Governs |
|----------|---------|
| `users` | Platform users (farmers/agents) — the `users` collection |
| `admins` | Admin/sub-admin accounts (`adminUsers`) |
| `roles` | Admin roles & the permission catalog (`adminRoles`) |
| `cooperatives` | Cooperative records |
| `savings-plans` | Savings products/plans |
| `marketplace` | E-commerce products, categories & listing moderation (LIVE `products`/`productCategories`) |
| `orders` | Marketplace orders (LIVE split-per-seller `orders` — own `/bennie/orders` section) |
| `merchants` | Marketplace merchants — KYC review, suspension, earnings ledger & manual payouts (`merchants`, `merchantEarnings`, `merchantPayoutRequests`) |
| `membership-tiers` | Membership tier definitions |
| `memberships` | Individual member records |
| `equipment` | Equipment inventory & GPS units |
| `adashe-groups` | Adashesu (rotating savings) groups |
| `agent-commission` | Agent commission ledgers & payouts |
| `wallets` | User wallets & balances |
| `transactions` | Wallet/ledger transactions |
| `withdrawals` | Withdrawal/settlement requests |
| `shares` | Cooperative shares (issue/price) |
| `dividends` | Dividend declarations & distributions |
| `services` | Agri-services listings |
| `providers` | Service/vendor providers |
| `settings` | System configuration |
| `dashboard` | Aggregate dashboard & analytics |
| `audit-logs` | The admin audit trail |

**Actions**

`view`, `create`, `update`, `delete`, `approve`, `reject`, `ban`, `suspend`, `activate`, `deactivate`, `verify`, `configure`, `export`, `payout`, `reverse`, `refund`, `mediate`, `impersonate`

Not every action applies to every resource.

> **Every admin endpoint MUST declare its required permission** via `@RequirePermissions('resource:action')`. An endpoint with no declared permission is a spec bug.

### Super-Admin-only permission set (finalized — NOT delegable)

**Owner decision (final):** the following **financial-reversal and destructive** permissions are reserved for the **Super Admin** role only. They are **NOT delegable** to sub-admins via role assignment or per-user overrides — this overrides any earlier "delegable-but-gated" modeling. The `PermissionsGuard` treats these permissions as satisfiable **only** by an effective set containing `*` (the Super Admin wildcard); granting one of them explicitly to a non-Super-Admin role/override has no effect and SHOULD be rejected at role/override-edit time.

| Permission | Section | What it does |
|-----------|---------|--------------|
| `transactions:reverse` | Financial ops | Reverse a wallet/ledger transaction |
| `orders:refund` | Marketplace | Refund a paid order to buyer wallet |
| `equipment:settle-deposit` | Equipment | Damage/deposit adjustment & refund |
| `adashe-contributions:mark-sent` | Adashe | Mark a rotation payout request as sent (funds wired off-platform) |
| `merchants:mark-payout-sent` | Merchants | Mark a merchant payout request as sent (funds wired off-platform — mirror of `adashe-contributions:mark-sent`) |
| `dividends:distribute` | Cooperative / dividends | Distribute a declared dividend to shareholders |
| `commissions:pay-batch` | Agent commission | Batch-pay approved agent commissions |
| `agent-commission:reverse` | Agent commission | Reverse a paid/approved commission |
| `savings-plans:configure` | Savings | Force-close/forfeit accounts; run interest accrual at scale |
| `settings:configure` | System config | Edit sensitive/security settings (secrets, security policy, maintenance) |
| any `*:delete` | all | Destructive delete of any resource (`users:delete`, `roles:delete`, `admins:delete`, etc.) |
| any `*:ban` | all | Ban any entity (`users:ban`, `admins:ban`, `cooperatives:ban`, `adashe-groups:ban`) |
| `users:impersonate` | Users | Impersonate a platform user |

Sub-admins **may** still hold `view`/`create`/`update`/`approve`/`reject`/`suspend`/`activate`/`configure`(non-sensitive) permissions where sensible — the reservation applies **only** to the reversal/destructive set above.

> **Naming note.** Two section PRDs historically used a `:payout` verb (`dividends:payout`, `agent-commission:payout`). The canonical Super-Admin-only names are **`dividends:distribute`** and **`commissions:pay-batch`**; where a section still writes `:payout`, treat it as an alias for the canonical name pending code implementation (flagged per-section).

### Illustrative starter roles (seeded/suggested)

| Role | `isSystem` | Permissions (illustrative) |
|------|-----------|----------------------------|
| **Super Admin** | ✅ | `['*']` |
| **Operations Manager** | 📄 | `users:*`, `memberships:*`, `equipment:*`, `orders:view`, `orders:approve`, `dashboard:view`, `audit-logs:view` |
| **Finance Officer** | 📄 | `wallets:view`, `transactions:view`, `withdrawals:view`, `withdrawals:approve`, `withdrawals:reject`, `dividends:view`, `agent-commission:view`, `shares:view`, `dashboard:view`, `export` scoped per-resource |
| **Support Agent** | 📄 | `users:view`, `users:update`, `orders:view`, `memberships:view`, `dashboard:view` |
| **Content Manager** | 📄 | `marketplace:*`, `services:*`, `providers:*`, `membership-tiers:*`, `savings-plans:view` |

Only the **Super Admin** role is seeded on bootstrap (below). The rest are suggested defaults the owner may create via the roles UI.

> **None of the non-Super-Admin starter roles hold any permission from the [Super-Admin-only set](#super-admin-only-permission-set-finalized--not-delegable).** In particular, a Finance Officer may `approve`/`reject` withdrawals but may **not** `transactions:reverse`, `orders:refund`, `dividends:distribute`, or `commissions:pay-batch` — those remain Super-Admin-only and non-delegable.

---

## Canonical collection names

**The user-module PRD collection names are authoritative.** All admin PRDs reference these exact names; where an admin doc previously used an alternative name, it has been reconciled to this list.

**User-plane (owned by the user module, read/mutated by admin via user services):**
`Wallet`, `Transaction`, `WithdrawalRequest`, `DepositRequest`, `BankAccount`, `SavingsPlan`, `UserSavings`, `SavingsTransaction`, `Share`, `DividendDeclaration`, `Equipment`, `EquipmentBooking`, `ServiceCategory`, `ServiceProvider`, `ServiceListing`, `ServiceBooking`, `Product`, `Order`, `ContributionGroup`, `GroupMember`, `Membership`, `Cooperative`, `MembershipApplication`, `AgentProfile`, `Referral`, `CommissionPayment`.

**Admin-plane (owned by the admin module):**
`adminUsers`, `adminRoles`, `adminAuditLog`, `membershipTiers`, `settings` (plus append-only job/history helpers defined per-section: `adminRefreshTokens`, `interestAccrualRun`, `commissionRateConfig`, `commissionRun`, `productCategories`, `productModeration`, `equipmentRateConfig`, `geofence`, `gpsAlert`, `groupModeration`, `payoutRun`, `settingChangeLog`).

**LIVE Marketplace / Orders / Merchants plane (owner-locked build — canonical schemas in [`PRD/data_structure.md`](../data_structure.md) §11):**
`productCategories` (admin-owned, seeded), `products`, `carts`, `orders` (split per seller, linked by `checkoutGroupId`), `merchants`, `merchantEarnings`, `merchantPayoutRequests`. These **supersede** the draft `Product`/`Order` shapes in `data_structure.md` §7.7.6 and the earlier `certificationType` helper (retired this phase). Section PRDs: [marketplace/marketplace.md](./marketplace/marketplace.md), [admin_orders/orders.md](./admin_orders/orders.md), [merchants/merchants.md](./merchants/merchants.md).

**Frontend `FarmerAppState` → canonical mapping.** The React prototype (`src/types.ts`) uses client-mock names that MAP to the canonical backend collections; they are the same domain concept under a different label:

| Frontend (`FarmerAppState`) | Canonical collection |
|---|---|
| `SharePortfolio` / shareholdings | `Share` |
| `ProductOrder` | `Order` |
| `AgriBooking` | `ServiceBooking` |
| `CommissionReward` | `CommissionPayment` |
| `WalletTransaction` | `Transaction` |
| `AdasheGroup` | `ContributionGroup` |
| `SavingsAccount` | `UserSavings` |

The frontend names are the client mock only; backend and all admin PRDs use the canonical names above.

---

## Identity Schemas

### `adminUsers` collection

```jsonc
{
  "_id": "ObjectId",
  "adminId": "string",           // unique, auto "ADM_<ts>_<rand>"
  "email": "string",             // unique, lowercased, trimmed
  "firstName": "string",
  "lastName": "string",
  "password": "string",          // bcrypt-hashed; redacted from JSON
  "phoneNumber": "string?",
  "role": "ObjectId",            // ref: adminRoles (required)
  "permissionOverrides": {       // optional per-user delta over the role
    "granted": ["string"],       // extra permissions granted to THIS admin
    "revoked": ["string"]        // permissions removed from THIS admin
  },
  "isActive": "boolean",         // default true
  "isBanned": "boolean",         // default false
  "banReason": "string?",
  "bannedAt": "Date?",
  "mustChangePassword": "boolean", // default true on create / seed / admin-reset
  "twoFactorEnabled": "boolean", // default false (2FA-ready, see Security)
  "twoFactorSecret": "string?",  // redacted
  "allowedIps": ["string"],      // optional IP allowlist; empty = allow all
  "lastLoginAt": "Date?",
  "loginHistory": [{ "timestamp": "Date", "ipAddress": "string", "userAgent": "string", "success": "boolean" }],
  "failedLoginAttempts": "number", // default 0; lockout at 5
  "lockoutUntil": "Date?",       // 15-min window
  "passwordChangedAt": "Date?",
  "createdBy": "ObjectId?",      // ref: adminUsers (who provisioned this admin)
  "metadata": "Record<string, any>",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```
Sensitive fields (`password`, `twoFactorSecret`) are stripped by `toJSON()` and never returned.

### `adminRoles` collection

```jsonc
{
  "_id": "ObjectId",
  "name": "string",              // unique (e.g. "Super Admin")
  "description": "string",
  "permissions": ["string"],     // granular resource:action strings, or wildcards
  "isSystem": "boolean",         // default false; true roles cannot be deleted or renamed
  "createdBy": "ObjectId?",      // ref: adminUsers
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### `adminAuditLog` collection (append-only)

```jsonc
{
  "_id": "ObjectId",
  "actorId": "ObjectId",         // ref: adminUsers — who performed the action
  "actorEmail": "string",        // denormalized for immutability
  "action": "string",           // e.g. "user.ban", "withdrawal.approve"
  "permission": "string",        // the resource:action guard that authorized it
  "resource": "string",          // resource name (e.g. "users")
  "targetId": "string?",         // affected entity id (user id, order id, ...)
  "before": "Record<string, any>?", // snapshot before mutation
  "after": "Record<string, any>?",  // snapshot after mutation
  "ipAddress": "string",
  "userAgent": "string",
  "createdAt": "Date"
}
```
Writes are **append-only**: no update/delete endpoints. Only `audit-logs:view` and `audit-logs:export` exist.

---

## Route Map — Frontend `/bennie/*` ↔ Backend `/api/v1/admin/*`

The admin SPA is served under the **`/bennie`** route prefix (distinct from the user app). Each admin frontend section maps to one or more admin API groups.

| Frontend route (`/bennie/...`) | Section | Backend API group (`/api/v1/admin/...`) | Primary permission(s) | PRD |
|---|---|---|---|---|
| `/bennie/auth` | Admin sign-in / change-password | `/auth/*` | (none — pre-auth) | [auth/admin_auth.md](./auth/admin_auth.md) |
| `/bennie/dashboard` | Aggregate KPIs & charts | `/dashboard/*` | `dashboard:view` | [admin_dashboard/admin_dashboard.md](./admin_dashboard/admin_dashboard.md) |
| *(shell — wraps all `/bennie/*`)* | Layout: navbar, sidebar, mobile nav/drawer | *(none — consumes `/auth/me`)* | (per-nav effective perms) | [admin_layout/admin_layout.md](./admin_layout/admin_layout.md) |
| `/bennie/users` | Platform-user management + User 360 | `/users/*` | `users:*` | [users/users.md](./users/users.md) |
| `/bennie/admin` | Sub-admins & roles/permissions | `/admins/*`, `/roles/*` | `admins:*`, `roles:*` | [admins/admins.md](./admins/admins.md) |
| `/bennie/cooperative` | Cooperatives, shares, dividends | `/cooperatives/*`, `/shares/*`, `/dividends/*` | `cooperatives:*`, `shares:*`, `dividends:*` | *(planned)* |
| `/bennie/savings-plans` | Savings products & interest accrual | `/savings-plans/*` | `savings-plans:*` | *(planned)* |
| `/bennie/market-place` | Products, categories, moderation, seller oversight | `/marketplace/*` | `marketplace:*` | [marketplace/marketplace.md](./marketplace/marketplace.md) |
| `/bennie/orders` | Marketplace orders (all sellers) — fulfilment override, cancel, refund | `/orders/*` | `orders:*` | [admin_orders/orders.md](./admin_orders/orders.md) |
| `/bennie/merchants` | Merchant KYC review, suspension, earnings & manual payouts | `/merchants/*` | `merchants:*` | [merchants/merchants.md](./merchants/merchants.md) |
| `/bennie/membership-tiers` | Tier definitions & memberships | `/membership-tiers/*`, `/memberships/*` | `membership-tiers:*`, `memberships:*` | *(planned)* |
| `/bennie/equipment-booking` | Equipment inventory & bookings | `/equipment/*` | `equipment:*` | *(planned)* |
| `/bennie/adashesu-contributions` | Adashe groups & payouts | `/adashe-groups/*` | `adashe-groups:*` | *(planned)* |
| `/bennie/agent-commission` | Commission ledgers & payouts | `/agent-commission/*` | `agent-commission:*` | *(planned)* |
| `/bennie/settings` | System configuration | `/settings/*` | `settings:*` | *(planned)* |
| *(cross-cutting)* | Audit trail viewer | `/audit-logs/*` | `audit-logs:view` | [admins/admins.md](./admins/admins.md) *(shared)* |

> **Wallets, transactions, withdrawals, services, providers** are surfaced within the relevant sections above (e.g. wallets/transactions under user detail and finance views); they are separate API groups with their own permissions but do not need a dedicated top-level `/bennie` route.

---

## Super-Admin Seeding (bootstrap)

On server bootstrap, an **idempotent** seeder runs:

1. If **no** document exists in `adminRoles` with `name === "Super Admin"`, create it: `{ name: "Super Admin", description: "Full unrestricted access", permissions: ["*"], isSystem: true }`.
2. If **no** document exists in `adminUsers`, create the bootstrap super admin:
   - `email: "superadmin@bennieconnect.com"`
   - `password:` **bcrypt hash** of `Bennie-2026` (the raw password is hashed at rest; the plaintext is never stored)
   - `role:` the Super Admin role's `_id`
   - `mustChangePassword: true` (forces a password reset on first login before any other admin action succeeds)
   - `isActive: true`
3. Re-running the seeder is a no-op when either already exists (idempotent).

> ⚠️ **Security note.** The bootstrap credentials are a **first-login** convenience only. The password `Bennie-2026` is stored **bcrypt-hashed at rest** — never in plaintext. `mustChangePassword: true` forces a password change before any other admin action succeeds. The default credentials MUST be rotated in production and never committed to real environments beyond this seeder default.

---

## Configuration single-source-of-truth (SSOT)

**Owner decision (final):**

- The **`settings`** collection owns platform-wide **fees, rates, tax, and limits** (payment/SeerBit thresholds, wallet limits & withdrawal fee tiers, marketplace/services/equipment fees, savings APY defaults, commission & WHT defaults, KYC toggles, security policy, feature flags, maintenance). Every other module **reads** these values at runtime from `settings` rather than from env vars (env vars are bootstrap seeds only). See [settings/settings.md](./settings/settings.md).
- The **`membershipTiers`** collection owns **tier pricing + privileges** (Bronze/Silver/Gold/Platinum annual cost, discounts, share caps, priority flags). This is authoritative — **not** `settings.membership.pricing`, which is retired as an authoritative source (kept only as a convenience mirror if present). See [membership_tiers/membership_tiers.md](./membership_tiers/membership_tiers.md).

Full field-level schemas for all collections live in [`PRD/data_structure.md`](../data_structure.md) §7 and are the schema cross-reference for this module.

---

## Adopted domain schema extensions (finalized)

**Owner decision (final):** the following additive schema extensions are **adopted** (no longer open questions). Field-level definitions are in [`PRD/data_structure.md`](../data_structure.md) §7; the affected section PRDs document them as adopted design in their schema/business-rules sections.

- **`Cooperative`** — status enum gains `PENDING | REJECTED | BANNED` (on top of `ACTIVE | INACTIVE | SUSPENDED`); adds `approvedBy`, `approvedAt`, `rejectionReason`, `banReason`, `bannedAt`.
- **`Product`** — adds `moderationStatus` (`PENDING | APPROVED | REJECTED | CHANGES_REQUESTED`), `moderatedBy`, `moderatedAt`, and `suspended` (delist flag).
- **`Order`** — `paymentStatus` gains `PARTIALLY_REFUNDED`.
- **`Equipment` / `EquipmentBooking`** — a **damage-over-deposit recovery path** is adopted: when damage cost exceeds the deposit, the excess is recorded as an outstanding charge/collections record rather than written off.
- **`users`** — adds `isBanned` (+ `banReason`, `bannedAt`); a first-class `kyc` sub-document (`status`, `documents[]`, `verifiedAt`, `verifiedBy`); and **soft-delete** (`isDeleted`, `deletedAt`, `deletedBy`).

---

## Shared Admin Infrastructure

Capabilities used across many admin sections (each detailed in its own section PRD, cross-linked here):

- **Approval queues.** A common queue pattern for anything requiring admin sign-off: KYC verification, withdrawals/settlements, membership applications, dividend/commission payouts, dispute resolutions. Each queue item carries `status: PENDING | APPROVED | REJECTED`, an actor, timestamps, and an audit entry on every transition. `approve`/`reject` actions require the resource-specific permission.
- **Batch / cron jobs.** Scheduled operations with admin controls to run-now, pause, and view run history:
  - **Interest accrual** on savings plans (`savings-plans:configure`, Super-Admin-only for at-scale runs).
  - **Dividend distribution** across shareholders (`dividends:distribute`, **Super-Admin-only, non-delegable**).
  - **Adashe payouts** — manual, off-platform: mark a rotation payout request as sent (`adashe-contributions:mark-sent`, **Super-Admin-only, non-delegable**); the recipient then confirms receipt.
  - **Commission calculation** for agents (`agent-commission:configure`); **batch payout** (`commissions:pay-batch`, **Super-Admin-only, non-delegable**).
  Every automated run writes to `adminAuditLog` with `actorEmail: "system"` and the triggering job name.
- **Dispute mediation.** Marketplace/service disputes routed to admins with `orders:mediate` / `services:mediate`; resolution actions (refund, release, cancel) are audit-logged.
- **KYC verification.** Review of user identity documents; `users:verify` transitions KYC state. See [users/users.md](./users/users.md).
- **User 360.** A cross-module read-only aggregate for a single user — wallet, memberships, savings, bookings, orders, agent profile, Adashe, referrals — assembled server-side for support/investigation. Requires `users:view`. See [users/users.md](./users/users.md).
- **Reporting / export.** CSV and PDF export on list/report endpoints, gated by a per-resource `export` permission (e.g. `users:export`, `transactions:export`). Exports are themselves audit-logged (they read PII/financial data).

---

## Security Requirements

- **Separate JWT scope.** Admin access tokens carry a `scope: "admin"` (and `type`/`sub` = `adminUsers._id`). The user `JwtAuthGuard` MUST reject admin tokens and vice-versa; admin routes use `AdminJwtGuard` + `PermissionsGuard`.
- **RBAC guard on every route.** `@RequirePermissions('resource:action')` + `PermissionsGuard` resolve effective permissions (role ∪ granted \ revoked) and enforce wildcards. Missing/insufficient permission → `403 ADMIN_AUTH_006`.
- **Super-Admin-only reservation is enforced in the guard.** The [Super-Admin-only permission set](#super-admin-only-permission-set-finalized--not-delegable) is satisfiable **only** by an effective set containing `*`. These permissions are **non-delegable**: they cannot be granted to a non-Super-Admin role or via per-user override, and any attempt to do so is rejected at role/override-edit time.
- **Account lockout + rate limiting.** 5 failed logins → 15-minute lockout; login endpoint throttled per-IP.
- **`mustChangePassword` gate.** While `true`, all admin endpoints except `/auth/me`, `/auth/change-password`, and `/auth/logout` return `403 ADMIN_AUTH_007` forcing a password change.
- **2FA-ready.** `twoFactorEnabled` / `twoFactorSecret` are modeled now (TOTP). When enabled, login requires a second factor before tokens are issued. Rollout is 📄 planned; the schema is present so it can be switched on without migration.
- **IP allowlisting (optional).** Per-admin `allowedIps`; when non-empty, login and requests from other IPs are rejected (`ADMIN_AUTH_008`). Empty = allow all.
- **Session management.** Refresh tokens are tracked and revocable; ban/deactivate revokes all of an admin's sessions immediately.
- **Every mutation is audited.** No admin write path may skip `adminAuditLog`.
- **PII / compliance.** User data handled here falls under NDPR (Nigeria Data Protection Regulation) and, for EU data subjects, GDPR; financial data handling should follow PCI-DSS scope-reduction principles (never store raw card/bank secrets in `adminUsers`/audit `before`/`after`). Section PRDs cite specific requirements where relevant.

---

## Section Index

| # | Section | File | Status |
|---|---------|------|--------|
| 1 | Admin Authentication (sign-in only) | [auth/admin_auth.md](./auth/admin_auth.md) | 📄 |
| 2 | Sub-admins & Roles/Permissions | [admins/admins.md](./admins/admins.md) | 📄 |
| 3 | Platform-User Management (User 360, KYC, impersonate) | [users/users.md](./users/users.md) | 📄 |
| 4 | Financial Operations & Settlements | *(planned — separate pass)* | 📄 |
| 5 | Content Management (marketplace/services/providers) | *(planned — separate pass)* | 📄 |
| 5a | Marketplace — products, categories, moderation, sellers (LIVE build) | [marketplace/marketplace.md](./marketplace/marketplace.md) | 📄 |
| 5b | Orders — split-per-seller orders, fulfilment override, cancel, refund (LIVE build) | [admin_orders/orders.md](./admin_orders/orders.md) | 📄 |
| 5c | Merchants — KYC (Prembly + private bucket), suspension, earnings, manual payouts (LIVE build) | [merchants/merchants.md](./merchants/merchants.md) | 📄 |
| 6 | System Configuration | *(planned — separate pass)* | 📄 |
| 7 | Analytics & Reporting / Dashboard | *(planned — separate pass)* | 📄 |
| 8 | Audit & Compliance | *(planned — audit schema defined here & in admins.md)* | 📄 |

> This pass authors sections **1–3** plus this README. Sections 4–8 are owned by later passes and reference the schemas, RBAC model, and conventions established here.

---

## Resolved Decisions (finalized by the owner)

1. **Admin identity vs. `users.role` — RESOLVED.** `admin` / `super_admin` on `users` are **vestigial** and grant **no** admin-plane access. Admin identity is exclusively `adminUsers`, fully independent of `users`. No bridge.
2. **Seed domain — RESOLVED.** The seed super-admin email is **`superadmin@bennieconnect.com`** (double "n-i-e" = "bennie"). Password `Bennie-2026`, bcrypt-hashed at rest, `mustChangePassword: true`.
3. **Financial-reversal reservation — RESOLVED.** The [Super-Admin-only permission set](#super-admin-only-permission-set-finalized--not-delegable) (`transactions:reverse`, `orders:refund`, `equipment:settle-deposit`, `adashe-contributions:mark-sent`, `dividends:distribute`, `commissions:pay-batch`, `agent-commission:reverse`, `savings-plans:configure`, `settings:configure`, any `*:delete`, any `*:ban`, `users:impersonate`) is **Super-Admin-only and NOT delegable**. A dedicated Finance role may hold `approve`/`reject` but never any reversal/destructive permission.
4. **Config SSOT — RESOLVED.** `settings` owns fees/rates/tax/limits; `membershipTiers` owns tier pricing + privileges (not `settings.membership.pricing`).
5. **Domain schema extensions — RESOLVED (adopted).** See [Adopted domain schema extensions](#adopted-domain-schema-extensions-finalized).

## Remaining Open Questions for the Owner

1. **2FA rollout timing.** Modeled now; confirm whether 2FA is mandatory for Super Admin at launch or deferred.
2. **IP allowlist enforcement scope.** Applies per-admin on login and per-request — confirm whether it should also be enforceable org-wide via `settings`.
3. **Multi-tenant admin scoping.** Whether `adminRoles` should carry a cooperative scope (per-co-op ops managers) or the admin plane stays global (cross-cuts cooperative & equipment sections).
