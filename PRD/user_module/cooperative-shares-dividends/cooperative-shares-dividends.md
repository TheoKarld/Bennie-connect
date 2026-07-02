# PRD 05: Cooperative Shares & Dividends Module

## Overview
Shares management and dividend distribution system for cooperative members using NestJS and MongoDB.

## Database Schema

### Share Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User);
  cooperativeId: ObjectId (ref: Cooperative);
  shareCertificateNumber: string (unique);
  numberOfShares: number;
  parValue: number; // Price per share
  totalValue: number;
  issueDate: Date;
  status: 'ACTIVE' | 'FORFEITED' | 'TRANSFERRED' | 'REDEEMED';
  dividendHistory: [{
    year: number;
    dividendPerShare: number;
    totalDividend: number;
    declaredAt: Date;
    paidAt?: Date;
    status: 'DECLARED' | 'PAID' | 'UNCLAIMED';
  }];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### DividendDeclaration Collection
```typescript
{
  _id: ObjectId;
  cooperativeId: ObjectId (ref: Cooperative);
  financialYear: number;
  dividendRate: number; // Percentage
  totalAmountDeclared: number;
  eligibleShares: number;
  declarationDate: Date;
  paymentStartDate: Date;
  paymentEndDate: Date;
  status: 'DRAFT' | 'DECLARED' | 'IN_PROGRESS' | 'COMPLETED';
  approvedBy: [ObjectId]; // Board approvals
  metadata?: Record<string, any>;
  createdAt: Date;
}
```

## API Endpoints

### Member Endpoints
- GET /api/v1/shares/my-shares - Get user's share holdings
- POST /api/v1/shares/purchase - Purchase additional shares
- GET /api/v1/shares/dividends - Get dividend history
- GET /api/v1/shares/dividends/unclaimed - Get unclaimed dividends
- POST /api/v1/shares/dividends/:id/claim - Claim dividend

### Admin Endpoints
- GET /api/v1/admin/shares - All share holdings
- POST /api/v1/admin/dividends/declare - Declare dividend
- GET /api/v1/admin/dividends - Dividend declarations
- POST /api/v1/admin/dividends/:id/distribute - Process dividend payment
- GET /api/v1/admin/dividends/unclaimed - Unclaimed dividends report

## Business Logic

### Share Purchase
- Minimum shares based on cooperative rules
- Payment via wallet deduction
- Share certificate auto-generated
- Board approval required for large purchases

### Dividend Calculation
- Based on annual profits
- Pro-rata distribution by share count
- Tax withholding (if applicable)
- Payment to member wallet

## Environment Variables
```bash
MIN_SHARES_PER_MEMBER=10
SHARE_PAR_VALUE=1000
DIVIDEND_TAX_RATE=10
MAX_SHARES_PER_MEMBER=1000
```
