# PRD: socket.io Real-time Layer

## Overview

The **socket.io layer** is Bennie-connect's in-app real-time transport. It carries two
things while a browser tab is open:

1. **Live notification delivery** — the socket half of the notification engine (server
   pushes `notification:new` / `notification:unread_count` to the recipient's bell in
   real time). Persistence + FCM web-push are documented in
   [`PRD/notification.md`](notification.md); this document specifies the socket transport.
2. **User↔admin messaging** — a lightweight support channel: a user sends
   `support:message` (fanned to admins); an admin replies `support:reply` (routed back
   to that one user).

socket.io is the **in-app / tab-open** transport; **FCM web push** covers the
**background / tab-closed** case. Both are fronted by the single backend
`NotificationService` (see `notification.md`) — the gateway is the emit target, not a
second source of truth. When no tab is connected, nothing is lost: the notification is
still persisted and (if opted-in) pushed via FCM.

**Status:** 📄 **To be built.** No socket gateway, `IoAdapter` wiring, or namespaces
exist on disk. This document is the build contract, mirroring the dual-plane JWT auth
already implemented for HTTP (`backend/src/auth/strategies/jwt.strategy.ts`,
`backend/src/admin/strategies/admin-jwt.strategy.ts`).

Source-of-truth references:
- `backend/src/auth/strategies/jwt.strategy.ts` — user JWT (`scope: "user"`), rejects non-user scopes.
- `backend/src/admin/strategies/admin-jwt.strategy.ts` — admin JWT (`scope: "admin"`), rejects `isBanned`/`!isActive`.
- `backend/src/config/configuration.ts` — `jwt.secret` / `adminJwt.secret`, `cors.origin`.
- `PRD/notification.md` — the engine that emits over this layer.
- `data_structure.md` §5.1 — the dual-session (`userToken` / `adminToken`, `scope`) model this mirrors.

---

## Gateway Design

- **Stack:** NestJS `@nestjs/websockets` + `@nestjs/platform-socket.io` (socket.io v4).
- **Adapter:** a custom `IoAdapter` is registered in `main.ts` (`app.useWebSocketAdapter(new IoAdapter(app))`)
  so socket.io shares the same HTTP server + port as the REST API (default `5566`,
  `configuration.port`). CORS for the WS handshake reuses `configuration.cors.origin`.
- **Gateways:** two Nest gateways (or one gateway with two `@WebSocketGateway`
  namespace declarations), one per plane — see Namespaces below. Each holds a
  `@WebSocketServer()` server handle used by `NotificationService` to emit into rooms.
- **Emit direction:** the gateway is **emit-mostly** for notifications (server→client);
  client→server events are limited to the support-messaging catalog below. All
  business writes still go through REST + `NotificationService`; sockets do not mutate
  domain state directly.

---

## Namespaces (two planes)

Isolation mirrors the dual-plane HTTP auth: a socket authenticated as a user can never
join or receive admin traffic and vice-versa.

| Namespace | Plane | Handshake JWT | Verified against |
|-----------|-------|---------------|------------------|
| `/rt/user` | end users (farmer app) | user access token (`scope: "user"`) | `configuration.jwt.secret`; reject if `scope !== "user"` |
| `/rt/admin` | admins (`/bennie` portal) | admin access token (`scope: "admin"`) | `configuration.adminJwt.secret`; reject if `scope !== "admin"` |

- The two namespaces have **separate connection guards** and **separate room
  keyspaces** — there is no shared room across planes.
- This mirrors the HTTP `JwtAuthGuard` vs `AdminJwtGuard` split and the `scope`-claim
  separation from `data_structure.md` §5.1: a token minted for one plane is rejected by
  the other namespace even if otherwise valid.

---

## Handshake Authentication

The client passes its access token via socket.io's `auth.token` handshake field (not a
query string, not the `Authorization` header — socket.io's native mechanism):

```js
// user plane
const userSocket = io(`${API_HOST}/rt/user`, {
  auth: { token: localStorage.getItem('userToken') },
  withCredentials: true,
});

// admin plane
const adminSocket = io(`${API_HOST}/rt/admin`, {
  auth: { token: localStorage.getItem('adminToken') },
  withCredentials: true,
});
```

**Server-side verification** (in each namespace's connection handler / a
`WsJwtGuard`):

1. Read `client.handshake.auth.token`.
2. Verify it with `JwtService.verifyAsync` against the plane's secret
   (`configuration.jwt.secret` for `/rt/user`, `configuration.adminJwt.secret` for
   `/rt/admin`).
3. **Enforce `scope`** — `/rt/user` requires `scope: "user"`; `/rt/admin` requires
   `scope: "admin"`. (The user HTTP strategy tolerates a missing `scope` for legacy
   tokens; the socket layer should require the correct scope explicitly since it is new.)
4. Re-check liveness exactly like the HTTP strategies:
   - user: reject if the user is missing, `!isActive`, or `isSuspended`.
   - admin: reject if the admin is missing, `isBanned`, or `!isActive`.
5. On failure, **reject the connection** (emit a `connect_error` / disconnect with an
   `UnauthorizedException`-equivalent). On success, attach the identity to the socket
   (`client.data.userId` / `client.data.adminId`) and join rooms (below).

> Reconnection re-runs the handshake, so a revoked/expired access token is rejected on
> the next connect. Because access tokens are short-lived (~15 min, §5.1), the client
> should refresh its token (HTTP refresh flow) and reconnect with the new token; the
> gateway does not itself refresh tokens.

---

## Rooms

On successful connect, the gateway joins the socket to:

| Room | Plane | Members | Used for |
|------|-------|---------|----------|
| `user:<userId>` | `/rt/user` | all of one user's open tabs | per-user `notification:new`, `notification:unread_count`, `support:reply` |
| `admin:<adminId>` | `/rt/admin` | all of one admin's open tabs | per-admin `notification:unread_count`, direct admin messages |
| `admins` | `/rt/admin` | **every** connected admin | broadcast admin events (e.g. `user.signup` `notification:new`, `support:message` fan-out) |

- Per-identity rooms (`user:<id>` / `admin:<id>`) let the engine reach **all tabs** of
  one person, keeping unread counts consistent across tabs.
- The shared `admins` room is how `NotificationService.notifyAdmins(...)` broadcasts in
  a single emit (see the signup flow in `notification.md`); per-admin unread counts are
  still emitted to each `admin:<id>` room because read-state is per-admin.

---

## Event Catalog

### Server → Client (notification delivery)

| Event | Plane / target room | Payload | Emitted when |
|-------|---------------------|---------|--------------|
| `notification:new` | `user:<id>` **or** `admins` | the `notifications` doc (§ `notification.md`) | `notify()` / `notifyAdmins()` persists a new notification |
| `notification:unread_count` | `user:<id>` / `admin:<id>` | `{ "unreadCount": number }` | after any create / markRead / markAllRead affecting that owner |

### User ↔ Admin messaging (support channel) 📄 planned

Built alongside the gateway; wiring exercised later (the only *wired notification*
trigger this phase is `user.signup` — see `notification.md`).

| Event | Direction | Emitter | Target | Payload |
|-------|-----------|---------|--------|---------|
| `support:message` | user → admins | `/rt/user` client | `admins` room (`/rt/admin`) | `{ "fromUserId": string, "name": string, "message": string, "at": ISOString }` |
| `support:reply` | admin → one user | `/rt/admin` client | `user:<userId>` room | `{ "fromAdminId": string, "toUserId": string, "message": string, "at": ISOString }` |

- `support:message` also triggers a persisted **`support.message`** admin notification
  (via `NotificationService.notifyAdmins`) so an offline admin still sees it in the
  inbox / gets FCM push (planned row in the Triggers Matrix).
- `support:reply` is routed strictly to `user:<userId>` — an admin cannot broadcast to
  all users through this channel; the target user id is validated server-side against
  the reply.
- **Server validates the emitter** — `fromUserId` is taken from `client.data.userId`
  (the handshake identity), never trusted from the payload, preventing spoofing.

---

## Connection Lifecycle & Reconnection

- **Connect:** client opens the namespace with `auth.token` → server verifies →
  joins rooms → optionally emits an initial `notification:unread_count` so the bell is
  correct immediately.
- **Reconnect:** socket.io auto-reconnects with backoff; each reconnect **re-runs the
  handshake** (fresh token check + re-join rooms). The client should attach the latest
  `userToken`/`adminToken` before reconnecting (update `auth.token` in the reconnect
  handler after an HTTP token refresh).
- **Disconnect:** rooms are cleaned up automatically when the socket closes. On
  explicit logout the client disconnects the socket (in addition to clearing tokens /
  removing its FCM device token).
- **Missed events while disconnected:** none are replayed over the socket — the durable
  record is the `notifications` collection, so the client re-syncs via
  `GET …/notifications` + `…/unread-count` on (re)load.

---

## CORS & Credentials

- The WS handshake honours `configuration.cors.origin` (same allowlist as REST;
  default `['http://localhost:3000']`), with `credentials: true` so the plane's
  httpOnly refresh cookie (§5.1) rides along where needed.
- The frontend CSP must allow the WebSocket origin: `connect-src wss://<api-host>`
  (also listed in `notification.md` → CSP additions).
- Clients connect with `withCredentials: true` to match the credentialed CORS policy.

---

## Scale — Single Instance Now, Redis Adapter Later

- **Now:** a single API instance holds all sockets in memory; room emits work directly.
- **Horizontal scale:** with more than one instance, a socket connected to instance A
  won't receive an emit made on instance B. Adopt the socket.io **Redis adapter**
  (`@socket.io/redis-adapter` over an existing Redis) so room emits (`user:<id>`,
  `admin:<id>`, `admins`) propagate across instances. This is a drop-in adapter change,
  not an API change. (Same flag as `notification.md` Open Question #1.)

---

## Security Notes

- **Per-namespace scope isolation** mirrors the dual-plane HTTP auth: `/rt/user`
  accepts only `scope: "user"` tokens; `/rt/admin` only `scope: "admin"`. A stolen or
  mis-routed token for one plane cannot connect to the other.
- **Identity is server-derived** — `client.data.userId` / `client.data.adminId` come
  from the verified JWT, never from client-supplied payload fields. Message routing
  (`support:reply` → `user:<userId>`, `support:message` sender) uses the handshake
  identity.
- **Liveness re-check** at connect (and reconnect) rejects suspended/banned/deleted
  accounts, matching the HTTP strategies — a socket does not outlive an account
  suspension past its next (re)connect.
- **Short-lived access tokens** bound exposure: a leaked token can only sustain a
  socket until it expires (~15 min) and fails the next reconnect handshake.
- **No domain mutation over sockets** — the only client→server events are the support
  messages; all money/state changes go through authenticated REST.

---

## Status Summary

| Capability | Status |
|------------|--------|
| Nest socket.io gateway + `IoAdapter` on the API port | 📄 To build |
| `/rt/user` + `/rt/admin` namespaces with scoped JWT handshake | 📄 To build |
| Rooms `user:<id>` / `admin:<id>` / `admins` | 📄 To build |
| `notification:new` / `notification:unread_count` (server→client) | 📄 To build |
| `support:message` / `support:reply` (user↔admin) | 📄 To build (wired later) |
| Redis adapter for multi-instance scale | 📄 Planned / owner decision |

---

## Open Questions for the Owner

1. **Redis adapter** for horizontal scale (mirrors `notification.md` #1) — adopt now
   or defer until multi-instance?
2. **Support messaging persistence** — should `support:message` / `support:reply` be
   stored in a dedicated `supportMessages` collection (chat history), or is the derived
   `support.message` admin notification sufficient for this phase?
3. **Presence / typing indicators** — out of scope now; confirm not needed for the
   support channel.
