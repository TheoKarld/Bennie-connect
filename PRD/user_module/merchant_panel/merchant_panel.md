# PRD 08b: Merchant Hub — Onboarding, Listings, Fulfilment & Earnings (User)

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded · ⚠️ drift / reconciliation flag
>
> **Overall module status: 📄.** Part 3 of the three-document marketplace set
> (storefront: [`ecommerce-marketplace.md`](../ecommerce-marketplace/ecommerce-marketplace.md);
> cart/checkout/orders: [`cart_checkout.md`](../cart_checkout/cart_checkout.md)).
>
> **Owner-locked:** the Merchant Hub is an **independent section at `/app/merchant`** — a new
> nav item in the user shell, **not** a tab inside the marketplace. The mock's amber
> **"Merchant Portal" tab** inside `src/pages/users/AgriculturalMarketplaceView.tsx` is
> **REMOVED** (see §6.6). Any authenticated user may open the Hub and start onboarding; only
> **APPROVED** merchants can create/manage products.
>
> **Admin side** (KYC review + final decision, listing moderation, payout mark-sent, merchant
> suspension) lives in the admin PRDs — the merchants spec under `PRD/admin_module/`
> (being authored concurrently by the admin docs agent) and
> [`PRD/admin_module/marketplace/marketplace.md`](../../admin_module/marketplace/marketplace.md)
> — and is **not redefined here**. Uploads:
> [`PRD/gcp_upload.md`](../../gcp_upload.md). Notifications:
> [`PRD/notification.md`](../../notification.md). Canonical schemas:
> [`PRD/data_structure.md`](../../data_structure.md) §11 (wins on disagreement).

---

## 1. Overview

The Merchant Hub turns a regular user into a seller through a **status-driven onboarding
state machine**, then gives approved merchants four working surfaces: **Products** (create/
edit listings with media upload + per-listing moderation), **Orders** (advance fulfilment of
their own orders), **Earnings** (ledger + available balance), and **Payouts** (manual,
adashe-style: request → admin marks sent → merchant confirms received).

### 1.1 Merchant lifecycle (locked)

```
 NOT_STARTED ──"Become a merchant"──► IN_PROGRESS ──submit KYC──► PENDING_REVIEW
 (no merchants doc)                    (KYC being filled)               │ admin reviews
                                            ▲                           ▼
                                            │ resubmit          APPROVED ◄────► SUSPENDED (admin action;
                                            │                       │            reinstate returns to APPROVED)
                                        REJECTED ◄──────────────────┘? (no — REJECTED only from PENDING_REVIEW)
```

- `NOT_STARTED` is virtual — no `merchants` document exists yet; `GET /merchant/me` reports it.
- `IN_PROGRESS` — a draft exists; business info / ID / docs are being filled (multi-visit safe).
- `PENDING_REVIEW` — submitted; **read-only** for the merchant until the admin decides.
- `APPROVED` — full Hub unlocked (sell, fulfil, earn, request payouts).
- `REJECTED` — decision + `rejectionReason` shown; **resubmission allowed** (→ back to
  `IN_PROGRESS` on edit, `PENDING_REVIEW` on resubmit; documents must be re-uploaded — the
  previous ones were purged, §4.3).
- `SUSPENDED` — admin kill-switch: all the merchant's listings are hidden from buyers
  (storefront visibility rules), selling actions are blocked (`MERCH_016`), **existing orders
  can still be fulfilled** and earnings/payout history remains readable. Admin reinstate → `APPROVED`.

### 1.2 Conventions

Shared with the set: base `/api/v1`, user `JwtAuthGuard`, whole NGN, `{ success, data }`
envelope, serialized `id` strings, `MERCH_` error codes, ISO-8601 UTC.

---

## 2. Collections / Schema

### 2.1 `merchants` 📄

One per user (unique). Created on first `POST /merchant/kyc` draft-save.

```typescript
{
  _id: ObjectId;
  userId: ObjectId;                    // ref users — unique
  status: 'IN_PROGRESS' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

  businessInfo: {
    businessName: string;              // 3–80 chars — the storefront display name
    businessAddress: string;           // 10–200 chars
    state: string;                     // Nigerian state
    lga?: string;
    phoneNumber: string;               // Nigerian format, e.g. +234…
    description?: string;              // 0–500 chars
    cacNumber?: string;                // optional — registered businesses (RC/BN number)
  };

  kyc: {
    idType: 'NIN' | 'BVN' | 'DRIVERS_LICENSE' | 'VOTERS_CARD' | 'INTL_PASSPORT';
    idNumber: string;                  // stored server-side; ALWAYS masked in API responses (e.g. "•••••••1234")
    documents: [{                      // PRIVATE uploads (§4.3); emptied after purge
      label: 'ID_FRONT' | 'ID_BACK' | 'SELFIE_WITH_ID';
      file: FileMetadata;              // full embedded FileMetadata (private visibility)
    }];
    docsPurgedAt?: Date;               // set when GCS objects were purged post-decision
    prembly: {                         // server-side advisory check (§4.2)
      status: 'VERIFIED' | 'NOT_VERIFIED' | 'ERROR' | 'SKIPPED';
      matchedName?: string;            // name returned by the identity source
      checkedAt?: Date;
      summary?: Record<string, any>;   // trimmed provider response (no raw PII dump)
    };
  };

  submittedAt?: Date;                  // last transition into PENDING_REVIEW
  reviewedBy?: ObjectId;               // ref adminUsers
  reviewedAt?: Date;
  rejectionReason?: string;            // shown to the merchant on REJECTED
  suspensionReason?: string;
  suspendedAt?: Date;
  resubmissionCount: number;           // default 0; +1 per resubmit

  earnings: {                          // maintained counters; merchantEarnings + payouts are the source of truth
    totalEarned: number;               // whole NGN — sum of booked ORDER_NET rows
    totalPaidOut: number;              // sum of CONFIRMED_RECEIVED payouts
    available: number;                 // totalEarned − (payouts in REQUESTED|MARKED_SENT|CONFIRMED_RECEIVED)
  };

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** unique `{ userId: 1 }`; `{ status: 1 }` (admin review queue);
`{ 'businessInfo.businessName': 1 }`.

### 2.2 `merchantEarnings` 📄 (append-only ledger)

One row per **DELIVERED** MERCHANT order (cart_checkout §4.3 books it at the `DELIVERED`
transition, guarded by `orders.earningsBooked`).

```typescript
{
  _id: ObjectId;
  merchantId: ObjectId;                // ref merchants
  orderId: ObjectId;                   // ref orders — UNIQUE (one booking per order, idempotency backstop)
  orderNumber: string;                 // denormalized for display
  type: 'ORDER_NET';                   // single type this phase
  grossAmount: number;                 // order totalAmount (whole NGN)
  platformFeePercent: number;          // snapshot from the order
  platformFee: number;
  netAmount: number;                   // grossAmount − platformFee — what the merchant earns
  bookedAt: Date;
  createdAt: Date;
}
```

**Indexes:** unique `{ orderId: 1 }`; `{ merchantId: 1, createdAt: -1 }`.

### 2.3 `merchantPayoutRequests` 📄 (manual, adashe-style)

```typescript
{
  _id: ObjectId;
  merchantId: ObjectId;                // ref merchants
  amount: number;                      // whole NGN; >= MERCHANT_MIN_PAYOUT_NGN, <= earnings.available at request
  bankDetails: {                       // merchant-entered at request; the admin wires off-platform
    bankName: string;
    accountNumber: string;             // 10 digits (NUBAN)
    accountName: string;
  };
  status: 'REQUESTED' | 'MARKED_SENT' | 'CONFIRMED_RECEIVED' | 'CANCELLED';
  requestedAt: Date;
  markedSentBy?: ObjectId;             // ref adminUsers
  markedSentAt?: Date;
  paymentReference?: string;           // admin-entered bank/transfer reference at mark-sent
  confirmedAt?: Date;                  // merchant confirm-received → settled
  cancelledBy?: 'merchant' | 'admin';
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** `{ merchantId: 1, createdAt: -1 }`; `{ status: 1 }` (admin queue of `REQUESTED`).

> The **product** collection (with `moderationStatus`, media rules, `seller.merchantId`) is
> defined in the storefront doc §2.1 — not repeated here.

---

## 3. API Endpoints (user plane)

Bases `/api/v1/merchant`, `JwtAuthGuard` (`scope: "user"`). Endpoints marked **(APPROVED)**
require `merchants.status === 'APPROVED'` (`MERCH_002`; `SUSPENDED` → `MERCH_016`, except
where noted). Admin actions (`/api/v1/admin/merchants/*`, `/api/v1/admin/marketplace/*`) are
on the admin plane.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/merchant/me` | Lifecycle status + profile + earnings summary — §3.1 |
| `POST` | `/merchant/kyc` | Save/submit (and resubmit) the KYC application — §3.2 |
| `GET` | `/merchant/kyc/documents/:fileId/url` | Short-lived signed URL for an own KYC doc — §3.3 *(additive)* |
| `GET` | `/merchant/products` | The merchant's listings (all moderation states) **(APPROVED)** |
| `POST` | `/merchant/products` | Create a listing → `moderationStatus: PENDING` **(APPROVED)** — §3.4 |
| `PATCH` | `/merchant/products/:id` | Edit a listing (re-moderation rules §4.4) **(APPROVED)** |
| `DELETE` | `/merchant/products/:id` | Soft-delete a listing **(APPROVED)** |
| `GET` | `/merchant/orders` | Orders received on the merchant's listings **(APPROVED; readable while SUSPENDED)** — §3.5 |
| `PATCH` | `/merchant/orders/:id/fulfillment` | Advance own order `PENDING→PROCESSING→SHIPPED→DELIVERED` — §3.6 |
| `GET` | `/merchant/earnings` | Ledger + balances **(APPROVED; readable while SUSPENDED)** — §3.7 |
| `GET` | `/merchant/payout-requests` | Payout history *(additive)* |
| `POST` | `/merchant/payout-requests` | Request a payout from `earnings.available` **(APPROVED)** — §3.8 |
| `POST` | `/merchant/payout-requests/:id/cancel` | Cancel own payout while `REQUESTED` *(additive)* |
| `POST` | `/merchant/payout-requests/:id/confirm-received` | Confirm the wired payout — §3.9 |

### 3.1 `GET /merchant/me`

Never 404s — reports `status: "NOT_STARTED"` when no `merchants` doc exists.

**Response 200 (approved merchant):**
```json
{
  "success": true,
  "data": {
    "status": "APPROVED",
    "merchantId": "mch_1",
    "businessInfo": { "businessName": "Shola Organic Farms", "state": "Oyo", "phoneNumber": "+2348012345678", "cacNumber": "RC1234567" },
    "kyc": {
      "idType": "NIN",
      "idNumberMasked": "•••••••1234",
      "prembly": { "status": "VERIFIED", "checkedAt": "2026-07-01T10:05:00Z" },
      "documents": [],
      "docsPurgedAt": "2026-07-01T12:00:00Z"
    },
    "rejectionReason": null,
    "earnings": { "totalEarned": 152000, "totalPaidOut": 100000, "available": 52000, "pendingPayout": 0 },
    "counts": { "products": 6, "pendingModeration": 1, "openOrders": 3 },
    "reviewedAt": "2026-07-01T11:58:00Z"
  }
}
```

- `kyc.idNumber` is **always masked**; the raw number is never returned on any plane response
  after submission.
- While `IN_PROGRESS`/`PENDING_REVIEW`/`REJECTED`, `documents[]` echoes the uploaded doc
  labels + `FileMetadata` **ids** (viewing is via §3.3 signed URLs, never a public `url`).

### 3.2 `POST /merchant/kyc` — save / submit / resubmit

One endpoint, two modes via `submit`:

**Request:**
```json
{
  "submit": true,
  "businessInfo": {
    "businessName": "Shola Organic Farms",
    "businessAddress": "12 Ring Road, Ibadan",
    "state": "Oyo",
    "lga": "Ibadan South-West",
    "phoneNumber": "+2348012345678",
    "description": "Organic produce and inputs.",
    "cacNumber": "RC1234567"
  },
  "kyc": {
    "idType": "NIN",
    "idNumber": "12345678901",
    "documents": [
      { "label": "ID_FRONT", "fileId": "fil_77" },
      { "label": "SELFIE_WITH_ID", "fileId": "fil_78" }
    ]
  }
}
```

- `submit: false` (or omitted) → **draft save**: upserts the doc as `IN_PROGRESS`; partial
  bodies allowed; no Prembly call.
- `submit: true` → validates completeness (§7), runs the **Prembly check server-side**
  (§4.2 — advisory, its failure does **not** block submission), sets `PENDING_REVIEW` +
  `submittedAt`, notifies admins (§5).
- Allowed from `NOT_STARTED`/`IN_PROGRESS`/`REJECTED` only (`MERCH_003` from
  `PENDING_REVIEW`/`APPROVED`/`SUSPENDED`). A resubmit from `REJECTED` increments
  `resubmissionCount` and **requires fresh document uploads** (the old ones were purged —
  `fileId`s referencing purged files → `MERCH_005`).
- `documents[].fileId` must be `files` records **uploaded by the caller** with
  `visibility: 'private'` (§4.3); public-bucket files are rejected (`MERCH_005`).

**Response 200:** the §3.1 payload (now `PENDING_REVIEW`).

### 3.3 `GET /merchant/kyc/documents/:fileId/url`

Returns a **short-lived V4 signed URL** for one of the **caller's own** KYC documents
(owner-scoped: the file must belong to the caller's merchant application; anything else →
404, no leakage).

**Response 200:** `{ "url": "https://storage.googleapis.com/…&X-Goog-Signature=…", "expiresAt": "2026-07-03T09:10:00Z" }`

- TTL `KYC_SIGNED_URL_TTL_SECONDS` (default 600 s).
- After purge (§4.3) → `MERCH_017` ("Document no longer stored — it was removed after
  review").
- The admin plane has its own signed-URL route for review (admin merchants PRD).

### 3.4 `POST /merchant/products` (and `PATCH`/`DELETE`)

**Create request:**
```json
{
  "name": "Fresh Yellow Habanero Peppers",
  "description": "Freshly harvested under cooperative sorting standards…",
  "categoryId": "cat_8",
  "price": 15000,
  "unit": "30kg Basket",
  "stock": 12,
  "images": [ { "id": "fil_10", "url": "…", "…": "full FileMetadata" } ],
  "video": { "id": "fil_11", "url": "…", "…": "full FileMetadata" }
}
```

- Creates the product with `seller: { type: 'MERCHANT', merchantId }`,
  `moderationStatus: 'PENDING'`, `status: 'ACTIVE'`, `stock.available = stock`. **Not
  buyer-visible until an admin approves** (storefront §4). Notifies admins
  (`merchant.listing.submitted`).
- Media (locked): `images` 1–3 + optional single `video`, uploaded beforehand through the
  existing user upload service (`POST /api/v1/upload`, public bucket, with progress); the
  full `FileMetadata` JSON is embedded. Violations → `MERCH_009`. Active-listing cap
  `MERCHANT_MAX_ACTIVE_LISTINGS` → `MERCH_007`.
- **`PATCH`** — edit rules in §4.4 (content edits re-enter moderation; stock/status toggles
  don't). **`DELETE`** — soft delete (`deletedAt`); hidden everywhere; order snapshots are
  unaffected (orders embed item copies).

**Merchant list response** (`GET /merchant/products`) returns **all** own listings with
`moderationStatus`, `moderationNote`, `isSuspended`, and stock — including `PENDING` and
`REJECTED` ones the storefront never shows.

### 3.5 `GET /merchant/orders`

Orders where `seller.merchantId` = the caller's merchant. Query: `status`, `page`, `limit`
(default 20, max 100), newest first. Each row: `orderNumber`, buyer display name (first name
+ initial — no buyer contact details beyond the delivery address), items, `totalAmount`,
`platformFee`, `merchantNet`, `status`, `deliveryAddress`, timestamps.

### 3.6 `PATCH /merchant/orders/:id/fulfillment`

**Request:** `{ "status": "SHIPPED" }`

- Guarded transitions (cart_checkout §4.3): exactly one step forward along
  `PENDING → PROCESSING → SHIPPED → DELIVERED`; anything else → `MERCH_010`. Not the
  caller's order → `MERCH_011` (404 semantics). `CANCELLED` orders are immutable.
- `DELIVERED` sets `deliveredAt` and **books earnings once** (§4.5); repeat calls are
  rejected by the transition guard, and the unique `merchantEarnings.orderId` index is the
  idempotency backstop.
- Appends the `timeline` entry (`by: 'merchant'`) and notifies the buyer
  (`marketplace.order.status`).
- Allowed while `SUSPENDED` (existing orders must still reach buyers) — but not while the
  merchant application is anything other than APPROVED/SUSPENDED.

### 3.7 `GET /merchant/earnings`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalEarned": 152000,
      "totalPaidOut": 100000,
      "pendingPayout": 0,
      "available": 52000,
      "platformFeePercent": 5
    },
    "entries": [
      {
        "id": "mel_9", "orderId": "ord_1", "orderNumber": "ORD1751540000X1",
        "grossAmount": 37000, "platformFee": 1850, "netAmount": 35150,
        "bookedAt": "2026-07-05T16:20:00Z"
      }
    ],
    "total": 14, "page": 1, "limit": 20
  }
}
```

- `available = totalEarned − Σ(payouts in REQUESTED | MARKED_SENT | CONFIRMED_RECEIVED)` —
  requesting a payout immediately holds that amount (a `CANCELLED` payout releases it).
- The earnings ledger is **not** the wallet — no `Transaction` rows are written; payout money
  moves off-platform (§4.6).

### 3.8 `POST /merchant/payout-requests`

**Request:**
```json
{
  "amount": 50000,
  "bankDetails": { "bankName": "GTBank", "accountNumber": "0123456789", "accountName": "Shola Farms Ltd" }
}
```

- `amount` ≥ `MERCHANT_MIN_PAYOUT_NGN` (`MERCH_018`) and ≤ `earnings.available`
  (`MERCH_012`). Only **one open** request (`REQUESTED`/`MARKED_SENT`) at a time
  (`MERCH_015`).
- Creates `status: 'REQUESTED'`, holds the amount, **notifies admins**
  (`merchant.payout.requested`).

**Response 201:** the payout doc + refreshed `summary`.

### 3.9 `POST /merchant/payout-requests/:id/confirm-received`

- Only the owning merchant, only from `MARKED_SENT` (`MERCH_014`). Sets
  `CONFIRMED_RECEIVED` + `confirmedAt`, moves the held amount into `totalPaidOut`
  (settled), notifies admins (`merchant.payout.confirmed`). Idempotent repeat → 200 no-op.
- The **admin step** between request and confirm lives on the admin plane: admin wires the
  money off-platform, then marks sent with a `paymentReference` → merchant is notified
  (`merchant.payout.marked_sent`) and sees the reference in the Hub.

---

## 4. Business logic

### 4.1 Onboarding state machine (locked)

Transitions and their actors:

| From | To | Actor | Trigger |
|------|----|-------|---------|
| NOT_STARTED | IN_PROGRESS | user | first `POST /merchant/kyc` (draft or submit) |
| IN_PROGRESS | PENDING_REVIEW | user | `submit: true` (validation + Prembly advisory) |
| PENDING_REVIEW | APPROVED | admin | KYC approve (admin plane) → **doc purge** (§4.3), notify merchant |
| PENDING_REVIEW | REJECTED | admin | KYC reject + `rejectionReason` → **doc purge** (§4.3), notify merchant |
| REJECTED | IN_PROGRESS / PENDING_REVIEW | user | edit / resubmit (fresh docs required; `resubmissionCount++`) |
| APPROVED | SUSPENDED | admin | suspend + reason — listings hidden, selling blocked |
| SUSPENDED | APPROVED | admin | reinstate — listings restored to their own moderation/status state |

While `PENDING_REVIEW` the application is read-only for the user (`MERCH_003`). There is no
user-facing delete of a merchant profile this phase (open question §10.4).

### 4.2 Prembly ID verification (advisory — admin decides)

On `submit: true` the backend verifies `kyc.idNumber` against the matching **Prembly
Identitypass** data-verification endpoint (server-side; the API key never reaches the
browser):

| `idType` | Prembly product |
|----------|-----------------|
| `NIN` | NIN verification |
| `BVN` | BVN verification |
| `DRIVERS_LICENSE` | Driver's licence (FRSC) verification |
| `VOTERS_CARD` | Voter's card VIN lookup |
| `INTL_PASSPORT` | International passport verification |

Sources: Prembly Identitypass developer docs — base
`https://api.myidentitypass.com` with `x-api-key`/`app-id` headers
([developer.myidentitypass.com](https://developer.myidentitypass.com/products/data-verification/nigeria/bvn-verification/bvn-1-1)
— BVN 2.0; [driver's licence](https://developer.myidentitypass.com/products/data-verification/nigeria/drivers-license/frsc-1);
[voter's card VIN](https://developer.myidentitypass.com/products/data-verification/nigeria/voters-card-verification/voters-card-1);
[NIN](https://docs.prembly.com/docs/nin-and-virtual-nin-copy)). Exact endpoint paths must be
pinned against the live Prembly account before go-live (⚠️ they vary by product/version).

Behaviour (locked):
- The result is **advisory**: `prembly.status = 'VERIFIED' | 'NOT_VERIFIED' | 'ERROR'` +
  `matchedName` + trimmed `summary` are stored for the reviewing admin, who makes the
  **final decision**. A `NOT_VERIFIED`/`ERROR` result does **not** block submission.
- **Graceful no-op** (house pattern, like `MailService`/`FcmService`): missing
  `PREMBLY_API_KEY` ⇒ `status: 'SKIPPED'`, logged warning, submission proceeds.
- Timeout/5xx from Prembly ⇒ `status: 'ERROR'`; the admin may re-run the check from the
  admin plane.
- `idNumber` format is validated locally first (§7) — a malformed number is a hard error
  (`MERCH_006`) before any provider call.

### 4.3 KYC documents — private bucket, signed URLs, purge-on-decision (locked)

- KYC document uploads go through the existing upload service with
  **`visibility: 'private'`** — stored in a **private GCS bucket**
  (`GCP_STORAGE_PRIVATE_BUCKET`), never publicly readable; the `files` row records
  `visibility: 'private'` and such files return **no public `url`**.
- Viewing is only via **short-lived V4 signed URLs**: owner-scoped on the user plane (§3.3),
  reviewer-scoped on the admin plane. TTL `KYC_SIGNED_URL_TTL_SECONDS` (default 600).
- **Purge-on-decision (locked):** when the admin issues the final decision — **approve OR
  reject** — the backend deletes the document objects from GCS **and** their `files` rows,
  empties `kyc.documents`, and sets `kyc.docsPurgedAt`. The verified **data** (idType, masked
  idNumber, Prembly result, business info, decision trail) lives on in the DB. Rejected
  merchants **re-upload** at resubmission.
- Data-minimization rationale: no long-lived ID images at rest (NDPR-aligned); the platform
  keeps only what it needs.

> ⚠️ **Drift flag — private storage is an extension, not yet built.** The implemented
> `StorageModule` (`backend/src/storage/gcs.service.ts` / `upload.service.ts`) supports a
> **single public bucket only** (`ensurePublic`, `allUsers:objectViewer`) and the frontend
> `src/services/upload.service.ts` has **no `visibility` option**. This PRD locks the owner's
> answer to `gcp_upload.md` Open Question 1 for KYC assets: **private bucket + V4 signed
> URLs + purge**. `backend-dev` must extend `GcsService`/`UploadService` (second bucket, a
> `visibility: 'public' | 'private'` upload option, `getSignedUrl`, hard-delete purge) and
> `user-dev` the client wrapper (`visibility` form field). `gcp_upload.md` and
> `data_structure.md` §10 are owned by the admin docs agent — flagged there for
> reconciliation, not edited here.

### 4.4 Listing moderation (locked)

```
 create/edit(content) ──► PENDING ──admin approve──► APPROVED (buyer-visible if ACTIVE & !suspended)
                             │
                             └──admin reject (+ note)──► REJECTED (merchant edits → PENDING again)
```

- **Every merchant create** and every **content edit** (`name`, `description`, `categoryId`,
  `unit`, `price`, `images`, `video`) resets `moderationStatus` to `PENDING` — the listing
  drops out of the storefront until re-approved (prevents bait-and-switch after approval).
- **Non-content changes** — `stock` adjustments and the `ACTIVE`/`INACTIVE` toggle — do
  **not** trigger re-moderation.
- Moderation decisions notify the merchant (`merchant.listing.decision`) with the listing
  deep link; a rejection carries the admin's `moderationNote`.
- Admin `isSuspended` (per-listing kill-switch) and merchant suspension both hide listings
  regardless of moderation state (storefront §4).
- In-flight orders are untouched by any listing change (orders hold snapshots).

### 4.5 Earnings booking (locked)

At an order's `DELIVERED` transition (merchant- or admin-driven), for MERCHANT orders only:

```
netAmount   = order.totalAmount − order.platformFee        // fee % snapshotted at checkout
insert merchantEarnings { orderId (unique), grossAmount, platformFee, netAmount, bookedAt: now }
merchants.earnings.totalEarned += netAmount
merchants.earnings.available   += netAmount
orders.earningsBooked = true
```

- Exactly-once: guarded by the `earningsBooked` flag **and** the unique
  `merchantEarnings.orderId` index.
- Booked at `DELIVERED` — **not** at buyer confirm-received (owner-locked). An admin
  cancellation after DELIVERED is not possible (terminal), so no clawback path exists this
  phase.
- The buyer's platform fee is **not** charged to the buyer — it is the deduction between
  gross and net here.

### 4.6 Payout lifecycle (manual, adashe-style — locked)

```
 merchant REQUESTS (amount ≤ available; amount held)
        │  → admins notified
        ▼
   REQUESTED ──admin wires off-platform + marks sent (paymentReference)──► MARKED_SENT
        │                                                                     │ merchant confirms in Hub
        │ merchant/admin cancel (hold released)                               ▼
        ▼                                                            CONFIRMED_RECEIVED (settled;
    CANCELLED                                                         totalPaidOut += amount)
```

- Mirrors the Adashe payout pattern (`adashesu-contributions.md` §4.2): no on-platform money
  movement — the ledger records the lifecycle, the admin wires funds off-platform.
- The requested amount is **held** (excluded from `available`) from `REQUESTED` until
  `CANCELLED` (released) — so a merchant cannot double-spend their balance across requests.
- One open request at a time (`MERCH_015`). `MARKED_SENT` cannot be cancelled by the
  merchant — disputes go to support/admin (open question §10.2).
- Every transition notifies per §5 and is admin-audit-logged on the admin plane.

---

## 5. Notifications (trigger matrix — locked)

Through the single `NotificationService` (persist + socket + FCM, best-effort) with deep
links (merchant links → `/app/merchant?tab=…`; admin links → the admin merchants/marketplace
queues).

| Event | `event` key | `type` | Recipients |
|-------|-------------|--------|------------|
| KYC submitted / resubmitted | `merchant.kyc.submitted` | `info` | admins |
| KYC decision — approved | `merchant.kyc.decision` | `success` | merchant |
| KYC decision — rejected (+ reason) | `merchant.kyc.decision` | `warning` | merchant |
| Merchant suspended / reinstated | `merchant.status.changed` | `warning`/`success` | merchant |
| Listing submitted for moderation | `merchant.listing.submitted` | `info` | admins |
| Moderation decision (approve/reject + note) | `merchant.listing.decision` | `success`/`warning` | merchant |
| New order on a listing | `marketplace.order.placed` | `info` | merchant + admins (cart_checkout §5) |
| Buyer cancelled a PENDING order | `marketplace.order.cancelled` | `warning` | merchant |
| Buyer confirmed received | `marketplace.order.confirmed_received` | `success` | merchant |
| Payout requested | `merchant.payout.requested` | `info` | admins |
| Payout **marked sent** (+ paymentReference) | `merchant.payout.marked_sent` | `success` | merchant |
| Payout confirmed received | `merchant.payout.confirmed` | `success` | admins |
| Payout cancelled | `merchant.payout.cancelled` | `info` | the other party |

---

## 6. Frontend — Merchant Hub (user-dev)

### 6.1 Entry & shell

- **Route `/app/merchant`**, new **"Merchant Hub"** nav item in the user `AppShell`
  (store-front icon, amber accent) — visible to **all** users; the page renders per
  `GET /merchant/me` status. Sub-navigation via a `?tab=` query
  (`overview | products | orders | earnings`), tabs only when `APPROVED`/`SUSPENDED`.
- All UI on semantic theme tokens (storefront §5.5); merchant identity uses the amber accent
  family with `dark:` variants (continuing the mock's merchant styling language).

### 6.2 Onboarding screens (status-driven)

| Status | Screen |
|--------|--------|
| `NOT_STARTED` | **Start** — value pitch card ("Sell on the cooperative marketplace"), requirements checklist (business info, government ID, documents), primary CTA "Start application". |
| `IN_PROGRESS` | **Stepper wizard** (progress saved via draft `POST /merchant/kyc`): ① Business info (name, address, state/LGA selects, phone, description, optional CAC) → ② ID verification (idType **picker**: NIN / BVN / Driver's licence / Voter's card / Int'l passport; number field with per-type format mask + helper) → ③ Document upload (private uploads with **progress bars**, per-label slots ID_FRONT / ID_BACK (optional per type) / SELFIE_WITH_ID; preview via signed URL) → ④ Review & submit (summary + consent note that ID will be verified and documents deleted after review). |
| `PENDING_REVIEW` | **Read-only status screen** — "Under review" hero, submitted summary (masked ID), submitted date. No edit actions. |
| `APPROVED` | Full Hub (§6.3–§6.5) + a one-time success banner. |
| `REJECTED` | **Decision screen** — rejection reason panel, what-to-fix hints, "Edit & resubmit" CTA (docs must be re-uploaded — show the purge explainer). |
| `SUSPENDED` | Amber lock banner with `suspensionReason`; Products tab read-only, Orders tab active (fulfilment allowed), Earnings readable, payout request disabled. |

### 6.3 Products tab

- Listing table/cards: thumbnail, name, price/unit, stock, **status chip pair** —
  `ACTIVE/INACTIVE` toggle + **moderation chip** (`PENDING` amber "Awaiting approval",
  `APPROVED` emerald "Live", `REJECTED` rose with the note on hover/expand) + a rose
  "Suspended by admin" chip when applicable.
- **Create/Edit modal or page**: fields per §3.4; category select fed by
  `GET /marketplace/categories`; **media manager** — up to 3 image slots + 1 video slot with
  drag-in upload, per-file progress (`onUploadProgress`), replace/remove; a persistent notice
  "Content edits send this listing back for approval" (§4.4).
- Inline stock stepper (no re-moderation) replacing the mock's ±5 buttons.

### 6.4 Orders tab

- Queue grouped by status with counts; order cards: `orderNumber`, buyer display name, items,
  `totalAmount` and **"you earn ₦{merchantNet}"** subline, delivery address, placed date.
- **Guarded advance control** — a single "Move to {next}" button per card (never a free
  select like the mock): PENDING→"Start processing", PROCESSING→"Mark shipped",
  SHIPPED→"Mark delivered" (confirm dialog: "This books ₦{merchantNet} to your earnings").
  DELIVERED/CANCELLED are terminal chips; buyer-confirmed shows a "Received ✓" chip.

### 6.5 Earnings tab

- Summary cards: **Available** (hero figure), Total earned, Paid out, Pending payout.
- Ledger table (per §3.7): order link, gross, fee, **net**, booked date.
- **Payout panel** — "Request payout" (amount + bank details form; min-amount hint;
  disabled with reason while a request is open or balance < minimum) and the payout history
  list with lifecycle chips `REQUESTED` (amber, cancellable) → `MARKED_SENT` (sky, shows the
  admin's `paymentReference`, prominent **"I have received this payment"** confirm CTA) →
  `CONFIRMED_RECEIVED` (emerald) / `CANCELLED` (gray).

### 6.6 Migration — the Merchant Portal tab is REMOVED (locked)

The mock marketplace's third tab ("Merchant Portal", `activeSegment === "merchant"` in
`AgriculturalMarketplaceView.tsx`, with its `merchantSubTab` inventory/list/orders views and
the `handleMerchantAddProduct` / `handleMerchantUpdateStock` /
`handleMerchantUpdateOrderStatus` appStore handlers) is **deleted** — not relocated as-is.
The marketplace page keeps **no merchant entry point** beyond an optional "Sell on the
marketplace" link-out card pointing to `/app/merchant`. The mock allowed any user to publish
instantly with no KYC, no moderation, and a global orders view (every user saw **all**
orders) — all three are corrected by this spec (KYC gate, per-listing moderation,
owner-scoped queries).

### 6.7 States

Skeletons per tab (form blocks, table rows, summary cards); empty states ("No listings yet —
create your first product", "No orders yet", "No earnings yet — deliver your first order");
upload failure states with `extractUploadError` messaging; error panels with retry. Light +
dark via tokens only.

---

## 7. Validation & error codes

**Validation:**
- `businessName` 3–80; `businessAddress` 10–200; `phoneNumber` valid Nigerian mobile
  (`+234` or `0` prefix, normalized to `+234…`); `description` ≤ 500; `cacNumber` optional,
  `RC`/`BN` + 5–8 digits.
- `idNumber` per type: NIN 11 digits; BVN 11 digits; driver's licence FRSC format
  (3 letters + 5 digits + 2 letters variant tolerated — pin against Prembly); voter's card
  VIN 19 alphanumerics; int'l passport `A` + 8 alphanumerics. Malformed → `MERCH_006`.
- `documents`: 1–3 entries, labels from the enum, `fileId`s owned by the caller, private
  visibility, image/PDF MIME only.
- Product fields per storefront §2.1 (name 3–120, description 10–2000, price integer ≥ 1,
  unit 1–40, stock integer ≥ 0, images 1–3, video ≤ 1).
- Payout: `amount` integer ≥ `MERCHANT_MIN_PAYOUT_NGN`; `accountNumber` 10 digits (NUBAN);
  `bankName`/`accountName` 2–80 chars.

**Error envelope:** `{ "success": false, "error": { "code": "MERCH_012", "message": "Insufficient earnings balance", "details": { "requested": 60000, "available": 52000 } } }`

| Code | HTTP | Meaning |
|------|------|---------|
| `MERCH_001` | 404 | Merchant profile not found (route needs an existing application) |
| `MERCH_002` | 403 | Action requires an APPROVED merchant |
| `MERCH_003` | 409 | KYC submit/edit not allowed in the current status |
| `MERCH_004` | 422 | Invalid/unsupported ID type |
| `MERCH_005` | 422 | Document set invalid (missing/mislabeled/not owned/not private/purged fileId) |
| `MERCH_006` | 422 | ID number fails the format for the chosen type |
| `MERCH_007` | 409 | Active-listing limit reached (`MERCHANT_MAX_ACTIVE_LISTINGS`) |
| `MERCH_008` | 404 | Product not found or not owned by this merchant |
| `MERCH_009` | 422 | Media rules violated (images 1–3, video ≤ 1, type/size) |
| `MERCH_010` | 409 | Invalid fulfilment transition (must be exactly one step forward) |
| `MERCH_011` | 404 | Order not found or not this merchant's order |
| `MERCH_012` | 409 | Payout exceeds available earnings balance |
| `MERCH_013` | 404 | Payout request not found (or not owned) |
| `MERCH_014` | 409 | Payout not in the required state for this action |
| `MERCH_015` | 409 | An open payout request already exists |
| `MERCH_016` | 403 | Merchant is suspended — selling actions blocked |
| `MERCH_017` | 410 | KYC document purged after review — no longer retrievable |
| `MERCH_018` | 422 | Payout below the minimum amount |

---

## 8. Acceptance criteria

1. `GET /merchant/me` correctly reports all six lifecycle states (incl. virtual
   `NOT_STARTED`) and never leaks another user's application; the Hub renders the matching
   §6.2 screen for each.
2. Draft saves persist partial applications across sessions; `submit: true` enforces
   completeness, runs Prembly (result stored, advisory — submission succeeds even on
   `NOT_VERIFIED`/`ERROR`/`SKIPPED`), flips to `PENDING_REVIEW`, and notifies admins.
3. KYC documents are stored **only** in the private bucket, are unreachable by public URL,
   are viewable by the owner solely via signed URLs that expire per TTL, and are **deleted
   from GCS (objects + `files` rows) on both approve and reject**, with `docsPurgedAt` set
   and `MERCH_017` returned thereafter.
4. A rejected merchant can resubmit; resubmission requires fresh document uploads and
   increments `resubmissionCount`.
5. Only APPROVED merchants can create/edit/delete listings; every create and content edit
   lands in `PENDING` moderation and is invisible to buyers until approved; stock/ACTIVE
   toggles skip re-moderation; media caps (3 images / 1 video, embedded FileMetadata) are
   enforced (`MERCH_009`).
6. The merchant order queue shows only own orders; fulfilment moves strictly one step
   forward with guarded transitions; `DELIVERED` books exactly one `merchantEarnings` row
   per order (`orderId` unique) computing `net = total − floor(total × fee% / 100)` from the
   order's snapshot.
7. Earnings math holds under sequences of bookings + payouts:
   `available = totalEarned − held/settled payouts`; a payout request holds its amount
   immediately; cancel releases it; only one open request at a time.
8. The payout lifecycle runs REQUESTED → MARKED_SENT (admin, with `paymentReference` visible
   to the merchant) → CONFIRMED_RECEIVED, with the §5 notifications firing at every step.
9. A suspended merchant's listings vanish from the storefront, selling actions return
   `MERCH_016`, yet order fulfilment and earnings/payout reads still work.
10. The marketplace view ships with **no Merchant Portal tab**; the mock's merchant handlers
    and their appStore state are deleted; `/app/merchant` is reachable from the main nav for
    every authenticated user.

---

## 9. Environment variables

```bash
# Merchant / KYC (backend)
MERCHANT_MAX_ACTIVE_LISTINGS=100
MERCHANT_MIN_PAYOUT_NGN=1000
KYC_SIGNED_URL_TTL_SECONDS=600

# Private KYC storage (extends the gcp group — see §4.3 drift flag)
GCP_STORAGE_PRIVATE_BUCKET=bennie-connect-private

# Prembly Identitypass (server-side only; graceful SKIPPED no-op when absent)
PREMBLY_BASE_URL=https://api.myidentitypass.com
PREMBLY_API_KEY=                        # x-api-key — owner supplies; keep out of VCS
PREMBLY_APP_ID=                         # app-id header — owner supplies
```

---

## 10. Open questions for the owner

1. **BVN as a KYC ID type.** BVN is in the locked picker, but BVN verification is
   consent-gated under CBN's iGree framework and is bank-data, not a photo ID — should BVN
   remain selectable alone, or require pairing with a photo ID document?
2. **Payout disputes.** A merchant who never receives a `MARKED_SENT` wire has no `DISPUTED`
   state (unlike Adashe's `payoutRequests`). Add one, or keep it a support/admin path?
3. **Fee-percent changes.** `PLATFORM_FEE_PERCENT` is snapshotted per order at checkout —
   confirm the fee should also be surfaced to merchants pre-listing (e.g. in the create
   modal) and whether it should move to the admin `settings` collection instead of env.
4. **Merchant offboarding.** No user-facing "close my merchant account" exists. Needed this
   phase (with rules for open orders/balances), or admin-only?
5. **Prembly product scope.** Confirm which Identitypass products are enabled on the owner's
   Prembly account (endpoints/paths vary by product & version) before `backend-dev` pins the
   integration.

---

## 11. Relevant files

- `PRD/user_module/merchant_panel/merchant_panel.md` (this file)
- `PRD/user_module/ecommerce-marketplace/ecommerce-marketplace.md` (product schema §2.1, visibility §4)
- `PRD/user_module/cart_checkout/cart_checkout.md` (order state machine, earnings-booking trigger)
- `PRD/admin_module/marketplace/marketplace.md` + the admin merchants spec (admin review/moderation/payout plane — admin docs agent)
- `PRD/gcp_upload.md` (upload service — ⚠️ private-visibility extension flagged in §4.3) · `PRD/data_structure.md` §10/§11
- `PRD/user_module/adashesu-contributions/adashesu-contributions.md` §4.2 (the payout-lifecycle pattern mirrored here)
- `backend/src/storage/gcs.service.ts` · `src/services/upload.service.ts` (✅ public-only today — to extend)
- `src/pages/users/AgriculturalMarketplaceView.tsx` (Merchant Portal tab being removed)
