# PRD 08: E-commerce Marketplace — Live Storefront (User)

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded · ⚠️ drift / reconciliation flag
>
> **Overall module status: 📄** — the current UI (`src/pages/users/AgriculturalMarketplaceView.tsx`,
> a 790-line client-only mock with Buy / Track Orders / Merchant Portal tabs) is **superseded and
> removed** by this spec set. This document is the **live storefront** build contract for
> `backend-dev` (NestJS `/api/v1/marketplace/*` reads) and `user-dev` (React storefront pages).
>
> **The marketplace spec is a three-document set — read together, no duplication:**
> 1. **This file** — storefront: browse / search / filter / sort, product cards, product detail
>    page, visibility rules, storefront UI/UX.
> 2. [`PRD/user_module/cart_checkout/cart_checkout.md`](../cart_checkout/cart_checkout.md) —
>    server-side cart, wallet-only checkout, per-seller order split, orders & tracking pages,
>    cancel/refund, confirm-received.
> 3. [`PRD/user_module/merchant_panel/merchant_panel.md`](../merchant_panel/merchant_panel.md) —
>    the independent Merchant Hub at `/app/merchant`: KYC onboarding (Prembly), listing
>    management + moderation, order fulfilment, earnings & manual payouts.
>
> **Admin side** (category CRUD, listing moderation, PLATFORM-order fulfilment, merchant KYC
> review, payout marking) is owned by the **admin PRDs** —
> [`PRD/admin_module/marketplace/marketplace.md`](../../admin_module/marketplace/marketplace.md)
> and the merchant-review spec under `PRD/admin_module/` (being authored by the admin docs agent)
> — and is **not redefined here**. Live infra plugged into:
> [`PRD/user_module/wallet/digital-wallet-seerbit.md`](../wallet/digital-wallet-seerbit.md)
> (LIVE wallet — ✅ `WalletService.debitForPayment` / `creditRefund` exist in
> `backend/src/wallet/wallet.service.ts`), [`PRD/notification.md`](../../notification.md)
> (notification engine), [`PRD/gcp_upload.md`](../../gcp_upload.md) (file uploads), and the LIVE
> marketplace collections catalogued in [`PRD/data_structure.md`](../../data_structure.md) §11
> (authored by the admin docs agent — **where schemas here and §11 disagree, §11 wins**).

---

## 1. Overview

Agricultural-inputs and farm-produce e-commerce for cooperative members: buyers browse a
moderated catalogue of **PLATFORM** listings (cooperative-owned stock, admin-managed) and
**MERCHANT** listings (created by KYC-approved user-merchants), add items to a **server-side
cart**, and pay **from the live wallet only**. Orders **split per seller** at checkout and are
fulfilled by the responsible seller.

### 1.1 Owner-locked design decisions (FINAL)

| # | Decision | Detailed in |
|---|----------|-------------|
| 1 | **Wallet-only checkout** via the existing `WalletService.debitForPayment` (idempotent by reference); cancellations/refunds via `creditRefund`. Insufficient balance → clear error + prompt to top up. | cart_checkout §4 |
| 2 | **Orders split per seller** at checkout — one order per seller, linked by a shared `checkoutGroupId`; buyer sees one purchase with N sub-orders. Fulfilment `PENDING → PROCESSING → SHIPPED → DELIVERED` (+ `CANCELLED`); MERCHANT orders advanced by the merchant, PLATFORM orders by admins. Buyer cancels while `PENDING` (auto wallet refund); buyer **confirms received** after `DELIVERED`. | cart_checkout §4 |
| 3 | **Per-listing moderation** — merchant-created/edited listings are `moderationStatus: PENDING` until an admin approves; buyers only ever see **APPROVED + ACTIVE + non-suspended** products (§4 of this doc). | this doc §4 · merchant_panel §4.4 |
| 4 | **Merchant Panel is an independent section** at `/app/merchant` (new nav item, **not** a marketplace tab). Any user can open it and start onboarding; only `APPROVED` merchants sell. | merchant_panel |
| 5 | **KYC** — business info + government ID (NIN / BVN / driver's licence / voter's card / international passport, optional CAC) + private-bucket document uploads; **Prembly** server-side ID check (advisory); docs **purged from GCS after the admin's final decision**. | merchant_panel §4.2–§4.3 |
| 6 | **Merchant earnings & payout — manual, adashe-style**: DELIVERED orders book net share (total − platform-fee %) into an earnings ledger (not the wallet); payout is REQUESTED → admin MARKED_SENT → merchant CONFIRMED_RECEIVED. | merchant_panel §4.5–§4.6 |
| 7 | **Product media** — `images: FileMetadata[]` (max **3**) + `video?: FileMetadata` (max **1**) via the existing user upload service (public bucket) with progress; full `FileMetadata` JSON embedded on the product. | merchant_panel §4.4 · this doc §2.1 |
| 8 | **Notifications** through the existing engine (persisted + socket + FCM + deep `link`) with a full trigger matrix. | cart_checkout §5 · merchant_panel §5 |
| 9 | **Categories are admin-owned** and fetched live (`GET /api/v1/marketplace/categories`); the 8 seeded names match the current frontend list. | this doc §2.2 / §3.1 |
| 10 | **The client mock is superseded and removed** — `Product`/`CartItem`/`ProductOrder` in `src/types.ts`, the `default_marketplace_data.ts` seeds, and the appStore cart/checkout/merchant handlers go away; the cart becomes server-side. | this doc §6 |

**Conventions (whole set):**
- Base API path **`/api/v1`**, guarded by the user **`JwtAuthGuard`** (`scope: "user"`) unless
  noted. Admin actions live on the admin plane (`/api/v1/admin/…`).
- Money is **whole NGN** (integer naira — no kobo decimals).
- Success envelope `{ success, message?, data }`; errors
  `{ success: false, error: { code, message, details? } }`. Error codes are prefixed
  **`MKT_`** (storefront/cart/checkout), **`ORD_`** (orders), **`MERCH_`** (merchant hub).
- All ids in responses are **serialized strings** (`id`, never raw `_id`/ObjectId).
- Timestamps ISO-8601 UTC. `:id` path params validated as ObjectId.

---

## 2. Collections / Schema

Owned collections for the storefront read-surface. Full annotated shapes are catalogued in
[`data_structure.md`](../../data_structure.md) §11 (admin-docs-agent-owned; canonical on
disagreement). The cart/order collections are in
[`cart_checkout.md`](../cart_checkout/cart_checkout.md) §2; the merchant collections in
[`merchant_panel.md`](../merchant_panel/merchant_panel.md) §2.

### 2.1 `products` 📄

One document per listing. Created by an **approved merchant** (user plane, merchant_panel §3)
or by an **admin** as a PLATFORM listing (admin plane).

```typescript
{
  _id: ObjectId;
  seller: {
    type: 'PLATFORM' | 'MERCHANT';
    merchantId?: ObjectId;            // ref merchants — required iff type === 'MERCHANT'
  };
  name: string;                       // 3–120 chars
  description: string;                // 10–2000 chars
  categoryId: ObjectId;               // ref productCategories (admin-owned, §2.2)
  price: number;                      // whole NGN per unit; >= 1
  unit: string;                       // display unit, e.g. "50kg Bag", "1L Bottle", "Unit"; 1–40 chars
  stock: {
    available: number;                // sellable units (decremented at checkout)
    reserved: number;                 // reserved for future hold flows; 0 this phase
  };
  images: FileMetadata[];             // 1–3 entries — FULL FileMetadata JSON embedded (gcp_upload.md)
  video?: FileMetadata;               // 0–1 entry — FULL FileMetadata JSON embedded
  status: 'ACTIVE' | 'INACTIVE';      // seller-controlled visibility toggle
  moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  moderationNote?: string;            // admin note on REJECTED
  moderatedBy?: ObjectId;             // ref adminUsers
  moderatedAt?: Date;
  isSuspended: boolean;               // admin kill-switch (default false)
  totalSold: number;                  // units across DELIVERED orders (drives "popular" sort)
  deletedAt?: Date;                   // soft delete — hidden everywhere when set
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** `{ 'seller.merchantId': 1 }`; `{ categoryId: 1 }`;
compound storefront index `{ moderationStatus: 1, status: 1, isSuspended: 1, deletedAt: 1 }`;
text index `{ name: 'text', description: 'text' }` (search `q`); `{ totalSold: -1 }`;
`{ createdAt: -1 }`.

- **PLATFORM listings are created pre-approved** (`moderationStatus: 'APPROVED'` at creation —
  they are admin-authored). Only MERCHANT listings go through the moderation queue.
- Media rules (locked): `images` length 1–3; at most one `video`; both uploaded through the
  existing **user upload service** (`src/services/upload.service.ts` → `POST /api/v1/upload`,
  public bucket) with upload progress; the returned `FileMetadata` objects are embedded verbatim.
- `stock.available` is the oversell guard — checkout decrements it with a conditional update
  (cart_checkout §4.2); cancel restores it.

### 2.2 `productCategories` 📄 (admin-owned; users read-only)

```typescript
{
  _id: ObjectId;
  name: string;                       // unique, 2–60 chars
  description?: string;
  sortOrder: number;                  // rail ordering
  isActive: boolean;                  // inactive categories hidden from the rail + filters
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** unique `{ name: 1 }`; `{ isActive: 1, sortOrder: 1 }`.

**Seed (locked — matches the current frontend `CATEGORIES` list exactly):**
`Seeds`, `Fertilizers`, `Agrochemicals`, `Farm Equipment`, `Livestock Inputs`,
`Irrigation Equipment`, `Greenhouse Materials`, `Farm Produce`.

> ⚠️ **Supersedes the hardcoded union type.** The mock's `ProductCategoryName` string union
> (`src/types.ts:204`) and the hardcoded `CATEGORIES` array in the view are **removed** —
> categories come live from `GET /marketplace/categories`. Category CRUD is admin-plane only
> (admin marketplace PRD); a product's `categoryId` must reference an existing category.

---

## 3. API Endpoints — storefront (user plane)

Base `/api/v1/marketplace`, `JwtAuthGuard` (`scope: "user"`). Cart/checkout/orders endpoints
are specified in [`cart_checkout.md`](../cart_checkout/cart_checkout.md) §3; merchant endpoints
in [`merchant_panel.md`](../merchant_panel/merchant_panel.md) §3.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/marketplace/categories` | Active categories for the rail + filters — §3.1 |
| `GET` | `/marketplace/products` | Browse/search/filter/sort the visible catalogue — §3.2 |
| `GET` | `/marketplace/products/:id` | Product detail (gallery, video, seller, stock) — §3.3 |

### 3.1 `GET /marketplace/categories`

Returns **active** categories ordered by `sortOrder`, each with a live count of visible
products (per the §4 visibility rules).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "cat_1", "name": "Seeds", "sortOrder": 1, "productCount": 12 },
      { "id": "cat_2", "name": "Fertilizers", "sortOrder": 2, "productCount": 8 }
    ]
  }
}
```

### 3.2 `GET /marketplace/products`

Only products passing the **visibility rules (§4)** are ever returned.

**Query params:**

| Param | Type / values | Default | Notes |
|-------|---------------|---------|-------|
| `q` | string, 1–100 chars | — | text search over `name` + `description` |
| `category` | category id | — | filter by `categoryId` |
| `sort` | `newest` \| `price_asc` \| `price_desc` \| `popular` | `newest` | `popular` = `totalSold` desc |
| `page` | int ≥ 1 | `1` | |
| `limit` | int 1–100 | `20` | |
| `inStockOnly` | boolean | `false` | when `true`, excludes `stock.available === 0` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "prd_1",
        "name": "Hybrid Disease-Resistant Maize Seeds (Zea mays)",
        "description": "High-yielding drought-tolerant hybrid seeds…",
        "category": { "id": "cat_1", "name": "Seeds" },
        "price": 18500,
        "unit": "10kg Bag",
        "stock": { "available": 45 },
        "images": [ { "id": "fil_1", "url": "https://storage.googleapis.com/…/maize.jpg", "fileType": "image/jpeg", "…": "full FileMetadata" } ],
        "hasVideo": false,
        "seller": { "type": "MERCHANT", "merchantId": "mch_1", "displayName": "Shola Organic Farms" },
        "totalSold": 132,
        "createdAt": "2026-07-01T10:00:00Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

- `seller.displayName` is the merchant's `businessInfo.businessName` (MERCHANT) or the
  cooperative storefront name (PLATFORM, from settings — default `"Bennie Cooperative Store"`).
- List items include the images array but **not** the embedded video metadata (`hasVideo`
  boolean only) to keep the payload light; the detail endpoint returns the full `video`.

### 3.3 `GET /marketplace/products/:id`

Full detail for the product page. Same visibility rules — a product that is not visible returns
`MKT_001` (**404**, no existence leakage of unapproved/suspended listings).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "prd_1",
    "name": "Hybrid Disease-Resistant Maize Seeds (Zea mays)",
    "description": "High-yielding (up to 7 t/ha) drought-tolerant hybrid seeds…",
    "category": { "id": "cat_1", "name": "Seeds" },
    "price": 18500,
    "unit": "10kg Bag",
    "stock": { "available": 45 },
    "images": [ { "id": "fil_1", "url": "…", "fileType": "image/jpeg", "size": 240113, "…": "full FileMetadata" } ],
    "video": { "id": "fil_2", "url": "…", "fileType": "video/mp4", "size": 10485760, "…": "full FileMetadata" },
    "seller": { "type": "MERCHANT", "merchantId": "mch_1", "displayName": "Shola Organic Farms" },
    "totalSold": 132,
    "inCart": { "itemId": "cit_9", "quantity": 2 },
    "createdAt": "2026-07-01T10:00:00Z",
    "updatedAt": "2026-07-02T08:00:00Z"
  }
}
```

- `inCart` echoes the caller's current cart line for this product (or `null`) so the detail
  page can render "in basket ×2" without a second round-trip.

---

## 4. Visibility & availability rules (locked)

A product is **visible to buyers** (list, detail, addable to cart, checkout-able) **iff ALL**
hold:

1. `moderationStatus === 'APPROVED'`
2. `status === 'ACTIVE'`
3. `isSuspended === false`
4. `deletedAt` is unset
5. the product's category `isActive === true`

Additional availability rules:

- `stock.available === 0` → the product **stays visible** (list + detail) with an
  "Out of stock" badge and a disabled add-to-cart; it is excluded when `inStockOnly=true`
  and is rejected at add-to-cart/checkout (`MKT_004`).
- A listing that loses visibility **after** being carted is surfaced as an invalid cart line
  (cart_checkout §3.1) and blocks checkout until removed.
- Sellers see their **own** listings regardless of moderation state — but only inside the
  Merchant Hub (merchant_panel §3), never through the storefront endpoints.
- Buyers cannot purchase their **own** merchant listings (`MKT_012`, enforced at add-to-cart
  and re-checked at checkout).

---

## 5. Frontend — storefront (user-dev)

### 5.1 Route map

Routed pages under the authenticated `AppShell` (`src/App.tsx`); the mock's single
`marketplace` route with internal tab-switching is replaced:

| Route | Page | Purpose |
|-------|------|---------|
| `/app/marketplace` | `MarketplacePage` | Storefront: category rail + search + sort + product grid |
| `/app/marketplace/products/:id` | `ProductDetailPage` | Product detail (gallery + video + sticky add-to-cart) |
| `/app/marketplace/checkout` | `CheckoutPage` | see [`cart_checkout.md`](../cart_checkout/cart_checkout.md) §6 |
| `/app/marketplace/orders` | `MyOrdersPage` | see cart_checkout §6 |
| `/app/marketplace/orders/:id` | `OrderDetailPage` | see cart_checkout §6 |
| `/app/merchant` | `MerchantHubPage` | see [`merchant_panel.md`](../merchant_panel/merchant_panel.md) §6 — **independent nav item** |

The cart itself is a **drawer** overlaid on any marketplace route (cart_checkout §6.1), not a
route.

State: a server-backed **`marketplaceStore`** (zustand) + **`marketplace.service.ts`** (typed
REST client for §3 + cart_checkout §3). No `localStorage` product/cart persistence — see §6.

### 5.2 Storefront page (`/app/marketplace`)

- **Header band** — title, short subline, a **cart button with a live line-count badge**
  (opens the cart drawer), and a compact link chip to "My orders". No merchant tab (§6).
- **Category rail** — left sidebar on `lg+`, horizontally scrollable chip row on mobile.
  Fed live by `GET /marketplace/categories`; "All" first; each entry shows `productCount`;
  active entry highlighted with the primary token. Selecting a category re-queries
  `GET /marketplace/products?category=…` (server-side filter — no client-side filtering of a
  full list).
- **Search + sort bar** — debounced (350 ms) search input (`q`), a sort select
  (`Newest · Price ↑ · Price ↓ · Popular`), and an "In stock only" toggle. All reflected in
  the URL query string (shareable/back-button-safe).
- **Product grid** — responsive: 1 col (mobile) / 2 (`sm`) / 3 (`lg`) / 4 (`xl`). **Product
  card:** first image (`aspect-[4/3]`, `object-cover`, lazy-loaded, rounded-2xl) with the
  category chip overlaid top-left and an out-of-stock overlay when depleted; name (2-line
  clamp); seller badge (§5.4); price `₦18,500` (font-mono, primary token) with `/unit`
  subline; stock hint ("45 left" / low-stock amber under 10 / "Out of stock" rose);
  **Add-to-cart button** (optimistic `POST /marketplace/cart/items`, success micro-animation
  on the cart badge) — swaps to a quantity stepper when the product is already in the cart.
  Whole card (except the button) navigates to the detail page.
- **Pagination** — "Load more" (infinite-append) using `page`/`limit`; keep the header/rail
  sticky while the grid scrolls.

### 5.3 Product detail page (`/app/marketplace/products/:id`)

Two-column on `lg+` (media left, purchase panel right), stacked on mobile:

- **Media gallery** — main viewer (`aspect-[4/3]`, rounded-3xl) + thumbnail strip of up to
  **3 images and the video** (video thumb shows a play glyph). Selecting the video swaps the
  viewer to a native HTML5 `<video controls preload="metadata">` player using
  `video.url` (public GCS URL). Keyboard navigable (←/→), swipe on touch. No external player
  dependency.
- **Purchase panel** — name (display font), category chip, seller badge (§5.4), price block
  (large `₦` figure + `/unit`), stock line, quantity stepper (1 … `stock.available`,
  clamped), and the primary **"Add to basket"** CTA. On mobile the CTA is a **sticky bottom
  bar** (safe-area padded) showing price × qty and the add button.
- **Description** — full description below (preserve line breaks); "About the seller" card
  for MERCHANT listings (business name, member-since).
- **Already-in-cart state** — when `inCart` is set, the CTA becomes a stepper +
  "View basket" secondary action.
- **Unavailable state** — `MKT_001` renders a friendly "This product is no longer available"
  panel with a back-to-marketplace CTA (covers unapproved/suspended/deleted without leaking
  why).

### 5.4 Seller badge (shared component)

- `PLATFORM` → filled primary chip, storefront name, a small verified-store glyph.
- `MERCHANT` → outlined amber chip with the merchant business name.
Used identically on cards, the detail page, cart lines, and per-seller order groups
(cart_checkout §6).

### 5.5 Premium UI/UX & theme-token requirements

The storefront must read as a **premium, calm commerce surface** and must be built entirely on
the app's **semantic theme tokens** so light/dark both work with zero hardcoded hex:

- **Tokens (from `src/index.css`):** page `bg-canvas`; cards/drawers `bg-surface` with
  `border-border`; inset zones `bg-surface-2`; primary text `text-ink`; secondary
  `text-muted`; brand/price accents `text-primary` / `bg-primary`; merchant accents via the
  amber scale with `dark:` variants (following the existing mock's dark-safe pairings).
  **No raw `#hex` or non-token Tailwind grays.**
- **Shape & depth:** rounded-2xl/3xl cards, 1px token borders, soft shadows on hover only
  (`hover:shadow-xl hover:border-primary/20`), 200–300 ms ease transitions.
- **Type:** display font for page/product titles, `font-mono` for all ₦ figures, 2-line
  clamps on card copy.
- **Interaction:** every actionable element has hover, focus-visible ring
  (`focus:ring-2 ring-primary/20`), and disabled styles; add-to-cart gives instant optimistic
  feedback with rollback + toast on API failure.
- **Responsive:** flawless at 360 px, 768 px, 1024 px, 1440 px; touch targets ≥ 40 px; the
  mobile sticky CTA never overlaps content.
- **Accessibility:** semantic headings, `alt` from product name + index, gallery buttons
  labelled, color never the sole status signal (badges carry text).

### 5.6 States (mandatory)

| State | Rendering |
|-------|-----------|
| **Loading** | Skeletons — rail: 6 shimmer rows; grid: 8 card skeletons (image block + 2 text bars + price bar); detail: gallery + panel skeleton. Never a blank page or spinner-only full screen. |
| **Empty (no products)** | Illustration glyph + "No products found" + clear-filters action (mirrors the mock's empty card, tokenized). |
| **Empty (no categories)** | Rail collapses to "All" only; grid unaffected. |
| **Error** | Inline retry panel (message + "Try again" re-fires the query); toast for background refresh failures. |
| **Offline / API down** | Full-surface error panel — **no fallback to seed data** (the mock seeds are removed, §6). |

---

## 6. Supersession of the client mock (locked — removed, not kept as fallback)

The following are **superseded and removed** by this spec set (`user-dev` deletes them in the
same change that ships the live pages):

| Mock artifact | Replacement |
|---------------|-------------|
| `src/pages/users/AgriculturalMarketplaceView.tsx` — Buy / Track Orders / Merchant Portal tabbed monolith | Routed pages: storefront + detail (this doc §5), checkout/orders (cart_checkout §6), Merchant Hub (merchant_panel §6). **The Merchant Portal tab is removed from the marketplace entirely** — merchant work lives only at `/app/merchant`. |
| `Product`, `CartItem`, `ProductOrder`, `ProductCategoryName` in `src/types.ts` (lines ~203–248) | Server DTO types in the marketplace/merchant service clients (mirroring §2, cart_checkout §2, merchant_panel §2) |
| `DEFAULT_PRODUCTS`, `DEFAULT_ORDERS` seeds in `src/default_marketplace_data.ts` (+ the appStore back-fill guards for `products`/`orders`/`cart`) | Live API — no seed fallback |
| appStore marketplace handlers (`handleAddToCart`, `handleUpdateCartQty`, `handleRemoveFromCart`, `handleCheckoutMarketplace`, `handleMerchantAddProduct`, `handleMerchantUpdateStock`, `handleMerchantUpdateOrderStatus` — `src/store/appStore.ts` ~1485–1700) and the `products`/`orders`/`cart` slices of `FarmerAppState` | Server-side cart + orders (cart_checkout), merchant endpoints (merchant_panel); new `marketplaceStore`/`merchantStore` hold **server data only** |
| Mock wallet coupling — checkout appended a client `appendTx` "withdraw" against `state.walletBalance` | Real `WalletService.debitForPayment` on the backend; the UI reads the live wallet (PRD 02) |
| Hardcoded `farmerId: "aliyu_coop"` order filtering | Orders scoped server-side to the JWT caller |

> ⚠️ **Drift flags for the owner / other docs:**
> 1. The **legacy body of this PRD** (generic `sellerId ref User`, `slug`, `bulkPricing`,
>    `shippingOptions`, ratings, `trackingInfo`, order `paymentStatus: PENDING|PAID|REFUNDED|FAILED`,
>    seller endpoints under `/api/v1/seller/*`) is **fully superseded** by this three-document
>    set — ratings/reviews, bulk pricing, and shipping options are **out of scope this phase**
>    (see §9 open questions).
> 2. `notification.md`'s Triggers Matrix lists a planned `order.status` event for PRD 08 —
>    the canonical event keys are now the `marketplace.order.*` / `merchant.*` families
>    (cart_checkout §5, merchant_panel §5). Flagged for the notification doc's owner.
> 3. `data_structure.md` §1.9 (mock marketplace state) becomes historical; §11 (LIVE
>    marketplace collections, admin-docs-agent-owned) must match §2 here, cart_checkout §2,
>    and merchant_panel §2 — reconcile there, not by forking schemas.

---

## 7. Validation & error codes (storefront)

**Validation:**
- `q` ≤ 100 chars; `page` ≥ 1; `limit` 1–100; `sort` ∈ the §3.2 enum; `category` a valid
  ObjectId (unknown → empty result set, not an error).
- `:id` valid ObjectId; not found **or not visible** → `MKT_001` (404).

**Error envelope:**
```json
{ "success": false, "error": { "code": "MKT_001", "message": "Product not found", "details": {} } }
```

| Code | HTTP | Meaning |
|------|------|---------|
| `MKT_001` | 404 | Product not found or not visible to buyers (§4 — no moderation-state leakage) |
| `MKT_002` | 404 | Category not found / inactive |

(The remaining `MKT_0xx` cart/checkout codes are defined in
[`cart_checkout.md`](../cart_checkout/cart_checkout.md) §7 — one shared `MKT_` namespace, no
number reuse.)

---

## 8. Acceptance criteria

1. `GET /marketplace/categories` returns exactly the active admin-managed categories, ordered
   by `sortOrder`, with accurate visible-product counts; the 8 locked names are seeded.
2. `GET /marketplace/products` never returns a product failing any §4 visibility rule — a
   `PENDING`/`REJECTED`, `INACTIVE`, suspended, deleted, or inactive-category product is
   absent from list, search, and detail (detail → `MKT_001` 404).
3. Search (`q`), category filter, all four sorts, `inStockOnly`, and pagination work
   server-side and are combinable; results are stable and deterministic for a fixed dataset.
4. Product detail returns full embedded `FileMetadata` for up to 3 images + 1 video, and a
   correct `inCart` echo for the calling user.
5. Out-of-stock products render visibly with a disabled add-to-cart; add-to-cart for them is
   rejected server-side (`MKT_004`, cart_checkout).
6. A merchant browsing the storefront cannot see their own non-visible listings there and
   cannot add their own listings to cart (`MKT_012`).
7. The storefront UI uses only semantic theme tokens (verified in both light and dark),
   renders skeleton/empty/error states per §5.6, and passes a 360 px-width visual check.
8. The mock artifacts in §6 are deleted; `npm run lint` (tsc) passes with no dangling
   references to `Product`/`CartItem`/`ProductOrder`/`DEFAULT_PRODUCTS`.

---

## 9. Environment variables

```bash
# Storefront / catalogue (backend)
MARKETPLACE_PLATFORM_STORE_NAME="Bennie Cooperative Store"   # seller.displayName for PLATFORM listings
MARKETPLACE_LOW_STOCK_THRESHOLD=10                           # UI low-stock hint threshold (echoed to client)
```

(Checkout/fee/order variables live in cart_checkout §9; merchant/KYC/payout variables in
merchant_panel §9.)

---

## 10. Open questions for the owner

1. **Ratings & reviews.** The legacy PRD had product ratings; the locked scope drops them.
   Confirm reviews stay out of scope this phase (the card/detail specs reserve no rating UI).
2. **Delivery fees.** Checkout charges product totals only — no shipping/delivery fee line
   (cart_checkout §4). Confirm deliveries are settled off-platform between seller and buyer
   this phase.
3. **PLATFORM storefront name.** Defaulted via `MARKETPLACE_PLATFORM_STORE_NAME`; confirm the
   display name (and whether it should instead come from the admin `settings` collection).

---

## 11. Relevant files

- `PRD/user_module/ecommerce-marketplace/ecommerce-marketplace.md` (this file)
- `PRD/user_module/cart_checkout/cart_checkout.md` · `PRD/user_module/merchant_panel/merchant_panel.md`
- `PRD/admin_module/marketplace/marketplace.md` (admin side — categories, moderation, PLATFORM orders)
- `PRD/data_structure.md` §11 (canonical LIVE schemas) · §1.9 (mock, historical)
- `PRD/user_module/wallet/digital-wallet-seerbit.md` · `PRD/notification.md` · `PRD/gcp_upload.md`
- `src/pages/users/AgriculturalMarketplaceView.tsx` · `src/types.ts` · `src/default_marketplace_data.ts` · `src/store/appStore.ts` (mock being removed)
- `backend/src/wallet/wallet.service.ts` (✅ `debitForPayment` / `creditRefund`)
