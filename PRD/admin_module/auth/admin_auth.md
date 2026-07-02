# Admin Module — Authentication (Sign-in Only)

> Part of the [Admin Module](../README.md). Conventions (RBAC model, permission taxonomy, schemas, seeding, audit) are defined in the master README and are authoritative.

## Overview

Admin authentication is a **fully independent identity plane** from the end-user auth described in [PRD 01](../../user_module/authentication/authentication-user-management.md). Admins authenticate against the **`adminUsers`** collection through `/api/v1/admin/auth/*`, receive a JWT carrying a distinct **admin scope**, and are guarded by `AdminJwtGuard` + `PermissionsGuard`.

> **`adminUsers` is the sole admin identity plane.** A `users` document with `role = admin` or `role = super_admin` grants **no** admin-plane access and **cannot** authenticate here — that enum value is vestigial. There is no path from `users` into admin auth; admin identity derives exclusively from `adminUsers`. (Owner decision — finalized.)

**This module is sign-in only. There is no public registration / signup for admins.** Admin accounts are created exclusively by the bootstrap seeder (the first Super Admin) or by an existing admin holding `admins:create` (see [admins/admins.md](../admins/admins.md)). Any request to a would-be `/admin/auth/register` endpoint MUST NOT exist.

Status: 📄 **planned** (no admin auth code exists yet).

---

## JWT Scope & Guards

- **Access token payload:** `{ sub: adminUsers._id, adminId, email, roleId, scope: "admin", type: "access" }`, expiry **15 minutes**.
- **Refresh token:** opaque/rotating, hashed at rest in an `adminRefreshTokens` collection, expiry **7 days**, one active token per device (userAgent + IP).
- **`AdminJwtGuard`** validates the token AND asserts `scope === "admin"`. It MUST reject user-plane tokens (`scope !== "admin"` or issued by the user auth). The user-side `JwtAuthGuard` MUST likewise reject admin tokens.
- **`PermissionsGuard`** runs after `AdminJwtGuard`, reads `@RequirePermissions('resource:action')`, loads the admin's role + overrides, computes `effective = (role.permissions ∪ overrides.granted) \ overrides.revoked`, and allows if `effective` satisfies the required permission via exact / `resource:*` / `*` match.
- **`mustChangePassword` gate:** a global interceptor blocks every admin route except `GET /auth/me`, `PATCH /auth/change-password`, and `POST /auth/logout` while the admin's `mustChangePassword === true`, returning `403 ADMIN_AUTH_007`.

---

## Endpoints

All success responses use the envelope `{ success, message?, data }`. All error responses use `{ success: false, error: { code, message, details } }`.

### POST /api/v1/admin/auth/login
**Required permission:** none (pre-auth).
**Description:** Authenticate an admin/sub-admin. On success issues an admin-scoped access/refresh pair and appends a `loginHistory` entry. On failure increments `failedLoginAttempts`; the 5th consecutive failure sets `lockoutUntil = now + 15m`.
**Guards:** rate-limited (10 req/min/IP); IP allowlist check (if `allowedIps` non-empty).
**DTO:** `AdminLoginDto { email, password, twoFactorCode? }`
**Request:**
```json
{ "email": "superadmin@bennieconnect.com", "password": "Bennie-2026" }
```
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "admin": {
      "adminId": "ADM_1730000000000_ABC123",
      "email": "superadmin@bennieconnect.com",
      "firstName": "Super",
      "lastName": "Admin",
      "role": { "name": "Super Admin", "permissions": ["*"] },
      "mustChangePassword": true,
      "twoFactorEnabled": false
    },
    "accessToken": "admin_jwt_access",
    "refreshToken": "admin_refresh_token",
    "expiresIn": 900
  }
}
```
**Behaviour notes:**
- When `mustChangePassword === true`, login still succeeds and returns tokens, but the flag signals the SPA to route to the change-password screen and every non-exempt API call returns `403 ADMIN_AUTH_007` until the password is changed.
- When `twoFactorEnabled === true` and `twoFactorCode` is missing/invalid → `401 ADMIN_AUTH_009` (2FA required/invalid); no tokens issued.
- Banned (`isBanned`) → `403 ADMIN_AUTH_004`. Deactivated (`isActive === false`) → `403 ADMIN_AUTH_005`. Locked out → `423 ADMIN_AUTH_002`.
**Audit:** writes `adminAuditLog { action: "admin.login", resource: "admins", targetId: self, ipAddress, userAgent }` on both success and failure (failure records `after: { success: false }`).

### POST /api/v1/admin/auth/refresh
**Required permission:** none (valid refresh token required).
**Description:** Rotate tokens. The presented refresh token is looked up by hash, revoked, and a new pair issued. Invalid/expired/revoked → `401 ADMIN_AUTH_010`.
**DTO:** `AdminRefreshDto { refreshToken }`
**Response:** 200 OK — standard envelope with a new token pair.

### POST /api/v1/admin/auth/logout
**Required permission:** authenticated admin (any).
**Description:** Revoke the presented (or all current-device) refresh token(s). Idempotent.
**Headers:** `Authorization: Bearer <admin access token>`
**DTO:** `{ refreshToken?: string }`
**Response:** 200 OK.
**Audit:** `{ action: "admin.logout", resource: "admins", targetId: self }`.

### GET /api/v1/admin/auth/me
**Required permission:** authenticated admin (any). **Exempt from the `mustChangePassword` gate.**
**Description:** Return the authenticated admin with **resolved effective permissions** so the SPA can render only permitted sections/actions.
**Headers:** `Authorization: Bearer <admin access token>`
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "admin": {
      "adminId": "ADM_1730000000000_ABC123",
      "email": "superadmin@bennieconnect.com",
      "firstName": "Super",
      "lastName": "Admin",
      "role": { "name": "Super Admin", "isSystem": true },
      "effectivePermissions": ["*"],
      "mustChangePassword": true,
      "twoFactorEnabled": false
    }
  }
}
```

### PATCH /api/v1/admin/auth/change-password
**Required permission:** authenticated admin (any). **Exempt from the `mustChangePassword` gate** (this is how the gate is cleared).
**Description:** Change the current admin's password. Verifies `currentPassword`, enforces the password policy, hashes the new password, sets `passwordChangedAt`, **clears `mustChangePassword`**, resets lockout counters, and **revokes all of the admin's refresh tokens** (forcing re-login on other sessions).
**DTO:** `AdminChangePasswordDto { currentPassword, newPassword }`
**Request:**
```json
{ "currentPassword": "Bennie-2026", "newPassword": "N3wStr0ng!Pass" }
```
**Response:** 200 OK. Wrong current password → `400 ADMIN_AUTH_003`. Weak new password → `400 ADMIN_AUTH_011`.
**Audit:** `{ action: "admin.change_password", resource: "admins", targetId: self }` (never logs password values).

---

## Business Rules & State

### Password policy
Same baseline as the user app: min 8 chars, ≥1 uppercase, ≥1 lowercase, ≥1 number, ≥1 special (`!@#$%^&*`). New password must differ from the current one.

### Account lockout
5 consecutive failed logins → `lockoutUntil = now + 15 minutes`. Successful login clears `failedLoginAttempts` and `lockoutUntil`. A locked account returns a generic `423 ADMIN_AUTH_002` (no distinction between "locked" and "wrong password" beyond the code, to limit probing).

### `mustChangePassword` flow (first login)
```
seed / admin-create / admin-reset  →  mustChangePassword = true
        │
   admin logs in (tokens issued, flag surfaced)
        │
   all non-exempt routes → 403 ADMIN_AUTH_007
        │
   PATCH /auth/change-password (success)
        │
   mustChangePassword = false  →  full access per effective permissions
```

### Seeding reference
The bootstrap seeder (see [README → Super-Admin Seeding](../README.md#super-admin-seeding-bootstrap)) idempotently creates the `Super Admin` role (`permissions: ['*']`, `isSystem: true`) and the super admin `superadmin@bennieconnect.com` / `Bennie-2026` — the password is **bcrypt-hashed at rest** (never stored in plaintext) and the account is created with **`mustChangePassword: true`**, forcing a password reset on first login. This is the only path by which the **first** admin exists; all subsequent admins come from `admins:create`.

### 2FA (TOTP) — 📄 planned
When `twoFactorEnabled === true`, `POST /auth/login` requires a valid `twoFactorCode` (TOTP) before tokens are issued. Enrolment/disable endpoints live in [admins/admins.md](../admins/admins.md) as self-service or Super-Admin-managed. Backup codes are supported for recovery.

### IP allowlisting (optional) — 📄 planned
If an admin's `allowedIps` is non-empty, `POST /auth/login` and all authenticated requests from a non-listed IP are rejected with `403 ADMIN_AUTH_008`. Empty allowlist = allow all.

---

## Validation

| Field | Rule |
|-------|------|
| `email` | required, valid email, lowercased/trimmed, must match an existing `adminUsers` record |
| `password` | required, string |
| `newPassword` | required, satisfies password policy, differs from current |
| `twoFactorCode` | required only when the account has `twoFactorEnabled`; 6-digit TOTP |
| `refreshToken` | required for `/refresh`; opaque string |

---

## Audit Events

| Action | `action` | Notes |
|--------|----------|-------|
| Login (success/fail) | `admin.login` | records `success` boolean in `after` |
| Token refresh | `admin.token_refresh` | low-noise; may be sampled |
| Logout | `admin.logout` | |
| Change password | `admin.change_password` | never logs secrets |
| 2FA enable/disable | `admin.2fa_enable` / `admin.2fa_disable` | (planned) |

All entries carry `actorId`, `actorEmail`, `ipAddress`, `userAgent`, `createdAt` per the `adminAuditLog` schema.

---

## Error Codes (ADMIN_AUTH_*)

| Code | HTTP | Meaning |
|------|------|---------|
| `ADMIN_AUTH_001` | 401 | Invalid credentials |
| `ADMIN_AUTH_002` | 423 | Account locked (too many failed attempts) |
| `ADMIN_AUTH_003` | 400 | Current password incorrect |
| `ADMIN_AUTH_004` | 403 | Admin account banned |
| `ADMIN_AUTH_005` | 403 | Admin account deactivated |
| `ADMIN_AUTH_006` | 403 | Insufficient permission (from `PermissionsGuard`) |
| `ADMIN_AUTH_007` | 403 | Password change required (`mustChangePassword`) |
| `ADMIN_AUTH_008` | 403 | IP not in allowlist |
| `ADMIN_AUTH_009` | 401 | Two-factor code required or invalid |
| `ADMIN_AUTH_010` | 401 | Invalid/expired/revoked refresh token |
| `ADMIN_AUTH_011` | 400 | New password fails policy |
| `ADMIN_AUTH_012` | 429 | Rate limit exceeded |

---

## Admin UI / Section (`/bennie/auth`)

A **premium, focused sign-in experience** — not a bare form:

- **Sign-in screen:** centered card on a branded split-panel layout (Bennie logo + cooperative imagery/gradient on one side), email + password fields with inline validation, show/hide password toggle, and a clear error banner mapping error codes to friendly copy (e.g. lockout shows a countdown to `lockoutUntil`).
- **2FA step:** when required, a segmented 6-digit code input with auto-advance and a "use a backup code" link.
- **Forced change-password screen:** shown automatically when `mustChangePassword` is true after login — a modal-locked flow with a live password-strength meter, policy checklist that ticks as rules are met, and confirm field. The rest of the app is inaccessible until completed.
- **Session UX:** silent token refresh in the background; on refresh failure, a graceful "session expired" toast that routes back to sign-in preserving the intended destination.
- No self-registration UI anywhere — there is no "create account" affordance by design.
