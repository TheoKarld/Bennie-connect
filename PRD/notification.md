# PRD: Notification Engine & Real-time Delivery

## Overview

The **notification engine** is Bennie-connect's single point of truth for delivering
in-app and out-of-app notifications to both **end users** (the farmer app) and
**admins** (the `/bennie` admin portal). It fans one logical notification out over
**two transports**:

- **socket.io** — in-app real-time delivery while a browser tab is open (live bell
  updates + user↔admin support messaging). Full gateway spec: [`PRD/socket.io.md`](socket.io.md).
- **Firebase Cloud Messaging (FCM) web push** — background/out-of-app push when the
  tab is closed (or the app is not focused).

Both transports are fronted by a **single backend `NotificationService`** whose
`notify()` / `notifyAdmins()` methods do the same three steps every time:

1. **Persist** the notification to the `notifications` collection (durable inbox).
2. **Emit** it over socket.io to the recipient's room (live in-app delivery).
3. **Push** it via FCM to the recipient's registered device tokens (best-effort).

Like `MailService` (see [`PRD/oneSignal.md`](oneSignal.md)), the FCM leg is a
**graceful no-op when credentials are absent** — the engine persists + emits
normally, logs a warning, and never throws. Missing Firebase config must not break
signup, the API boot, or any caller.

**Status:** 📄 **To be built.** No `NotificationService`, `FcmService`,
`notifications`/`deviceTokens` collections, socket gateway, or `firebase-messaging-sw.js`
exist on disk today. The frontend currently shows a **client-only mock** bell fed by
`FarmerNotification` in `localStorage` (`src/store/appStore.ts`, `src/types.ts:145`) —
this PRD supersedes that with a server-backed model. This document is the build
contract.

Source-of-truth references for this document:
- `backend/src/mail/mail.service.ts` — the no-op-without-creds pattern to mirror.
- `backend/src/auth/auth.service.ts` — `register()`, the one wired trigger this phase.
- `backend/src/admin/schemas/admin-user.schema.ts` — admin recipients (`isActive`, `isBanned`).
- `backend/src/config/configuration.ts` — the config group to extend (`firebase`).
- `backend/src/auth/strategies/jwt.strategy.ts` · `backend/src/admin/strategies/admin-jwt.strategy.ts` — the dual-plane JWT scopes reused by the socket gateway.
- `src/types.ts` (`FarmerNotification`), `src/store/appStore.ts` (`appendNotification`) — the client mock being replaced.
- `src/components/layout/AppShell.tsx` (user bell, unread count) · `src/components/admin/AdminLayout.tsx` (admin bell) — the UIs that will consume this.

> ⚠️ **Reconciliation note (drift flags).**
> 1. The user bell computes its unread count client-side from `localStorage`
>    (`AppShell.tsx:66`: `state.notifications.filter(n => !n.isRead)`). Once the
>    server-backed engine ships, the bell should source both the list and the unread
>    count from `/api/v1/notifications` + `notification:unread_count` socket events,
>    not from `appStore`. The mock (`FarmerNotification`, §1.7 of `data_structure.md`)
>    stays only as an offline/seed fallback.
> 2. The admin bell (`AdminLayout.tsx`) is presently a **placeholder** ("Admin
>    notifications activate as approval queues…"). The **user.signup** trigger below
>    is the first real feed for it.
> 3. `configuration.ts` has **no `firebase` group yet** — it must be added (see
>    the env-var table). FCM server creds are **individual env vars**, not a JSON
>    blob.

---

## Two Transports — When Each Fires

| Transport | Fires when | Payload lives | Auth plane | Spec |
|-----------|-----------|---------------|------------|------|
| **socket.io** | recipient has ≥1 open tab connected to their namespace/room | in-memory event `notification:new` (+ `notification:unread_count`) | user JWT (`/rt/user`) or admin JWT (`/rt/admin`) | [`socket.io.md`](socket.io.md) |
| **FCM web push** | recipient's tab is closed / app not focused; and they opted in (registered a device token) | browser Push API → `firebase-messaging-sw.js` service worker | device token bound to a user/admin | this doc |
| **Persisted inbox** | **always** (both above are transient; the `notifications` doc is the durable record) | MongoDB `notifications` collection | fetched via REST with the plane's JWT | this doc |

- **Both transports are best-effort and additive.** A notification is considered
  *delivered enough* once it is **persisted**; socket + FCM are convenience layers.
- **Web push is opt-in** for **both** users and admins. Each opts in from their own
  bell (browser permission prompt → FCM token → `POST …/device-tokens`). Only the
  **admin-signup push** is wired this phase (see Scope), but the opt-in mechanics are
  built for both planes.

---

## Scope (this phase)

The engine is **fully built for both planes** (user + admin), but the **only wired
trigger** is:

> **New user signup → notify all active, non-banned admins** (in-app socket emit +
> FCM web push), via `AuthService.register()` → `NotificationService.notifyAdmins('user.signup', …)`.

Everything else — per-user notifications, other admin events, and other modules
calling `notify()` — is **built but dormant** until those modules wire their calls.
See the [Triggers Matrix](#triggers-matrix).

---

## Data Model

### `notifications` collection 📄

One document per delivered notification, for **either** plane. The recipient plane is
disambiguated by `audience` + (`userId` xor `adminId`).

```jsonc
// notifications document
{
  "_id": "ObjectId",                       // auto
  "audience": ["user", "admin"],           // which plane this notification belongs to
  "userId": "ObjectId",                    // set when audience === "user"; ref "users", indexed
  "adminId": "ObjectId",                   // set when audience === "admin"; ref "adminUsers", indexed
  "event": "string",                       // machine key, e.g. "user.signup" (see Triggers Matrix)
  "type": ["info", "success", "warning", "alert"],  // UI severity — mirrors FarmerNotification.type (§1.7)
  "title": "string",                       // short headline
  "message": "string",                     // body text
  "data": "Record<string, any>",           // optional; event payload (e.g. { newUserId, email, name })
  "link": "string",                        // optional; deep-link the bell/FCM click opens (e.g. "/bennie/users/<id>")
  "isRead": "boolean",                     // default false
  "readAt": "Date",                        // optional; set on markRead
  "channels": {                            // per-transport delivery outcome (observability)
    "socket": "boolean",                   //   emitted to ≥1 live socket
    "push":   "boolean"                    //   FCM accepted ≥1 token (best-effort)
  },
  "createdAt": "Date",                     // auto (timestamps)
  "updatedAt": "Date"                      // auto (timestamps)
}
```

- **Indexes:** compound `{ audience: 1, userId: 1, createdAt: -1 }` and
  `{ audience: 1, adminId: 1, createdAt: -1 }` (inbox listing, newest first);
  partial `{ audience: 1, adminId: 1, isRead: 1 }` / `{ audience: 1, userId: 1, isRead: 1 }`
  (unread-count); single `event`.
- **Validation:** exactly one of `userId` / `adminId` is set, matching `audience`.
- **Retention:** none this phase (owner decision — see Open Questions re a TTL/archival).

### `deviceTokens` collection 📄

Registered FCM web-push tokens. One document per (owner, token). Owned by a **user**
or an **admin** — never both.

```jsonc
// deviceTokens document
{
  "_id": "ObjectId",                       // auto
  "audience": ["user", "admin"],           // owner plane
  "userId": "ObjectId",                    // set when audience === "user"; ref "users", indexed
  "adminId": "ObjectId",                   // set when audience === "admin"; ref "adminUsers", indexed
  "token": "string",                       // FCM registration token; unique, indexed
  "userAgent": "string",                   // optional; captured at registration
  "lastSeenAt": "Date",                    // optional; refreshed on re-register / successful push
  "isActive": "boolean",                   // default true; set false when FCM reports the token stale
  "createdAt": "Date",                     // auto (timestamps)
  "updatedAt": "Date"                      // auto (timestamps)
}
```

- **Indexes:** unique `token`; compound `{ audience: 1, userId: 1 }` and
  `{ audience: 1, adminId: 1 }` (fan-out lookup at push time).
- **Stale-token pruning:** when FCM returns `messaging/registration-token-not-registered`
  (or `invalid-registration-token`) for a token, `FcmService` marks it
  `isActive: false` (or deletes it) so it is skipped next time.
- **Opt-out:** `DELETE …/device-tokens/:token` removes the row (used on explicit
  opt-out and on logout).

---

## Backend Services

### `NotificationService` — API surface 📄

The single engine every caller (and every REST controller) goes through. Persist →
emit → push, in that order; the push leg is fire-and-forget.

```typescript
type Audience = 'user' | 'admin';

interface NotifyInput {
  event: string;                       // e.g. "user.signup"
  type?: 'info' | 'success' | 'warning' | 'alert';   // default "info"
  title: string;
  message: string;
  data?: Record<string, any>;
  link?: string;
}

class NotificationService {
  // ── Emit (persist + socket + FCM) ──────────────────────────────
  // Notify a single end user.
  notify(userId: string, input: NotifyInput): Promise<NotificationDoc>;

  // Notify every ACTIVE, NON-BANNED admin (fan-out). Persists one doc per admin,
  // emits to the `admins` room, and FCM-multicasts to all admin device tokens.
  notifyAdmins(input: NotifyInput): Promise<{ count: number }>;

  // ── Inbox reads ────────────────────────────────────────────────
  list(
    audience: Audience,
    ownerId: string,
    opts: { page?: number; limit?: number; unreadOnly?: boolean },
  ): Promise<{ items: NotificationDoc[]; total: number; page: number; limit: number; unreadCount: number }>;

  unreadCount(audience: Audience, ownerId: string): Promise<number>;

  // ── Inbox writes ───────────────────────────────────────────────
  markRead(audience: Audience, ownerId: string, notificationId: string): Promise<NotificationDoc>;
  markAllRead(audience: Audience, ownerId: string): Promise<{ modified: number }>;

  // ── Device tokens (web-push opt-in) ────────────────────────────
  registerDeviceToken(
    audience: Audience,
    ownerId: string,
    token: string,
    userAgent?: string,
  ): Promise<DeviceTokenDoc>;          // upsert by token; rebinds owner + reactivates
  removeDeviceToken(audience: Audience, ownerId: string, token: string): Promise<void>;
}
```

- **`notifyAdmins`** resolves recipients from `adminUsers` filtered
  `{ isActive: true, isBanned: { $ne: true } }` (mirrors the admin-JWT strategy's
  own checks — `admin-jwt.strategy.ts` rejects `isBanned`/`!isActive`). It writes one
  `notifications` doc per admin (so per-admin read state works), then emits **once**
  to the shared `admins` socket room and multicasts FCM to the union of those admins'
  device tokens.
- **Pagination** defaults: `page = 1`, `limit = 20` (max `100`). `unreadCount` is
  returned alongside the page so the bell can render both in one round-trip.
- **Ownership is enforced** — `markRead`/`list` scope every query by
  `audience` + `ownerId`; a user can never read/mark an admin's notification.
- After any state change (`notify`, `markRead`, `markAllRead`), the service **emits a
  fresh `notification:unread_count`** to the affected room so all the recipient's open
  tabs stay in sync.

### `FcmService` — web push (firebase-admin) 📄

Wraps `firebase-admin` messaging. Mirrors `MailService` exactly: check creds →
no-op-with-warning if absent → best-effort send that never throws.

```typescript
class FcmService {
  // Lazily initializes the firebase-admin app from the three env vars (below).
  // If any is missing, isConfigured() === false and every send is a logged no-op.
  isConfigured(): boolean;

  // Multicast to many tokens (used by notifyAdmins). Returns per-token results so the
  // caller can prune stale tokens. Never throws on transport failure.
  sendToTokens(
    tokens: string[],
    payload: { title: string; body: string; data?: Record<string, string>; link?: string },
  ): Promise<{ successCount: number; failureCount: number; staleTokens: string[] }>;
}
```

**Graceful degradation (no-op without credentials).** `FcmService` checks for
`FIREBASE_PROJECT_ID` **and** `FIREBASE_CLIENT_EMAIL` **and** `FIREBASE_PRIVATE_KEY`
before initializing `firebase-admin`. If any is missing it **logs a warning and
returns a zero-result** — it never throws. Therefore:

- The API boots and runs with no Firebase config.
- Signup (and `notifyAdmins`) still **persist + socket-emit** normally; only the push
  leg is skipped.
- A missing-config send is observable:
  `Firebase not configured — skipping web push "<title>" to <n> token(s)`.

> ⚠️ **`FIREBASE_PRIVATE_KEY` newline handling.** The PEM private key contains `\n`.
> When stored in `.env` as a single line with literal `\n`, the loader must
> `key.replace(/\\n/g, '\n')` before passing it to `admin.credential.cert(...)`.
> Document this so the owner's supplied key works.

---

## REST Endpoints

Two mirrored surfaces — one per plane. **User** endpoints are guarded by the user
`JwtAuthGuard` (`scope: "user"`); **admin** endpoints by the `AdminJwtGuard`
(`scope: "admin"`). All responses use the standard success envelope
`{ success, message?, data }` (§2.3 of `data_structure.md`).

### User plane — base `/api/v1/notifications`

| Method | Path | Purpose | Body / Query |
|--------|------|---------|--------------|
| `GET` | `/notifications` | List the caller's notifications (paginated, newest first) | `?page&limit&unreadOnly` |
| `GET` | `/notifications/unread-count` | Unread count for the bell badge | — |
| `PATCH` | `/notifications/:id/read` | Mark one as read | — |
| `PATCH` | `/notifications/read-all` | Mark all the caller's as read | — |
| `POST` | `/notifications/device-tokens` | Register an FCM web-push token (opt-in) | `{ "token": "string", "userAgent"?: "string" }` |
| `DELETE` | `/notifications/device-tokens/:token` | Remove a token (opt-out / logout) | — |

### Admin plane — base `/api/v1/admin/notifications` + `/api/v1/admin/device-tokens`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/admin/notifications` | List the calling admin's notifications (paginated) |
| `GET` | `/admin/notifications/unread-count` | Unread count for the admin bell |
| `PATCH` | `/admin/notifications/:id/read` | Mark one as read |
| `PATCH` | `/admin/notifications/read-all` | Mark all as read |
| `POST` | `/admin/device-tokens` | Register an admin FCM token (opt-in) |
| `DELETE` | `/admin/device-tokens/:token` | Remove an admin token |

**Example — `GET /api/v1/admin/notifications?page=1&limit=20`**

```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "665f…",
        "audience": "admin",
        "adminId": "665a…",
        "event": "user.signup",
        "type": "info",
        "title": "New farmer signed up",
        "message": "Aisha Bello (aisha@example.com) just created an account.",
        "data": { "newUserId": "USR_1720…", "email": "aisha@example.com" },
        "link": "/bennie/users/USR_1720…",
        "isRead": false,
        "channels": { "socket": true, "push": false },
        "createdAt": "2026-07-02T09:14:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "unreadCount": 7
  }
}
```

**Error codes (both planes):**

| HTTP | When |
|------|------|
| `401 Unauthorized` | missing/invalid/wrong-scope JWT |
| `403 Forbidden` | admin endpoint hit with a user token (or vice-versa) — scope mismatch |
| `404 Not Found` | `:id` not found **or not owned by the caller** (no cross-owner leakage) |
| `400 Bad Request` | missing `token` on device-token registration |

---

## Wired Flow — Signup → Admin Notification (end to end)

The single live trigger this phase. Everything is **non-blocking / best-effort** —
identical fire-and-forget discipline to the welcome email in `register()`
(`auth.service.ts:89`, `.catch(() => undefined)`), so a notification failure never
blocks or fails registration.

```
POST /api/v1/auth/register
        │
        ▼
AuthService.register()                     [backend/src/auth/auth.service.ts]
  1. usersService.create(...)              (new farmer persisted)
  2. issueTokens(...)
  3. sendWelcomeEmail(...).catch(...)      (existing, unchanged)
  4. notificationService                   ◄── NEW (fire-and-forget)
       .notifyAdmins({
         event: 'user.signup',
         type:  'info',
         title: 'New farmer signed up',
         message: `${firstName} ${lastName} (${email}) just created an account.`,
         data:  { newUserId, email, name },
         link:  `/bennie/users/${newUserId}`,
       })
       .catch(() => undefined)
        │
        ▼
NotificationService.notifyAdmins('user.signup', …)
  a. recipients = adminUsers.find({ isActive: true, isBanned: { $ne: true } })
  b. PERSIST  one `notifications` doc per admin (audience:"admin", adminId, event…)
  c. SOCKET   emit `notification:new` to the `admins` room  (see socket.io.md)
              + emit `notification:unread_count` per-admin room
  d. FCM      collect those admins' active deviceTokens → FcmService.sendToTokens(...)
              (best-effort; prune stale tokens; skipped entirely if Firebase unconfigured)
```

- **Ordering:** persist first (durable), then socket (live tabs), then FCM
  (background). A live admin sees the bell update instantly via socket; an offline
  admin who opted into push gets a web-push; either way the record is in their inbox
  on next `GET /admin/notifications`.
- **No admins / no tokens / no Firebase creds:** each leg degrades independently —
  zero admins ⇒ no docs; zero tokens or no creds ⇒ no push; the flow still completes
  and `register()` returns normally.

---

## Triggers Matrix

Only **`user.signup`** is wired this phase. The remaining rows are the **planned**
call-sites for other modules — the engine already supports them; each module wires
its own `notify()`/`notifyAdmins()` later.

| Event key | Fires on | Audience | Transports | Status |
|-----------|----------|----------|------------|--------|
| `user.signup` | `AuthService.register()` success | **admins** (active, non-banned) | in-app + web push | ✅ **wired this phase** |
| `wallet.deposit.success` | SeerBit deposit settled (PRD 02) | user | in-app + push | 📄 planned |
| `wallet.withdrawal.status` | withdrawal approved/rejected/paid (PRD 02) | user | in-app + push | 📄 planned |
| `savings.matured` | fixed/harvest plan matures (PRD 04) | user | in-app + push | 📄 planned |
| `shares.dividend.paid` | dividend distributed (PRD 05) | user | in-app + push | 📄 planned |
| `booking.status` | equipment/service booking advances (PRD 06/07) | user | in-app + push | 📄 planned |
| `order.status` | e-commerce order advances (PRD 08) | user | in-app + push | 📄 planned |
| `adashe.payout` | Adashe rotation payout due (PRD 09) | user | in-app + push | 📄 planned |
| `commission.paid` | agent commission settled (PRD 10) | user (agent) | in-app + push | 📄 planned |
| `support.message` | user sends a support message | admins | in-app (socket) | 📄 planned (see `socket.io.md`) |
| `kyc.submitted` | user submits KYC (admin_module) | admins | in-app + push | 📄 planned |
| `withdrawal.requested` | user requests payout (admin_module approvals) | admins | in-app + push | 📄 planned |

---

## Configuration

### Environment variables

FCM has a **server** credential (backend, `firebase-admin`) and a **client**
credential (frontend, Firebase JS SDK). The server credential is held as **three
individual env vars** — **not** a JSON blob — matching the owner's decision.

**Backend (`backend/.env`) — server credential**

| Env var | Required | Maps to | Notes |
|---------|----------|---------|-------|
| `FIREBASE_PROJECT_ID` | Yes (to push) | `configuration.firebase.projectId` | Firebase project ID. |
| `FIREBASE_CLIENT_EMAIL` | Yes (to push) | `configuration.firebase.clientEmail` | Service-account email. |
| `FIREBASE_PRIVATE_KEY` | Yes (to push) | `configuration.firebase.privateKey` | Service-account PEM key; **`\n` must be un-escaped** at load (see `FcmService`). Placeholder — owner supplies. |

**Frontend (`.env`, root) — client credential (all `VITE_`-prefixed so Vite exposes them)**

| Env var | Required | Notes |
|---------|----------|-------|
| `VITE_FIREBASE_API_KEY` | Yes (to receive push) | Firebase Web API key. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | `<project>.firebaseapp.com`. |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID (same project as server). |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | FCM sender ID. |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase web app ID. |
| `VITE_FIREBASE_VAPID_KEY` | Yes | Web Push (VAPID) public key from Firebase → Cloud Messaging → Web configuration. |

### Config group to add (`configuration.ts`)

The `firebase` group must be **added** to `registerAs('configuration', …)` (it does
not exist today):

```typescript
firebase: {
  projectId:   process.env.FIREBASE_PROJECT_ID || '',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  // Un-escape literal "\n" so the PEM parses correctly.
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
},
```

> ⚠️ **Security note for the owner.** As with the OneSignal keys already committed in
> `backend/.env` (flagged in `oneSignal.md`), the Firebase service-account key is a
> high-value secret — keep `FIREBASE_PRIVATE_KEY` out of version control and move it
> to a secrets manager before production. The `VITE_FIREBASE_*` client values are
> **not** secrets (they ship in the browser bundle by design) but should still be
> restricted via Firebase console API-key restrictions.

---

## Service Worker — Query-Param Config Strategy (required)

FCM background/web push requires a service worker at **`public/firebase-messaging-sw.js`**
served from the site root. **Requirement:** the SW must **not** hard-code any Firebase
keys. Instead it reads its config from **query params** on its own registration URL.

- **Register** the worker with the client config in the query string:
  ```js
  navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?apiKey=${apiKey}&authDomain=${authDomain}` +
    `&projectId=${projectId}&messagingSenderId=${senderId}&appId=${appId}`
  );
  ```
- **Inside the worker**, read them back off its own location:
  ```js
  const params = new URL(self.location).searchParams;
  firebase.initializeApp({
    apiKey: params.get('apiKey'),
    authDomain: params.get('authDomain'),
    projectId: params.get('projectId'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId'),
  });
  ```

**Rationale.** A service worker is a **static, publicly fetchable file** at a fixed
URL — Vite's `import.meta.env` / `VITE_*` inlining does **not** apply to files in
`public/`, and committing keys there would bake them into a cacheable static asset.
Passing config via query params keeps the SW file **key-free and identical across
environments**; the values come from the app's own `VITE_FIREBASE_*` env at
registration time. (The values are non-secret client config, but this also avoids a
stale-cache mismatch when keys change and keeps `public/` clean.)

> Note: the browser treats each distinct query string as a distinct SW script URL, so
> changing config re-registers cleanly rather than serving a stale cached worker.

---

## Frontend — CSP additions

Web push + Firebase + the socket connection require the frontend
**Content-Security-Policy** (introduced for the auth hardening in §5.1 of
`data_structure.md`) to allow these origins:

| Directive | Add | Why |
|-----------|-----|-----|
| `connect-src` | `https://fcm.googleapis.com` `https://*.googleapis.com` `https://*.firebaseinstallations.googleapis.com` | FCM registration/send + Firebase Installations |
| `connect-src` | `wss://<api-host>` (the socket.io endpoint) | live socket transport (WebSocket) |
| `worker-src` | `'self'` | allow registering `firebase-messaging-sw.js` |
| `script-src` | `'self'` (+ the Firebase SDK origin if loaded from CDN rather than bundled) | Firebase JS SDK |

Keep the rest of the CSP as tight as the auth hardening specifies; only add the
origins above.

---

## Graceful-Degradation Summary

| Condition | Behaviour |
|-----------|-----------|
| Firebase server creds absent | `FcmService` no-ops with a warning; persist + socket still run; API boots fine |
| Firebase client creds absent | frontend skips SW registration + push opt-in; in-app socket bell still works |
| Socket gateway down / no open tab | notification still **persisted** + FCM push still attempted; user sees it in the inbox on next load |
| Admin has no device tokens | signup push skipped for that admin; in-app + inbox unaffected |
| Zero active admins | `notifyAdmins` writes 0 docs and returns `{ count: 0 }`; `register()` unaffected |
| FCM returns stale-token error | token marked `isActive: false` / pruned; other tokens unaffected |

---

## Status Summary

| Capability | Status |
|------------|--------|
| `notifications` + `deviceTokens` collections | 📄 To build |
| `NotificationService` (persist + socket + FCM fan-out) | 📄 To build |
| `FcmService` (firebase-admin, graceful no-op) | 📄 To build |
| User + admin REST endpoints (list / unread / read / device-tokens) | 📄 To build |
| socket.io real-time delivery | 📄 To build — see [`socket.io.md`](socket.io.md) |
| `firebase-messaging-sw.js` (query-param config) | 📄 To build |
| **`user.signup` → notify admins** (in-app + push) | 📄 To build — **only wired trigger this phase** |
| Web-push opt-in (user + admin bells) | 📄 To build (mechanics both planes; only admin-signup push exercised) |
| All other triggers (wallet/savings/orders/…) | 📄 Planned (engine ready; calls unwired) |

---

## Open Questions for the Owner

1. **Multi-instance scale (Redis adapter).** socket.io is single-instance now. Behind
   more than one API instance, a `notification:new` emitted on instance A won't reach a
   recipient socket connected to instance B. Adopt the socket.io **Redis adapter**
   (`@socket.io/redis-adapter`) for horizontal scale? (See `socket.io.md` for the same
   flag.) FCM is unaffected (it's stateless).
2. **Permission-scoping signup notifications.** Should `user.signup` later fan out only
   to admins holding a `users:view` (or `users:manage`) permission — rather than *all*
   active admins — once the RBAC permission taxonomy (§7 of `data_structure.md`) is
   live? Today "all active, non-banned admins" is the simple baseline.
3. **VAPID key rotation.** How is `VITE_FIREBASE_VAPID_KEY` rotated? Rotating it
   invalidates existing browser subscriptions — clients must re-register their device
   token. Define a rotation runbook (re-prompt on next load, prune old tokens).
4. **Notification retention/TTL.** No archival/TTL is specified. Cap the inbox (e.g.
   keep last N per owner, or TTL-expire read notifications after X days)?
5. **Type taxonomy alignment.** `notifications.type` reuses `FarmerNotification.type`
   (`info|success|warning|alert`). Confirm this is the canonical severity set for the
   admin bell too (it currently has none).
