# Admin PRD: Global System Settings & Configuration

> **Status legend:** ✅ implemented in code · 📄 specified here, not yet coded
> **Overall module status: 📄** (no admin settings code exists yet)
>
> Live blueprint for `admin-dev` governing the single global **`settings`** collection — the
> DB-driven configuration surface that admins view/update and that the rest of the platform reads at
> runtime instead of hard-coded env values.

---

## 1. Overview

Today, operational parameters live in scattered env vars across the user PRDs (SeerBit keys, fee
tiers, wallet limits, platform fees, escrow windows, savings APY). This module consolidates them into
a **structured, grouped, DB-driven `settings` collection** that admins manage from the portal.
Env vars become **bootstrap seeds** only; the running platform reads settings from the DB (cached),
so operators can change fees, limits, and toggles without a redeploy.

Setting groups covered: **payment gateway (SeerBit)**, **savings/interest defaults**, **commission &
tax-withholding**, **platform fees (marketplace / services escrow)**, **wallet limits & withdrawal
fee tiers**, **KYC toggles**, **membership duration/renewal policy** (tier pricing + privileges are
owned by `membershipTiers`, **not** here — see SSOT note in [§3.7](#37-membership--settingsupdate)),
**feature flags**, **maintenance mode**, **email / OneSignal config**, and **security policy**
(lockout, token TTLs, admin IP allowlist).

> **Config SSOT (finalized):** this `settings` collection owns platform-wide **fees / rates / tax /
> limits**; the **`membershipTiers`** collection owns **tier pricing + privileges**. See
> [README → Configuration SSOT](../README.md#configuration-single-source-of-truth-ssot).

**Conventions (shared — see `PRD/admin_module/README.md` for the authoritative RBAC taxonomy):**

- Backend `/api/v1/admin/*`; admin frontend `/bennie/*`.
- Admin identity = **`adminUsers`**; authz = **`adminRoles`** (`resource:action`) + per-admin
  overrides; **Super Admin = `*`**. Enforced by `PermissionsGuard`.
- Three graded permissions:
  - **`settings:view`** — read settings (secrets masked).
  - **`settings:update`** — edit non-sensitive operational values (fees, limits, toggles, pricing).
  - **`settings:configure`** — edit **sensitive/security** groups (SeerBit secret keys, security
    policy, admin IP allowlist, maintenance mode). **Super-Admin-only and NOT delegable** per the
    [README Super-Admin-only permission set](../README.md#super-admin-only-permission-set-finalized--not-delegable).
- **Every mutation writes an `adminAuditLog`** entry (`actor`, `action`, `group`, `keys changed`,
  `before/after` with secrets redacted, `timestamp`, `ip`, `userAgent`). Reading secret values is
  itself audited.

---

## 2. Collections / Schema

### 2.1 `settings` 📄 (single-document-per-group, admin-owned)

One document per **group** (not one giant blob), so RBAC and audit can be scoped per group and reads
can be cached independently.

```typescript
{
  _id: ObjectId;
  group: string;                // unique; e.g. "payment", "wallet", "security" (enum below)
  values: Record<string, any>;  // the group's structured settings (shapes in §3)
  sensitive: boolean;           // true → secrets, masked on read, gated to settings:configure
  version: number;              // incremented every update (optimistic concurrency)
  updatedBy: ObjectId;          // ref adminUsers
  updatedAt: Date;
  createdAt: Date;
}
```

**Group enum:** `payment | savings | commission | platformFees | wallet | kyc | membership |
featureFlags | maintenance | notifications | security`.

### 2.2 `settingChangeLog` 📄 (admin-owned; append-only, in addition to `adminAuditLog`)

A settings-specific history enabling per-key diff and rollback.

```typescript
{
  _id: ObjectId;
  group: string;
  key: string;                  // dotted path within values, e.g. "seerbit.secretKey"
  oldValue: any;                // secrets stored as "***REDACTED***"
  newValue: any;                // secrets stored as "***REDACTED***"
  version: number;              // resulting version
  changedBy: ObjectId;          // ref adminUsers
  changedAt: Date;
}
```

### 2.3 Secret handling

- Secret keys (SeerBit `secretKey` / `webhookSecret`, SMTP password, OneSignal REST API key,
  encryption key) are **encrypted at rest** and **never returned in plaintext** — reads return a
  masked form (`pk_test_••••1234`). A dedicated write-only field pattern is used for updates. This
  mirrors the PCI-DSS posture in [PRD 02](../../user_module/wallet/digital-wallet-seerbit.md) (card
  data handled by SeerBit; never store CVV/full PAN) and NDPA "access controls + encryption"
  expectations (see [§10](#10-compliance-notes)).

---

## 3. Setting groups (structured `values` shapes) & consuming app areas

Each subsection gives the `values` shape and **which app areas read it** (so `admin-dev` and the
`-dev` teams know the read dependencies). Env-var column = the bootstrap seed.

### 3.1 `payment` (SeerBit) — `sensitive: true`

```typescript
{
  seerbit: {
    publicKey: string;          // seed: SEERBIT_PUBLIC_KEY
    secretKey: string;          // SECRET — seed: SEERBIT_SECRET_KEY (masked on read)
    webhookSecret: string;      // SECRET — seed: SEERBIT_WEBHOOK_SECRET (masked)
    baseUrl: string;            // seed: SEERBIT_BASE_URL
    webhookSignatureHeader: string; // default "x-seerbit-signature"
  };
  autoApproveWithdrawalThresholdNgn: number; // seed: AUTO_APPROVE_WITHDRAWAL_THRESHOLD (50000)
  manualReviewTransactionThresholdNgn: number; // seed: MANUAL_REVIEW_TRANSACTION_THRESHOLD (500000)
}
```
**Read by:** wallet deposit/withdrawal/transfer flows, SeerBit webhook verification, admin withdrawal
approval queue (threshold).

### 3.2 `savings` — `settings:update`

```typescript
{
  defaultTargetApyPercent: number;   // Target savings APY
  defaultFixedApyPercent: number;    // Fixed-lock APY
  defaultHarvestApyPercent: number;  // Harvest-plan APY
  fixedLockMinDays: number;
  earlyWithdrawalPenaltyPercent: number;
}
```
**Read by:** savings module (interest accrual, product creation, early-withdrawal penalty).

### 3.3 `commission` — `settings:update`

```typescript
{
  agentCommissionRates: {            // per activity, % or flat NGN
    farmerRegistration: number;
    membershipUpgrade: number;
    savingsDeposit: number;
    equipmentBooking: number;
    marketplacePurchase: number;
  };
  taxWithholdingPercent: number;     // WHT on agent commissions / payouts
}
```
**Read by:** agent-dashboard commission engine, payout/settlement, tax reporting.

### 3.4 `platformFees` — `settings:update`

```typescript
{
  marketplaceFeePercent: number;     // seed: PLATFORM_FEE_PERCENT (5) — e-commerce orders
  marketplaceFeeCapNgn: number | null;
  servicesEscrowCommissionPercent: number; // seed: PLATFORM_COMMISSION_PERCENT (12)
  servicesEscrowReleaseDays: number; // seed: ESCROW_RELEASE_DAYS (3)
  equipmentDepositPercent: number;   // seed: DEPOSIT_PERCENTAGE (20)
}
```
**Read by:** e-commerce checkout ([`marketplace.md`](../marketplace/marketplace.md)), agric-services
escrow release, equipment deposit calc ([`equipment_booking.md`](../equipment_booking/equipment_booking.md)).
> Note: the marketplace fee here is the **same value** surfaced in
> `marketplace.md`'s `marketplaceSettings`; `settings` is the single source of truth and
> `marketplace.md` reads from this group. Confirm ownership to avoid duplication
> ([§11](#11-open-questions-for-the-owner)).

### 3.5 `wallet` — limits `settings:update`; fee tiers `settings:update`

```typescript
{
  defaultDailyLimitNgn: number;      // seed: DEFAULT_DAILY_LIMIT (500000)
  defaultMonthlyLimitNgn: number;    // seed: DEFAULT_MONTHLY_LIMIT (5000000)
  minDepositNgn: number;             // seed: MIN_DEPOSIT_AMOUNT
  maxDepositNgn: number;             // seed: MAX_DEPOSIT_AMOUNT
  minWithdrawalNgn: number;          // seed: MIN_WITHDRAWAL_AMOUNT
  maxWithdrawalNgn: number;          // seed: MAX_WITHDRAWAL_AMOUNT
  cardDepositFeePercent: number;     // seed: CARD_DEPOSIT_FEE_PERCENT (1.5)
  withdrawalFeeTiers: [              // evaluated in order; first matching band applies
    { maxAmountNgn: number | null; flatNgn?: number; percent?: number; capNgn?: number }
  ];
  verifiedLimitMultiplier: number;   // KYC-verified users get higher limits
}
```
**Read by:** wallet deposit/withdrawal fee calc + limit enforcement (mirrors PRD 02 fee structure).
Example `withdrawalFeeTiers` seeding PRD 02's tiers: `{maxAmountNgn:10000,flatNgn:25}`,
`{maxAmountNgn:50000,flatNgn:50}`, `{maxAmountNgn:null,percent:0.1,capNgn:500}`.

### 3.6 `kyc` — `settings:update`

```typescript
{
  requireKycForWithdrawal: boolean;
  requireKycAboveNgn: number;        // txns above this force KYC
  requireKycForShares: boolean;
  acceptedIdTypes: string[];         // ["NIN","BVN","Voters Card","National ID"]
  autoVerifyBvnNin: boolean;         // integrate identity provider vs manual review
}
```
**Read by:** wallet limits/gating, shares purchase, agent KYC flow, onboarding.

### 3.7 `membership` — `settings:update`

```typescript
{
  // NOTE: tier PRICING + PRIVILEGES are NOT owned here.
  membershipDurationDays: number;    // default 365
  autoRenew: boolean;
  gracePeriodDays: number;
}
```
**Read by:** membership upgrade/renew, dashboard membership card.

> **SSOT (finalized):** tier **pricing + privileges** (Bronze/Silver/Gold/Platinum annual cost,
> discounts, share caps, priority flags) are owned by the **`membershipTiers`** collection, **not** by
> this group. Any legacy `settings.membership.pricing`/`tierPricing` field is **retired** as an
> authoritative source (kept only as a convenience mirror if present); consumers read tier pricing from
> `membershipTiers`. See [membership_tiers.md](../membership_tiers/membership_tiers.md) and
> [README → Configuration SSOT](../README.md#configuration-single-source-of-truth-ssot). This
> `membership` group retains only membership **duration/renewal** policy.

### 3.8 `featureFlags` — `settings:update`

```typescript
{
  marketplaceEnabled: boolean;
  servicesEnabled: boolean;
  equipmentBookingEnabled: boolean;
  adasheEnabled: boolean;
  sharesEnabled: boolean;
  agentProgramEnabled: boolean;
  [flagKey: string]: boolean;        // extensible
}
```
**Read by:** every module (feature gating) and the frontend nav (hides disabled tabs).

### 3.9 `maintenance` — `settings:configure` (sensitive)

```typescript
{
  maintenanceMode: boolean;          // true → user API returns 503 with banner message
  message: string;
  allowedRoles: string[];            // roles that bypass, e.g. ["admin","super_admin"]
  scheduledStart?: Date;
  scheduledEnd?: Date;
}
```
**Read by:** a global maintenance guard/interceptor on user API; frontend banner.

### 3.10 `notifications` (email / OneSignal) — `settings:configure` (secrets)

```typescript
{
  smtp: { host: string; port: number; user: string; password: string; from: string }; // password SECRET
  oneSignal: { appId: string; restApiKey: string; enabled: boolean };                  // restApiKey SECRET
  channels: { emailEnabled: boolean; smsEnabled: boolean; pushEnabled: boolean };
}
```
**Read by:** notification service (transactional email, push). OneSignal integration per
[`PRD/oneSignal.md`](../../oneSignal.md).

### 3.11 `security` — `settings:configure` (sensitive)

```typescript
{
  maxFailedLoginAttempts: number;    // default 5 (matches user.schema lockout)
  lockoutMinutes: number;            // default 15
  accessTokenTtlSeconds: number;     // default 900
  refreshTokenTtlDays: number;
  passwordResetTtlMinutes: number;   // default 60
  require2faForAdmins: boolean;      // admin TOTP requirement
  adminIpAllowlist: string[];        // CIDR/IP; empty = allow all (see README admin RBAC)
  adminSessionIdleMinutes: number;
}
```
**Read by:** auth service (lockout, token TTLs, reset TTL), **admin auth guard** (2FA + IP allowlist),
password-reset flow. Values here override the corresponding user.schema/env defaults at runtime.

---

## 4. Endpoints

All under `/api/v1/admin`. All require a valid admin JWT + the listed permission.

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/settings` | `settings:view` | All groups (secrets masked) |
| GET | `/settings/:group` | `settings:view` | One group (secrets masked) |
| PATCH | `/settings/:group` | `settings:update`* | Update a group's values (partial/merge) |
| GET | `/settings/:group/history` | `settings:view` | `settingChangeLog` for the group |
| POST | `/settings/:group/rollback` | `settings:configure` | Roll a group back to a prior version |
| POST | `/settings/maintenance/toggle` | `settings:configure` | Shortcut to enter/exit maintenance mode |

`*` PATCH requires **`settings:configure`** (not `settings:update`) when `:group` is a
`sensitive` group (`payment`, `maintenance`, `notifications`, `security`). The guard resolves this
from the target group's `sensitive` flag. **`settings:configure` is Super-Admin-only and
non-delegable** — so sensitive groups, `rollback`, and the maintenance toggle can be edited by Super
Admin only; `settings:update` (non-sensitive groups) remains delegable to sub-admins.

**GET `/settings/payment` — response (secrets masked):**
```json
{
  "success": true,
  "data": {
    "group": "payment", "sensitive": true, "version": 7,
    "values": {
      "seerbit": { "publicKey": "pk_live_••••8821", "secretKey": "***MASKED***",
                   "webhookSecret": "***MASKED***", "baseUrl": "https://gateway.seerbit.com",
                   "webhookSignatureHeader": "x-seerbit-signature" },
      "autoApproveWithdrawalThresholdNgn": 50000,
      "manualReviewTransactionThresholdNgn": 500000
    },
    "updatedAt": "2026-06-30T14:00:00Z"
  }
}
```

**PATCH `/settings/wallet` — request (partial merge + optimistic concurrency):**
```json
{
  "version": 4,
  "values": {
    "maxWithdrawalNgn": 750000,
    "withdrawalFeeTiers": [
      { "maxAmountNgn": 10000, "flatNgn": 25 },
      { "maxAmountNgn": 50000, "flatNgn": 50 },
      { "maxAmountNgn": null, "percent": 0.1, "capNgn": 500 }
    ]
  }
}
```
`version` must equal the current stored version or the update is rejected (`SET_ADM_004`) to prevent
lost updates from concurrent admins. **Response 200** returns the new `version` and a per-key diff.

**PATCH `/settings/payment` — updating a secret (write-only field):**
```json
{ "version": 7, "values": { "seerbit": { "secretKey": "sk_live_newkeyvalue" } } }
```
A non-masked, non-empty secret value replaces the encrypted secret; sending `"***MASKED***"` or
omitting the key leaves it unchanged.

---

## 5. Business rules & state machine

- **DB-driven config precedence:** at boot the config service seeds any missing `settings` groups
  from env vars, then serves all runtime reads from the DB (with a short-TTL cache invalidated on
  `PATCH`). Env vars are never read again after seeding except as fallbacks for absent keys.
- **Optimistic concurrency:** each group carries a `version`; `PATCH`/`rollback` require the caller's
  `version` to match, else `SET_ADM_004`.
- **Cache invalidation:** on any group update, the config cache for that group is invalidated and a
  `settings.changed` event is emitted so long-lived workers reload.
- **Maintenance-mode toggle** is a small state machine:
  `NORMAL ──toggle on──► MAINTENANCE (user API → 503) ──toggle off──► NORMAL`. Admins in
  `allowedRoles` bypass; scheduled windows auto-enter/exit.
- **Rollback** creates a new forward version whose `values` equal a chosen prior version (never
  mutates history); fully audited.
- **Secret rotation** (e.g. SeerBit key) does not break in-flight webhook verification: the previous
  webhook secret may be honored for a short grace window if configured — **flagged**
  ([§11](#11-open-questions-for-the-owner)).

---

## 6. Validation

- Percentage fields (`*Percent`): number `0–100`, max 2 decimals.
- NGN fields: integer `>= 0`; `min* <= max*` (e.g. `minWithdrawalNgn <= maxWithdrawalNgn`).
- `withdrawalFeeTiers`: ordered bands; exactly one open-ended band (`maxAmountNgn: null`) at the end;
  no overlapping thresholds.
- `adminIpAllowlist`: each entry a valid IPv4/IPv6 or CIDR.
- Token TTLs: positive integers; `accessTokenTtlSeconds < refreshTokenTtlDays` (in comparable units).
- `group` path param must be a known group enum value; unknown → `SET_ADM_002`.
- Secret fields cannot be set to an empty string (would wipe a live credential) — use a dedicated
  "clear secret" flag instead (`SET_ADM_006`).
- `maintenanceMode`, security-policy, and payment-secret edits **require `settings:configure`**;
  attempting them with only `settings:update` → `SET_ADM_005`.

---

## 7. Audit events

| Action | Trigger | Severity |
|--------|---------|----------|
| `settings.view_secret` | reading a `sensitive` group | **high** (access to secrets) |
| `settings.update` | PATCH group (non-sensitive) | normal |
| `settings.update_sensitive` | PATCH `payment`/`security`/`notifications` | **high** |
| `settings.rollback` | rollback to prior version | **high** |
| `settings.maintenance.toggle` | maintenance on/off | **high** |

Each entry records `actor`, `group`, `changedKeys[]`, `before/after` (secrets redacted to
`***REDACTED***`), `version`, `timestamp`, `ip`, `userAgent`. This satisfies the NDPA/GAID
expectation of auditable access controls and change tracking over systems processing personal and
financial data (see [§10](#10-compliance-notes)).

---

## 8. Error codes

```json
{ "success": false, "error": { "code": "SET_ADM_004", "message": "Version conflict — settings changed by another admin", "details": { "expected": 4, "current": 6 } } }
```

| Code | Meaning |
|------|---------|
| `SET_ADM_001` | Setting group not found |
| `SET_ADM_002` | Unknown setting group |
| `SET_ADM_003` | Invalid value (validation failure) |
| `SET_ADM_004` | Version conflict (optimistic concurrency) |
| `SET_ADM_005` | Insufficient permission (sensitive group needs settings:configure) |
| `SET_ADM_006` | Secret cannot be set to empty |
| `SET_ADM_007` | Invalid fee-tier definition |
| `SET_ADM_008` | Invalid IP/CIDR in admin allowlist |
| `SET_ADM_009` | Rollback target version not found |

---

## 9. Admin UI / Section (premium UX)

Route base `/bennie/settings`. Rich, grouped config console — no basic UI.

- **Settings hub** — left-nav of groups (Payment, Savings, Commission, Platform Fees, Wallet, KYC,
  Membership, Feature Flags, Maintenance, Notifications, Security), each a **form panel** with grouped
  fields, inline validation, and a sticky "Save changes" bar showing a **diff preview** before commit.
- **Sensitive groups** show a lock icon; fields are disabled for admins lacking `settings:configure`,
  and secret fields render as masked with a "Reveal is audited" / "Set new value" affordance.
- **Save flow** — confirm modal listing the exact keys changing (old → new, secrets shown as masked);
  optimistic-concurrency guard surfaces a "changed by another admin" warning with a refresh option.
- **Fee-tier editor** — table builder for `withdrawalFeeTiers` (add/remove/reorder bands) with live
  "example fee for ₦X" preview.
- **Feature flags** — toggle grid with instant-effect warning.
- **Maintenance mode** — prominent toggle with scheduled-window picker and a preview of the user-facing
  banner; entering maintenance requires an extra confirm.
- **History & rollback** — per-group **change-log timeline** (who/when/what, secrets redacted) with a
  one-click **rollback to version N** (confirm modal).
- **Charts/context** where useful (e.g. effective fee revenue if marketplace fee changes).

---

## 10. Compliance notes

- **NDPA / GAID (Nigeria).** The Nigeria Data Protection Act (NDPA 2023) and its General Application
  and Implementation Directive (GAID, effective 19 Sep 2025) require appropriate **technical and
  organisational measures** — including **access controls, encryption**, and periodic **compliance
  audits** — over systems processing personal data, plus **72-hour breach notification**. This module
  supports that via graded RBAC (`settings:view/update/configure`), encrypted-at-rest secrets, the
  admin IP allowlist + 2FA policy, and the append-only `settingChangeLog`/`adminAuditLog`.
- **PCI-DSS.** Card data is handled entirely by SeerBit; the platform never stores CVV/full PAN
  (per [PRD 02](../../user_module/wallet/digital-wallet-seerbit.md)). SeerBit secret/webhook keys are
  encrypted at rest and never returned in plaintext by this module.

Sources:
- [ICLG — Data Protection Laws and Regulations Nigeria 2025-2026](https://iclg.com/practice-areas/data-protection-laws-and-regulations/nigeria/)
- [Nigeria Data Protection Commission (NDPC)](https://ndpc.gov.ng/)
- [NDPA compliance audit and requirements — nigeriadataprotection.com](https://nigeriadataprotection.com/ndpa-compliance-audit-and-requirements/)

---

## 11. Environment variables (bootstrap seeds only)

All below seed the corresponding `settings` group on first run; runtime reads come from the DB.

```bash
# payment
SEERBIT_PUBLIC_KEY=pk_test_xxx
SEERBIT_SECRET_KEY=sk_test_xxx
SEERBIT_WEBHOOK_SECRET=whsec_xxx
SEERBIT_BASE_URL=https://gateway.seerbit.com
AUTO_APPROVE_WITHDRAWAL_THRESHOLD=50000
MANUAL_REVIEW_TRANSACTION_THRESHOLD=500000
# wallet
DEFAULT_DAILY_LIMIT=500000
DEFAULT_MONTHLY_LIMIT=5000000
MIN_DEPOSIT_AMOUNT=100
MAX_DEPOSIT_AMOUNT=1000000
MIN_WITHDRAWAL_AMOUNT=500
MAX_WITHDRAWAL_AMOUNT=500000
CARD_DEPOSIT_FEE_PERCENT=1.5
# platform fees
PLATFORM_FEE_PERCENT=5
PLATFORM_COMMISSION_PERCENT=12
ESCROW_RELEASE_DAYS=3
DEPOSIT_PERCENTAGE=20
# security
ACCESS_TOKEN_TTL_SECONDS=900
MAX_FAILED_LOGIN_ATTEMPTS=5
LOCKOUT_MINUTES=15
PASSWORD_RESET_TTL_MINUTES=60
REQUIRE_2FA_FOR_ADMINS=true
# notifications
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
ONESIGNAL_APP_ID=...
ONESIGNAL_REST_API_KEY=...
# security (encryption for secrets at rest)
ENCRYPTION_KEY=your_encryption_key
```

---

## 12. Open questions for the owner

1. **Ownership of `platformFees.marketplaceFeePercent` — RESOLVED.** `settings` (this collection) is the
   single source of truth for platform fees; `marketplace.md` **reads** from it. (Separately,
   **tier pricing + privileges** are owned by `membershipTiers`, not by `settings.membership`.)
2. **`settings:configure` scope — RESOLVED.** The sensitive groups (`payment`, `security`,
   `maintenance`, `notifications`), `rollback`, and the maintenance toggle require
   **`settings:configure`, which is Super-Admin-only and non-delegable**
   ([README](../README.md#super-admin-only-permission-set-finalized--not-delegable)). Non-sensitive
   `settings:update` remains delegable.
3. **Secret storage.** Confirm the encryption-at-rest mechanism for secrets (app-level `ENCRYPTION_KEY`
   vs. a secrets manager / KMS) and the webhook-secret rotation grace window.
4. **Admin IP allowlist enforcement point.** Confirm the allowlist is enforced at the admin auth guard
   (and whether it also gates the SeerBit webhook endpoints), and how it interacts with the
   README's admin RBAC/2FA spec (avoid duplicate definition).
5. **Commission rate units.** Are `agentCommissionRates` percentages or flat NGN per activity? The
   user PRD 10 model should confirm before the commission engine reads this group.
6. **Feature-flag granularity.** Should flags be global only, or also per-cooperative / per-region?
