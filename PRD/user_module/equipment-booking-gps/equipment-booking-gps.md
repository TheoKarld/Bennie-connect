# PRD 06: Equipment Booking with Live GPS Tracking (User)

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded · ⚠️ drift / reconciliation flag
>
> **Overall module status: 📄** (no equipment code exists on disk yet).
>
> User-side build contract for `backend-dev` (NestJS `/api/v1/equipment/*`) and `user-dev`
> (React equipment pages + live GPS map). The **admin-side** surface (fleet CRUD, approvals,
> maintenance, rate config, geofences, GPS oversight, deposit settlement) is specified in
> [`PRD/admin_module/equipment_booking/equipment_booking.md`](../../admin_module/equipment_booking/equipment_booking.md)
> and is **not redefined here** — this doc aligns to it. Live infra plugged into:
> [`PRD/user_module/wallet/digital-wallet-seerbit.md`](../wallet/digital-wallet-seerbit.md) (wallet is LIVE — payments debit the wallet),
> [`PRD/notification.md`](../../notification.md) + [`PRD/socket.io.md`](../../socket.io.md) (notification engine + realtime layer),
> and the domain collections in [`PRD/data_structure.md`](../../data_structure.md) §7.7.4.

---

## 1. Overview

Agricultural-equipment (tractors, harvesters, planters, sprayers, irrigation rigs) booking
and rental with **live GPS tracking** during use. The user journey is a **request → admin
approve → pay-from-wallet → confirm → use (live GPS) → complete** flow.

Two owner-locked design decisions govern everything below:

1. **Payment-after-approval, wallet-only, full cost upfront.** The user is **never** charged
   at request time. The admin first approves availability; only then does the user pay the
   **full booking cost** (rental + deposit) from their **live wallet** (`WalletService` debit,
   transaction `category: PAYMENT`). At completion the deposit portion is refunded to the
   wallet minus any damage/overdue deductions. This **supersedes** the legacy "deposit before
   confirm" flow that appeared in the old draft of this PRD.
2. **Live GPS = operator-push over socket.io.** There is **no hardware GPS device** in scope
   this phase. The assigned **operator** pushes **real browser geolocation** positions from
   their device over socket.io; the server appends them to the booking's `gpsTracking[]` trail
   and broadcasts them to the farmer's live map and to admins. The frontend renders the map
   with the **Google Maps JavaScript API**.

> ⚠️ **Supersedes the frontend mock.** The client-only `AgriBooking` shape
> (`src/types.ts`, [`data_structure.md`](../../data_structure.md) §1.5, driving the
> prototype equipment pages) is **superseded** by the server-backed `Equipment` +
> `EquipmentBooking` collections here. The mock remains only as an offline/seed fallback.

---

## 2. Database Schema

Full annotated shapes are catalogued (and are the source of truth) in
[`data_structure.md`](../../data_structure.md) §7.7.4. Repeated here for the build contract;
where they disagree, `data_structure.md` §7.7.4 wins.

### 2.1 Equipment Collection (`equipment`)

Admin-managed inventory (admin RBAC `equipment:*`). Users read it via the public fleet
endpoints (§3.1).

```typescript
{
  _id: ObjectId;
  cooperativeId: ObjectId;            // ref Cooperative
  name: string;
  category: 'TRACTOR' | 'HARVESTER' | 'PLANTER' | 'SPRAYER' | 'IRRIGATION' | 'OTHER';
  model: string;
  serialNumber: string;
  yearOfManufacture: number;
  status: 'AVAILABLE' | 'BOOKED' | 'MAINTENANCE' | 'RETIRED';
  hourlyRate: number;                 // NGN/hr
  dailyRate: number;                  // NGN/day
  depositRequired: number;            // NGN — refundable deposit component of a booking
  location: { lat: number; lng: number; address: string };
  gpsTracker: { deviceId: string; isActive: boolean; lastUpdateAt?: Date };
  specifications: Record<string, any>;
  images: string[];                   // URLs from the file-upload service (data_structure §10)
  maintenanceSchedule: [{
    type: string;
    dueDate: Date;
    completedAt?: Date;
    notes: string;
  }];
  bookingHistory: number;             // total completed bookings count
  createdAt: Date;
  updatedAt: Date;
}
```

- `gpsTracker.deviceId` is retained for a future hardware-tracker integration; **this phase
  live GPS is operator-push** (§5), so `deviceId` may be empty and `isActive` reflects whether
  an operator session is streaming for the active booking.

### 2.2 EquipmentBooking Collection (`equipmentBookings`)

The reservation + its financial ledger + its live GPS trail. Canonical for the frontend
`AgriBooking` mock (§1.5 of `data_structure.md`).

```typescript
{
  _id: ObjectId;
  equipmentId: ObjectId;              // ref Equipment
  userId: ObjectId;                   // ref users — the booking farmer
  bookingReference: string;           // unique, e.g. EQB<ts><rand>
  startDate: Date;
  endDate: Date;
  actualStartDate?: Date;             // set at handover → IN_USE
  actualEndDate?: Date;               // set at completion
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONFIRMED'
        | 'IN_USE' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';

  // ── Costing (captured at request; deposit is part of totalCost) ──
  rentalCost: number;                 // NGN — rate × duration
  depositAmount: number;              // NGN — refundable deposit (from Equipment.depositRequired)
  totalCost: number;                  // NGN — rentalCost + depositAmount (the full upfront charge)
  amountPaid: number;                 // NGN — actually debited from wallet (0 until paid)

  // ── Wallet linkage (live wallet, PRD 02) ──
  walletPaymentRef?: string;          // Transaction.reference of the PAYMENT debit
  refundRef?: string;                 // Transaction.reference of the deposit REFUND credit

  pickupLocation: { lat: number; lng: number; address: string };
  returnLocation?: { lat: number; lng: number; address: string };

  // ── Operator (admin-entered this phase; full operator MODULE deferred) ──
  operatorId?: ObjectId;              // optional, ref users/operator when the ops module lands
  operatorName?: string;              // admin-entered
  operatorPhone?: string;             // admin-entered
  operatorPlate?: string;             // admin-entered vehicle plate
  trackingToken: string;              // opaque token the operator device uses to authorize GPS push

  // ── Live GPS (operator-push, §5) ──
  currentPosition?: { lat: number; lng: number; heading?: number; speed?: number; at: Date };
  gpsTracking: [{ lat: number; lng: number; heading?: number; speed?: number; at: Date }];

  // ── Return / settlement ──
  damageReport?: { description: string; costEstimate: number; deductedFromDeposit: number };
  overdueCharges?: number;            // NGN — accrued overdue penalty
  outstandingCharge?: number;         // NGN — damage-over-deposit balance owed by the user
  cancellationReason?: string;        // set on CANCELLED/REJECTED
  rejectionReason?: string;           // set on REJECTED (admin)

  // ── Post-completion review ──
  rating?: number;                    // 1–5
  ratingComment?: string;

  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

> ⚠️ **Reconciliation with the legacy schema.** The old draft used
> `status ∈ {PENDING,CONFIRMED,IN_USE,COMPLETED,CANCELLED,OVERDUE}`,
> `paymentStatus ∈ {PENDING,PARTIAL,PAID}`, a single `depositPaid`, and an `operator`
> ObjectId. The **locked design** replaces those with: the 8-state status enum above
> (adds `APPROVED` + `REJECTED`), `paymentStatus ∈ {UNPAID,PAID,REFUNDED}` (full upfront
> pay, no `PARTIAL`), the split `rentalCost`/`depositAmount`/`totalCost`/`amountPaid`
> ledger, wallet refs (`walletPaymentRef`/`refundRef`), the operator string fields +
> `operatorId?` + `trackingToken`, `currentPosition`, and the settlement fields
> (`overdueCharges`/`outstandingCharge`). `data_structure.md` §7.7.4 is being updated to
> match in the same change as this PRD.

### 2.3 Admin-owned config collections (referenced, not redefined)

These live in the **admin PRD** and `data_structure.md` §7.7.4; the user module only reads
their effects:

- `equipmentRateConfig` — default hourly/daily/deposit%/overdue-fee per category.
- `geofences` — authorised operating zones; a breach raises a `gpsAlert`.
- `gpsAlerts` — append-only geofence/overspeed/signal alerts.

---

## 3. API Endpoints (user plane)

Base `/api/v1/equipment`. All require the user `JwtAuthGuard` (`scope: "user"`) unless noted.
Responses use the standard envelope `{ success, message?, data }`. Admin endpoints
(`/api/v1/admin/equipment/*`) are in the admin PRD.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/equipment` | List available fleet (filters + date-availability) — §3.1 |
| `GET` | `/equipment/:id` | Equipment detail (specs, rates, images, next-available) |
| `POST` | `/equipment/bookings` | **Request** a booking → `PENDING` (no charge) — §3.2 |
| `GET` | `/equipment/my-bookings` | The caller's bookings (paginated, filterable by status) |
| `GET` | `/equipment/bookings/:id` | Booking detail + cost breakdown + GPS trail |
| `POST` | `/equipment/bookings/:id/pay` | **Pay** the full cost from wallet (only when `APPROVED`) — §3.3 |
| `POST` | `/equipment/bookings/:id/cancel` | Cancel (per rules; `PENDING`/`APPROVED`/`CONFIRMED`) — §4.2 |
| `GET` | `/equipment/bookings/:id/tracking` | Live GPS snapshot + trail for the booking — §3.4 |
| `POST` | `/equipment/bookings/:id/rate` | Post-completion review (rating 1–5 + comment) |

### 3.1 `GET /equipment` — available fleet

Returns equipment that is bookable for the requested window (excludes `MAINTENANCE`/`RETIRED`
and units with a conflicting `CONFIRMED`/`IN_USE` booking or blocking maintenance overlap).

**Query params:** `page` (default 1), `limit` (default 20, max 100), `category`, `q` (name/model
search), `startDate`, `endDate` (ISO; when both present, results are filtered by
date-availability and each item echoes `available: true`), `minRate`, `maxRate`,
`sortBy` (`dailyRate|name|bookingHistory`), `order` (`asc|desc`).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "eqp_1",
        "name": "John Deere 5075E",
        "category": "TRACTOR",
        "model": "5075E",
        "hourlyRate": 8000,
        "dailyRate": 60000,
        "depositRequired": 20000,
        "location": { "lat": 10.52, "lng": 7.44, "address": "Kaduna North Depot" },
        "images": ["https://storage.googleapis.com/.../eqp_1_a.jpg"],
        "status": "AVAILABLE",
        "available": true,
        "nextAvailableFrom": null
      }
    ],
    "total": 12,
    "page": 1,
    "limit": 20
  }
}
```

### 3.2 `POST /equipment/bookings` — request a booking (→ PENDING)

Creates a `PENDING` booking. **No wallet charge occurs here.** The server captures the cost
snapshot (`rentalCost` from rate × duration, `depositAmount` from `Equipment.depositRequired`,
`totalCost = rentalCost + depositAmount`), generates `bookingReference` and `trackingToken`,
and fires `equipment.booking.requested` to the user + `notifyAdmins` (an approval is needed).

**Request:**
```json
{
  "equipmentId": "eqp_1",
  "startDate": "2026-07-10T08:00:00Z",
  "endDate": "2026-07-12T17:00:00Z",
  "rateType": "DAILY",
  "pickupLocation": { "lat": 10.52, "lng": 7.44, "address": "Farm plot 14, Kaduna North" },
  "notes": "Ploughing 6 hectares"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Booking requested. Awaiting admin approval.",
  "data": {
    "id": "eqb_1",
    "bookingReference": "EQB1720598400ABC",
    "equipmentId": "eqp_1",
    "status": "PENDING",
    "paymentStatus": "UNPAID",
    "rentalCost": 120000,
    "depositAmount": 20000,
    "totalCost": 140000,
    "amountPaid": 0,
    "startDate": "2026-07-10T08:00:00Z",
    "endDate": "2026-07-12T17:00:00Z"
  }
}
```

Validation: `startDate < endDate`; window within `MAX_BOOKING_DAYS`; equipment exists, not
`RETIRED`; no availability conflict at request time (a soft check — the authoritative conflict
check is re-run by the admin on approve). Errors → §7.

### 3.3 `POST /equipment/bookings/:id/pay` — pay full cost from wallet (only when APPROVED)

Debits the **full `totalCost`** from the caller's **live wallet** (PRD 02 `WalletService`,
`Transaction` `type: DEBIT, category: PAYMENT`) and moves the booking `APPROVED → CONFIRMED`.
Allowed **only** when `status === "APPROVED"` and `paymentStatus === "UNPAID"`.

**Request:** _(no body required; booking id in the path)_
```json
{}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Payment successful. Booking confirmed.",
  "data": {
    "id": "eqb_1",
    "status": "CONFIRMED",
    "paymentStatus": "PAID",
    "amountPaid": 140000,
    "walletPaymentRef": "TXN1720600000XYZ",
    "wallet": { "available": 60000 }
  }
}
```

Behaviour & rules:
- **Idempotent** on `walletPaymentRef` — a repeat call after a successful debit returns the same
  `CONFIRMED` result without a second debit.
- Insufficient balance → `EQP_009` (wraps wallet `WALLET_001`); the user tops up the wallet
  (PRD 02 deposit) then retries. No partial payment (`paymentStatus` never `PARTIAL`).
- On success the equipment is reserved (`Equipment.status → BOOKED` for the window) and
  `equipment.booking.confirmed` notifies the user.
- If the window was lost between approve and pay (rare race), the debit is rejected with
  `EQP_005` and no charge is made.

### 3.4 `GET /equipment/bookings/:id/tracking` — live GPS

Returns the latest position and the full trail. The **live** stream is over socket.io (§5);
this REST endpoint is the snapshot/initial-load + polling fallback.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "bookingId": "eqb_1",
    "status": "IN_USE",
    "trackingToken": "trk_9f3a…",
    "operator": { "name": "Musa Ibrahim", "phone": "+2348012345678", "plate": "KAD-231-AZ" },
    "currentPosition": { "lat": 10.5218, "lng": 7.4401, "heading": 84, "speed": 12, "at": "2026-07-10T09:32:10Z" },
    "gpsTracking": [
      { "lat": 10.5203, "lng": 7.4388, "speed": 0, "at": "2026-07-10T08:05:00Z" },
      { "lat": 10.5218, "lng": 7.4401, "speed": 12, "at": "2026-07-10T09:32:10Z" }
    ],
    "socket": { "namespace": "/rt/user", "room": "track:eqb_1", "event": "equipment:position:new" }
  }
}
```

- Only the booking's `userId` (and admins) may read tracking — ownership enforced; others →
  `404` (no cross-owner leakage).
- If no operator has streamed yet, `currentPosition` is `null` and `gpsTracking` is `[]`.

---

## 4. Business Logic

### 4.1 Booking lifecycle (locked flow)

```
 user REQUESTS                admin APPROVES              user PAYS (full, wallet)
 ──────────────►  PENDING  ──────────────►  APPROVED  ──────────────────────►  CONFIRMED
                    │  ▲                       │                                   │
       admin REJECTED│  └── (no charge yet)     │                                   │ handover
                    ▼                          ▼                                   ▼
                 REJECTED                   CANCELLED  ◄── user/admin cancel ──   IN_USE  (GPS live)
                                                                                    │
                                              (endDate passed, not returned)        │ complete
                                                        ▼                           ▼
                                                     OVERDUE ──── complete ────►  COMPLETED
                                                                                    │
                                                        (deposit refunded to wallet minus
                                                         damage/overdue; excess → outstandingCharge)
```

Step-by-step:
1. **REQUEST** (`POST /bookings`) → `PENDING`, `paymentStatus: UNPAID`, **no charge**. Notifies
   user (`requested`) + admins (approval needed).
2. **APPROVE** (admin) → `APPROVED` (availability confirmed; awaiting payment). Notifies user
   (`approved` — "pay to confirm"). Admin may instead **REJECT** → `REJECTED` with
   `rejectionReason` (notifies user).
3. **PAY** (`POST /bookings/:id/pay`) → wallet debit of **full `totalCost`** →
   `CONFIRMED`, `paymentStatus: PAID`, `amountPaid = totalCost`, `walletPaymentRef` set;
   `Equipment.status → BOOKED`. Notifies user (`confirmed`).
4. **HANDOVER** (admin, sets `actualStartDate`; assigns/records operator fields) →
   `IN_USE`; live GPS begins (operator starts pushing). Notifies user (`in_use`).
5. **COMPLETE** (admin return inspection) → `COMPLETED`: settle deposit (§4.3), free the
   equipment (`AVAILABLE`, or `MAINTENANCE` if damage warrants), `bookingHistory++`. Notifies
   user (`completed` + refund summary).
6. **OVERDUE** — system transition when `now > endDate` and status is `IN_USE`; accrues
   `overdueCharges` at the configured per-day rate. Resolves via `complete`.

Transition guards: `pay` only from `APPROVED`; `cancel` per §4.2; `IN_USE`/`OVERDUE` cannot be
cancelled by the user (must be completed by admin). Invalid transitions → `EQP_004`.

### 4.2 Cancellation rules

| From state | Who | Effect |
|-----------|-----|--------|
| `PENDING` | user or admin | → `CANCELLED`; no refund needed (nothing paid). |
| `APPROVED` | user or admin | → `CANCELLED`; nothing paid, no refund. |
| `CONFIRMED` (paid, not yet handed over) | user or admin | → `CANCELLED`; **refund** per cancellation policy: full `totalCost` refunded to wallet if cancelled ≥ `CANCELLATION_FULL_REFUND_HOURS` before `startDate`, else deposit refunded and a cancellation fee retained (owner-configurable; default = full refund this phase). Frees the equipment. |
| `IN_USE` / `OVERDUE` | — | **Not cancellable** — must be `complete`d by admin (`EQP_004`). |

`cancel` requires a `reason` for admin-initiated cancels. Refunds are wallet `REFUND`
credits (`refundRef` recorded); notifies the user.

### 4.3 Deposit settlement at completion

At `complete` (admin), with `depositAmount = D`:

```
damageDeducted   = min(damageReport.costEstimate ?? 0, D)      // never exceeds the deposit
overdueCharges   = overdueDays * overdueFeePerDay               // 0 if returned on time
totalDeductions  = min(damageDeducted + overdueCharges, D)
depositRefunded  = D - totalDeductions                          // >= 0 → wallet REFUND credit
outstandingCharge = max((damageReport.costEstimate ?? 0) - D, 0) + max((overdueCharges) - (D - damageDeducted), 0)
```

- **Deposit refund** is a wallet `REFUND` credit to the booking `userId` (`refundRef` set,
  `paymentStatus → REFUNDED`). Idempotent on `refundRef` so a repeat completion never
  double-refunds.
- **Damage over deposit** — when damage (and/or overdue) **exceeds** the deposit, the excess is
  recorded as `outstandingCharge` against the booking (owner-approved recovery path; never
  silently written off). Recovery is via a wallet debit or invoice flow governed by the admin
  module — see the admin PRD §4.3 and its open sub-question on the preferred mechanism.
- `condition: OK` with no `damageReport` and on-time return → **full deposit refund**.

### 4.4 Availability & conflict rules

- No two `APPROVED`/`CONFIRMED`/`IN_USE` bookings may overlap `[startDate, endDate]` for the
  same equipment.
- A booking window must not overlap a blocking maintenance entry
  (`maintenanceSchedule` with `dueDate <= endDate` and uncompleted).
- The authoritative conflict check runs on **admin approve** and again on **pay** (§3.3) to
  guard the approve→pay race.

---

## 5. Live GPS — operator-push over socket.io

**No hardware tracker this phase.** The assigned **operator** streams real
`navigator.geolocation` positions from their device; the server persists + fans them out.
Realtime transport, namespaces, rooms, and handshake auth follow
[`PRD/socket.io.md`](../../socket.io.md).

### 5.1 Authorization — `trackingToken`

Each `EquipmentBooking` carries an opaque `trackingToken` (generated at request). The operator's
device authorizes its GPS push by presenting the booking id + `trackingToken` (operators are
admin-managed; the full operator **module** — rostering, an operator app/JWT — is **deferred**
and documented separately in `PRD/operator/operator_overview.md` by the admin-docs agent). Until
that module lands, the operator authorizes via the `trackingToken` bound to the booking; the
server validates it before accepting positions and only accepts pushes while the booking is
`IN_USE`/`OVERDUE`.

### 5.2 Socket events

Namespace `/rt/user` (farmer viewer) and `/rt/admin` (oversight). Room `track:<bookingId>`.

| Event | Direction | Payload | Notes |
|-------|-----------|---------|-------|
| `equipment:position` | operator → server | `{ bookingId, trackingToken, lat, lng, heading?, speed?, at }` | server validates token + booking state, appends to `gpsTracking[]`, sets `currentPosition`, updates `Equipment.gpsTracker.lastUpdateAt` |
| `equipment:position:new` | server → viewers | `{ bookingId, lat, lng, heading?, speed?, at }` | broadcast to `track:<bookingId>` (farmer) + admin oversight room |
| `equipment:tracking:subscribe` | viewer → server | `{ bookingId }` | server verifies the caller owns the booking (or is admin), joins them to `track:<bookingId>` |
| `gpsAlert` | server → admins | `{ bookingId, equipmentId, type, position, detail, at }` | raised on geofence breach / overspeed / signal-lost (§5.3) |

- **Identity is server-derived** for viewers (from the socket JWT); the farmer viewer is
  validated as the booking `userId`. The operator push is validated by `trackingToken`, never
  by trusting payload identity.
- Positions are also mirrored to the persisted trail so the REST snapshot (§3.4) and route
  playback stay consistent when no tab is open.

### 5.3 Geofence / overspeed / signal alerts (in scope)

- A position outside every active geofence applicable to the equipment raises a
  `GEOFENCE_BREACH` `gpsAlert` (de-duplicated per continuous excursion).
- Speed above `OVERSPEED_THRESHOLD_KMH` raises `OVERSPEED`.
- No position for > `2 × GPS_UPDATE_INTERVAL_SECONDS` while `IN_USE` raises `SIGNAL_LOST`.
- Alerts persist to `gpsAlerts` (admin-owned) and emit `gpsAlert` to admins; geofence and
  alert config are admin-owned (admin PRD §2.2/§3.4).

### 5.4 Frontend rendering (Google Maps)

The farmer's live-tracking view renders the trail + live marker with the **Google Maps
JavaScript API**, keyed by `VITE_GOOGLE_MAPS_API_KEY` (frontend). The map subscribes to
`equipment:position:new` on `track:<bookingId>` and animates the marker; the initial trail
comes from `GET /equipment/bookings/:id/tracking`.

---

## 6. Notifications

Every lifecycle transition fires the single `NotificationService` (in-app socket bell + FCM
web push; best-effort, never blocks the operation) — see [`PRD/notification.md`](../../notification.md).
The `booking.status` row of the Triggers Matrix covers this module.

| Booking event | `event` key | `type` | Recipient |
|---------------|-------------|--------|-----------|
| Requested | `equipment.booking.requested` | `info` | user (+ `notifyAdmins`) |
| Approved (pay to confirm) | `equipment.booking.approved` | `success` | user |
| Rejected | `equipment.booking.rejected` | `warning` | user |
| Paid / confirmed | `equipment.booking.confirmed` | `success` | user |
| Handover / in use | `equipment.booking.in_use` | `info` | user |
| Overdue | `equipment.booking.overdue` | `warning` | user (+ admins) |
| Completed (+ refund summary) | `equipment.booking.completed` | `success` | user |
| Cancelled (+ refund) | `equipment.booking.cancelled` | `info` | user |
| GPS alert | `equipment.gps.alert` | `alert` | admins |

Notification `link` deep-links the user bell to the booking detail (e.g.
`/equipment/bookings/eqb_1`) and the admin bell to the admin booking drawer.

---

## 7. Validation & error codes

**Validation:**
- `startDate < endDate`; both valid ISO dates; window ≤ `MAX_BOOKING_DAYS`.
- `rateType ∈ {HOURLY, DAILY}`; server computes cost from `Equipment` rates (client cost is
  never trusted).
- `:id` / `equipmentId` valid ObjectId; missing → `*_NOT_FOUND`.
- `pay` only from `APPROVED`+`UNPAID`; `rate` only from `COMPLETED`; `rating` ∈ 1–5.
- `cancel` reason required for admin cancels.

**Error response envelope:**
```json
{ "success": false, "error": { "code": "EQP_009", "message": "Insufficient wallet balance", "details": { "required": 140000, "available": 60000 } } }
```

| Code | Meaning |
|------|---------|
| `EQP_001` | Equipment not found |
| `EQP_002` | Booking not found (or not owned by the caller) |
| `EQP_003` | Equipment not available for the requested window |
| `EQP_004` | Invalid booking status transition (e.g. pay when not `APPROVED`, cancel when `IN_USE`) |
| `EQP_005` | Booking window conflict / lost at pay time |
| `EQP_006` | Invalid date range (start ≥ end, or exceeds `MAX_BOOKING_DAYS`) |
| `EQP_007` | Not authorized for this booking (ownership) |
| `EQP_008` | Payment allowed only when `APPROVED` and `UNPAID` |
| `EQP_009` | Insufficient wallet balance (wraps `WALLET_001`) |
| `EQP_010` | Wallet debit failed (wraps wallet error) |
| `EQP_011` | Cannot cancel in current state |
| `EQP_012` | Rating allowed only after completion |
| `EQP_013` | Invalid / expired tracking token (GPS push) |
| `EQP_014` | GPS push rejected — booking not `IN_USE`/`OVERDUE` |

---

## 8. Frontend (user) UX

Equipment pages in the React app (`user-dev`):
- **Fleet browser** — filter by category, date window, rate; cards with images, rates,
  deposit, availability badge; "Request booking" opens a date/pickup form.
- **My bookings** — status timeline chips (Requested → Approved → Paid → In use → Completed);
  an `APPROVED` booking shows a prominent **"Pay ₦{totalCost} from wallet"** action (with a
  low-balance hint + link to wallet top-up); cost breakdown (rental + deposit).
- **Live tracking view** — Google Maps (`VITE_GOOGLE_MAPS_API_KEY`) with the live marker +
  trail, operator card (name/phone/plate), and status; subscribes to
  `equipment:position:new`.
- **Completion summary** — deposit refunded, any damage/overdue deductions, any
  `outstandingCharge`, and a rate-your-booking prompt.

---

## 9. Environment Variables

```bash
# Booking rules (backend; DB-driven via equipmentRateConfig, these seed defaults)
EQUIPMENT_BOOKING_PREFIX=EQB
MAX_BOOKING_DAYS=30
OVERDUE_FEE_PER_DAY=0
CANCELLATION_FULL_REFUND_HOURS=24        # full refund if cancelled this many hrs before startDate

# GPS (operator-push over socket.io)
GPS_UPDATE_INTERVAL_SECONDS=30
OVERSPEED_THRESHOLD_KMH=80
GEOFENCE_ALERT_ENABLED=true

# Google Maps
GOOGLE_MAPS_API_KEY=                     # backend (geocoding/validation if needed)
VITE_GOOGLE_MAPS_API_KEY=                # frontend (Maps JS API — live tracking map)
```

> The **deposit percentage** and rate defaults are **admin-owned** (`equipmentRateConfig`,
> admin PRD §2.1); this module reads `Equipment.depositRequired` per unit. The legacy
> `DEPOSIT_PERCENTAGE` / `DEPOSIT_BEFORE_CONFIRM` bootstrap vars from the old draft are
> **retired** — payment is full-cost-upfront-after-approval.

---

## 10. Open questions for the owner

1. **Operator module scope.** This PRD holds admin-entered operator fields
   (`operatorName`/`operatorPhone`/`operatorPlate` + `operatorId?`) and a `trackingToken` for
   GPS push; the full operator module (rostering, operator app/JWT, operator earnings) is
   **deferred** to `PRD/operator/operator_overview.md`. Confirm the operator's GPS-push auth
   remains `trackingToken`-based until that module ships.
2. **Cancellation policy.** Default this phase is a full refund on `CONFIRMED` cancellation;
   confirm whether a cancellation fee / tiered window (`CANCELLATION_FULL_REFUND_HOURS`) should
   be enforced, and its amount.
3. **Damage-over-deposit recovery mechanism.** `outstandingCharge` is recorded; confirm the
   recovery mechanism (auto wallet debit vs. manual invoice) — mirrors the admin PRD §10.1
   open sub-question.
4. **Deposit component vs. separate line.** Deposit is charged as part of the single upfront
   `totalCost` debit (one `PAYMENT` transaction). Confirm this is preferred over two separate
   wallet transactions (rental `PAYMENT` + deposit `SAVINGS_LOCK`-style hold).
</content>
</invoke>
