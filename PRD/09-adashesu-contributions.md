# PRD 09: Adashe/Esusu Contribution Groups Module

## Overview
Traditional rotating savings and credit association (ROSCA) management system using NestJS and MongoDB.

## Database Schema

### ContributionGroup Collection
```typescript
{
  _id: ObjectId;
  name: string;
  organizerId: ObjectId (ref: User);
  type: 'ADASHE' | 'ESUSU' | 'CUSTOM';
  description: string;
  contributionAmount: number;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  totalMembers: number;
  currentCycle: number;
  startDate: Date;
  status: 'FORMING' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED';
  payoutOrder: [{ memberId: ObjectId; position: number; paid: boolean; paidAt?: Date }];
  rules: {
    lateFeePercent: number;
    missLimit: number;
    exitPenalty: number;
  };
  walletId: ObjectId (ref: Wallet); // Group wallet
  createdAt: Date;
  updatedAt: Date;
}
```

### GroupMember Collection
```typescript
{
  _id: ObjectId;
  groupId: ObjectId (ref: ContributionGroup);
  userId: ObjectId (ref: User);
  position: number; // Payout order position
  joinedAt: Date;
  status: 'ACTIVE' | 'RECEIVED_PAYOUT' | 'EXITED' | 'REMOVED';
  contributions: [{
    cycle: number;
    amount: number;
    dueDate: Date;
    paidAt?: Date;
    status: 'PENDING' | 'PAID' | 'LATE' | 'MISSED';
    lateFee?: number;
  }];
  payoutReceived?: {
    cycle: number;
    amount: number;
    paidAt: Date;
    transactionRef: string;
  };
  createdAt: Date;
}
```

## API Endpoints

### Member Endpoints
- POST /api/v1/contribution-groups - Create group
- GET /api/v1/contribution-groups/my-groups - User's groups
- POST /api/v1/contribution-groups/:id/join - Join group
- POST /api/v1/contribution-groups/:id/contribute - Make contribution
- GET /api/v1/contribution-groups/:id/status - Group status

### Admin Endpoints
- GET /api/v1/admin/contribution-groups - All groups
- POST /api/v1/admin/contribution-groups/:id/process-payout - Process payout

## Business Logic

### Contribution Flow
1. Organizer creates group with parameters
2. Members join until full
3. Automatic debit on due dates
4. Payout to member in rotation order
5. Continue until all members receive payout

## Environment Variables
```bash
CONTRIBUTION_GROUP_PREFIX=CGP
MAX_GROUP_SIZE=50
DEFAULT_LATE_FEE_PERCENT=5
AUTO_DEBIT_ENABLED=true
```
