# PRD: Operator Module — Overview & Blueprint

> **Status: 📄 planned (deferred).** This is an **overview/blueprint only** — the Operator module is
> **NOT built this phase.** It captures how a future admin-managed operator plane should work so the
> equipment GPS + booking flow can plug into it without redesign. Where this phase already needs operator
> data, it is captured **on the booking** (`operatorName`/`operatorPhone`/`operatorPlate` + a per-booking
> `trackingToken`) — see the equipment PRDs below.
>
> **Docs only.** No application code lives here.

**Cross-links**
- Admin equipment PRD (booking lifecycle, `trackingToken`, GPS oversight):
  [`PRD/admin_module/equipment_booking/equipment_booking.md`](../admin_module/equipment_booking/equipment_booking.md)
- User equipment PRD (base `Equipment` / `EquipmentBooking` schema):
  [`PRD/user_module/equipment-booking-gps/equipment-booking-gps.md`](../user_module/equipment-booking-gps/equipment-booking-gps.md)
- Real-time transport (GPS push, live map): [`PRD/socket.io.md`](../socket.io.md)
- Notifications (operator alerts): [`PRD/notification.md`](../notification.md)
- Admin RBAC / audit conventions: [`PRD/admin_module/README.md`](../admin_module/README.md)

---

## 1. Purpose & Scope

An **operator** is the person who physically drives/handles a piece of equipment for a booking (e.g. a
tractor driver). Today the platform has **no operator entity** — the user PRD's `EquipmentBooking.operator`
merely refs a `User`, and there is no admin flow to roster, assign, or track operators. This module makes
operators a **first-class, admin-managed plane** and gives them a lightweight way to **push live
geolocation** during a booking.

**In scope (future module):**
- An admin-managed `operators` collection (roster).
- Admin operator CRUD + roster/search + status management (active/suspended).
- Assignment of an operator to a booking at **approval / handover**.
- An **operator tracking app/view** where the operator authenticates (or opens a tokenized link) and
  pushes live geolocation over socket.io.
- Wiring into the **equipment GPS gateway** + **geofence alerts** and **notifications to operators**.
- Operator **ratings** and basic performance history.

**Out of scope (this overview / deferred):** payroll, operator earnings/commissions, HR records,
scheduling optimization, and operator-facing booking management beyond tracking. These are noted as
future extensions, not built.

**Relationship to this phase.** This phase (equipment module) does **not** build `operators`. It captures
operator identity **on each booking** and issues a **per-booking `trackingToken`** so an operator can push
GPS now. When this module lands, `EquipmentBooking.operatorId` will ref `operators`, and the token flow is
either kept (tokenized link) or upgraded to operator accounts — see [§7 Open Questions](#7-open-questions-for-the-owner).

---

## 2. Data Model (proposed)

### 2.1 `operators` collection 📄 (admin-owned)

```typescript
{
  _id: ObjectId;
  operatorId: string;              // unique, auto e.g. "OPR_<ts>_<rand>"
  name: string;
  phone: string;                   // unique; primary contact + login identifier candidate
  email?: string;
  photoUrl?: string;               // uploaded via /api/v1/admin/upload (URL only)
  plate?: string;                  // default vehicle/plate identifier
  licenseNumber?: string;          // driver's license / certification (optional)
  status: 'ACTIVE' | 'SUSPENDED';  // suspended operators cannot be assigned or push GPS
  suspendedReason?: string;
  suspendedAt?: Date;

  // Tracking credentials (auth model TBD — see §7)
  deviceId?: string;               // last known device pushing GPS
  trackingCredential?: {           // if operator-account model is chosen
    // e.g. hashed PIN / device pairing secret; redacted from JSON
  };

  // Assignment references (denormalized convenience; source of truth is on the booking)
  assignedEquipmentIds?: [ObjectId];   // ref: Equipment (current/last assigned units)
  activeBookingId?: ObjectId;          // ref: EquipmentBooking (current in-use booking, if any)

  // Ratings / performance
  rating?: number;                 // running average 0–5
  ratingCount?: number;
  completedBookings?: number;

  cooperativeId?: ObjectId;        // ref: Cooperative (if operators are co-op scoped — see §7)
  createdBy: ObjectId;             // ref: adminUsers
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Booking linkage (already partly in the equipment PRD)

The booking is the **source of truth** for a given assignment. From the admin equipment PRD (§2.5),
`EquipmentBooking` carries: `operatorId?` (will ref `operators`), `operatorName`/`operatorPhone`/
`operatorPlate` (captured directly this phase), and `trackingToken` (per-booking GPS auth). When this
module lands, `operatorId` becomes the canonical link and the denormalized name/phone/plate are populated
from the operator record at assignment time.

### 2.3 `operatorRating` (optional, append-only) 📄

If ratings are kept as history rather than a rollup only:

```typescript
{
  _id: ObjectId;
  operatorId: ObjectId;            // ref: operators
  bookingId: ObjectId;             // ref: EquipmentBooking
  ratedByUserId: ObjectId;         // ref: users (booking owner)
  score: number;                   // 1–5
  comment?: string;
  createdAt: Date;
}
```

---

## 3. Admin Operations (proposed endpoints)

All under `/api/v1/admin/operators`, behind the admin JWT + `PermissionsGuard`. A new permission
**resource `operators`** is proposed (actions `view|create|update|suspend|activate|assign|delete`);
`operators:delete` and `operators:suspend`/`ban`-style destructive actions follow the README's
Super-Admin-only reservation where they are destructive. **Every mutation is `adminAuditLog`-audited**
(actor, action, target, before/after, timestamp, IP, userAgent), per the admin README conventions.

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/operators` | `operators:view` | Roster list/search (filters: status, q, cooperativeId) |
| GET | `/operators/:id` | `operators:view` | Operator detail (assignments, ratings, tracking status) |
| POST | `/operators` | `operators:create` | Add an operator (name, phone, plate, photo upload URL) |
| PATCH | `/operators/:id` | `operators:update` | Edit operator fields |
| POST | `/operators/:id/suspend` | `operators:suspend` | Suspend (reason required); blocks assignment + GPS push |
| POST | `/operators/:id/activate` | `operators:activate` | Re-activate |
| DELETE | `/operators/:id` | `operators:delete` (Super-Admin-only) | Remove/retire (blocked if actively assigned) |
| POST | `/equipment/bookings/:id/assign-operator` | `operators:assign` | Assign an operator to a booking (at approve/handover); sets `operatorId`, denormalizes name/phone/plate, (re)issues `trackingToken` |

The **assignment endpoint** is the bridge to the equipment module — it is the "real" version of the
operator fields the equipment PRD currently sets inline on `approve`/`handover`.

---

## 4. Operator Tracking App / View (proposed)

A minimal operator-facing surface (mobile-first web page or lightweight app) whose **only job** is to push
live geolocation for the operator's active booking:

1. The operator opens a **tokenized link** (contains/exchanges the booking `trackingToken`) or signs into
   a lightweight operator app (auth model TBD — §7).
2. The page requests browser **geolocation** permission and streams real position over **socket.io**
   (equipment GPS gateway/namespace, `PRD/socket.io.md`), attributing each fix to the `bookingId` +
   `equipmentId` bound to the token.
3. The server persists each fix to `EquipmentBooking.gpsTracking[]`, updates
   `Equipment.gpsTracker.lastUpdateAt`, and evaluates geofence/speed/signal rules (equipment PRD §4.4),
   re-emitting to the admin live map (`/rt/admin`) and the user tracking view (`/rt/user`).
4. Push stops (and the token is revoked) at booking `complete` / `cancel` / `reject` and after
   `trackingTokenExpiresAt`.

This view carries **no** financial or admin capability — it is GPS-push only, scoped to one booking.

---

## 5. GPS Gateway & Geofence Integration

- **Transport:** socket.io, operator-push, real geolocation (no simulation) — the same locked design as
  the equipment PRD's [§3.4 GPS oversight](../admin_module/equipment_booking/equipment_booking.md#34-gps-oversight-equipmentgps).
- **Auth:** the per-booking `trackingToken` (equipment PRD §2.5.1) authorizes the operator's push; an
  invalid/expired/revoked token is rejected (`EQP_ADM_016`). A future operator-account model may pair a
  device credential in addition to (or instead of) the token.
- **Geofence alerts:** operator positions feed the existing `geofence` / `gpsAlert` machinery
  (`GEOFENCE_BREACH | OVERSPEED | SIGNAL_LOST | IDLE_ANOMALY`) unchanged — the operator module adds the
  *source* of pushes, not new alert types.

---

## 6. Notifications to Operators

Once operators exist, they become a **notification audience** (extending the two-plane
`user | admin` model in [`PRD/notification.md`](../notification.md)):

- **Assignment** — notify the operator when they are assigned to a booking (booking details, pickup
  location, `trackingToken` link).
- **Geofence / overspeed breach** — real-time nudge to the operator on their own tracking view.
- **Return due / overdue** — remind the operator to return equipment as `endDate` approaches / passes.

How operators receive notifications (SMS to `phone`, a third `operator` notification audience, or in the
tracking app only) is an **open question** — the notification engine would need an `operator` audience or
an SMS channel added. **Not built this phase.**

---

## 7. Open Questions for the Owner

1. **Operator auth model.** Lightweight **tokenized link** (per-booking `trackingToken`, no operator
   login — simplest, matches this phase) vs. **full operator accounts** (own credentials, own JWT scope
   `operator`, a third auth plane). Tokenized links are cheaper and already work this phase; accounts
   enable history, ratings tied to identity, and multi-booking dashboards. Which model?
2. **Operator identity source.** Are operators a **separate `operators` collection** (this proposal) or a
   flavor of `users` with an `operator` role? The user schema role enum is `farmer|agent|admin|
   super_admin` — adding operators there would widen it; a dedicated collection keeps planes clean
   (mirrors how `adminUsers` is separate from `users`).
3. **Cooperative scoping.** Are operators global or **per-cooperative** (`operators.cooperativeId`)?
   Ties into the same multi-tenant admin-scoping question in the equipment PRD (§Open Q3) and the README.
4. **Notification channel.** Do operators get notifications via **SMS** (they may not use the web app),
   an in-app tracking-view banner, or a new `operator` notification audience? Requires extending the
   notification engine.
5. **Ratings authorship.** Who rates operators — the booking's user, the admin, or both? Does a low
   rating auto-flag an operator for review?
6. **Permission set.** Confirm the proposed `operators:*` permission resource + which actions are
   Super-Admin-only (`delete`, and possibly `suspend`).
7. **Sequencing.** This module is deferred — confirm it lands **after** the core equipment booking + GPS
   flow (which already works via booking-level operator fields + `trackingToken`).

---

## 8. Status Summary

| Capability | Status |
|------------|--------|
| `operators` collection + admin CRUD/roster | 📄 Planned (deferred) |
| Operator assignment endpoint (booking bridge) | 📄 Planned (deferred) |
| Operator tracking app/view (tokenized GPS push) | 📄 Planned (deferred) |
| Operator notifications (assignment/breach/return) | 📄 Planned (deferred) |
| Operator ratings/performance | 📄 Planned (deferred) |
| **Booking-level operator fields + `trackingToken`** (this phase) | 📄 Specified in [equipment PRD §2.5](../admin_module/equipment_booking/equipment_booking.md) |
