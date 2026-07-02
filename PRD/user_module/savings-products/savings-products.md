# PRD 04: Savings Products Module

## Overview
Comprehensive savings products system including Flex, Target, Fixed, and Harvest savings plans using NestJS and MongoDB.

## Database Schema

### SavingsPlan Collection
```typescript
{
  _id: ObjectId;
  name: string;
  type: 'FLEX' | 'TARGET' | 'FIXED' | 'HARVEST';
  description: string;
  minAmount: number;
  maxAmount?: number;
  interestRate: number; // Annual percentage
  tenureDays?: number; // For fixed savings
  lockPeriodDays?: number;
  withdrawalRestrictions: {
    freeWithdrawals: number;
    penaltyPerWithdrawal: number;
    noticePeriodDays: number;
  };
  eligibility: {
    minMembershipDays: number;
    requiresActiveMembership: boolean;
    allowedRoles: string[];
  };
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}
```

### UserSavings Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User);
  planId: ObjectId (ref: SavingsPlan);
  accountNumber: string (unique);
  type: 'FLEX' | 'TARGET' | 'FIXED' | 'HARVEST';
  status: 'ACTIVE' | 'MATURED' | 'CLOSED' | 'FORFEITED';
  targetAmount?: number;
  principalBalance: number;
  accruedInterest: number;
  totalBalance: number;
  openedAt: Date;
  maturesAt?: Date;
  closedAt?: Date;
  lastInterestCalculationAt: Date;
  withdrawalCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### SavingsTransaction Collection
```typescript
{
  _id: ObjectId;
  savingsId: ObjectId (ref: UserSavings);
  walletId: ObjectId (ref: Wallet);
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST_CREDIT' | 'PENALTY_DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  reference: string (unique);
  narration: string;
  processedBy?: ObjectId;
  createdAt: Date;
}
```

## API Endpoints

### User Endpoints
- GET /api/v1/savings/plans - List available savings plans
- POST /api/v1/savings/open - Open new savings account
- GET /api/v1/savings/accounts - Get user's savings accounts
- GET /api/v1/savings/accounts/:id - Get savings account details
- POST /api/v1/savings/accounts/:id/deposit - Deposit to savings
- POST /api/v1/savings/accounts/:id/withdraw - Withdraw from savings
- GET /api/v1/savings/accounts/:id/transactions - Transaction history

### Admin Endpoints
- POST /api/v1/admin/savings/plans - Create savings plan
- PUT /api/v1/admin/savings/plans/:id - Update savings plan
- GET /api/v1/admin/savings/accounts - All savings accounts
- POST /api/v1/admin/savings/calculate-interest - Run interest calculation

## Business Logic

### Interest Calculation
- Daily balance method for Flex savings
- Fixed rate for Fixed savings (paid at maturity)
- Compound interest monthly
- Interest credited on last day of month

### Withdrawal Rules
- Flex: Up to 3 free withdrawals/month
- Target: Penalty before target reached
- Fixed: No withdrawal until maturity (forfeiture if broken)
- Harvest: Seasonal withdrawal windows

## Environment Variables
```bash
DEFAULT_FLEX_INTEREST_RATE=8
DEFAULT_FIXED_INTEREST_RATE=15
DEFAULT_HARVEST_INTEREST_RATE=12
INTEREST_CALCULATION_CRON=0 0 * * *
```
