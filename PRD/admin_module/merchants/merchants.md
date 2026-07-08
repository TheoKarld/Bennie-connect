# Admin PRD: Merchants — KYC Review, Oversight & Manual Payouts (LIVE build)

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no merchants code exists yet; `WalletService` primitives and the
> upload-service scaffolds it builds on are noted inline)
>
> Live blueprint for `admin-dev` / `backend-dev` governing the admin **Merchants** section: the
> **`merchants`** collection (seller identity for the LIVE marketplace), **KYC review** (Prembly
> advisory verification + private-bucket document review via signed URLs + purge-on-decision),
> merchant **suspension**, the **earnings ledger**, and the **manual, adashe-style payout
> lifecycle** (`REQUESTED → MARKED_SENT → CONFIRMED_RECEIVED`).
>
> Merchant onboarding itself (business form, ID entry, document upload) happens in the user-side
> **Merchant Hub** — spec:
> [`PRD/user_module/merchant_panel/merchant_panel.md`](../../user_module/merchant_panel/merchant_panel.md)
> (authored concurrently). Canonical schemas: [`PRD/data_structure.md`](../../data_structure.md)
> §11.5–§11.7. Storage extension (private bucket + signed URLs):
> [`PRD/gcp_upload.md`](../../gcp_upload.md).

---

## 1. Overview

Merchants are the **seller identity plane** of the LIVE marketplace (owner-locked — this resolves
the old marketplace.md Open Question 5). A platform user opens the Merchant Hub, submits business
info + a government ID + document uploads; the backend runs an **advisory Prembly check** on the
ID number; the documents land in the **private** GCS bucket; the application reaches admins as a
`PENDING_REVIEW` queue item. **The admin makes the final approve/reject decision** — Prembly is a
signal, never the decider (owner-locked). On the final decision (approve **or** reject) the KYC
document objects are **purged** from GCS + `files`; the verified ID data lives on the merchant
document in Mongo.

Approved merchants create listings (moderated per
[`marketplace.md`](../marketplace/marketplace.md)), fulfil their own orders
([`orders.md`](../admin_orders/orders.md)), accrue **earnings** (net of the platform fee) into a
ledger on order delivery, and cash out through the **manual payout** queue this section operates:
merchant requests a payout → admins notified → an admin **marks it sent** with a payment
reference (funds wired off-platform) → the merchant **confirms received** → the entries settle.
This mirrors the Adashe `payoutRequests` lifecycle
([`adas_hesu_contributions.md`](../adas_hesu_contributions/adas_hesu_contributions.md) §4.5),
including the RBAC posture: **`merchants:mark-payout-sent` is Super-Admin-only, NOT delegable**
(mirror of `adashe-contributions:mark-sent`).

**Conventions (shared — see [`README.md`](../README.md)):** backend `/api/v1/admin/*`; admin
frontend `/bennie/*`; admin identity = `adminUsers`; authz = `adminRoles` (`resource:action`) +
overrides; Super Admin = `*`; every endpoint declares its permission; every mutation writes
`adminAuditLog`; money is whole NGN; responses serialize `_id → id`.

### RBAC summary (this section)

| Permission | Gates | Delegable? |
|-----------|-------|-----------|
| `merchants:view` | Lists, detail, KYC docs (signed URLs), earnings ledger, payout queue reads | ✅ |
| `merchants:approve` | KYC **approve** and **reject** (the final decision, incl. doc purge) | ✅ |
| `merchants:suspend` | Suspend / reinstate a merchant | ✅ |
| `merchants:mark-payout-sent` | Mark a payout request **SENT** / cancel a payout request | ❌ **Super-Admin-only, non-delegable** |
| `merchants:export` | CSV export of merchant/payout data | ✅ |

---

## 2. Collections / Schema

Canonical definitions: `data_structure.md` §11.5 (`merchants`), §11.6 (`merchantEarnings`),
§11.7 (`merchantPayoutRequests`). Key fields summarized:

### 2.1 `merchants` 📄

```jsonc
{
  "_id": "ObjectId",
  "merchantId": "string",                // unique, "MCH_<ts>_<rand>"
  "userId": "ObjectId",                  // ref users — unique (one merchant profile per user)
  "businessName": "string",
  "businessDescription": "string?",
  "businessAddress": { "street": "string", "city": "string", "state": "string" },
  "businessPhone": "string",
  "businessEmail": "string?",
  "isRegisteredBusiness": "boolean",     // true → optional CAC verification
  "cacRcNumber": "string?",
  "idType": ["NIN", "BVN", "DRIVERS_LICENCE", "VOTERS_CARD", "INTL_PASSPORT"],
  "idNumber": "string",                  // the verified ID data that LIVES in Mongo after doc purge
  "premblyResult": {                     // ADVISORY snapshot — admin decides, not Prembly
    "checked": "boolean",                // false when PremblyService unconfigured (no-op)
    "verified": "boolean?",              // Prembly match outcome; null when unchecked
    "endpoint": "string?",               // which Prembly endpoint was called
    "checkedAt": "Date?",
    "matchedName": "string?",            // name returned by the identity source
    "raw": "Record<string, any>?"        // trimmed response snapshot (no images)
  },
  "cacResult": { /* same advisory shape, for CAC checks */ },
  "kycDocs": "FileMetadata[]",           // PRIVATE-bucket uploads; EMPTIED on final decision (purge)
  "kycDocsPurgedAt": "Date?",
  "kycStatus": ["NOT_STARTED", "IN_PROGRESS", "PENDING_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"],
  "submittedAt": "Date?",
  "reviewedBy": "ObjectId?",             // ref adminUsers
  "reviewedAt": "Date?",
  "rejectionReason": "string?",
  "suspendedBy": "ObjectId?", "suspendedAt": "Date?", "suspensionReason": "string?",
  "payoutBankAccount": { "bankName": "string", "accountNumber": "string", "accountName": "string" },  // optional until first payout request
  "earnings": {                          // denormalized counters (ledger is source of truth)
    "availableBalance": "number",        // NGN — sum of AVAILABLE entries
    "lifetimeEarned": "number",
    "lifetimePaidOut": "number"
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 2.2 `merchantEarnings` 📄 (ledger — append-oriented)

```jsonc
{
  "_id": "ObjectId",
  "merchantId": "ObjectId",              // ref merchants
  "type": ["ORDER_EARNING", "ADJUSTMENT"],
  "orderId": "ObjectId?",                // ref orders — unique per ORDER_EARNING entry
  "gross": "number",                     // NGN (order pricing.total)
  "platformFeePercent": "number",
  "platformFee": "number",               // NGN
  "net": "number",                       // NGN — negative for clawback ADJUSTMENTs
  "status": ["AVAILABLE", "LOCKED", "SETTLED", "REVERSED"],
  "payoutRequestId": "ObjectId?",        // set when LOCKED/SETTLED
  "note": "string?",                     // e.g. "Reversed — order refunded"
  "bookedAt": "Date",
  "settledAt": "Date?",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 2.3 `merchantPayoutRequests` 📄 (the manual-payout work queue)

```jsonc
{
  "_id": "ObjectId",
  "requestId": "string",                 // unique, "MPR_<ts>_<rand>"
  "merchantId": "ObjectId",              // ref merchants
  "amount": "number",                    // NGN — sum of the locked entries' net
  "entryIds": "ObjectId[]",              // the merchantEarnings entries locked into this request
  "bankAccount": { "bankName": "string", "accountNumber": "string", "accountName": "string" },  // snapshot at request
  "status": ["REQUESTED", "MARKED_SENT", "CONFIRMED_RECEIVED", "CANCELLED"],
  "requestedAt": "Date",
  "markedSentBy": "ObjectId?",           // ref adminUsers (Super Admin who wired the funds)
  "markedSentAt": "Date?",
  "paymentReference": "string?",         // off-platform transfer ref (required at mark-sent)
  "confirmedAt": "Date?",                // merchant confirms received (user-plane)
  "cancelledBy": "ObjectId?",            // ref adminUsers (or merchant, user-plane, while REQUESTED)
  "cancelReason": "string?",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---

## 3. Prembly identity verification (advisory)

**`PremblyService`** (backend, `backend-dev`) follows the **graceful no-op-without-creds**
pattern of `FcmService`/`GcsService`: if any of the env vars is missing it logs a warning, sets
`configured = false`, and every check resolves `{ checked: false }` — merchant submission still
proceeds to `PENDING_REVIEW`, and the admin review panel shows "Prembly check unavailable".

- **Base URL:** `PREMBLY_BASE_URL` (default `https://api.prembly.com`).
- **Headers:** `x-api-key: <PREMBLY_X_API_KEY>`, `app-id: <PREMBLY_APP_ID>`,
  `accept/content-type: application/json`.
- **Per-ID endpoints** (from the Prembly IdentityPass docs/SDK — paths are relative to the
  IdentityPass verification base `{PREMBLY_BASE_URL}/identitypass/verification`; `backend-dev`
  MUST confirm the exact live paths against <https://docs.prembly.com> at implementation time,
  as the docs also show a shorter `/verification/*` form, e.g. the owner's `POST /verification/vnin`):

| `idType` | Endpoint (POST) | Body params |
|----------|-----------------|-------------|
| `NIN` (vNIN flow) | `/vnin` (virtual NIN) or `/nin_wo_face` | `number_nin` (+ `number` for the vNIN token) |
| `BVN` | `/bvn` | `number` |
| `DRIVERS_LICENCE` | `/drivers_license/basic` (or `/advance`) | `number`, `dob`, `first_name`, `last_name` |
| `VOTERS_CARD` | `/voters_card` | `number`, `state`, `last_name` |
| `INTL_PASSPORT` | `/national_passport` | `number`, `last_name` |
| CAC (optional, registered businesses) | `/cac` | `rc_number`, `company_type` |

  Sources: [Prembly docs](https://docs.prembly.com) ·
  [prembly/prembly_python SDK (nigeria endpoints)](https://github.com/prembly/prembly_python) ·
  [Prembly IdentityPass](https://prembly.com/identityPass).
- **Advisory only (owner-locked).** The trimmed result is stored on
  `merchants.premblyResult` (and `cacResult`); a failed or unavailable check does **not**
  auto-reject — the admin decides. The result panel must clearly label the signal
  ("verified match" / "no match" / "not checked").
- **Env placeholders:** `PREMBLY_APP_ID`, `PREMBLY_X_API_KEY`, `PREMBLY_BASE_URL` (owner
  supplies values; keep out of VCS, same posture as `FIREBASE_PRIVATE_KEY`/`GCP_PRIVATE_KEY`).

---

## 4. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission.

### 4.1 Merchant directory & KYC review

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/merchants` | `merchants:view` | List/search merchants (filters below) |
| GET | `/merchants/:id` | `merchants:view` | Merchant detail: business profile, ID data, **Prembly result panel**, KYC docs (**signed URLs**), listings/orders/earnings summary |
| POST | `/merchants/:id/approve` | `merchants:approve` | Approve KYC (`PENDING_REVIEW → APPROVED`) — **purges KYC docs** (§5.2) |
| POST | `/merchants/:id/reject` | `merchants:approve` | Reject KYC (`PENDING_REVIEW → REJECTED`; **reason required**) — **purges KYC docs** |
| POST | `/merchants/:id/suspend` | `merchants:suspend` | Suspend an `APPROVED` merchant (reason required; delists all their products) |
| POST | `/merchants/:id/reinstate` | `merchants:suspend` | Lift suspension (`SUSPENDED → APPROVED`; relists previously approved products) |
| GET | `/merchants/:id/earnings` | `merchants:view` | Earnings ledger (paginated; filter `status`, `type`, date range) |
| GET | `/merchants/export` | `merchants:export` | CSV export (audited — PII) |

**GET `/merchants` query params:** `page`, `limit`, `q` (business name / merchantId / user
email), `kycStatus` (`NOT_STARTED|IN_PROGRESS|PENDING_REVIEW|APPROVED|REJECTED|SUSPENDED`),
`idType`, `premblyVerified` (bool|`unchecked`), `hasPendingPayout` (bool), `sortBy`
(`createdAt|submittedAt|earnings.availableBalance`), `order`.

**KYC document viewing (private bucket + signed URLs).** `GET /merchants/:id` returns
`kycDocs[]` metadata only. To view a document the console calls
`GET /api/v1/admin/upload/:fileId/signed-url` ([`gcp_upload.md`](../../gcp_upload.md)) which
returns a **V4 signed URL with a 10-minute TTL**; the viewer renders it inline (image/PDF).
After purge (`kycDocsPurgedAt` set), the docs area shows the purge notice instead.

**POST `/merchants/:id/reject` — request:**
```json
{ "reason": "ID number does not match the uploaded document holder" }
```
**Response 200:**
```json
{ "success": true, "data": { "id": "665e0a019b3e4a0012dd0001", "kycStatus": "REJECTED",
    "reviewedAt": "2026-07-03T11:00:00Z", "kycDocsPurgedAt": "2026-07-03T11:00:00Z" } }
```

### 4.2 Payout requests (manual lifecycle — mirror of Adashe)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/merchants/payout-requests` | `merchants:view` | **Cross-merchant queue** — all payout requests, default filter `status=REQUESTED` (dashboard-linked) |
| GET | `/merchants/:id/payout-requests` | `merchants:view` | One merchant's payout requests (all statuses) |
| GET | `/merchants/payout-requests/:reqId` | `merchants:view` | Payout-request detail (locked entries, bank snapshot, history) |
| POST | `/merchants/payout-requests/:reqId/mark-sent` | `merchants:mark-payout-sent` | **Mark funds wired** (`REQUESTED → MARKED_SENT`; `paymentReference` required) — **Super-Admin-only, non-delegable** |
| POST | `/merchants/payout-requests/:reqId/cancel` | `merchants:mark-payout-sent` | Cancel/void a request (reason required; unlocks entries) |

**POST `/merchants/payout-requests/:reqId/mark-sent` — request:**
```json
{ "paymentReference": "GTB-TRF-90233812", "note": "Wired to GreenGro Supplies, 2026-07-03" }
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "666201aa9b3e4a0012ee0001",
    "requestId": "MPR_1720300000_p0o9i8",
    "status": "MARKED_SENT",
    "amount": 79800,
    "paymentReference": "GTB-TRF-90233812",
    "markedSentAt": "2026-07-03T12:20:00Z",
    "awaitingMerchantConfirmation": true
  }
}
```
- Validates the request is `REQUESTED` (else `MERCH_ADM_008`), the merchant is `APPROVED`
  (not suspended — else `MERCH_ADM_007`), and `paymentReference` is non-empty
  (`MERCH_ADM_009`).
- Notifies the merchant (`merchant.payout.marked_sent`) prompting confirmation; writes
  `merchants.payout.mark_sent` audit (**high** severity).

---

## 5. Business rules & state machines

### 5.1 Merchant KYC lifecycle (owner-locked)

```
 NOT_STARTED ──(merchant opens onboarding)──► IN_PROGRESS ──(submit: form + ID + docs)──► PENDING_REVIEW
                                                    ▲                                          │
                                                    │  (resubmission: edit + RE-UPLOAD docs)   │ Prembly advisory check runs
                                                    │                                          │ admins notified (merchant.kyc.submitted)
                                              REJECTED ◄──────reject (reason; docs purged)─────┤
                                                                                               │
                                                              approve (docs purged) ──────────►│──► APPROVED ◄──reinstate── SUSPENDED
                                                                                                        │                       ▲
                                                                                                        └──suspend (reason)─────┘
```

- `NOT_STARTED`/`IN_PROGRESS` are user-plane states (Merchant Hub). Submission sets
  `PENDING_REVIEW` + `submittedAt`, runs the Prembly check server-side, and notifies admins.
- **Approve / reject are the admin's final call** (`merchants:approve`); reject **requires a
  reason** (`MERCH_ADM_003`). Both decisions **purge the KYC documents** (§5.2).
- **Rejected merchants re-submit**: they edit their application and **re-upload documents**
  (the originals were purged) → back to `PENDING_REVIEW`.
- **Suspend** (`merchants:suspend`, reason required) applies only to `APPROVED`; it sets
  `suspended: true` on **all the merchant's products** (delist), blocks new listings and new
  payout requests, but does **not** cancel in-flight orders (they continue through
  fulfilment/refund) and does **not** freeze already-`REQUESTED`/`MARKED_SENT` payouts.
  **Reinstate** returns to `APPROVED` and clears the product `suspended` flags (previously
  approved listings return to browse without re-moderation).
- Only `APPROVED` merchants can create listings and request payouts.

### 5.2 KYC-document purge on decision (owner-locked)

On the final decision (**approve OR reject**):

1. For each `kycDocs[]` entry the server calls `UploadService.remove(<FileMetadata.id>)` —
   deleting the **private-bucket GCS object AND the `files` row**.
2. `merchants.kycDocs` is set to `[]` and `kycDocsPurgedAt` stamped.
3. The audit entry for the decision records the purged file ids (metadata only — never document
   contents in `before`/`after`).

The **verified identity data lives on in Mongo** (`idType`, `idNumber`, `premblyResult`,
`cacResult`) — the binary documents do not. This is deliberate **NDPR/GDPR data-minimisation**:
raw ID documents are held only as long as the review requires. Signed-URL requests for purged
files return `UPLOAD_004` (file not found).

### 5.3 Earnings ledger rules

- **Booking:** each `DELIVERED` **MERCHANT** order books one `ORDER_EARNING` entry
  (`net = total − round(total × platformFeePercent/100)`), idempotent per `orderId`
  ([`orders.md`](../admin_orders/orders.md) §4.6). Counters on `merchants.earnings` update
  atomically with the entry.
- **Entry states:** `AVAILABLE` (spendable into a payout request) → `LOCKED` (bound to a
  `REQUESTED`/`MARKED_SENT` payout) → `SETTLED` (payout `CONFIRMED_RECEIVED`).
  `REVERSED` = clawed back (order refunded / corrective un-deliver) while still `AVAILABLE`.
- **Refund interaction** (see orders.md §4.4): full refund of a delivered order reverses its
  `AVAILABLE` entry; partial refunds and refunds against `LOCKED`/`SETTLED` entries book
  **negative `ADJUSTMENT`** entries netted against future availability. `availableBalance` may
  therefore be temporarily negative; payout requests require `availableBalance > 0` and only lock
  positive coverage.
- The ledger is the **source of truth**; `merchants.earnings` counters are denormalized mirrors.

### 5.4 Manual payout lifecycle (owner-locked — mirrors Adashe §4.5)

```
        merchant requests payout (user-plane; locks AVAILABLE entries; snapshots bank account)
                                     │
                                     ▼
                              REQUESTED ──admin cancel (reason) / merchant cancel──► CANCELLED (entries unlocked → AVAILABLE)
                                     │
              Super Admin mark-sent (merchants:mark-payout-sent)
              + paymentReference; funds wired OFF-PLATFORM
                                     ▼
                             MARKED_SENT ──admin cancel (reason)──► CANCELLED (entries unlocked; ref voided)
                                     │
                merchant confirms received (user-plane)
                                     ▼
                          CONFIRMED_RECEIVED
                                     │
                                     ▼
      entries → SETTLED · merchants.earnings.lifetimePaidOut += amount · admins notified
```

- **`REQUESTED`** is merchant-initiated (Merchant Hub): amount = selected/all `AVAILABLE` net;
  entries flip to `LOCKED`; bank account snapshotted. **One active request**
  (`REQUESTED`/`MARKED_SENT`) per merchant (`MERCH_ADM_011`). **All admins are notified**
  (`merchant.payout.requested`, `link: "/bennie/merchants/<id>"`).
- **`MARKED_SENT`** is the **Super Admin's** action — it asserts real money left the
  cooperative's account (off-platform bank transfer). `paymentReference` required. The merchant
  is notified to confirm. **No wallet movement occurs at any point** — the earnings ledger and
  the off-platform wire are the whole money story.
- **`CONFIRMED_RECEIVED`** is the **merchant's** action in the Merchant Hub; it settles the
  locked entries and notifies admins (`merchant.payout.confirmed`). The admin does not confirm
  on the merchant's behalf. A merchant disputing a `MARKED_SENT` (never received) is handled by
  admin **cancel** (unlock + re-request) — the cancel reason records the dispute.
- **RBAC (owner-locked):** `merchants:mark-payout-sent` is in the README
  [Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable)
  — non-delegable, satisfiable only by the `*` wildcard, mirror of
  `adashe-contributions:mark-sent`. Delegated staff may **view** the queue but not mark-sent or
  cancel.

---

## 6. Validation

- `approve`/`reject`: merchant must be `PENDING_REVIEW` (`MERCH_ADM_002`); `reject.reason`
  non-empty `>= 5` chars (`MERCH_ADM_003`).
- `suspend`: merchant must be `APPROVED`; reason required. `reinstate`: must be `SUSPENDED`.
- `mark-sent`: request must be `REQUESTED` (`MERCH_ADM_008`); `paymentReference` non-empty
  (`MERCH_ADM_009`); merchant not suspended (`MERCH_ADM_007`).
- `payout cancel`: request must be `REQUESTED` or `MARKED_SENT`; reason required.
- Signed-URL doc access: file must exist and be referenced by this merchant's `kycDocs`
  (purged → `UPLOAD_004`).
- All `:id`/`:reqId` params validated as ObjectId; missing target → `MERCH_ADM_001` /
  `MERCH_ADM_010`.

---

## 7. Notifications (owner-locked matrix)

Via the shared `NotificationService` ([`notification.md`](../../notification.md)); consolidated
in `data_structure.md` §11.8.

| Event key | Fires on | Audience | `link` |
|-----------|----------|----------|--------|
| `merchant.kyc.submitted` | merchant submits/resubmits KYC | **admins** | `/bennie/merchants/<id>` |
| `merchant.kyc.decided` | admin approve/reject | merchant (owner user) | merchant-hub URL |
| `merchant.suspended` / `merchant.reinstated` | suspend/reinstate | merchant | merchant-hub URL |
| `merchant.payout.requested` | merchant requests payout | **admins** | `/bennie/merchants/<id>` |
| `merchant.payout.marked_sent` | Super Admin marks sent | merchant | merchant-hub payout URL |
| `merchant.payout.confirmed` | merchant confirms received | **admins** | `/bennie/merchants/<id>` |
| `merchant.payout.cancelled` | payout request cancelled | merchant (+ admins if merchant-cancelled) | per plane |

---

## 8. Audit events

| Action | Trigger | Severity |
|--------|---------|----------|
| `merchants.kyc.approve` | approve (records purged doc ids) | **high** |
| `merchants.kyc.reject` | reject (reason; records purged doc ids) | **high** |
| `merchants.kyc.docs_purge` | the purge step itself (file ids, actor, ip) | normal |
| `merchants.suspend` / `.reinstate` | suspension lifecycle | **high** / normal |
| `merchants.payout.mark_sent` | mark-sent (asserts funds wired; `paymentReference`) | **high** |
| `merchants.payout.cancel` | payout cancel (reason) | **high** |
| `merchants.kyc.doc_view` | admin fetches a signed URL for a KYC doc (PII access accountability) | normal |
| `merchants.export` | CSV export (PII) | normal |

Each entry records `actor`, `targetType` (`Merchant`/`MerchantPayoutRequest`), `targetId`,
`before`, `after`, `reason?`, `timestamp`, `ip`, `userAgent`. `before`/`after` snapshots MUST
exclude document contents and full Prembly raw payloads (store references/ids only).

---

## 9. Error codes

Standard envelope:
```json
{ "success": false, "error": { "code": "MERCH_ADM_008", "message": "Payout request is not in REQUESTED state", "details": { "current": "MARKED_SENT" } } }
```

| Code | Meaning |
|------|---------|
| `MERCH_ADM_001` | Merchant not found |
| `MERCH_ADM_002` | Invalid KYC state for this action (e.g. approve on non-`PENDING_REVIEW`) |
| `MERCH_ADM_003` | Reason required for this action |
| `MERCH_ADM_004` | Merchant already exists for this user (unique `userId`) |
| `MERCH_ADM_005` | KYC documents already purged (docs unavailable) |
| `MERCH_ADM_006` | Prembly verification unavailable (informational — never blocks review) |
| `MERCH_ADM_007` | Merchant suspended — action blocked |
| `MERCH_ADM_008` | Payout request not in the required state |
| `MERCH_ADM_009` | `paymentReference` required to mark a payout request SENT |
| `MERCH_ADM_010` | Payout request not found |
| `MERCH_ADM_011` | Duplicate active payout request for this merchant |
| `MERCH_ADM_012` | Insufficient permission for action |

---

## 10. Admin UI / Section (premium UX)

Route base **`/bennie/merchants`** — a **new top-level nav item** (sidebar group *Operations*),
badge = `PENDING_REVIEW` count + `REQUESTED` payout count. Rich ops console — no basic UI.

- **Merchants table** — pagination, search, filters (kycStatus chips, idType, Prembly signal,
  has-pending-payout). Columns: business name + avatar, owner user (link to User 360), KYC chip
  (`PENDING_REVIEW` amber pulse), Prembly badge (✓ match / ✗ no match / — unchecked), listings
  count, available earnings (NGN), submitted-at. Row → detail page. Export CSV.
- **KYC review queue** — dedicated approval-queue view of `PENDING_REVIEW` merchants (oldest
  first) with a split-pane reviewer:
  - **Left — application:** business profile, ID type + number, CAC number (if registered
    business), submission history (resubmission count).
  - **Right — evidence:** **KYC document viewer** (inline image/PDF rendered from 10-minute
    **signed URLs**, with an expiry countdown + refresh) and the **Prembly result panel**
    (signal badge, matched name vs. supplied name diff-highlight, checked-at, endpoint;
    an "unavailable" state when unconfigured).
  - **Actions:** **Approve** (confirm modal noting *"Approving permanently deletes the uploaded
    ID documents"*) and **Reject** (reason modal, same purge note). Buttons hidden without
    `merchants:approve`.
- **Merchant detail page** (`/bennie/merchants/:id`) — tabs:
  - **Overview** — profile, KYC status timeline, suspend/reinstate action (reason modal,
    `merchants:suspend`), purge notice (`kycDocsPurgedAt`).
  - **Listings** — the merchant's products with moderation chips (deep-links to
    `/bennie/market-place`).
  - **Orders** — their MERCHANT orders (deep-links to `/bennie/orders?merchantId=…`).
  - **Earnings** — ledger table (type, order link, gross/fee/net, status chips
    `AVAILABLE/LOCKED/SETTLED/REVERSED`, negative adjustments in red) + counters header
    (available / lifetime earned / lifetime paid out).
  - **Payouts** — this merchant's payout requests with the lifecycle stepper
    (`REQUESTED → MARKED_SENT → CONFIRMED_RECEIVED`), bank-account snapshot, **Mark sent**
    action (confirm modal capturing `paymentReference` + note — **hidden for admins lacking
    `merchants:mark-payout-sent`**, Super Admin only), cancel-with-reason, and an
    awaiting-merchant-confirmation state for `MARKED_SENT`.
- **Cross-merchant payout queue** — `/bennie/merchants?tab=payouts`: all `REQUESTED` items
  (dashboard-linked approval queue), stale-`MARKED_SENT` highlighting (> N days unconfirmed →
  alert center).
- **Dashboard hooks:** `PENDING_REVIEW` KYC queue + `REQUESTED` payout queue surface as approval
  queues on `/bennie/dashboard`; stale `MARKED_SENT` payouts raise alerts.

---

## 11. Environment variables

```bash
# Prembly (advisory KYC) — graceful no-op when absent; owner supplies values
PREMBLY_APP_ID=
PREMBLY_X_API_KEY=
PREMBLY_BASE_URL=https://api.prembly.com

# Private KYC bucket — see PRD/gcp_upload.md (owner-locked split-bucket design)
GCP_PRIVATE_BUCKET=bennie-connect-private
```

Platform-fee % and payout policy values are DB-driven via the global `settings` collection
(`settings.marketplace.platformFeePercent`) — env seeds only (see
[`marketplace.md`](../marketplace/marketplace.md) §9).

---

## 12. Resolved decisions (owner-locked)

1. **Merchant identity — FINAL.** Sellers are the `merchants` collection (one per `users`
   account), onboarded via the user-side Merchant Hub. Resolves marketplace.md's former Open
   Question 5.
2. **KYC — FINAL.** Prembly (`x-api-key` + `app-id`, base `https://api.prembly.com`) verifies
   the ID number server-side as an **advisory** signal; the **admin decides**. `PremblyService`
   is a graceful no-op without creds.
3. **Docs — FINAL.** KYC uploads go to the **private** GCS bucket; admin viewing is via
   **10-minute V4 signed URLs**; the documents are **purged from GCS + `files` on the final
   decision (approve OR reject)**; rejected merchants re-upload on resubmission.
4. **Payout — FINAL.** Manual, adashe-style: `REQUESTED → MARKED_SENT → CONFIRMED_RECEIVED`
   (+ `CANCELLED`); earnings ledger (never the wallet); `merchants:mark-payout-sent` is
   **Super-Admin-only, non-delegable**.
5. **Implementation flag (not a decision):** the exact Prembly path prefix
   (`/identitypass/verification/*` vs `/verification/*`) must be confirmed against
   docs.prembly.com when `backend-dev` builds `PremblyService` (§3).
