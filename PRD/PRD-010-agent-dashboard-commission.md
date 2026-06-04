# PRD-010: Agent Dashboard & Commission Module

## Overview
This module manages the agent referral system where agents register farmers, earn commissions on farmer activities (registrations, membership upgrades, savings deposits, equipment bookings, marketplace purchases), track their performance, view rankings, and manage their downline network.

## Technology Stack
- **Framework**: NestJS v10+
- **Database**: MongoDB with Mongoose ODM
- **Payment Gateway**: SeerBit API for commission payouts
- **Real-time Updates**: Socket.io for commission notifications
- **Scheduling**: Bull/BullMQ for commission calculations and payouts

## Database Schema

### AgentProfile Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, unique),
  agentCode: String (unique), // e.g., AGT-2025-001234
  agentLevel: Enum ['Bronze Agent', 'Silver Agent', 'Gold Agent', 'Platinum Agent'],
  status: Enum ['active', 'suspended', 'inactive', 'terminated'],
  totalFarmersRegistered: Number (default: 0),
  activeFarmers: Number (default: 0), // farmers with activity in last 90 days
  totalCommissionEarned: Number (default: 0),
  currentMonthCommission: Number (default: 0),
  previousMonthCommission: Number (default: 0),
  lifetimeEarnings: Number (default: 0),
  pendingCommission: Number (default: 0),
  paidCommission: Number (default: 0),
  ranking: Number, // national/regional ranking
  regionalRanking: Number,
  levelProgress: {
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    registrationsThisPeriod: Number,
    volumeThisPeriod: Number,
    targetRegistrations: Number,
    targetVolume: Number,
    progressPercentage: Number
  },
  performanceMetrics: {
    registrationCount: Number,
    upgradeCount: Number,
    savingsVolume: Number, // NGN
    marketplaceVolume: Number, // NGN
    equipmentBookingVolume: Number, // NGN
    activationRate: Number, // percentage of registered farmers who become active
    retentionRate: Number // percentage of farmers retained after 90 days
  },
  assignedTerritory: {
    region: String, // e.g., "South West"
    state: String,
    lgas: [String]
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  kycStatus: Enum ['pending', 'verified', 'rejected'],
  kycDocuments: [{
    type: String,
    url: String,
    uploadedAt: Date,
    status: String
  }],
  supervisorId: ObjectId (ref: AgentProfile), // upline agent
  downlineAgents: [ObjectId (ref: AgentProfile)], // direct referrals
  teamSize: Number, // total downline including indirect
  teamVolume: Number, // total volume from downline
  overrideCommissionRate: Number, // percentage from downline
  payoutSchedule: Enum ['weekly', 'bi-weekly', 'monthly'],
  lastPayoutDate: Date,
  nextPayoutDate: Date,
  joinedDate: Date,
  lastActiveDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### RegisteredFarmer Collection
```typescript
{
  _id: ObjectId,
  farmerUserId: ObjectId (ref: User, unique),
  farmerName: String,
  farmerPhone: String,
  farmerEmail: String,
  location: {
    state: String,
    lga: String,
    address: String,
    coordinates: { lat: Number, lng: Number }
  },
  identityType: Enum ['NIN', 'BVN', 'Voters Card', 'National ID'],
  identityNumber: String,
  kycDocUrl: String,
  kycStatus: Enum ['Pending', 'Verified', 'Rejected'],
  dateRegistered: Date,
  registeredBy: ObjectId (ref: AgentProfile),
  referringAgentCode: String,
  membershipStatus: Enum ['Inactive', 'Bronze', 'Silver', 'Gold', 'Platinum'],
  membershipTier: String,
  isActive: Boolean,
  lastActivityDate: Date,
  lifetimeValue: Number, // total value generated
  activities: {
    registrations: Number,
    membershipUpgrades: Number,
    totalSavings: Number,
    totalMarketplacePurchases: Number,
    totalEquipmentBookings: Number,
    totalServiceBookings: Number
  },
  status: Enum ['active', 'inactive', 'churned'],
  churnedAt: Date,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### CommissionReward Collection
```typescript
{
  _id: ObjectId,
  agentId: ObjectId (ref: AgentProfile),
  agentUserId: ObjectId (ref: User),
  farmerId: ObjectId (ref: RegisteredFarmer),
  farmerUserId: ObjectId (ref: User),
  farmerName: String,
  activityType: Enum [
    'Farmer Registration',
    'Membership Upgrade',
    'Savings Deposit',
    'Equipment Booking',
    'Marketplace Purchase',
    'Service Booking',
    'Share Purchase',
    'Loan Disbursement'
  ],
  activityDetails: {
    description: String,
    amount: Number, // transaction amount
    tier: String, // for membership upgrades
    productType: String // for savings
  },
  commissionType: Enum ['direct', 'override', 'bonus', 'penalty'],
  commissionRate: Number, // percentage applied
  baseAmount: Number, // amount commission calculated on
  commissionAmount: Number,
  status: Enum ['pending', 'approved', 'paid', 'reversed', 'disputed'],
  reversalReason: String,
  paymentId: ObjectId (ref: WalletTransaction),
  payoutBatchId: ObjectId (ref: CommissionPayout),
  period: {
    month: Number,
    year: Number,
    week: Number
  },
  calculatedAt: Date,
  approvedAt: Date,
  paidAt: Date,
  createdAt: Date
}
```

### CommissionPayout Collection
```typescript
{
  _id: ObjectId,
  agentId: ObjectId (ref: AgentProfile),
  agentUserId: ObjectId (ref: User),
  payoutReference: String (unique),
  period: {
    type: Enum ['weekly', 'bi-weekly', 'monthly'],
    startDate: Date,
    endDate: Date
  },
  breakdown: {
    registrationCommissions: Number,
    upgradeCommissions: Number,
    savingsCommissions: Number,
    marketplaceCommissions: Number,
    equipmentCommissions: Number,
    serviceCommissions: Number,
    overrideCommissions: Number,
    bonusCommissions: Number,
    totalGross: Number,
    taxWithheld: Number, // 10% WHT
    adjustments: Number,
    netPayable: Number
  },
  status: Enum ['processing', 'completed', 'failed', 'cancelled'],
  paymentMethod: Enum ['wallet', 'bank_transfer'],
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  transactionReference: String,
  processedBy: ObjectId (ref: User),
  failureReason: String,
  paidAt: Date,
  acknowledgmentUrl: String,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### AgentLevelRequirement Collection
```typescript
{
  _id: ObjectId,
  level: Enum ['Bronze Agent', 'Silver Agent', 'Gold Agent', 'Platinum Agent'],
  requirements: {
    minRegistrations: Number, // per month
    minVolume: Number, // NGN per month
    minActiveFarmers: Number,
    minRetentionRate: Number, // percentage
    tenureMonths: Number // minimum months at current level
  },
  commissionRates: {
    registration: Number, // flat fee or percentage
    membershipUpgrade: Number, // percentage
    savingsDeposit: Number, // percentage
    equipmentBooking: Number, // percentage
    marketplacePurchase: Number, // percentage
    serviceBooking: Number, // percentage
    sharePurchase: Number, // percentage
    loanDisbursement: Number // percentage
  },
  overrideRates: {
    directDownline: Number, // percentage from direct referrals
    indirectDownline: Number // percentage from indirect referrals
  },
  bonuses: [{
    name: String,
    type: Enum ['threshold', 'milestone', 'performance'],
    condition: String,
    rewardAmount: Number,
    rewardType: Enum ['fixed', 'percentage']
  }],
  benefits: [String],
  sortOrder: Number,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### AgentActivityLog Collection
```typescript
{
  _id: ObjectId,
  agentId: ObjectId (ref: AgentProfile),
  agentUserId: ObjectId (ref: User),
  activityType: Enum [
    'farmer_registered',
    'farmer_activated',
    'commission_earned',
    'commission_paid',
    'level_upgraded',
    'level_downgraded',
    'territory_changed',
    'kyc_submitted',
    'kyc_verified',
    'payout_requested',
    'training_completed'
  ],
  description: String,
  metadata: {
    farmerId: ObjectId,
    commissionAmount: Number,
    oldLevel: String,
    newLevel: String,
    payoutAmount: Number
  },
  ipAddress: String,
  deviceInfo: String,
  createdAt: Date
}
```

## API Endpoints

### Agent Dashboard
- `GET /api/v1/agent/dashboard` - Get agent dashboard overview
- `GET /api/v1/agent/statistics` - Get detailed statistics
- `GET /api/v1/agent/performance` - Get performance metrics
- `GET /api/v1/agent/level-progress` - Get level progression status

### Farmer Management
- `GET /api/v1/agent/farmers` - Get registered farmers list
- `GET /api/v1/agent/farmers/:id` - Get farmer details
- `POST /api/v1/agent/farmers/register` - Register new farmer
- `PATCH /api/v1/agent/farmers/:id` - Update farmer info
- `GET /api/v1/agent/farmers/statistics` - Get farmer statistics

### Commissions
- `GET /api/v1/agent/commissions` - Get commission history
- `GET /api/v1/agent/commissions/pending` - Get pending commissions
- `GET /api/v1/agent/commissions/paid` - Get paid commissions
- `GET /api/v1/agent/commissions/estimate` - Estimate commission for activity
- `GET /api/v1/agent/commissions/breakdown` - Get commission breakdown

### Payouts
- `GET /api/v1/agent/payouts` - Get payout history
- `GET /api/v1/agent/payouts/:id` - Get payout details
- `POST /api/v1/agent/payouts/request` - Request manual payout
- `GET /api/v1/agent/payouts/schedule` - Get payout schedule
- `PUT /api/v1/agent/payout-method` - Update payout method

### Downline Management
- `GET /api/v1/agent/downline` - Get downline agents
- `GET /api/v1/agent/downline/statistics` - Get downline stats
- `GET /api/v1/agent/downline/performance` - Get downline performance
- `GET /api/v1/agent/team-volume` - Get team volume report

### Level & Ranking
- `GET /api/v1/agent/level` - Get current level details
- `GET /api/v1/agent/levels` - Get all level requirements
- `GET /api/v1/agent/ranking` - Get agent ranking
- `GET /api/v1/agent/leaderboard` - Get leaderboard

### Admin Operations
- `GET /api/v1/admin/agents` - List all agents
- `GET /api/v1/admin/agents/:id` - Get agent details
- `PATCH /api/v1/admin/agents/:id/level` - Update agent level (admin)
- `POST /api/v1/admin/agents/:id/suspend` - Suspend agent
- `POST /api/v1/admin/agents/:id/reactivate` - Reactivate agent
- `GET /api/v1/admin/agents/statistics` - Get overall agent statistics
- `POST /api/v1/admin/agents/payouts/process` - Process commission payouts
- `GET /api/v1/admin/agents/payouts/pending` - Get pending payouts

## Business Logic

### Commission Structure by Level

#### Bronze Agent
- Registration: ₦500 per farmer
- Membership Upgrade: 2% of upgrade fee
- Savings Deposit: 1% of deposit amount
- Equipment Booking: 1% of booking value
- Marketplace Purchase: 0.5% of purchase value
- Service Booking: 1% of service value

#### Silver Agent (requires 20 farmers/month, ₦500K volume)
- Registration: ₦750 per farmer
- Membership Upgrade: 3% of upgrade fee
- Savings Deposit: 1.5% of deposit amount
- Equipment Booking: 1.5% of booking value
- Marketplace Purchase: 0.75% of purchase value
- Service Booking: 1.5% of service value
- Override from direct downline: 10%

#### Gold Agent (requires 50 farmers/month, ₦2M volume)
- Registration: ₦1,000 per farmer
- Membership Upgrade: 4% of upgrade fee
- Savings Deposit: 2% of deposit amount
- Equipment Booking: 2% of booking value
- Marketplace Purchase: 1% of purchase value
- Service Booking: 2% of service value
- Override from direct downline: 15%
- Override from indirect downline: 5%

#### Platinum Agent (requires 100 farmers/month, ₦5M volume)
- Registration: ₦1,500 per farmer
- Membership Upgrade: 5% of upgrade fee
- Savings Deposit: 2.5% of deposit amount
- Equipment Booking: 2.5% of booking value
- Marketplace Purchase: 1.5% of purchase value
- Service Booking: 2.5% of service value
- Override from direct downline: 20%
- Override from indirect downline: 10%
- Quarterly performance bonus: 5% of total commissions

### Level Progression

#### Promotion Criteria
- Evaluated monthly
- Must meet both registration AND volume targets
- Must maintain minimum retention rate (>70%)
- No compliance violations
- Automatic promotion on 1st of month if criteria met

#### Demotion Criteria
- Fail to meet targets for 2 consecutive months
- Retention rate drops below 50%
- Compliance violations
- Demotion effective immediately

### Commission Calculation Flow

#### Real-time Calculation
1. Farmer completes qualifying activity
2. System identifies referring agent
3. Retrieves agent's current level commission rates
4. Calculates commission amount
5. Creates pending commission record
6. Notifies agent via real-time update

#### Example Calculations
```
Registration:
  Farmer registers → Bronze Agent earns ₦500

Membership Upgrade (Bronze to Gold = ₦50,000):
  Silver Agent earns: ₦50,000 × 3% = ₦1,500

Savings Deposit (₦100,000):
  Gold Agent earns: ₦100,000 × 2% = ₦2,000

Equipment Booking (₦200,000):
  Platinum Agent earns: ₦200,000 × 2.5% = ₦5,000

Override Commission:
  Direct downline earns ₦10,000
  Gold Agent override: ₦10,000 × 15% = ₦1,500
```

### Payout Processing

#### Schedule Options
- Weekly: Every Friday
- Bi-weekly: 1st and 15th
- Monthly: Last day of month

#### Payout Calculation
```
Gross Commission = Σ (All approved commissions in period)
Tax Withheld (WHT) = Gross Commission × 10%
Adjustments = Reversals - Bonuses
Net Payable = Gross Commission - Tax + Adjustments
```

#### Payout Flow
1. System aggregates approved commissions for period
2. Calculates tax withholding
3. Applies any adjustments
4. Creates payout record
5. Initiates bank transfer/wallet credit
6. Sends payout notification
7. Updates agent balance

### Bonus Programs

#### Registration Milestone Bonus
- 50 farmers in month: ₦10,000 bonus
- 100 farmers in month: ₦25,000 bonus
- 200 farmers in month: ₦60,000 bonus

#### Volume Bonus
- ₦1M monthly volume: 2% extra on all commissions
- ₦5M monthly volume: 5% extra on all commissions
- ₦10M monthly volume: 10% extra on all commissions

#### Retention Bonus
- >80% retention rate: ₦5,000 bonus
- >90% retention rate: ₦15,000 bonus

### Fraud Prevention
- Duplicate farmer detection (phone, NIN, BVN)
- Fake registration patterns detection
- Activity velocity monitoring
- Geographic anomaly detection
- Self-referral prevention
- Commission clawback for fraudulent activities

## Scheduled Jobs (BullMQ)

### Daily Commission Calculation
- Run every night at midnight
- Calculate commissions for previous day's activities
- Create pending commission records
- Send daily summary to agents

### Weekly Payout Processing
- Run every Friday at 10:00 AM
- Aggregate weekly commissions
- Calculate tax withholding
- Initiate payouts
- Generate payout reports

### Level Assessment
- Run on 1st of each month
- Evaluate all agents against level criteria
- Promote/demote as applicable
- Update commission rates
- Send level change notifications

### Performance Reports
- Run every Monday at 8:00 AM
- Generate weekly performance reports
- Send to agents via email
- Include rankings and leaderboards

### Inactivity Alerts
- Run weekly
- Identify inactive agents (no activity in 14 days)
- Send re-engagement campaigns
- Escalate to supervisors if prolonged

## Real-time Features (Socket.io)
- Commission earned notifications
- Farmer registration alerts
- Payout confirmations
- Level upgrade announcements
- Leaderboard position changes
- Target achievement alerts

## Security Requirements
- Authentication for all agent operations
- KYC verification before first payout
- Commission reversal audit trail
- Fraud detection algorithms
- Rate limiting on farmer registration
- IP-based suspicious activity detection

## Error Handling
- Payment failures: retry with notification
- Duplicate registrations: reject with clear message
- Commission calculation errors: manual review queue
- Payout failures: escalate to admin
- Data inconsistencies: reconciliation process

## Testing Requirements
- Unit tests for commission calculations
- Integration tests for payout flows
- E2E tests for agent lifecycle
- Fraud detection scenario tests
- Load testing for mass registrations
- Minimum 85% code coverage

## Performance Requirements
- Commission calculation < 100ms
- Dashboard load < 500ms
- Support 1000 concurrent agents
- Handle 100 farmer registrations/minute

## Monitoring & Logging
- Agent activity tracking
- Commission accrual monitoring
- Payout success rates
- Fraud detection alerts
- Performance metric trends
- Churn prediction analytics

## Notifications
- Welcome email on agent onboarding
- Commission earned alerts (real-time)
- Daily/weekly summary emails
- Payout confirmations
- Level upgrade congratulations
- Target achievement celebrations
- Inactivity warnings
- Training opportunities
