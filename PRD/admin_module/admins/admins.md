# Admin Module — Sub-Admins, Roles & Permissions

> Part of the [Admin Module](../README.md). The `adminUsers` / `adminRoles` / `adminAuditLog` schemas, the permission taxonomy, and the effective-permission formula are defined in the master README and are authoritative here.

## Overview

This section governs the **admin identity plane itself**: creating and managing sub-admin accounts (`adminUsers`), defining roles and their granular permissions (`adminRoles`), assigning roles, applying per-user permission overrides, and viewing the audit trail. It is the most sensitive area of the platform — every action here can widen or narrow another admin's power — so all mutations are Super-Admin-heavy and fully audited.

- Sub-admin management: `/api/v1/admin/admins/*` — permission family **`admins:*`**.
- Role & permission-catalog management: `/api/v1/admin/roles/*` — permission family **`roles:*`**.
- Audit trail (shared, read/export only): `/api/v1/admin/audit-logs/*` — **`audit-logs:view`**, **`audit-logs:export`**.

Status: 📄 **planned**.

---

## Business Rules & State Machines

### Sub-admin lifecycle
```
create (mustChangePassword=true, isActive=true, isBanned=false)
   │
   ├── update (profile, role, overrides)
   ├── deactivate ⇄ activate       (isActive toggle; revokes sessions on deactivate)
   ├── ban → banned (isBanned=true, banReason, bannedAt; revokes all sessions)  ⇄ unban
   └── delete (soft)               (Super Admin only; cannot delete self or last Super Admin)
```

Invariants:
- **No self-escalation.** An admin cannot grant themselves (via override or role change) a permission they do not already hold. `admins:update` / `roles:update` requests that would elevate the actor's own effective set are rejected `403 ADMIN_MGMT_010`.
- **No self-destruction.** An admin cannot `ban`, `deactivate`, or `delete` their own account (`ADMIN_MGMT_006`).
- **Last-Super-Admin guard.** The system must always retain at least one active, non-banned admin whose effective permissions include `*`. Any operation that would remove the last such admin (delete/ban/deactivate/role-change/override-revoke) is rejected `ADMIN_MGMT_007`.
- **Only Super Admin (`*` or `admins:*` + `roles:*`) may assign the `Super Admin` role** or grant `*` / `admins:*` / `roles:*` via overrides.
- **Super-Admin-only permissions are non-delegable.** The [Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable) (financial-reversal & destructive: `transactions:reverse`, `orders:refund`, `equipment:settle-deposit`, `adashe-contributions:process-payout`, `dividends:distribute`, `commissions:pay-batch`, `agent-commission:reverse`, `savings-plans:configure`, `settings:configure`, any `*:delete`, any `*:ban`, `users:impersonate`) **cannot** be granted to a non-Super-Admin role (`POST/PATCH /roles`) or via a per-admin override (`granted[]`). Any create/update that would place one of these strings on a non-Super-Admin role or override is rejected `403 ADMIN_MGMT_012`. They are satisfiable only via the `Super Admin` role's `*` wildcard.

### Role lifecycle
```
create → active
   ├── update (name/description/permissions)   (isSystem roles: permissions editable? NO — see below)
   └── delete                                    (blocked if isSystem OR in use)
```
- **`isSystem` roles are protected.** The seeded `Super Admin` role (and any future system role) **cannot be deleted or renamed, and its permissions cannot be edited** (`ADMIN_MGMT_008`). This prevents locking the platform out of full access.
- **In-use guard.** A role cannot be deleted while any `adminUsers` reference it (`ADMIN_MGMT_009`); reassign those admins first.

---

## Endpoints — Sub-admins (`/api/v1/admin/admins`)

### GET /api/v1/admin/admins
**Required permission:** `admins:view`
**Description:** Paginated, filterable list of admin/sub-admin accounts.
**Query:** `page, limit, search (name/email), roleId, isActive, isBanned, sortBy, sortOrder`
**Response:** 200 OK — `{ success, data: { items: [safeAdmin], total, page, limit } }` (passwords/2FA secrets stripped).

### GET /api/v1/admin/admins/:id
**Required permission:** `admins:view`
**Description:** Full detail of one admin including resolved `effectivePermissions`, role, overrides, login history, ban/active state.
**Response:** 200 OK.

### POST /api/v1/admin/admins
**Required permission:** `admins:create`
**Description:** Provision a new sub-admin. Sets `mustChangePassword: true`, `createdBy: actor`. A temporary password is generated (or supplied) and delivered out-of-band; the new admin must change it on first login. **This is the only account-creation path — there is no self-registration.**
**DTO:** `CreateAdminDto { firstName, lastName, email, phoneNumber?, roleId, temporaryPassword?, permissionOverrides? }`
**Request:**
```json
{
  "firstName": "Ada",
  "lastName": "Okoro",
  "email": "ada.okoro@bennieconnect.com",
  "roleId": "652f...role",
  "permissionOverrides": { "granted": ["orders:view", "orders:update"], "revoked": [] }
}
```
**Response:** 201 Created — safe admin object. Duplicate email → `409 ADMIN_MGMT_002`.
**Guards:** self-escalation & Super-Admin-role assignment rules apply. `permissionOverrides.granted[]` may **not** contain any [Super-Admin-only permission](../README.md#super-admin-only-permission-set-finalized--not-delegable) (rejected `403 ADMIN_MGMT_012`).
**Audit:** `{ action: "admin.create", permission: "admins:create", resource: "admins", targetId: newId, after }`.

### PATCH /api/v1/admin/admins/:id
**Required permission:** `admins:update`
**Description:** Update profile, **assign/change role** (`roleId`), and/or **set permission overrides** (`permissionOverrides`). Role change and override changes are subject to the self-escalation and last-Super-Admin guards.
**DTO:** `UpdateAdminDto { firstName?, lastName?, phoneNumber?, roleId?, permissionOverrides? }`
**Response:** 200 OK.
**Audit:** `{ action: "admin.update", permission: "admins:update", resource: "admins", targetId, before, after }` — role/override diffs are the most important thing captured here.

### PATCH /api/v1/admin/admins/:id/activate
**Required permission:** `admins:activate` (or `admins:deactivate` for the inverse)
**Description:** Toggle `isActive`. Deactivation revokes all of the target's refresh tokens.
**Response:** 200 OK. Self → `403 ADMIN_MGMT_006`. Last Super Admin → `403 ADMIN_MGMT_007`.
**Audit:** `admin.activate` / `admin.deactivate`.

### PATCH /api/v1/admin/admins/:id/ban
**Required permission:** `admins:ban` (**Super-Admin-only, non-delegable** — see README)
**Description:** Set `isBanned: true`, `banReason`, `bannedAt`; revoke all sessions. Unban via the same endpoint with `{ banned: false }`.
**DTO:** `{ banned: boolean, reason?: string }` (`reason` required when banning).
**Response:** 200 OK. Guards: self, last-Super-Admin.
**Audit:** `admin.ban` / `admin.unban`.

### DELETE /api/v1/admin/admins/:id
**Required permission:** `admins:delete` (**Super-Admin-only, non-delegable** — see README)
**Description:** **Soft** delete (flag, retain for audit lineage). Cannot delete self or the last Super Admin.
**Response:** 204 No Content.
**Audit:** `{ action: "admin.delete", permission: "admins:delete", resource: "admins", targetId, before }`.

### Self-service (any authenticated admin)
- `POST /api/v1/admin/admins/me/2fa/enable` / `.../disable` — TOTP enrolment for the caller's own account (📄 planned; returns provisioning URI + backup codes on enable).

---

## Endpoints — Roles & Permission Catalog (`/api/v1/admin/roles`)

### GET /api/v1/admin/roles/permissions
**Required permission:** `roles:view`
**Description:** Return the **full permission catalog** — every `resource:action` pair the system supports, grouped by resource, plus wildcard descriptors. This is the source the UI permission-picker renders from, so it must stay in lockstep with the README taxonomy.
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "resources": [
      { "resource": "users", "label": "Platform Users",
        "actions": ["view","create","update","delete","ban","suspend","activate","verify","impersonate","export"] },
      { "resource": "withdrawals", "label": "Withdrawals",
        "actions": ["view","approve","reject","reverse","export"] }
    ],
    "wildcards": [
      { "value": "users:*", "description": "All actions on users" },
      { "value": "*", "description": "Full access (Super Admin)" }
    ]
  }
}
```

### GET /api/v1/admin/roles
**Required permission:** `roles:view`
**Description:** List roles with member counts and `isSystem` flags.
**Query:** `page, limit, search, isSystem`
**Response:** 200 OK.

### GET /api/v1/admin/roles/:id
**Required permission:** `roles:view`
**Response:** 200 OK — role with full `permissions[]` and count of assigned admins.

### POST /api/v1/admin/roles
**Required permission:** `roles:create`
**Description:** Create a role from a validated set of permission strings.
**DTO:** `CreateRoleDto { name, description, permissions: string[] }`
**Validation:** every entry in `permissions` must be a known `resource:action`, a valid `resource:*`, or `*`; unknown strings → `400 ADMIN_MGMT_011`. Only a Super-Admin-effective actor may include `*` / `admins:*` / `roles:*`. A non-Super-Admin role (anything other than the seeded `Super Admin` role holding `*`) may **not** include any [Super-Admin-only permission](../README.md#super-admin-only-permission-set-finalized--not-delegable) — such entries are rejected `403 ADMIN_MGMT_012` (these are non-delegable and satisfiable only via `*`).
**Response:** 201 Created. Duplicate `name` → `409 ADMIN_MGMT_003`.
**Audit:** `{ action: "role.create", permission: "roles:create", resource: "roles", targetId, after }`.

### PATCH /api/v1/admin/roles/:id
**Required permission:** `roles:update`
**Description:** Update name/description/permissions. **Rejected for `isSystem` roles** (`ADMIN_MGMT_008`). Self-escalation guard applies to permission additions.
**Response:** 200 OK.
**Audit:** `{ action: "role.update", permission: "roles:update", resource: "roles", targetId, before, after }` — permission diff captured.

### DELETE /api/v1/admin/roles/:id
**Required permission:** `roles:delete` (**Super-Admin-only, non-delegable** — see README)
**Description:** Delete a role. Blocked if `isSystem` (`ADMIN_MGMT_008`) or in use (`ADMIN_MGMT_009`).
**Response:** 204 No Content.
**Audit:** `role.delete`.

---

## Endpoints — Audit Trail (`/api/v1/admin/audit-logs`) — shared, read-only

The audit log is **append-only**: no create/update/delete endpoints exist; entries are written by the system on every mutation across all admin sections.

### GET /api/v1/admin/audit-logs
**Required permission:** `audit-logs:view`
**Description:** Paginated, filterable view of `adminAuditLog`.
**Query:** `page, limit, actorId, resource, action, targetId, dateFrom, dateTo, ipAddress, search`
**Response:** 200 OK — `{ items, total, page, limit }`. `before`/`after` snapshots redact any sensitive field (passwords, secrets, raw financial identifiers).

### GET /api/v1/admin/audit-logs/export
**Required permission:** `audit-logs:export`
**Description:** Export the filtered audit set as CSV or PDF. The export itself is audit-logged (`action: "audit.export"`), since it egresses sensitive history.
**Query:** same filters as list + `format=csv|pdf`.
**Response:** 200 OK — file stream.

---

## Validation

| Field | Rule |
|-------|------|
| `email` (create admin) | required, valid email, unique in `adminUsers` |
| `roleId` | required, must reference an existing `adminRoles._id` |
| `permissionOverrides.granted[]` / `.revoked[]` | each must be a valid catalog entry or wildcard |
| `permissions[]` (role) | non-empty; each a valid catalog entry or wildcard |
| `name` (role) | required, unique, 2–60 chars |
| `reason` (ban) | required when `banned: true` |
| `format` (export) | `csv` or `pdf` |

---

## Audit Events

| Action | `action` | Permission | Reserved |
|--------|----------|------------|----------|
| Create sub-admin | `admin.create` | `admins:create` | |
| Update sub-admin (role/overrides) | `admin.update` | `admins:update` | |
| Activate / deactivate | `admin.activate` / `admin.deactivate` | `admins:activate`/`admins:deactivate` | |
| Ban / unban | `admin.ban` / `admin.unban` | `admins:ban` | Super Admin |
| Soft-delete sub-admin | `admin.delete` | `admins:delete` | Super Admin |
| Create / update / delete role | `role.create` / `role.update` / `role.delete` | `roles:create`/`roles:update`/`roles:delete` | delete: Super Admin |
| Export audit logs | `audit.export` | `audit-logs:export` | |

Every entry carries `actorId`, `actorEmail`, `permission`, `resource`, `targetId`, `before`, `after`, `ipAddress`, `userAgent`, `createdAt`.

---

## Error Codes (ADMIN_MGMT_*)

| Code | HTTP | Meaning |
|------|------|---------|
| `ADMIN_MGMT_001` | 404 | Admin not found |
| `ADMIN_MGMT_002` | 409 | Admin email already exists |
| `ADMIN_MGMT_003` | 409 | Role name already exists |
| `ADMIN_MGMT_004` | 404 | Role not found |
| `ADMIN_MGMT_005` | 400 | Invalid role assignment (role missing/inactive) |
| `ADMIN_MGMT_006` | 403 | Cannot perform this action on your own account |
| `ADMIN_MGMT_007` | 403 | Operation would remove the last Super Admin |
| `ADMIN_MGMT_008` | 403 | System role cannot be modified or deleted |
| `ADMIN_MGMT_009` | 409 | Role is in use and cannot be deleted |
| `ADMIN_MGMT_010` | 403 | Privilege escalation blocked (cannot grant a permission you lack) |
| `ADMIN_MGMT_011` | 400 | Unknown/invalid permission string |
| `ADMIN_MGMT_012` | 403 | Super-Admin-only permission cannot be delegated to a non-Super-Admin role/override |

---

## Admin UI / Section (`/bennie/admin`)

A **premium role-and-access console** built for clarity and safety around dangerous operations:

- **Sub-admins tab:** a rich data table (avatar, name, email, role chip, status badges for active/banned, last login) with search, role/status filters, and pagination. Row actions open a **detail drawer** showing profile, assigned role, resolved effective permissions (as grouped chips), login history, and audit-linked activity.
- **Create/edit admin form:** stepped form with real-time email-uniqueness check, a **role selector** that previews the role's permissions, and an **overrides panel** (two columns: "Additionally granted" / "Revoked") — additions the actor cannot grant are disabled with an explanatory tooltip.
- **Roles matrix:** a matrix view — roles as columns, resources as rows — with per-cell action toggles, so an admin can see and edit the whole permission surface at a glance. `isSystem` roles render read-only with a lock icon.
- **Permission picker:** grouped by resource with an "expand all / select all actions" affordance, wildcard shortcuts (`resource:*`, `*`), and a live count of selected permissions. Sensitive/reserved permissions are visually flagged.
- **Confirm modals with typed confirmation** for destructive actions (ban, delete role, delete admin) — e.g. requiring the operator to type the target email/role name. Last-Super-Admin and self-action guards surface as blocking inline errors before submit.
- **Audit viewer:** filterable, time-ordered feed with a diff view of `before`/`after` for each entry, actor + IP columns, quick filters ("show my actions", "financial actions only"), and CSV/PDF export. Every filter maps to the `audit-logs` query params above.
