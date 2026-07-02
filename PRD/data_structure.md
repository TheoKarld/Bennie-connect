# Data Structures Reference

This document catalogs **every data structure (JSON document / MongoDB collection / DTO)** in the Bennie-connect Cooperative Farming Portal as **annotated JSON shapes**, derived from a review of the entire codebase.

Each structure is shown as a JSON object whose **values are the field's type** (TypeScript-style). Notation used inside the `jsonc` blocks:

- `"field": "type"` — the value string is the type, not sample data.
- `// optional` — the field may be absent (declared `?` in source).
- Enum types (e.g. `MembershipTierStr`) are defined once in [§0 Enums](#0-enums-shared-value-sets) and referenced by name.
- `[ { … } ]` — an array of the inlined object shape.

The system has **two persistence layers**, not yet wired together:

| Layer | Where | Format | Source of truth in code |
|-------|-------|--------|--------------------------|
| **Frontend client state** | Browser `localStorage`, key `KM_FARMER_PORTAL_STATE_REAL` | One JSON blob (`FarmerAppState`) | `src/types.ts`, seeded by `src/data.ts` + `src/default_marketplace_data.ts` |
| **Backend persistence** | MongoDB (Mongoose) | BSON documents per collection | `backend/src/**/schemas/*.ts`, DTOs in `backend/src/**/dto/*.ts` |

**Status legend:** ✅ implemented in code · 📄 specified in a PRD but not yet coded · 🔗 referenced by an implemented schema but the target schema does not exist yet.

> ⚠️ **Divergence warning.** The frontend model and the backend `User` schema were built independently and disagree in several places. See [§4 Cross-cutting notes](#4-cross-cutting-notes-conventions--divergences).

---

## 0. Enums (shared value sets)

```jsonc
{
  "MembershipTierStr":   ["Bronze", "Silver", "Gold", "Platinum"],
  "PaymentGatewayType":  ["Paystack", "Flutterwave", "Monnify"],
  "TransactionType":     ["deposit", "withdraw", "transfer", "savings_transfer",
                          "share_purchase", "share_sale", "dividend_payment", "membership_fee"],
  "AgentLevel":          ["Bronze Agent", "Silver Agent", "Gold Agent", "Platinum Agent"],
  "EquipmentType":       ["Tractors", "Harvesters", "Planters", "Threshers",
                          "Irrigation Systems", "Drone Sprayers", "Fertigation Drones", "Transport Trucks"],
  "ServiceCategoryName": ["Soil Testing", "Farm Mapping", "Precision Agriculture (IOT sensors)",
                          "Drone Services", "Farm Consultancy", "Equipment Repairs", "Greenhouse Design",
                          "Greenhouse Construction", "Irrigation Installation", "Data Analytics",
                          "Farm Auditing", "Farm Insurance", "Agricultural Training"],
  "ProductCategoryName": ["Seeds", "Fertilizers", "Agrochemicals", "Farm Equipment",
                          "Livestock Inputs", "Irrigation Equipment", "Greenhouse Materials", "Farm Produce"],
  "IdentityType":        ["NIN", "BVN", "Voters Card", "National ID"],
  "KycStatus":           ["Pending", "Verified", "Rejected"],
  "BackendUserRole":     ["farmer", "agent", "admin", "super_admin"],

  // Admin module (§7) — RBAC value sets. These are DB-driven (roles live in the
  // `adminRoles` collection), so the list below is the seed/system baseline, not a closed enum.
  "AdminStatus":         ["ACTIVE", "SUSPENDED"],
  "AdminSystemRole":     ["SUPER_ADMIN", "ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "CONTENT_ADMIN"], // seed roles in `adminRoles`
  "AdminPermission":     "string"   // granular grant string, format "resource:action" | "resource:*" | "*" — see §7 permission-taxonomy note
}
```

> **Permission-taxonomy cross-reference.** `BackendUserRole` (`farmer|agent|admin|super_admin`) is the role on the **end-user** `users` collection (§2.1) and gates the *public* API. The **admin module** (§7) has its own identity plane: `adminUsers` carry a DB-driven `role` (→ `adminRoles`) plus fine-grained `AdminPermission` grant strings, independent of `BackendUserRole`. Destructive / financial-reversal actions are reserved for `isSuperAdmin` admins (mirrors the "super_admin" reservation in the user-role model). ⚠️ Flagged for the owner: the code does not yet implement a separate `adminUsers` collection — today an admin is just a `users` doc with `role: "admin"|"super_admin"`. §7 documents the *planned* dedicated admin identity plane.

---

## 1. Frontend Client State — `FarmerAppState` ✅

The entire running app is one object persisted to `localStorage`. Defined in `src/types.ts:274`, seeded by `INITIAL_APP_STATE` in `src/data.ts:72`. `// optional` fields are back-filled by the `App.tsx` initializer for older stored state.

```jsonc
// FarmerAppState — the localStorage document (key: "KM_FARMER_PORTAL_STATE_REAL")
{
  "walletBalance": "number",                    // NGN
  "walletTransactions": "WalletTransaction[]",
  "membership": "MembershipInfo",
  "membershipHistory": "MembershipHistoryItem[]",
  "flexSaveBalance": "number",                  // NGN, instant-access savings
  "flexSaveAccruedInterest": "number",          // NGN
  "targetGoals": "TargetSavingGoal[]",
  "fixedLocks": "FixedSaveLock[]",
  "harvestPlans": "HarvestSavePlan[]",
  "shares": "SharePortfolio",
  "bookings": "AgriBooking[]",
  "contributionGroups": "ContributionGroup[]",
  "notifications": "FarmerNotification[]",
  "serviceCategories": "ServiceCategory[]",     // optional
  "serviceBookings": "ServiceBooking[]",        // optional
  "products": "Product[]",                       // optional
  "orders": "ProductOrder[]",                    // optional
  "cart": "CartItem[]",                          // optional
  "agentLevel": "AgentLevel",                    // optional
  "registeredFarmers": "RegisteredFarmer[]",     // optional
  "commissionRewards": "CommissionReward[]",     // optional
  "agentRanking": "number"                       // optional
}
```

### 1.1 Membership

```jsonc
// MembershipInfo (types.ts:8)
{
  "tier": "MembershipTierStr",
  "cardNumber": "string",          // e.g. "COOP-FARM-9062"
  "joinDate": "string",            // YYYY-MM-DD
  "expiryDate": "string",          // YYYY-MM-DD
  "benefits": "string[]",
  "cost": "number"                 // annual subscription fee, NGN
}

// MembershipHistoryItem (types.ts:17)
{
  "id": "string",                  // e.g. "mh_1"
  "date": "string",                // YYYY-MM-DD
  "action": "string",              // e.g. "Upgraded to Gold"
  "amount": "number"               // NGN
}
```

### 1.2 Wallet

```jsonc
// WalletTransaction (types.ts:28)
{
  "id": "string",                  // e.g. "tx_0a12"
  "date": "string",                // ISO 8601 datetime
  "type": "TransactionType",
  "amount": "number",              // NGN
  "description": "string",
  "gateway": "PaymentGatewayType", // optional; deposits/withdrawals only
  "status": ["success", "pending", "failed"]
}
```

### 1.3 Savings

```jsonc
// TargetSavingGoal (types.ts:39)
{
  "id": "string",                  // e.g. "tg_1"
  "title": "string",
  "targetAmount": "number",        // NGN
  "currentAmount": "number",       // NGN
  "startDate": "string",           // YYYY-MM-DD
  "endDate": "string",             // YYYY-MM-DD
  "category": "string",            // e.g. "Tractor", "Fertilizer"
  "interestRate": "number",        // APY %, e.g. 11.5
  "status": ["ongoing", "completed", "withdrawn"]
}

// FixedSaveLock (types.ts:51)
{
  "id": "string",
  "amount": "number",              // NGN
  "startDate": "string",           // YYYY-MM-DD
  "lockedUntil": "string",         // YYYY-MM-DD
  "interestRate": "number",        // APY %
  "status": ["locked", "matured", "withdrawn"],
  "accumulatedInterest": "number", // NGN
  "autoRenew": "boolean"
}

// HarvestSavePlan (types.ts:62)
{
  "id": "string",
  "title": "string",
  "cropType": "string",            // e.g. "Maize", "Cocoa"
  "targetSeason": "string",        // e.g. "Dry Season 2026"
  "amountSaved": "number",         // NGN
  "releaseDate": "string",         // YYYY-MM-DD
  "interestRate": "number",        // APY %
  "status": ["active", "harvested"]
}
```

### 1.4 Cooperative Shares

```jsonc
// SharePortfolio (types.ts:83)
{
  "sharesOwned": "number",
  "currentSharePrice": "number",       // NGN/share
  "bookValue": "number",               // cost basis, NGN
  "totalDividendsEarned": "number",    // NGN
  "annualReturnsRate": "number",       // %
  "history": "ShareTransaction[]",
  "priceTrend": [
    { "date": "string", "price": "number" }   // 12-month trend
  ]
}

// ShareTransaction (types.ts:74)
{
  "id": "string",                  // e.g. "st_1"
  "date": "string",                // ISO 8601
  "type": ["buy", "sell"],
  "sharesCount": "number",
  "pricePerShare": "number",       // NGN
  "totalAmount": "number"          // NGN
}
```

### 1.5 Equipment Booking

```jsonc
// AgriBooking (types.ts:94)
{
  "id": "string",                  // e.g. "bk_1"
  "serviceName": "string",         // equipment/service name
  "bookingDate": "string",         // YYYY-MM-DD
  "timeSlot": "string",            // e.g. "Morning (8:00 AM - 12:00 PM)"
  "status": ["pending", "assigned", "in_progress", "completed", "cancelled"],
  "cost": "number",                // NGN
  "description": "string",
  "equipmentType": "EquipmentType",
  "location": "string",
  "acreage": "number",
  "depositPaid": "number",         // NGN
  "operatorName": "string",        // optional
  "operatorPhone": "string",       // optional
  "equipmentPlate": "string",      // optional
  "distanceInKm": "number",        // optional
  "providerAccepted": "boolean",   // optional
  "completionEvidence": {          // optional
    "comment": "string",
    "imageUrl": "string",          // optional
    "completedAt": "string"
  },
  "farmerRating": "number",        // optional, 1-5
  "farmerRatingComment": "string", // optional
  "gpsTrack": [                    // optional, breadcrumb trail
    { "lat": "number", "lng": "number" }
  ],
  "currentGpsPos": { "lat": "number", "lng": "number" }  // optional, live position
}
```

### 1.6 Contribution Groups (Adashe / Esusu)

```jsonc
// ContributionGroup (types.ts:123)
{
  "id": "string",                  // e.g. "cg_1"
  "name": "string",
  "description": "string",
  "memberCount": "number",
  "cycleAmount": "number",         // contribution per cycle, NGN
  "currentPool": "number",         // NGN
  "totalPayoutPool": "number",     // NGN pooled per round
  "nextPayoutDate": "string",      // date OR human string e.g. "In 3 weeks"
  "userRank": "string",            // e.g. "Slot #5"
  "hasJoined": "boolean",
  "frequency": ["weekly", "monthly"],   // optional
  "members": "string[]",                 // optional, display names
  "chatHistory": [                       // optional
    {
      "id": "string",
      "sender": "string",
      "avatar": "string",
      "message": "string",
      "time": "string",
      "isUser": "boolean",               // optional
      "system": "boolean"                // optional
    }
  ],
  "votes": [                             // optional
    {
      "id": "string",
      "proposal": "string",
      "yesVotes": "number",
      "noVotes": "number",
      "totalSlots": "number",
      "userVoted": ["yes", "no"],        // optional
      "status": ["active", "passed", "rejected"]
    }
  ],
  "attendance": [                        // optional
    {
      "date": "string",
      "title": "string",
      "presentCount": "number",
      "userStatus": ["present", "absent", "excused", "pending"]
    }
  ],
  "savingHistory": [                     // optional
    { "date": "string", "amount": "number", "memberName": "string" }
  ],
  "activePayoutSlot": "number",          // optional
  "maxSlots": "number",                  // optional
  "repaymentConsistency": "number"       // optional, % e.g. 98
}
```

### 1.7 Notifications

```jsonc
// FarmerNotification (types.ts:145)
{
  "id": "string",                  // e.g. "notif_1"
  "date": "string",                // ISO 8601
  "title": "string",
  "message": "string",
  "type": ["info", "success", "warning", "alert"],
  "isRead": "boolean"
}
```

> **Relationship to the server-backed `Notification` (§8).** `FarmerNotification` is a
> **client-only mock** — built in `src/store/appStore.ts` (`appendNotification`), kept
> in `localStorage`, with the bell's unread count computed client-side
> (`AppShell.tsx`: `notifications.filter(n => !n.isRead)`). The 📄 planned notification
> engine ([`PRD/notification.md`](notification.md)) replaces this with the
> server-backed [`notifications`](#81-notifications-collection-) collection (§8.1): the
> bell will source its list + unread count from `/api/v1/notifications` and live
> `notification:*` socket events instead of `appStore`. `FarmerNotification.{type,
> title, message, isRead}` map 1:1 onto `notifications` fields; the mock remains only
> as a seed/offline fallback.

### 1.8 Agricultural Services Marketplace

```jsonc
// ServiceCategory (types.ts:178)
{
  "id": "string",
  "name": "ServiceCategoryName",
  "description": "string",
  "pricePerUnit": "number",        // NGN
  "unit": "string",                // e.g. "per sample", "per hectare"
  "rating": "number",
  "reviews": "ServiceReview[]"
}

// ServiceReview (types.ts:170)
{
  "id": "string",
  "farmerName": "string",
  "rating": "number",
  "comment": "string",
  "date": "string"
}

// ServiceBooking (types.ts:188)
{
  "id": "string",
  "serviceName": "ServiceCategoryName",
  "bookingDate": "string",
  "farmerName": "string",
  "farmerLocation": "string",
  "status": ["pending", "confirmed", "completed", "cancelled"],
  "totalCost": "number",           // NGN
  "notes": "string",               // optional
  "paymentStatus": ["unpaid", "paid"],
  "rating": "number",              // optional
  "reviewComment": "string",       // optional
  "createdAt": "string"            // ISO 8601
}
```

### 1.9 Product Marketplace (E-commerce)

```jsonc
// Product (types.ts:214)
{
  "id": "string",
  "name": "string",
  "category": "ProductCategoryName",
  "price": "number",               // NGN
  "unit": "string",                // e.g. "50kg Bag"
  "stock": "number",
  "merchantId": "string",
  "merchantName": "string",
  "description": "string",
  "imageUrl": "string"             // optional
}

// CartItem (types.ts:227)
{
  "id": "string",                  // cart entry id
  "productId": "string",
  "quantity": "number"
}

// ProductOrder (types.ts:233)
{
  "id": "string",
  "farmerId": "string",
  "farmerName": "string",
  "deliveryAddress": "string",
  "items": [
    {
      "productId": "string",
      "productName": "string",
      "quantity": "number",
      "priceAtPurchase": "number"  // NGN, snapshot at purchase
    }
  ],
  "totalAmount": "number",         // NGN
  "orderDate": "string",           // ISO 8601
  "status": ["pending", "processing", "shipped", "delivered", "cancelled"],
  "deliveryDate": "string"         // optional
}
```

### 1.10 Agent System

```jsonc
// RegisteredFarmer (types.ts:252)
{
  "id": "string",                  // e.g. "f_1092"
  "name": "string",
  "phone": "string",
  "location": "string",
  "identityType": "IdentityType",
  "identityNumber": "string",
  "kycDocUrl": "string",           // optional
  "kycStatus": "KycStatus",
  "dateRegistered": "string",      // YYYY-MM-DD
  "membershipStatus": ["Inactive", "Bronze", "Silver", "Gold", "Platinum"]
}

// CommissionReward (types.ts:265)
{
  "id": "string",                  // e.g. "cr_1"
  "date": "string",                // ISO 8601
  "farmerName": "string",
  "activityType": ["Farmer Registration", "Membership Upgrade", "Savings Deposit",
                   "Equipment Booking", "Marketplace Purchase"],
  "activityDetails": "string",
  "amountEarned": "number"         // NGN
}
```

### 1.11 Seed constants & lookups (not persisted per-user)

Defined in `src/data.ts` / `src/default_marketplace_data.ts`:

```jsonc
{
  // MEMBERSHIP_TIERS: Record<MembershipTierStr, {...}>
  "MEMBERSHIP_TIERS": {
    "<tier>": {
      "name": "string",
      "cost": "number",            // NGN/year
      "benefits": "string[]",
      "color": "string",           // Tailwind classes
      "badgeBg": "string"          // Tailwind classes
    }
  },
  "CROP_TYPES":       [ { "value": "string", "label": "string" } ],
  "GOAL_CATEGORIES":  [ { "value": "string", "label": "string" } ],
  "DEFAULT_SERVICE_CATEGORIES": "ServiceCategory[]",
  "DEFAULT_SERVICE_BOOKINGS":   "ServiceBooking[]",
  "DEFAULT_PRODUCTS":           "Product[]",
  "DEFAULT_ORDERS":             "ProductOrder[]"
}
```

---

## 2. Backend Persisted Documents (MongoDB)

### 2.1 `users` collection ✅

Defined in `backend/src/users/schemas/user.schema.ts`. `@Schema({ timestamps: true })` auto-adds `createdAt`/`updatedAt`; Mongoose adds `_id`.

```jsonc
// users document
{
  "_id": "ObjectId",                       // auto
  "userId": "string",                      // required, unique; auto "USR_<ts>_<rand>" (pre-save)
  "email": "string",                       // required, unique, lowercased, trimmed
  "firstName": "string",                   // required, trimmed
  "lastName": "string",                    // required, trimmed
  "password": "string",                    // required, bcrypt hash; redacted from JSON
  "phoneNumber": "string",                 // optional, trimmed, sparse index
  "role": "BackendUserRole",               // default "farmer"
  "authProvider": ["local","google"],      // default "local"
  "googleId": "string",                    // optional; set when authProvider === "google"
  "isEmailVerified": "boolean",            // default false
  "isPhoneVerified": "boolean",            // default false
  "isActive": "boolean",                   // default true
  "isSuspended": "boolean",                // default false
  "suspensionReason": "string",            // optional
  "suspendedAt": "Date",                   // optional
  "lastLoginAt": "Date",                   // optional
  "profileImageUrl": "string",             // optional
  "address": "string",                     // optional
  "state": "string",                       // optional
  "lga": "string",                         // optional
  "farmName": "string",                    // optional
  "farmSize": "number",                    // optional
  "farmSizeUnit": "string",                // optional
  "cropsOfInterest": "string[]",           // optional
  "livestockOfInterest": "string[]",       // optional
  "wallet": "ObjectId",                    // optional, 🔗 ref "Wallet"
  "memberships": "ObjectId[]",             // optional, 🔗 ref "Membership"
  "shareholdings": "ObjectId[]",           // optional, 🔗 ref "Shareholding"
  "contributionGroups": "ObjectId[]",      // optional, 🔗 ref "ContributionGroup"
  "referralCode": "string",                // optional, auto "<FIRST3><rand5>" (pre-save)
  "referredBy": "ObjectId",                // optional, ref "User"
  "referrals": "ObjectId[]",               // optional, ref "User"
  "commissions": "ObjectId[]",             // optional, 🔗 ref "AgentCommission"
  "totalEarnings": "number",               // default 0
  "loyaltyPoints": "number",               // default 0
  "permissions": "string[]",               // default []
  "loginHistory": [                        // default []; service caps to last 10
    {
      "timestamp": "Date",
      "ipAddress": "string",
      "userAgent": "string",
      "location": "string",                // optional
      "success": "boolean"
    }
  ],
  "passwordChangedAt": "Date",             // optional
  "resetPasswordToken": "string",          // optional, redacted; SHA-256 hash of the emailed raw token (Option A)
  "resetPasswordExpires": "Date",          // optional, redacted; 1h TTL, single-use
  "emailVerificationToken": "string",      // optional, redacted
  "emailVerificationExpires": "Date",      // optional, redacted
  "failedLoginAttempts": "number",         // default 0; lockout at 5
  "lockoutUntil": "Date",                  // optional, 15-min window
  "twoFactorEnabled": "boolean",           // default false
  "twoFactorSecret": "string",             // optional, redacted
  "backupCodes": "string[]",               // optional, redacted
  "metadata": "Record<string, any>",       // default {}

  // ── Planned admin-driven fields (📄, not yet coded) — set/managed by the admin module (§7). ──
  "isBanned": "boolean",                   // 📄 default false; hard block (stronger than isSuspended) set via admin "user.ban"
  "kyc": {                                 // 📄 KYC/AML sub-document; verified by an admin (adminUsers, §7.1). Reconciles the "Identity/KYC" divergence (§4)
    "status": "KycStatus",                 //    ["Pending","Verified","Rejected"] (§0); default "Pending"
    "idType": "IdentityType",              //    ["NIN","BVN","Voters Card","National ID"] (§0)
    "idNumber": "string",
    "bvn": "string",                       //    optional; Bank Verification Number (sensitive — treat as redacted/masked)
    "documents": [                         //    uploaded KYC evidence
      {
        "type": "string",                  //      e.g. "ID_FRONT", "ID_BACK", "SELFIE", "UTILITY_BILL"
        "url": "string",
        "status": ["Pending", "Verified", "Rejected"]
      }
    ],
    "verifiedBy": "ObjectId",              //    optional, 📄 ref "adminUsers" (§7.1) — admin who verified/rejected
    "verifiedAt": "Date",                  //    optional
    "rejectionReason": "string"            //    optional; set when status === "Rejected"
  },
  "isDeleted": "boolean",                  // 📄 soft-delete flag; default false (excluded from default queries)
  "deletedAt": "Date",                     // 📄 optional; when soft-deleted
  "deletedBy": "ObjectId",                 // 📄 optional, ref "adminUsers" (§7.1) — admin who soft-deleted

  "createdAt": "Date",                     // auto (timestamps)
  "updatedAt": "Date"                      // auto (timestamps)
}
```

> 📄 **Planned admin fields note.** `isBanned`, the `kyc` sub-document, and the soft-delete trio (`isDeleted` / `deletedAt` / `deletedBy`) are **specified in the admin module (§7 / `PRD/admin_module/*`) but not yet in `user.schema.ts`**. They are admin-driven: written only through admin actions (each audited via `adminAuditLog`, §7.3) with RBAC guards (`users:ban`, `kyc:verify`, `users:delete`), and destructive/irreversible ones (ban, soft-delete) reserved for `isSuperAdmin` admins. Adding `kyc` here supersedes the open "Identity/KYC" row in §4 (moves it toward Resolved once coded).

- **Indexes:** unique `email`, unique `userId`, sparse `phoneNumber`, single `role` / `isActive` / `wallet` / `referredBy` / `referralCode`, `createdAt: -1`. Planned: single `kyc.status`, `isBanned`, partial `isDeleted` (filter default queries).
- **Instance methods:** `comparePassword(candidate)`; `toJSON()` strips `password`, reset/verification tokens, `twoFactorSecret`, `backupCodes`.
- **Pre-save hooks:** auto-generate `userId` and `referralCode` when absent.

### 2.2 API DTOs ✅

```jsonc
// CreateUserDto (backend/src/users/dto/create-user.dto.ts) — class-validator rules in comments
{
  "firstName": "string",           // required, 2-50 chars, trimmed
  "lastName": "string",            // required, 2-50 chars, trimmed
  "email": "string",               // required, valid email, lowercased+trimmed
  "password": "string",            // required, 8-100 chars, must include upper+lower+digit+special (@$!%*?&)
  "phoneNumber": "string",         // optional
  "role": "BackendUserRole",       // optional
  "address": "string",             // optional
  "state": "string",               // optional
  "lga": "string",                 // optional
  "farmName": "string",            // optional
  "farmSize": "number",            // optional
  "farmSizeUnit": "string",        // optional
  "cropsOfInterest": "string[]",   // optional
  "livestockOfInterest": "string[]", // optional
  "referralCode": "string"         // optional
}

// UpdateUserDto = PartialType(CreateUserDto): every field above, all optional.
// ⚠️ users.service also assigns `passwordChangedAt: Date`, which is NOT declared on the DTO — type error to fix.
```

### 2.3 Authentication DTOs & responses ✅

Request DTOs and the shared success envelope for the live auth endpoints (base `/api/v1/auth`), specified in [PRD 01](user_module/authentication/authentication-user-management.md). The `user` in `AuthResponse.data` is the **safe** user (see `User.toJSON()` — no `password` or token fields). Tokens are backed by the [`RefreshToken`](#24-planned--referenced-collections--) collection (below), keyed by `tokenHash`.

```jsonc
// RegisterDto — POST /auth/register
{
  "firstName": "string",           // required
  "lastName": "string",            // required
  "email": "string",               // required, valid email, lowercased+trimmed
  "password": "string",            // required, 8-100 chars, upper+lower+digit+special (@$!%*?&)
  "phoneNumber": "string",         // REQUIRED for local signup; Nigerian E.164 ^\+234\d{10}$ (e.g. +2348012345678)
  "referralCode": "string"         // optional
}
// NOTE: RegisterDto.phoneNumber is required, but users.phoneNumber (§2.1) stays optional —
// Google accounts are created without a phone and add it later via the profile flow.

// LoginDto — POST /auth/login
{
  "email": "string",               // required
  "password": "string"             // required
}

// GoogleAuthDto — POST /auth/google  (ID-token flow; audience verified vs GOOGLE_CLIENT_ID)
{
  "idToken": "string"              // required, Google ID token (signed JWT)
}

// RefreshTokenDto — POST /auth/refresh
{
  "refreshToken": "string"         // required
}

// ForgotPasswordDto — POST /auth/forgot-password  (always 200, no user enumeration)
{
  "email": "string"               // required, valid email
}

// ResetPasswordDto — POST /auth/reset-password
{
  "token": "string",              // required, raw token from the emailed reset link (server hashes it to match)
  "password": "string"            // required, same password policy as RegisterDto
}

// AuthResponse — success envelope for register / login / google / refresh
{
  "success": "boolean",            // true
  "message": "string",             // optional
  "data": {
    "user": "SafeUser",            // User minus sensitive fields (User.toJSON())
    "accessToken": "string",       // JWT
    "refreshToken": "string",      // JWT; hash persisted in RefreshToken.tokenHash
    "expiresIn": "number"          // access-token lifetime in seconds, e.g. 900
  }
}
```

### 2.4 Planned / referenced collections 🔗 📄

Not yet coded, but required by the `User` schema refs and/or module PRDs. Field-level specs live in the linked PRDs. Auth-token collections (already fully specified in PRD 01) shown as JSON:

```jsonc
// RefreshToken 📄 (PRD 01) — referenced by AuthResponse.refreshToken (§2.3)
{
  "_id": "ObjectId",
  "userId": "ObjectId",            // ref "User", indexed
  "tokenHash": "string",           // SHA-256 hash of refresh token, unique
  "expiresAt": "Date",             // TTL index — auto-expires
  "userAgent": "string",           // optional
  "ipAddress": "string",           // optional
  "isRevoked": "boolean",
  "createdAt": "Date"
}

// PasswordResetToken 📄 (PRD 01)
{
  "_id": "ObjectId",
  "userId": "ObjectId",            // ref "User"
  "token": "string",               // hashed, unique
  "expiresAt": "Date",
  "isUsed": "boolean",
  "createdAt": "Date"
}

// EmailVerificationToken 📄 (PRD 01)
{
  "_id": "ObjectId",
  "userId": "ObjectId",            // ref "User"
  "token": "string",               // hashed, unique
  "expiresAt": "Date",
  "isUsed": "boolean",
  "createdAt": "Date"
}
```

Remaining planned collections (see the named PRD for the authoritative field list):

```jsonc
{
  "Wallet":            "🔗📄 User.wallet · PRD 02-digital-wallet-seerbit.md",
  "Transaction":       "📄 PRD 02 · server-side WalletTransaction",
  "Membership":        "🔗📄 User.memberships · PRD 03-membership-management.md",
  "SavingsProduct":    "📄 PRD 04-savings-products.md (Target/Fixed/Harvest)",
  "Shareholding":      "🔗📄 User.shareholdings · PRD 05-cooperative-shares-dividends.md",
  "ShareTransaction":  "📄 PRD 05",
  "Dividend":          "📄 PRD 05",
  "EquipmentBooking":  "📄 PRD 06-equipment-booking-gps.md",
  "ServiceBooking":    "📄 PRD 07-agric-services-marketplace.md",
  "ServiceProvider":   "📄 PRD 07",
  "Product":           "📄 PRD 08-ecommerce-marketplace.md",
  "Order":             "📄 PRD 08",
  "Merchant":          "📄 PRD 08",
  "ContributionGroup": "🔗📄 User.contributionGroups · PRD 09-adashesu-contributions.md",
  "GroupMessage":      "📄 PRD 09",
  "GroupVote":         "📄 PRD 09",
  "AgentCommission":   "🔗📄 User.commissions · PRD 10-agent-dashboard-commission.md",
  "AgentReferral":     "📄 PRD 10"
}
```

---

## 3. Backend Configuration Object ✅

`configuration.ts` exposes a typed, env-driven config via `registerAs('configuration', …)`, read as `configService.get('configuration.<path>')`:

```jsonc
// configuration
{
  "nodeEnv": "string",
  "port": "number",
  "apiPrefix": "string",
  "database": { "uri": "string", "host": "string", "port": "number",
                "name": "string", "user": "string", "password": "string" },
  "jwt":      { "secret": "string", "expiration": "string",
                "refreshSecret": "string", "refreshExpiration": "string" },
  "bcrypt":   { "saltRounds": "number" },
  "seerbit":  { "secretKey": "string", "publicKey": "string", "baseUrl": "string" }, // payment gateway
  "firebase": { "projectId": "string", "clientEmail": "string", "privateKey": "string" }, // 📄 FCM web push (PRD notification.md); privateKey un-escapes "\n"
  "smtp":     { "host": "string", "port": "number", "user": "string",
                "password": "string", "from": "string" },
  "rateLimit":{ "ttl": "number", "max": "number" },
  "cors":     { "origin": "string[]" },
  "logging":  { "level": "string" }
}
```

> ⚠️ **`firebase` group is 📄 planned, not yet coded.** `configuration.ts` does **not**
> define a `firebase` group today; it must be added for FCM web push
> ([`PRD/notification.md`](notification.md)). The server credential is **three
> individual env vars** — `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
> `FIREBASE_PRIVATE_KEY` (the last must `.replace(/\\n/g, '\n')` so the PEM parses) —
> **not** a JSON blob. The **client** credential is Vite env
> (`VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_MESSAGING_SENDER_ID` /
> `_APP_ID` / `_VAPID_KEY`) consumed by the frontend, not by this backend config.
> Secrets (the private key) stay out of VCS. (The live config also carries `app`,
> `adminJwt`, `cookie`, `google`, and `oneSignal` groups not re-listed above; see §3
> source for the full set.)

---

## 4. Cross-cutting notes, conventions & divergences

**Frontend ↔ backend divergences to reconcile before integration:**

| Concern | Frontend (`src/`) | Backend (`backend/src/`) | Status |
|---------|-------------------|--------------------------|--------|
| Phone field | *(none on user; `phone` on `RegisteredFarmer`)* | `phoneNumber` on `User` | ✅ **Resolved** — frontend `RegisteredFarmer.phone` stays; backend `User.phoneNumber` is the canonical user phone field. |
| Role vocabulary | *(implicit; agent via `agentLevel`)* | `farmer \| agent \| admin \| super_admin` | ✅ **Resolved** — backend enum `farmer \| agent \| admin \| super_admin` is canonical; PRD 01 was realigned (old `SUPER_ADMIN \| ADMIN \| COOP_MANAGER \| MEMBER \| AGENT` retired). |
| User status | *(implicit)* | `isActive` / `isSuspended` booleans on `User` | ✅ **Resolved** — boolean flags `isActive` / `isSuspended` (+ `suspensionReason`/`suspendedAt`) are canonical, replacing the old single `status` enum in PRD 01. |
| Membership | Rich `MembershipInfo` object on state | `memberships: ObjectId[]` ref (separate collection) | ⬜ Open |
| Payment gateway | `Paystack \| Flutterwave \| Monnify` | **SeerBit** (`configuration.seerbit`, PRD 02) | ⬜ Open |
| Identity/KYC | `RegisteredFarmer.identityType/Number/kycStatus` | not modeled on `User` yet | 🟡 **Approved (planned)** — the `users.kyc` sub-document (§2.1, 📄) is the canonical target: `{status, idType, idNumber, bvn?, documents[], verifiedBy(→adminUsers), verifiedAt, rejectionReason?}`. Frontend `RegisteredFarmer.*` maps into it (`identityType`→`kyc.idType`, `identityNumber`→`kyc.idNumber`, `kycStatus`→`kyc.status`). Coded status pending. |
| Admin identity | *(no admin surface)* | `users.role ∈ {admin, super_admin}` only; no `adminUsers`/`adminRoles`/`adminAuditLog` collections | ⬜ Open — §7 specifies a **planned** dedicated admin identity + RBAC plane; not yet coded. |

**ID conventions:**
- Frontend uses short prefixed string IDs: `tx_`, `mh_`, `tg_`, `st_`, `bk_`, `cg_`, `ch_`, `v_`, `notif_`, `f_`, `cr_` (generated as `"<prefix>" + Math.random().toString(36)`).
- Backend uses Mongo `_id: ObjectId` plus a human `userId` (`USR_<ts>_<rand>`) and generated `referralCode`.

**Canonical backend collection names ↔ frontend mock types.** The backend collection names catalogued in §7.7 are the **source of truth** for persistence; the frontend `FarmerAppState` mock types (§1) are a client-side prototype that will be replaced. The mapping (one backend collection may absorb several frontend fields, and one frontend type may split into several backend collections):

| Frontend mock type (§1, `src/types.ts`) | Canonical backend collection(s) (§7.7) | Notes |
|-----------------------------------------|----------------------------------------|-------|
| `walletBalance` + `WalletTransaction[]` | `Wallet` + `Transaction` | Balance becomes `Wallet.balance.{available,pending,locked}`; each tx is a `Transaction` ledger row |
| `flexSaveBalance` / `targetGoals` / `fixedLocks` / `harvestPlans` | `SavingsPlan` + `UserSavings` + `SavingsTransaction` | Product **definitions** in `SavingsPlan`; per-user holdings in `UserSavings`; movements in `SavingsTransaction` |
| `SharePortfolio` (+ `ShareTransaction[]`) | `Share` + `DividendDeclaration` | Holdings/ledger → `Share`; declared runs → `DividendDeclaration` (super_admin) |
| `AgriBooking` | `Equipment` + `EquipmentBooking` | Inventory → `Equipment`; the reservation → `EquipmentBooking` |
| `ServiceBooking` / `ServiceCategory` (frontend) | `ServiceCategory` + `ServiceProvider` + `ServiceListing` + `ServiceBooking` | Frontend flattens; backend splits taxonomy/provider/listing/booking |
| `Product` (frontend) | `Product` | Adds `moderationStatus` + `suspended` (admin moderation, §7.7) |
| `ProductOrder` | `Order` | `Order.paymentStatus` adds `PARTIALLY_REFUNDED` |
| `ContributionGroup` (frontend) | `ContributionGroup` + `GroupMember` | Frontend embeds members/slots; backend normalizes members into `GroupMember` |
| `MembershipInfo` / `MembershipHistoryItem` | `Membership` + `Cooperative` + `MembershipApplication` | Rich `MembershipInfo` → `Membership`; multi-coop org → `Cooperative`; pending applies → `MembershipApplication` |
| `agentLevel` / `RegisteredFarmer[]` / `CommissionReward[]` | `AgentProfile` + `Referral` + `CommissionPayment` | Agent identity → `AgentProfile`; each onboarded farmer → `Referral`; batched payout → `CommissionPayment` |

⚠️ Several backend names also diverge from the `User`-schema **ref** names in §2.4 (e.g. `Share` vs `Shareholding`, `CommissionPayment`/`Referral` vs `AgentCommission`/`AgentReferral`, `SavingsPlan`/`UserSavings` vs `SavingsProduct`, `Transaction` vs the frontend `WalletTransaction`). These are **flagged for the owner to reconcile**, not silently unified — §7.7 uses the admin-PRD (source-of-truth) names.

**Dates:** Frontend stores ISO 8601 strings (`2026-05-30T10:30:00Z`), `YYYY-MM-DD`, or human strings (`"In 3 weeks"`). Backend uses native `Date` + auto `createdAt`/`updatedAt`.

**Money:** All amounts are whole **NGN** numbers (not kobo/minor units). No currency field is stored — NGN is assumed system-wide.

**Sensitive fields (never returned by API):** `password`, `resetPasswordToken`, `resetPasswordExpires`, `emailVerificationToken`, `emailVerificationExpires`, `twoFactorSecret`, `backupCodes` — stripped by `User.toJSON()`.

---

## 5. Frontend Auth (client session) ✅

Client-side session shapes for the live auth flow (see [PRD 01](user_module/authentication/authentication-user-management.md)). `AuthUser` is the subset of the backend safe user the SPA keeps in memory; it is populated from `AuthResponse.data.user` (§2.3). The session (user + tokens + status) is persisted to `localStorage` under the key **`bennie_auth`** — distinct from the main app-state key `KM_FARMER_PORTAL_STATE_REAL`.

```jsonc
// AuthUser — subset of the safe user returned to the client
{
  "id": "string",                  // Mongo _id (when surfaced)
  "userId": "string",              // human id "USR_<ts>_<rand>"
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "role": "BackendUserRole",       // farmer | agent | admin | super_admin
  "phoneNumber": "string",         // optional
  "isEmailVerified": "boolean",
  "referralCode": "string",        // optional
  "profileImageUrl": "string",     // optional
  "authProvider": ["local","google"]
}

// AuthState — the persisted client session (localStorage key: "bennie_auth")
{
  "user": "AuthUser | null",
  "accessToken": "string | null",
  "refreshToken": "string | null",
  "status": ["idle", "loading", "authenticated", "unauthenticated"],
  "error": "string"                // optional
}
```

- **Persistence (updated — see §5.1).** The original single-blob `localStorage["bennie_auth"]` model is **retired** in favour of the **dual-session hybrid** below: access token + safe-profile in `localStorage` (per plane), refresh token in an **httpOnly cookie** (not in JS). The `AuthState`/`AuthUser` *shapes* are unchanged; only where each field lives changes (`refreshToken` is no longer persisted to `localStorage`).
- **`status`** drives route guards: `idle`/`loading` show a splash, `authenticated` unlocks the app, `unauthenticated` redirects to sign-in.
- **`confirmPassword` (client-only):** the signup and reset-password forms include a **`confirmPassword`** field that is validated in the UI (must equal `password`) and is **never sent to the API** — it is absent from `RegisterDto` / `ResetPasswordDto` (§2.3).

### 5.1 Frontend token storage — dual session (hybrid) 📄

**Owner decision (final):** the browser runs **two fully independent auth sessions at once** — one **user** session and one **admin** session — in the **same** browser, without either clobbering the other. This is the "hybrid" storage model: short-lived **access tokens + safe profile** live in `localStorage` (readable by JS so the api clients can attach `Authorization` headers and the SPA can render identity); long-lived **refresh tokens do NOT live in JS at all** — they are set as **httpOnly, Secure, SameSite** cookies by the backend and travel automatically on `withCredentials` requests. This retires the old single `bennie_auth` blob.

**`localStorage` keys (JS-readable — access token + profile only):**

| Key | Contents | Plane |
|-----|----------|-------|
| `userToken` | user access token (JWT, `scope: "user"`, ~15-min TTL) | user |
| `userData` | safe user profile — the `AuthUser` shape (§5), no tokens beyond the access token | user |
| `adminToken` | admin access token (JWT, `scope: "admin"`, ~15-min TTL) | admin |
| `adminData` | safe admin profile — `adminId`, email, name, role, `effectivePermissions`, `mustChangePassword` (from `GET /admin/auth/me`) | admin |

> The two planes are **isolated by key**: signing into the admin plane writes only `adminToken`/`adminData` and never touches `userToken`/`userData`, so an operator can be logged into both the farmer app and the `/bennie` admin app simultaneously in one browser. `bennie_auth` (§5, §6.1) is **retired**; `useAuthStore` persists the user session under `userToken`/`userData` going forward (the old `partialize`-into-`bennie_auth` shape is migrated).

**Refresh tokens — httpOnly cookies (NOT in JS):**

| Cookie | Plane | Attributes |
|--------|-------|------------|
| `bennie_user_rt` | user | `httpOnly; Secure; SameSite=Strict/Lax; Path=/api/v1/auth` |
| `bennie_admin_rt` | admin | `httpOnly; Secure; SameSite=Strict/Lax; Path=/api/v1/admin/auth` |

- **Path-scoped** so each refresh cookie is sent only to its own plane's auth routes (`bennie_user_rt` → `/api/v1/auth/*`, `bennie_admin_rt` → `/api/v1/admin/auth/*`), preventing cross-plane cookie leakage and keeping the two refresh flows independent.
- The refresh token's hash is persisted server-side — user plane in [`RefreshToken`](#24-planned--referenced-collections--) (§2.4), admin plane in [`adminRefreshTokens`](#731-adminrefreshtokens-collection-) (§7.3.1). `POST .../auth/refresh` reads the cookie, rotates it (revokes old, sets a new cookie), and returns a **new access token in the response body** (the refresh token itself is never in the body).
- Because the refresh token is **httpOnly**, JS cannot read or exfiltrate it — XSS that steals `localStorage` gets only a short-lived (~15-min) access token, not a long-lived refresh token.

**Access-token `scope` claim.** Each access token carries a `scope` claim: `"user"` or `"admin"`. The user `JwtAuthGuard` accepts only `scope: "user"`; the `AdminJwtGuard` accepts only `scope: "admin"` (see [auth/admin_auth.md](admin_module/auth/admin_auth.md)). A token minted for one plane is rejected by the other even if otherwise valid — the planes cannot be crossed by replaying a token.

**Two frontend api clients.** The SPA has **two separate axios instances**, each `withCredentials: true` so the plane's httpOnly refresh cookie is attached on refresh:

| Client | baseURL | Reads / attaches | Refreshes via | 401 handling |
|--------|---------|------------------|---------------|--------------|
| `userApi` | `/api/v1` | `Authorization: Bearer ${localStorage.userToken}` | `POST /api/v1/auth/refresh` (sends `bennie_user_rt` cookie) | silent refresh → retry; on refresh failure clear `userToken`/`userData`, route to user sign-in |
| `adminApi` | `/api/v1/admin` | `Authorization: Bearer ${localStorage.adminToken}` | `POST /api/v1/admin/auth/refresh` (sends `bennie_admin_rt` cookie) | silent refresh → retry; on refresh failure clear `adminToken`/`adminData`, route to `/bennie/auth` (`ADMIN_AUTH_010`) |

- Each client's request interceptor attaches its **own** plane's access token; each response interceptor handles its **own** plane's `401`/refresh — an admin `401` never touches the user session and vice-versa.
- `withCredentials: true` is required so the browser sends the (path-scoped, httpOnly) refresh cookie on the refresh call; regular data calls carry only the `Authorization` header.

**XSS / security posture.**
- **httpOnly refresh cookie** — the high-value long-lived credential is unreadable by JS, so an XSS payload cannot steal a session that survives a page reload; it can at most misuse a **short-lived** (~15-min) access token in-page.
- **Short-lived access tokens** (~15 min) bound the blast radius of any leaked `localStorage` token; the refresh path (cookie-bound + rotating + server-revocable) is the durable credential.
- **CSP** (Content-Security-Policy) is required to reduce XSS injection surface (restrict script sources, disallow inline where feasible); combined with the httpOnly cookie this is the standard "access-token-in-memory/localStorage + refresh-in-httpOnly-cookie" hardening.
- **SameSite + Path-scoped cookies** limit CSRF exposure of the refresh endpoints; the refresh endpoints should additionally be idempotent-rotating and (where `SameSite=Lax`) protected against cross-site POST. Confirm CSRF strategy with the owner (double-submit token vs. strict SameSite).
- **`scope` separation** ensures a stolen/mis-routed token for one plane cannot act on the other.

> ⚠️ **Flagged for the owner / migration.** The live code today persists the whole session (including `refreshToken`) into `localStorage["bennie_auth"]` via `useAuthStore` (§6.1). Moving to this dual-session hybrid requires: (a) backend to set/rotate the httpOnly `bennie_user_rt` / `bennie_admin_rt` cookies and stop returning the refresh token in the body; (b) `useAuthStore` to persist under `userToken`/`userData` and drop `refreshToken` from storage; (c) a new admin auth store persisting `adminToken`/`adminData`; (d) split the single axios instance in `src/lib/api.ts` into `userApi` + `adminApi`, both `withCredentials`. Until (a) ships, the user plane may keep the body-refresh transitionally, but the target is cookie-based for both planes.

---

## 6. Frontend State Management — zustand stores ✅

The SPA has **migrated off** the original monolithic `App.tsx` (a single `useState<FarmerAppState>` mirrored to `localStorage`, with the auth session in a React `Context`). State now lives in **two zustand stores** (`zustand` + `persist` middleware). The domain shapes are unchanged — `FarmerAppState` (§1), `AuthUser`/`AuthState` (§5) still come straight from `src/types.ts`; only the container moved from `useState`/Context into stores.

| Store | File | Persist key | Persisted shape |
|-------|------|-------------|-----------------|
| **`useAuthStore`** | `src/store/authStore.ts` | `bennie_auth` → **retiring to `userToken`/`userData`** (see §5.1) | session slice of `AuthState` (§5) — via `partialize`, `error` is **not** persisted; **`refreshToken` moves out of `localStorage` into the httpOnly `bennie_user_rt` cookie** |
| **`useAppStore`**  | `src/store/appStore.ts`  | `KM_FARMER_PORTAL_STATE_REAL` | full `FarmerAppState` (§1) only — via `partialize`, action functions never persisted |

### 6.1 `useAuthStore` (zustand) ✅

`create<AuthStore>()(persist(…))` where `AuthStore = AuthState & AuthActions`. The **state** slice is exactly the `AuthState` in §5 (`user`, `accessToken`, `refreshToken`, `status`, `error`); initial state is `{ user: null, accessToken: null, refreshToken: null, status: "idle", error: null }`. Note the store types `error` as `string | null` (not the optional `error?: string` shown in §5 — see §6.3).

```jsonc
// useAuthStore actions (all async → Promise<void>)
{
  "login":           "(payload: LoginPayload) => Promise<void>",        // authService.login → sets user+tokens, status "authenticated"; on error status "unauthenticated" + error, rethrows
  "register":        "(payload: RegisterPayload) => Promise<void>",     // authService.register → same success/failure handling as login
  "loginWithGoogle": "(idToken: string) => Promise<void>",             // authService.loginWithGoogle (Google ID-token flow, §2.3 GoogleAuthDto)
  "logout":          "() => Promise<void>",                             // authService.logout then clears user+tokens, status "unauthenticated"
  "refresh":         "() => Promise<void>",                             // POST /auth/refresh with stored refreshToken; no token → "unauthenticated"; failure clears session
  "hydrate":         "() => Promise<void>"                              // app boot: if accessToken, GET /auth/me to refresh user → "authenticated"; else/failure clears session → "unauthenticated"
}
```

- **`persist` config:** `name: "bennie_auth"` (the `AUTH_STORAGE_KEY` constant from `src/lib/api.ts`), `storage: createJSONStorage(() => localStorage)`. `partialize` persists **only** `user`, `accessToken`, `refreshToken`, `status` — `error` is intentionally dropped so a stale error never survives a reload. The persisted shape is kept identical to the old `AuthContext` session so the axios interceptor in `src/lib/api.ts` keeps reading/patching tokens from the same key.
  - ⚠️ **Migration to the dual-session hybrid (§5.1).** This `bennie_auth` blob is being **retired**: the user access token + profile move to `userToken`/`userData`, and `refreshToken` **leaves `localStorage`** for the httpOnly `bennie_user_rt` cookie (JS no longer stores or reads the refresh token). A parallel admin session persists to `adminToken`/`adminData`. The single `src/lib/api.ts` axios instance splits into `userApi` + `adminApi`, both `withCredentials: true`. See §5.1 for the full model and the flagged migration steps.
- **`hydrate`** is the boot-time entry point; it depends on a `GET /auth/me` endpoint (see §6.3).

### 6.2 `useAppStore` (zustand) ✅

`create<AppStore>()(persist(…))` where `AppStore = FarmerAppState & AppActions`. The **state** slice is the entire `FarmerAppState` documented in §1 (all 22 slices — not re-listed here); it is initialized from `INITIAL_APP_STATE` (`src/data.ts`) with the newly-added-module back-fill defaults (`serviceCategories`, `serviceBookings`, `products`, `orders`, `cart`) from `src/default_marketplace_data.ts`, ported verbatim from the old `App.tsx` `useState` initializer. Two helpers, `appendTx(...)` and `appendNotification(...)`, are exposed as store actions and reused internally by the domain handlers.

```jsonc
// useAppStore actions — grouped by domain (state mutations only; signatures in src/store/appStore.ts)
{
  // helpers (exposed as actions)
  "appendTx":                       "build a WalletTransaction (id \"tx_…\", status \"success\")",
  "appendNotification":             "build a FarmerNotification (id \"notif_…\", isRead false)",

  // Dashboard / cross-cutting
  "handleJoinContributionCircle":   "join an Adashe circle from the dashboard; adds member + system chat + notification",
  "handleCancelBooking":            "cancel an equipment AgriBooking and refund its full cost to wallet",
  "handleReadNotification":         "mark one FarmerNotification as read",
  "handleClearNotifications":       "empty the notifications list",

  // Membership
  "handleUpgradeTier":              "upgrade MembershipInfo tier (charges cost unless Bronze), new card + history + notif",
  "handleRenewSubscription":        "renew current tier for another year, charge membership fee, add history",

  // Wallet
  "handleDeposit":                  "fund wallet via PaymentGatewayType, append deposit tx",
  "handleWithdrawToBank":           "withdraw to a NUBAN bank account (bank + accNum), append withdraw tx",
  "handleTransferToMember":         "peer transfer to another member by id/name, append transfer tx",

  // Savings
  "handleFlexDeposit":              "move wallet cash into Flex Save balance",
  "handleFlexWithdraw":             "redeem Flex Save back to wallet",
  "handleAddTargetGoal":            "create a TargetSavingGoal (id \"tg_…\", currentAmount 0, status ongoing)",
  "handleAddFundsToTarget":         "top up a target goal; auto-completes when target reached",
  "handleWithdrawTargetGoal":       "cash out a target goal to wallet, status withdrawn",
  "handleAddFixedLock":             "create a FixedSaveLock (id \"fl_…\", status locked, seed accrued interest)",
  "handleWithdrawFixedLock":        "redeem principal + accumulated interest, status withdrawn",
  "handleAddHarvestPlan":           "open a HarvestSavePlan (id \"hp_…\", status active) with an initial deposit",

  // Shares
  "handleBuyShares":                "buy N shares at price/share; append share_purchase tx + ShareTransaction (buy)",
  "handleSellShares":               "sell N shares; adjust book value; append share_sale tx + ShareTransaction (sell)",
  "handleClaimDividends":           "claim totalDividendsEarned to wallet, reset to 0",

  // Adashe / Contributions
  "handlePayAdasheContribution":    "pay a cycle contribution into a group pool + system chat",
  "handleClaimAdashePayout":        "claim rotational payout; reset pool; advance activePayoutSlot",
  "handleSendAdasheMessage":        "append a chat message (id \"ch_…\") to a group",
  "handleVoteOnAdasheProposal":     "cast yes/no on a group proposal, set userVoted",
  "handleCreateAdasheProposal":     "create a proposal (id \"v_…\", status active, user pre-votes yes)",
  "handleAdasheAttendanceCheckIn":  "geolocation check-in on a meeting date, mark userStatus present",
  "handleCreateAdasheGroup":        "publish a new ContributionGroup (id \"cg_…\"), pay first cycle portion",

  // Equipment
  "handleAddBooking":               "create an AgriBooking (id \"bk_…\"), pay 25% secure deposit",
  "handleUpdateBookingStatus":      "advance booking status; on completion settle remaining balance",
  "handleRateBooking":              "attach farmer rating + comment to a booking",

  // Services (agric services marketplace)
  "handleBookService":              "create a ServiceBooking (id \"sb_…\"); charge immediately if paymentStatus paid",
  "handlePayBooking":               "clear an unpaid ServiceBooking balance from wallet",
  "handleCancelServiceBooking":     "cancel a ServiceBooking; refund if it was paid",
  "handleSimulateStatus":           "advance ServiceBooking status pending → confirmed → completed",
  "handleReviewBooking":            "review a ServiceBooking and recompute the ServiceCategory average rating",

  // Marketplace (e-commerce)
  "handleAddToCart":                "add a product to cart (id \"ci_…\"); stock-guarded",
  "handleUpdateCartQty":            "set cart line quantity; capped at merchant stock",
  "handleRemoveFromCart":           "remove a cart line",
  "handleCheckoutMarketplace":      "checkout cart → ProductOrder (id \"ord_…\"), deduct stock + wallet, clear cart",
  "handleMerchantAddProduct":       "merchant adds a Product (id \"p_mer_…\")",
  "handleMerchantUpdateStock":      "merchant sets a product's stock level",
  "handleMerchantUpdateOrderStatus":"merchant advances an order status, notify buyer",

  // Agent
  "handleRegisterFarmer":           "onboard a RegisteredFarmer (id \"f_…\", kycStatus Pending); pay level-scaled commission",
  "handleVerifyFarmerKYC":          "mark a registered farmer's kycStatus Verified",
  "handleSimulateAgentActivity":    "record a CommissionReward (id \"cr_…\") for a referred-farmer activity, credit wallet",
  "handlePromoteAgent":             "set a new AgentLevel and improve agentRanking"
}
```

- **`persist` config:** `name: "KM_FARMER_PORTAL_STATE_REAL"`, `storage: createJSONStorage(() => localStorage)`. `partialize` persists **only the 22 `FarmerAppState` domain slices** and never the action functions (functions are not JSON-serializable). On rehydrate, `merge(persisted, current)` back-fills any newly-added slices absent from an older stored shape — `serviceCategories`, `serviceBookings`, `products`, `orders` (default to their seed data when empty) and `cart` (defaults to `[]`) — mirroring the old `App.tsx` initializer guards.
- Store IDs use the same short prefixed scheme as §4 (`tx_`, `notif_`, `tg_`, `fl_`, `hp_`, `st_`, `ch_`, `sys_`, `v_`, `cg_`, `bk_`, `sb_`, `ci_`, `ord_`, `p_mer_`, `f_`, `cr_`, `rev_`), generated as `"<prefix>" + Math.random()…`.

### 6.3 Discrepancies vs. the §5 `AuthState` spec

- **`error` nullability:** §5 documents `AuthState.error` as `"string" // optional`, but `authStore.ts` types it `error: string | null` and initializes it to `null`. Same intent (may be absent), different representation — the store uses an explicit `null`, not an omitted field.
- **`error` not persisted:** §5 implies the whole `AuthState` is serialized to `bennie_auth`; the store's `partialize` actually persists only `user`, `accessToken`, `refreshToken`, `status` and **drops `error`**. The persisted document is therefore `AuthState` minus `error`.
- **`GET /auth/me` dependency:** `hydrate()` calls `authService.me()` (a `GET /auth/me`), which is **not** among the auth endpoints listed in §2.3 (register / login / google / refresh). Flagged for reconciliation — either PRD 01/§2.3 should add `GET /auth/me`, or hydrate should be re-specified.

---

## 7. Admin Module — identity, RBAC, config 📄

> **Status:** every structure below is 📄 **planned** (specified in `PRD/admin_module/*`, not yet coded). None of these collections exist on disk today; the only admin footprint in code is `users.role ∈ {admin, super_admin}` (§2.1). This section is the live blueprint for the dedicated admin identity + RBAC + system-config plane.

The admin plane is **separate from the end-user `users` collection**: admins are their own documents (`adminUsers`), carry a DB-driven role (`adminRoles`) plus per-admin permission overrides, and every mutating action is written to an append-only `adminAuditLog`. See the §0 permission-taxonomy note for how this relates to `BackendUserRole`.

### 7.1 `adminUsers` collection 📄

Dedicated admin identities. Passwords bcrypt-hashed and redacted from JSON (same convention as `users`, §2.1). `@Schema({ timestamps: true })` auto-adds `createdAt`/`updatedAt`.

```jsonc
// adminUsers document
{
  "_id": "ObjectId",                       // auto
  "adminId": "string",                     // required, unique; human id e.g. "ADM_<ts>_<rand>"
  "email": "string",                       // required, unique, lowercased, trimmed
  "password": "string",                    // required, bcrypt hash; redacted from JSON
  "firstName": "string",                   // required, trimmed
  "lastName": "string",                    // required, trimmed
  "phoneNumber": "string",                 // optional, trimmed
  "role": "ObjectId",                      // required, ref "adminRoles" (§7.2) — source of base permissions
  "permissionOverrides": {                 // optional, per-admin deltas on top of the role's permissions
    "granted": "string[]",                 // extra AdminPermission grants
    "revoked": "string[]"                  // AdminPermission grants removed even if the role has them
  },
  "status": "AdminStatus",                 // default "ACTIVE"  (["ACTIVE","SUSPENDED"])
  "isSuperAdmin": "boolean",               // default false; true ⇒ implicit "*" permission, gates destructive/financial-reversal actions
  "mustChangePassword": "boolean",         // default true on admin creation (first-login rotation)
  "lastLoginAt": "Date",                   // optional
  "failedLoginAttempts": "number",         // default 0; lockout at threshold (see settings.security.lockout)
  "lockoutUntil": "Date",                  // optional, lockout window
  "passwordChangedAt": "Date",             // optional
  "createdBy": "ObjectId",                 // ref "adminUsers"; who provisioned this admin (null/self for the seed super_admin)
  "createdAt": "Date",                     // auto (timestamps)
  "updatedAt": "Date"                      // auto (timestamps)
}
```

- **Effective permissions** = `role.permissions` ∪ `permissionOverrides.granted` − `permissionOverrides.revoked`; `isSuperAdmin` short-circuits to `"*"` (all).
- **Indexes (planned):** unique `email`, unique `adminId`, single `role` / `status`.
- **Sensitive fields (never returned):** `password` (redacted by `toJSON()`, mirroring §2.1 / §4).
- ⚠️ **Owner decision needed:** whether admins are truly a separate collection (documented here) or remain rows in `users` with `role: admin|super_admin`. §7 assumes the separate-collection model.

### 7.2 `adminRoles` collection 📄

Named RBAC roles holding granular permission strings. Referenced by `adminUsers.role`.

```jsonc
// adminRoles document
{
  "_id": "ObjectId",                       // auto
  "name": "string",                        // required, unique; e.g. "FINANCE_ADMIN" (see AdminSystemRole seeds, §0)
  "description": "string",                 // human-readable purpose
  "permissions": "string[]",               // granular AdminPermission grants: "resource:action" | "resource:*" | "*"
                                           //   e.g. ["users:read","users:suspend","kyc:*","shares:dividend:declare"]
  "isSystem": "boolean",                   // default false; true ⇒ seed role, cannot be deleted/renamed
  "createdBy": "ObjectId",                 // ref "adminUsers" (null for seed/system roles)
  "createdAt": "Date",                     // auto (timestamps)
  "updatedAt": "Date"                      // auto (timestamps)
}
```

- **Permission grammar:** dot/colon-scoped `resource:action`; `resource:*` grants every action on a resource; `"*"` grants everything (equivalent to `isSuperAdmin`).
- **Seed roles** (`isSystem: true`) map to `AdminSystemRole` (§0): `SUPER_ADMIN` (`["*"]`), `ADMIN`, `FINANCE_ADMIN`, `SUPPORT_ADMIN`, `CONTENT_ADMIN`.
- **Indexes (planned):** unique `name`.

### 7.3 `adminAuditLog` collection 📄

Append-only record of every mutating admin action. Written by the RBAC/audit interceptor; captures actor, permission exercised, target, and before/after snapshots. Never updated or deleted by application code.

```jsonc
// adminAuditLog document
{
  "_id": "ObjectId",                       // auto
  "actorId": "ObjectId",                   // ref "adminUsers"; who performed the action
  "actorEmail": "string",                  // denormalized for immutability (survives admin deletion/rename)
  "action": "string",                      // logical action name, e.g. "user.suspend", "dividend.declare"
  "permission": "string",                  // the AdminPermission grant that authorized it, e.g. "users:suspend"
  "resource": "string",                    // affected resource/collection, e.g. "users", "shares"
  "targetId": "string",                    // optional; id of the affected document (ObjectId or human id)
  "before": "Record<string, any>",         // optional; pre-change snapshot (for reversible/financial actions)
  "after": "Record<string, any>",          // optional; post-change snapshot
  "ipAddress": "string",                   // optional; source IP of the request
  "userAgent": "string",                   // optional
  "createdAt": "Date"                       // auto; effectively the action timestamp (append-only, no updatedAt)
}
```

- **Indexes (planned):** `actorId`, `resource`, `action`, `createdAt: -1`, compound `(resource, targetId)`.
- Satisfies the per-action audit requirement (actor, target, timestamp, IP) called for by every admin PRD action spec.

### 7.3.1 `adminRefreshTokens` collection 📄

Server-side store of admin **refresh** tokens — the admin-plane analogue of the user-side [`RefreshToken`](#24-planned--referenced-collections--) collection (§2.4). Admin refresh tokens are **rotating and opaque**, hashed at rest, and delivered to the browser **only** via the httpOnly cookie `bennie_admin_rt` (they are never exposed to JS — see §5 dual-session model). One active token per device (userAgent + IP); ban/deactivate/change-password revokes all of an admin's tokens. See [auth/admin_auth.md](admin_module/auth/admin_auth.md).

```jsonc
// adminRefreshTokens document 📄 — admin-plane refresh-token store
{
  "_id": "ObjectId",                       // auto
  "adminId": "ObjectId",                   // required, indexed; ref "adminUsers" (§7.1)
  "tokenHash": "string",                   // required, unique; SHA-256 hash of the opaque refresh token (raw never stored)
  "expiresAt": "Date",                     // required; TTL index — Mongo auto-expires the document
  "userAgent": "string",                   // optional; captured at issue for per-device binding
  "ipAddress": "string",                   // optional; captured at issue
  "isRevoked": "boolean",                  // default false; set true on rotation, logout, ban/deactivate, or change-password
  "createdAt": "Date"                       // auto; issue time (append-only-ish; only isRevoked flips)
}
```

- **Indexes (planned):** unique `tokenHash`, single `adminId`, **TTL on `expiresAt`** (auto-purge expired), optional compound `(adminId, isRevoked)` for bulk revocation lookups.
- **Rotation:** `POST /admin/auth/refresh` looks up by `tokenHash`, sets `isRevoked: true` on the presented token, and issues a fresh pair (new document). A presented token that is missing/expired/`isRevoked` → `401 ADMIN_AUTH_010`.
- **Bulk revoke:** `admins:ban` / deactivate / `change-password` set `isRevoked: true` for **all** of the admin's tokens, forcing re-login on every device.
- **Not returned to JS.** The raw refresh token lives only in the httpOnly `bennie_admin_rt` cookie (§5); the API response body never contains it (unlike the user-side §2.3 `AuthResponse.refreshToken`, which is being migrated to the same cookie posture — see §5).

### 7.4 `membershipTiers` collection 📄 — supersedes `MEMBERSHIP_TIERS`

DB-driven subscription plans, **admin-managed**. Replaces the hardcoded frontend constant `MEMBERSHIP_TIERS` in `src/data.ts` (§1.11): the frontend constant becomes a seed/fallback only — pricing, benefits, and privileges are authoritative here once the admin config plane ships.

```jsonc
// membershipTiers document
{
  "_id": "ObjectId",                       // auto
  "key": "MembershipTierStr",              // ["Bronze","Silver","Gold","Platinum"] — unique tier key
  "name": "string",                        // display name
  "cost": "number",                        // NGN / year (annual subscription fee)
  "benefits": "string[]",                  // human-readable benefit bullets (shown on the card)
  "privileges": {                          // machine-enforceable flags (drive business rules, not just display)
    "shareCap": "number",                  // optional; max shares purchasable at this tier (null/absent = uncapped)
    "bookingPriority": "number",           // optional; equipment/service queue priority weight
    "transferFees": "number",              // optional; peer-transfer fee % or flat NGN for this tier
    "dividendPriority": "boolean"          // optional; earlier dividend payout / priority pool
    // additional privilege flags may be added; keep machine-readable
  },
  "isActive": "boolean",                   // default true; inactive tiers hidden from signup/upgrade
  "sortOrder": "number"                    // display/upgrade ladder ordering (Bronze < Silver < Gold < Platinum)
}
```

- **Supersession note:** where `MEMBERSHIP_TIERS` (§1.11) carries Tailwind styling (`color`, `badgeBg`), those presentation-only keys stay in the frontend; `membershipTiers` holds the **business** fields (`cost`, `benefits`, `privileges`). ⚠️ Reconcile `cost`/`benefits` between the two before go-live so the DB is authoritative.
- **Indexes (planned):** unique `key`.

### 7.5 `settings` collection 📄 — global system configuration

A structured global-config document (typically a **singleton** document, or one doc per group). Admin-editable; changes are audited (§7.3). Grouped by concern:

```jsonc
// settings document (global config; grouped)
{
  "_id": "ObjectId",                       // auto
  "paymentGateway": {                      // SeerBit is backend source of truth (§3, PRD 02)
    "provider": ["SeerBit"],               // active gateway
    "mode": ["test", "live"],
    "publicKey": "string",                 // non-secret; secrets stay in env/§3, not here
    "webhookConfigured": "boolean"
  },
  "savings": {
    "defaultApyByType": {                  // APY % defaults per savings product type (PRD 04)
      "flex": "number",
      "target": "number",
      "fixed": "number",
      "harvest": "number"
    }
  },
  "commission": {
    "rates": {                             // agent commission rates per activity (PRD 10)
      "farmerRegistration": "number",      // NGN or %
      "membershipUpgrade": "number",
      "savingsDeposit": "number",
      "equipmentBooking": "number",
      "marketplacePurchase": "number"
    },
    "taxWithholdingPercent": "number"      // withholding tax on commission payouts, %
  },
  "fees": {
    "marketplacePercent": "number",        // platform fee on e-commerce orders, % (PRD 08)
    "servicesEscrowPercent": "number",     // escrow hold on service bookings, % (PRD 07)
    "escrowReleaseDays": "number",         // days before auto-release of escrow
    "walletWithdrawalTiers": [             // tiered withdrawal fees by amount band (PRD 02)
      { "minAmount": "number", "maxAmount": "number", "fee": "number" }  // NGN bands, fee NGN or %
    ]
  },
  "membership": {
    "pricing": {                           // tier → annual cost; mirrors/overrides membershipTiers.cost (§7.4)
      "Bronze": "number", "Silver": "number", "Gold": "number", "Platinum": "number"
    }
  },
  "kyc": {                                 // KYC/AML feature toggles (PRD: user & KYC management, admin_module)
    "requireForWithdrawal": "boolean",
    "requireForShares": "boolean",
    "autoVerifyBvn": "boolean",
    "autoVerifyNin": "boolean"
  },
  "featureFlags": "Record<string, boolean>",  // named on/off toggles for gated features
  "maintenanceMode": {
    "enabled": "boolean",
    "message": "string",                   // optional; banner shown to users when enabled
    "allowlist": "string[]"                // optional; admin IPs/ids allowed through during maintenance
  },
  "email": {                               // OneSignal-backed notifications (see PRD/oneSignal.md)
    "oneSignal": {
      "appId": "string",
      "fromName": "string",
      "fromEmail": "string"
      // API keys stay in env, not in this document
    }
  },
  "security": {
    "lockout": {
      "maxFailedAttempts": "number",       // admin login lockout threshold (drives adminUsers.failedLoginAttempts)
      "lockoutMinutes": "number"           // lockout window length
    },
    "tokenTtls": {
      "accessSeconds": "number",           // admin access-token lifetime
      "refreshSeconds": "number"           // admin refresh-token lifetime
    },
    "adminIpAllowlist": "string[]"         // CIDR/IPs permitted to reach the admin API (empty = allow all)
  },
  "updatedBy": "ObjectId",                 // optional, ref "adminUsers" — last editor (audited via §7.3)
  "updatedAt": "Date"                      // auto (timestamps)
}
```

- **Secrets never live here.** API/secret keys stay in env-driven `configuration` (§3); `settings` holds operator-tunable, non-secret values only.
- ⚠️ `membership.pricing` overlaps `membershipTiers.cost` (§7.4) — designate one authoritative (recommend `membershipTiers`; keep `settings.membership.pricing` as a convenience mirror or remove). Owner decision.

### 7.6 Admin auth DTOs 📄

Request DTOs for the admin auth + provisioning endpoints (base `/api/v1/admin`). All success responses reuse the **standard success envelope** from §2.3 (`{ success, message?, data }`); admin login returns a `data` shaped like `AuthResponse.data` (§2.3) but with a **safe admin** (an `adminUsers` doc minus `password`) in place of `user`.

```jsonc
// AdminLoginDto — POST /admin/auth/login
{
  "email": "string",               // required, valid email
  "password": "string"             // required
}

// AdminChangePasswordDto — POST /admin/auth/change-password (also first-login when mustChangePassword)
{
  "currentPassword": "string",     // required
  "newPassword": "string"          // required, same password policy as user RegisterDto (§2.3)
}

// CreateAdminDto — POST /admin/admins  (super_admin / users:create-admin)
{
  "email": "string",               // required, valid email, lowercased+trimmed
  "firstName": "string",           // required
  "lastName": "string",            // required
  "phoneNumber": "string",         // optional
  "roleId": "string",              // required, ObjectId ref "adminRoles" (§7.2)
  "permissionOverrides": {         // optional; per-admin deltas (§7.1)
    "granted": "string[]",
    "revoked": "string[]"
  }
  // NOTE: no password field — server generates a temp password + sets mustChangePassword:true
}

// UpdateAdminDto = PartialType(CreateAdminDto) — all fields optional; may also toggle `status` (["ACTIVE","SUSPENDED"])

// CreateRoleDto — POST /admin/roles
{
  "name": "string",                // required, unique
  "description": "string",         // required
  "permissions": "string[]"        // required; AdminPermission grants ("resource:action" | "resource:*" | "*")
}

// UpdateRoleDto = PartialType(CreateRoleDto) — all fields optional; `isSystem` roles are not editable
```

### 7.7 Admin-managed domain collections — index 📄

The admin module operates over the full set of domain collections defined across `PRD/user_module/*` and `PRD/admin_module/*`. The table below indexes each with its purpose, status, and authoritative PRD; **full annotated schemas follow in §7.7.1–§7.7.9** (grouped by domain). The field lists there are derived from the linked user-module PRDs and are the canonical (source-of-truth) backend names — see the §4 naming-map note for how they relate to the frontend mock types and the §2.4 `User`-ref names.

| Collection | Purpose (one-line) | Status | PRD |
|------------|--------------------|--------|-----|
| `Wallet` | Per-user NGN balance + gateway linkage | 📄 | `user_module/02-digital-wallet-seerbit.md` |
| `Transaction` | Server-side ledger of wallet movements | 📄 | `user_module/02` |
| `WithdrawalRequest` | User payout requests (admin-approved/settled) | 📄 | `user_module/02` · `admin_module/*` (financial ops) |
| `DepositRequest` | Inbound funding intents / gateway callbacks | 📄 | `user_module/02` |
| `BankAccount` | Saved NUBAN payout accounts | 📄 | `user_module/02` |
| `SavingsPlan` | Product definitions (Flex/Target/Fixed/Harvest) | 📄 | `user_module/04-savings-products.md` |
| `UserSavings` | A user's holdings in a savings plan | 📄 | `user_module/04` |
| `SavingsTransaction` | Deposits/withdrawals/interest on savings | 📄 | `user_module/04` |
| `Share` | Cooperative share holdings / ledger | 📄 | `user_module/05-cooperative-shares-dividends.md` |
| `DividendDeclaration` | Admin-declared dividend runs (super_admin) | 📄 | `user_module/05` · `admin_module/*` (financial ops) |
| `Equipment` | Bookable equipment inventory | 📄 | `user_module/06-equipment-booking-gps.md` |
| `EquipmentBooking` | Equipment reservations + GPS/lifecycle | 📄 | `user_module/06` |
| `ServiceCategory` | Agric-services taxonomy + pricing | 📄 | `user_module/07-agric-services-marketplace.md` |
| `ServiceProvider` | Vetted service providers (admin-approved) | 📄 | `user_module/07` · `admin_module/*` (content) |
| `ServiceListing` | Individual bookable service offerings | 📄 | `user_module/07` |
| `ServiceBooking` | Service reservations + escrow/status | 📄 | `user_module/07` |
| `Product` | E-commerce catalog items | 📄 | `user_module/08-ecommerce-marketplace.md` |
| `Order` | E-commerce orders + fulfillment status | 📄 | `user_module/08` |
| `ContributionGroup` | Adashe/Esusu rotating-savings groups | 📄 | `user_module/09-adashesu-contributions.md` |
| `GroupMember` | Membership/slot in a contribution group | 📄 | `user_module/09` |
| `Membership` | A user's cooperative membership record | 📄 | `user_module/03-membership-management.md` |
| `Cooperative` | Cooperative org entity (multi-coop support) | 📄 | `user_module/03` · `admin_module/*` |
| `MembershipApplication` | Pending membership/tier applications | 📄 | `user_module/03` · `admin_module/*` (approvals) |
| `AgentProfile` | Agent identity, level, ranking | 📄 | `user_module/10-agent-dashboard-commission.md` |
| `Referral` | Agent→farmer referral linkage | 📄 | `user_module/10` |
| `CommissionPayment` | Commission accrual/payout to agents | 📄 | `user_module/10` · `admin_module/*` (settlements) |

> Naming note: several rows use admin-PRD names that differ from the `User`-schema ref names in §2.4 (e.g. `Share` vs `Shareholding`, `CommissionPayment` vs `AgentCommission`, `SavingsPlan`/`UserSavings` vs `SavingsProduct`). ⚠️ These naming splits are **flagged for reconciliation**, not silently unified — the authoritative field lists live in the linked PRDs.

All schemas below are 📄 **planned** (none coded yet). Conventions match §2: values are types; `// optional`; enums as arrays; money is whole **NGN**; `ObjectId` fields note their `ref`. `@Schema({ timestamps: true })` implies auto `_id` + `createdAt`/`updatedAt` unless stated otherwise.

#### 7.7.1 Wallet domain 📄 — `PRD/user_module/wallet/digital-wallet-seerbit.md`

```jsonc
// Wallet document 📄 — ref User.wallet (§2.1). One per user.
{
  "_id": "ObjectId",                       // auto
  "userId": "ObjectId",                    // required, unique, indexed; ref "users"
  "walletNumber": "string",                // unique
  "balance": {
    "available": "number",                 // NGN — spendable
    "pending": "number",                   // NGN — in-flight
    "locked": "number"                     // NGN — held (e.g. fixed savings, escrow)
  },
  "currency": "string",                    // default "NGN"
  "status": ["ACTIVE", "SUSPENDED", "CLOSED"],   // admin-settable via "wallet:suspend"
  "kycStatus": ["PENDING", "VERIFIED", "REJECTED"],
  "kycVerifiedAt": "Date",                 // optional
  "dailyTransactionLimit": "number",       // NGN
  "monthlyTransactionLimit": "number",     // NGN
  "totalDeposited": "number",              // NGN, lifetime
  "totalWithdrawn": "number",              // NGN, lifetime
  "metadata": "Record<string, any>",       // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}

// Transaction document 📄 — server-side ledger (canonical for frontend WalletTransaction, §1.2)
{
  "_id": "ObjectId",
  "walletId": "ObjectId",                  // required, indexed; ref "Wallet"
  "type": ["CREDIT", "DEBIT"],
  "category": ["DEPOSIT", "WITHDRAWAL", "TRANSFER_IN", "TRANSFER_OUT",
               "PAYMENT", "REFUND", "FEE", "INTEREST", "DIVIDEND",
               "SAVINGS_LOCK", "SAVINGS_UNLOCK", "CONTRIBUTION", "COMMISSION"],
  "amount": "number",                      // NGN
  "balanceBefore": "number",               // NGN
  "balanceAfter": "number",                // NGN
  "status": ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REVERSED"],  // REVERSED set by admin reversal
  "reference": "string",                   // unique
  "externalReference": "string",           // optional; SeerBit ref
  "description": "string",
  "narration": "string",                   // optional
  "counterparty": {                        // optional
    "walletId": "ObjectId",                //   optional, ref "Wallet"
    "userId": "ObjectId",                  //   optional, ref "users"
    "name": "string",                      //   optional
    "accountNumber": "string",             //   optional
    "bankName": "string"                   //   optional
  },
  "seerBitData": {                         // optional; gateway payload
    "transactionRef": "string",
    "orderId": "string",
    "paymentMethod": "string",
    "cardLast4": "string",                 //   optional
    "bankName": "string",                  //   optional
    "status": "string",
    "paidAt": "Date",                      //   optional
    "settlementAmount": "number",          //   optional, NGN
    "fees": "number"                       //   optional, NGN
  },
  "failureReason": "string",               // optional
  "reversalReason": "string",              // optional; set on admin reversal (super_admin, "transactions:reverse")
  "processedBy": "ObjectId",               // optional, ref "users"/"adminUsers" — admin/agent who processed
  "metadata": "Record<string, any>",       // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}

// WithdrawalRequest document 📄 — admin-approved payout (RBAC "withdrawals:approve"; reject "withdrawals:reject")
{
  "_id": "ObjectId",
  "walletId": "ObjectId",                  // ref "Wallet"
  "userId": "ObjectId",                    // ref "users"
  "bankAccountId": "ObjectId",             // ref "BankAccount"
  "amount": "number",                      // NGN
  "fee": "number",                         // NGN
  "totalAmount": "number",                 // NGN (amount + fee)
  "status": ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED", "FAILED"],
  "reference": "string",                   // unique
  "narration": "string",                   // optional
  "approvedBy": "ObjectId",                // optional, 📄 ref "adminUsers" (§7.1)
  "approvedAt": "Date",                    // optional
  "processedAt": "Date",                   // optional
  "failureReason": "string",               // optional
  "seerBitData": {                         // optional
    "transferRef": "string",
    "batchId": "string"                    //   optional
  },
  "metadata": "Record<string, any>",       // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}

// DepositRequest document 📄 — inbound funding intent / gateway callback
{
  "_id": "ObjectId",
  "walletId": "ObjectId",                  // ref "Wallet"
  "userId": "ObjectId",                    // ref "users"
  "amount": "number",                      // NGN
  "method": ["CARD", "BANK_TRANSFER", "USSD"],
  "status": ["PENDING", "INITIATED", "COMPLETED", "FAILED", "EXPIRED"],
  "reference": "string",                   // unique
  "seerBitData": {                         // optional
    "checkoutUrl": "string",               //   optional
    "transactionRef": "string",            //   optional
    "orderId": "string",
    "expiresAt": "Date"                    //   optional
  },
  "completedAt": "Date",                   // optional
  "failureReason": "string",               // optional
  "metadata": "Record<string, any>",       // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}

// BankAccount document 📄 — saved NUBAN payout account
{
  "_id": "ObjectId",
  "userId": "ObjectId",                    // ref "users", indexed
  "accountNumber": "string",               // NUBAN (10 digits)
  "accountName": "string",
  "bankName": "string",
  "bankCode": "string",
  "isDefault": "boolean",
  "isVerified": "boolean",
  "verificationMethod": ["NAME_ENQUIRY", "PENNY_DROP"],   // optional
  "verifiedAt": "Date",                    // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

#### 7.7.2 Savings domain 📄 — `PRD/user_module/savings-products/savings-products.md`

```jsonc
// SavingsPlan document 📄 — admin-managed product definitions (RBAC "savings:plans:*")
{
  "_id": "ObjectId",
  "name": "string",
  "type": ["FLEX", "TARGET", "FIXED", "HARVEST"],
  "description": "string",
  "minAmount": "number",                   // NGN
  "maxAmount": "number",                   // optional, NGN
  "interestRate": "number",                // annual % (APY)
  "tenureDays": "number",                  // optional; for FIXED
  "lockPeriodDays": "number",              // optional
  "withdrawalRestrictions": {
    "freeWithdrawals": "number",
    "penaltyPerWithdrawal": "number",      // NGN or %
    "noticePeriodDays": "number"
  },
  "eligibility": {
    "minMembershipDays": "number",
    "requiresActiveMembership": "boolean",
    "allowedRoles": "string[]"             // BackendUserRole values
  },
  "status": ["ACTIVE", "INACTIVE"],        // INACTIVE plans hidden from open flow
  "createdAt": "Date",
  "updatedAt": "Date"
}

// UserSavings document 📄 — a user's holding in a plan
{
  "_id": "ObjectId",
  "userId": "ObjectId",                    // ref "users"
  "planId": "ObjectId",                    // ref "SavingsPlan"
  "accountNumber": "string",               // unique
  "type": ["FLEX", "TARGET", "FIXED", "HARVEST"],
  "status": ["ACTIVE", "MATURED", "CLOSED", "FORFEITED"],
  "targetAmount": "number",                // optional, NGN (TARGET/HARVEST)
  "principalBalance": "number",            // NGN
  "accruedInterest": "number",             // NGN
  "totalBalance": "number",                // NGN (principal + interest)
  "openedAt": "Date",
  "maturesAt": "Date",                     // optional
  "closedAt": "Date",                      // optional
  "lastInterestCalculationAt": "Date",
  "withdrawalCount": "number",
  "metadata": "Record<string, any>",       // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}

// SavingsTransaction document 📄
{
  "_id": "ObjectId",
  "savingsId": "ObjectId",                 // ref "UserSavings"
  "walletId": "ObjectId",                  // ref "Wallet"
  "type": ["DEPOSIT", "WITHDRAWAL", "INTEREST_CREDIT", "PENALTY_DEBIT"],
  "amount": "number",                      // NGN
  "balanceBefore": "number",               // NGN
  "balanceAfter": "number",                // NGN
  "status": ["PENDING", "COMPLETED", "FAILED"],
  "reference": "string",                   // unique
  "narration": "string",
  "processedBy": "ObjectId",               // optional; admin-run interest batch → ref "adminUsers"
  "createdAt": "Date"                      // no updatedAt (append-only)
}
```

#### 7.7.3 Shares & dividends domain 📄 — `PRD/user_module/cooperative-shares-dividends/cooperative-shares-dividends.md`

```jsonc
// Share document 📄 — canonical for frontend SharePortfolio (§1.4). ⚠️ §2.4 names this ref "Shareholding".
{
  "_id": "ObjectId",
  "userId": "ObjectId",                    // ref "users"
  "cooperativeId": "ObjectId",             // ref "Cooperative"
  "shareCertificateNumber": "string",      // unique
  "numberOfShares": "number",
  "parValue": "number",                    // NGN / share (price per share)
  "totalValue": "number",                  // NGN
  "issueDate": "Date",
  "status": ["ACTIVE", "FORFEITED", "TRANSFERRED", "REDEEMED"],
  "dividendHistory": [
    {
      "year": "number",
      "dividendPerShare": "number",        // NGN
      "totalDividend": "number",           // NGN
      "declaredAt": "Date",
      "paidAt": "Date",                    // optional
      "status": ["DECLARED", "PAID", "UNCLAIMED"]
    }
  ],
  "metadata": "Record<string, any>",       // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}

// DividendDeclaration document 📄 — admin-declared run. Declaration/distribution reserved for super_admin
//   (RBAC "shares:dividend:declare" / "shares:dividend:distribute"); every action audited (§7.3).
{
  "_id": "ObjectId",
  "cooperativeId": "ObjectId",             // ref "Cooperative"
  "financialYear": "number",
  "dividendRate": "number",                // %
  "totalAmountDeclared": "number",         // NGN
  "eligibleShares": "number",
  "declarationDate": "Date",
  "paymentStartDate": "Date",
  "paymentEndDate": "Date",
  "status": ["DRAFT", "DECLARED", "IN_PROGRESS", "COMPLETED"],
  "approvedBy": "ObjectId[]",              // board approvals — 📄 ref "adminUsers" (§7.1)
  "metadata": "Record<string, any>",       // optional
  "createdAt": "Date"                      // no updatedAt (declaration is immutable once DECLARED)
}
```

#### 7.7.4 Equipment domain 📄 — `PRD/user_module/equipment-booking-gps/equipment-booking-gps.md`

```jsonc
// Equipment document 📄 — admin-managed inventory (RBAC "equipment:*")
{
  "_id": "ObjectId",
  "cooperativeId": "ObjectId",             // ref "Cooperative"
  "name": "string",
  "category": ["TRACTOR", "HARVESTER", "PLANTER", "SPRAYER", "IRRIGATION", "OTHER"],
  "model": "string",
  "serialNumber": "string",
  "yearOfManufacture": "number",
  "status": ["AVAILABLE", "BOOKED", "MAINTENANCE", "RETIRED"],
  "hourlyRate": "number",                  // NGN
  "dailyRate": "number",                   // NGN
  "depositRequired": "number",             // NGN
  "location": { "lat": "number", "lng": "number", "address": "string" },
  "gpsTracker": {
    "deviceId": "string",
    "isActive": "boolean",
    "lastUpdateAt": "Date"                 // optional
  },
  "specifications": "Record<string, any>",
  "images": "string[]",
  "maintenanceSchedule": [
    {
      "type": "string",
      "dueDate": "Date",
      "completedAt": "Date",               // optional
      "notes": "string"
    }
  ],
  "bookingHistory": "number",              // total bookings count
  "createdAt": "Date",
  "updatedAt": "Date"
}

// EquipmentBooking document 📄 — canonical for frontend AgriBooking (§1.5)
{
  "_id": "ObjectId",
  "equipmentId": "ObjectId",               // ref "Equipment"
  "userId": "ObjectId",                    // ref "users"
  "bookingReference": "string",            // unique
  "startDate": "Date",
  "endDate": "Date",
  "actualStartDate": "Date",               // optional
  "actualEndDate": "Date",                 // optional
  "status": ["PENDING", "CONFIRMED", "IN_USE", "COMPLETED", "CANCELLED", "OVERDUE"],
  "totalCost": "number",                   // NGN
  "depositPaid": "number",                 // NGN
  "paymentStatus": ["PENDING", "PARTIAL", "PAID"],
  "pickupLocation": { "lat": "number", "lng": "number", "address": "string" },
  "returnLocation": { "lat": "number", "lng": "number", "address": "string" },
  "operator": "ObjectId",                  // optional, ref "users" (if operator required)
  "notes": "string",                       // optional
  "cancellationReason": "string",          // optional
  "damageReport": {                        // optional
    "description": "string",
    "costEstimate": "number",              //   NGN
    "deductedFromDeposit": "number"        //   NGN
  },
  "gpsTracking": [
    { "timestamp": "Date", "lat": "number", "lng": "number", "speed": "number" }  // speed optional
  ],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

#### 7.7.5 Agric services domain 📄 — `PRD/user_module/agric-services-marketplace/agric-services-marketplace.md`

```jsonc
// ServiceCategory document 📄 — admin-managed taxonomy (RBAC "services:categories:*")
{
  "_id": "ObjectId",
  "name": "string",
  "slug": "string",                        // unique
  "description": "string",
  "icon": "string",
  "parentCategoryId": "ObjectId",          // optional, ref "ServiceCategory" (self)
  "isActive": "boolean",
  "sortOrder": "number",
  "createdAt": "Date"                       // no updatedAt in PRD
}

// ServiceProvider document 📄 — admin-vetted (RBAC "services:providers:verify"; verificationStatus set by admin)
{
  "_id": "ObjectId",
  "userId": "ObjectId",                    // ref "users"
  "businessName": "string",
  "categoryIds": "ObjectId[]",             // ref "ServiceCategory"
  "description": "string",
  "serviceAreas": [ { "state": "string", "lga": "string" } ],
  "rating": { "average": "number", "count": "number" },
  "verificationStatus": ["PENDING", "VERIFIED", "REJECTED"],
  "documents": [ { "type": "string", "url": "string", "status": "string" } ],
  "workingHours": { "days": "string[]", "startTime": "string", "endTime": "string" },
  "contactInfo": { "phone": "string", "email": "string", "address": "string" },
  "bankDetails": { "accountNumber": "string", "bankName": "string" },
  "isAvailable": "boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}

// ServiceListing document 📄 — bookable offering
{
  "_id": "ObjectId",
  "providerId": "ObjectId",                // ref "ServiceProvider"
  "title": "string",
  "description": "string",
  "categoryId": "ObjectId",                // ref "ServiceCategory"
  "pricingType": ["FIXED", "HOURLY", "PER_UNIT", "NEGOTIABLE"],
  "price": "number",                       // NGN
  "unit": "string",                        // 'hour', 'acre', 'item', etc.
  "images": "string[]",
  "duration": "number",                    // optional; minutes
  "isAvailable": "boolean",
  "bookingSettings": { "minAdvanceHours": "number", "maxBookingsPerDay": "number" },
  "totalBookings": "number",
  "createdAt": "Date",
  "updatedAt": "Date"
}

// ServiceBooking document 📄 — reservation + escrow/status (admin dispute resolution via "services:bookings:*")
{
  "_id": "ObjectId",
  "listingId": "ObjectId",                 // ref "ServiceListing"
  "customerId": "ObjectId",                // ref "users"
  "providerId": "ObjectId",                // ref "ServiceProvider"
  "bookingReference": "string",            // unique
  "scheduledDate": "Date",
  "scheduledTime": "string",
  "location": { "lat": "number", "lng": "number", "address": "string" },
  "status": ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DISPUTED"],
  "totalAmount": "number",                 // NGN
  "paymentStatus": ["PENDING", "PAID", "REFUNDED"],
  "notes": "string",                       // optional
  "completionNotes": "string",             // optional
  "rating": { "score": "number", "comment": "string", "createdAt": "Date" },  // optional
  "cancelledBy": "ObjectId",               // optional, ref "users"/"adminUsers"
  "cancellationReason": "string",          // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

#### 7.7.6 Marketplace domain 📄 — `PRD/user_module/ecommerce-marketplace/ecommerce-marketplace.md`

```jsonc
// Product document 📄 — includes ADOPTED admin-moderation fields (moderationStatus + suspended)
{
  "_id": "ObjectId",
  "sellerId": "ObjectId",                  // ref "users"
  "cooperativeId": "ObjectId",             // optional, ref "Cooperative"
  "name": "string",
  "slug": "string",                        // unique
  "description": "string",
  "category": {
    "primary": "ObjectId",                 // ref product-category
    "subcategories": "ObjectId[]"
  },
  "pricing": {
    "unitPrice": "number",                 // NGN
    "currency": "string",                  // "NGN"
    "unit": "string",                      // 'kg', 'bag', 'piece', etc.
    "minOrderQuantity": "number",
    "bulkPricing": [ { "quantity": "number", "price": "number" } ]   // optional, NGN
  },
  "inventory": { "available": "number", "reserved": "number", "lowStockThreshold": "number" },
  "images": "string[]",
  "harvestDate": "Date",                   // optional
  "expiryDate": "Date",                    // optional
  "origin": { "state": "string", "lga": "string", "farmName": "string" },  // farmName optional
  "certifications": "string[]",            // optional; 'ORGANIC', 'GAP', etc.
  "shippingOptions": [ { "method": "string", "cost": "number", "durationDays": "number" } ],  // cost NGN
  "status": ["ACTIVE", "INACTIVE", "OUT_OF_STOCK"],
  "moderationStatus": ["PENDING", "APPROVED", "REJECTED"],   // 📄 ADOPTED — admin review gate (RBAC "products:moderate")
  "suspended": "boolean",                  // 📄 ADOPTED — admin takedown flag (default false; "products:suspend")
  "rating": { "average": "number", "count": "number" },
  "totalSales": "number",
  "createdAt": "Date",
  "updatedAt": "Date"
}

// Order document 📄 — canonical for frontend ProductOrder (§1.9). paymentStatus adds PARTIALLY_REFUNDED.
{
  "_id": "ObjectId",
  "orderNumber": "string",                 // unique
  "buyerId": "ObjectId",                   // ref "users"
  "items": [
    {
      "productId": "ObjectId",             // ref "Product"
      "productName": "string",
      "sellerId": "ObjectId",              // ref "users"
      "quantity": "number",
      "unitPrice": "number",               // NGN, snapshot
      "subtotal": "number"                 // NGN
    }
  ],
  "pricing": {
    "subtotal": "number",                  // NGN
    "shippingCost": "number",              // NGN
    "platformFee": "number",               // NGN
    "discount": "number",                  // NGN
    "total": "number"                      // NGN
  },
  "shippingAddress": {
    "name": "string", "phone": "string", "street": "string", "city": "string",
    "state": "string", "postalCode": "string",
    "coordinates": { "lat": "number", "lng": "number" }   // optional
  },
  "paymentStatus": ["PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED"],  // 📄 PARTIALLY_REFUNDED ADOPTED (admin partial refunds)
  "fulfillmentStatus": ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
  "paymentData": { "transactionRef": "string", "method": "string", "paidAt": "Date" },  // paidAt optional
  "trackingInfo": {                        // optional
    "carrier": "string",
    "trackingNumber": "string",
    "updates": [ { "status": "string", "location": "string", "timestamp": "Date" } ]
  },
  "deliveredAt": "Date",                   // optional
  "cancelledBy": "ObjectId",               // optional, ref "users"/"adminUsers"
  "cancellationReason": "string",          // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

#### 7.7.7 Adashe / contributions domain 📄 — `PRD/user_module/adashesu-contributions/adashesu-contributions.md`

```jsonc
// ContributionGroup document 📄 — admin oversight via "contributions:*" (payout processing, suspension)
{
  "_id": "ObjectId",
  "name": "string",
  "organizerId": "ObjectId",               // ref "users"
  "type": ["ADASHE", "ESUSU", "CUSTOM"],
  "description": "string",
  "contributionAmount": "number",          // NGN per cycle
  "frequency": ["DAILY", "WEEKLY", "MONTHLY"],
  "totalMembers": "number",
  "currentCycle": "number",
  "startDate": "Date",
  "status": ["FORMING", "ACTIVE", "COMPLETED", "SUSPENDED"],   // SUSPENDED settable by admin
  "payoutOrder": [
    { "memberId": "ObjectId", "position": "number", "paid": "boolean", "paidAt": "Date" }  // paidAt optional
  ],
  "rules": {
    "lateFeePercent": "number",            // %
    "missLimit": "number",
    "exitPenalty": "number"                // NGN or %
  },
  "walletId": "ObjectId",                  // ref "Wallet" — group pool wallet
  "createdAt": "Date",
  "updatedAt": "Date"
}

// GroupMember document 📄 — normalizes the frontend ContributionGroup.members / slots (§1.6)
{
  "_id": "ObjectId",
  "groupId": "ObjectId",                   // ref "ContributionGroup"
  "userId": "ObjectId",                    // ref "users"
  "position": "number",                    // payout order slot
  "joinedAt": "Date",
  "status": ["ACTIVE", "RECEIVED_PAYOUT", "EXITED", "REMOVED"],
  "contributions": [
    {
      "cycle": "number",
      "amount": "number",                  // NGN
      "dueDate": "Date",
      "paidAt": "Date",                    // optional
      "status": ["PENDING", "PAID", "LATE", "MISSED"],
      "lateFee": "number"                  // optional, NGN
    }
  ],
  "payoutReceived": {                      // optional
    "cycle": "number",
    "amount": "number",                    //   NGN
    "paidAt": "Date",
    "transactionRef": "string"
  },
  "createdAt": "Date"                       // no updatedAt in PRD
}
```

#### 7.7.8 Membership domain 📄 — `PRD/user_module/membership/membership-management.md`

```jsonc
// Membership document 📄 — canonical for frontend MembershipInfo (§1.1); ref User.memberships (§2.1)
{
  "_id": "ObjectId",
  "userId": "ObjectId",                    // required, unique, indexed; ref "users"
  "membershipNumber": "string",            // unique
  "cooperativeId": "ObjectId",             // indexed; ref "Cooperative"
  "status": ["PENDING", "PROBATION", "ACTIVE", "SUSPENDED", "TERMINATED", "RESIGNED"],
  "type": ["REGULAR", "ASSOCIATE", "SENIOR", "LIFETIME"],
  "joinedAt": "Date",
  "probationEndsAt": "Date",               // optional
  "expiresAt": "Date",                     // optional
  "renewalCount": "number",
  "sharesOwned": "number",
  "votingRights": "boolean",
  "eligibility": {
    "loans": "boolean", "dividends": "boolean", "equipmentBooking": "boolean",
    "training": "boolean", "marketAccess": "boolean"
  },
  "dues": {
    "registrationFee": "number",           // NGN
    "annualDue": "number",                 // NGN
    "lastPaidAt": "Date",                  // optional
    "nextDueDate": "Date",                 // optional
    "outstandingBalance": "number"         // NGN
  },
  "documents": [
    {
      "type": "string",                    // 'ID_CARD', 'APPLICATION_FORM', 'GUARANTOR_FORM', etc.
      "url": "string",
      "status": ["PENDING", "APPROVED", "REJECTED"],
      "uploadedAt": "Date",
      "verifiedBy": "ObjectId",            //   optional, 📄 ref "adminUsers"
      "verifiedAt": "Date"                 //   optional
    }
  ],
  "guarantors": [                          // optional
    {
      "userId": "ObjectId",                //   ref "users"
      "relationship": "string",
      "contactPhone": "string",
      "verifiedAt": "Date"                 //   optional
    }
  ],
  "metadata": "Record<string, any>",       // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}

// Cooperative document 📄 — org entity. status enum EXTENDED with ADOPTED admin lifecycle values.
{
  "_id": "ObjectId",
  "name": "string",
  "code": "string",                        // unique
  "description": "string",
  "type": ["MULTI_PURPOSE", "CREDIT", "AGRICULTURAL", "CONSUMER"],
  "status": ["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED", "REJECTED", "BANNED"],  // 📄 ADOPTED — extends PRD's ACTIVE|INACTIVE|SUSPENDED
  "registrationNumber": "string",
  "registeredDate": "Date",
  "address": {
    "street": "string", "city": "string", "state": "string",
    "country": "string", "postalCode": "string",
    "coordinates": { "lat": "number", "lng": "number" }   // optional
  },
  "contactInfo": { "email": "string", "phone": "string", "website": "string" },  // website optional
  "leadership": {
    "chairman": "ObjectId",                // optional, ref "users"
    "secretary": "ObjectId",               // optional, ref "users"
    "treasurer": "ObjectId"                // optional, ref "users"
  },
  "membershipSettings": {
    "minAge": "number", "maxAge": "number",                 // maxAge optional
    "registrationFee": "number",           // NGN
    "annualDue": "number",                 // NGN
    "sharePrice": "number",                // NGN
    "minShares": "number", "maxShares": "number",           // maxShares optional
    "probationPeriodDays": "number",
    "requiresGuarantor": "boolean",
    "guarantorCount": "number"
  },
  "totalMembers": "number",
  "activeMembers": "number",
  "logo": "string",                        // optional
  // ── ADOPTED admin-lifecycle fields (📄) — approval/rejection/ban workflow ──
  "approvedBy": "ObjectId",                // 📄 optional, ref "adminUsers" — approver (status PENDING→ACTIVE, "cooperatives:approve")
  "rejectionReason": "string",             // 📄 optional; set when status REJECTED
  "banReason": "string",                   // 📄 optional; set when status BANNED (super_admin, "cooperatives:ban")
  "bannedAt": "Date",                      // 📄 optional
  "metadata": "Record<string, any>",       // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}

// MembershipApplication document 📄 — admin approval queue (RBAC "membership:applications:review")
{
  "_id": "ObjectId",
  "userId": "ObjectId",                    // ref "users"
  "cooperativeId": "ObjectId",             // ref "Cooperative"
  "status": ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN"],
  "applicationData": {
    "occupation": "string",
    "monthlyIncome": "number",             // NGN
    "farmSize": "number",                  // optional
    "farmLocation": "string",              // optional
    "yearsOfExperience": "number",         // optional
    "reasonForJoining": "string"
  },
  "submittedAt": "Date",
  "reviewedBy": "ObjectId",                // optional, 📄 ref "adminUsers" — reviewer
  "reviewedAt": "Date",                    // optional
  "rejectionReason": "string",             // optional
  "approvalNotes": "string",               // optional
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

#### 7.7.9 Agent domain 📄 — `PRD/user_module/agent-dashboard-commission/agent-dashboard-commission.md`

```jsonc
// AgentProfile document 📄 — admin-approved (approvedBy → adminUsers); tier/status admin-settable.
{
  "_id": "ObjectId",
  "userId": "ObjectId",                    // ref "users"
  "agentCode": "string",                   // unique
  "tier": ["BRONZE", "SILVER", "GOLD", "PLATINUM"],
  "status": ["PENDING", "ACTIVE", "SUSPENDED", "TERMINATED"],
  "specialization": ["MEMBER_RECRUITMENT", "LOAN_ORIGINATION", "SALES", "SUPPORT"],  // array subset
  "territory": { "state": "string", "lga": "string[]" },
  "commissionRates": {                     // % or fixed NGN — admin-tunable (mirrors settings.commission.rates, §7.5)
    "memberRecruitment": "number",
    "loanOrigination": "number",
    "productSales": "number",
    "savingsReferral": "number"
  },
  "performanceMetrics": {
    "totalReferrals": "number",
    "activeReferrals": "number",
    "totalCommission": "number",           // NGN
    "paidCommission": "number",            // NGN
    "pendingCommission": "number",         // NGN
    "rating": { "average": "number", "count": "number" }
  },
  "bankDetails": { "accountNumber": "string", "bankName": "string", "accountName": "string" },
  "approvedBy": "ObjectId",                // 📄 ref "adminUsers" (§7.1) — approver ("agents:approve")
  "approvedAt": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}

// Referral document 📄 — canonical (with CommissionPayment) for frontend CommissionReward (§1.10). ⚠️ §2.4 calls this "AgentReferral".
{
  "_id": "ObjectId",
  "agentId": "ObjectId",                   // ref "AgentProfile"
  "referredUserId": "ObjectId",            // ref "users"
  "type": ["MEMBER", "CUSTOMER", "MERCHANT"],
  "status": ["PENDING", "ACTIVE", "CONVERTED", "REJECTED"],
  "commission": {
    "amount": "number",                    // NGN
    "rate": "number",                      // % or fixed
    "status": ["PENDING", "APPROVED", "PAID", "REVERSED"],   // REVERSED via super_admin ("commissions:reverse")
    "calculatedAt": "Date",
    "paidAt": "Date"                       //   optional
  },
  "conversionData": {                      // optional
    "convertedAt": "Date",
    "value": "number",                     //   NGN — transaction value / membership fee
    "productType": "string"
  },
  "createdAt": "Date"                       // no updatedAt in PRD
}

// CommissionPayment document 📄 — batched settlement (RBAC "commissions:pay"; approve/process reserved per settings)
{
  "_id": "ObjectId",
  "agentId": "ObjectId",                   // ref "AgentProfile"
  "period": { "startDate": "Date", "endDate": "Date" },
  "totalAmount": "number",                 // NGN (gross)
  "breakdown": [
    { "referralId": "ObjectId", "description": "string", "amount": "number" }   // ref "Referral"; amount NGN
  ],
  "taxWithheld": "number",                 // NGN (see settings.commission.taxWithholdingPercent, §7.5)
  "netAmount": "number",                   // NGN
  "paymentStatus": ["PENDING", "PROCESSING", "PAID", "FAILED"],
  "paymentReference": "string",            // optional
  "processedBy": "ObjectId",               // optional, 📄 ref "adminUsers" — admin who ran payout
  "paidAt": "Date",                        // optional
  "createdAt": "Date"                       // no updatedAt in PRD
}
```

> **Adopted-field provenance.** The fields marked **ADOPTED** above (`Product.moderationStatus`/`suspended`, `Order.paymentStatus` `PARTIALLY_REFUNDED`, `Cooperative.status` extension + `approvedBy`/`rejectionReason`/`banReason`/`bannedAt`) are admin-module additions **not present in the source user-module PRDs**; they are recorded here (📄) as the agreed target and should be back-propagated into those PRDs (and the eventual schemas) on reconciliation. Every admin write to these collections carries an `adminAuditLog` entry (§7.3) and an RBAC permission guard; destructive/financial-reversal actions (transaction reversal, dividend distribution, commission reversal, ban) are reserved for `isSuperAdmin` admins (§7.1).

---

## 8. Notification Engine & Real-time Layer 📄

> **Status:** every structure below is 📄 **planned** (specified in
> [`PRD/notification.md`](notification.md) + [`PRD/socket.io.md`](socket.io.md), not yet
> coded). None of these collections/gateways exist on disk. This section is the
> data-model slice; the two PRDs carry the full contract (service API, endpoints,
> flows, env, SW strategy, CSP).

A single backend `NotificationService.notify()`/`notifyAdmins()` fans one logical
notification over **two transports** — **socket.io** (in-app, tab open) and **FCM web
push** (background, tab closed) — always **persisting** it first. The FCM leg is a
**graceful no-op when creds are absent**, exactly like `MailService` (§ `oneSignal.md`).
This section supersedes the client-only `FarmerNotification` mock (§1.7) with a
server-backed model. The **only wired trigger this phase** is **new user signup →
notify all active, non-banned admins**.

### 8.1 `notifications` collection 📄

Durable inbox record — one document per delivered notification, for **either** plane
(disambiguated by `audience` + exactly one of `userId`/`adminId`).

```jsonc
// notifications document
{
  "_id": "ObjectId",                       // auto
  "audience": ["user", "admin"],           // recipient plane
  "userId": "ObjectId",                    // set iff audience === "user"; ref "users", indexed
  "adminId": "ObjectId",                   // set iff audience === "admin"; ref "adminUsers", indexed
  "event": "string",                       // machine key, e.g. "user.signup"
  "type": ["info", "success", "warning", "alert"],  // UI severity — reuses FarmerNotification.type (§1.7)
  "title": "string",
  "message": "string",
  "data": "Record<string, any>",           // optional; event payload (e.g. { newUserId, email, name })
  "link": "string",                        // optional; deep-link opened on click (e.g. "/bennie/users/<id>")
  "isRead": "boolean",                     // default false
  "readAt": "Date",                        // optional; set on markRead
  "channels": {                            // per-transport delivery outcome (observability)
    "socket": "boolean",                   //   emitted to ≥1 live socket
    "push":   "boolean"                    //   FCM accepted ≥1 token (best-effort)
  },
  "createdAt": "Date",                     // auto (timestamps)
  "updatedAt": "Date"                      // auto (timestamps)
}
```

- **Indexes:** compound `{ audience, userId, createdAt: -1 }` and
  `{ audience, adminId, createdAt: -1 }` (inbox listing, newest first); partial
  `{ audience, userId, isRead }` / `{ audience, adminId, isRead }` (unread-count);
  single `event`.
- **Validation:** exactly one of `userId`/`adminId` is set, matching `audience`.
- **`notifyAdmins` writes one doc per recipient admin** (so read-state is per-admin),
  then emits once to the shared `admins` socket room.

### 8.2 `deviceTokens` collection 📄

Registered FCM web-push tokens (opt-in). One document per (owner, token); owned by a
**user** or an **admin**, never both.

```jsonc
// deviceTokens document
{
  "_id": "ObjectId",                       // auto
  "audience": ["user", "admin"],           // owner plane
  "userId": "ObjectId",                    // set iff audience === "user"; ref "users", indexed
  "adminId": "ObjectId",                   // set iff audience === "admin"; ref "adminUsers", indexed
  "token": "string",                       // FCM registration token; unique, indexed
  "userAgent": "string",                   // optional; captured at registration
  "lastSeenAt": "Date",                    // optional; refreshed on re-register / successful push
  "isActive": "boolean",                   // default true; set false when FCM reports the token stale
  "createdAt": "Date",                     // auto (timestamps)
  "updatedAt": "Date"                      // auto (timestamps)
}
```

- **Indexes:** unique `token`; compound `{ audience, userId }` and
  `{ audience, adminId }` (fan-out lookup at push time).
- **Pruning:** on FCM `registration-token-not-registered`/`invalid-registration-token`,
  the token is marked `isActive: false` (or deleted). `DELETE …/device-tokens/:token`
  removes it on explicit opt-out / logout.

### 8.3 Real-time / Socket model 📄

socket.io fronts the same engine as the in-app transport (full spec:
[`socket.io.md`](socket.io.md)). Two namespaces mirror the dual-plane JWT auth
(§5.1 `scope`; `jwt.strategy.ts` vs `admin-jwt.strategy.ts`):

| Namespace | Plane | Handshake JWT | Secret |
|-----------|-------|---------------|--------|
| `/rt/user` | end users | user token, `scope: "user"` (via `auth.token`) | `configuration.jwt.secret` |
| `/rt/admin` | admins | admin token, `scope: "admin"` (via `auth.token`) | `configuration.adminJwt.secret` |

**Rooms:** `user:<userId>` (all a user's tabs) · `admin:<adminId>` (all an admin's
tabs) · `admins` (every connected admin, for broadcast fan-out).

**Events:**

| Event | Direction | Target | Payload |
|-------|-----------|--------|---------|
| `notification:new` | server → client | `user:<id>` or `admins` | a `notifications` doc (§8.1) |
| `notification:unread_count` | server → client | `user:<id>` / `admin:<id>` | `{ unreadCount: number }` |
| `support:message` | user → admins | `admins` room | `{ fromUserId, name, message, at }` |
| `support:reply` | admin → one user | `user:<userId>` | `{ fromAdminId, toUserId, message, at }` |

- **Single-instance now**; a socket.io **Redis adapter** is the planned path for
  horizontal scale (room emits across instances). ⚠️ flagged for the owner.
- **Isolation:** per-namespace scope enforcement mirrors the HTTP `JwtAuthGuard` vs
  `AdminJwtGuard` split; identities are server-derived from the verified JWT, never
  from client payloads.

### 8.4 Firebase / FCM settings & env

- **Backend server credential — three individual env vars** (added to a 📄 planned
  `configuration.firebase` group, see §3): `FIREBASE_PROJECT_ID`,
  `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (the PEM key un-escapes `\n` at load).
  Absent creds ⇒ `FcmService` no-ops (persist + socket still run).
- **Frontend client credential — Vite env:** `VITE_FIREBASE_API_KEY`,
  `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
  `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY`.
- The `public/firebase-messaging-sw.js` service worker loads its config from **query
  params** (registered as `/firebase-messaging-sw.js?apiKey=…&projectId=…&messagingSenderId=…&appId=…`;
  the SW reads `new URL(self.location).searchParams`) so **no keys are hard-coded** in
  the static worker file. See `notification.md` for the rationale.
- These are transport creds and stay in env/`configuration` (§3) — **not** in the
  admin-editable `settings` collection (§7.5), consistent with "secrets never live in
  `settings`". `settings.email.oneSignal` (§7.5) already models the analogous non-secret
  mail config; no `settings` change is required for FCM this phase.
