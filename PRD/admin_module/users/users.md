# Admin Module — Platform-User Management (User 360, KYC, Impersonation)

> Part of the [Admin Module](../README.md). RBAC model, permission taxonomy, and audit schema are defined in the master README.

## Overview

This section lets admins supervise the **platform-user population** — the farmers and agents in the live **`users`** collection (`backend/src/users/schemas/user.schema.ts`). It is **not** about admin accounts (those live in `adminUsers`; see [admins/admins.md](../admins/admins.md)).

Capabilities: list/search users with rich filters; a cross-module **User 360** detail; edit profile fields; **suspend/ban**; soft-delete; **KYC verification**; trigger a password reset; and audit-logged **impersonation** for support.

All endpoints are under `/api/v1/admin/users/*` and require the relevant `users:*` permission.

Status: 📄 **planned**.

> **Grounding note.** Every user field referenced here maps to the **implemented** `user.schema.ts`. The concepts the live schema did not originally model — a first-class `kyc` sub-document, a dedicated `isBanned` flag, and soft-delete (`isDeleted`/`deletedAt`/`deletedBy`) — are now **adopted design** (owner-approved; see [README → Adopted domain schema extensions](../README.md#adopted-domain-schema-extensions-finalized)). They are documented below as the target shape for `user-dev` to add to `user.schema.ts`; field-level definitions live in [`PRD/data_structure.md`](../../data_structure.md) §7.

---

## User Fields (from live `user.schema.ts`)

Read/managed fields (sensitive fields — `password`, `resetPasswordToken`, `emailVerificationToken`, `twoFactorSecret`, `backupCodes` — are stripped by `User.toJSON()` and never returned):

`userId, email, firstName, lastName, phoneNumber, role ('farmer'|'agent'|'admin'|'super_admin'), authProvider ('local'|'google'), googleId, isEmailVerified, isPhoneVerified, isActive, isSuspended, suspensionReason, suspendedAt, profileImageUrl, address, state, lga, farmName, farmSize, farmSizeUnit, cropsOfInterest[], livestockOfInterest[], wallet (ref), memberships[] (ref), shareholdings[] (ref), contributionGroups[] (ref), referralCode, referredBy (ref), referrals[] (ref), commissions[] (ref), totalEarnings, loyaltyPoints, permissions[], loginHistory[], lastLoginAt, passwordChangedAt, failedLoginAttempts, lockoutUntil, twoFactorEnabled, metadata, createdAt, updatedAt`.

### Status model (adopted design)
The live schema expresses base account status via **boolean flags** (`isActive`, `isSuspended`, `suspensionReason`, `suspendedAt`). **Adopted (owner-approved):** `users` gains a **dedicated `isBanned` flag** (plus `banReason`, `bannedAt`) so that a **ban** is a distinct, first-class state — no longer overloaded onto suspension. Suspension (`isSuspended`) remains a reversible operational hold; a ban (`isBanned`) is an indefinite, higher-severity block. `user-dev` adds these fields to `user.schema.ts`; see [`PRD/data_structure.md`](../../data_structure.md) §7.

### KYC model (adopted design)
**Adopted (owner-approved):** `users` gains a first-class **`kyc` sub-document** (`isPhoneVerified`/`isEmailVerified` remain contact verification, distinct from identity KYC). `user-dev` adds this to `user.schema.ts`; field-level shape in [`PRD/data_structure.md`](../../data_structure.md) §7. Target shape:
```jsonc
"kyc": {
  "status": "NOT_SUBMITTED | PENDING | VERIFIED | REJECTED",
  "documents": [{ "type": "NIN|BVN|VOTERS_CARD|DRIVERS_LICENSE|PASSPORT|UTILITY_BILL",
                  "url": "string", "status": "PENDING|APPROVED|REJECTED",
                  "uploadedAt": "Date", "reviewedBy": "ObjectId?", "reviewedAt": "Date?", "rejectionReason": "string?" }],
  "verifiedAt": "Date?", "verifiedBy": "ObjectId?"
}
```
The `users:verify` action operates on this structure (now adopted, not planned). **Compliance context:** identity verification supports Nigerian KYC/AML obligations (CBN AML/CFT), and PII handling here is subject to the **Nigeria Data Protection Regulation (NDPR)** and, for EU data subjects, **GDPR** — access is permission-gated and audited, exports are logged, and rejection reasons must avoid storing raw document numbers in the audit `before`/`after`.

---

## Endpoints (`/api/v1/admin/users`)

### GET /api/v1/admin/users
**Required permission:** `users:view`
**Description:** Paginated, filterable, searchable list of platform users.
**Query:** `page, limit, search (name/email/phone/userId), role, isActive, isSuspended, kycStatus, cooperativeId, state, lga, referredBy, sortBy, sortOrder`
**Response:** 200 OK
```json
{ "success": true,
  "data": { "items": [ { "userId": "USR_...", "email": "j@x.com", "firstName": "John", "lastName": "Doe",
                         "role": "farmer", "isActive": true, "isSuspended": false, "kycStatus": "PENDING",
                         "state": "Lagos", "createdAt": "2026-01-10T..." } ],
            "total": 5231, "page": 1, "limit": 25 } }
```

### GET /api/v1/admin/users/export
**Required permission:** `users:export`
**Description:** Export the filtered user set as CSV or PDF (same filters as list + `format`). Audit-logged (`action: "user.export"`) as a PII egress; export excludes sensitive/secret fields.
**Response:** 200 OK — file stream.

### GET /api/v1/admin/users/:id
**Required permission:** `users:view`
**Description:** Safe single-user record (`User.toJSON()` shape) with populated summary refs.
**Response:** 200 OK.

### GET /api/v1/admin/users/:id/360
**Required permission:** `users:view`
**Description:** **User 360** — a cross-module read-only aggregate assembled server-side for support/investigation. Joins the user with data owned by other modules (via their services, not direct schema coupling):
```json
{
  "success": true,
  "data": {
    "profile": { /* safe user */ },
    "wallet": { "balance": 125000, "currency": "NGN", "status": "active" },
    "transactions": { "recent": [ /* last N */ ], "totalIn": 900000, "totalOut": 775000 },
    "memberships": [ { "cooperativeId": "...", "tier": "SENIOR", "status": "ACTIVE" } ],
    "savings": [ { "planId": "...", "balance": 50000, "status": "active" } ],
    "shareholdings": [ { "units": 20, "value": 200000 } ],
    "bookings": [ { "equipmentId": "...", "status": "COMPLETED" } ],
    "orders": [ { "orderId": "...", "total": 15000, "status": "DELIVERED" } ],
    "adashe": [ { "groupId": "...", "position": 3, "status": "ACTIVE" } ],
    "agentProfile": { "commissionsTotal": 45000, "referrals": 12 },
    "referrals": { "code": "JOHA1B2C", "referredBy": "USR_...", "referredCount": 12 },
    "kyc": { "status": "PENDING", "documents": [ /* ... */ ] },
    "riskFlags": [ "multiple_failed_logins" ]
  }
}
```
Each panel degrades gracefully (returns `null`/empty) if that module has no data for the user. Requires only `users:view`; individual panels do **not** require the owning module's permission for read (this is an intentional consolidation for support — flagged for owner if stricter panel-level gating is desired).

### PATCH /api/v1/admin/users/:id
**Required permission:** `users:update`
**Description:** Update editable profile fields. Admins **cannot** set `password`, tokens, balances, or refs here. Changing `role` is a distinct, higher-sensitivity action (below).
**DTO:** `AdminUpdateUserDto { firstName?, lastName?, phoneNumber?, state?, lga?, address?, farmName?, farmSize?, farmSizeUnit?, cropsOfInterest?, livestockOfInterest?, profileImageUrl? }`
**Response:** 200 OK.
**Audit:** `{ action: "user.update", permission: "users:update", resource: "users", targetId, before, after }`.

### PATCH /api/v1/admin/users/:id/role
**Required permission:** `users:update` (owner may elect to gate role changes behind a dedicated higher permission — flagged)
**Description:** Change a user's `role` within `farmer | agent | admin | super_admin`. Note: per README, setting `role: 'admin'`/`'super_admin'` on a **user** grants **no** admin-plane access; that is a legacy enum value. Recommended: restrict promotion to `agent` here and treat `admin`/`super_admin` as not-selectable (flag for owner).
**DTO:** `{ role: 'farmer' | 'agent' }`
**Response:** 200 OK.
**Audit:** `user.role_change` with before/after role.

### PATCH /api/v1/admin/users/:id/suspend
**Required permission:** `users:suspend`
**Description:** Suspend a user. Sets `isSuspended: true`, `suspensionReason`, `suspendedAt`, and (policy) `isActive: false`. Suspended users cannot authenticate on the user app (`AUTH_003` on the user side). Reactivate via `.../activate`.
**DTO:** `{ reason: string }` (required)
**Response:** 200 OK.
**Audit:** `user.suspend`.

### PATCH /api/v1/admin/users/:id/activate
**Required permission:** `users:activate`
**Description:** Lift a suspension — clears `isSuspended`, `suspensionReason`, `suspendedAt`; sets `isActive: true`; resets `failedLoginAttempts`/`lockoutUntil`.
**Response:** 200 OK.
**Audit:** `user.activate`.

### PATCH /api/v1/admin/users/:id/ban
**Required permission:** `users:ban` (**Super-Admin-only, non-delegable** — see README)
**Description:** Indefinite hard block. **Adopted design:** sets the dedicated `isBanned: true` (+ `banReason`, `bannedAt`) and `isActive: false` (reason required) — a first-class ban state distinct from suspension. Unban clears `isBanned`/`banReason`/`bannedAt`.
**DTO:** `{ reason: string }`
**Response:** 200 OK.
**Audit:** `user.ban`.

### DELETE /api/v1/admin/users/:id
**Required permission:** `users:delete` (**Super-Admin-only, non-delegable** — see README)
**Description:** **Soft** delete. **Adopted design:** sets `isDeleted: true` (+ `deletedAt`, `deletedBy`) and `isActive: false`, retaining the record for financial/audit lineage. `user-dev` adds these soft-delete fields to `user.schema.ts`. Hard deletion is not offered (data-retention & audit).
**Response:** 204 No Content.
**Audit:** `{ action: "user.delete", permission: "users:delete", resource: "users", targetId, before }`.

### POST /api/v1/admin/users/:id/verify-kyc
**Required permission:** `users:verify`
**Description:** Approve or reject a user's KYC submission (operates on the planned `kyc` structure). Approving sets `kyc.status: VERIFIED`, `verifiedBy`, `verifiedAt`; rejecting sets `REJECTED` + `rejectionReason` per document. Emits a user notification via OneSignal (best-effort).
**DTO:** `VerifyKycDto { decision: 'APPROVE' | 'REJECT', documentDecisions?: [{ documentId, status, rejectionReason? }], reason? }`
**Response:** 200 OK.
**Audit:** `user.kyc_verify` (before/after KYC status; never store raw NIN/BVN in snapshots).

### POST /api/v1/admin/users/:id/reset-password
**Required permission:** `users:update`
**Description:** Admin-initiated password reset. Does **not** set a password directly; instead triggers the user-side forgot-password token flow (generates a reset token, emails the user a reset link via OneSignal) and revokes the user's active sessions. Admins never see or set the user's password.
**Response:** 200 OK.
**Audit:** `user.password_reset_trigger`.

### POST /api/v1/admin/users/:id/impersonate
**Required permission:** `users:impersonate` (**Super-Admin-only, non-delegable** — see README)
**Description:** Issue a **short-lived, clearly-scoped impersonation token** allowing the admin to view the app as the user for support. The token carries `impersonatedBy: adminId`, a short TTL (≤ 15 min), is **read-biased** (money-moving actions SHOULD be blocked while impersonating — flag for owner on exact write scope), and every request made under it is tagged with the impersonator in logs.
**Response:** 200 OK
```json
{ "success": true, "data": { "impersonationToken": "...", "expiresIn": 900, "user": { "userId": "USR_..." } } }
```
**Audit:** `{ action: "user.impersonate", permission: "users:impersonate", resource: "users", targetId }` — start (and, ideally, end) of every impersonation session is logged with actor + IP. This is the highest-scrutiny action in the section.

---

## Validation

| Field | Rule |
|-------|------|
| `phoneNumber` | if provided, Nigerian E.164 `^\+234\d{10}$` |
| `role` | one of `farmer | agent` (see role-change note) |
| `reason` (suspend/ban) | required, non-empty |
| `decision` (KYC) | `APPROVE` or `REJECT`; `rejectionReason` required when rejecting |
| `format` (export) | `csv` or `pdf` |
| `:id` | valid user `_id` or `userId` |

---

## Audit Events

| Action | `action` | Permission | Reserved |
|--------|----------|------------|----------|
| Update profile | `user.update` | `users:update` | |
| Change role | `user.role_change` | `users:update` | |
| Suspend / activate | `user.suspend` / `user.activate` | `users:suspend` / `users:activate` | |
| Ban | `user.ban` | `users:ban` | Super Admin |
| Soft-delete | `user.delete` | `users:delete` | Super Admin |
| KYC approve/reject | `user.kyc_verify` | `users:verify` | |
| Trigger password reset | `user.password_reset_trigger` | `users:update` | |
| Impersonate | `user.impersonate` | `users:impersonate` | Super Admin |
| Export | `user.export` | `users:export` | |

All entries carry `actorId, actorEmail, permission, resource, targetId, before, after, ipAddress, userAgent, createdAt`.

---

## Error Codes (ADMIN_USER_*)

| Code | HTTP | Meaning |
|------|------|---------|
| `ADMIN_USER_001` | 404 | User not found |
| `ADMIN_USER_002` | 400 | Suspension/ban reason required |
| `ADMIN_USER_003` | 409 | User already in requested state (e.g. already suspended) |
| `ADMIN_USER_004` | 400 | Invalid role transition |
| `ADMIN_USER_005` | 400 | KYC decision invalid / no pending submission |
| `ADMIN_USER_006` | 403 | Impersonation not permitted for this target/context |
| `ADMIN_USER_007` | 409 | User already soft-deleted |
| `ADMIN_USER_008` | 400 | Invalid phone format |

---

## Admin UI / Section (`/bennie/users`)

A **premium user-operations workspace**:

- **Users data table:** dense, virtualized table (userId, name, email, phone, role chip, status badges for active/suspended, KYC badge, state, joined date) with a global search box, faceted filters (role, status, KYC status, cooperative, state/LGA), column sorting, saved views, and pagination. Bulk-select for export.
- **User 360 detail (drawer or full page):** a tabbed/paneled layout — Overview, Wallet & Transactions, Memberships, Savings, Shares, Bookings, Orders, Adashe, Agent, Referrals, KYC, Activity/Audit. Each panel renders the `.../360` payload with small trend charts (balance over time, order history) and empty-states for modules with no data. Risk flags surface as a banner.
- **KYC review queue:** an approval-queue view of `PENDING` submissions with side-by-side document viewer, approve/reject-per-document controls, rejection-reason picker, and one-click "verify user". Decisions require the `users:verify` permission and are confirmed before commit.
- **Action bar with guarded, confirmed actions:** Suspend / Activate / Ban / Reset password / Impersonate / Soft-delete — each behind a confirm modal (destructive ones require typing the user's email), each disabled with a tooltip when the operator lacks the permission. Impersonation shows a persistent "You are impersonating <user>" banner with an explicit "Exit impersonation" control.
- **Everywhere:** inline validation on forms, optimistic UI with rollback on error mapped to the `ADMIN_USER_*` codes, and an activity tab that reads this user's `adminAuditLog` entries so operators see who did what.
