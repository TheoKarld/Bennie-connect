# PRD 02: Digital Wallet with SeerBit Integration

## Overview
Enterprise-grade digital wallet system with SeerBit payment gateway integration for the Cooperative Farming Portal using NestJS and MongoDB.

> ⚠️ **Read the "As-Built Implementation Plan (v2)" section below first.** The original
> body of this PRD (from "Database Schema" down) was authored against a **generic /
> assumed** SeerBit API. Several of its SeerBit details are **wrong** against the real
> v2 API (base URL `https://gateway.seerbit.com`, endpoints `POST /payment/initialize`,
> `POST /transfer/disburse`, `GET /transaction/verify/{ref}`, and the
> `x-seerbit-signature` HMAC-SHA512 webhook). The **As-Built (v2)** section is the
> **authoritative build contract**; where it disagrees with the legacy body, As-Built
> wins and the legacy text is marked *(superseded)*.

---

## As-Built Implementation Plan (v2) — AUTHORITATIVE

**Status:** 📄 To be built. This section is the reconciled, verified build contract for
`backend-dev` (NestJS backend) and `user-dev` (React frontend). It supersedes the
legacy SeerBit details further down. Data-model schemas below (Wallet / Transaction /
DepositRequest / WithdrawalRequest / BankAccount) remain valid — only the SeerBit
*integration mechanics*, deposit UX, and withdrawal/transfer flows are re-specified
here.

### A. Verified SeerBit v2 facts (with sources)

All values below were verified against SeerBit's official documentation on 2026-07-02.
Cited inline; do not substitute assumed endpoints.

| Concern | Verified value | Source |
|---------|----------------|--------|
| **REST API base URL** | `https://seerbitapi.com/api/v2` | [apis.seerbit.com/authentication](https://apis.seerbit.com/authentication) · [seerbit.github.io/openapi](https://seerbit.github.io/openapi/) |
| **Inline JS SDK script** | `https://checkout.seerbitapi.com/api/v2/seerbit.js` | [doc.seerbit.com — Simple Checkout](https://doc.seerbit.com/online-payment/integration-type/simple-checkout) |
| **Inline SDK function** | `SeerbitPay(config, callback, close)` (global, from the script) | [doc.seerbit.com — Simple Checkout](https://doc.seerbit.com/online-payment/integration-type/simple-checkout) · [react-seerbit](https://github.com/tosyngy/react-seerbit) |
| **Auth: encrypt keys** | `POST https://seerbitapi.com/api/v2/encrypt/keys`, body `{ "key": "<SECRET_KEY>.<PUBLIC_KEY>" }` → `data.EncryptedSecKey.encryptedKey` | [apis.seerbit.com/authentication](https://apis.seerbit.com/authentication) |
| **Auth: request header** | `Authorization: Bearer <encryptedKey>` on all server-side calls | [apis.seerbit.com/authentication](https://apis.seerbit.com/authentication) |
| **Verify / query payment** | `GET https://seerbitapi.com/api/v2/payments/query/{paymentReference}` (Bearer) | [seerbit.github.io/openapi](https://seerbit.github.io/openapi/) · [doc.seerbit.com — Verify Payment](https://doc.seerbit.com/online-payment/after-payment/verify-payment) |
| **Webhook payload wrapper** | `{ "notificationItems": [ { "notificationRequestItem": { "eventType", "eventDate", "eventId", "data": {…} } } ] }` | [doc.seerbit.com — Webhook Event V2](https://doc.seerbit.com/online-payment/after-payment/webhook-event-v2) |
| **Webhook ack** | Respond **within 5s** with `{ "ackReference": "<X-Expected-Ack-Reference or generated>", "status": "received" }` | [doc.seerbit.com — Webhook Event V2](https://doc.seerbit.com/online-payment/after-payment/webhook-event-v2) |

⚠️ **Could NOT be verified / open flags — do not guess:**

1. **Webhook signature/hash.** SeerBit's V2 webhook doc states webhooks **do not require
   a signature by default** and only "recommends best practices" — it publishes **no
   HMAC header name, algorithm, or secret**. The legacy `x-seerbit-signature` +
   HMAC-SHA512 in this PRD is therefore **unverified/likely wrong**. **Build decision:**
   because the webhook cannot be cryptographically trusted, treat it as a *hint only*
   and make **server-side `GET /payments/query/{reference}` the sole source of truth**
   for crediting (the webhook handler must re-query before crediting, never credit from
   webhook body alone). Keep `SEERBIT_WEBHOOK_SECRET` as a placeholder env var for the
   day SeerBit exposes a signing scheme; until then it is unused. Owner to confirm with
   SeerBit whether a signing secret can be enabled on the merchant account.
2. **Verify endpoint version.** The query path is documented under `/api/v2/` in the
   OpenAPI reference and (on one doc page) under `/api/v3/`. Backend must make the
   version a config value (`SEERBIT_BASE_URL`) and confirm the exact path against the
   live merchant account before go-live. Documented default: `…/api/v2/payments/query/{ref}`.
3. **Verify response field names.** Confirmed fields: `status: "SUCCESS"` (top level),
   `data.payments.gatewayMessage` ("Successful"), `data.payments.amount`,
   `data.payments.currency`, `data.payments.gatewayref`, `data.payments.paymentReference`.
   Exact success-code enum (e.g. `"00"`) should be re-read from the live response and
   pinned before relying on it.
4. **Inline SDK callback response shape.** SeerBit's SDK docs show the success callback
   as `callback(response, closeModal)` and the close callback as `close(...)`, but do
   **not** publish the exact `response` fields. **Build decision:** the frontend must
   **not** trust the callback payload for crediting — on success it only calls
   `POST /wallet/deposit/verify { reference }` with the reference it generated; the
   backend re-queries SeerBit. Treat the callback purely as a "user finished" UX signal.
5. **Only test keys present.** `backend/.env` currently holds **test** `SEERBIT_PUBLIC_KEY`
   / `SEERBIT_SECRET_KEY` only. Live keys, `SEERBIT_WEBHOOK_SECRET`, and a confirmed
   `SEERBIT_BASE_URL` must be provisioned before production. ⚠️ Rotate any committed
   secrets and keep `.env` out of VCS (mirrors the note in `PRD/oneSignal.md`).

### B. Config reconciliation (`backend/src/config/configuration.ts`)

The `seerbit` config group today is:

```typescript
seerbit: {
  secretKey: process.env.SEERBIT_SECRET_KEY || '',
  publicKey: process.env.SEERBIT_PUBLIC_KEY || '',
  baseUrl: process.env.SEERBIT_BASE_URL || 'https://checkout.seerbit.com/api/v2', // ⚠️ WRONG default
}
```

⚠️ **The `baseUrl` default `https://checkout.seerbit.com/api/v2` is incorrect for the
REST API.** `checkout.seerbitapi.com` serves the **inline JS SDK only**; the **REST
API** base is `https://seerbitapi.com/api/v2`. Recommended change (owner to apply — this
is a config/code edit for `backend-dev`, documented here, not made in this PRD task):

```typescript
seerbit: {
  secretKey: process.env.SEERBIT_SECRET_KEY || '',
  publicKey: process.env.SEERBIT_PUBLIC_KEY || '',
  baseUrl: process.env.SEERBIT_BASE_URL || 'https://seerbitapi.com/api/v2', // REST API
  webhookSecret: process.env.SEERBIT_WEBHOOK_SECRET || '',                  // placeholder (see A.1)
}
```

Frontend needs the **public** key only, as a Vite env var: `VITE_SEERBIT_PUBLIC_KEY`
(never expose the secret key to the browser).

### C. Server-side auth flow (obtaining the Bearer token)

1. Build the key string `"<SEERBIT_SECRET_KEY>.<SEERBIT_PUBLIC_KEY>"`.
2. `POST https://seerbitapi.com/api/v2/encrypt/keys` with `{ "key": "<that string>" }`,
   `Content-Type: application/json`.
3. Read `data.EncryptedSecKey.encryptedKey` from the `200` response.
4. Use it as `Authorization: Bearer <encryptedKey>` on every subsequent server-side
   call (`/payments/query/...`, and — feature-flagged — disbursement).
5. **Cache** the encrypted key in memory (e.g. 55-min TTL) and re-encrypt on `401`;
   avoid calling `/encrypt/keys` on every request.

### D. Deposit — inline popup SDK + verify (LOCKED UX)

Deposit uses the **inline JS popup** (not a redirect/checkout URL). The public key runs
in the browser; crediting is idempotent and server-authoritative.

**Flow:**
1. **Frontend →** `POST /api/v1/wallet/deposit/initiate { amount, method }`.
2. **Backend** validates limits/KYC, creates a `DepositRequest` (status `PENDING`) with a
   **unique `reference`** (e.g. `DEP<ts><rand>`), returns `{ reference, publicKey?,
   amount, currency: "NGN", email }`. (Public key may also come from `VITE_SEERBIT_PUBLIC_KEY`.)
3. **Frontend** loads `https://checkout.seerbitapi.com/api/v2/seerbit.js` and calls
   `SeerbitPay(config, callback, close)` with:
   ```js
   SeerbitPay({
     public_key: import.meta.env.VITE_SEERBIT_PUBLIC_KEY,
     amount: String(amount),          // SDK expects string amount
     tranref: reference,              // the backend-issued DepositRequest.reference
     currency: "NGN",
     country: "NG",
     email: user.email,
     full_name: `${user.firstName} ${user.lastName}`,
     description: "Wallet top-up",
   },
   (response, closeModal) => {        // success callback — DO NOT credit here
     closeModal?.();
     walletApi.post("/wallet/deposit/verify", { reference }); // backend re-queries SeerBit
   },
   () => { /* user closed popup — mark intent abandoned in UI only */ });
   ```
4. **On the success callback**, the frontend calls
   `POST /api/v1/wallet/deposit/verify { reference }`.
5. **Backend verify** obtains the Bearer token (§C), calls
   `GET /payments/query/{reference}`, and **only if** `status === "SUCCESS"` and
   `data.payments` amount/currency match the `DepositRequest`, **credits idempotently**:
   move the `DepositRequest` to `COMPLETED`, write a `Transaction`
   (`type: CREDIT, category: DEPOSIT`, `balanceBefore/After`, `externalReference =
   gatewayref`, `seerBitData`), and increment `Wallet.balance.available` +
   `totalDeposited`. Guard by `DepositRequest.reference` + `Transaction.reference`
   uniqueness so a repeat verify/webhook is a no-op.
6. **Webhook backstop:** `POST /api/v1/webhooks/seerbit` receives
   `notificationItems[].notificationRequestItem`, extracts the payment reference from
   `data`, **re-queries `/payments/query/{reference}`** (does **not** trust the body —
   see A.1), credits via the **same idempotent path** as verify, then returns the
   required ack `{ ackReference, status: "received" }` within 5s.

**Idempotency:** verify and webhook converge on one `creditDeposit(reference)` method
guarded by a unique index on `Transaction.reference` (derived from the deposit
reference); a second call finds the `COMPLETED` request and returns success without
double-crediting.

### E. Withdrawal — ledger + approval only (LOCKED; live payout feature-flagged)

**No live SeerBit disbursement this phase.** The merchant's disbursement/transfer
product is **not enabled**, so withdrawals are a **ledger + approval** workflow; the
actual payout call is gated behind `WALLET_LIVE_PAYOUTS` (default **off**).

**Flow:**
1. **Frontend →** `POST /api/v1/wallet/withdraw { amount, bankAccountId | (accountNumber,
   bankCode), narration }`.
2. **Backend** validates available balance ≥ `amount + fee`, computes fee (§ Fee
   Structure), **locks funds** (move `amount + fee` from `balance.available` →
   `balance.pending`), and creates a `WithdrawalRequest` (status `PENDING`).
3. **Auto-approve** if `amount ≤ ₦50,000` (`AUTO_APPROVE_WITHDRAWAL_THRESHOLD`), else
   route to admin (`withdrawals:approve` / `withdrawals:reject`, RBAC per admin module).
4. **On approval:**
   - If `WALLET_LIVE_PAYOUTS` is **off** (this phase): status → `APPROVED` →
     (operationally settled off-platform) → admin marks `COMPLETED`; funds move
     `balance.pending` → debited (removed), write `Transaction` (`DEBIT`, `WITHDRAWAL`)
     + `FEE` row; `totalWithdrawn += amount`.
   - If `WALLET_LIVE_PAYOUTS` is **on** (future): call the SeerBit disbursement API
     (§F) and reconcile status from its response/requery.
5. **On rejection / failure:** release the lock (`balance.pending` → `balance.available`),
   status `REJECTED`/`FAILED`, no debit.

**Bank name display:** uses a **static Nigerian bank list** (name ↔ CBN bank code) shipped
with the app — **no live name-enquiry this phase** (`GET /wallet/banks/resolve` returns
the static bank name, not a live account-name lookup). `BankAccount.accountName` is
user-entered/confirmed; `BankAccount.isVerified` stays `false` until live name-enquiry
is enabled.

### F. Disbursement & name-enquiry APIs — DOCUMENTED, NOT USED THIS PHASE

⚠️ **Not used this phase** (disbursement product not enabled; gated behind
`WALLET_LIVE_PAYOUTS`). Documented so `backend-dev` can wire them behind the flag later.
The exact SeerBit disbursement (single/bulk transfer) and account **name-enquiry**
endpoint paths must be **re-verified against the merchant account's enabled products**
before use — the legacy `POST /transfer/disburse` path in this PRD is **unverified** and
should not be assumed. Until enabled: withdrawals settle via the ledger/approval flow
(§E) and bank names come from the static list (§E).

### G. Internal transfer — by registered email (LOCKED)

1. **Frontend →** `POST /api/v1/wallet/transfer/internal { recipientEmail, amount, narration }`.
2. **Backend** resolves the recipient `users` doc by **registered email**; if found,
   returns the **recipient name** for the UI to confirm before finalizing (a two-step
   confirm is recommended: resolve → confirm → transfer, or single call that echoes the
   resolved name in the response).
3. On confirm, perform an **atomic wallet-to-wallet** move (Mongo transaction /
   session): debit sender `balance.available`, credit recipient `balance.available`,
   write **two** `Transaction` rows — sender `DEBIT/TRANSFER_OUT`, recipient
   `CREDIT/TRANSFER_IN` — each with `counterparty.{userId,name}` and a shared
   correlation reference. Internal transfer fee: **free** (§ Fee Structure).
4. Reject self-transfer, unknown email, suspended/closed wallets, and insufficient
   balance with the appropriate `WALLET_*` error code.

### H. Wallet lifecycle & balance source of truth

- **Auto-created on registration** (for the `farmer` role; see role note below) and
  **lazy-created** on first `GET /api/v1/wallet` for pre-existing users without one.
- Generate `walletNumber` (`WLT<ts><rand>`), `balance {available:0, pending:0, locked:0}`,
  `currency "NGN"`, `status ACTIVE`.
- **Balance source of truth = the server `Wallet`.** The frontend
  `FarmerAppState.walletBalance` / `walletTransactions` (mock, `localStorage`) are
  **superseded** for the Wallet page, Dashboard summary, and top-nav balance — those
  read from `GET /api/v1/wallet` and `GET /api/v1/wallet/transactions`. The mock remains
  only as an offline/seed fallback. (See `PRD/data_structure.md` §1.2 / §7.7.1 mapping.)

> ⚠️ **Role note.** This PRD's legacy "MEMBER role" wording is stale. The canonical
> backend role enum is `farmer | agent | admin | super_admin` (see
> `backend/src/users/schemas/user.schema.ts` and `data_structure.md` §4). Wallets
> auto-create for `farmer` (and any role that can transact); "MEMBER" ⇒ `farmer`.

### I. Notifications — via NotificationService (best-effort)

Wallet events **emit through the single `NotificationService`** (see
[`PRD/notification.md`](../../notification.md)) — persist + socket (in-app bell) + FCM
web push, all **best-effort / non-blocking** (a notification failure never fails the
financial operation). Call `notificationService.notify(userId, { event, type, title,
message, data, link })`:

| Wallet event | `event` key | `type` | Notes |
|--------------|-------------|--------|-------|
| Deposit credited | `wallet.deposit.success` | `success` | after idempotent credit (verify or webhook) |
| Withdrawal requested | `wallet.withdrawal.requested` | `info` | on `WithdrawalRequest` create |
| Withdrawal approved | `wallet.withdrawal.approved` | `success` | auto- or admin-approved |
| Withdrawal rejected/failed | `wallet.withdrawal.rejected` | `warning` | lock released |
| Transfer sent | `wallet.transfer.out` | `info` | sender side |
| Transfer received | `wallet.transfer.in` | `success` | recipient side |

(The email templates / SMS / push lists later in this PRD are the *content* catalogue;
delivery is via `NotificationService` in-app + web push this phase — SMS is 📄 planned,
transactional email via OneSignal per `PRD/oneSignal.md`.)

### J. Frontend CSP additions (inline SDK)

The inline SDK loads a script and opens an iframe/modal and makes XHR calls to SeerBit.
The frontend Content-Security-Policy must allow these SeerBit origins:

```
script-src  'self' https://checkout.seerbitapi.com;
frame-src   'self' https://checkout.seerbitapi.com https://seerbitapi.com;
connect-src 'self' https://seerbitapi.com https://checkout.seerbitapi.com;
img-src     'self' data: https://*.seerbitapi.com;
```

⚠️ Verify the exact set of origins the loaded SDK actually contacts in the browser
Network tab against the live merchant account (SeerBit may proxy through additional
subdomains/acquirer 3-D-Secure hosts for card auth); widen `frame-src`/`connect-src`
only as needed.

### K. Environment variables (reconciled)

```bash
# SeerBit (backend) — ⚠️ only TEST keys present today
SEERBIT_PUBLIC_KEY=SBPUBK_TEST_xxx
SEERBIT_SECRET_KEY=SBSECK_TEST_xxx
SEERBIT_BASE_URL=https://seerbitapi.com/api/v2   # REST API (NOT checkout.* )
SEERBIT_WEBHOOK_SECRET=                          # placeholder — unused until SeerBit exposes signing (A.1)

# SeerBit (frontend) — PUBLIC key only, exposed to the browser
VITE_SEERBIT_PUBLIC_KEY=SBPUBK_TEST_xxx

# Feature flag — live bank payouts (default OFF this phase; §E/§F)
WALLET_LIVE_PAYOUTS=false
```

---

## Database Schema (MongoDB with Mongoose)

### Wallet Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User, unique, indexed);
  walletNumber: string (unique);
  balance: {
    available: number; // Available balance
    pending: number;   // Pending transactions
    locked: number;    // Locked funds (e.g., for fixed savings)
  };
  currency: string (default: 'NGN');
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  kycVerifiedAt?: Date;
  dailyTransactionLimit: number;
  monthlyTransactionLimit: number;
  totalDeposited: number;
  totalWithdrawn: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Transaction Collection
```typescript
{
  _id: ObjectId;
  walletId: ObjectId (ref: Wallet, indexed);
  type: 'CREDIT' | 'DEBIT';
  category: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 
            'PAYMENT' | 'REFUND' | 'FEE' | 'INTEREST' | 'DIVIDEND' | 
            'SAVINGS_LOCK' | 'SAVINGS_UNLOCK' | 'CONTRIBUTION' | 'COMMISSION';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  reference: string (unique);
  externalReference?: string; // SeerBit transaction reference
  description: string;
  narration?: string;
  counterparty?: {
    walletId?: ObjectId;
    userId?: ObjectId;
    name?: string;
    accountNumber?: string;
    bankName?: string;
  };
  seerBitData?: {
    transactionRef: string;
    orderId: string;
    paymentMethod: string;
    cardLast4?: string;
    bankName?: string;
    status: string;
    paidAt?: Date;
    settlementAmount?: number;
    fees?: number;
  };
  failureReason?: string;
  reversalReason?: string;
  processedBy?: ObjectId (ref: User);
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### BankAccount Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User, indexed);
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  isDefault: boolean;
  isVerified: boolean;
  verificationMethod?: 'NAME_ENQUIRY' | 'PENNY_DROP';
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### WithdrawalRequest Collection
```typescript
{
  _id: ObjectId;
  walletId: ObjectId (ref: Wallet);
  userId: ObjectId (ref: User);
  bankAccountId: ObjectId (ref: BankAccount);
  amount: number;
  fee: number;
  totalAmount: number;
  status: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED';
  reference: string (unique);
  narration?: string;
  approvedBy?: ObjectId (ref: User);
  approvedAt?: Date;
  processedAt?: Date;
  failureReason?: string;
  seerBitData?: {
    transferRef: string;
    batchId?: string;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### DepositRequest Collection
```typescript
{
  _id: ObjectId;
  walletId: ObjectId (ref: Wallet);
  userId: ObjectId (ref: User);
  amount: number;
  method: 'CARD' | 'BANK_TRANSFER' | 'USSD';
  status: 'PENDING' | 'INITIATED' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  reference: string (unique);
  seerBitData?: {
    checkoutUrl?: string;
    transactionRef?: string;
    orderId: string;
    expiresAt?: Date;
  };
  completedAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## API Endpoints

### Wallet Management

#### GET /api/v1/wallet
**Description:** Get current user's wallet details
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "walletNumber": "WLT1234567890",
    "balance": {
      "available": 150000.00,
      "pending": 5000.00,
      "locked": 50000.00
    },
    "currency": "NGN",
    "status": "ACTIVE",
    "kycStatus": "VERIFIED",
    "dailyLimit": {
      "used": 25000,
      "remaining": 475000,
      "total": 500000
    }
  }
}
```

#### GET /api/v1/wallet/transactions
**Description:** Get wallet transaction history
**Headers:** Authorization: Bearer <token>
**Query Params:** page, limit, type, category, status, startDate, endDate
**Response:** 200 OK

#### GET /api/v1/wallet/transactions/:id
**Description:** Get single transaction details
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

### Deposits (SeerBit Integration)

#### POST /api/v1/wallet/deposit/initiate
**Description:** Create a `DepositRequest` and return a reference for the inline SeerBit popup (see As-Built §D). ⚠️ Response `checkoutUrl` is **superseded** — deposit uses the inline SDK, not a redirect.
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "amount": 10000,
  "method": "CARD"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "reference": "DEP1234567890",
    "publicKey": "SBPUBK_TEST_xxx",
    "amount": 10000,
    "currency": "NGN",
    "email": "user@example.com"
  }
}
```

#### POST /api/v1/wallet/deposit/verify
**Description:** Verify deposit status from SeerBit webhook or manual check
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "reference": "DEP1234567890"
}
```
**Response:** 200 OK

#### POST /api/v1/webhooks/seerbit
**Description:** SeerBit V2 payment-notification webhook (backstop for deposit crediting). Payload wraps `notificationItems[].notificationRequestItem`. ⚠️ **No trustworthy signature** (As-Built §A.1) — the handler **re-queries** `GET /payments/query/{ref}` and credits idempotently from that, never from the body.
**No Auth Required** (public; body untrusted, verified by re-query)
**Request Body:** SeerBit V2 notification envelope `{ "notificationItems": [ { "notificationRequestItem": { "eventType", "eventDate", "eventId", "data": { … } } } ] }`
**Response:** 200 OK — must return within 5s: `{ "ackReference": "<X-Expected-Ack-Reference or generated>", "status": "received" }`

### Withdrawals

#### GET /api/v1/wallet/banks/resolve
**Description:** Return bank details for an account number. ⚠️ **This phase = static list only** (As-Built §E) — resolves the **bankName** from the static Nigerian bank list by `bankCode`; `accountName` is **echoed/blank** (no live name-enquiry). Live name-enquiry is gated with disbursement (`WALLET_LIVE_PAYOUTS`).
**Headers:** Authorization: Bearer <token>
**Query Params:** accountNumber, bankCode
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "accountNumber": "1234567890",
    "accountName": "",
    "bankName": "GTBank",
    "bankCode": "058",
    "verified": false
  }
}
```

> A companion `GET /api/v1/wallet/banks` returns the static Nigerian bank list (`{ name, code }[]`) the frontend uses to populate the bank dropdown.

#### POST /api/v1/wallet/withdraw
**Description:** Request withdrawal to bank account
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "amount": 50000,
  "accountNumber": "1234567890",
  "bankCode": "058",
  "narration": "Withdrawal to bank"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "message": "Withdrawal request submitted successfully",
  "data": {
    "reference": "WDR1234567890",
    "amount": 50000,
    "fee": 50,
    "totalAmount": 50050,
    "status": "PENDING"
  }
}
```

#### GET /api/v1/wallet/withdrawals
**Description:** Get withdrawal history
**Headers:** Authorization: Bearer <token>
**Query Params:** page, limit, status
**Response:** 200 OK

#### GET /api/v1/wallet/withdrawals/:id
**Description:** Get withdrawal details
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

### Transfers

#### POST /api/v1/wallet/transfer/internal
**Description:** Transfer to another wallet user
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "recipientEmail": "user@example.com",
  "amount": 5000,
  "narration": "Payment for services"
}
```
**Response:** 200 OK

#### POST /api/v1/wallet/transfer/external
**Description:** Transfer to external bank account. ⚠️ **Not live this phase** — external payout requires the disbursement product (`WALLET_LIVE_PAYOUTS`, As-Built §E/§F). Until enabled this behaves as the ledger + approval **withdrawal** flow; returns `WALLET_018` if a live payout is attempted with the flag off.
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "accountNumber": "1234567890",
  "bankCode": "058",
  "amount": 10000,
  "narration": "Transfer to bank"
}
```
**Response:** 200 OK

### Saved Bank Accounts

#### GET /api/v1/wallet/bank-accounts
**Description:** Get saved bank accounts
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### POST /api/v1/wallet/bank-accounts
**Description:** Save a new bank account
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "accountNumber": "1234567890",
  "bankCode": "058",
  "isDefault": true
}
```
**Response:** 201 Created

#### DELETE /api/v1/wallet/bank-accounts/:id
**Description:** Delete saved bank account
**Headers:** Authorization: Bearer <token>
**Response:** 204 No Content

### Admin Endpoints

#### GET /api/v1/admin/wallets
**Description:** List all wallets (admin only)
**Headers:** Authorization: Bearer <token>
**Query Params:** page, limit, status, kycStatus
**Response:** 200 OK

#### PATCH /api/v1/admin/wallets/:id/status
**Description:** Update wallet status (admin only)
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "status": "SUSPENDED",
  "reason": "Suspicious activity detected"
}
```
**Response:** 200 OK

#### GET /api/v1/admin/transactions
**Description:** Get all transactions (admin only)
**Headers:** Authorization: Bearer <token>
**Query Params:** page, limit, type, status, dateRange
**Response:** 200 OK

#### POST /api/v1/admin/transactions/:id/reverse
**Description:** Reverse a transaction (admin only)
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "reason": "Duplicate transaction"
}
```
**Response:** 200 OK

#### GET /api/v1/admin/withdrawals/pending
**Description:** Get pending withdrawal requests (admin only)
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### POST /api/v1/admin/withdrawals/:id/approve
**Description:** Approve withdrawal request (admin only)
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### POST /api/v1/admin/withdrawals/:id/reject
**Description:** Reject withdrawal request (admin only)
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "reason": "Insufficient documentation"
}
```
**Response:** 200 OK

---

## Business Logic

### Wallet Creation
- Auto-create wallet on user registration (for MEMBER role)
- Generate unique wallet number (WLT + timestamp + random)
- Initial balance: 0.00
- Default daily limit: ₦500,000
- Default monthly limit: ₦5,000,000

### Deposit Flow (SeerBit) *(superseded — see As-Built §D)*
> ⚠️ This redirect/checkout-URL flow is **replaced** by the **inline popup SDK + verify**
> flow in As-Built §D (no server-side init, no checkout URL; crediting is by server-side
> `GET /payments/query/{ref}`, webhook is a re-query backstop). The steps below are stale.
1. User initiates deposit with amount
2. System creates deposit request with unique reference
3. ~~Call SeerBit payment initialization API~~ → frontend opens `SeerbitPay()` popup with the reference
4. ~~Return checkout URL to frontend~~
5. User completes payment in the popup
6. Frontend calls `POST /wallet/deposit/verify { reference }`; SeerBit webhook is the backstop
7. ~~Verify webhook signature~~ → **re-query** `GET /payments/query/{ref}` (webhook body untrusted, §A.1)
8. Idempotently update deposit status and wallet balance from the query result
9. Send confirmation notification via `NotificationService` (§I)

### Withdrawal Flow
1. User submits withdrawal request
2. Validate sufficient available balance
3. Calculate withdrawal fee (tiered based on amount)
4. Lock amount in wallet (move from available to pending)
5. Create withdrawal request with PENDING status
6. Auto-approve if below threshold (₦50,000) OR require admin approval
7. For approved withdrawals: call SeerBit transfer API
8. Update status based on transfer result
9. Release lock or deduct from balance

### Transaction Limits
- Daily deposit limit: ₦1,000,000 (verified), ₦100,000 (unverified)
- Daily withdrawal limit: ₦500,000 (verified), ₦50,000 (unverified)
- Single transaction max: ₦200,000 (unverified), ₦1,000,000 (verified)
- Reset at midnight WAT

### Fee Structure
- Card deposit: 1.5% (passed to user or absorbed)
- Bank transfer deposit: Free
- Internal transfer: Free
- External transfer: ₦50 flat
- Withdrawal (< ₦10,000): ₦25
- Withdrawal (₦10,000 - ₦50,000): ₦50
- Withdrawal (> ₦50,000): 0.1% (max ₦500)

### KYC Requirements
- Unverified: Limited transactions, lower limits
- Verified (BVN/NIN): Full features, higher limits
- Manual review for large transactions (> ₦500,000)

### Balance Management
- Available: Immediately usable balance
- Pending: Funds locked in processing transactions
- Locked: Funds reserved for fixed savings, contributions
- Total Balance = Available + Pending + Locked

---

## SeerBit Integration *(superseded — see "As-Built Implementation Plan (v2)")*

> ⚠️ **SUPERSEDED / DO NOT IMPLEMENT AS WRITTEN.** Every SeerBit detail in this block
> was authored against an assumed API and is **wrong** against the real v2 API. Use the
> verified values in the [As-Built (v2)](#as-built-implementation-plan-v2--authoritative)
> section. Retained only to show the drift that was reconciled.
>
> | Legacy (wrong) | Verified v2 (authoritative) |
> |----------------|------------------------------|
> | base `https://gateway.seerbit.com` | `https://seerbitapi.com/api/v2` (REST); `https://checkout.seerbitapi.com/api/v2/seerbit.js` (inline SDK) |
> | `Authorization: Bearer {secret_key}` | `Bearer <encryptedKey>` from `POST /encrypt/keys` (`key: "<SECRET>.<PUBLIC>"`) |
> | `POST /payment/initialize` + `callback_url` redirect | inline `SeerbitPay()` popup on the frontend (no server init/redirect) |
> | `POST /transfer/disburse` | disbursement **not used** this phase (ledger + approval; feature-flagged `WALLET_LIVE_PAYOUTS`) |
> | `GET /transaction/verify/{reference}` | `GET /payments/query/{paymentReference}` |
> | `x-seerbit-signature` HMAC-SHA512 webhook | ⚠️ V2 webhook has **no default signature**; trust via **server-side re-query**, ack `{ ackReference, status:"received" }` |

### Configuration *(superseded)*
```typescript
{
  apiKey: process.env.SEERBIT_PUBLIC_KEY,
  secretKey: process.env.SEERBIT_SECRET_KEY,
  baseUrl: 'https://gateway.seerbit.com',   // ⚠️ WRONG — use https://seerbitapi.com/api/v2
  webhookSecret: process.env.SEERBIT_WEBHOOK_SECRET
}
```

### Payment Initialization *(superseded — deposit is now the inline SDK popup, §D)*
**Endpoint:** ~~POST /payment/initialize~~ — real flow: frontend `SeerbitPay()` popup, backend `POST /wallet/deposit/verify` → `GET /payments/query/{ref}`.

### Transfer Disbursement *(superseded — not used this phase, §F)*
**Endpoint:** ~~POST /transfer/disburse~~ — disbursement product not enabled; withdrawals are ledger + approval, live payout gated behind `WALLET_LIVE_PAYOUTS`.

### Transaction Verification *(superseded)*
**Endpoint:** ~~GET /transaction/verify/{reference}~~ → real: `GET https://seerbitapi.com/api/v2/payments/query/{paymentReference}` with `Bearer <encryptedKey>`.

### Webhook Signature Verification *(superseded — see As-Built A.1)*
```typescript
// ⚠️ UNVERIFIED — SeerBit V2 publishes no signature header/algorithm by default.
// Do NOT rely on this. Instead: re-query GET /payments/query/{ref} and credit from
// the query result only; return { ackReference, status: "received" } within 5s.
const signature = req.headers['x-seerbit-signature']; // not documented by SeerBit
```

---

## Security Requirements

### Transaction Security
- Idempotency keys for all financial operations
- Double-entry bookkeeping principle
- ACID transactions for balance updates
- Audit trail for all transactions
- Signature verification for webhooks

### Access Control
- Users can only access their own wallet
- Role-based admin access for wallet management
- Multi-level approval for large withdrawals
- IP whitelisting for admin operations

### Fraud Prevention
- Velocity checks (multiple rapid transactions)
- Unusual pattern detection
- Device fingerprinting
- Geolocation checks
- Blacklist monitoring

### Data Protection
- Encrypt sensitive data at rest (account numbers)
- PCI DSS compliance for card data (handled by SeerBit)
- Never store CVV or full card numbers
- Mask account numbers in logs

---

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "WALLET_001",
    "message": "Insufficient balance",
    "details": {
      "required": 50000,
      "available": 30000
    }
  }
}
```

### Error Codes
- WALLET_001: Insufficient balance
- WALLET_002: Wallet not found
- WALLET_003: Wallet suspended
- WALLET_004: Daily limit exceeded
- WALLET_005: Monthly limit exceeded
- WALLET_006: Invalid bank account
- WALLET_007: Bank resolution failed
- WALLET_008: Deposit failed
- WALLET_009: Withdrawal failed
- WALLET_010: Transaction not found
- WALLET_011: Invalid webhook signature
- WALLET_012: Duplicate transaction
- WALLET_013: KYC required
- WALLET_014: Minimum amount not met
- WALLET_015: Maximum amount exceeded
- WALLET_016: Recipient not found (internal transfer — no `users` doc for that email)
- WALLET_017: Self-transfer not allowed
- WALLET_018: Live payouts disabled (`WALLET_LIVE_PAYOUTS=false` — withdrawal stays ledger/approval)
- WALLET_019: Deposit verification mismatch (SeerBit amount/currency ≠ DepositRequest)
- WALLET_020: Deposit not confirmed by SeerBit (query status ≠ SUCCESS)

---

## Testing Requirements

### Unit Tests
- Balance calculations
- Fee calculations
- Limit validations
- Transaction status transitions
- Webhook signature verification

### Integration Tests
- Complete deposit flow (mock SeerBit)
- Complete withdrawal flow
- Internal transfers
- Bank account resolution
- Webhook processing

### Security Tests
- Unauthorized access attempts
- Race condition testing (double-spend)
- Webhook spoofing attempts
- Input validation bypass attempts

### Performance Tests
- High-volume transaction processing
- Concurrent withdrawal requests
- Database query optimization

---

## Performance Specifications

### Response Time Targets
- Balance fetch: < 100ms (p95)
- Transaction history: < 300ms (p95)
- Deposit initiation: < 500ms (p95)
- Withdrawal request: < 300ms (p95)
- Bank resolution: < 1000ms (p95)

### Throughput
- Handle 1000 transactions per second
- Process 10,000 deposits per day
- Process 5,000 withdrawals per day

### Database Indexing
- Unique index on walletNumber
- Compound index on walletId + createdAt (transactions)
- Unique index on reference (transactions)
- Index on status + createdAt (withdrawals)
- TTL index on expired deposits

---

## Monitoring & Observability

### Metrics to Track
- Total wallet balances (aggregate)
- Deposit volume and success rate
- Withdrawal volume and success rate
- Average transaction amounts
- Failed transaction reasons
- SeerBit API response times
- Webhook processing latency

### Alerts
- High failure rate (>5% in 10 min)
- Large unusual transactions (>₦1M)
- Multiple failed withdrawal attempts
- SeerBit API errors
- Webhook processing failures
- Negative balance attempts

### Audit Logging
- All balance changes
- All transaction creations and updates
- Admin actions on wallets
- Webhook events received and processed

---

## Notifications

### Email Templates
1. Deposit Successful
2. Deposit Failed
3. Withdrawal Requested
4. Withdrawal Approved
5. Withdrawal Completed
6. Withdrawal Rejected
7. Low Balance Alert
8. Large Transaction Alert

### SMS Templates
1. Deposit Confirmation
2. Withdrawal Confirmation
3. Security Alert (unusual activity)

### Push Notifications
1. Real-time transaction updates
2. Pending withdrawal approvals
3. Limit threshold warnings

---

## Environment Variables Required

> ⚠️ SeerBit vars below are reconciled in **As-Built §K** (authoritative). Key
> corrections: `SEERBIT_BASE_URL=https://seerbitapi.com/api/v2` (not `gateway.seerbit.com`),
> add `VITE_SEERBIT_PUBLIC_KEY` (frontend) and `WALLET_LIVE_PAYOUTS=false` (feature flag);
> `SEERBIT_WEBHOOK_SECRET` is a **placeholder** (unused until SeerBit exposes signing).

```bash
# SeerBit Configuration  (⚠️ see As-Built §K — corrected values)
SEERBIT_PUBLIC_KEY=pk_test_xxx
SEERBIT_SECRET_KEY=sk_test_xxx
SEERBIT_WEBHOOK_SECRET=whsec_xxx           # placeholder — unused this phase (A.1)
SEERBIT_BASE_URL=https://seerbitapi.com/api/v2   # REST API (was gateway.seerbit.com — wrong)
VITE_SEERBIT_PUBLIC_KEY=pk_test_xxx        # frontend inline SDK (public key only)
WALLET_LIVE_PAYOUTS=false                  # gate live disbursement (§E/§F)

# Wallet Configuration
WALLET_NUMBER_PREFIX=WLT
DEFAULT_DAILY_LIMIT=500000
DEFAULT_MONTHLY_LIMIT=5000000
MIN_DEPOSIT_AMOUNT=100
MAX_DEPOSIT_AMOUNT=1000000
MIN_WITHDRAWAL_AMOUNT=500
MAX_WITHDRAWAL_AMOUNT=500000

# Fee Configuration
CARD_DEPOSIT_FEE_PERCENT=1.5
WITHDRAWAL_FEE_FLAT=50
WITHDRAWAL_FEE_PERCENT=0.1
MAX_WITHDRAWAL_FEE=500

# Approval Thresholds
AUTO_APPROVE_WITHDRAWAL_THRESHOLD=50000
MANUAL_REVIEW_TRANSACTION_THRESHOLD=500000

# Security
WEBHOOK_SIGNATURE_HEADER=x-seerbit-signature
ENCRYPTION_KEY=your_encryption_key
```

---

## Implementation Checklist

- [ ] Set up Wallet schema and model
- [ ] Set up Transaction schema and model
- [ ] Set up WithdrawalRequest schema and model
- [ ] Set up DepositRequest schema and model
- [ ] Implement WalletService with balance management
- [ ] Implement TransactionService with double-entry logic
- [ ] Implement SeerBitService for payment integration
- [ ] Implement DepositController with SeerBit integration
- [ ] Implement WithdrawalController with approval workflow
- [ ] Implement TransferService for internal/external transfers
- [ ] Implement BankAccountService with resolution
- [ ] Create webhook handler for SeerBit callbacks
- [ ] Implement signature verification for webhooks
- [ ] Add idempotency middleware
- [ ] Implement transaction limits and validations
- [ ] Create admin endpoints for wallet management
- [ ] Write comprehensive unit tests
- [ ] Write integration tests with mocked SeerBit
- [ ] Security audit and penetration testing
- [ ] Performance testing under load
- [ ] Set up monitoring and alerts
- [ ] API documentation with Swagger
- [ ] Deploy to staging
- [ ] Test with SeerBit sandbox
- [ ] Production deployment with SeerBit live keys

---

## Dependencies

### Core Dependencies
- @nestjs/core, @nestjs/common, @nestjs/mongoose
- mongoose
- @nestjs/config
- class-validator, class-transformer
- axios (for SeerBit API calls)
- crypto (built-in, for signatures)
- uuid

### Optional Dependencies
- bull/bullmq (for background job processing)
- redis (for caching and rate limiting)

---

## Future Enhancements

1. Multi-currency wallet support
2. Virtual dollar cards
3. Recurring payments/scheduled transfers
4. Bill payments integration
5. Airtime/data purchase
6. Investment products integration
7. Peer-to-peer lending
8. Micro-insurance products
9. Loyalty points system
10. Advanced analytics dashboard
