# Admin PRD: Equipment Booking & GPS Operations

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no admin equipment code exists yet)
>
> Live blueprint for `admin-dev` governing admin operations over `Equipment`, `EquipmentBooking`,
> maintenance, GPS oversight, deposits, and rate config. User-side spec:
> [`PRD/user_module/equipment-booking-gps/equipment-booking-gps.md`](../../user_module/equipment-booking-gps/equipment-booking-gps.md).

---

## 1. Overview

The admin equipment surface lets operations staff manage the equipment fleet, oversee the full
booking lifecycle, schedule maintenance (which blocks availability), monitor **live GPS** and
geofences for in-use equipment, settle **deposits** (refund vs. damage deduction), and configure
**rental rates** (hourly/daily/deposit %).

**Locked booking-and-payment design (owner-confirmed).** This module runs a
**payment-after-approval, wallet-only, full-cost-upfront** flow:

1. The user submits a booking request → `PENDING`.
2. An admin **approves availability** (no money is collected at this step) → `APPROVED (awaiting payment)`,
   or **rejects** the request with a reason → `REJECTED`.
3. The **user** then pays the **full booking cost** (rental + deposit portion) from their **wallet** →
   `CONFIRMED`. Payment is user-initiated on the user side; the admin never collects a deposit before
   confirm.
4. Handover sets the booking `IN_USE`; GPS tracking begins.
5. At `complete`, the **deposit portion** of the amount already paid is refunded to the user wallet,
   **minus** any damage/overdue deductions ([§4.3](#43-deposit-settlement-refund-vs-damage-deduction)).

> The earlier "**deposit before confirm**" model is **superseded** and marked as such throughout this
> doc. The upfront payment is the **FULL cost**; the refundable portion at completion is the **deposit**
> component minus deductions.

**Locked GPS design (owner-confirmed).** GPS is **operator-push, real geolocation** — no simulation.
The assigned operator's device pushes live position over **socket.io** (Open Question #4 resolved →
socket.io, operator-push ingestion). **Geofences and GPS alerts** (breach / overspeed / signal-lost)
are **in scope this phase** as build targets. The admin manages operator identity fields on the booking
and issues a per-booking `trackingToken`; the standalone **Operator module** is **deferred** to
[`PRD/operator/operator_overview.md`](../../operator/operator_overview.md) (Open Question #2 resolved →
operators become their own admin-managed module, referenced from bookings).

**Conventions (shared — see `PRD/admin_module/README.md` for the authoritative RBAC taxonomy):**

- Backend `/api/v1/admin/*`; admin frontend `/bennie/*`.
- Admin identity = **`adminUsers`**; authz = **`adminRoles`** (`resource:action`) + per-admin
  overrides; **Super Admin = `*`**. **Every endpoint declares its required permission**, enforced by
  `PermissionsGuard` over the admin JWT guard.
- **Every mutation writes an `adminAuditLog`** entry (`actor`, `action`, `target`, `before/after`,
  `timestamp`, `ip`, `userAgent`).
- Money is whole **NGN**. **Deposit refunds / damage deductions are financial reversals** —
  `equipment:settle-deposit` is **Super-Admin-only and NOT delegable** per the
  [README Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable).
- The user PRD already sketches most of these admin endpoints under `/api/v1/admin/equipment/*`;
  this doc consolidates and completes them.

---

## 2. Collections / Schema

Reads/mutates the user-side `Equipment` and `EquipmentBooking` collections (defined in the user PRD;
not redefined). Adds the admin-owned config/collections below.

### 2.1 `equipmentRateConfig` 📄 (admin-owned; may live in global `settings`)

Default rate policy applied when creating equipment or when per-unit rates are unset.

```typescript
{
  _id: ObjectId;
  category: 'TRACTOR' | 'HARVESTER' | 'PLANTER' | 'SPRAYER' | 'IRRIGATION' | 'OTHER';
  defaultHourlyRate: number;    // NGN/hr
  defaultDailyRate: number;     // NGN/day
  depositPercent: number;       // % of estimated booking cost required as deposit, e.g. 20
  minDepositNgn?: number;       // floor
  overdueFeePerDay?: number;    // NGN/day penalty for OVERDUE returns
  isActive: boolean;
  updatedBy: ObjectId;          // ref adminUsers
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 `geofence` 📄 (admin-owned)

Authorised operating zone(s) for GPS-tracked equipment/bookings. A breach raises an alert.

```typescript
{
  _id: ObjectId;
  name: string;                 // e.g. "Kaduna North Farm Cluster"
  type: 'CIRCLE' | 'POLYGON';
  center?: { lat: number; lng: number };  // CIRCLE
  radiusMeters?: number;                    // CIRCLE
  polygon?: [{ lat: number; lng: number }]; // POLYGON
  appliesTo: 'ALL' | 'EQUIPMENT' | 'CATEGORY';
  equipmentIds?: [ObjectId];    // when appliesTo = EQUIPMENT
  category?: string;            // when appliesTo = CATEGORY
  isActive: boolean;
  createdBy: ObjectId;          // ref adminUsers
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.3 `gpsAlert` 📄 (admin-owned; append-only)

```typescript
{
  _id: ObjectId;
  equipmentId: ObjectId;        // ref Equipment
  bookingId?: ObjectId;         // ref EquipmentBooking (active booking, if any)
  type: 'GEOFENCE_BREACH' | 'OVERSPEED' | 'SIGNAL_LOST' | 'IDLE_ANOMALY';
  position?: { lat: number; lng: number };
  detail: string;
  acknowledgedBy?: ObjectId;    // ref adminUsers
  acknowledgedAt?: Date;
  createdAt: Date;
}
```

### 2.4 Existing schema fields relied upon

- `Equipment.status`: `AVAILABLE | BOOKED | MAINTENANCE | RETIRED`.
- `Equipment.name`, `.category`, `.model`, `.serialNumber`, `.yearOfManufacture`, `.hourlyRate`,
  `.dailyRate`, `.depositRequired`, `.location { lat, lng, address }`, `.specifications` (key-value),
  `.images[]` (URLs), `.gpsTracker { deviceId, isActive, lastUpdateAt? }` — all set/edited via the rich
  admin create/edit form ([§8](#8-admin-ui--section-premium-ux)). Images are uploaded through the
  shared upload service (see §2.6).
- `Equipment.maintenanceSchedule[]`: `{ type, dueDate, completedAt?, notes }` — an open (uncompleted)
  entry with `dueDate <= now` blocks availability.
- `EquipmentBooking.status`: **updated enum** `PENDING | APPROVED | CONFIRMED | IN_USE | COMPLETED |
  REJECTED | CANCELLED | OVERDUE` (adds `APPROVED` = availability approved, awaiting user wallet
  payment; and `REJECTED` = admin declined the request). See [§4.2](#42-booking-state-machine).
- `EquipmentBooking.totalCost` (full cost = rental + deposit portion), `.depositPaid`,
  `.paymentStatus` (`PENDING | PARTIAL | PAID`), `.damageReport { description, costEstimate,
  deductedFromDeposit }`.
- `EquipmentBooking.gpsTracking[]` and (frontend) `currentGpsPos` for live location — fed by
  **operator-push** over socket.io (see [§3.4](#34-gps-oversight-equipmentgps) and §2.5).

> **Drift flag (user PRD).** The user-side `EquipmentBooking.status` enum
> ([`equipment-booking-gps.md`](../../user_module/equipment-booking-gps/equipment-booking-gps.md))
> currently reads `PENDING | CONFIRMED | IN_USE | COMPLETED | CANCELLED | OVERDUE` and does **not**
> include `APPROVED`/`REJECTED`. The `paymentStatus` enum, `operator`, and `trackingToken` fields also
> need alignment. Flagged for the owner / `user-prd-enricher` to reconcile — this admin doc does **not**
> redefine the base `Equipment` / `EquipmentBooking` collections.

### 2.5 Booking operator & tracking fields 📄 (owner-confirmed additive)

The admin sets these on a booking at **approve / handover**; the operator pushes GPS with the token.
The full Operator module (roster, operator accounts, ratings, device credentials) is deferred to
[`PRD/operator/operator_overview.md`](../../operator/operator_overview.md); these are the minimal
booking-level fields needed **this phase**.

```typescript
// additive fields on EquipmentBooking
{
  operatorId?: ObjectId;        // ref: operators (future module); nullable this phase
  operatorName?: string;        // captured directly on the booking this phase
  operatorPhone?: string;
  operatorPlate?: string;       // vehicle/plate identifier
  trackingToken?: string;       // per-booking opaque token; authorizes operator GPS push (see §2.5.1)
  trackingTokenIssuedAt?: Date;
  trackingTokenExpiresAt?: Date; // recommended: booking window + grace
  approvedBy?: ObjectId;        // ref: adminUsers (who approved availability)
  approvedAt?: Date;
  rejectedBy?: ObjectId;        // ref: adminUsers
  rejectionReason?: string;
}
```

#### 2.5.1 `trackingToken` semantics

- Generated by the server when an admin **approves** or performs **handover**; opaque, single-booking
  scope, not an `adminUsers`/`users` credential.
- The operator device authenticates its socket.io push with this token (over the equipment GPS
  gateway/namespace — see [socket.io.md](../../socket.io.md)); positions are attributed to
  `bookingId` + `equipmentId`.
- Server-side, the token is validated and bound to exactly one active booking; it is revoked at
  `complete`/`cancel`/`reject` and after `trackingTokenExpiresAt`.
- The operator-auth model (lightweight token vs. full operator account) is an **open question** owned
  by [`operator_overview.md`](../../operator/operator_overview.md); this phase uses the tokenized push.

### 2.6 Equipment images (upload service)

Equipment images are uploaded via the shared admin upload service
(`POST /api/v1/admin/upload`) and stored as **URL strings** on `Equipment.images[]`. The create/edit
endpoints ([§3.1](#31-equipment-fleet-equipment)) accept an array of already-uploaded image URLs; the
admin form uploads first, then submits the returned URLs. No binary is stored on the `Equipment`
document.

---

## 3. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission.

### 3.1 Equipment fleet (`equipment:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/equipment` | `equipment:view` | List/search fleet (filters below) |
| GET | `/equipment/:id` | `equipment:view` | Equipment detail (specs, status, bookings, maintenance, GPS) |
| POST | `/equipment` | `equipment:create` | Add equipment (rich form — all schema fields; `images[]` = pre-uploaded URLs) |
| PATCH | `/equipment/:id` | `equipment:update` | Update fields (rates, specs, location, gpsTracker, images) |
| DELETE | `/equipment/:id` | `equipment:delete` | Retire equipment (`status=RETIRED`; blocked if active bookings) |

**POST `/equipment` — rich create request (all fields):**
```json
{
  "name": "John Deere 5075E",
  "category": "TRACTOR",
  "model": "5075E",
  "serialNumber": "JD5075E-2024-0142",
  "yearOfManufacture": 2024,
  "hourlyRate": 4500,
  "dailyRate": 30000,
  "depositRequired": 25000,
  "location": { "lat": 10.5222, "lng": 7.4383, "address": "Depot A, Kaduna North" },
  "specifications": { "enginePowerHp": 75, "fuel": "Diesel", "transmission": "9F/3R" },
  "images": ["https://cdn.bennieconnect.com/equipment/jd5075e-1.jpg"],
  "gpsTracker": { "deviceId": "GPS-JD-0142", "isActive": true }
}
```
- `images[]` are **URLs already returned by the upload service** (§2.6) — the form uploads each file to
  `POST /api/v1/admin/upload` and submits the resulting URL(s). No binary is posted here.
- `location` is set with a **map picker** in the admin form ([§8](#8-admin-ui--section-premium-ux)).
- `specifications` is a free-form key-value map edited as add-remove rows in the form.

**GET `/equipment` query params:** `page`, `limit`, `q`, `category`, `status`, `cooperativeId`,
`gpsActive` (bool), `dueForMaintenance` (bool), `sortBy` (`createdAt|bookingHistory`), `order`.

### 3.2 Booking management (`equipment:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/equipment/bookings` | `equipment:view` | All bookings (filters below) |
| GET | `/equipment/bookings/:id` | `equipment:view` | Booking detail + GPS trail + deposit ledger |
| POST | `/equipment/bookings/:id/approve` | `equipment:approve` | **Approve availability** on a `PENDING` request → `APPROVED` (awaiting user payment). Sets operator fields + issues `trackingToken`. **No money collected.** |
| POST | `/equipment/bookings/:id/reject` | `equipment:reject` | **Reject** a `PENDING` request → `REJECTED` (reason required) |
| POST | `/equipment/bookings/:id/handover` | `equipment:confirm` | Handover a `CONFIRMED` booking → `IN_USE` (sets `actualStartDate`, re-issues/activates `trackingToken`, GPS begins) |
| POST | `/equipment/bookings/:id/complete` | `equipment:complete` | Complete an IN_USE/OVERDUE booking (return inspection; deposit-portion refund) |
| POST | `/equipment/bookings/:id/cancel` | `equipment:cancel` | Cancel a booking (reason required) |

> **`confirm` is user-driven, not an admin action.** The `PENDING → APPROVED → CONFIRMED` transition to
> `CONFIRMED` happens when the **user pays the full cost from their wallet** on the user side. The admin
> does **not** have a `/confirm` endpoint that collects a deposit — the superseded "deposit-before-confirm"
> `/confirm` route is removed. Admins move the booking with `/approve` (availability) and later
> `/handover` (start of use). Error `EQP_ADM_010` is repurposed: an admin `/handover` on a booking that
> is not yet `CONFIRMED` (user hasn't paid) is rejected.

**POST `/equipment/bookings/:id/approve` — request:**
```json
{
  "operatorName": "Musa Ibrahim",
  "operatorPhone": "+2348030000000",
  "operatorPlate": "KAD-123-XA",
  "note": "Approved; assigned operator Musa. Awaiting user payment."
}
```
**Response 200:**
```json
{ "success": true, "data": { "bookingId": "eqb_1", "status": "APPROVED",
    "trackingToken": "trk_9f3a…", "trackingTokenExpiresAt": "2026-07-08T00:00:00Z" } }
```
Operator fields are optional at approve and may be set/updated again at `/handover`. Approving does
**not** reserve the equipment as `BOOKED`; the availability conflict re-checks on the user's payment
(`CONFIRMED`) and again at `/handover`.

**POST `/equipment/bookings/:id/reject` — request:** `{ "reason": "Equipment reserved for co-op priority job" }`
(reason required → else `EQP_ADM_013`). Notifies the user (`booking.status`).

**GET `/equipment/bookings` query params:** `page`, `limit`, `equipmentId`, `userId`, `status`
(incl. `APPROVED`/`REJECTED`), `paymentStatus`, `startDate`, `endDate`, `overdue` (bool),
`awaitingPayment` (bool → `status=APPROVED`).

**POST `/equipment/bookings/:id/complete` — request (return inspection):**
```json
{
  "actualEndDate": "2026-07-01T16:00:00Z",
  "returnLocation": { "lat": 10.52, "lng": 7.44, "address": "Depot A" },
  "condition": "DAMAGED",
  "damageReport": { "description": "Cracked hydraulic hose", "costEstimate": 18000 },
  "usageHours": 6
}
```
Server computes final charges + deposit disposition ([§4.3](#43-deposit-settlement-refund-vs-damage-deduction)).
The user already paid the **full cost** upfront (at `CONFIRMED`); at `complete` only the **deposit
portion** is refundable, minus deductions.
**Response 200:**
```json
{ "success": true, "data": { "bookingId": "eqb_1", "status": "COMPLETED",
    "totalPaid": 50000, "depositPortion": 20000, "damageDeducted": 18000,
    "depositRefunded": 2000, "refundTxnRef": "REF-eqb_1" } }
```

### 3.3 Maintenance scheduling (`equipment:maintenance`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/equipment/:id/maintenance` | `equipment:maintenance` | Schedule maintenance (blocks availability) |
| GET | `/equipment/:id/maintenance` | `equipment:view` | Maintenance schedule/history |
| PATCH | `/equipment/:id/maintenance/:mIndex/complete` | `equipment:maintenance` | Mark a maintenance item completed |

**POST `/equipment/:id/maintenance` — request:**
```json
{ "type": "SERVICE_500H", "dueDate": "2026-07-10", "notes": "Engine oil + filters", "blockNow": true }
```
`blockNow: true` immediately sets `Equipment.status = MAINTENANCE` and rejects new bookings that
overlap the window. Cannot schedule a blocking maintenance window that overlaps a `CONFIRMED`/`IN_USE`
booking without first cancelling/rescheduling it (returns `EQP_ADM_006`).

### 3.4 GPS oversight (`equipment:gps`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/equipment/gps/live` | `equipment:gps` | Live positions of all in-use equipment (map feed) |
| GET | `/equipment/:id/gps/live` | `equipment:gps` | Live position for one unit |
| GET | `/equipment/bookings/:id/tracking` | `equipment:gps` | Full GPS trail for a booking (route playback) |
| GET | `/equipment/gps/alerts` | `equipment:gps` | Geofence/overspeed/signal alerts (filterable) |
| POST | `/equipment/gps/alerts/:id/ack` | `equipment:gps` | Acknowledge an alert |
| GET | `/equipment/geofences` | `equipment:view` | List geofences |
| POST | `/equipment/geofences` | `equipment:configure` | Create geofence |
| PATCH | `/equipment/geofences/:id` | `equipment:configure` | Edit / toggle geofence |
| DELETE | `/equipment/geofences/:id` | `equipment:configure` | Delete geofence |

**Transport (locked → socket.io, operator-push).** GPS ingestion is **real geolocation pushed by the
assigned operator's device** (no simulation), authenticated with the per-booking `trackingToken`
(§2.5.1). Positions arrive over the equipment GPS **socket.io** gateway/namespace (see
[socket.io.md](../../socket.io.md)); the server persists each fix to `EquipmentBooking.gpsTracking[]`,
updates `Equipment.gpsTracker.lastUpdateAt`, evaluates geofence/speed/signal rules
([§4.4](#44-gps--geofence-rules)), and **re-emits** live positions to the admin plane's live-map room
(`/rt/admin`). The REST endpoints above return the **latest snapshot** for polling / initial load.

Operators push ~ every `GPS_UPDATE_INTERVAL_SECONDS` (default 30s). GPS reads are high-frequency and
**not** audited; alert acknowledgements **are** audited. The user-side live-tracking view
(`GET /api/v1/equipment/bookings/:id/tracking`) consumes the same persisted trail over `/rt/user`.

### 3.5 Deposit settlement (`equipment:settle-deposit` — Super-Admin-only, non-delegable)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/equipment/bookings/:id/deposit/refund` | `equipment:settle-deposit` | Refund deposit (or remainder) to user wallet |
| POST | `/equipment/bookings/:id/deposit/deduct` | `equipment:settle-deposit` | Record a damage deduction against deposit |

Deposit refund/deduction is normally performed as part of `complete` (§3.2); these standalone
endpoints handle post-completion adjustments and disputes. Both write wallet transactions via the
user wallet service (never direct balance writes) and are **high-severity audited**.

### 3.6 Rate config (`equipment:configure`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/equipment/rate-config` | `equipment:view` | Read default rate config by category |
| PATCH | `/equipment/rate-config/:category` | `equipment:configure` | Set default hourly/daily/deposit% |

Rate config changes affect **new bookings only**; existing bookings keep their captured `totalCost`
and `depositPaid`.

---

## 4. Business rules & state machines

### 4.1 Equipment state machine

```
        ┌──────────────────────────────────────────────┐
        ▼                                              │
  AVAILABLE ──(booking confirmed)──► BOOKED ──(in use / returned)──► AVAILABLE
     │  ▲                                                              ▲
     │  └──(maintenance completed)──────────────────────────────────┘
     │
     ├──(schedule blocking maintenance)──► MAINTENANCE ──(completed)──► AVAILABLE
     │
     └──(retire)──► RETIRED   (terminal; no new bookings; DELETE alias)
```

- `MAINTENANCE` and `RETIRED` block new bookings. An open, due maintenance item forces `MAINTENANCE`.
- `BOOKED` is set on booking confirmation; during actual usage the *booking* is `IN_USE` while the
  *equipment* remains `BOOKED` until return.

### 4.2 Booking state machine (locked — payment-after-approval)

```
                admin approve                 USER pays full cost (wallet)      admin handover
PENDING ───────────────────────► APPROVED ──────────────────────────────► CONFIRMED ─────────────► IN_USE
   │                                │  (awaiting payment)                     │                        │
   │ admin reject                   │ cancel                                  │ cancel                 │ (endDate passed, not returned)
   ▼                                ▼                                         ▼                        ▼
REJECTED                        CANCELLED                                 CANCELLED                 OVERDUE
   │                                                                                                   │
(reason)                                                                                    complete   │ complete
                                                                                                       ▼
                                                              IN_USE / OVERDUE ──complete──► COMPLETED
```

- **`approve`** (admin, `equipment:approve`): only from `PENDING`. Sets operator fields, issues
  `trackingToken`, notifies the user to pay. **No money is collected; equipment is NOT reserved yet.**
- **`reject`** (admin, `equipment:reject`): only from `PENDING`; requires a reason → `REJECTED` (terminal).
- **`CONFIRMED`** is reached when the **user pays the full cost from their wallet** (user-side action,
  not an admin endpoint). On successful payment: `paymentStatus = PAID`, `depositPaid` = deposit portion
  captured, availability conflict re-checked, and `Equipment.status = BOOKED`. If the window is no longer
  available at payment time, payment is rejected/refunded (user PRD owns that flow).
- **`handover`** (admin, `equipment:confirm`): from `CONFIRMED` → `IN_USE`; sets `actualStartDate`,
  (re)activates the `trackingToken`, GPS tracking begins.
- **`OVERDUE`**: system transition when `now > endDate` and status is `IN_USE`; accrues `overdueFeePerDay`.
- **`complete`**: from `IN_USE` or `OVERDUE`; runs return inspection, settles the **deposit portion** of
  the paid amount, frees the equipment (`AVAILABLE`, or `MAINTENANCE` if damage warrants), increments
  `bookingHistory`, revokes `trackingToken`.
- **`cancel`**: allowed from `PENDING` / `APPROVED` / `CONFIRMED`. If `CONFIRMED` (user already paid),
  cancellation triggers a wallet refund per policy. Not allowed once `IN_USE` (must `complete`).
- **Availability conflict check** runs at **user payment (`→ CONFIRMED`)** and again at **`handover`**:
  no two `CONFIRMED`/`IN_USE` bookings may overlap `[startDate, endDate]` for the same equipment, and
  the window must not overlap a blocking maintenance entry.

> **Superseded:** the old `PENDING ──confirm──► CONFIRMED` admin transition (which required a deposit to
> already be paid) is retired. Availability approval (`approve`) and payment (`CONFIRMED`, user-driven)
> are now distinct steps.

### 4.3 Deposit settlement (refund vs damage deduction)

The user paid the **full cost upfront** at `CONFIRMED`. The refundable component at `complete` is the
**deposit portion** of that payment (`depositPaid`, denote `D`). At `complete` (or via the standalone
deposit endpoints):

```
depositPaid  (deposit portion of the full upfront payment) = D
damageDeducted (from damageReport)  = min(costEstimate, D)   // never exceeds deposit
overdueCharges                      = overdueDays * overdueFeePerDay
totalDeductions                     = damageDeducted + overdueCharges (capped at D)
depositRefunded                     = D - totalDeductions      // >= 0  → wallet REFUND
```

> The rental portion (full cost − deposit portion) is **earned/consumed** on completion and is **not**
> refunded. Only `D` (the deposit portion) is at play in settlement.

- **Damage-over-deposit recovery path (adopted design).** If damage `costEstimate` exceeds the
  deposit, the excess is recorded as an **outstanding charge / collections record** against the
  booking's `userId` (never silently written off), and surfaced for recovery via a wallet debit or
  invoice flow. This recovery path is owner-approved adopted design (see
  [README](../README.md#adopted-domain-schema-extensions-finalized) and
  [`data_structure.md`](../../data_structure.md) §7 for the `EquipmentBooking` recovery fields).
- Refund is a wallet `REFUND` transaction to the booking's `userId`; deduction is recorded in
  `damageReport.deductedFromDeposit`. Idempotency key `deposit:{bookingId}` prevents double refund.
- `condition: "OK"` with no damageReport → full deposit refund (minus any overdue charges).

### 4.4 GPS / geofence rules

- A position outside every active geofence applicable to the equipment raises a `GEOFENCE_BREACH`
  `gpsAlert` (once per continuous excursion, de-duplicated).
- Speed above a configured threshold raises `OVERSPEED`; no update for > 2× interval raises
  `SIGNAL_LOST`.
- Alerts appear on the live map and the dashboard alert center until acknowledged.

---

## 5. Validation

- `defaultHourlyRate`, `defaultDailyRate`, `minDepositNgn`, `overdueFeePerDay`: integer NGN `>= 0`.
- `depositPercent`: number `0–100`.
- `damageReport.costEstimate`: integer NGN `> 0`.
- `dueDate` (maintenance): valid future date (or today).
- Geofence: `CIRCLE` requires `center` + `radiusMeters > 0`; `POLYGON` requires `>= 3` points.
- `cancel`/deposit-deduct require a non-empty `reason`/`description`.
- Booking date windows validated (`startDate < endDate`, within `MAX_BOOKING_DAYS`), no overlap
  conflicts, no maintenance overlap.
- All `:id` params validated as ObjectId; missing target → relevant `*_NOT_FOUND`.

---

## 6. Audit events

| Action | Trigger | Severity |
|--------|---------|----------|
| `equipment.create` / `.update` / `.retire` | fleet CRUD | normal |
| `equipment.booking.approve` / `.reject` | availability approval / rejection | normal |
| `equipment.booking.handover` / `.complete` / `.cancel` | booking lifecycle | normal |
| `equipment.booking.token.issue` | `trackingToken` generated at approve/handover | normal |
| `equipment.maintenance.schedule` / `.complete` | maintenance | normal |
| `equipment.deposit.refund` / `.deduct` | deposit settlement | **high** |
| `equipment.geofence.create` / `.update` / `.delete` | geofence config | normal |
| `equipment.gps.alert.ack` | acknowledge alert | normal |
| `equipment.rate_config.update` | rate config change | **high** |

Each entry records `actor`, `targetType`, `targetId`, `before`, `after`, `reason?`, `timestamp`,
`ip`, `userAgent`.

---

## 7. Error codes

```json
{ "success": false, "error": { "code": "EQP_ADM_005", "message": "Booking window conflicts with an existing booking", "details": { "conflictBookingId": "eqb_9" } } }
```

| Code | Meaning |
|------|---------|
| `EQP_ADM_001` | Equipment not found |
| `EQP_ADM_002` | Booking not found |
| `EQP_ADM_003` | Invalid equipment status transition |
| `EQP_ADM_004` | Invalid booking status transition |
| `EQP_ADM_005` | Booking window conflict (overlapping booking) |
| `EQP_ADM_006` | Maintenance window overlaps an active booking |
| `EQP_ADM_007` | Cannot retire/delete — active bookings exist |
| `EQP_ADM_008` | Deposit already settled (idempotency conflict) |
| `EQP_ADM_009` | Damage estimate invalid |
| `EQP_ADM_010` | Handover blocked — booking not `CONFIRMED` (user has not paid full cost) |
| `EQP_ADM_011` | GPS device inactive / no live position |
| `EQP_ADM_012` | Invalid geofence definition |
| `EQP_ADM_013` | Reason required for this action |
| `EQP_ADM_014` | Insufficient permission for action |
| `EQP_ADM_015` | Invalid booking action for current status (e.g. approve on non-`PENDING`) |
| `EQP_ADM_016` | Invalid / expired / revoked `trackingToken` (operator GPS push rejected) |

---

## 8. Admin UI / Section (premium UX)

Route base `/bennie/equipment`. Rich ops console — no basic UI.

- **Fleet table** — pagination, search, filters (category, status, GPS active, due-for-maintenance).
  Status chips; quick actions (edit, schedule maintenance, retire with confirm modal).
- **Rich create/edit equipment form** — a **multi-section** form covering the whole `Equipment` schema:
  - **Identity:** name, category (select), model, serial number, year of manufacture.
  - **Pricing:** hourly rate, daily rate, deposit required (NGN) — defaults pre-filled from
    `equipmentRateConfig` for the chosen category, overridable per unit.
  - **Location:** a **map picker** that sets `location { lat, lng, address }` (drag pin / search address;
    reverse-geocode fills `address`).
  - **Specifications:** an add/remove **key-value editor** writing to `specifications` (e.g.
    `enginePowerHp: 75`, `fuel: Diesel`).
  - **Images:** a multi-file uploader that pushes each file to `POST /api/v1/admin/upload` and stores the
    returned **URLs** on `images[]` (drag-drop, reorder, remove, set primary; §2.6).
  - **GPS tracker:** `gpsTracker.deviceId` + `isActive` toggle.
  Validation mirrors [§5](#5-validation); submit is guarded by `equipment:create` / `equipment:update`.
- **Equipment detail drawer** — tabs: Overview/specs, Bookings, Maintenance timeline, GPS (mini live
  map + last-seen), Rates. Inline rate/spec editing with confirm.
- **Bookings table** — filters (status incl. `APPROVED`/`REJECTED`, payment, date range, overdue,
  awaiting-payment). Row → **booking detail drawer**: timeline stepper
  (Pending → Approved → Confirmed (paid) → In use → Completed), deposit ledger, operator panel
  (name/phone/plate + `trackingToken` state), damage report form, action buttons
  (**approve / reject / handover / complete / cancel**) guarded by permission.
- **Approval queue** — `PENDING` requests awaiting **availability approval**, with
  conflict/availability indicators and the operator-assignment fields; **approve** issues a
  `trackingToken`, **reject** requires a reason. A separate **Awaiting-payment** view lists `APPROVED`
  bookings where the user has not yet paid (read-only nudge; admins do not collect payment).
- **Live GPS map** — **map-first** view: all in-use equipment plotted, colour-coded by status, with
  geofence overlays; click a marker for live speed/heading and its booking; **route playback**
  scrubber on a booking's trail. Alert badges (geofence breach / overspeed / signal lost) with an
  acknowledge action.
- **Geofence editor** — draw circle/polygon on the map, assign scope, toggle active.
- **Maintenance scheduler** — calendar view of maintenance windows vs. bookings; conflict warnings.
- **Deposit settlement modal** — shows deposit, computed damage/overdue deductions, net refund, and
  any **damage-over-deposit outstanding charge**; confirm required; button distinguished and hidden
  for admins lacking `equipment:settle-deposit` (Super Admin only).
- **Rate config** — per-category form (hourly/daily/deposit%/overdue fee), with a "future bookings
  only" note; utilization/revenue charts.

---

## 9. Environment variables

DB-driven via `equipmentRateConfig` / global `settings`; env vars are bootstrap defaults:

```bash
EQUIPMENT_BOOKING_PREFIX=EQB
GPS_UPDATE_INTERVAL_SECONDS=30
GEOFENCE_ALERT_ENABLED=true
MAX_BOOKING_DAYS=30
DEPOSIT_PERCENTAGE=20            # seeds equipmentRateConfig.depositPercent
OVERDUE_FEE_PER_DAY=0           # seeds overdueFeePerDay default
OVERSPEED_THRESHOLD_KMH=80
```

---

## 10. Open questions for the owner

1. **Damage exceeding deposit — RESOLVED (adopted).** When `damageReport.costEstimate > depositPaid`,
   the excess is recorded as an **outstanding charge / collections record** against the user and
   recovered via wallet debit / invoice (never written off) — the adopted damage-over-deposit recovery
   path ([§4.3](#43-deposit-settlement-refund-vs-damage-deduction),
   [README](../README.md#adopted-domain-schema-extensions-finalized)). Remaining sub-question: confirm
   the preferred recovery mechanism (auto wallet debit vs. manual invoice).
2. **Operator management — RESOLVED (deferred to its own module).** Operators become an
   **admin-managed module** with an `operators` collection, CRUD/roster, assignment to a booking at
   approval/handover, and an operator tracking app/view — specified in
   [`PRD/operator/operator_overview.md`](../../operator/operator_overview.md) (📄 planned, **not built
   this phase**). This phase captures operator identity **on the booking** (`operatorName`/`Phone`/`Plate`)
   plus a per-booking `trackingToken` (§2.5); `EquipmentBooking.operatorId` will later ref `operators`.
3. **Cooperative scoping.** `Equipment.cooperativeId` implies per-co-op ownership. Should admin fleet
   views be scoped by co-op (multi-tenant), and should `adminRoles` carry a co-op scope? (Mirrors the
   README's open multi-tenant admin-scoping question.)
4. **GPS transport — RESOLVED (socket.io, operator-push).** The live-map transport is **socket.io**
   (see [socket.io.md](../../socket.io.md)); GPS ingestion is a **real geolocation push from the assigned
   operator's device**, authenticated by the per-booking `trackingToken` (§2.5.1) — **not** a device-
   provider webhook and **not** simulated. Geofences + GPS alerts are in scope this phase.
5. **Deposit RBAC — RESOLVED.** `equipment:settle-deposit` is **Super-Admin-only and non-delegable**
   (financial reversal — [README](../README.md#super-admin-only-permission-set-finalized--not-delegable)).
