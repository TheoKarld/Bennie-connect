# PRD: OneSignal Email Integration (Transactional Mail)

## Overview

OneSignal is the Cooperative Farming Portal's **transactional email provider**. It
replaces the earlier SMTP/nodemailer plan referenced elsewhere in the backend
config. All outbound mail from the API is routed through OneSignal's **email
channel** via its REST API.

**Status:** ✅ **Implemented and live.** The `MailModule` / `MailService` are
built, wired into `AuthModule`, and called from the live auth flows. SMS and push
channels are 📄 **planned** (OneSignal supports them, but no code sends via those
channels today).

Source of truth for this document:
- `backend/src/mail/mail.module.ts`
- `backend/src/mail/mail.service.ts`
- `backend/src/config/configuration.ts` (the `oneSignal` config group)
- `backend/src/auth/auth.service.ts` (the callers)
- `backend/.env` (env var names in use)

> ⚠️ **Reconciliation note.** This PRD documents what the code actually does. Two
> assumptions in the original task brief did not match the implementation and are
> flagged inline below:
> 1. **`EMAIL_USER` is *not* used by the mail code.** Neither `MailService` nor the
>    `oneSignal` config group reads `EMAIL_USER` (nor `smtp.from`). The "from"
>    address is configured in the OneSignal dashboard, not in `.env`. `EMAIL_USER`
>    is present in `.env` but currently a dead/informational variable.
> 2. **The base-URL env var is `ONESIGNAL_URL` (or `ONESIGNAL_BASE_URL`).** Config
>    reads `ONESIGNAL_BASE_URL` first, then falls back to `ONESIGNAL_URL`, then to
>    the hardcoded default. The committed `.env` uses `ONESIGNAL_URL`.

---

## Configuration

### Environment variables

| Env var | Required | Maps to | Notes |
|---------|----------|---------|-------|
| `ONESIGNAL_APP_ID` | Yes (to send) | `configuration.oneSignal.appId` | OneSignal application ID (UUID). |
| `ONESIGNAL_API_KEY` | Yes (to send) | `configuration.oneSignal.apiKey` | OneSignal **REST API Key**; sent as `Authorization: Key <apiKey>`. |
| `ONESIGNAL_BASE_URL` | No | `configuration.oneSignal.baseUrl` | Preferred base-URL var. Falls back to `ONESIGNAL_URL`. |
| `ONESIGNAL_URL` | No | `configuration.oneSignal.baseUrl` | Fallback base-URL var (the one used in the committed `.env`). Defaults to `https://api.onesignal.com`. |
| `EMAIL_USER` | No | *(not read)* | ⚠️ Present in `.env` but **not consumed** by the mail code. Sender identity is set in the OneSignal dashboard. |
| `REQUIRE_EMAIL_VERIFICATION` | No | `configuration.requireEmailVerification` | `'true'` to enable email verification; currently `false` (non-blocking). |

### Config group (`configuration.ts`)

```typescript
oneSignal: {
  appId: process.env.ONESIGNAL_APP_ID || '',
  apiKey: process.env.ONESIGNAL_API_KEY || '',
  baseUrl:
    process.env.ONESIGNAL_BASE_URL ||
    process.env.ONESIGNAL_URL ||
    'https://api.onesignal.com',
},
```

### Graceful degradation (no-op without credentials)

`MailService.sendEmail()` checks for `appId` **and** `apiKey` before making any HTTP
call. If either is missing, it **logs a warning and returns `false`** — it never
throws. This means:

- The API boots and runs normally with no OneSignal credentials configured.
- Auth flows (register/login) are unaffected by missing mail config.
- A missing-config send is observable in logs:
  `OneSignal not configured — skipping email "<subject>" to <recipient>`.

> ⚠️ **Security note for the owner.** `backend/.env` currently contains
> **live-looking `ONESIGNAL_APP_ID` and `ONESIGNAL_API_KEY` values committed in
> plaintext**, alongside a live MongoDB connection string and JWT secrets. Recommend
> rotating these secrets and ensuring `.env` is git-ignored / moved to a secrets
> manager before production.

---

## Module & API Surface

### `MailModule`

A minimal provider module that exports `MailService` for injection by other modules
(currently `AuthService`).

```typescript
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
```

### `MailService` — public methods

All methods are `async` and return `Promise<boolean>` (`true` on a successful send,
`false` if not configured or the send failed). None of them throw on transport
failure.

```typescript
interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
}

sendEmail(params: SendEmailParams): Promise<boolean>;
sendWelcomeEmail(user: { email: string; firstName?: string }): Promise<boolean>;
sendVerificationEmail(user: { email: string; firstName?: string }, token: string): Promise<boolean>;
sendPasswordResetEmail(user: { email: string; firstName?: string }, token: string): Promise<boolean>;
```

- `sendEmail` — low-level primitive; every other method composes an HTML body and
  delegates to it.
- The templated helpers default a missing `firstName` to `"there"`.

### OneSignal REST call

`sendEmail` issues a single `POST` to `<baseUrl>/notifications`:

**Request**
```http
POST https://api.onesignal.com/notifications
Content-Type: application/json
Authorization: Key <ONESIGNAL_API_KEY>
```
```json
{
  "app_id": "<ONESIGNAL_APP_ID>",
  "email_subject": "<subject>",
  "email_body": "<htmlBody>",
  "include_email_tokens": ["<recipient email>"],
  "target_channel": "email"
}
```

**Behaviour on response**
- `2xx` → logs `Email "<subject>" sent to <recipient>` and returns `true`.
- Error → logs `Failed to send email "<subject>" to <recipient>: <error body|message>`
  (uses `error.response.data` when present, else `error.message`) and returns
  `false`. The error is swallowed — it is **not** rethrown.

> Note: `include_email_tokens` targets recipients by email address, which requires
> the OneSignal app to be set up for the transactional email channel (email address
> tokens enabled). No SMS/push fields are sent.

---

## Usage in the Auth Flow

`MailService` is injected into `AuthService` (`backend/src/auth/auth.service.ts`).
All sends are **best-effort / non-blocking** — the calls are fire-and-forget with a
`.catch(() => undefined)`, so a mail failure never blocks or fails
registration/login.

| Trigger | Method called | Blocking? |
|---------|---------------|-----------|
| `POST /api/v1/auth/register` (always) | `sendWelcomeEmail` | No — fire-and-forget. |
| `POST /api/v1/auth/register` **only when** `REQUIRE_EMAIL_VERIFICATION=true` | `sendVerificationEmail` (with a freshly generated 6-hex-char uppercase token, 1-hour expiry) | No — fire-and-forget. |
| Password reset request | `sendPasswordResetEmail` | 📄 Planned — helper exists; not yet wired to a live endpoint (see PRD 01 open decisions). |

Notes:
- **Welcome email** fires on every successful registration regardless of the
  verification flag.
- **Verification email** only fires when `REQUIRE_EMAIL_VERIFICATION=true`. With the
  current `.env` (`false`), no verification email is sent and login is **not** gated
  on a verified email.
- **Password reset:** `sendPasswordResetEmail` is implemented but the
  forgot/reset-password endpoints themselves are still 📄 planned in PRD 01, so this
  send is not yet reachable from a live route.

---

## Email Templates

All templates are inline HTML built in `MailService` (no external template engine).
The visual style is a simple `Arial`, dark-text `<div>`. Sender name/address comes
from the OneSignal dashboard configuration.

| Template | Subject | Trigger | Status |
|----------|---------|---------|--------|
| Welcome | `Welcome to Bennie Connect` | Successful registration | ✅ Live |
| Email verification | `Verify your Bennie Connect email` | Registration when `REQUIRE_EMAIL_VERIFICATION=true`; contains the verification token | ✅ Built (gated off by default) |
| Password reset | `Reset your Bennie Connect password` | Password-reset request; contains the reset token | ✅ Helper built / 📄 endpoint pending |

Both the verification and reset templates render the **token as plain text** for the
user to enter (there is no click-through link in the current templates).

---

## Setup Guide

1. **Create/locate the OneSignal app.** In the OneSignal dashboard, create an app (or
   use an existing one) and enable the **Email** channel; configure the verified
   sender address/name there (this replaces `EMAIL_USER` / `SMTP_FROM`).
2. **Get the App ID.** Dashboard → **Settings → Keys & IDs → OneSignal App ID**.
3. **Get the REST API Key.** Same **Keys & IDs** page → **REST API Key**. This is the
   value used as `Authorization: Key <apiKey>`.
4. **Add to `backend/.env`:**
   ```dotenv
   ONESIGNAL_APP_ID=<your-app-id>
   ONESIGNAL_API_KEY=<your-rest-api-key>
   ONESIGNAL_URL=https://api.onesignal.com   # optional; this is the default
   REQUIRE_EMAIL_VERIFICATION=false          # keep false to leave verification non-blocking
   ```
5. **Restart** the API. With valid credentials, registration will start delivering
   welcome emails; with credentials missing, the app still runs and logs a skip
   warning.
6. **(Optional) Enable verification.** Set `REQUIRE_EMAIL_VERIFICATION=true` to have
   registration issue and email a verification token. Note this is still not enforced
   on login — see PRD 01 open decision on whether/when to make verification blocking.

Reference: OneSignal REST API docs — <https://documentation.onesignal.com/reference/create-notification>

---

## Status Summary

| Capability | Status |
|------------|--------|
| Transactional email via OneSignal REST | ✅ Implemented |
| Graceful no-op when unconfigured | ✅ Implemented |
| Welcome email on register | ✅ Implemented |
| Verification email (gated by `REQUIRE_EMAIL_VERIFICATION`) | ✅ Implemented (off by default) |
| Password-reset email helper | ✅ Implemented (endpoint 📄 pending) |
| Blocking email verification on login | 📄 Planned / owner decision |
| Click-through links in templates (vs plain token) | 📄 Planned |
| SMS channel | 📄 Planned |
| Push notification channel | 📄 Planned |

---

## Open Questions for the Owner

1. **Secrets in VCS:** rotate the OneSignal keys, Mongo URI, and JWT secrets that are
   currently committed in `backend/.env`, and move them out of the repo.
2. **Dead env var:** should `EMAIL_USER` be removed, or wired into an
   `email_from`/sender config for OneSignal (it is currently ignored)?
3. **Verification enforcement:** flip `REQUIRE_EMAIL_VERIFICATION` to `true` before
   production, and decide whether verification blocks login (aligns with PRD 01).
4. **Templates:** replace the plain-token verification/reset emails with
   click-through links, and consider externalizing templates from `MailService`.
