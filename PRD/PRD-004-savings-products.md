# PRD-004: Savings Products Module

## Overview
This module manages all savings products including Flex Save, Target Goals, Fixed Deposits, and Harvest Save Plans with interest calculation, auto-debits, and withdrawal management.

## Technology Stack
- **Framework**: NestJS v10+
- **Database**: MongoDB with Mongoose ODM
- **Interest Calculation**: Custom compound interest engine
- **Scheduling**: Bull/BullMQ for daily interest accrual
- **Real-time Updates**: Socket.io for balance changes
- **Transaction Management**: MongoDB transactions for ACID compliance

## Database Schema

### FlexSave Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, unique),
  balance: Number (default: 0),
  accruedInterest: Number (default: 0),
  totalDeposited: Number (default: 0),
  totalWithdrawn: Number (default: 0),
  interestRate: Number (annual percentage, e.g., 11.5),
  lastInterestCalculation: Date,
  status: Enum ['active', 'frozen', 'closed'],
  createdAt: Date,
  updatedAt: Date
}
```

### TargetGoal Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  title: String,
  description: String,
  targetAmount: Number,
  currentAmount: Number,
  category: String, // e.g., "Tractor", "Fertilizer", "Farmland", "Solar Irrigation"
  interestRate: Number (annual percentage),
  startDate: Date,
  endDate: Date,
  status: Enum ['ongoing', 'completed', 'withdrawn', 'paused'],
  autoDebitEnabled: Boolean,
  autoDebitAmount: Number,
  autoDebitFrequency: Enum ['daily', 'weekly', 'monthly'],
  lastAutoDebitDate: Date,
  nextAutoDebitDate: Date,
  completionDate: Date,
  withdrawalReason: String,
  withdrawnAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### FixedDeposit Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  principalAmount: Number,
  interestRate: Number (annual percentage, e.g., 14.0),
  tenureMonths: Number, // 3, 6, 9, 12, 18, 24
  startDate: Date,
  maturityDate: Date,
  accumulatedInterest: Number (default: 0),
  totalValue: Number,
  status: Enum ['locked', 'matured', 'withdrawn', 'auto_renewed'],
  autoRenew: Boolean (default: false),
  renewalTenure: Number,
  payoutInstruction: Enum ['credit_wallet', 'reinvest', 'bank_transfer'],
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  withdrawnAt: Date,
  renewedFrom: ObjectId (ref: FixedDeposit),
  createdAt: Date,
  updatedAt: Date
}
```

### HarvestSavePlan Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  title: String,
  cropType: String, // e.g., "Maize", "Cocoa", "Yam", "Cassava"
  farmSize: Number, // in hectares
  expectedYield: Number,
  expectedRevenue: Number,
  targetSeason: String, // e.g., "Dry Season 2026", "Rainy Harvest Q4 2026"
  amountSaved: Number,
  interestRate: Number (annual percentage),
  plantingDate: Date,
  expectedHarvestDate: Date,
  releaseDate: Date,
  status: Enum ['active', 'harvested', 'failed', 'partial_harvest'],
  actualHarvestDate: Date,
  actualYield: Number,
  actualRevenue: Number,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### SavingsTransaction Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  savingsType: Enum ['flex_save', 'target_goal', 'fixed_deposit', 'harvest_plan'],
  savingsId: ObjectId,
  transactionType: Enum ['deposit', 'withdrawal', 'interest_credit', 'auto_debit', 'transfer', 'penalty'],
  amount: Number,
  balanceBefore: Number,
  balanceAfter: Number,
  interestComponent: Number,
  description: String,
  reference: String (unique),
  walletTransactionId: ObjectId (ref: WalletTransaction),
  metadata: {
    source: String,
    goalProgress: Number,
    daysToMaturity: Number,
    earlyWithdrawalPenalty: Number
  },
  createdAt: Date
}
```

### InterestLog Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  savingsType: Enum ['flex_save', 'target_goal', 'fixed_deposit', 'harvest_plan'],
  savingsId: ObjectId,
  calculationDate: Date,
  principalAmount: Number,
  dailyRate: Number,
  interestEarned: Number,
  cumulativeInterest: Number,
  daysElapsed: Number,
  status: Enum ['pending', 'posted', 'reversed'],
  postedAt: Date,
  createdAt: Date
}
```

## API Endpoints

### Flex Save
- `GET /api/v1/savings/flex` - Get flex save balance and details
- `POST /api/v1/savings/flex/deposit` - Deposit to flex save
- `POST /api/v1/savings/flex/withdraw` - Withdraw from flex save
- `GET /api/v1/savings/flex/transactions` - Get flex save transaction history
- `GET /api/v1/savings/flex/interest-history` - Get interest accrual history

### Target Goals
- `GET /api/v1/savings/targets` - Get all target goals
- `GET /api/v1/savings/targets/:id` - Get specific target goal
- `POST /api/v1/savings/targets` - Create new target goal
- `PATCH /api/v1/savings/targets/:id` - Update target goal
- `POST /api/v1/savings/targets/:id/deposit` - Deposit to target
- `POST /api/v1/savings/targets/:id/withdraw` - Withdraw from target
- `DELETE /api/v1/savings/targets/:id` - Delete/cancel target
- `PUT /api/v1/savings/targets/:id/auto-debit` - Configure auto-debit
- `GET /api/v1/savings/targets/:id/progress` - Get goal progress

### Fixed Deposits
- `GET /api/v1/savings/fixed` - Get all fixed deposits
- `GET /api/v1/savings/fixed/plans` - Get available fixed deposit plans
- `POST /api/v1/savings/fixed` - Create new fixed deposit
- `GET /api/v1/savings/fixed/:id` - Get fixed deposit details
- `POST /api/v1/savings/fixed/:id/withdraw` - Withdraw matured deposit
- `POST /api/v1/savings/fixed/:id/renew` - Renew fixed deposit
- `POST /api/v1/savings/fixed/:id/break` - Break fixed deposit early (with penalty)
- `GET /api/v1/savings/fixed/maturing-soon` - Get deposits maturing soon

### Harvest Save Plans
- `GET /api/v1/savings/harvest` - Get all harvest plans
- `GET /api/v1/savings/harvest/:id` - Get specific harvest plan
- `POST /api/v1/savings/harvest` - Create new harvest plan
- `PATCH /api/v1/savings/harvest/:id` - Update harvest plan
- `POST /api/v1/savings/harvest/:id/deposit` - Add to harvest savings
- `POST /api/v1/savings/harvest/:id/complete` - Mark as harvested
- `DELETE /api/v1/savings/harvest/:id` - Cancel harvest plan

### General
- `GET /api/v1/savings/summary` - Get total savings summary across all products
- `GET /api/v1/savings/transactions` - Get all savings transactions
- `GET /api/v1/savings/interest-rates` - Get current interest rates
- `POST /api/v1/savings/transfer` - Transfer between savings products

## Business Logic

### Interest Calculation Engine

#### Daily Interest Formula (Compound)
```
Daily Rate = Annual Rate / 365
Daily Interest = Principal * Daily Rate
New Principal = Principal + Daily Interest
```

#### Monthly Compound Interest
```
A = P(1 + r/n)^(nt)
Where:
  A = Final amount
  P = Principal
  r = Annual interest rate (decimal)
  n = Compounding frequency (365 for daily)
  t = Time in years
```

### Flex Save Rules
- Minimum balance: ₦1,000
- No maximum balance
- Instant withdrawals (up to ₦50,000/day)
- Large withdrawals (>₦50,000): 24-hour hold
- Interest calculated daily, credited monthly
- Current rate: 11.5% APY
- No penalties for withdrawals

### Target Goal Rules
- Minimum initial deposit: ₦5,000
- Auto-debit options: daily, weekly, monthly
- Early withdrawal allowed with no penalty
- Goal completion bonus: +0.5% interest if target met by end date
- Multiple concurrent goals allowed
- Progress tracking with visual indicators

### Fixed Deposit Rules
- Tenure options: 3, 6, 9, 12, 18, 24 months
- Minimum deposit: ₦50,000
- Maximum deposit: ₦10,000,000
- Interest rates by tenure:
  - 3 months: 12.0%
  - 6 months: 13.0%
  - 9 months: 13.5%
  - 12 months: 14.0%
  - 18 months: 14.5%
  - 24 months: 15.0%
- Early withdrawal penalty: 50% of accrued interest
- Auto-renewal at prevailing rates
- Interest payout options: monthly, at maturity, reinvest

### Harvest Save Plan Rules
- Designed for seasonal farming cycles
- Lock period until harvest date
- Flexible deposits during growing season
- Full payout at harvest or partial advances (max 40%)
- Interest rate: 12.5% APY
- Crop failure insurance option (+1% fee)
- Revenue sharing on successful harvest

### Auto-Debit Processing
1. Check all active auto-debit configurations daily
2. Verify sufficient wallet balance
3. Initiate wallet debit
4. Credit corresponding savings product
5. Create transaction records
6. Send confirmation notification
7. Update next debit date
8. Handle failures with retry logic (3 attempts)

### Early Withdrawal Penalties
- **Fixed Deposit (< 50% tenure)**: Forfeit all interest
- **Fixed Deposit (> 50% tenure)**: 50% of accrued interest
- **Harvest Plan (pre-harvest)**: 25% of accrued interest
- **Target Goal**: No penalty

### Maturity Processing
1. Identify matured fixed deposits daily
2. Calculate final interest
3. Update status to 'matured'
4. Notify user via email/SMS/push
5. Execute payout instruction:
   - Credit wallet: instant transfer
   - Reinvest: create new fixed deposit
   - Bank transfer: initiate payout
6. If auto-renew enabled: create new deposit automatically

## Scheduled Jobs (BullMQ)

### Daily Interest Accrual
- Run every day at midnight (00:00 WAT)
- Calculate interest for all active savings
- Create interest log entries (status: pending)
- Post to accounts in batches
- Emit balance update events

### Monthly Interest Posting
- Run on 1st of every month at 2:00 AM
- Aggregate daily interest for the month
- Credit to respective savings balances
- Send monthly interest statements

### Auto-Debit Processing
- Run every day at 6:00 AM WAT
- Process scheduled auto-debits
- Handle insufficient funds gracefully
- Retry failed debits (max 3 times)

### Maturity Monitoring
- Run every hour
- Identify deposits maturing in next 24 hours
- Send maturity reminders
- Process matured deposits

### Harvest Season Alerts
- Run weekly during harvest seasons
- Alert users of upcoming harvest dates
- Request harvest confirmation
- Initiate payout process

## SeerBit Integration
- Payment for initial fixed deposit creation
- Top-up payments for all savings products
- Webhook handling for payment confirmations
- Tokenized charges for auto-debit

## Security Requirements
- All withdrawals require authentication
- Large withdrawals (>₦100,000) require 2FA
- Withdrawal limits based on membership tier
- Transaction signing for audit trail
- Encryption of bank details
- Idempotency for all financial operations

## Error Handling
- Insufficient funds: clear error with options
- Network errors: queue for retry
- Interest calculation errors: manual review queue
- Duplicate transactions: prevent with idempotency keys
- Rollback on failed multi-document operations

## Testing Requirements
- Unit tests for interest calculations (edge cases)
- Integration tests for deposit/withdrawal flows
- E2E tests for complete savings lifecycle
- Scheduled job testing with time mocks
- Accuracy tests for compound interest
- Minimum 90% code coverage

## Performance Requirements
- Balance queries < 50ms
- Interest calculation batch processing < 5 minutes for 10K accounts
- Withdrawal processing < 2 seconds
- Support 1000 concurrent savings operations

## Monitoring & Logging
- Daily interest accrual reports
- Savings growth analytics
- Early withdrawal tracking
- Maturity pipeline monitoring
- Auto-debit success rates
- Interest rate change impact analysis

## Compliance Requirements
- Interest income reporting for tax purposes
- CBN savings regulations compliance
- Audit trail for all transactions
- Data retention: 7 years minimum
- Customer fund segregation

## Notifications
- Deposit confirmations
- Withdrawal confirmations
- Interest credited alerts (monthly)
- Auto-debit success/failure
- Maturity reminders (7, 3, 1 days)
- Goal progress milestones (25%, 50%, 75%, 100%)
- Harvest season alerts
