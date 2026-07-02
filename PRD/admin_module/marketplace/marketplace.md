# Admin PRD: E-commerce Marketplace Operations

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no admin marketplace code exists yet)
>
> This document is a **live blueprint** for `admin-dev`. It governs admin operations over the
> `Product`, `Order`, and seller surfaces of the E-commerce Marketplace (user-side spec:
> [`PRD/user_module/ecommerce-marketplace/ecommerce-marketplace.md`](../../user_module/ecommerce-marketplace/ecommerce-marketplace.md)).

---

## 1. Overview

The admin marketplace surface lets operations staff govern the produce/inputs e-commerce
marketplace end-to-end: moderating seller **product listings** (approve/reject), managing the
**order lifecycle** (fulfilment overrides, cancellations, refunds), overseeing **sellers**
(suspension), configuring **categories, certifications, and low-stock thresholds**, and setting
the **platform-fee** that applies to every order.

**Conventions (shared across all admin PRDs — see `PRD/admin_module/README.md` for the authoritative RBAC taxonomy):**

- Backend routes are under **`/api/v1/admin/*`**; the admin frontend lives under **`/bennie/*`**.
- Admin identity is a separate **`adminUsers`** collection (sign-in only; no self-registration).
  Authorization = **`adminRoles`** (granular `resource:action` permissions) + optional per-admin
  permission overrides. **Super Admin** holds the `*` wildcard.
- **Every endpoint below declares its required permission.** Enforcement is by a global
  `PermissionsGuard` layered on the admin JWT auth guard.
- **Every mutation writes an `adminAuditLog` entry** (`actor`, `action`, `target`, `before/after`,
  `timestamp`, `ip`, `userAgent`). Read-only endpoints do not audit unless flagged.
- Money is whole **NGN**; no minor units. Dates are native `Date` (`createdAt`/`updatedAt` auto).
- **Financial-reversal actions (refunds) require the `orders:refund` permission, which is
  Super-Admin-only and NOT delegable** per the
  [README Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable).
  A sub-admin role cannot be granted `orders:refund`.

---

## 2. Collections / Schema

This module **reads and mutates the user-side `Product` and `Order` collections** (defined in the
user PRD; not redefined here). It **adds** the admin-owned collections below.

### 2.1 `productCategory` 📄 (admin-owned)

Category + subcategory taxonomy referenced by `Product.category.primary` / `.subcategories`.

```typescript
{
  _id: ObjectId;
  name: string;                 // e.g. "Seeds", "Fertilizers", "Farm Produce"
  slug: string;                 // unique, lowercased
  parentId?: ObjectId;          // ref productCategory (null = top-level)
  description?: string;
  icon?: string;
  isActive: boolean;            // inactive hides from buyer browse + blocks new listings
  sortOrder: number;
  createdBy: ObjectId;          // ref adminUsers
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 `certificationType` 📄 (admin-owned)

Whitelist of certifications a `Product.certifications[]` may claim (e.g. `ORGANIC`, `GAP`).

```typescript
{
  _id: ObjectId;
  code: string;                 // unique, uppercase, e.g. "ORGANIC"
  name: string;                 // "Certified Organic"
  description?: string;
  requiresDocument: boolean;    // if true, listing must attach proof before approval
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.3 `productModeration` 📄 (admin-owned)

One record per moderation decision on a listing (append-only history).

```typescript
{
  _id: ObjectId;
  productId: ObjectId;          // ref Product
  sellerId: ObjectId;           // ref User (denormalised for filtering)
  decision: 'APPROVED' | 'REJECTED' | 'PENDING' | 'CHANGES_REQUESTED';
  reason?: string;              // required when REJECTED / CHANGES_REQUESTED
  reviewedBy: ObjectId;         // ref adminUsers
  reviewedAt: Date;
  createdAt: Date;
}
```

### 2.4 Product schema additions (adopted design)

To support an approval queue, the user-side `Product` carries a **moderation status** distinct from
its sell-state `status` (`ACTIVE|INACTIVE|OUT_OF_STOCK`). **Owner-approved adopted design** (see
[README](../README.md#adopted-domain-schema-extensions-finalized) and
[`data_structure.md`](../../data_structure.md) §7) — `user-dev` adds these additive fields to
`Product`:

```typescript
{
  // ...existing Product fields...
  moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'; // default 'PENDING'
  moderatedAt?: Date;
  moderatedBy?: ObjectId;       // ref adminUsers
  suspended?: boolean;          // set true when the seller is suspended (delisted from browse)
}
```

Buyers only ever see products where `moderationStatus === 'APPROVED'` **and** `status === 'ACTIVE'`
**and** `suspended !== true`.

### 2.5 `marketplaceSettings` (config surface — SSOT is the global `settings` collection)

Platform-fee and inventory config surface. **SSOT (finalized):** the **global `settings` collection**
owns these values (the `platformFees` group owns `platformFeePercent`/cap; marketplace-specific
inventory/moderation toggles live in a marketplace group of `settings`). This section **reads** them
from `settings` and does not maintain a competing source of truth. See
[`settings.md`](../settings/settings.md). Fields:

```typescript
{
  platformFeePercent: number;       // % applied to order subtotal, e.g. 5
  platformFeeCapNgn?: number;       // optional max fee per order
  defaultLowStockThreshold: number; // fallback when Product.inventory.lowStockThreshold unset
  autoApproveListings: boolean;     // if true, new listings skip the moderation queue
  maxOrderDaysAdvance: number;      // pre-order window (mirrors MAX_ORDER_DAYS_ADVANCE)
  refundWindowDays: number;         // max age of a PAID order still eligible for admin refund
}
```

---

## 3. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission. `4xx` bodies use
the standard error envelope ([§7](#7-error-codes)).

### 3.1 Product listing management (`marketplace:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/marketplace/products` | `marketplace:view` | List/search products (filters below) |
| GET | `/marketplace/products/:id` | `marketplace:view` | Product detail + moderation history + seller summary |
| POST | `/marketplace/products` | `marketplace:create` | Admin-create a listing (e.g. co-op catalogue seeding) |
| PATCH | `/marketplace/products/:id` | `marketplace:update` | Edit listing fields (name, pricing, category, certifications) |
| DELETE | `/marketplace/products/:id` | `marketplace:delete` | Soft-delete a listing (sets `status=INACTIVE`, hidden) |
| POST | `/marketplace/products/:id/approve` | `marketplace:approve` | Approve a pending listing |
| POST | `/marketplace/products/:id/reject` | `marketplace:reject` | Reject a listing (reason required) |
| GET | `/marketplace/moderation-queue` | `marketplace:view` | Products with `moderationStatus=PENDING` |

**GET `/marketplace/products` query params:** `page`, `limit`, `q` (name/slug search),
`moderationStatus`, `status`, `sellerId`, `category`, `certification`, `lowStock` (bool),
`sortBy` (`createdAt|totalSales|price`), `order`.

**POST `/marketplace/products/:id/reject` — request:**
```json
{ "reason": "Images do not match declared certification", "requestChanges": false }
```
`requestChanges: true` sets `moderationStatus=CHANGES_REQUESTED` (seller may resubmit) instead of a
terminal `REJECTED`. **Response 200:**
```json
{ "success": true, "data": { "id": "prod_123", "moderationStatus": "REJECTED", "moderatedAt": "2026-07-01T10:00:00Z" } }
```

### 3.2 Order management (`orders:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/marketplace/orders` | `orders:view` | List/search all orders |
| GET | `/marketplace/orders/:id` | `orders:view` | Order detail (items, buyer, seller, timeline) |
| PATCH | `/marketplace/orders/:id/fulfillment` | `orders:update` | Override `fulfillmentStatus` |
| POST | `/marketplace/orders/:id/cancel` | `orders:update` | Admin-cancel an order (reason required) |
| POST | `/marketplace/orders/:id/refund` | `orders:refund` | Refund a PAID order to buyer wallet (**Super-Admin-only, non-delegable**) |

**GET `/marketplace/orders` query params:** `page`, `limit`, `orderNumber`, `buyerId`, `sellerId`,
`paymentStatus`, `fulfillmentStatus`, `startDate`, `endDate`, `minTotal`, `maxTotal`.

**PATCH `/marketplace/orders/:id/fulfillment` — request:**
```json
{ "fulfillmentStatus": "SHIPPED", "note": "Manually advanced after carrier confirmation",
  "trackingInfo": { "carrier": "GIG", "trackingNumber": "GIG-88213" } }
```
Server validates the transition against the state machine ([§4.2](#42-order-fulfilment-state-machine)).

**POST `/marketplace/orders/:id/refund` — request:**
```json
{ "amount": 12500, "reason": "Produce arrived spoiled", "restock": true }
```
- `amount` optional; omitted = full `pricing.total` refund. Partial refunds must be `<=` remaining
  refundable amount.
- On success: creates a wallet `REFUND` transaction to the buyer (via the user wallet service),
  sets `Order.paymentStatus=REFUNDED`, and if `restock:true` returns reserved/sold quantity to
  `Product.inventory.available`. Fully specified in [§4.3](#43-refund-rules).

### 3.3 Seller oversight (`marketplace:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/marketplace/sellers` | `marketplace:view` | Sellers with listing/order/GMV aggregates |
| GET | `/marketplace/sellers/:userId` | `marketplace:view` | Seller detail + listings + order history |
| POST | `/marketplace/sellers/:userId/suspend` | `marketplace:suspend` | Suspend a seller (delist all their products) |
| POST | `/marketplace/sellers/:userId/reinstate` | `marketplace:suspend` | Lift suspension |

Suspension delists all of a seller's products (`suspended=true`) but does **not** cancel their
in-flight orders — those continue through fulfilment/refund. **Reinstating** clears `suspended` but
does **not** auto-re-approve moderation; previously `APPROVED` listings return to browse.

### 3.4 Categories & certifications (`marketplace:configure`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/marketplace/categories` | `marketplace:view` | Category tree |
| POST | `/marketplace/categories` | `marketplace:configure` | Create category/subcategory |
| PATCH | `/marketplace/categories/:id` | `marketplace:configure` | Edit / toggle active / reorder |
| DELETE | `/marketplace/categories/:id` | `marketplace:configure` | Delete (blocked if products reference it) |
| GET | `/marketplace/certifications` | `marketplace:view` | List certification types |
| POST | `/marketplace/certifications` | `marketplace:configure` | Create certification type |
| PATCH | `/marketplace/certifications/:id` | `marketplace:configure` | Edit / toggle active |

### 3.5 Inventory & fee config (`marketplace:configure`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/marketplace/settings` | `marketplace:view` | Read platform-fee + inventory config |
| PATCH | `/marketplace/settings` | `marketplace:configure` | Update platform fee %, cap, low-stock default, auto-approve, refund window |
| GET | `/marketplace/inventory/low-stock` | `marketplace:view` | Products at/below their low-stock threshold |
| PATCH | `/marketplace/products/:id/inventory` | `marketplace:update` | Adjust `available` / `lowStockThreshold` |

> The platform-fee is the **canonical source** for `Order.pricing.platformFee` at checkout. Changing
> it affects **future** orders only; historical orders keep their captured fee. Because this is a
> financial setting, `PATCH /marketplace/settings` writes an audit entry and may also be surfaced in
> the global [`settings.md`](../settings/settings.md) config.

---

## 4. Business rules & state machines

### 4.1 Listing moderation lifecycle

```
                 (seller submits / admin creates)
                            │
                            ▼
                        PENDING ──approve──► APPROVED ──(seller/admin edit material fields)──► PENDING
                            │                    │
                    reject  │            delete/ │
                requestChgs │           suspend  │
                            ▼                    ▼
        REJECTED ◄──► CHANGES_REQUESTED     INACTIVE (soft-deleted) / suspended
              (seller resubmits → PENDING)
```

- If `marketplaceSettings.autoApproveListings === true`, new listings enter directly at `APPROVED`
  (still auditable via `productModeration` with `reviewedBy = SYSTEM`).
- Editing **material** fields of an `APPROVED` listing (name, category, price, certifications,
  images) returns it to `PENDING` unless the acting admin holds `marketplace:approve` (their edit is
  treated as pre-approved). Non-material edits (description) do not re-trigger moderation.
- A listing with a certification whose `certificationType.requiresDocument === true` **cannot be
  approved** until a proof document is attached.

### 4.2 Order fulfilment state machine

Mirrors the user PRD `fulfillmentStatus`. Admin overrides must respect it:

```
PENDING ──► PROCESSING ──► SHIPPED ──► DELIVERED
   │             │            │
   └─────────────┴────────────┴──► CANCELLED   (only before DELIVERED)
```

- Forward transitions only; no skipping backwards. `DELIVERED` and `CANCELLED` are terminal.
- Admin **cannot** move an order to `PROCESSING`/`SHIPPED` unless `paymentStatus === 'PAID'`.
- `cancel` is allowed from `PENDING`/`PROCESSING`/`SHIPPED` (records `cancelledBy` = admin id,
  `cancellationReason`); it releases reserved inventory (see §4.4) and, if the order was `PAID`,
  **requires** a companion refund (auto-triggered or explicit, per settings).

### 4.3 Refund rules

- Only orders with `paymentStatus === 'PAID'` are refundable, and only within
  `marketplaceSettings.refundWindowDays` of `paymentData.paidAt` (admin with `orders:refund` may
  override the window; the override is audited).
- Full refund: `amount == pricing.total` → `paymentStatus = REFUNDED`.
- Partial refund: `amount < total` → `paymentStatus = PARTIALLY_REFUNDED` (**adopted design** — the
  `Order.paymentStatus` enum gains `PARTIALLY_REFUNDED`; see
  [README](../README.md#adopted-domain-schema-extensions-finalized) and
  [`data_structure.md`](../../data_structure.md) §7). Cumulative refunds may not exceed `total`; when
  cumulative refunds reach `total` the status becomes `REFUNDED`.
- Refund credits the **buyer's wallet** as a `REFUND` `Transaction` (reuses the user wallet service —
  admin code does not write balances directly). Idempotency key = `refund:{orderId}:{amount}` to
  prevent double refunds.
- `restock: true` returns the refunded quantity to `Product.inventory.available`.
- **RBAC:** `orders:refund` is **Super-Admin-only and non-delegable** (financial reversal — see
  [README](../README.md#super-admin-only-permission-set-finalized--not-delegable)).

### 4.4 Inventory reservation rules

- On order placement (user side), quantity moves `inventory.available → inventory.reserved`.
- On `fulfillmentStatus = DELIVERED`, reserved quantity is **consumed** (decremented from `reserved`,
  `Product.totalSales` incremented).
- On `CANCELLED` (or refund with `restock`), reserved/consumed quantity returns to `available`.
- When `available <= lowStockThreshold` (or the settings default), the product surfaces in
  `GET /marketplace/inventory/low-stock` and raises a low-stock monitoring alert.
- When `available == 0`, the user-side `status` becomes `OUT_OF_STOCK` (product hidden from browse).

---

## 5. Validation

- `platformFeePercent`: number `0–100`, max 2 decimals. `platformFeeCapNgn`: integer `>= 0`.
- `reject`/`cancel`/`refund` **require** a non-empty `reason` (`>= 5` chars).
- `refund.amount`: integer NGN `> 0`, `<=` remaining refundable amount.
- Category `slug` unique; deletion blocked while any `Product` references it (returns `MKT_ADM_010`).
- Certification `code` unique, uppercase `[A-Z0-9_]+`.
- Fulfilment transitions validated against [§4.2](#42-order-fulfilment-state-machine); invalid →
  `MKT_ADM_004`.
- All `:id` params validated as Mongo ObjectId; missing target → `404` with the relevant `*_NOT_FOUND`.

---

## 6. Audit events

Every mutation writes an `adminAuditLog` entry `{ actor, action, targetType, targetId, before, after,
reason?, timestamp, ip, userAgent }`. Actions emitted by this module:

| Action | Trigger | Target |
|--------|---------|--------|
| `marketplace.product.create` | POST product | Product |
| `marketplace.product.update` | PATCH product / inventory | Product |
| `marketplace.product.delete` | DELETE product | Product |
| `marketplace.product.approve` | approve | Product |
| `marketplace.product.reject` | reject | Product |
| `marketplace.order.fulfillment_update` | PATCH fulfillment | Order |
| `marketplace.order.cancel` | cancel | Order |
| `marketplace.order.refund` | refund (**high-severity**) | Order + Wallet txn ref |
| `marketplace.seller.suspend` / `.reinstate` | seller suspend/reinstate | User |
| `marketplace.category.*` / `certification.*` | category/cert CRUD | productCategory / certificationType |
| `marketplace.settings.update` | settings PATCH (**high-severity**) | marketplaceSettings |

`refund` and `settings.update` are flagged high-severity for the audit/compliance dashboard.

---

## 7. Error codes

Standard envelope:
```json
{ "success": false, "error": { "code": "MKT_ADM_004", "message": "Invalid fulfilment transition", "details": { "from": "DELIVERED", "to": "SHIPPED" } } }
```

| Code | Meaning |
|------|---------|
| `MKT_ADM_001` | Product not found |
| `MKT_ADM_002` | Order not found |
| `MKT_ADM_003` | Seller not found |
| `MKT_ADM_004` | Invalid fulfilment transition |
| `MKT_ADM_005` | Refund not permitted (order not PAID / outside refund window) |
| `MKT_ADM_006` | Refund amount exceeds refundable balance |
| `MKT_ADM_007` | Listing cannot be approved (missing required certification document) |
| `MKT_ADM_008` | Reason required for this action |
| `MKT_ADM_009` | Category/certification slug or code already exists |
| `MKT_ADM_010` | Category in use — delete blocked |
| `MKT_ADM_011` | Insufficient permission for action |
| `MKT_ADM_012` | Duplicate refund (idempotency conflict) |
| `MKT_ADM_013` | Invalid platform-fee value |

---

## 8. Admin UI / Section (premium UX)

Route base `/bennie/marketplace`. No basic UI — every screen is a rich ops console.

- **Products table** — server-side pagination, column sort, full-text search, faceted filters
  (moderation status, sell-status, category, certification, seller, low-stock). Row status chips.
  Bulk actions (approve/reject selected). Export CSV.
- **Moderation queue** — dedicated **approval-queue** view: card/list of `PENDING` listings with a
  side-by-side detail drawer (images gallery, declared certifications + proof docs, pricing,
  seller trust summary) and approve/reject/request-changes buttons; reject opens a **reason modal**.
- **Product detail drawer** — tabs: Details, Inventory (adjust with confirm modal), Moderation
  history timeline, Orders containing this product.
- **Orders table** — filters (payment/fulfilment status, date range, seller/buyer, amount range).
  Row → **order detail drawer**: item list, buyer + shipping, payment + fulfilment timeline
  (stepper), tracking editor. Actions: advance fulfilment (guarded dropdown), cancel, **refund**
  (confirm modal with amount + reason + restock toggle; refund button visually distinguished and
  hidden for admins lacking `orders:refund`).
- **Sellers table** — GMV / listing-count / order-count aggregates, rating, suspend toggle with
  confirm modal + reason.
- **Categories & certifications** — tree editor with drag-reorder, active toggles, in-use guards.
- **Inventory / low-stock** — filtered table with inline threshold edit; badge count feeds the
  dashboard alert center.
- **Marketplace settings** — form for platform-fee %, cap, low-stock default, auto-approve toggle,
  refund window; **charts**: fee revenue over time, order volume, refund rate. Save → confirm modal
  noting "affects future orders only".

---

## 9. Environment variables

Config is **DB-driven** via `marketplaceSettings` / the global `settings` collection; the env vars
below are only **bootstrap defaults** seeded on first run (mirroring the user PRD):

```bash
PLATFORM_FEE_PERCENT=5              # seeds marketplaceSettings.platformFeePercent
LOW_STOCK_THRESHOLD=10             # seeds defaultLowStockThreshold
MAX_ORDER_DAYS_ADVANCE=60          # seeds maxOrderDaysAdvance
MARKETPLACE_AUTO_APPROVE=false     # seeds autoApproveListings
MARKETPLACE_REFUND_WINDOW_DAYS=14  # seeds refundWindowDays
```

---

## 10. Open questions for the owner

1. **`Product.moderationStatus` — RESOLVED (adopted).** The additive `moderationStatus`, `moderatedBy`,
   `moderatedAt`, and `suspended` fields on `Product` are owner-approved adopted design
   ([§2.4](#24-product-schema-additions-adopted-design),
   [README](../README.md#adopted-domain-schema-extensions-finalized),
   [`data_structure.md`](../../data_structure.md) §7).
2. **Partial-refund payment state — RESOLVED (adopted).** `Order.paymentStatus` gains
   `PARTIALLY_REFUNDED` (see [§4.3](#43-refund-rules)).
3. **Refund RBAC — RESOLVED.** `orders:refund` is **Super-Admin-only and non-delegable**; it cannot be
   granted to a sub-admin role.
4. **Auto-approve default.** Should new co-op-verified sellers get `autoApproveListings`, or should
   all listings pass moderation initially?
5. **Seller identity.** Sellers are `User` docs (role `farmer`/`agent`) — there is no dedicated
   `Merchant`/`ServiceProvider`-style collection for produce sellers in the user PRD. Confirm the
   seller model before building `GET /marketplace/sellers` aggregates.
