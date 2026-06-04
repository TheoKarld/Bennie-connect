# PRD-005: Cooperative Shares Module

## Overview
This module manages cooperative share ownership, share trading (buy/sell), dividend distribution, share price tracking, and shareholder portfolio management.

## Technology Stack
- **Framework**: NestJS v10+
- **Database**: MongoDB with Mongoose ODM
- **Real-time Updates**: Socket.io for share price and portfolio updates
- **Transaction Management**: MongoDB transactions for ACID compliance
- **Scheduling**: Bull/BullMQ for dividend processing

## Database Schema

### CooperativeShares Collection
```typescript
{
  _id: ObjectId,
  name: String (default: "KM Cooperative Shares"),
  symbol: String (default: "KMCS"),
  totalAuthorizedShares: Number (default: 10000000),
  totalIssuedShares: Number (default: 0),
  totalOutstandingShares: Number (default: 0),
  treasuryShares: Number (default: 0),
  currentSharePrice: Number, // in NGN
  previousClosePrice: Number,
  dayChange: Number, // percentage
  dayHigh: Number,
  dayLow: Number,
  weekHigh52: Number,
  weekLow52: Number,
  parValue: Number, // nominal value per share
  currency: String (default: 'NGN'),
  dividendYield: Number, // annual percentage
  lastDividendDate: Date,
  nextDividendDate: Date,
  dividendFrequency: Enum ['quarterly', 'semi-annual', 'annual'],
  marketCap: Number,
  status: Enum ['active', 'suspended', 'closed'],
  tradingEnabled: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### ShareholderPortfolio Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, unique),
  sharesOwned: Number (default: 0),
  averageCostPerShare: Number,
  totalInvested: Number,
  currentValue: Number,
  unrealizedGainLoss: Number,
  realizedGainLoss: Number,
  totalDividendsReceived: Number,
  dividendReinvestmentEnabled: Boolean (default: false),
  status: Enum ['active', 'suspended', 'closed'],
  firstPurchaseDate: Date,
  lastTransactionDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### ShareTransaction Collection
```typescript
{
  _id: ObjectId,
  portfolioId: ObjectId (ref: ShareholderPortfolio),
  userId: ObjectId (ref: User),
  type: Enum ['buy', 'sell', 'dividend_reinvestment', 'transfer_in', 'transfer_out', 'bonus_issue'],
  sharesCount: Number,
  pricePerShare: Number,
  totalAmount: Number,
  fees: Number,
  netAmount: Number,
  status: Enum ['pending', 'processing', 'completed', 'failed', 'cancelled'],
  paymentMethod: Enum ['wallet', 'bank_transfer', 'dividend_credit'],
  walletTransactionId: ObjectId (ref: WalletTransaction),
  reference: String (unique),
  counterpartyUserId: ObjectId (ref: User), // for transfers
  notes: String,
  processedBy: ObjectId (ref: User), // admin for manual processing
  failureReason: String,
  completedAt: Date,
  createdAt: Date
}
```

### DividendDistribution Collection
```typescript
{
  _id: ObjectId,
  declarationDate: Date,
  recordDate: Date,
  exDividendDate: Date,
  paymentDate: Date,
  dividendPerShare: Number,
  totalDividendAmount: Number,
  dividendType: Enum ['regular', 'special', 'liquidating'],
  frequency: Enum ['quarterly', 'semi-annual', 'annual'],
  fiscalYear: Number,
  fiscalQuarter: Number,
  status: Enum ['declared', 'record_date_passed', 'processing', 'paid', 'cancelled'],
  eligibleShareholders: Number,
  paidShareholders: Number,
  totalPaid: Number,
  failedPayments: Number,
  notes: String,
  approvedBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

### DividendPayment Collection
```typescript
{
  _id: ObjectId,
  distributionId: ObjectId (ref: DividendDistribution),
  portfolioId: ObjectId (ref: ShareholderPortfolio),
  userId: ObjectId (ref: User),
  sharesHeldOnRecordDate: Number,
  dividendPerShare: Number,
  grossDividend: Number,
  taxWithheld: Number, // WHT (Withholding Tax)
  netDividend: Number,
  paymentMethod: Enum ['wallet_credit', 'bank_transfer', 'reinvest'],
  status: Enum ['pending', 'processing', 'completed', 'failed'],
  walletTransactionId: ObjectId (ref: WalletTransaction),
  bankTransferReference: String,
  reinvestedShares: Number,
  reinvestedAt: Date,
  failureReason: String,
  processedAt: Date,
  createdAt: Date
}
```

### SharePriceHistory Collection
```typescript
{
  _id: ObjectId,
  date: Date,
  openPrice: Number,
  highPrice: Number,
  lowPrice: Number,
  closePrice: Number,
  volume: Number,
  adjustedClose: Number,
  change: Number,
  changePercent: Number,
  createdAt: Date
}
```

### SharePriceIntraday Collection
```typescript
{
  _id: ObjectId,
  timestamp: Date,
  price: Number,
  volume: Number,
  bid: Number,
  ask: Number,
  spread: Number
}
```

## API Endpoints

### Share Information
- `GET /api/v1/shares/info` - Get cooperative share information
- `GET /api/v1/shares/price` - Get current share price
- `GET /api/v1/shares/price/history` - Get historical price data
- `GET /api/v1/shares/statistics` - Get share statistics (market cap, P/E, etc.)

### Portfolio Management
- `GET /api/v1/shares/portfolio` - Get user's share portfolio
- `GET /api/v1/shares/portfolio/performance` - Get portfolio performance metrics
- `GET /api/v1/shares/portfolio/valuation` - Get current portfolio valuation

### Share Trading
- `POST /api/v1/shares/buy` - Buy shares
- `POST /api/v1/shares/sell` - Sell shares
- `GET /api/v1/shares/orders` - Get order history
- `GET /api/v1/shares/orders/:id` - Get specific order details
- `POST /api/v1/shares/orders/:id/cancel` - Cancel pending order

### Dividends
- `GET /api/v1/shares/dividends` - Get dividend history
- `GET /api/v1/shares/dividends/upcoming` - Get upcoming dividends
- `GET /api/v1/shares/dividends/:id` - Get specific dividend details
- `PUT /api/v1/shares/dividend-reinvestment` - Toggle dividend reinvestment

### Transfers
- `POST /api/v1/shares/transfer` - Transfer shares to another shareholder
- `GET /api/v1/shares/transfers` - Get transfer history
- `POST /api/v1/shares/transfer/accept/:id` - Accept incoming transfer

### Admin Operations
- `POST /api/v1/shares/admin/declare-dividend` - Declare dividend (admin only)
- `POST /api/v1/shares/admin/update-price` - Update share price (admin only)
- `GET /api/v1/share/admin/shareholders` - List all shareholders
- `GET /api/v1/shares/admin/distributions` - Get all dividend distributions
- `POST /api/v1/shares/admin/process-dividends` - Process dividend payments
- `POST /api/v1/shares/admin/issue-bonus` - Issue bonus shares

## Business Logic

### Share Pricing Model

#### Initial Pricing
```
Initial Price = Par Value (e.g., ₦10.00 per share)
```

#### Price Adjustment Formula
```
New Price = (Total Assets - Total Liabilities) / Outstanding Shares
Minimum Price = Par Value
Maximum Daily Change = ±10% (circuit breaker)
```

#### Real-time Price Updates
- Price updates on every buy/sell transaction
- Volume-weighted average price (VWAP) calculation
- Daily OHLC (Open, High, Low, Close) tracking

### Share Purchase Flow
1. User specifies number of shares to buy
2. System calculates total cost (shares × current price + fees)
3. Validate sufficient wallet balance
4. Create pending order
5. Deduct funds from wallet (hold)
6. Update share count in portfolio
7. Recalculate average cost basis
8. Update cooperative total issued shares
9. Adjust share price based on demand
10. Create transaction record
11. Emit real-time portfolio update
12. Send confirmation notification

### Share Sale Flow
1. User specifies number of shares to sell
2. Validate sufficient share balance
3. Calculate proceeds (shares × current price - fees)
4. Calculate capital gain/loss (for tax reporting)
5. Create pending order
6. Deduct shares from portfolio
7. Credit proceeds to wallet
8. Update cooperative outstanding shares
9. Adjust share price based on supply
10. Create transaction record
11. Emit real-time portfolio update
12. Send confirmation notification

### Fee Structure
- Purchase fee: 1.5% of transaction value
- Sale fee: 1.5% of transaction value
- Transfer fee: ₦500 flat fee
- Minimum fee: ₦50
- Platinum members: 50% discount on fees

### Dividend Distribution Process

#### Declaration Phase
1. Board approves dividend amount
2. Admin declares dividend via system
3. Set record date, ex-dividend date, payment date
4. Notification sent to all shareholders
5. Status: 'declared'

#### Record Date Phase
1. System snapshots all shareholder portfolios
2. Identify eligible shareholders
3. Calculate dividend entitlement per shareholder
4. Status: 'record_date_passed'

#### Payment Phase
1. For each eligible shareholder:
   - Calculate gross dividend (shares × dividend per share)
   - Calculate tax withholding (10% WHT)
   - Calculate net dividend
   - Execute payment based on preference (wallet/bank/reinvest)
2. Update distribution status to 'paid'
3. Send payment confirmations
4. Generate tax certificates

### Dividend Reinvestment Plan (DRIP)
- Shareholders can opt to automatically reinvest dividends
- Reinvestment at current market price
- No fees on DRIP transactions
- Fractional shares supported
- Compounding effect tracked

### Tax Handling
- Withholding Tax (WHT): 10% on dividends
- Capital Gains Tax: Not withheld at source (user responsibility)
- Annual tax statement generation
- Cost basis tracking for capital gains calculation

### Trading Rules
- Minimum purchase: 10 shares
- Maximum purchase: 100,000 shares per transaction
- Daily trading limit: Based on membership tier
- Settlement: T+0 (instant)
- Trading hours: 24/7 (electronic trading)
- Circuit breakers: ±10% daily price movement

### Bonus Issue Calculation
```
Bonus Ratio = e.g., 1:5 (1 bonus share for every 5 held)
New Shares = Current Holdings × Bonus Ratio
Adjusted Price = Old Price / (1 + Bonus Ratio)
```

## Scheduled Jobs (BullMQ)

### Daily Price Snapshot
- Run every day at market close (11:59 PM WAT)
- Record OHLC prices
- Calculate daily change
- Update 52-week high/low

### Dividend Processing
- Run on payment date at 9:00 AM WAT
- Process all pending dividend payments
- Handle failures with retry logic
- Generate payment reports

### Quarterly Reports
- Run on last day of each quarter
- Generate shareholder statements
- Calculate quarterly returns
- Send performance reports

### Corporate Actions
- Monitor for bonus issues
- Process stock splits (if applicable)
- Adjust historical prices

## Real-time Features (Socket.io)
- Share price updates
- Portfolio value changes
- Dividend announcements
- Order execution confirmations
- Market news alerts

## Security Requirements
- All trades require authentication
- Large transactions (>₦1M) require additional verification
- Insider trading prevention measures
- Audit trail for all transactions
- Price manipulation detection
- Rate limiting on trading endpoints

## Error Handling
- Insufficient funds: clear error message
- Insufficient shares: clear error message
- Market closed: queue order for next session
- Price volatility: circuit breaker activation
- Network errors: retry with idempotency
- Rollback on failed transactions

## Testing Requirements
- Unit tests for pricing calculations
- Integration tests for buy/sell flows
- E2E tests for dividend distribution
- Load testing for concurrent trading
- Accuracy tests for portfolio valuation
- Minimum 90% code coverage

## Performance Requirements
- Price queries < 50ms
- Trade execution < 500ms
- Support 500 concurrent traders
- Real-time updates < 100ms latency
- 99.9% uptime during trading hours

## Monitoring & Logging
- Trading volume analytics
- Price movement tracking
- Dividend payout tracking
- Shareholder growth metrics
- System health monitoring
- Anomaly detection for unusual trading patterns

## Compliance Requirements
- SEC (Securities and Exchange Commission) regulations
- CAMA (Companies and Allied Matters Act) compliance
- Shareholder register maintenance
- Annual returns filing support
- Audit trail retention (7 years)
- Tax reporting (FIRS compliance)

## Notifications
- Trade execution confirmations
- Dividend declarations
- Dividend payment receipts
- Record date reminders
- Annual general meeting notices
- Price alert thresholds
- Portfolio milestone achievements
