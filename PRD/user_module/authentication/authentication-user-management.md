# PRD 01: Authentication & User Management Module

## Overview
Enterprise-grade authentication and user management system for the Cooperative Farming Portal using NestJS, MongoDB, and JWT-based security.

---

## ⚠️ Reconciliation note (doc realigned to live implementation)

This PRD was originally authored ahead of implementation and has been **realigned to the auth contract being built live** in `backend/src/users/` and `backend/src/auth/`. The genuinely useful business rules (password policy, account lockout, token management, rate limiting, error codes) are preserved; the schema, roles, endpoints and notification provider were reconciled to reality. Key changes vs the original spec:

- **User schema:** `phone → phoneNumber`; the single `status` enum is replaced by boolean flags `isActive` / `isSuspended` (plus `suspensionReason` / `suspendedAt`); role vocabulary changed from `SUPER_ADMIN | ADMIN | COOP_MANAGER | MEMBER | AGENT` to the implemented **`farmer | agent | admin | super_admin`**. Two OAuth fields were **added**: `googleId?` and `authProvider` (`'local' | 'google'`, default `'local'`).
- **Registration state:** users are created **ACTIVE** on register (`isActive: true`). Email verification is **built but non-blocking** while `REQUIRE_EMAIL_VERIFICATION=false` — login is not gated on a verified email for now.
- **Required phone on local signup (new):** `RegisterDto.phoneNumber` is now **required** for LOCAL (email/password) signup and must be a **Nigerian mobile number** in E.164 form — pattern `^\+234\d{10}$` (e.g. `+2348012345678`). The stored `User.phoneNumber` **stays optional** because Google accounts are created without a phone and supply it later via the profile flow.
- **Password reset now IMPLEMENTED (✅):** `POST /auth/forgot-password` and `POST /auth/reset-password` ship in this milestone. The token model is **Option A** — a crypto-random raw token is emailed as a reset **link**, and only the **SHA-256 hash** of it is stored on the User doc (`resetPasswordToken`, with `resetPasswordExpires` = 1 hour, single-use). See the [Password Reset Flow](#password-reset-flow-option-a-hashed-token) section.
- **Endpoints:** the live base path is `/api/v1/auth` with `POST /register`, `POST /login`, **`POST /google`** (ID-token flow), `POST /refresh` (renamed from `/refresh-token`), `POST /logout`, **`GET /me`** (documented below — it exists in `auth.controller.ts` but was previously undocumented), and the now-implemented `POST /forgot-password` / `POST /reset-password`. A **Google Sign-In** subsection documents the ID-token flow.
- **Email/notifications:** the mail provider is **OneSignal**, not SMTP/nodemailer (see [`PRD/oneSignal.md`](../../oneSignal.md)). Transactional templates are **branded HTML** (see the [Email Templates](#email-templates-onesignal) section). All sends are **best-effort** — the OneSignal call is non-throwing, so auth flows succeed even if delivery fails.
- **Response envelope:** all auth success responses use `{ success, message?, data: { user, accessToken, refreshToken, expiresIn } }`.

**Open decisions for the owner:**
1. Should `REQUIRE_EMAIL_VERIFICATION` be flipped to `true` before production, and if so is email-verification blocking on `login` or only on sensitive actions?
2. `role` on `RegisterDto` is not currently accepted (self-service registration is farmer-only) — confirm agents/admins are provisioned only by an admin endpoint.
3. The admin user-management endpoints (`/api/v1/admin/users/*`) below remain **specified, not yet implemented** — confirm they land in this module or a separate admin module.
4. Email-verification endpoints (`/verify-email`, `/resend-verification`) remain **planned**; confirm they ship alongside the (now-implemented) password-reset pair.

> ⚠️ **Live-code drift on the reset token (flag, not silently reconciled).** This PRD specifies **Option A** (store the SHA-256 hash; email a link). The current `users.service.ts#generatePasswordResetToken` instead stores a **raw** (un-hashed) `Math.random()`-based token, and `mail.service.ts#sendPasswordResetEmail` emails the **raw token itself** rather than a reset link. `resetPassword()` also does not yet revoke refresh tokens. These are the deltas `user-dev` should close to match the locked Option A design below (crypto-random token, hash-at-rest, link email, revoke-all-refresh-tokens on reset).

---

## Database Schema (MongoDB with Mongoose)

### User Collection

Reflects the **implemented** shape in `backend/src/users/schemas/user.schema.ts` (`@Schema({ timestamps: true, collection: 'users' })`). Sensitive fields (`password`, reset/verification tokens, `twoFactorSecret`, `backupCodes`) are stripped by `User.toJSON()` and never returned by the API. For the full annotated field list see [`PRD/data_structure.md` §2.1](../../data_structure.md#21-users-collection-).

```typescript
{
  _id: ObjectId;                       // Mongoose default
  userId: string;                      // unique; auto "USR_<ts>_<rand>" (pre-save hook)
  email: string;                       // unique, indexed, lowercased, trimmed
  firstName: string;
  lastName: string;
  password: string;                    // bcrypt hashed; redacted from JSON
  phoneNumber?: string;                // trimmed, sparse unique index
  role: 'farmer' | 'agent' | 'admin' | 'super_admin';   // default 'farmer'
  authProvider: 'local' | 'google';    // default 'local'
  googleId?: string;                   // set when authProvider === 'google'
  isEmailVerified: boolean;            // default false
  isPhoneVerified: boolean;            // default false
  isActive: boolean;                   // default true (users are ACTIVE on register)
  isSuspended: boolean;                // default false
  suspensionReason?: string;
  suspendedAt?: Date;
  profileImageUrl?: string;
  address?: string;
  state?: string;
  lga?: string;
  farmName?: string;
  farmSize?: number;
  farmSizeUnit?: string;
  cropsOfInterest?: string[];
  livestockOfInterest?: string[];
  wallet?: ObjectId;                   // ref: Wallet
  memberships?: ObjectId[];            // ref: Membership
  shareholdings?: ObjectId[];          // ref: Shareholding
  contributionGroups?: ObjectId[];     // ref: ContributionGroup
  referralCode?: string;               // auto "<FIRST3><rand5>" (pre-save hook)
  referredBy?: ObjectId;               // ref: User
  referrals?: ObjectId[];              // ref: User
  commissions?: ObjectId[];            // ref: AgentCommission
  totalEarnings: number;               // default 0
  loyaltyPoints: number;               // default 0
  permissions: string[];               // default []
  loginHistory: Array<{                // default []; service caps to last 10
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
    location?: string;
    success: boolean;
  }>;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  resetPasswordToken?: string;         // redacted; SHA-256 hash of the emailed raw token (Option A)
  resetPasswordExpires?: Date;         // redacted; 1-hour TTL, single-use
  emailVerificationToken?: string;     // redacted
  emailVerificationExpires?: Date;     // redacted
  failedLoginAttempts: number;         // default 0; lockout at 5
  lockoutUntil?: Date;                 // 15-min window
  twoFactorEnabled: boolean;           // default false
  twoFactorSecret?: string;            // redacted
  backupCodes?: string[];              // redacted
  metadata?: Record<string, any>;      // default {}
  createdAt: Date;                     // auto (timestamps)
  updatedAt: Date;                     // auto (timestamps)
}
```

> **New OAuth fields:** `googleId?` and `authProvider` back the Google Sign-In flow (see the [Google Sign-In endpoint](#post-apiv1authgoogle) below). A local-password account has `authProvider: 'local'` and no `googleId`; a Google account has `authProvider: 'google'`, a populated `googleId`, and `isEmailVerified: true` (Google has already verified the email).

### RefreshToken Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User, indexed);
  tokenHash: string (unique);   // SHA-256 hash of the refresh token
  expiresAt: Date;              // TTL index — document auto-expires
  userAgent?: string;
  ipAddress?: string;
  isRevoked: boolean;
  createdAt: Date;
}
```

### PasswordResetToken Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User);
  token: string (hashed, unique);
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}
```

### EmailVerificationToken Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User);
  token: string (hashed, unique);
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}
```

---

## API Endpoints

### Authentication Endpoints

> **Success envelope (all auth endpoints).** Register, login, Google sign-in and refresh return the same shape:
> ```json
> {
>   "success": true,
>   "message": "optional human-readable message",
>   "data": {
>     "user": { /* safe user — see User.toJSON(), no password/tokens */ },
>     "accessToken": "jwt_access_token",
>     "refreshToken": "jwt_refresh_token",
>     "expiresIn": 900
>   }
> }
> ```

#### POST /api/v1/auth/register
**Description:** Register a new local-password user account. Users are created **ACTIVE** (`isActive: true`, `authProvider: 'local'`). A branded **Welcome** email and a verification email are sent via OneSignal (best-effort). Email verification is **non-blocking** (`REQUIRE_EMAIL_VERIFICATION=false`), so the user is logged in immediately.
**DTO:** `RegisterDto { firstName, lastName, email, password, phoneNumber, referralCode? }`
**Validation:** `phoneNumber` is **required** and must match `^\+234\d{10}$` (Nigerian E.164, e.g. `+2348012345678`). Password must meet the [password policy](#password-requirements). A `409` (`AUTH_009`) is returned if the email already exists.
**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "user@example.com",
  "password": "SecurePass123!",
  "phoneNumber": "+2348012345678",
  "referralCode": "optional_code"
}
```
**Response:** 201 Created
```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "user": {
      "userId": "USR_1730000000000_ABC123XYZ",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "farmer",
      "authProvider": "local",
      "isEmailVerified": false,
      "isActive": true,
      "referralCode": "JOHA1B2C"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "expiresIn": 900
  }
}
```

#### POST /api/v1/auth/login
**Description:** Authenticate a local-password user and receive tokens.
**DTO:** `LoginDto { email, password }`
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "USR_1730000000000_ABC123XYZ",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "farmer",
      "authProvider": "local",
      "isEmailVerified": false
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "expiresIn": 900
  }
}
```

#### POST /api/v1/auth/google
**Description:** Sign in (or sign up) with a Google ID token. See the [Google Sign-In (ID-token flow)](#google-sign-in-id-token-flow) subsection below for the full flow.
**DTO:** `GoogleAuthDto { idToken }`
**Request Body:**
```json
{
  "idToken": "google_id_token_jwt"
}
```
**Response:** 200 OK — standard success envelope, with the resolved/created user (`authProvider: 'google'`, `isEmailVerified: true`).

#### POST /api/v1/auth/refresh
**Description:** Rotate tokens using a valid refresh token. The presented refresh token is looked up by hash in the `RefreshToken` collection, revoked, and a new access/refresh pair issued.
**DTO:** `RefreshTokenDto { refreshToken }`
**Request Body:**
```json
{
  "refreshToken": "valid_refresh_token"
}
```
**Response:** 200 OK — standard success envelope with a new token pair.

#### POST /api/v1/auth/logout
**Description:** Logout user and revoke tokens
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "refreshToken": "optional_refresh_token"
}
```
**Response:** 200 OK

#### POST /api/v1/auth/forgot-password
✅ **Implemented.** **Description:** Request a password-reset email. Always returns `200` regardless of whether the email exists — **no user enumeration**. If the email matches an active local account, a crypto-random raw token is generated, its **SHA-256 hash** is stored on the user (`resetPasswordToken`, `resetPasswordExpires` = now + 1h), and a branded **Password reset** email is sent via OneSignal (best-effort) containing a link `${APP_URL}/reset-password?token=<rawToken>`.
**DTO:** `ForgotPasswordDto { email }`
**Request Body:**
```json
{
  "email": "user@example.com"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "message": "If an account exists for that email, a reset link has been sent."
}
```

#### POST /api/v1/auth/reset-password
✅ **Implemented.** **Description:** Reset the password using the raw token from the email link. The server **SHA-256-hashes the presented token** and looks up a user with a matching `resetPasswordToken` whose `resetPasswordExpires` is still in the future. On success it hashes and stores the new password, clears the reset token (single-use), sets `passwordChangedAt`, resets lockout counters, and **revokes all of the user's refresh tokens** so existing sessions must re-authenticate.
**DTO:** `ResetPasswordDto { token, password }` — `password` must satisfy the [password policy](#password-requirements).
**Request Body:**
```json
{
  "token": "raw_token_from_email_link",
  "password": "NewSecurePass123!"
}
```
**Response:** 200 OK. Invalid/expired token → `400` (`AUTH_012` / `AUTH_013`).

> 📄 **Planned (not yet implemented).** The email-verification endpoints below are retained from the original spec and are pending confirmation for this milestone (see Reconciliation note, open decision 4). Verification emails are delivered via **OneSignal** (not SMTP).

#### POST /api/v1/auth/verify-email
**Description:** Verify email address
**Request Body:**
```json
{
  "token": "email_verification_token"
}
```
**Response:** 200 OK

#### POST /api/v1/auth/resend-verification
**Description:** Resend email verification
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### GET /api/v1/auth/me
✅ **Implemented.** **Description:** Return the authenticated user (safe shape). Guarded by `JwtAuthGuard`; the SPA calls this on boot from `useAuthStore.hydrate()` to refresh the cached user. `auth.controller.ts` returns `{ success: true, data: { user } }` where `user` is `user.toJSON()` (no password/token fields).
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "USR_1730000000000_ABC123XYZ",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "farmer",
      "authProvider": "local",
      "isEmailVerified": false
    }
  }
}
```
Note this endpoint returns **only** `data.user` (no tokens), unlike the register/login/refresh envelope.

#### PATCH /api/v1/auth/change-password
**Description:** Change password for authenticated user
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```
**Response:** 200 OK

#### PUT /api/v1/auth/profile
**Description:** Update user profile
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+2348012345678",
  "state": "Lagos",
  "lga": "Ikeja",
  "address": "123 Farm Road, Ikeja"
}
```
**Response:** 200 OK

### Google Sign-In (ID-token flow)

✅ **Implemented (both ends).** Frontend `<GoogleLogin>` → `POST /auth/google { idToken }` → server-side verification is wired end-to-end (`auth.controller.ts#google` → `authService.loginWithGoogle`). Credentials (`GOOGLE_CLIENT_ID`) are **env-driven placeholders** to be replaced with the real OAuth client id per environment.

Google Sign-In uses the **ID-token flow** (not the OAuth redirect/authorization-code flow), so the SPA never handles a client secret and the backend never stores Google refresh tokens.

1. **Frontend** renders Google Sign-In via [`@react-oauth/google`](https://www.npmjs.com/package/@react-oauth/google) (`GoogleOAuthProvider` + `GoogleLogin` / `useGoogleLogin`), configured with the public `GOOGLE_CLIENT_ID`. On success it receives a Google **ID token** (a signed JWT).
2. **Frontend** posts it to `POST /api/v1/auth/google` with body `{ idToken }` (`GoogleAuthDto`).
3. **Backend** verifies the ID token server-side using [`google-auth-library`](https://www.npmjs.com/package/google-auth-library) (`OAuth2Client.verifyIdToken`), asserting the token **audience matches `GOOGLE_CLIENT_ID`** and the issuer is Google. Verification yields the trusted payload: `sub` (Google user id), `email`, `email_verified`, `given_name`, `family_name`, `picture`.
4. **Backend find-or-create:**
   - Look up an existing user by `googleId === payload.sub`, else by `email`.
   - **Found (by email, local account):** link the account by setting `googleId` and `authProvider: 'google'` (owner decision: whether to auto-link or require an explicit link step — see below).
   - **Not found:** create a user with `authProvider: 'google'`, `googleId: payload.sub`, `email`, `firstName`/`lastName` from the payload, `profileImageUrl: payload.picture`, `isEmailVerified: true`, `isActive: true`, and **no password**.
5. **Backend** issues the standard token pair and returns the [standard success envelope](#post-apiv1authregister).

**Notes & open decisions:**
- Google accounts have **no local password**; a `POST /login` with email+password must fail cleanly for them (`AUTH_001`), and they may set a password later via the reset flow to enable local login.
- Auto-linking a Google sign-in to an existing local account by matching `email` is convenient but has an account-takeover consideration — confirm with the owner whether to auto-link (email is Google-verified) or require the user to log in locally first and link from settings.
- Required env: **`GOOGLE_CLIENT_ID`** (audience for verification). No client secret is needed for the ID-token flow.

### Admin User Management Endpoints

> 📄 **Planned (not yet implemented).** These admin endpoints are specified but not part of the live auth build; confirm target module (see Reconciliation note, open decision 3). Roles/status below use the reconciled vocabulary: roles `farmer | agent | admin | super_admin`, and status is expressed via `isActive` / `isSuspended` rather than a single `status` enum.

#### GET /api/v1/admin/users
**Description:** List all users (admin only)
**Headers:** Authorization: Bearer <token>
**Query Params:** page, limit, search, role, status, sortBy, sortOrder
**Response:** 200 OK

#### GET /api/v1/admin/users/:id
**Description:** Get user by ID (admin only)
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### PATCH /api/v1/admin/users/:id/status
**Description:** Activate / suspend a user (admin only). Sets the boolean flags (`isActive` / `isSuspended`, plus `suspensionReason`) rather than a single `status` enum.
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "isActive": true,
  "isSuspended": false,
  "suspensionReason": "optional, required when suspending"
}
```
**Response:** 200 OK

#### PATCH /api/v1/admin/users/:id/role
**Description:** Update user role (admin only)
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "role": "agent"
}
```
**Response:** 200 OK

#### DELETE /api/v1/admin/users/:id
**Description:** Soft delete user (admin only)
**Headers:** Authorization: Bearer <token>
**Response:** 204 No Content

---

## Business Logic

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*)

### Account Lockout Policy
- Maximum 5 failed login attempts
- Account locked for 30 minutes after 5 failed attempts
- Login attempts reset on successful login
- Locked accounts return generic error message

### Token Management
- Access token expiry: 15 minutes
- Refresh token expiry: 7 days
- Single refresh token per device (tracked by userAgent + IP)
- Token rotation on each refresh
- Immediate revocation on logout

### Email Verification Flow
1. On register, generate a unique token with 24-hour expiry and send a verification email via **OneSignal** (see [`PRD/oneSignal.md`](../../oneSignal.md)).
2. Verification is **non-blocking** while `REQUIRE_EMAIL_VERIFICATION=false` — the user is active and can log in without verifying.
3. Token invalidated after use.
4. Resend available every 60 seconds.
5. When `REQUIRE_EMAIL_VERIFICATION=true` (future), unverified users are restricted per the owner's decision (see Reconciliation note, open decision 1).

### Password Reset Flow (Option A — hashed token)
1. **Request** (`POST /forgot-password`): generate a **crypto-random raw token** (`crypto.randomBytes`), store only its **SHA-256 hash** in `User.resetPasswordToken` with `resetPasswordExpires` = now + **1 hour**. Respond `200` unconditionally (no user enumeration).
2. **Email** the raw token as a **link** via OneSignal (best-effort): `${APP_URL}/reset-password?token=<rawToken>`. Only the hash is ever persisted, so a database read cannot reveal a usable token.
3. **Reset** (`POST /reset-password`): SHA-256-hash the presented token, match an unexpired `resetPasswordToken`, then set the new password, clear the token (**single-use**), stamp `passwordChangedAt`, and **revoke all refresh tokens** for the user.
4. Token invalidated after use or after the 1-hour expiry.
5. Rate limit: max 3 requests per hour per email.

### Nigerian Phone Number Rule
- On **local signup**, `phoneNumber` is **required** and validated against `^\+234\d{10}$` (E.164 Nigerian mobile, e.g. `+2348012345678`).
- The stored `User.phoneNumber` remains **optional** at the schema level so **Google** accounts (created without a phone) can be provisioned and supply/verify a number later via the profile flow.

### Referral System
- Auto-generate unique referral code on registration
- Track referrer in user document
- Prepare for future reward calculations

---

## Security Requirements

### Authentication
- JWT-based authentication with RS256 algorithm
- Password hashing with bcrypt (cost factor: 12)
- Secure random token generation (crypto.randomBytes)
- Token blacklisting for immediate logout

### Authorization
- Role-based access control (RBAC)
- Permission-based authorization for fine-grained access
- Custom decorators for route protection
- Dynamic permission checking

### Input Validation
- class-validator for all DTOs
- Sanitization of user inputs
- XSS prevention
- SQL/NoSQL injection prevention

### Rate Limiting
- Login endpoint: 10 requests per minute per IP
- Password reset: 3 requests per hour per email
- Registration: 5 requests per hour per IP
- General API: 100 requests per minute per user

### Audit Logging
- Log all authentication events (login, logout, password change)
- Log admin actions on user management
- Store IP address, user agent, timestamp
- Retain logs for 90 days

---

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Invalid credentials",
    "details": {}
  }
}
```

### Error Codes
- AUTH_001: Invalid credentials
- AUTH_002: Account locked
- AUTH_003: Account suspended
- AUTH_004: Email not verified
- AUTH_005: Token expired
- AUTH_006: Invalid token
- AUTH_007: Token revoked
- AUTH_008: Password requirements not met
- AUTH_009: User already exists
- AUTH_010: User not found
- AUTH_011: Rate limit exceeded
- AUTH_012: Invalid reset token
- AUTH_013: Reset token expired

---

## Testing Requirements

### Unit Tests
- Password hashing and comparison
- Token generation and validation
- Email verification logic
- Password reset flow
- Role and permission checks

### Integration Tests
- Registration flow end-to-end
- Login/logout flow
- Password reset flow
- Token refresh flow
- Admin user management operations

### Security Tests
- Brute force attack prevention
- Token tampering detection
- SQL/NoSQL injection attempts
- XSS attempt prevention
- Rate limiting effectiveness

### Performance Tests
- Concurrent login handling (1000 users)
- Token validation under load
- Database query optimization

---

## Performance Specifications

### Response Time Targets
- Login: < 200ms (p95)
- Token validation: < 50ms (p95)
- User profile fetch: < 100ms (p95)

### Scalability
- Support 10,000 concurrent users
- Horizontal scaling ready (stateless auth)
- Redis caching for frequently accessed user data

### Database Indexing
- Unique index on email
- Unique index on phone
- Unique index on referralCode
- Compound index on role + status
- TTL index on token collections

---

## Monitoring & Observability

### Metrics to Track
- Successful/failed login attempts
- Registration rate
- Password reset requests
- Token refresh rate
- Account lockouts
- Average response times

### Alerts
- Spike in failed login attempts (>100 in 5 min)
- High account lockout rate
- Unusual registration patterns
- Token validation failures

### Logging
- Structured JSON logging
- Correlation IDs for request tracing
- Sensitive data masking (passwords, tokens)

---

## Notifications

**Provider: OneSignal.** All transactional email is sent through **OneSignal** (email channel) via `mail.service.ts#sendEmail` (`POST {baseUrl}/notifications`, `target_channel: 'email'`), not SMTP/nodemailer. See [`PRD/oneSignal.md`](../../oneSignal.md) for provider config and API keys. Every send is **best-effort**: when OneSignal credentials are absent the method is a logged no-op, and delivery failures never break the auth flow (the method returns a boolean, it does not throw). The `SMTP_*` environment variables in `configuration.ts` are legacy and unused by the auth flow.

### Email Templates (OneSignal)

All templates render as **branded HTML** with a consistent shell:
- **Logo:** `<img src="${APP_URL}/ben_logo.png">` in the header.
- **From-name:** "Bennie Connect" (address from `EMAIL_FROM`).
- **Footer:** the cooperative mission/values line + support contact, on every template.

| # | Template | Trigger | Body highlights | CTA |
|---|----------|---------|-----------------|-----|
| 1 | **Welcome** | on `POST /register` | rich, benefit-driven (save, invest in shares, book equipment, access agri-services) | button → `${APP_URL}/app` |
| 2 | **Password reset** | on `POST /forgot-password` | styled, notes **1-hour expiry** and single-use | button → `${APP_URL}/reset-password?token=<rawToken>` |
| 3 | **Email verification** | on register / resend | styled verification **code** (non-blocking while `REQUIRE_EMAIL_VERIFICATION=false`) | code display |
| 4 | **Password changed** | after a successful reset / change | confirmation + "not you? contact support" | support link |

> ⚠️ **Live-code note.** `mail.service.ts` currently ships **plain** (unbranded) `sendWelcomeEmail` / `sendVerificationEmail` / `sendPasswordResetEmail`, and the reset email carries the **raw token** rather than a link; there is no `sendPasswordChangedEmail` yet. The branded shell (logo/from-name/footer), the link-based reset email, and the "Password changed" template above are the target state for `user-dev` to implement.

**Other transactional emails (planned):** Account Activated/Suspended, Login from New Device.

### SMS Templates Required
1. OTP for Phone Verification (future)
2. Login Alert (optional)

---

## Environment Variables Required

```bash
# JWT Configuration
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30

# Google Sign-In (ID-token flow)
GOOGLE_CLIENT_ID=your_google_oauth_client_id   # audience verified server-side; env-driven placeholder

# Email verification
REQUIRE_EMAIL_VERIFICATION=false               # non-blocking for now

# Email Service (OneSignal — see PRD/oneSignal.md)
ONESIGNAL_APP_ID=your_onesignal_app_id
ONESIGNAL_API_KEY=your_onesignal_rest_api_key
EMAIL_FROM=noreply@coopfarming.com             # from-name rendered as "Bennie Connect"
APP_URL=https://app.coopfarming.com            # base for logo + reset link + Welcome CTA
# NOTE: legacy SMTP_* vars in configuration.ts are unused by the auth flow.

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# Application
NODE_ENV=production
API_PREFIX=/api/v1
CORS_ORIGINS=https://app.coopfarming.com
```

---

## Implementation Checklist

- [ ] Set up NestJS project with TypeScript
- [ ] Configure Mongoose with MongoDB connection
- [ ] Create User schema and model
- [ ] Create Token schemas (RefreshToken, PasswordResetToken, EmailVerificationToken)
- [ ] Implement AuthModule with all guards and strategies
- [ ] Implement UserService with CRUD operations
- [ ] Implement AuthService with login, register, token management
- [ ] Create all DTOs with validation
- [ ] Implement JWT strategy and guards
- [ ] Implement RBAC guards and decorators
- [ ] Create email service integration
- [ ] Implement rate limiting
- [ ] Set up audit logging
- [ ] Write unit tests (80%+ coverage)
- [ ] Write integration tests
- [ ] Security penetration testing
- [ ] Performance testing
- [ ] API documentation with Swagger
- [ ] Deploy to staging environment
- [ ] Load testing
- [ ] Production deployment

---

## Dependencies

### Core Dependencies
- @nestjs/core, @nestjs/common, @nestjs/platform-express
- @nestjs/mongoose, mongoose
- @nestjs/jwt, @nestjs/passport, passport, passport-jwt
- @nestjs/config
- bcryptjs
- class-validator, class-transformer
- uuid
- @nestjs/swagger (for API docs)

### Optional Dependencies
- nodemailer (for email)
- twilio (for SMS)
- redis (for caching and rate limiting)
- winston (for logging)

---

## Future Enhancements

1. Multi-factor authentication (TOTP, SMS)
2. Social login — **Google implemented** (ID-token flow); Facebook, Apple future
3. Biometric authentication support
4. Session management dashboard for users
5. Advanced fraud detection
6. OAuth2 provider support
7. SSO integration capabilities
