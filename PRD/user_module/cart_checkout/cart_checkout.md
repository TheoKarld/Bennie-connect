# PRD 08a: Marketplace Cart, Checkout & Orders (User)

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded · ⚠️ drift / reconciliation flag
>
> **Overall module status: 📄** — the client-side cart/checkout in `src/store/appStore.ts`
> (`handleAddToCart` … `handleCheckoutMarketplace`) and the mock `ProductOrder` tracker are
> **superseded**: the cart becomes **server-side** and payment becomes a **real wallet debit**.
>
> Part 2 of the three-document marketplace set. Storefront + visibility rules:
> [`ecommerce-marketplace.md`](../ecommerce-marketplace/ecommerce-marketplace.md).
> Merchant fulfilment + earnings: [`merchant_panel.md`](../merchant_panel/merchant_panel.md).
> Admin plane (PLATFORM-order fulfilment, admin cancel/refund oversight):
> [`PRD/admin_module/marketplace/marketplace.md`](../../admin_module/marketplace/marketplace.md).
> Wallet primitives: [`digital-wallet-seerbit.md`](../wallet/digital-wallet-seerbit.md) —
> ✅ `WalletService.debitForPayment` / `creditRefund` exist in
> `backend/src/wallet/wallet.service.ts` (atomic, **idempotent by caller-supplied
> `reference`**). Notifications: [`PRD/notification.md`](../../notification.md).
> Canonical schemas: [`PRD/data_structure.md`](../../data_structure.md) §11 (wins on
> disagreement).

---

## 1. Overview

Buyers accumulate items in a **server-side cart** (one per user), then check out in a single
call that (locked flow):

1. re-validates every line against live visibility + stock,
2. **splits the cart into one order per seller** (linked by a shared `checkoutGroupId`),
3. **debits the grand total from the live wallet once** (idempotent), and
4. clears the cart and notifies sellers + admins.

The buyer sees the checkout group as **one purchase with N sub-orders**. Each sub-order is
fulfilled independently — `PENDING → PROCESSING → SHIPPED → DELIVERED` (+ `CANCELLED`) — by
its seller: **MERCHANT** orders from the Merchant Hub, **PLATFORM** orders from the admin
portal. The buyer may **cancel while `PENDING`** (automatic wallet refund) and **confirm
received** after `DELIVERED`.

**Conventions** are shared with the set (ecommerce-marketplace §1.1): base `/api/v1`,
`JwtAuthGuard` (`scope: "user"`), whole NGN, `{ success, data }` envelope, serialized `id`
strings, `MKT_`/`ORD_` error codes.

---

## 2. Collections / Schema

### 2.1 `carts` 📄

One live cart per user (upsert-on-first-write). Prices are **never stored** in the cart — the
cart read enriches lines with the product's **current** price; prices are only snapshotted
into orders at checkout.

```typescript
{
  _id: ObjectId;
  userId: ObjectId;                   // ref users — unique (one cart per user)
  items: [{
    _id: ObjectId;                    // the cart itemId used in PATCH/DELETE routes
    productId: ObjectId;              // ref products
    quantity: number;                 // int >= 1, <= CART_MAX_QTY_PER_ITEM
    addedAt: Date;
  }];
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** unique `{ userId: 1 }`; `{ 'items.productId': 1 }`.

Rules: max **`CART_MAX_ITEMS`** distinct lines (default 30); adding an existing product
increments its line (no duplicate lines per product); a successful checkout empties `items`.

### 2.2 `orders` 📄

**One document per seller per checkout.** The buyer-facing "purchase" is the set of orders
sharing a `checkoutGroupId`.

```typescript
{
  _id: ObjectId;
  orderNumber: string;                // unique, e.g. ORD<ts><rand>
  checkoutGroupId: string;            // shared across the split, e.g. CHK<ts><rand>
  buyerId: ObjectId;                  // ref users
  seller: {
    type: 'PLATFORM' | 'MERCHANT';
    merchantId?: ObjectId;            // ref merchants iff MERCHANT
  };
  items: [{                           // immutable snapshot taken at checkout
    productId: ObjectId;
    name: string;
    unit: string;
    price: number;                    // whole NGN unit price at purchase
    quantity: number;
    lineTotal: number;                // price * quantity
    image?: FileMetadata;             // first product image at purchase (embedded)
  }];
  totalAmount: number;                // whole NGN — sum of lineTotals (no delivery fee this phase)

  // ── Merchant settlement snapshot (MERCHANT orders only; merchant_panel §4.5) ──
  platformFeePercent?: number;        // snapshot of PLATFORM_FEE_PERCENT at checkout
  platformFee?: number;               // floor(totalAmount * platformFeePercent / 100)
  merchantNet?: number;               // totalAmount - platformFee
  earningsBooked: boolean;            // default false; true once the DELIVERED booking wrote the earnings row

  deliveryAddress: string;            // 10–300 chars, captured at checkout (same for the whole group)

  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'PAID' | 'REFUNDED'; // orders only exist after a successful debit
  walletPaymentRef: string;           // the group's single debit reference (MKTPAY<checkoutGroupId>)
  refundRef?: string;                 // this order's refund credit reference (MKTREF<orderId>)

  timeline: [{                        // append-only status trail (drives the stepper UI)
    status: string;                   // the status entered
    at: Date;
    by: 'buyer' | 'merchant' | 'admin' | 'system';
  }];

  deliveredAt?: Date;
  confirmedReceivedAt?: Date;         // buyer confirm-received (after DELIVERED)
  cancelledBy?: 'buyer' | 'admin';
  cancellationReason?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** unique `{ orderNumber: 1 }`; `{ checkoutGroupId: 1 }`;
`{ buyerId: 1, createdAt: -1 }`; `{ 'seller.merchantId': 1, status: 1 }` (merchant order
queue); `{ 'seller.type': 1, status: 1 }` (admin PLATFORM queue).

> ⚠️ **Supersedes** the legacy PRD-08 order shape (single multi-seller order,
> `paymentStatus: PENDING|PAID|REFUNDED|FAILED`, `shippingAddress` object, `trackingInfo`,
> platform fee charged to the buyer) and the mock `ProductOrder` (`src/types.ts:233`,
> lowercase statuses, `farmerId: "aliyu_coop"`). Buyers pay **product totals only**; the
> platform fee is deducted from the **merchant's** share, never added to the buyer's charge.

---

## 3. API Endpoints (user plane)

Base `/api/v1/marketplace`, `JwtAuthGuard` (`scope: "user"`).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/marketplace/cart` | The caller's cart, enriched + validated — §3.1 |
| `POST` | `/marketplace/cart/items` | Add a product (or increment its line) — §3.2 |
| `PATCH` | `/marketplace/cart/items/:itemId` | Set a line's quantity — §3.3 |
| `DELETE` | `/marketplace/cart/items/:itemId` | Remove a line |
| `DELETE` | `/marketplace/cart` | Empty the cart |
| `POST` | `/marketplace/checkout` | Split into orders + debit wallet — §3.4 |
| `GET` | `/marketplace/orders` | The caller's purchases, grouped by `checkoutGroupId` — §3.5 |
| `GET` | `/marketplace/orders/:id` | One order (timeline, items, refs) — §3.6 |
| `POST` | `/marketplace/orders/:id/cancel` | Cancel while `PENDING` → auto refund — §3.7 |
| `POST` | `/marketplace/orders/:id/confirm-received` | Buyer confirms after `DELIVERED` — §3.8 |

### 3.1 `GET /marketplace/cart`

Returns the cart with every line enriched from the **current** product state and a per-line
validity verdict, plus a per-seller preview of the split.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "itemId": "cit_1",
        "product": {
          "id": "prd_1", "name": "Hybrid Maize Seeds", "unit": "10kg Bag",
          "price": 18500, "image": { "url": "…" },
          "seller": { "type": "MERCHANT", "merchantId": "mch_1", "displayName": "Shola Organic Farms" },
          "stockAvailable": 45
        },
        "quantity": 2,
        "lineTotal": 37000,
        "valid": true,
        "issue": null
      },
      {
        "itemId": "cit_2",
        "product": { "id": "prd_9", "name": "NPK 15:15:15", "price": 32000, "stockAvailable": 0, "…": "…" },
        "quantity": 1,
        "lineTotal": 32000,
        "valid": false,
        "issue": "OUT_OF_STOCK"
      }
    ],
    "sellerGroups": [
      { "seller": { "type": "MERCHANT", "merchantId": "mch_1", "displayName": "Shola Organic Farms" }, "itemCount": 1, "subtotal": 37000 },
      { "seller": { "type": "PLATFORM", "displayName": "Bennie Cooperative Store" }, "itemCount": 1, "subtotal": 32000 }
    ],
    "grandTotal": 69000,
    "wallet": { "available": 150000, "sufficient": true },
    "checkoutBlocked": true,
    "blockedReason": "INVALID_ITEMS"
  }
}
```

- `issue ∈ { UNAVAILABLE, OUT_OF_STOCK, INSUFFICIENT_STOCK, OWN_LISTING }` — `UNAVAILABLE`
  covers any §4 visibility failure of the storefront doc (unapproved / inactive / suspended /
  deleted) without leaking which.
- `checkoutBlocked` is `true` while any line is invalid or the cart is empty; the UI must
  resolve invalid lines (remove / reduce qty) before checkout.
- `wallet` echoes the live wallet balance so the drawer can show the top-up prompt inline.

### 3.2 `POST /marketplace/cart/items`

**Request:** `{ "productId": "prd_1", "quantity": 2 }` (`quantity` optional, default 1).

- Product must pass the storefront **visibility rules** (`MKT_003`) and have
  `stock.available >= (existing line qty + quantity)` (`MKT_004`).
- The caller must not be the product's own merchant (`MKT_012`).
- Existing line → increment; else append (line cap `MKT_013`).

**Response 201:** the §3.1 cart payload (so the drawer refreshes in one call).

### 3.3 `PATCH /marketplace/cart/items/:itemId`

**Request:** `{ "quantity": 3 }` — sets the absolute quantity (1 … stock, `MKT_004`/`MKT_006`).
Setting `0` is rejected (`MKT_006`) — use `DELETE`. **Response 200:** the §3.1 payload.

### 3.4 `POST /marketplace/checkout` — split + debit (the money move)

**Request:**
```json
{ "deliveryAddress": "Kano State Maize Hub, Sector A3, Kano" }
```

**Response 201:**
```json
{
  "success": true,
  "message": "Payment successful. 2 orders placed.",
  "data": {
    "checkoutGroupId": "CHK1751540000AB12",
    "walletPaymentRef": "MKTPAYCHK1751540000AB12",
    "grandTotal": 69000,
    "wallet": { "available": 81000 },
    "orders": [
      {
        "id": "ord_1", "orderNumber": "ORD1751540000X1",
        "seller": { "type": "MERCHANT", "merchantId": "mch_1", "displayName": "Shola Organic Farms" },
        "totalAmount": 37000, "status": "PENDING", "paymentStatus": "PAID",
        "items": [ { "productId": "prd_1", "name": "Hybrid Maize Seeds", "quantity": 2, "price": 18500, "lineTotal": 37000 } ]
      },
      {
        "id": "ord_2", "orderNumber": "ORD1751540000X2",
        "seller": { "type": "PLATFORM", "displayName": "Bennie Cooperative Store" },
        "totalAmount": 32000, "status": "PENDING", "paymentStatus": "PAID",
        "items": [ { "productId": "prd_3", "name": "NPK 15:15:15", "quantity": 1, "price": 32000, "lineTotal": 32000 } ]
      }
    ]
  }
}
```

Full behaviour, idempotency, and rollback rules in **§4.1–§4.3**. Key error paths:
- empty cart → `MKT_007`; missing/short address → `MKT_008`;
- any line failing revalidation → `MKT_011` with per-item `details` (client refreshes the cart);
- insufficient wallet balance → `MKT_009` with `{ required, available }` (wraps `WALLET_001`)
  — the UI prompts a wallet top-up (PRD 02 deposit) and offers retry.

### 3.5 `GET /marketplace/orders`

The caller's purchases, **grouped by `checkoutGroupId`**, newest group first.

**Query:** `page` (default 1), `limit` (groups per page, default 10, max 50),
`status` (optional — filters to groups containing an order in that status).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "checkoutGroupId": "CHK1751540000AB12",
        "placedAt": "2026-07-03T09:00:00Z",
        "grandTotal": 69000,
        "deliveryAddress": "Kano State Maize Hub, Sector A3, Kano",
        "orders": [
          { "id": "ord_1", "orderNumber": "ORD1751540000X1", "seller": { "type": "MERCHANT", "displayName": "Shola Organic Farms" }, "status": "SHIPPED", "totalAmount": 37000, "itemCount": 1 },
          { "id": "ord_2", "orderNumber": "ORD1751540000X2", "seller": { "type": "PLATFORM", "displayName": "Bennie Cooperative Store" }, "status": "PENDING", "totalAmount": 32000, "itemCount": 1 }
        ]
      }
    ],
    "total": 6,
    "page": 1,
    "limit": 10
  }
}
```

### 3.6 `GET /marketplace/orders/:id`

Full order: item snapshots, `timeline`, payment/refund refs, seller card, and the sibling
orders of the same group (light summaries) so the detail page can cross-link. Ownership
enforced — non-owner → `ORD_001` (404, no leakage). Merchants read their **received** orders
via `GET /merchant/orders` (merchant_panel §3), never this route.

### 3.7 `POST /marketplace/orders/:id/cancel`

**Request:** `{ "reason": "Ordered by mistake" }` (reason optional, ≤ 300 chars).

Allowed only while `status === 'PENDING'` (`ORD_003` otherwise). Effects (atomic, §4.4):
`status → CANCELLED` (`cancelledBy: 'buyer'`), **wallet refund of this order's
`totalAmount`** via `creditRefund` (reference `MKTREF<orderId>` → `refundRef`,
`paymentStatus → REFUNDED`), stock restored per item, timeline appended, notifications fired
(§5).

**Response 200:** `{ "id": "ord_2", "status": "CANCELLED", "paymentStatus": "REFUNDED", "refundRef": "MKTREFord_2", "refunded": 32000, "wallet": { "available": 113000 } }`

### 3.8 `POST /marketplace/orders/:id/confirm-received`

Allowed only when `status === 'DELIVERED'` (`ORD_004`). Sets `confirmedReceivedAt`, appends
the timeline entry, notifies the seller (§5). Idempotent — a repeat call returns the same
result (`200`) without a second notification. Confirm-received is the buyer's acknowledgment
that closes the purchase; **earnings are booked at `DELIVERED`, not here**
(owner-locked; merchant_panel §4.5).

---

## 4. Business logic

### 4.1 Checkout algorithm (locked)

```
POST /checkout
 1. Load cart; empty → MKT_007. Validate deliveryAddress (10–300 chars) → MKT_008.
 2. Load all cart products. Re-validate EVERY line: visibility (storefront §4),
    not own listing, stock.available >= quantity. Any failure → MKT_011
    { details: [{ productId, issue }] } — nothing mutated.
 3. Group lines by seller identity: PLATFORM as one group; each merchantId its own group.
    Compute per-group subtotal and grandTotal (whole NGN). For MERCHANT groups snapshot
    platformFeePercent / platformFee = floor(subtotal*pct/100) / merchantNet.
 4. Generate checkoutGroupId = CHK<ts><rand>; paymentRef = "MKTPAY" + checkoutGroupId.
 5. STOCK: for each line, conditional decrement
       products.updateOne({ _id, 'stock.available': { $gte: qty } }, { $inc: { 'stock.available': -qty } })
    If any conditional update misses → restore all already-decremented lines and abort
    with MKT_011 (stock lost mid-checkout). No wallet call has happened yet.
 6. DEBIT: walletService.debitForPayment(buyerId, { amount: grandTotal,
       reference: paymentRef, category: 'PAYMENT',
       description: "Marketplace checkout <checkoutGroupId>" }).
    WALLET_001 → restore stock, return MKT_009 { required, available }.
    Other wallet failure → restore stock, MKT_010.
 7. CREATE one order per seller group (status PENDING, paymentStatus PAID,
    walletPaymentRef = paymentRef, timeline [{ status: 'PENDING', by: 'system' }]),
    clear the cart — in one Mongo session/transaction.
    If this step fails after a successful debit (rare): compensate with
    creditRefund(buyerId, { amount: grandTotal, reference: "MKTRB" + checkoutGroupId }),
    restore stock, surface MKT_010. Money is never left debited without orders.
 8. NOTIFY (§5, best-effort, never blocks): each MERCHANT seller, admins, buyer receipt.
 9. Return the checkout group (§3.4).
```

**Idempotency.** The single group debit reference `MKTPAY<checkoutGroupId>` rides
`debitForPayment`'s reference-idempotency (✅ implemented — a repeat with an existing
reference returns `alreadyProcessed: true` and does not re-debit). A client retry of the same
logical checkout creates a **new** group (new reference) against the by-then-empty cart →
`MKT_007`, so double-submission cannot double-charge. The compensating rollback credit
(`MKTRB…`) and every cancel refund (`MKTREF<orderId>`) are equally reference-idempotent via
`creditRefund`.

**Fees.** The buyer is debited **product totals only**. `platformFee` is a merchant-side
deduction snapshot used when booking earnings at `DELIVERED` (merchant_panel §4.5); PLATFORM
orders carry no fee fields.

### 4.2 Stock model (locked this phase)

- Checkout **decrements `stock.available` immediately** (step 5) — there is no time-boxed
  reservation; `stock.reserved` stays `0` this phase (schema field kept for a future hold
  flow).
- Cancellation (buyer `PENDING` cancel, or admin cancel on the admin plane) **restores**
  each item's quantity to `stock.available`.
- The conditional `$gte` update is the oversell guard under concurrency; add-to-cart's stock
  check is advisory UX only — checkout is authoritative.

### 4.3 Order state machine (locked)

```
            merchant/admin          merchant/admin        merchant/admin
 PENDING ──────────────► PROCESSING ─────────► SHIPPED ─────────► DELIVERED ──buyer──► (confirmedReceivedAt set)
    │                                                                  │
    │ buyer cancel (auto refund)                                        └── earnings booked (MERCHANT orders,
    ▼                                                                       once, at the DELIVERED transition)
 CANCELLED  ◄── admin cancel (any state before DELIVERED; refund if not yet refunded — admin plane)
```

- **Forward-only fulfilment** — `PENDING → PROCESSING → SHIPPED → DELIVERED`, no skipping and
  no reversing (`ORD_002` / merchant plane `MERCH_010`).
- **Who advances:** `seller.type === 'MERCHANT'` → the owning merchant via
  `PATCH /merchant/orders/:id/fulfillment` (merchant_panel §3.6);
  `seller.type === 'PLATFORM'` → admins via the admin plane. Buyers never advance fulfilment.
- **Buyer cancel:** only from `PENDING` (§3.7). Once the seller starts processing, the buyer
  requests admin intervention (admin-plane cancel) — no self-serve cancel.
- **Merchant cancel:** **not allowed this phase** — a merchant who cannot fulfil contacts the
  cooperative; an admin cancels with refund on the admin plane (open question §10.1).
- `DELIVERED` sets `deliveredAt` and (for MERCHANT orders) **books earnings exactly once**,
  guarded by `earningsBooked` (idempotent under retried transitions).
- `CANCELLED` and confirmed-`DELIVERED` are terminal.

### 4.4 Refund rules

| Trigger | Amount | Reference | Path |
|---------|--------|-----------|------|
| Buyer cancels `PENDING` order | that order's `totalAmount` | `MKTREF<orderId>` | `creditRefund` (auto, in the cancel call) |
| Admin cancels an unfulfilled order | that order's `totalAmount` | `MKTREF<orderId>` | admin plane — same idempotent path |
| Checkout compensation (orders failed after debit) | `grandTotal` | `MKTRB<checkoutGroupId>` | §4.1 step 7 |

All refunds are wallet `CREDIT / REFUND` transactions, idempotent by reference; a repeat
cancel/compensation call can never double-credit. Cancelling one sub-order **never** touches
its siblings — each order refunds only its own `totalAmount`.

---

## 5. Notifications (trigger matrix — locked)

Every row goes through the single `NotificationService` (persist + socket bell + FCM push,
best-effort, never blocks the money path) with a deep `link`. Buyer links →
`/app/marketplace/orders/<id>`; merchant links → `/app/merchant?tab=orders` (or the order
drawer); admin links → the admin marketplace section.

| Event | `event` key | `type` | Recipients |
|-------|-------------|--------|------------|
| Checkout placed (per MERCHANT order) | `marketplace.order.placed` | `info` | that merchant **+ admins** (`notifyAdmins`) |
| Checkout placed (PLATFORM order) | `marketplace.order.placed` | `info` | admins |
| Checkout receipt (whole group) | `marketplace.checkout.success` | `success` | buyer |
| Status advanced (PROCESSING / SHIPPED / DELIVERED) | `marketplace.order.status` | `info` (`success` on DELIVERED) | buyer |
| Buyer cancelled | `marketplace.order.cancelled` | `warning` | seller (merchant or admins) |
| Order cancelled (admin-initiated) | `marketplace.order.cancelled` | `warning` | buyer (+ merchant if MERCHANT order) |
| Refund credited | `marketplace.order.refunded` | `success` | buyer |
| Buyer confirmed received | `marketplace.order.confirmed_received` | `success` | seller (merchant or admins) |

(The merchant KYC / moderation / payout rows live in merchant_panel §5 — one combined
matrix per doc, shared `marketplace.*` / `merchant.*` key families.)

> ⚠️ `notification.md`'s planned `order.status` key for PRD 08 is superseded by the
> `marketplace.order.*` family above — flagged for that doc's owner.

---

## 6. Frontend — cart, checkout & orders (user-dev)

### 6.1 Cart drawer

Right-hand slide-over (mirrors the mock's sheet, tokenized per storefront §5.5), openable
from any marketplace route via the header cart button:

- Lines: thumbnail, name, unit price `/unit`, quantity stepper (server `PATCH` per change,
  optimistic with rollback), line total, remove. **Invalid lines** (§3.1 `issue`) render with
  a warning border + explanatory chip ("Out of stock — remove or reduce") and a one-tap fix.
- **Per-seller subtotal strip** — the drawer groups lines under seller badges with subtotals,
  previewing the split ("This purchase will create 2 orders").
- Footer: grand total, live wallet balance line (`sufficient` → primary; insufficient → rose
  with an inline **"Top up wallet"** link to `/app/wallet`), and **"Proceed to checkout"**
  (disabled while `checkoutBlocked`, with the reason).

### 6.2 Checkout page — `/app/marketplace/checkout`

- **Delivery address** — single required textarea (10–300 chars), prefilled from the last
  order's address; one address per checkout group (locked).
- **Order preview** — one card **per seller group** (this is where the buyer first sees the
  split explicitly): seller badge, its lines, subtotal; then a summary card — grand total,
  wallet available, balance-after figure.
- **Insufficient balance state** — summary flips to a rose panel: shortfall figure +
  "Top up ₦X to complete" CTA → wallet deposit (PRD 02); returning resumes checkout.
- **Place order** — single primary CTA; in-flight lock (spinner + disabled, no double
  submit); on success route to a **confirmation screen** (group summary, N order cards,
  "Track orders" CTA); on `MKT_011` show which items changed and link back to the cart.

### 6.3 My orders — `/app/marketplace/orders`

Grouped list (one card per checkout group): placed date, grand total, address, and a row per
sub-order (seller badge, `orderNumber`, status chip, amount) → order detail. Status chips:
PENDING amber, PROCESSING sky, SHIPPED indigo, DELIVERED emerald, CANCELLED rose (all with
`dark:` token variants). Filter chips ("All / In progress / Delivered / Cancelled") and
load-more pagination.

### 6.4 Order detail — `/app/marketplace/orders/:id`

- **Fulfilment stepper timeline** — the mock's 4-step progress bar, rebuilt from the server
  `timeline`: Pending → Processing → Shipped → Delivered, with real timestamps under
  completed steps; CANCELLED renders a distinct terminal banner (with reason + refund line)
  instead of the stepper.
- Item snapshot list (name, qty × ₦price, line totals), delivery address, payment block
  (`walletPaymentRef`, and `refundRef` + refunded amount when refunded), seller card, and
  links to sibling orders in the group.
- **Actions:** `PENDING` → "Cancel order" (confirm dialog stating the auto-refund, then
  §3.7); `DELIVERED` and unconfirmed → prominent **"Confirm received"** CTA (§3.8);
  confirmed → "Received on {date}" chip.
- Live updates: on a `marketplace.order.*` socket notification for an open order, refetch
  and animate the stepper.

### 6.5 States

Skeletons for drawer lines / group cards / detail stepper; empty states ("Your basket is
empty" with a browse CTA; "No orders yet"); error panels with retry — same standards as
storefront §5.6. All checkout money figures `font-mono`; every state must pass in light and
dark via theme tokens only.

---

## 7. Validation & error codes

**Validation:**
- `quantity` integer 1–`CART_MAX_QTY_PER_ITEM` (default 999); distinct lines ≤
  `CART_MAX_ITEMS` (default 30).
- `deliveryAddress` 10–300 chars after trim.
- `reason` ≤ 300 chars. All `:itemId`/`:id` valid ObjectId; unknown → `*_NOT_FOUND`.
- Server recomputes every price/total from `products` — client-sent amounts are never
  trusted (there are none in the API surface).

**Error envelope:** `{ "success": false, "error": { "code": "MKT_009", "message": "Insufficient wallet balance", "details": { "required": 69000, "available": 41000 } } }`

`MKT_` (shared namespace with the storefront doc — `MKT_001`/`MKT_002` defined there):

| Code | HTTP | Meaning |
|------|------|---------|
| `MKT_003` | 409 | Product not available for purchase (fails visibility rules) |
| `MKT_004` | 409 | Insufficient stock for the requested quantity (`details: { available }`) |
| `MKT_005` | 404 | Cart item not found (or not in the caller's cart) |
| `MKT_006` | 422 | Invalid quantity (non-integer, < 1, or over the per-line cap) |
| `MKT_007` | 409 | Cart is empty — nothing to check out |
| `MKT_008` | 422 | Delivery address missing/invalid |
| `MKT_009` | 400 | Insufficient wallet balance (wraps `WALLET_001`; `details: { required, available }`) |
| `MKT_010` | 502 | Wallet debit/refund failed (non-balance wallet error; stock restored) |
| `MKT_011` | 409 | Checkout conflict — one or more lines failed revalidation or lost stock (`details.items[]`) |
| `MKT_012` | 403 | Cannot purchase your own listing |
| `MKT_013` | 409 | Cart line limit reached (`CART_MAX_ITEMS`) |

`ORD_`:

| Code | HTTP | Meaning |
|------|------|---------|
| `ORD_001` | 404 | Order not found (or not owned by the caller — no cross-owner leakage) |
| `ORD_002` | 409 | Invalid fulfilment status transition |
| `ORD_003` | 409 | Cancel allowed only while `PENDING` |
| `ORD_004` | 409 | Confirm-received allowed only when `DELIVERED` |
| `ORD_005` | 502 | Refund failed (wraps wallet error; order state unchanged, retry-safe) |
| `ORD_006` | 403 | Not authorized to act on this order |
| `ORD_007` | 409 | Order already in a terminal state |

---

## 8. Acceptance criteria

1. The cart is fully server-side: add / set-qty / remove / clear persist across devices and
   sessions; no marketplace state remains in `localStorage`.
2. A checkout with items from k distinct sellers produces exactly **k orders** sharing one
   `checkoutGroupId`, **one** wallet DEBIT/PAYMENT transaction of the grand total
   (reference `MKTPAY<checkoutGroupId>`), and an emptied cart — atomically.
3. Replaying the debit reference never double-charges (verified via
   `debitForPayment.alreadyProcessed`); two concurrent checkouts of the last unit of stock
   result in exactly one success and one `MKT_011`, with stock never negative.
4. Insufficient balance aborts with `MKT_009` (correct `required`/`available`), restores any
   decremented stock, creates no orders, and the UI shows the top-up prompt.
5. A failure after debit compensates with the `MKTRB…` refund — an injected order-creation
   fault leaves the wallet balance unchanged net and stock restored.
6. Buyer cancel works from `PENDING` only, credits exactly the sub-order's `totalAmount`
   (idempotent `MKTREF<orderId>`), restores stock, and never affects sibling orders; cancel
   from any other state → `ORD_003`.
7. Fulfilment transitions are forward-only and role-guarded (buyer cannot advance; merchant
   only own MERCHANT orders; PLATFORM orders only via the admin plane); every transition
   appends a `timeline` entry and notifies the buyer per §5.
8. Confirm-received only after `DELIVERED`, idempotent, notifies the seller; earnings for
   MERCHANT orders are booked exactly once at `DELIVERED` (guarded by `earningsBooked`).
9. `GET /marketplace/orders` groups correctly by `checkoutGroupId` and paginates by group;
   order detail renders the stepper from `timeline` with real timestamps.
10. All §5 notifications are persisted + emitted with working deep links; a notification
    failure never fails the checkout/cancel/transition call.

---

## 9. Environment variables

```bash
# Checkout / orders (backend)
MARKETPLACE_ORDER_PREFIX=ORD             # orderNumber prefix
MARKETPLACE_CHECKOUT_PREFIX=CHK          # checkoutGroupId prefix
PLATFORM_FEE_PERCENT=5                   # merchant-side fee % snapshotted per order (0–100)
CART_MAX_ITEMS=30                        # max distinct cart lines
CART_MAX_QTY_PER_ITEM=999                # max quantity per line
```

> The legacy PRD-08 vars `ORDER_NUMBER_PREFIX`, `LOW_STOCK_THRESHOLD`, and
> `MAX_ORDER_DAYS_ADVANCE` are **retired** (renamed / moved to the storefront doc / not
> applicable — there is no advance-order window).

---

## 10. Open questions for the owner

1. **Merchant-initiated cancel.** Locked default: merchants cannot cancel; admins cancel with
   refund on their behalf. Confirm, or allow merchant cancel of `PENDING` orders (auto
   refund, buyer notified)?
2. **Stale-PENDING auto-cancel.** Should orders stuck in `PENDING` beyond N days auto-cancel
   with refund (system job), or remain until buyer/admin acts? No auto-cancel is specified
   this phase.
3. **Confirm-received escalation.** No dispute flow exists after `DELIVERED` — a buyer who
   did not receive goods contacts support. Is a `DISPUTED` state (mirroring Adashe payouts)
   wanted later?
4. **Address book.** One free-text address per checkout this phase. Add saved addresses /
   structured (state, LGA) fields later?

---

## 11. Relevant files

- `PRD/user_module/cart_checkout/cart_checkout.md` (this file)
- `PRD/user_module/ecommerce-marketplace/ecommerce-marketplace.md` (storefront + visibility + shared conventions)
- `PRD/user_module/merchant_panel/merchant_panel.md` (merchant fulfilment + earnings booking)
- `PRD/admin_module/marketplace/marketplace.md` (admin cancel/refund, PLATFORM fulfilment)
- `PRD/data_structure.md` §11 (canonical schemas) · `PRD/notification.md` · `PRD/user_module/wallet/digital-wallet-seerbit.md`
- `backend/src/wallet/wallet.service.ts` (✅ `debitForPayment` / `creditRefund` — the money primitives)
- `src/store/appStore.ts` marketplace handlers + `src/types.ts` `CartItem`/`ProductOrder` (mock being removed)
