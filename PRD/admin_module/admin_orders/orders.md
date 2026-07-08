# Admin PRD: Marketplace Orders Operations (LIVE build)

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no admin orders code exists yet; the `WalletService`
> payment/refund primitives are ✅ — see §4.1)
>
> Live blueprint for `admin-dev` / `backend-dev` governing admin oversight of the LIVE
> marketplace **`orders`** collection: the split-per-seller order model, the fulfilment state
> machine (merchant-driven + admin override), cancellations, and **wallet refunds**.
>
> This section was **carved out of** [`marketplace/marketplace.md`](../marketplace/marketplace.md)
> (which now covers products/categories/sellers only). Companion user-side specs (authored
> concurrently): [`PRD/user_module/cart_checkout/cart_checkout.md`](../../user_module/cart_checkout/cart_checkout.md)
> (checkout + buyer actions) and
> [`PRD/user_module/merchant_panel/merchant_panel.md`](../../user_module/merchant_panel/merchant_panel.md)
> (merchant fulfilment). Canonical schemas: [`PRD/data_structure.md`](../../data_structure.md) §11.4.

---

## 1. Overview

The admin Orders console is the cross-seller control room for every marketplace order. **Admin
sees ALL orders** — platform (`seller.type = 'PLATFORM'`) and merchant
(`seller.type = 'MERCHANT'`) — and **can override any fulfilment transition, cancel, or refund**
(owner-locked).

**Owner-locked order model (final):**

1. **Wallet-only payment.** Checkout debits the buyer's wallet via
   `WalletService.debitForPayment(...)` (idempotent by reference); there is **no card/SeerBit
   leg**. Every order is therefore created with `paymentStatus: 'PAID'`.
2. **Split per seller at checkout.** The cart is split into **one order per seller**, linked by a
   shared **`checkoutGroupId`**. `seller` is `{ type: 'PLATFORM' | 'MERCHANT', merchantId? }`.
3. **Fulfilment ownership.** PLATFORM orders (admin-created products) are fulfilled by **admins**
   from this console. MERCHANT orders are fulfilled by the **merchant** from the user-plane
   Merchant Hub (`PENDING → PROCESSING → SHIPPED → DELIVERED`). Admin may override either.
4. **Buyer actions.** The buyer may **cancel while `PENDING`** (auto wallet refund, user-plane)
   and **confirms receipt after `DELIVERED`** (`buyerConfirmedAt`, user-plane).
5. **Merchant earnings.** Each **DELIVERED** merchant order books the merchant's **net share**
   (total − platform-fee %) into the `merchantEarnings` ledger — **not** the wallet. Payout is
   manual/adashe-style — see [`merchants.md`](../merchants/merchants.md) §5.
6. **Refunds** are `orders:refund` — **Super-Admin-only, NOT delegable** — via `creditRefund(...)`
   (partial refunds, `PARTIALLY_REFUNDED`, restock, refund window — [§4.4](#44-refund-rules)).

**Conventions (shared — see [`README.md`](../README.md)):** backend `/api/v1/admin/*`; admin
frontend `/bennie/*`; admin identity = `adminUsers`; authz = `adminRoles` + overrides, Super
Admin = `*`; every endpoint declares its permission; every mutation writes `adminAuditLog`;
money is whole NGN; responses serialize `_id → id`.

---

## 2. Collections / Schema

Reads/mutates the LIVE **`orders`** collection (canonical: `data_structure.md` §11.4 — shared
with the user plane, **not** redefined here). Key fields relied upon:

```jsonc
{
  "_id": "ObjectId",
  "orderNumber": "string",               // unique, "ORD_<ts>_<rand>"
  "checkoutGroupId": "string",           // shared by all sibling orders of one checkout ("CHK_<ts>_<rand>")
  "buyerId": "ObjectId",                 // ref users
  "seller": {
    "type": ["PLATFORM", "MERCHANT"],
    "merchantId": "ObjectId?"            // ref merchants — required when type = MERCHANT
  },
  "items": [                             // immutable snapshots taken at checkout
    { "productId": "ObjectId", "productName": "string", "imageUrl": "string?",
      "unit": "string", "quantity": "number", "unitPrice": "number", "subtotal": "number" }
  ],
  "pricing": {
    "subtotal": "number",                // NGN — sum of item subtotals
    "deliveryFee": "number",             // NGN — default 0 this phase
    "total": "number",                   // NGN — what the buyer's wallet was debited
    "platformFeePercent": "number",      // captured at checkout from settings (MERCHANT orders)
    "platformFee": "number",             // NGN — deducted from the MERCHANT side at earning booking
    "merchantNet": "number?"             // NGN — total − platformFee (MERCHANT orders only)
  },
  "paymentStatus": ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"],
  "walletPaymentRef": "string",          // debitForPayment reference "order-pay:{orderNumber}"
  "fulfillmentStatus": ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
  "buyerConfirmedAt": "Date?",           // buyer confirms receipt after DELIVERED (user-plane)
  "deliveryAddress": { "name": "string", "phone": "string", "street": "string", "city": "string", "state": "string" },
  "trackingInfo": { "carrier": "string", "trackingNumber": "string" },   // optional
  "timeline": [                          // append-only status trail (renders the stepper)
    { "status": "string", "at": "Date", "actorType": ["buyer","merchant","admin","system"],
      "actorId": "string?", "note": "string?" }
  ],
  "refunds": [                           // admin refunds (creditRefund) — see §4.4
    { "amount": "number", "reason": "string", "reference": "string",
      "restock": "boolean", "refundedBy": "ObjectId", "at": "Date" }
  ],
  "refundedTotal": "number",             // cumulative NGN refunded
  "cancelledBy": { "type": ["buyer","merchant","admin"], "id": "string" },  // optional
  "cancellationReason": "string?",
  "deliveredAt": "Date?",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

> **Payment note.** Because checkout is wallet-only and debits at placement, there is **no
> `PENDING`/`FAILED` payment state** on a persisted order — an order only exists if the wallet
> debit succeeded (per split order, reference `order-pay:{orderNumber}`; the checkout sequence is
> the user module's contract in `cart_checkout.md`).

---

## 3. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission.

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/orders` | `orders:view` | List/search ALL orders (filters below) |
| GET | `/orders/:id` | `orders:view` | Order detail (items, buyer, seller, payment, refunds, timeline) |
| GET | `/orders/checkout-groups/:checkoutGroupId` | `orders:view` | All sibling orders of one checkout |
| PATCH | `/orders/:id/fulfillment` | `orders:update` | **Override** `fulfillmentStatus` (any transition — [§4.3](#43-admin-override-rules)) |
| POST | `/orders/:id/cancel` | `orders:update` | Admin-cancel an order (reason required; triggers the mandatory full wallet refund — [§4.5](#45-cancellation-rules)) |
| POST | `/orders/:id/refund` | `orders:refund` | Refund (full/partial) to the buyer wallet (**Super-Admin-only, non-delegable**) |
| GET | `/orders/export` | `orders:export` | CSV export of the current filter set (audited) |

**GET `/orders` query params:** `page`, `limit`, `orderNumber`, `checkoutGroupId`, `buyerId`,
`sellerType` (`PLATFORM|MERCHANT`), `merchantId`, `productId`, `paymentStatus`,
`fulfillmentStatus`, `startDate`, `endDate`, `minTotal`, `maxTotal`, `buyerConfirmed` (bool),
`sortBy` (`createdAt|total`), `order`.

**GET `/orders/:id` — response 200 (abridged):**
```json
{
  "success": true,
  "data": {
    "id": "6661bb019b3e4a0012cc0001",
    "orderNumber": "ORD_1720200000_x1y2z3",
    "checkoutGroupId": "CHK_1720200000_q9w8e7",
    "buyer": { "id": "6650…", "userId": "USR_1719…", "name": "Aisha Bello", "phone": "+2348030000000" },
    "seller": { "type": "MERCHANT", "merchantId": "665e…", "businessName": "GreenGro Supplies" },
    "items": [
      { "productId": "6660aa…", "productName": "NPK 20-10-10 Fertilizer", "unit": "50kg Bag",
        "quantity": 2, "unitPrice": 42000, "subtotal": 84000 }
    ],
    "pricing": { "subtotal": 84000, "deliveryFee": 0, "total": 84000,
                 "platformFeePercent": 5, "platformFee": 4200, "merchantNet": 79800 },
    "paymentStatus": "PAID",
    "walletPaymentRef": "order-pay:ORD_1720200000_x1y2z3",
    "fulfillmentStatus": "SHIPPED",
    "buyerConfirmedAt": null,
    "refunds": [],
    "refundedTotal": 0,
    "timeline": [
      { "status": "PENDING",    "at": "2026-07-02T10:00:00Z", "actorType": "system" },
      { "status": "PROCESSING", "at": "2026-07-02T12:10:00Z", "actorType": "merchant", "actorId": "665e…" },
      { "status": "SHIPPED",    "at": "2026-07-03T08:30:00Z", "actorType": "merchant", "actorId": "665e…", "note": "GIG dispatch" }
    ],
    "createdAt": "2026-07-02T10:00:00Z"
  }
}
```

**PATCH `/orders/:id/fulfillment` — request:**
```json
{ "fulfillmentStatus": "DELIVERED", "note": "Confirmed by depot after carrier POD",
  "trackingInfo": { "carrier": "GIG", "trackingNumber": "GIG-88213" } }
```
Server validates against the state machine ([§4.2](#42-fulfilment-state-machine)) and the
override rules ([§4.3](#43-admin-override-rules)); appends a `timeline` entry with
`actorType: 'admin'`. Setting `DELIVERED` on a MERCHANT order **books the earnings-ledger entry**
([§4.6](#46-earnings-booking-on-delivered)).

**POST `/orders/:id/cancel` — request:**
```json
{ "reason": "Merchant unable to fulfil — stock discrepancy", "restock": true }
```
**Response 200:**
```json
{ "success": true, "data": { "id": "6661bb019b3e4a0012cc0001", "fulfillmentStatus": "CANCELLED",
    "paymentStatus": "REFUNDED", "refund": { "amount": 84000, "reference": "cancel-refund:ORD_1720200000_x1y2z3" } } }
```

**POST `/orders/:id/refund` — request (Super Admin only):**
```json
{ "amount": 42000, "reason": "One of two bags arrived damaged", "restock": false }
```
- `amount` optional; omitted = full remaining refundable amount. Partial refunds must be `<=`
  remaining refundable (`pricing.total − refundedTotal`).
- On success: `creditRefund(buyerId, { amount, reference: "refund:{orderId}:{seq}", … })`;
  `refundedTotal` incremented; `paymentStatus` → `PARTIALLY_REFUNDED` (or `REFUNDED` when
  cumulative refunds reach `total`); `restock: true` returns the refunded quantity to
  `inventory.available`. Fully specified in [§4.4](#44-refund-rules).

---

## 4. Business rules & state machines

### 4.1 Wallet primitives (✅ implemented)

`backend/src/wallet/wallet.service.ts`:

- `debitForPayment(userId, { amount, reference, description, narration?, category?, metadata? })`
  — atomic + **idempotent by `reference`** (repeat call with an existing reference returns the
  prior transaction, no double debit); `WALLET_001` on insufficient balance.
- `creditRefund(userId, { amount, reference, description, narration?, category?, metadata? })`
  — atomic + **idempotent by `reference`**; `amount <= 0` is a success no-op.

All order money movement goes through these two methods — **admin code never writes wallet
balances directly**.

### 4.2 Fulfilment state machine

```
                merchant/admin           merchant/admin        merchant/admin
 PENDING ────────────────► PROCESSING ────────────► SHIPPED ────────────► DELIVERED ──(buyer confirms)──► buyerConfirmedAt set
    │                          │                       │                      │
    │ buyer cancel (user-plane,│ admin cancel          │ admin cancel         │ (MERCHANT orders: earnings booked — §4.6)
    │ auto wallet refund)      │                       │
    ▼                          ▼                       ▼
 CANCELLED ◄───────────────────┴───────────────────────┘        (CANCELLED is terminal; auto full refund — §4.5)
```

- **Merchant-driven transitions** (user-plane, Merchant Hub): `PENDING → PROCESSING → SHIPPED →
  DELIVERED`, forward-only, on **their own** orders only. PLATFORM orders are advanced by admins
  here with `orders:update`.
- **Buyer cancel** (user-plane): only while `PENDING`; auto full wallet refund
  (`creditRefund`, reference `cancel-refund:{orderNumber}`), restock, `paymentStatus = REFUNDED`.
- **Buyer confirm receipt** (user-plane): only after `DELIVERED`; sets `buyerConfirmedAt`
  (does **not** change `fulfillmentStatus`; `DELIVERED` remains the terminal fulfilment state).
- `DELIVERED` and `CANCELLED` are terminal for non-admin actors.

### 4.3 Admin override rules (owner-locked: "admin can override ANY transition")

Admins with `orders:update` may set any `fulfillmentStatus` on any order, with these guards:

- **Forward moves** (per §4.2 order) — normal severity, `note` optional.
- **Backward/corrective moves** (e.g. `SHIPPED → PROCESSING`, `DELIVERED → SHIPPED`) — allowed
  **with a required `note`** (else `ORD_ADM_005`), audited **high-severity**. A corrective move
  out of `DELIVERED`:
  - **reverses the earnings booking** if the `merchantEarnings` entry is still `AVAILABLE`
    (entry set `REVERSED`);
  - is **blocked** (`ORD_ADM_008`) if the entry is `LOCKED` in a payout request or already
    `SETTLED` — resolve the payout first (see `merchants.md` §5).
- **`CANCELLED` cannot be exited** — no transition out of `CANCELLED` (`ORD_ADM_002`). Money
  correction on a cancelled order is not a state change (the refund already happened).
- **Entering `CANCELLED`** is only via the `cancel` endpoint (never via the PATCH), so the
  mandatory refund cannot be skipped.
- Every override appends a `timeline` entry (`actorType: 'admin'`) and notifies the buyer
  (`order.status`), and the merchant for MERCHANT orders.

### 4.4 Refund rules (`orders:refund` — Super-Admin-only, non-delegable)

- Only orders with `paymentStatus ∈ {PAID, PARTIALLY_REFUNDED}` are refundable, and only within
  `settings.marketplace.refundWindowDays` of `createdAt` (the wallet debit moment). The Super
  Admin may override the window — the override is audited with the reason.
- Full refund (`amount == total − refundedTotal`): `paymentStatus = REFUNDED`.
- Partial refund: `paymentStatus = PARTIALLY_REFUNDED` (**adopted enum value** — README /
  `data_structure.md` §11.4). Cumulative refunds may never exceed `pricing.total`
  (`ORD_ADM_004`).
- Refund credits the **buyer's wallet** via `creditRefund` with idempotency reference
  `refund:{orderId}:{seq}` (seq = 1-based refund index) — a duplicate submission returns the
  prior transaction (`ORD_ADM_006` surfaced when the same seq is retried with a different
  amount).
- `restock: true` returns the refunded quantity to `inventory.available`.
- **Merchant-earnings interaction:** refunding a MERCHANT order that already booked earnings
  (post-`DELIVERED`):
  - entry `AVAILABLE` → full refund sets it `REVERSED`; partial refund books a **negative
    `ADJUSTMENT`** entry of `−(refundAmount − proportional fee)` (see `merchants.md` §5.3).
  - entry `LOCKED`/`SETTLED` → refund still proceeds (buyer is made whole); an offsetting
    negative `ADJUSTMENT` entry is booked against the merchant's future earnings, and the
    merchant + admins are notified. Audited high-severity.
- **RBAC:** `orders:refund` is in the README
  [Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable);
  it cannot be granted to a sub-admin role or override.

### 4.5 Cancellation rules

- **Admin cancel** (`orders:update`): allowed from `PENDING` / `PROCESSING` / `SHIPPED`
  (never from `DELIVERED` — use a refund; never from `CANCELLED`). Requires `reason`
  (`ORD_ADM_005`).
- Because every order is wallet-`PAID`, **cancellation always triggers the mandatory full wallet
  refund automatically** — a system-mediated `creditRefund` with reference
  `cancel-refund:{orderNumber}` (idempotent), `paymentStatus = REFUNDED`, reserved stock
  released (default `restock: true`).
  > **Rule (final interpretation of owner decisions 3 + 10):** this **mechanical
  > cancellation refund is not gated by `orders:refund`** — it is the same automatic refund the
  > buyer's own `PENDING`-cancel performs with no admin involved. The Super-Admin-only
  > `orders:refund` governs **discretionary** refunds (partial/quality refunds and refunds on
  > orders that remain live or are already `DELIVERED`). Admin cancels are audited
  > **high-severity** because money moves.
- Records `cancelledBy: { type: 'admin', id }` + `cancellationReason`; appends the timeline
  entry; notifies the buyer (`order.cancelled`) and the merchant (MERCHANT orders).

### 4.6 Earnings booking on DELIVERED (owner-locked)

On the transition to `DELIVERED` (merchant-driven or admin override) of a **MERCHANT** order,
the system books one `merchantEarnings` entry (idempotent — unique per `orderId`):

```
gross      = pricing.total
platformFee = round(gross * pricing.platformFeePercent / 100)     // percent captured at checkout
net        = gross − platformFee                                   // = pricing.merchantNet
→ merchantEarnings entry { merchantId, orderId, gross, platformFee, net, status: 'AVAILABLE' }
```

- The net share goes to the **earnings ledger, NOT the wallet** — payout is manual/adashe-style
  (`merchants.md` §5). PLATFORM orders book **no** earnings entry (platform revenue is implicit).
- `pricing.platformFeePercent` is **captured at checkout** from
  `settings.marketplace.platformFeePercent`; later settings changes affect future checkouts only.

---

## 5. Validation

- `fulfillmentStatus` (PATCH): must be one of the enum values; transition validated per
  §4.2/§4.3 → `ORD_ADM_002`; backward move without `note` → `ORD_ADM_005`.
- `cancel`/`refund` **require** a non-empty `reason` (`>= 5` chars) → `ORD_ADM_005`.
- `refund.amount`: integer NGN `> 0`, `<=` remaining refundable → `ORD_ADM_004`.
- Refund on non-refundable payment state / outside window → `ORD_ADM_003`.
- All `:id` params validated as Mongo ObjectId; missing order → `ORD_ADM_001`.
- List filters: `startDate <= endDate`; `minTotal <= maxTotal`; unknown enum filter values → 400.

---

## 6. Notifications (owner-locked matrix)

Via the shared `NotificationService` ([`notification.md`](../../notification.md)) — persisted +
socket + FCM, with `link` deep-links. Consolidated matrix in `data_structure.md` §11.8.

| Event key | Fires on | Audience | `link` |
|-----------|----------|----------|--------|
| `order.placed` | checkout creates the order | **seller merchant** (MERCHANT orders) + **ALL admins** | `/bennie/orders/<id>` (admins); merchant-hub order URL (merchant) |
| `order.status` | any fulfilment change (`PROCESSING`/`SHIPPED`/`DELIVERED`, incl. admin overrides) | **buyer** | user order URL |
| `order.cancelled` | buyer / admin cancel | **buyer** (+ merchant for MERCHANT orders; + admins on buyer cancel) | order URLs per plane |
| `order.refunded` | admin refund (full/partial) | **buyer** (+ merchant if earnings adjusted) | user order URL |
| `order.receipt.confirmed` | buyer sets `buyerConfirmedAt` | seller (merchant or admins for PLATFORM) | `/bennie/orders/<id>` |

---

## 7. Audit events

| Action | Trigger | Severity |
|--------|---------|----------|
| `orders.fulfillment.update` | PATCH fulfillment (forward) | normal |
| `orders.fulfillment.override` | PATCH fulfillment (backward/corrective) | **high** |
| `orders.cancel` | admin cancel (money moves — mandatory refund) | **high** |
| `orders.refund` | refund (full/partial) | **high** |
| `orders.export` | CSV export (reads buyer PII + financial data) | normal |

Each entry records `actor`, `targetType: 'Order'`, `targetId`, `before`, `after`, `reason?`,
`timestamp`, `ip`, `userAgent`; refund entries also record the wallet transaction `reference`.

---

## 8. Error codes

Standard envelope:
```json
{ "success": false, "error": { "code": "ORD_ADM_002", "message": "Invalid fulfilment transition", "details": { "from": "CANCELLED", "to": "SHIPPED" } } }
```

| Code | Meaning |
|------|---------|
| `ORD_ADM_001` | Order not found |
| `ORD_ADM_002` | Invalid fulfilment transition (incl. any exit from `CANCELLED`) |
| `ORD_ADM_003` | Refund not permitted (payment state not refundable / outside refund window) |
| `ORD_ADM_004` | Refund amount exceeds refundable balance |
| `ORD_ADM_005` | Reason/note required for this action |
| `ORD_ADM_006` | Duplicate refund (idempotency conflict) |
| `ORD_ADM_007` | Cancel not allowed from current status (`DELIVERED`/`CANCELLED`) |
| `ORD_ADM_008` | Corrective move out of `DELIVERED` blocked — earnings locked/settled in a payout |
| `ORD_ADM_009` | Insufficient permission for action |
| `ORD_ADM_010` | Checkout group not found |

---

## 9. Admin UI / Section (premium UX)

Route base **`/bennie/orders`** — a **new top-level nav item** in the sidebar group
**"Operations"** (see [`admin_layout.md`](../admin_layout/admin_layout.md)), badge = count of
`PENDING` PLATFORM orders (admin's own fulfilment queue). Rich ops console — no basic UI.

- **Orders table** — server-side pagination, column sort, search by `orderNumber` /
  `checkoutGroupId` / buyer. Faceted filters: seller type (Platform/Merchant chips), merchant,
  fulfilment status, payment status, date range, amount range, buyer-confirmed. Columns:
  order #, buyer, seller badge (**Platform** / merchant name), items count, total (NGN),
  payment chip (`PAID` green / `PARTIALLY_REFUNDED` amber / `REFUNDED` grey), fulfilment chip,
  placed-at. Row click → detail page. Export CSV (`orders:export`).
- **Checkout-group ribbon** — on any order that shares a `checkoutGroupId`, a ribbon lists its
  sibling orders (per-seller split) with one-click cross-navigation.
- **Order detail page** (`/bennie/orders/:id`) —
  - **Header:** order #, seller badge, status chips, placed-at, quick actions.
  - **Items card:** snapshot list (thumbnail, name, unit, qty, unit price, subtotal) + pricing
    breakdown (subtotal, delivery fee, total; for MERCHANT orders: platform fee % + amount and
    merchant net, with a link to the merchant's earnings ledger).
  - **Buyer card:** name, phone, delivery address, link to `/bennie/users/:id` (User 360).
  - **Payment card:** `walletPaymentRef`, refunds history (amount, reason, reference, actor,
    time), remaining refundable amount.
  - **Fulfilment stepper timeline:** `PENDING → PROCESSING → SHIPPED → DELIVERED` rendered from
    `timeline[]` with actor badges (buyer/merchant/admin/system), notes, tracking info, and the
    buyer-confirmed tick (`buyerConfirmedAt`).
  - **Guarded actions:**
    - **Advance / override status** — guarded dropdown (`orders:update`); backward choices are
      visually flagged "corrective" and force a note.
    - **Cancel** — confirm modal (reason required + restock toggle, default on) with an explicit
      banner: *"Cancelling refunds ₦<total> to the buyer's wallet immediately."*
    - **Refund** — visually distinguished destructive button, **hidden for admins lacking
      `orders:refund`** (Super Admin only); confirm modal with amount (defaults to remaining
      refundable), reason, restock toggle, and the earnings-impact note for delivered merchant
      orders.
- **Dashboard hooks:** `PENDING` PLATFORM orders and stale `SHIPPED` orders (> N days, no
  delivery) surface in the dashboard alert center; order-volume / refund-rate charts feed the
  dashboard analytics.

---

## 10. Environment variables

DB-driven via the global `settings` collection; env vars are bootstrap seeds only (shared with
[`marketplace.md`](../marketplace/marketplace.md) §9):

```bash
PLATFORM_FEE_PERCENT=5              # seeds settings.marketplace.platformFeePercent
MARKETPLACE_REFUND_WINDOW_DAYS=14   # seeds settings.marketplace.refundWindowDays
ORDER_NUMBER_PREFIX=ORD
CHECKOUT_GROUP_PREFIX=CHK
```

---

## 11. Resolved decisions (owner-locked)

1. **Wallet-only checkout — FINAL.** `debitForPayment` at checkout; `creditRefund` for all
   refunds/cancellations; both idempotent by reference. No card/SeerBit at checkout.
2. **Split-per-seller orders — FINAL.** One order per seller per checkout, linked by
   `checkoutGroupId`; `seller: { type: 'PLATFORM'|'MERCHANT', merchantId? }`.
3. **Admin omniscience + override — FINAL.** Admin sees all orders and can override any
   transition, cancel, or refund (override rules §4.3).
4. **Buyer cancel (PENDING, auto refund) + buyer confirm receipt (`buyerConfirmedAt`) — FINAL.**
5. **Earnings on DELIVERED into `merchantEarnings` (not the wallet), manual payout — FINAL.**
   (See `merchants.md`.)
6. **`orders:refund` Super-Admin-only, non-delegable — FINAL** (README set). The mechanical
   full refund inside `cancel` (and buyer cancel) is system-mediated and not gated by it (§4.5) —
   documented as the final rule, flagged to the owner for awareness rather than decision.
