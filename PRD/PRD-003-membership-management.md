# PRD-003: Membership Management Module

## Overview
This module handles membership tiers, subscriptions, renewals, upgrades, benefits management, and membership history for the Cooperative Farming Portal.

## Technology Stack
- **Framework**: NestJS v10+
- **Database**: MongoDB with Mongoose ODM
- **Payment Gateway**: SeerBit API for subscription payments
- **Scheduling**: Bull/BullMQ for renewal reminders
- **Real-time Updates**: Socket.io for membership status changes

## Database Schema

### MembershipTier Collection
```typescript
{
  _id: ObjectId,
  name: Enum ['Bronze', 'Silver', 'Gold', 'Platinum'],
  displayName: String,
  description: String,
  price: Number, // Annual subscription fee in NGN
  currency: String (default: 'NGN'),
  duration: Number, // in months (default: 12)
  benefits: [{
    title: String,
    description: String,
    icon: String,
    category: String
  }],
  features: {
    walletLimit: Number,
    savingsInterestRate: Number,
    loanEligibility: Number,
    commissionRate: Number,
    freeTransactions: Number,
    prioritySupport: Boolean,
    exclusiveOffers: Boolean
  },
  requirements: {
    minimumAge: Number,
    kycRequired: Boolean,
    minimumFarmSize: Number,
    referralCount: Number
  },
  isActive: Boolean,
  sortOrder: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### FarmerMembership Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, unique),
  tierId: ObjectId (ref: MembershipTier),
  tierName: Enum ['Bronze', 'Silver', 'Gold', 'Platinum'],
  cardNumber: String (unique),
  status: Enum ['active', 'expired', 'suspended', 'pending', 'cancelled'],
  joinDate: Date,
  startDate: Date,
  expiryDate: Date,
  autoRenew: Boolean (default: false),
  paymentMethod: String,
  lastPaymentDate: Date,
  lastPaymentAmount: Number,
  totalPaid: Number,
  renewalReminderSent: Boolean,
  gracePeriodEnd: Date,
  suspendedReason: String,
  suspendedAt: Date,
  suspendedBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

### MembershipHistory Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  membershipId: ObjectId (ref: FarmerMembership),
  action: Enum ['joined', 'upgraded', 'downgraded', 'renewed', 'expired', 'suspended', 'reactivated', 'cancelled', 'payment_failed'],
  fromTier: String,
  toTier: String,
  amount: Number,
  paymentReference: String,
  description: String,
  metadata: {
    reason: String,
    initiatedBy: String,
    previousExpiryDate: Date,
    newExpiryDate: Date
  },
  createdAt: Date
}
```

### MembershipPayment Collection
```typescript
{
  _id: ObjectId,
  membershipId: ObjectId (ref: FarmerMembership),
  userId: ObjectId (ref: User),
  tierName: String,
  paymentType: Enum ['initial', 'renewal', 'upgrade', 'prorated'],
  amount: Number,
  currency: String,
  seerbitReference: String,
  seerbitToken: String,
  status: Enum ['pending', 'completed', 'failed', 'refunded'],
  paymentDate: Date,
  periodStart: Date,
  periodEnd: Date,
  failureReason: String,
  refundedAt: Date,
  refundReason: String,
  createdAt: Date
}
```

## API Endpoints

### Membership Tiers
- `GET /api/v1/membership/tiers` - Get all available membership tiers
- `GET /api/v1/membership/tiers/:id` - Get specific tier details
- `POST /api/v1/membership/tiers` - Create new tier (admin only)
- `PATCH /api/v1/membership/tiers/:id` - Update tier (admin only)
- `DELETE /api/v1/membership/tiers/:id` - Deactivate tier (admin only)

### User Membership
- `GET /api/v1/membership/my-membership` - Get current user membership
- `GET /api/v1/membership/my-membership/benefits` - Get user's active benefits
- `POST /api/v1/membership/join` - Join cooperative (select tier)
- `POST /api/v1/membership/upgrade` - Upgrade to higher tier
- `POST /api/v1/membership/downgrade` - Downgrade to lower tier
- `POST /api/v1/membership/renew` - Renew membership
- `PUT /api/v1/membership/auto-renew` - Toggle auto-renewal
- `POST /api/v1/membership/cancel` - Cancel membership
- `GET /api/v1/membership/card` - Get digital membership card

### Membership History
- `GET /api/v1/membership/history` - Get membership history
- `GET /api/v1/membership/payments` - Get payment history
- `GET /api/v1/membership/payments/:id/receipt` - Download receipt

### Admin Operations
- `GET /api/v1/membership/admin/members` - List all members (paginated)
- `GET /api/v1/membership/admin/statistics` - Get membership statistics
- `POST /api/v1/membership/admin/suspend/:userId` - Suspend membership
- `POST /api/v1/membership/admin/reactivate/:userId` - Reactivate membership
- `GET /api/v1/membership/admin/expiring-soon` - Get memberships expiring soon
- `POST /api/v1/membership/admin/send-reminder` - Send renewal reminders

## Business Logic

### Joining Flow
1. User selects desired membership tier
2. System displays tier benefits and pricing
3. User confirms selection
4. SeerBit payment initialized
5. Payment completed via SeerBit
6. Membership record created with 'active' status
7. Unique card number generated (format: KM-YYYY-XXXXXX)
8. Welcome email/SMS sent with digital card
9. Membership history entry created
10. Wallet access enabled based on tier limits

### Upgrade Flow
1. User requests upgrade to higher tier
2. System calculates prorated amount (remaining days on current tier)
3. User confirms and pays difference
4. Payment processed via SeerBit
5. Tier updated immediately
6. New expiry date calculated (12 months from current expiry)
7. Enhanced benefits activated
8. History entry created
9. Notification sent

### Renewal Flow
1. System identifies memberships expiring in 30 days
2. Automated reminder email/SMS sent (30, 14, 7, 1 days before)
3. User clicks renewal link
4. Payment processed via SeerBit
5. Expiry date extended by 12 months
6. Status remains 'active'
7. Receipt generated and emailed
8. If auto-renew enabled: charge saved payment method

### Auto-Renewal Flow
1. System checks for auto-renew memberships expiring in 3 days
2. Charge user's saved payment method via SeerBit tokenized charges
3. On success: extend membership, send confirmation
4. On failure: send notification, set grace period (7 days)
5. Retry failed payment after 2 days
6. After grace period: downgrade to Bronze or suspend

### Prorated Calculation
```
Prorated Amount = (New Tier Price - Old Tier Price) * (Remaining Days / 365)
Upgrade Credit = Unused portion of current membership
Final Amount = New Tier Prorated - Upgrade Credit
```

### Card Number Generation
Format: `KM-{YEAR}-{SEQUENTIAL}`
Example: KM-2025-001234
- KM: Cooperative identifier
- YEAR: Current year
- SEQUENTIAL: 6-digit zero-padded number

### Benefits Activation
Each tier activates specific feature flags:
- **Bronze**: Basic wallet (₦100k limit), standard interest rates
- **Silver**: Enhanced wallet (₦300k limit), +1% interest, priority support
- **Gold**: Premium wallet (₦500k limit), +2% interest, loan eligibility, dedicated agent
- **Platinum**: Unlimited wallet, +3% interest, max loan eligibility, VIP support, exclusive marketplace access

## SeerBit Integration

### Subscription Payment Setup
```typescript
{
  reference: generateUniqueRef(),
  amount: tierPrice,
  email: user.email,
  phone: user.phone,
  full_name: user.fullName,
  redirect_url: `${FRONTEND_URL}/membership/callback`,
  webhook_url: `${API_URL}/api/v1/membership/webhook`,
  customizations: {
    title: 'Membership Subscription',
    description: `${tierName} Annual Membership`
  },
  meta: {
    userId: user.id,
    tierId: tier.id,
    paymentType: 'initial'
  }
}
```

### Tokenized Charges for Auto-Renewal
Store SeerBit token after initial payment for future auto-renewals without requiring user interaction.

## Scheduled Jobs (BullMQ)

### Daily Renewal Check
- Run every day at 9:00 AM WAT
- Find memberships expiring in 30, 14, 7, 1 days
- Send personalized reminder emails/SMS
- Queue auto-renewal processing for eligible memberships

### Auto-Renewal Processing
- Run every day at 2:00 AM WAT
- Process auto-renewals for memberships expiring today
- Charge saved payment tokens
- Handle failures and retries

### Grace Period Expiry
- Run every hour
- Check memberships past grace period
- Downgrade or suspend as per policy
- Send notification of status change

### Monthly Statistics
- Run on 1st of every month
- Calculate membership growth metrics
- Generate revenue reports
- Identify churn trends

## Security Requirements
- Payment webhook signature verification
- Idempotent payment processing
- Secure card number generation
- Access control: users can only view their own membership
- Admin role required for suspension/reactivation
- Audit logging for all membership changes

## Error Handling
- Payment failure: graceful degradation with retry options
- Duplicate payment detection
- Tier not found: 404 error
- Insufficient funds: clear error message with alternatives
- Network errors: queue for retry
- Webhook failures: manual reconciliation process

## Testing Requirements
- Unit tests for prorated calculations
- Integration tests for SeerBit payments
- E2E tests for complete membership lifecycle
- Scheduled job testing with mocked time
- Webhook handler tests
- Minimum 85% code coverage

## Performance Requirements
- Membership lookup < 50ms
- Payment processing < 3 seconds
- Support 200 concurrent membership operations
- Reminder emails sent within 5 minutes of scheduling

## Monitoring & Logging
- Membership growth tracking
- Churn rate monitoring
- Payment success/failure rates
- Auto-renewal success metrics
- Revenue analytics by tier
- Reminder email open/click rates

## Notifications
- Welcome email on joining
- Payment confirmation receipts
- Renewal reminders (30, 14, 7, 1 days)
- Upgrade confirmation
- Auto-renewal success/failure
- Expiry notifications
- Suspension/reactivation alerts
