# PRD-002: Digital Wallet Module

## Overview
This module manages the digital wallet system for farmers, including deposits, withdrawals, transfers, transaction history, and integration with SeerBit payment gateway.

## Technology Stack
- **Framework**: NestJS v10+
- **Database**: MongoDB with Mongoose ODM
- **Payment Gateway**: SeerBit API
- **Real-time Updates**: Socket.io for wallet balance updates
- **Transaction Management**: MongoDB transactions for ACID compliance

## Database Schema

### Wallet Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, unique),
  balance: Number (default: 0, min: 0),
  currency: String (default: 'NGN'),
  status: Enum ['active', 'suspended', 'closed'],
  dailyTransactionLimit: Number (default: 500000),
  monthlyTransactionLimit: Number (default: 5000000),
  totalDeposited: Number (default: 0),
  totalWithdrawn: Number (default: 0),
  totalSpent: Number (default: 0),
  lastTransactionAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### WalletTransaction Collection
```typescript
{
  _id: ObjectId,
  walletId: ObjectId (ref: Wallet),
  userId: ObjectId (ref: User),
  type: Enum ['deposit', 'withdraw', 'transfer', 'savings_transfer', 'share_purchase', 'share_sale', 'dividend_payment', 'membership_fee', 'marketplace_purchase', 'service_booking_payment'],
  amount: Number,
  balanceBefore: Number,
  balanceAfter: Number,
  description: String,
  reference: String (unique),
  gatewayReference: String,
  paymentGateway: Enum ['SeerBit', 'Bank Transfer', 'Internal'],
  status: Enum ['pending', 'success', 'failed', 'reversed'],
  failureReason: String,
  metadata: {
    source: String,
    destinationWalletId: ObjectId,
    bookingId: ObjectId,
    orderId: ObjectId,
    savingsId: ObjectId,
    shareTransactionId: ObjectId,
    membershipId: ObjectId
  },
  processedAt: Date,
  createdAt: Date
}
```

### DepositRequest Collection
```typescript
{
  _id: ObjectId,
  walletId: ObjectId (ref: Wallet),
  userId: ObjectId (ref: User),
  amount: Number,
  paymentMethod: Enum ['card', 'bank_transfer', 'ussd'],
  seerbitReference: String,
  seerbitToken: String,
  status: Enum ['initiated', 'pending', 'completed', 'failed', 'expired'],
  redirectUrl: String,
  expiryTime: Date,
  completedAt: Date,
  createdAt: Date
}
```

### WithdrawalRequest Collection
```typescript
{
  _id: ObjectId,
  walletId: ObjectId (ref: Wallet),
  userId: ObjectId (ref: User),
  amount: Number,
  bankName: String,
  accountNumber: String,
  accountName: String,
  status: Enum ['pending', 'processing', 'approved', 'rejected', 'completed'],
  approvalRequired: Boolean,
  approvedBy: ObjectId (ref: User),
  processedBy: ObjectId (ref: User),
  rejectionReason: String,
  transactionFee: Number,
  netAmount: Number,
  completedAt: Date,
  createdAt: Date
}
```

## API Endpoints

### Wallet Management
- `GET /api/v1/wallet` - Get wallet details and balance
- `GET /api/v1/wallet/summary` - Get wallet summary with statistics
- `PATCH /api/v1/wallet/limits` - Update transaction limits (admin only)

### Deposits
- `POST /api/v1/wallet/deposit/initiate` - Initiate deposit via SeerBit
- `GET /api/v1/wallet/deposit/verify/:reference` - Verify deposit status
- `POST /api/v1/wallet/deposit/webhook` - SeerBit webhook handler
- `GET /api/v1/wallet/deposits` - Get deposit history
- `GET /api/v1/wallet/deposits/:id` - Get specific deposit details

### Withdrawals
- `POST /api/v1/wallet/withdraw` - Request withdrawal
- `GET /api/v1/wallet/withdrawals` - Get withdrawal history
- `GET /api/v1/wallet/withdrawals/:id` - Get specific withdrawal details
- `POST /api/v1/wallet/withdraw/cancel/:id` - Cancel pending withdrawal

### Transfers
- `POST /api/v1/wallet/transfer` - Transfer to another wallet
- `GET /api/v1/wallet/transfers` - Get transfer history
- `POST /api/v1/wallet/transfer/validate-account` - Validate beneficiary account

### Transactions
- `GET /api/v1/wallet/transactions` - Get all transactions (paginated)
- `GET /api/v1/wallet/transactions/:id` - Get specific transaction
- `GET /api/v1/wallet/transactions/export` - Export transactions to CSV/PDF
- `GET /api/v1/wallet/transactions/statistics` - Get transaction analytics

### Beneficiaries
- `GET /api/v1/wallet/beneficiaries` - Get saved beneficiaries
- `POST /api/v1/wallet/beneficiaries` - Add new beneficiary
- `DELETE /api/v1/wallet/beneficiaries/:id` - Remove beneficiary
- `PUT /api/v1/wallet/beneficiaries/:id` - Update beneficiary

## Business Logic

### Deposit Flow (SeerBit Integration)
1. User initiates deposit with amount and payment method
2. System creates deposit request with unique reference
3. Call SeerBit API to generate payment URL/token
4. Redirect user to SeerBit payment page
5. User completes payment on SeerBit
6. SeerBit sends webhook notification
7. System verifies webhook signature
8. Update deposit status to 'completed'
9. Credit wallet balance atomically
10. Create transaction record
11. Emit real-time balance update via Socket.io
12. Send confirmation notification

### Withdrawal Flow
1. User submits withdrawal request with bank details
2. System validates sufficient balance
3. Check if approval required (based on amount threshold)
4. Deduct amount from wallet (hold status)
5. For amounts > ₦50,000: require admin approval
6. Process payout via bank transfer API
7. Update withdrawal status
8. Create transaction record
9. Send notification on completion

### Internal Transfer Flow
1. User enters recipient wallet ID/email/phone
2. System validates recipient exists
3. User confirms transfer amount
4. Atomic transaction: debit sender, credit receiver
5. Create transaction records for both parties
6. Send notifications to both users
7. Emit real-time balance updates

### Transaction Limits
- Daily limit: ₦500,000 (configurable by tier)
- Monthly limit: ₦5,000,000 (configurable by tier)
- Single transaction limit: ₦200,000
- KYC verified users get higher limits
- Admin can override limits

### Fee Structure
- Deposits: Free (SeerBit charges merchant)
- Withdrawals: ₦50 flat fee
- Internal transfers: Free
- External transfers: 0.5% (min ₦10, max ₦500)

## SeerBit Integration

### Configuration
```typescript
{
  secretKey: process.env.SEERBIT_SECRET_KEY,
  publicKey: process.env.SEERBIT_PUBLIC_KEY,
  baseUrl: 'https://checkout.seerbit.com/api/v2',
  webhookSecret: process.env.SEERBIT_WEBHOOK_SECRET
}
```

### API Methods
- `POST /charge` - Initialize payment
- `POST /tokenized-charges` - Tokenized payments
- `GET /transactions/:reference` - Verify transaction
- `POST /refund` - Process refund

### Webhook Handling
1. Verify webhook signature using HMAC
2. Parse event type (payment.success, payment.failed, etc.)
3. Update corresponding deposit request
4. Process wallet credit/debit
5. Return 200 OK to acknowledge receipt
6. Implement retry logic for failed processing

## Security Requirements
- All wallet operations require authentication
- Withdrawal requests require 2FA for amounts > ₦100,000
- Webhook endpoints verify SeerBit signatures
- Transaction signing for audit trail
- Rate limiting on withdrawal requests
- IP whitelisting for admin operations
- Encryption of sensitive data (account numbers)
- Idempotency keys for all financial transactions

## Real-time Features (Socket.io)
- Balance update events
- Transaction completion notifications
- Deposit confirmation alerts
- Withdrawal status changes
- Low balance warnings

## Error Handling
- Insufficient funds: 400 Bad Request
- Invalid account: 404 Not Found
- Limit exceeded: 422 Unprocessable Entity
- Gateway errors: 502 Bad Gateway with retry
- Duplicate transactions: 409 Conflict
- Rollback on transaction failures

## Testing Requirements
- Unit tests for wallet service methods
- Integration tests for SeerBit API calls
- Mock SeerBit responses for testing
- E2E tests for complete deposit/withdrawal flows
- Transaction atomicity tests
- Webhook signature verification tests
- Minimum 85% code coverage

## Performance Requirements
- Balance query response time < 50ms
- Transaction processing < 2 seconds
- Support 500 concurrent transactions
- Webhook processing < 1 second
- 99.9% uptime for payment processing

## Monitoring & Logging
- All financial transactions logged with correlation IDs
- Failed transaction alerts
- SeerBit API health monitoring
- Balance discrepancy detection
- Daily reconciliation reports
- Suspicious activity detection

## Compliance Requirements
- Transaction audit trail (7 years retention)
- AML (Anti-Money Laundering) checks
- Large transaction reporting (>₦1M)
- CBN (Central Bank of Nigeria) compliance
- PCI DSS compliance for card data handling
