# PRD 02: Digital Wallet with SeerBit Integration

## Overview
Enterprise-grade digital wallet system with SeerBit payment gateway integration for the Cooperative Farming Portal using NestJS and MongoDB.

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
**Description:** Initiate a deposit via SeerBit
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
    "checkoutUrl": "https://checkout.seerbit.com/...",
    "expiresAt": "2024-01-01T12:00:00Z"
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

#### POST /api/v1/webhooks/seerbit/deposit
**Description:** SeerBit webhook endpoint for deposit notifications
**No Auth Required** (secured by signature verification)
**Request Body:** (SeerBit webhook payload)
**Response:** 200 OK

### Withdrawals

#### GET /api/v1/wallet/banks/resolve
**Description:** Resolve bank details from account number
**Headers:** Authorization: Bearer <token>
**Query Params:** accountNumber, bankCode
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "accountNumber": "1234567890",
    "accountName": "John Doe",
    "bankName": "GTBank",
    "bankCode": "058"
  }
}
```

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
**Description:** Transfer to external bank account (via SeerBit transfer)
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

### Deposit Flow (SeerBit)
1. User initiates deposit with amount
2. System creates deposit request with unique reference
3. Call SeerBit payment initialization API
4. Return checkout URL to frontend
5. User completes payment on SeerBit checkout
6. SeerBit sends webhook notification
7. Verify webhook signature
8. Update deposit status and wallet balance
9. Send confirmation notification

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

## SeerBit Integration

### Configuration
```typescript
{
  apiKey: process.env.SEERBIT_PUBLIC_KEY,
  secretKey: process.env.SEERBIT_SECRET_KEY,
  baseUrl: 'https://gateway.seerbit.com',
  webhookSecret: process.env.SEERBIT_WEBHOOK_SECRET
}
```

### Payment Initialization
**Endpoint:** POST /payment/initialize
**Headers:** Authorization: Bearer {secret_key}
**Body:**
```json
{
  "email": "user@example.com",
  "amount": 10000,
  "currency": "NGN",
  "reference": "DEP1234567890",
  "callback_url": "https://app.coopfarming.com/wallet/deposit/callback",
  "meta": {
    "userId": "user_id",
    "walletId": "wallet_id"
  }
}
```

### Transfer Disbursement
**Endpoint:** POST /transfer/disburse
**Headers:** Authorization: Bearer {secret_key}
**Body:**
```json
{
  "account_number": "1234567890",
  "bank_code": "058",
  "amount": 50000,
  "currency": "NGN",
  "reference": "WDR1234567890",
  "narration": "Withdrawal payment",
  "customer_name": "John Doe"
}
```

### Transaction Verification
**Endpoint:** GET /transaction/verify/{reference}
**Headers:** Authorization: Bearer {secret_key}

### Webhook Signature Verification
```typescript
const signature = req.headers['x-seerbit-signature'];
const payload = JSON.stringify(req.body);
const expectedSignature = crypto
  .createHmac('sha512', webhookSecret)
  .update(payload)
  .digest('hex');
// Compare signatures
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

```bash
# SeerBit Configuration
SEERBIT_PUBLIC_KEY=pk_test_xxx
SEERBIT_SECRET_KEY=sk_test_xxx
SEERBIT_WEBHOOK_SECRET=whsec_xxx
SEERBIT_BASE_URL=https://gateway.seerbit.com

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
