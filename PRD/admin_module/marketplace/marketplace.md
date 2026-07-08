# Admin PRD: E-commerce Marketplace — Products, Categories & Seller Oversight (LIVE build)

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no admin marketplace code exists yet; the `WalletService`
> payment/refund primitives it depends on are ✅ — see §4.1)
>
> This document is a **live blueprint** for `admin-dev` / `backend-dev`. It governs admin
> operations over marketplace **products, categories, listing moderation, and seller (merchant)
> oversight** for the full LIVE Marketplace + Orders + Merchants build.
>
> **Scope split (owner-locked).** Order management previously lived in this document; it has
> **moved** to [`admin_orders/orders.md`](../admin_orders/orders.md). Merchant identity, KYC, and
> payouts live in [`merchants/merchants.md`](../merchants/merchants.md). This file stays focused on
> **products / categories / moderation / seller oversight**.
>
> Companion user-side specs (authored concurrently — cross-references, do not edit from here):
> [`PRD/user_module/ecommerce-marketplace/ecommerce-marketplace.md`](../../user_module/ecommerce-marketplace/ecommerce-marketplace.md),
> [`PRD/user_module/cart_checkout/cart_checkout.md`](../../user_module/cart_checkout/cart_checkout.md),
> [`PRD/user_module/merchant_panel/merchant_panel.md`](../../user_module/merchant_panel/merchant_panel.md).
> Canonical schemas: [`PRD/data_structure.md`](../../data_structure.md) **§11**.

---

## 1. Overview

The admin marketplace surface lets operations staff govern the e-commerce marketplace catalogue
end-to-end:

- **Products** — full CRUD over the LIVE `products` collection, including **admin-created
  platform products** (which **skip moderation** and sell as `seller.type = 'PLATFORM'` orders)
  and **merchant products** (created from the user-side Merchant Hub, moderated here).
- **Moderation queue** — per-listing approval: merchant-created/edited listings enter
  `moderationStatus: PENDING`; admins approve / reject (reason required) / request changes.
- **Categories** — an **admin-owned** `productCategories` collection, seeded from the 8 existing
  frontend category names ([§2.1](#21-productcategories--admin-owned-seeded)).
- **Product media** — every product carries up to **3 images + 1 video** as embedded
  `FileMetadata` (public bucket, via the shared upload service); **deleting a product cascades
  deletion of its media** (GCS objects + `files` rows).
- **Seller oversight** — read-only merchant/listing aggregates with deep links into the
  [Merchants section](../merchants/merchants.md) (which owns KYC, suspend/reinstate, payouts).

**Owner-locked decisions this document treats as final:**

1. **Payment is wallet-only** — checkout debits the buyer's wallet via
   `WalletService.debitForPayment(...)`; refunds via `creditRefund(...)`. No card/SeerBit at
   checkout. (Details in [`orders.md`](../admin_orders/orders.md).)
2. **Per-listing moderation** — merchant listings enter `PENDING`; **admin-created products skip
   moderation** and are created `APPROVED`. `CHANGES_REQUESTED` is retained.
3. **Seller identity is the `merchants` collection** — the former Open Question 5 ("sellers are
   `User` docs?") is **RESOLVED**: produce/inputs sellers are **merchants** (a dedicated
   collection keyed to a `users` account via Merchant-Hub KYC). Admin-created products have **no
   merchant** — they are platform catalogue items.
4. **Categories are admin-owned** and seeded from the 8 frontend names.

**Conventions (shared across all admin PRDs — see [`README.md`](../README.md) for the
authoritative RBAC taxonomy):**

- Backend routes under **`/api/v1/admin/*`**; admin frontend under **`/bennie/*`**.
- Admin identity = **`adminUsers`**; authorization = **`adminRoles`** (`resource:action`) +
  per-admin overrides; **Super Admin = `*`**. **Every endpoint declares its required
  permission**, enforced by `PermissionsGuard` over the admin JWT guard.
- **Every mutation writes an `adminAuditLog` entry** (`actor`, `action`, `target`,
  `before/after`, `timestamp`, `ip`, `userAgent`).
- Money is whole **NGN**. Responses serialize `_id → id` strings.
- Standard error envelope `{ success: false, error: { code, message, details? } }`.

---

## 2. Collections / Schema

Canonical field-level definitions live in [`data_structure.md`](../../data_structure.md) §11
(which **supersedes** the frontend mock §1.9 and the earlier draft §7.7.6). Summarized here for
the fields this section reads/writes.

### 2.1 `productCategories` 📄 (admin-owned, seeded)

```jsonc
{
  "_id": "ObjectId",
  "name": "string",              // unique, e.g. "Seeds"
  "slug": "string",              // unique, lowercased
  "description": "string?",
  "icon": "string?",
  "isActive": "boolean",         // inactive hides from buyer browse + blocks new listings
  "sortOrder": "number",
  "createdBy": "ObjectId?",      // ref adminUsers; null for seeded rows
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

**Seed (idempotent, on bootstrap — owner-locked):** the 8 existing frontend category names
(`ProductCategoryName`, `data_structure.md` §0):

> Seeds · Fertilizers · Agrochemicals · Farm Equipment · Livestock Inputs · Irrigation Equipment ·
> Greenhouse Materials · Farm Produce

Seeded rows have `isActive: true`, `sortOrder` = list order, `createdBy: null`.

### 2.2 `products` 📄 (LIVE — shared with the user plane)

Key fields (full schema: `data_structure.md` §11.2):

```jsonc
{
  "_id": "ObjectId",
  "productId": "string",                 // unique, "PRD_<ts>_<rand>"
  "source": ["ADMIN", "MERCHANT"],       // ADMIN = platform product (skips moderation)
  "merchantId": "ObjectId?",             // ref merchants — required when source = MERCHANT
  "createdByAdminId": "ObjectId?",       // ref adminUsers — set when source = ADMIN
  "name": "string",
  "slug": "string",                      // unique
  "description": "string",
  "categoryId": "ObjectId",              // ref productCategories
  "price": "number",                     // NGN, whole
  "unit": "string",                      // e.g. "50kg Bag"
  "inventory": { "available": "number", "reserved": "number", "lowStockThreshold": "number?" },
  "images": "FileMetadata[]",            // MAX 3 — embedded full FileMetadata JSON (public bucket)
  "video": "FileMetadata?",              // MAX 1 — embedded full FileMetadata JSON (public bucket)
  "moderationStatus": ["PENDING", "APPROVED", "REJECTED", "CHANGES_REQUESTED"],
  "moderationReason": "string?",         // required on REJECTED / CHANGES_REQUESTED
  "moderatedBy": "ObjectId?",            // ref adminUsers
  "moderatedAt": "Date?",
  "status": ["ACTIVE", "INACTIVE", "OUT_OF_STOCK"],
  "suspended": "boolean",                // set true when the owning merchant is suspended (delist)
  "totalSales": "number",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

**Buyer visibility rule:** buyers only ever see products where `moderationStatus === 'APPROVED'`
**and** `status === 'ACTIVE'` **and** `suspended !== true`.

### 2.3 Product media (owner-locked)

- `images: FileMetadata[]` — **max 3**; `video?: FileMetadata` — **max 1**. The **full
  `FileMetadata` JSON** (`id`, `name`, `url`, `fileType`, `size`, `path`, `bucket`,
  `uploaderType`, `uploaderId`, `visibility`, `createdAt`) is **embedded on the product**
  (snapshot + working reference), per [`gcp_upload.md`](../../gcp_upload.md).
- Media is uploaded through the **existing upload endpoints** (`POST /api/v1/admin/upload` on the
  admin plane; `POST /api/v1/upload` from the Merchant Hub) with `visibility: 'public'` (the
  default) — product media lives in the **public** bucket.
- **Cascade delete (owner-locked):** deleting a product deletes its media — for each embedded
  media entry the server calls `UploadService.remove(<FileMetadata.id>)`, removing the GCS object
  **and** the `files` row. The same cascade applies to media entries **removed during an edit**
  (a replaced image/video is deleted, since nothing else references it — orders embed their own
  item snapshots).

### 2.4 `productModeration` 📄 (admin-owned, append-only)

One record per moderation decision (history the queue drawer renders):

```jsonc
{
  "_id": "ObjectId",
  "productId": "ObjectId",       // ref products
  "merchantId": "ObjectId?",     // ref merchants (denormalized for filtering; null for ADMIN source)
  "decision": ["APPROVED", "REJECTED", "CHANGES_REQUESTED", "AUTO_APPROVED"],
  "reason": "string?",           // required when REJECTED / CHANGES_REQUESTED
  "reviewedBy": "ObjectId?",     // ref adminUsers; null when AUTO_APPROVED (admin-created product)
  "reviewedAt": "Date",
  "createdAt": "Date"
}
```

`AUTO_APPROVED` records the create-time approval of an **admin-created** product (traceability
for the "skips moderation" rule).

### 2.5 Marketplace config (SSOT = global `settings`)

The **global `settings` collection** owns marketplace config (see
[`settings.md`](../settings/settings.md)); this section reads, never duplicates:

```jsonc
{
  "platformFeePercent": "number",        // % deducted from MERCHANT order totals when booking earnings (see orders.md §5 / merchants.md §5)
  "defaultLowStockThreshold": "number",  // fallback when inventory.lowStockThreshold unset
  "refundWindowDays": "number"           // admin-refund eligibility window (see orders.md)
}
```

> **Retired this phase:** the earlier `certificationType` collection and
> `Product.certifications[]` moderation gate, and the `autoApproveListings` global toggle, are
> **not part of the LIVE build** (per-listing moderation is always on for merchant listings;
> admin-created products always skip it). If certifications return later they re-enter as an
> additive pass.

---

## 3. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission. `4xx` bodies use
the standard error envelope ([§7](#7-error-codes)).

### 3.1 Product management (`marketplace:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/marketplace/products` | `marketplace:view` | List/search products (filters below) |
| GET | `/marketplace/products/:id` | `marketplace:view` | Product detail + moderation history + merchant summary |
| POST | `/marketplace/products` | `marketplace:create` | **Admin-create a platform product** — created `source: 'ADMIN'`, `moderationStatus: 'APPROVED'` (skips moderation) |
| PATCH | `/marketplace/products/:id` | `marketplace:update` | Edit product fields (name, price, category, inventory, media) |
| DELETE | `/marketplace/products/:id` | `marketplace:delete` | Delete a product (**Super-Admin-only** per `*:delete`) — **cascades media deletion** (§2.3); blocked while non-terminal orders contain it |
| POST | `/marketplace/products/:id/approve` | `marketplace:approve` | Approve a `PENDING`/`CHANGES_REQUESTED` listing |
| POST | `/marketplace/products/:id/reject` | `marketplace:reject` | Reject a listing, or request changes (reason required) |
| GET | `/marketplace/moderation-queue` | `marketplace:view` | Products with `moderationStatus = PENDING` (oldest first) |

**GET `/marketplace/products` query params:** `page`, `limit`, `q` (name/slug search),
`moderationStatus`, `status`, `source` (`ADMIN|MERCHANT`), `merchantId`, `categoryId`,
`lowStock` (bool), `suspended` (bool), `sortBy` (`createdAt|totalSales|price`), `order`.

**POST `/marketplace/products` — request (admin platform product):**
```json
{
  "name": "NPK 20-10-10 Fertilizer",
  "description": "Premium compound fertilizer for maize and rice.",
  "categoryId": "664f00aa12de3b0011cc10a2",
  "price": 42000,
  "unit": "50kg Bag",
  "inventory": { "available": 120, "lowStockThreshold": 10 },
  "images": [ { "id": "665f1c2a9b3e4a0012ab34cd", "url": "https://storage.googleapis.com/bennie-connect-media/9b1c…-npk-1.jpg", "fileType": "image/jpeg", "size": 183321, "name": "9b1c…-npk-1.jpg", "originalName": "npk-1.jpg", "bucket": "bennie-connect-media", "path": "9b1c…-npk-1.jpg", "uploaderType": "admin", "uploaderId": "ADM_1720001299_zz99yy", "visibility": "public", "createdAt": "2026-07-02T09:20:00.000Z" } ],
  "video": null
}
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "6660aa019b3e4a0012ab9901",
    "productId": "PRD_1720100000_a1b2c3",
    "source": "ADMIN",
    "moderationStatus": "APPROVED",
    "status": "ACTIVE",
    "name": "NPK 20-10-10 Fertilizer",
    "price": 42000
  }
}
```
- Media entries are **already-uploaded** `FileMetadata` objects returned by
  `POST /api/v1/admin/upload` — no binary is posted here. Server re-validates each `id` against
  the `files` collection (`MKT_ADM_015`) and enforces the 3-image / 1-video caps (`MKT_ADM_014`).
- A `productModeration` row with `decision: 'AUTO_APPROVED'` is written (traceability).

**POST `/marketplace/products/:id/reject` — request:**
```json
{ "reason": "Images do not match the declared product", "requestChanges": false }
```
`requestChanges: true` sets `moderationStatus = CHANGES_REQUESTED` (merchant may edit + resubmit)
instead of terminal `REJECTED`. **Response 200:**
```json
{ "success": true, "data": { "id": "6660aa019b3e4a0012ab9901", "moderationStatus": "REJECTED", "moderatedAt": "2026-07-03T10:00:00Z" } }
```

### 3.2 Categories (`marketplace:configure`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/marketplace/categories` | `marketplace:view` | List categories (incl. inactive, with product counts) |
| POST | `/marketplace/categories` | `marketplace:configure` | Create a category |
| PATCH | `/marketplace/categories/:id` | `marketplace:configure` | Edit / toggle active / reorder |
| DELETE | `/marketplace/categories/:id` | `marketplace:configure` | Delete (blocked if any product references it → `MKT_ADM_010`) |

Deactivating a category hides it from buyer browse and blocks **new** listings in it; existing
approved products remain purchasable (flag surfaced in the UI).

### 3.3 Inventory (`marketplace:*`)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/marketplace/inventory/low-stock` | `marketplace:view` | Products at/below their low-stock threshold |
| PATCH | `/marketplace/products/:id/inventory` | `marketplace:update` | Adjust `available` / `lowStockThreshold` |

### 3.4 Seller oversight (read-only here; actions live in Merchants)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/marketplace/sellers` | `marketplace:view` | Merchants with listing/order/GMV aggregates (thin projection over `merchants` + `orders`) |
| GET | `/marketplace/sellers/:merchantId` | `marketplace:view` | Merchant summary + their listings + recent orders |

- **Seller identity is the `merchants` collection** (owner-locked; resolves former Open
  Question 5). `merchantId` params are `merchants._id`.
- **Suspend / reinstate / KYC / payouts are NOT here** — they are Merchants-section actions
  (`merchants:suspend`, `merchants:approve`, `merchants:mark-payout-sent`) specified in
  [`merchants.md`](../merchants/merchants.md). Suspending a merchant there sets
  `suspended: true` on all their products (delist); reinstating clears it (previously `APPROVED`
  listings return to browse without re-moderation).
- These endpoints exist so the marketplace console can show seller context inline; rows deep-link
  to `/bennie/merchants/:id`.

---

## 4. Business rules & state machines

### 4.1 Wallet primitives (✅ implemented — context)

`backend/src/wallet/wallet.service.ts` already ships the two money primitives the LIVE
marketplace uses (reused by equipment today):

- `debitForPayment(userId, { amount, reference, description, narration?, category?, metadata? })`
  — atomic, **idempotent by `reference`**, throws `WALLET_001` on insufficient balance.
- `creditRefund(userId, { amount, reference, description, narration?, category?, metadata? })`
  — atomic, **idempotent by `reference`**; zero/negative amount is a success no-op.

Checkout/refund flows that call them are specified in
[`orders.md`](../admin_orders/orders.md) and the user-side
[`cart_checkout.md`](../../user_module/cart_checkout/cart_checkout.md).

### 4.2 Listing moderation lifecycle (owner-locked)

```
        (merchant creates / merchant edits material fields)
                          │
                          ▼
                      PENDING ──approve──► APPROVED ──(merchant edits material fields)──► PENDING
                          │                    │
                  reject  │           delete / │ merchant suspended
              requestChgs │           suspend  ▼
                          ▼               (deleted / suspended=true)
      REJECTED ◄──► CHANGES_REQUESTED
            (merchant edits + resubmits → PENDING)

        (ADMIN creates a platform product) ────────────────► APPROVED   (skips moderation)
```

- **Merchant-created** listings always enter `PENDING`. **Merchant edits** to *material* fields
  (name, category, price, unit, description, media) of an `APPROVED` listing return it to
  `PENDING` (delisted from browse until re-approved). Inventory-only changes are non-material.
- **Admin-created products** (`source: 'ADMIN'`) are created `APPROVED` with an
  `AUTO_APPROVED` moderation row. **Admin edits** never trigger moderation (admins are the
  moderators).
- `reject` / `requestChanges` **require** a non-empty reason (`MKT_ADM_008`); the merchant is
  notified (`product.moderation.decided`, [§6.1](#61-notifications)).
- `REJECTED` is terminal for that submission; the merchant may edit and resubmit →
  `PENDING` (new moderation row).
- Approve is only valid from `PENDING`/`CHANGES_REQUESTED` (`MKT_ADM_016`).

### 4.3 Product deletion & media cascade (owner-locked)

- `DELETE /marketplace/products/:id` is **Super-Admin-only** (`marketplace:delete` ∈ the
  README `*:delete` reservation).
- Blocked while any **non-terminal order** (`fulfillmentStatus ∉ {DELIVERED, CANCELLED}`)
  contains the product (`MKT_ADM_017`) — terminal orders are unaffected because order items are
  snapshots.
- On delete the server calls `UploadService.remove(id)` for **every** embedded media entry
  (`images[]` + `video`) — GCS object + `files` row both go. Media-removal failures are logged
  and retried; the product delete itself is not rolled back for a media-cascade failure
  (orphan-sweep note flagged to `backend-dev`).

### 4.4 Inventory rules

- On order placement (checkout), quantity moves `available → reserved` per split order.
- On `DELIVERED`, reserved quantity is consumed (`reserved` decremented, `totalSales`
  incremented).
- On `CANCELLED` / refund with `restock: true`, quantity returns to `available`
  (see [`orders.md`](../admin_orders/orders.md) §5).
- `available <= lowStockThreshold` (or the settings default) → surfaces in
  `GET /marketplace/inventory/low-stock` + a dashboard alert. `available == 0` →
  `status = OUT_OF_STOCK` (hidden from browse).

---

## 5. Validation

- `name`: 3–120 chars. `slug`: unique, kebab-case (server-generated from name, de-duplicated).
- `price`: integer NGN `> 0`. `inventory.available`: integer `>= 0`.
- `categoryId`: must reference an **active** `productCategories` row (`MKT_ADM_018` if inactive
  on create).
- `images`: array of `FileMetadata`, length `0–3`; `video`: single `FileMetadata` or null —
  over-cap → `MKT_ADM_014`. Each media `id` must exist in `files` (`MKT_ADM_015`); images must be
  `image/*`, video `video/*` per the upload allowlist.
- `reject`/`requestChanges` **require** `reason` (`>= 5` chars) → else `MKT_ADM_008`.
- Category `name`/`slug` unique (`MKT_ADM_009`); deletion blocked while referenced
  (`MKT_ADM_010`).
- Moderation transitions validated per §4.2 (`MKT_ADM_016`).
- All `:id` params validated as Mongo ObjectId; missing target → `404` with the relevant
  `*_NOT_FOUND`.

---

## 6. Audit events & notifications

### 6.1 Notifications

Via the shared `NotificationService` (`notify()` / `notifyAdmins()`, persisted + socket + FCM,
`link` deep-link — [`PRD/notification.md`](../../notification.md)):

| Event key | Fires on | Audience | `link` |
|-----------|----------|----------|--------|
| `product.moderation.pending` | merchant listing enters `PENDING` (create or material edit) | **admins** | `/bennie/market-place?tab=moderation` |
| `product.moderation.decided` | approve / reject / request-changes | merchant (owner user) | merchant-hub listing URL |

(The full marketplace notification matrix — orders, merchant KYC, payouts — is consolidated in
`data_structure.md` §11.8.)

### 6.2 Audit events

Every mutation writes an `adminAuditLog` entry `{ actor, action, targetType, targetId, before,
after, reason?, timestamp, ip, userAgent }`:

| Action | Trigger | Severity |
|--------|---------|----------|
| `marketplace.product.create` | POST product (records `source: 'ADMIN'`) | normal |
| `marketplace.product.update` | PATCH product / inventory | normal |
| `marketplace.product.delete` | DELETE product (+ lists cascaded media file ids) | **high** |
| `marketplace.product.approve` | approve | normal |
| `marketplace.product.reject` / `.request_changes` | reject / request changes | normal |
| `marketplace.category.create` / `.update` / `.delete` | category CRUD | normal |

Read-only endpoints do not audit.

---

## 7. Error codes

Standard envelope:
```json
{ "success": false, "error": { "code": "MKT_ADM_014", "message": "Media limit exceeded", "details": { "images": 4, "maxImages": 3 } } }
```

| Code | Meaning |
|------|---------|
| `MKT_ADM_001` | Product not found |
| `MKT_ADM_003` | Seller (merchant) not found |
| `MKT_ADM_008` | Reason required for this action |
| `MKT_ADM_009` | Category name/slug already exists |
| `MKT_ADM_010` | Category in use — delete blocked |
| `MKT_ADM_011` | Insufficient permission for action |
| `MKT_ADM_013` | Invalid platform-fee value (settings surface) |
| `MKT_ADM_014` | Media limit exceeded (max 3 images / 1 video) |
| `MKT_ADM_015` | Media file not found in the `files` index |
| `MKT_ADM_016` | Invalid moderation transition (e.g. approve on `APPROVED`) |
| `MKT_ADM_017` | Product delete blocked — non-terminal orders contain it |
| `MKT_ADM_018` | Category inactive — new listings blocked |

> **Moved codes:** the former `MKT_ADM_002` (order not found), `MKT_ADM_004` (invalid fulfilment
> transition), `MKT_ADM_005`/`MKT_ADM_006`/`MKT_ADM_012` (refund rules) now live in
> [`orders.md`](../admin_orders/orders.md) as `ORD_ADM_*`. `MKT_ADM_007` (certification document)
> is retired with certifications (§2.5 note).

---

## 8. Admin UI / Section (premium UX)

Route base **`/bennie/market-place`** (existing nav item, group *Operations*). Rich ops console —
no basic UI. Orders get their **own** nav item + console (`/bennie/orders`,
[`orders.md`](../admin_orders/orders.md)); merchants likewise (`/bennie/merchants`).

- **Products table** — server-side pagination, column sort, full-text search, faceted filters
  (moderation status, sell-status, `source` ADMIN/MERCHANT, category, merchant, low-stock,
  suspended). Row: thumbnail (first image), name, category chip, price, stock, source badge
  (**Platform** / **Merchant**), moderation + status chips. Bulk approve/reject on selection.
  Export CSV (`marketplace:export`).
- **Multi-step admin product wizard (owner-locked)** — `marketplace:create` / `marketplace:update`;
  a 4-step wizard with a progress stepper, per-step validation, and draft state held client-side:
  1. **Basics** — name, category (select from active categories), unit, description (rich text
     limited to plain formatting).
  2. **Pricing & Inventory** — price (NGN input with thousands grouping), available stock,
     low-stock threshold (pre-filled from the settings default).
  3. **Media** — uploader for **up to 3 images + 1 video**: drag-drop, per-file **upload
     progress bars** (axios `onUploadProgress` via `adminUpload.service`), reorder images / set
     primary, remove (removal on an existing product cascade-deletes the file on save), video
     slot with duration/size hint (≤ 200 MB per the upload cap). Files go to
     `POST /api/v1/admin/upload` (public visibility) and the returned `FileMetadata` JSON is
     staged into the form.
  4. **Review** — read-only summary card (all fields + media gallery) with an explicit note:
     *"Admin products publish immediately — no moderation."* Submit → `POST /marketplace/products`.
- **Moderation queue** — dedicated approval-queue view of `PENDING` listings (oldest first):
  card/list with a side-by-side detail drawer (image gallery + video player, pricing, merchant
  trust summary with KYC badge + link to `/bennie/merchants/:id`) and **Approve / Request changes
  / Reject** buttons; reject/request-changes open a **reason modal**. Queue badge count feeds the
  dashboard alert center.
- **Product detail drawer** — tabs: Details, Media, Inventory (adjust with confirm modal),
  Moderation history timeline (`productModeration` rows), Orders containing this product
  (deep-links to `/bennie/orders?productId=…`).
- **Categories manager** — sortable list (drag-reorder → `sortOrder`), active toggles with
  in-use counts, create/edit modal, delete guarded by the in-use check. Seeded rows are editable
  but the seed set is documented inline.
- **Sellers view** — merchants with GMV / listing-count / order-count aggregates and KYC status
  chips; rows deep-link to `/bennie/merchants/:id` (all actions live there).
- **Low-stock view** — filtered table with inline threshold edit; badge count feeds the dashboard
  alert center.
- **Permission gating** — create wizard hidden without `marketplace:create`; approve/reject
  buttons hidden without `marketplace:approve`/`marketplace:reject`; delete visible only to
  Super Admin.

---

## 9. Environment variables

Config is **DB-driven** via the global `settings` collection; env vars are bootstrap seeds only:

```bash
PLATFORM_FEE_PERCENT=5              # seeds settings.marketplace.platformFeePercent (merchant net-share fee)
LOW_STOCK_THRESHOLD=10              # seeds settings.marketplace.defaultLowStockThreshold
MARKETPLACE_REFUND_WINDOW_DAYS=14   # seeds settings.marketplace.refundWindowDays
```

(Prembly + private-bucket env vars belong to [`merchants.md`](../merchants/merchants.md) and
[`gcp_upload.md`](../../gcp_upload.md).)

---

## 10. Resolved decisions (owner-locked) & flags

1. **Seller identity — RESOLVED.** Sellers are **`merchants`** (dedicated collection, Merchant-Hub
   KYC via Prembly + private-bucket docs) — see [`merchants.md`](../merchants/merchants.md) and
   `data_structure.md` §11.5. The former "sellers are `User` docs" open question is closed.
2. **Moderation — RESOLVED.** Per-listing moderation for merchant listings (PENDING on create and
   on material edit; `CHANGES_REQUESTED` retained); **admin-created products skip moderation**.
   The former `autoApproveListings` toggle is retired.
3. **Order management — MOVED.** All order endpoints, the fulfilment state machine, cancel and
   refund rules now live in [`admin_orders/orders.md`](../admin_orders/orders.md)
   (`/api/v1/admin/orders*`, `/bennie/orders`).
4. **Media — RESOLVED.** 3 images + 1 video as embedded `FileMetadata`; delete cascades to GCS +
   `files` via `UploadService.remove`.
5. **Categories — RESOLVED.** Admin-owned, seeded from the 8 frontend names.
6. **Drift flag (schema supersession).** `data_structure.md` §11 supersedes the §1.9 frontend
   mock (`Product`/`CartItem`/`ProductOrder`) and the §7.7.6 draft `Product`/`Order` shapes
   (which modeled `sellerId → users`, embedded `pricing.bulkPricing`, certifications, and string
   image URLs). Flagged for `user-dev`/`backend-dev`: build against §11, not §7.7.6.
