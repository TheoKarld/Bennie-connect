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
- `Equipment.maintenanceSchedule[]`: `{ type, dueDate, completedAt?, notes }` — an open (uncompleted)
  entry with `dueDate <= now` blocks availability.
- `Equipment.gpsTracker`: `{ deviceId, isActive, lastUpdateAt? }`.
- `EquipmentBooking.status`: `PENDING | CONFIRMED | IN_USE | COMPLETED | CANCELLED | OVERDUE`.
- `EquipmentBooking.depositPaid`, `.damageReport { description, costEstimate, deductedFromDeposit }`.
- `EquipmentBooking.gpsTracking[]` and (frontend) `currentGpsPos` for live location.

---

## 3. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission.

### 3.1 Equipment fleet (`equipment:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/equipment` | `equipment:view` | List/search fleet (filters below) |
| GET | `/equipment/:id` | `equipment:view` | Equipment detail (specs, status, bookings, maintenance, GPS) |
| POST | `/equipment` | `equipment:create` | Add equipment |
| PATCH | `/equipment/:id` | `equipment:update` | Update fields (rates, specs, location, gpsTracker, images) |
| DELETE | `/equipment/:id` | `equipment:delete` | Retire equipment (`status=RETIRED`; blocked if active bookings) |

**GET `/equipment` query params:** `page`, `limit`, `q`, `category`, `status`, `cooperativeId`,
`gpsActive` (bool), `dueForMaintenance` (bool), `sortBy` (`createdAt|bookingHistory`), `order`.

### 3.2 Booking management (`equipment:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/equipment/bookings` | `equipment:view` | All bookings (filters below) |
| GET | `/equipment/bookings/:id` | `equipment:view` | Booking detail + GPS trail + deposit ledger |
| POST | `/equipment/bookings/:id/confirm` | `equipment:confirm` | Confirm a PENDING booking |
| POST | `/equipment/bookings/:id/complete` | `equipment:complete` | Complete an IN_USE/OVERDUE booking (return inspection) |
| POST | `/equipment/bookings/:id/cancel` | `equipment:cancel` | Cancel a booking (reason required) |

**GET `/equipment/bookings` query params:** `page`, `limit`, `equipmentId`, `userId`, `status`,
`paymentStatus`, `startDate`, `endDate`, `overdue` (bool).

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
**Response 200:**
```json
{ "success": true, "data": { "bookingId": "eqb_1", "status": "COMPLETED",
    "depositPaid": 20000, "damageDeducted": 18000, "depositRefunded": 2000,
    "refundTxnRef": "REF-eqb_1" } }
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

Live feed is served over WebSocket/SSE where available (GPS updates ~ every
`GPS_UPDATE_INTERVAL_SECONDS`, default 30s); the REST endpoints return the latest snapshot for
polling clients. GPS reads are high-frequency and **not** audited; alert acknowledgements are.

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

### 4.2 Booking state machine

```
PENDING ──confirm──► CONFIRMED ──(handover / actualStartDate)──► IN_USE ──complete──► COMPLETED
   │                    │                                          │
   │                    │                          (endDate passed │ not returned)
   cancel               cancel                                     ▼
   │                    │                                       OVERDUE ──complete──► COMPLETED
   ▼                    ▼                                          │
CANCELLED           CANCELLED                                   cancel? (no — must complete)
```

- `confirm`: only from `PENDING`; requires `paymentStatus` at least `PARTIAL` (deposit paid). Sets
  `Equipment.status = BOOKED`.
- Auto/`IN_USE`: on handover checklist (`actualStartDate` set). GPS tracking begins.
- `OVERDUE`: system transition when `now > endDate` and status is `IN_USE`; accrues
  `overdueFeePerDay`.
- `complete`: from `IN_USE` or `OVERDUE`; runs return inspection, settles deposit, frees the
  equipment (`AVAILABLE`, or `MAINTENANCE` if damage warrants), increments `bookingHistory`.
- `cancel`: allowed from `PENDING`/`CONFIRMED` only. If `CONFIRMED` and deposit paid, cancellation
  triggers a deposit refund per policy. Not allowed once `IN_USE` (must `complete`).
- **Availability conflict check** on confirm: no two `CONFIRMED`/`IN_USE` bookings may overlap
  `[startDate, endDate]` for the same equipment, and the window must not overlap a blocking
  maintenance entry.

### 4.3 Deposit settlement (refund vs damage deduction)

At `complete` (or via standalone deposit endpoints):

```
depositPaid                         = D
damageDeducted (from damageReport)  = min(costEstimate, D)   // never exceeds deposit
overdueCharges                      = overdueDays * overdueFeePerDay
totalDeductions                     = damageDeducted + overdueCharges (capped at D)
depositRefunded                     = D - totalDeductions      // >= 0
```

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
| `equipment.booking.confirm` / `.complete` / `.cancel` | booking lifecycle | normal |
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
| `EQP_ADM_010` | Confirm blocked — deposit not paid |
| `EQP_ADM_011` | GPS device inactive / no live position |
| `EQP_ADM_012` | Invalid geofence definition |
| `EQP_ADM_013` | Reason required for this action |
| `EQP_ADM_014` | Insufficient permission for action |

---

## 8. Admin UI / Section (premium UX)

Route base `/bennie/equipment`. Rich ops console — no basic UI.

- **Fleet table** — pagination, search, filters (category, status, GPS active, due-for-maintenance).
  Status chips; quick actions (edit, schedule maintenance, retire with confirm modal).
- **Equipment detail drawer** — tabs: Overview/specs, Bookings, Maintenance timeline, GPS (mini live
  map + last-seen), Rates. Inline rate/spec editing with confirm.
- **Bookings table** — filters (status, payment, date range, overdue). Row → **booking detail
  drawer**: timeline stepper (Pending→Confirmed→In use→Completed), deposit ledger, damage report
  form, action buttons (confirm / complete / cancel) guarded by permission.
- **Approval / confirmation queue** — PENDING bookings needing confirmation, with conflict/availability
  indicators.
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
2. **Operator management.** `EquipmentBooking.operator` refs a `User`, but there is no admin flow to
   assign/roster operators. Do we need an operator-assignment endpoint here or in a separate ops PRD?
3. **Cooperative scoping.** `Equipment.cooperativeId` implies per-co-op ownership. Should admin fleet
   views be scoped by co-op (multi-tenant), and should `adminRoles` carry a co-op scope?
4. **GPS transport.** Confirm the live-map transport (WebSocket/SSE vs. polling) and whether GPS
   ingestion is a webhook from a device provider or a device push — affects `gpsTracker.deviceId`
   integration.
5. **Deposit RBAC — RESOLVED.** `equipment:settle-deposit` is **Super-Admin-only and non-delegable**
   (financial reversal — [README](../README.md#super-admin-only-permission-set-finalized--not-delegable)).
