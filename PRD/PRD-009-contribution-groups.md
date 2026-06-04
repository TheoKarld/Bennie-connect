# PRD-009: Contribution Groups (Adashe/Esusu) Module

## Overview
This module manages traditional rotating savings and credit associations (ROSCA) known as Adashe, Esusu, or Ajo. It enables farmers to join contribution groups, make regular contributions, receive payouts in rotation, participate in group decisions through voting, track attendance, and communicate via group chat.

## Technology Stack
- **Framework**: NestJS v10+
- **Database**: MongoDB with Mongoose ODM
- **Real-time Features**: Socket.io for chat and notifications
- **Payment Gateway**: SeerBit API for contributions
- **Scheduling**: Bull/BullMQ for contribution reminders and payout processing

## Database Schema

### ContributionGroup Collection
```typescript
{
  _id: ObjectId,
  name: String,
  description: String,
  groupType: Enum ['esusu', 'ajo', 'custom'],
  organizerId: ObjectId (ref: User),
  organizerName: String,
  frequency: Enum ['daily', 'weekly', 'bi-weekly', 'monthly'],
  cycleAmount: Number, // NGN per contribution per member
  maxSlots: Number, // maximum number of members
  currentSlots: Number,
  minMembers: Number, // minimum to start group
  interestRate: Number, // optional interest on contributions (APY)
  penaltyRate: Number, // penalty for late contribution (percentage)
  status: Enum ['forming', 'active', 'completed', 'paused', 'dissolved'],
  startDate: Date,
  estimatedEndDate: Date,
  actualEndDate: Date,
  totalCycles: Number,
  currentCycle: Number,
  nextContributionDate: Date,
  nextPayoutDate: Date,
  nextPayoutSlot: Number,
  repaymentConsistency: Number, // percentage (group-wide)
  rules: {
    lateGracePeriod: Number, // days
    missedContributionPolicy: String,
    earlyExitPolicy: String,
    disputeResolution: String,
    meetingRequirement: Boolean,
    quorumPercentage: Number
  },
  bankAccount: {
    accountName: String,
    accountNumber: String,
    bankName: String,
    isGroupAccount: Boolean
  },
  totalContributions: Number,
  totalPayouts: Number,
  activePayoutSlot: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### GroupMember Collection
```typescript
{
  _id: ObjectId,
  groupId: ObjectId (ref: ContributionGroup),
  userId: ObjectId (ref: User),
  farmerName: String,
  farmerPhone: String,
  slotNumber: Number, // position in payout rotation
  status: Enum ['pending', 'active', 'completed', 'left', 'removed'],
  joinedAt: Date,
  leftAt: Date,
  leftReason: String,
  totalContributed: Number,
  totalReceived: Number,
  outstandingBalance: Number,
  contributionsMade: Number,
  contributionsMissed: Number,
  lastContributionDate: Date,
  payoutReceived: Boolean,
  payoutDate: Date,
  payoutAmount: Number,
  guarantors: [ObjectId (ref: GroupMember)], // members who guarantee this member
  rating: Number, // reliability rating within group
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Contribution Collection
```typescript
{
  _id: ObjectId,
  groupId: ObjectId (ref: ContributionGroup),
  memberId: ObjectId (ref: GroupMember),
  userId: ObjectId (ref: User),
  cycleNumber: Number,
  amount: Number,
  dueDate: Date,
  paidDate: Date,
  status: Enum ['pending', 'paid', 'late', 'missed', 'partial'],
  paymentMethod: Enum ['wallet', 'card', 'bank_transfer', 'cash'],
  paymentId: ObjectId (ref: WalletTransaction),
  penaltyAmount: Number,
  penaltyPaid: Boolean,
  notes: String,
  recordedBy: ObjectId (ref: User), // for cash contributions
  createdAt: Date,
  updatedAt: Date
}
```

### Payout Collection
```typescript
{
  _id: ObjectId,
  groupId: ObjectId (ref: ContributionGroup),
  recipientMemberId: ObjectId (ref: GroupMember),
  recipientUserId: ObjectId (ref: User),
  cycleNumber: Number,
  slotNumber: Number,
  payoutAmount: Number,
  accumulatedPool: Number, // total pool for this payout
  interestEarned: Number,
  penaltiesCollected: Number,
  administrativeFees: Number,
  netPayout: Number,
  scheduledDate: Date,
  actualDate: Date,
  status: Enum ['scheduled', 'processing', 'completed', 'failed', 'disputed'],
  paymentMethod: Enum ['wallet', 'bank_transfer', 'cheque', 'cash'],
  paymentId: ObjectId (ref: WalletTransaction),
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  receivedBy: String,
  acknowledgmentUrl: String,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### GroupMeeting Collection
```typescript
{
  _id: ObjectId,
  groupId: ObjectId (ref: ContributionGroup),
  meetingNumber: Number,
  title: String,
  description: String,
  scheduledDate: Date,
  startTime: String,
  endTime: String,
  location: String,
  meetingType: Enum ['regular', 'emergency', 'annual', 'payout_ceremony'],
  agenda: [String],
  status: Enum ['scheduled', 'ongoing', 'completed', 'cancelled'],
  attendees: [{
    memberId: ObjectId (ref: GroupMember),
    userId: ObjectId (ref: User),
    name: String,
    status: Enum ['present', 'absent', 'excused', 'late'],
    arrivalTime: Date,
    proxy: String // if someone attended on behalf
  }],
  minutes: String,
  decisions: [{
    topic: String,
    decision: String,
    votesFor: Number,
    votesAgainst: Number,
    abstentions: Number,
    passed: Boolean
  }],
  attachments: [String],
  recordedBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

### GroupVote Collection
```typescript
{
  _id: ObjectId,
  groupId: ObjectId (ref: ContributionGroup),
  title: String,
  description: String,
  proposal: String,
  proposedBy: ObjectId (ref: User),
  voteType: Enum ['simple_majority', 'two_thirds', 'unanimous', 'weighted'],
  options: [{
    label: String, // "Yes", "No", "Abstain" or custom
    color: String
  }],
  eligibleVoters: Number,
  votesCast: Number,
  results: [{
    optionIndex: Number,
    votes: Number,
    percentage: Number,
    voterNames: [String] // anonymized after voting closes
  }],
  status: Enum ['active', 'closed', 'expired'],
  startDate: Date,
  endDate: Date,
  result: String,
  implemented: Boolean,
  implementedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### GroupChatMessage Collection
```typescript
{
  _id: ObjectId,
  groupId: ObjectId (ref: ContributionGroup),
  senderId: ObjectId (ref: User),
  senderName: String,
  message: String,
  messageType: Enum ['text', 'image', 'document', 'system'],
  mediaUrl: String,
  replyTo: ObjectId (ref: GroupChatMessage),
  edited: Boolean,
  editedAt: Date,
  deleted: Boolean,
  deletedAt: Date,
  reactions: [{
    emoji: String,
    userIds: [ObjectId]
  }],
  readBy: [{
    userId: ObjectId (ref: User),
    readAt: Date
  }],
  createdAt: Date
}
```

## API Endpoints

### Group Management
- `GET /api/v1/groups` - List all groups (with filters)
- `GET /api/v1/groups/:id` - Get group details
- `POST /api/v1/groups` - Create new group
- `PATCH /api/v1/groups/:id` - Update group (organizer only)
- `DELETE /api/v1/groups/:id` - Dissolve group (organizer only)
- `POST /api/v1/groups/:id/join` - Join group
- `POST /api/v1/groups/:id/leave` - Leave group
- `GET /api/v1/groups/:id/members` - Get group members
- `POST /api/v1/groups/:id/invite` - Invite members

### Contributions
- `GET /api/v1/groups/:id/contributions` - Get contribution history
- `POST /api/v1/groups/:id/contribute` - Make contribution
- `GET /api/v1/groups/:id/contributions/upcoming` - Get upcoming contributions
- `POST /api/v1/groups/:id/contributions/record-cash` - Record cash contribution (organizer)

### Payouts
- `GET /api/v1/groups/:id/payouts` - Get payout history
- `GET /api/v1/groups/:id/payouts/schedule` - Get payout schedule
- `GET /api/v1/groups/:id/payouts/my-payout` - Get user's payout info
- `POST /api/v1/groups/:id/payouts/process` - Process payout (organizer/admin)

### Meetings
- `GET /api/v1/groups/:id/meetings` - Get all meetings
- `POST /api/v1/groups/:id/meetings` - Schedule meeting
- `PATCH /api/v1/groups/:id/meetings/:meetingId` - Update meeting
- `POST /api/v1/groups/:id/meetings/:meetingId/attend` - Mark attendance
- `POST /api/v1/groups/:id/meetings/:meetingId/minutes` - Submit minutes

### Voting
- `GET /api/v1/groups/:id/votes` - Get all votes
- `POST /api/v1/groups/:id/votes` - Create new vote
- `POST /api/v1/groups/:id/votes/:voteId/cast` - Cast vote
- `GET /api/v1/groups/:id/votes/:voteId/results` - Get results

### Chat
- `GET /api/v1/groups/:id/chat` - Get chat history
- `POST /api/v1/groups/:id/chat` - Send message
- `PATCH /api/v1/groups/:id/chat/:messageId` - Edit message
- `DELETE /api/v1/groups/:id/chat/:messageId` - Delete message
- `POST /api/v1/groups/:id/chat/:messageId/reaction` - Add reaction

### Analytics
- `GET /api/v1/groups/:id/analytics` - Get group analytics
- `GET /api/v1/groups/:id/statements` - Generate financial statement

## Business Logic

### Group Formation Flow
1. Organizer creates group with parameters (amount, frequency, max slots)
2. System generates unique group code
3. Organizer invites initial members
4. Members join via invite or group code
5. Group status: 'forming' until min members reached
6. Once min members met: status changes to 'active'
7. Rotation order determined (random, seniority, or consensus)
8. First contribution date set

### Contribution Cycle

#### Weekly Example
```
Cycle Amount: ₦10,000
Members: 10
Frequency: Weekly
Total Pool per Cycle: ₦100,000
Duration: 10 weeks

Week 1: All 10 members contribute ₦10,000 = ₦100,000
        Slot 1 receives ₦100,000
        
Week 2: All 10 members contribute ₦10,000 = ₦100,000
        Slot 2 receives ₦100,000
        
... continues until all slots have received payout
```

### Payout Calculation
```
Gross Pool = Σ (All Member Contributions for Cycle)
Interest Earned = Pool × (Interest Rate / 52) // for weekly
Penalties Collected = Σ (Late fees from delinquent members)
Administrative Fees = Gross Pool × 1% (optional)
Net Payout = Gross Pool + Interest + Penalties - Admin Fees
```

### Late Contribution Handling
- Grace period: 3 days after due date
- After grace period: 5% penalty on contribution amount
- After 7 days: marked as 'missed'
- Missed contribution consequences:
  - Cannot receive payout until cleared
  - Guarantor becomes responsible
  - Group vote on member removal if chronic

### Guarantor System
- Each member must have 1-2 guarantors (existing members)
- Guarantor responsibilities:
  - Ensure member contributes on time
  - Cover member's contribution if they default
  - Receive member's payout if member defaults
- Guarantor cannot be in same payout slot

### Early Exit Policy
- Member can exit before completing cycle
- Options:
  1. Wait for natural payout slot (no penalty)
  2. Take immediate payout with 10% discount
  3. Transfer slot to approved replacement
- Exiting member's guarantors released after settlement

### Dispute Resolution
1. Member raises dispute via platform
2. Organizer reviews within 48 hours
3. If unresolved: group vote
4. Final escalation: platform mediation
5. Binding decision enforced

### Voting Rules
- Simple majority (>50%): Routine decisions
- Two-thirds (>66%): Significant decisions (rule changes, member removal)
- Unanimous (100%): Critical decisions (dissolution, fund usage)
- Voting period: 24-72 hours depending on urgency
- Quorum: 60% of members must vote

## Scheduled Jobs (BullMQ)

### Contribution Reminders
- Run daily at 8:00 AM
- Remind members of contributions due today
- Remind organizers of pending payouts

### Overdue Notifications
- Run every 6 hours
- Alert members with overdue contributions
- Notify guarantors if member is 3+ days late

### Payout Processing
- Run on scheduled payout dates
- Calculate net payout amount
- Initiate bank transfer/wallet credit
- Send confirmation to recipient

### Meeting Reminders
- Run 24 hours before scheduled meetings
- Send agenda and location details
- Request RSVP

### Monthly Reports
- Run on 1st of each month
- Generate group performance report
- Send to all members
- Include consistency metrics

## Real-time Features (Socket.io)
- Group chat messaging
- Contribution confirmations
- Payout notifications
- Meeting alerts
- Vote announcements
- Online member presence

## Security Requirements
- Authentication for all group operations
- Multi-sig for large payouts (>₦500,000)
- Encrypted chat messages
- Audit trail for all financial transactions
- Fraud detection for suspicious patterns
- KYC verification for group organizers

## Error Handling
- Payment failures: retry logic with notifications
- Insufficient funds: clear error with options
- Network issues: offline mode for chat
- Data inconsistencies: reconciliation process
- Dispute escalation workflow

## Testing Requirements
- Unit tests for contribution calculations
- Integration tests for payout flows
- E2E tests for complete group lifecycle
- Chat functionality tests
- Voting system tests
- Minimum 85% code coverage

## Performance Requirements
- Chat message delivery < 100ms
- Contribution processing < 500ms
- Support 100 concurrent groups
- Handle 500 messages/minute

## Monitoring & Logging
- Group health metrics
- Contribution compliance rates
- Payout timeliness tracking
- Chat activity monitoring
- Dispute frequency analysis

## Notifications
- Group invitation
- Contribution reminders
- Contribution confirmations
- Payout notifications
- Meeting alerts
- Vote requests
- Chat mentions
- Group announcements
