# PRD 10: Agent Dashboard & Commission System Module

## Overview
Agent management dashboard with commission tracking and payout system using NestJS and MongoDB.

## Database Schema

### AgentProfile Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User);
  agentCode: string (unique);
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  specialization: ['MEMBER_RECRUITMENT' | 'LOAN_ORIGINATION' | 'SALES' | 'SUPPORT'];
  territory: { state: string; lga: string[] };
  commissionRates: {
    memberRecruitment: number; // Percentage or fixed
    loanOrigination: number;
    productSales: number;
    savingsReferral: number;
  };
  performanceMetrics: {
    totalReferrals: number;
    activeReferrals: number;
    totalCommission: number;
    paidCommission: number;
    pendingCommission: number;
    rating: { average: number; count: number };
  };
  bankDetails: { accountNumber: string; bankName: string; accountName: string };
  approvedBy: ObjectId (ref: User);
  approvedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Referral Collection
```typescript
{
  _id: ObjectId;
  agentId: ObjectId (ref: AgentProfile);
  referredUserId: ObjectId (ref: User);
  type: 'MEMBER' | 'CUSTOMER' | 'MERCHANT';
  status: 'PENDING' | 'ACTIVE' | 'CONVERTED' | 'REJECTED';
  commission: {
    amount: number;
    rate: number;
    status: 'PENDING' | 'APPROVED' | 'PAID' | 'REVERSED';
    calculatedAt: Date;
    paidAt?: Date;
  };
  conversionData?: {
    convertedAt: Date;
    value: number; // Transaction value, membership fee, etc.
    productType: string;
  };
  createdAt: Date;
}
```

### CommissionPayment Collection
```typescript
{
  _id: ObjectId;
  agentId: ObjectId (ref: AgentProfile);
  period: { startDate: Date; endDate: Date };
  totalAmount: number;
  breakdown: [{
    referralId: ObjectId;
    description: string;
    amount: number;
  }];
  taxWithheld: number;
  netAmount: number;
  paymentStatus: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
  paymentReference?: string;
  processedBy?: ObjectId;
  paidAt?: Date;
  createdAt: Date;
}
```

## API Endpoints

### Agent Endpoints
- GET /api/v1/agent/dashboard - Dashboard overview
- GET /api/v1/agent/referrals - Agent's referrals
- POST /api/v1/agent/referrals - Register new referral
- GET /api/v1/agent/commissions - Commission history
- GET /api/v1/agent/payouts - Payout history
- POST /api/v1/agent/payouts/request - Request payout

### Admin Endpoints
- GET /api/v1/admin/agents - All agents
- PATCH /api/v1/admin/agents/:id/status - Update agent status
- POST /api/v1/admin/commissions/calculate - Run commission calculation
- POST /api/v1/admin/commissions/pay-batch - Process batch payouts

## Business Logic

### Commission Calculation
- Real-time calculation on referred user actions
- Tiered rates based on agent level
- Monthly payout cycle
- Tax withholding (if applicable)

### Performance Tracking
- Referral conversion rates
- Revenue generated per agent
- Customer satisfaction scores
- Automatic tier upgrades/downgrades

## Environment Variables
```bash
AGENT_CODE_PREFIX=AGT
COMMISSION_PAYOUT_DAY=5
MIN_PAYOUT_AMOUNT=5000
TAX_WITHHOLDING_PERCENT=10
```
