# Enterprise-Grade Cooperative Farming Portal - Development Prompt Sequence

## Overview
This document contains a sequenced list of prompts to transform the existing mock-data React prototype into a fully functional, enterprise-grade application with real backend integration, proper state management, authentication, and production-ready code quality.

---

## Current State Analysis

### Application Summary
- **Framework**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Architecture**: Single-file state management with localStorage persistence
- **Modules**: 10 feature modules (Dashboard, Membership, Wallet, Savings, Shares, Adashe, Equipment Booking, Services Marketplace, Product Marketplace, Agent System)
- **Code Volume**: ~11,286 lines across 14 TypeScript files
- **Current Data Source**: Hardcoded mock data in `data.ts` and `default_marketplace_data.ts`

### Identified Gaps for Enterprise Readiness
1. ❌ No backend API integration
2. ❌ No authentication/authorization system
3. ❌ No database schema or data persistence layer
4. ❌ No form validation libraries
5. ❌ No error handling boundaries
6. ❌ No unit/integration tests
7. ❌ No CI/CD pipeline configuration
8. ❌ No environment-specific configurations
9. ❌ No API documentation
10. ❌ No rate limiting or security headers
11. ❌ No logging/monitoring setup
12. ❌ No accessibility compliance (WCAG 2.1)
13. ❌ No performance optimization (code splitting, lazy loading)
14. ❌ No internationalization support

---

## Prompt Sequence for Enterprise Transformation

### PHASE 1: Foundation & Architecture (Weeks 1-2)

#### Prompt 1.1: Backend Architecture Setup
```
Create a Node.js/Express.js backend server with TypeScript for the Cooperative Farming Portal. The backend should include:

1. Project structure following enterprise best practices:
   - src/controllers/
   - src/services/
   - src/models/
   - src/routes/
   - src/middleware/
   - src/utils/
   - src/config/

2. Database integration using PostgreSQL with Prisma ORM:
   - Design complete schema matching all types in src/types.ts
   - Include tables: users, memberships, wallets, transactions, savings_goals, fixed_saves, harvest_plans, shares, share_transactions, equipment_bookings, contribution_groups, group_members, group_messages, group_votes, service_categories, service_bookings, products, orders, order_items, agent_referrals, commissions, notifications

3. Environment configuration:
   - .env template with DATABASE_URL, JWT_SECRET, NODE_ENV, PORT, CORS_ORIGIN
   - Configuration loader with validation

4. Base Express server setup with:
   - JSON parsing
   - CORS configuration
   - Helmet security headers
   - Request logging with Morgan
   - Global error handler middleware

Provide the complete Prisma schema file and the main server entry point.
```

#### Prompt 1.2: Authentication & Authorization System
```
Implement a complete authentication and authorization system for the Cooperative Farming Portal backend:

1. User registration endpoint (POST /api/auth/register):
   - Validate: name, email, phone, password, location, identityType, identityNumber
   - Hash password with bcrypt (12 rounds)
   - Create user with default Bronze membership
   - Send welcome email notification
   - Return JWT token

2. User login endpoint (POST /api/auth/login):
   - Validate credentials
   - Generate JWT with user ID, role, membership tier
   - Implement refresh token mechanism
   - Track last login timestamp

3. JWT authentication middleware:
   - Verify token on protected routes
   - Attach user to request object
   - Handle token expiration gracefully

4. Role-based access control (RBAC):
   - Roles: farmer, agent, admin
   - Membership tier checks (Bronze, Silver, Gold, Platinum)
   - Middleware factory for route protection

5. Password reset flow:
   - POST /api/auth/forgot-password
   - POST /api/auth/reset-password

Include input validation with Zod schema, proper error messages, and rate limiting (express-rate-limit) on auth endpoints.
```

#### Prompt 1.3: Frontend State Management Refactor
```
Refactor the frontend state management from localStorage-based useState to a professional Redux Toolkit architecture:

1. Install and configure:
   - @reduxjs/toolkit
   - react-redux
   - @reduxjs/toolkit/query/react (RTK Query)

2. Create store structure:
   - src/store/index.ts - store configuration
   - src/store/slices/authSlice.ts - authentication state
   - src/store/slices/walletSlice.ts - wallet balance and transactions
   - src/store/slices/membershipSlice.ts - membership tier and history
   - src/store/slices/savingsSlice.ts - all savings products
   - src/store/slices/sharesSlice.ts - cooperative shares
   - src/store/slices/bookingsSlice.ts - equipment and service bookings
   - src/store/slices/marketplaceSlice.ts - products and orders
   - src/store/slices/contributionSlice.ts - Adashe groups
   - src/store/slices/agentSlice.ts - agent dashboard data
   - src/store/slices/notificationSlice.ts - notifications

3. Create RTK Query API service:
   - src/services/api.ts - base query with fetchBaseQuery
   - Endpoints for all CRUD operations
   - Automatic cache invalidation
   - Optimistic updates where appropriate

4. Create typed hooks:
   - src/hooks/useAppDispatch.ts
   - src/hooks/useAppSelector.ts
   - src/hooks/useAuth.ts

Provide the complete store configuration and at least 3 example slices with their reducers and async thunks.
```

---

### PHASE 2: Core API Implementation (Weeks 3-5)

#### Prompt 2.1: Wallet & Transaction APIs
```
Implement the complete wallet and transaction management API endpoints:

1. GET /api/wallet/balance - Get current wallet balance
2. GET /api/wallet/transactions - Paginated transaction history with filters:
   - Query params: type, startDate, endDate, status, page, limit
3. POST /api/wallet/deposit - Initiate deposit via payment gateway:
   - Integrate Paystack, Flutterwave, Monnify webhooks
   - Create pending transaction record
   - Return payment authorization URL
4. POST /api/wallet/withdraw - Request withdrawal to bank account:
   - Validate sufficient balance
   - Verify bank account with NUBAN validation
   - Create withdrawal request with approval workflow
5. POST /api/wallet/transfer - Transfer to another member:
   - Atomic transaction with row-level locking
   - Validate recipient exists
   - Check daily transfer limits based on membership tier
   - Create audit trail

6. Webhook handlers:
   - POST /api/webhooks/paystack
   - POST /api/webhooks/flutterwave
   - POST /api/webhooks/monnify

Include:
- Prisma transactions for atomicity
- Proper error handling with custom error classes
- Response DTOs separate from database models
- Unit tests with Jest for all service functions
```

#### Prompt 2.2: Membership Management APIs
```
Implement membership tier management API endpoints:

1. GET /api/membership/current - Get user's current membership details
2. GET /api/membership/tiers - List all available tiers with benefits
3. GET /api/membership/history - Get membership upgrade history
4. POST /api/membership/upgrade - Upgrade to higher tier:
   - Validate current balance covers upgrade cost
   - Process payment from wallet
   - Update membership tier immediately
   - Create membership history record
   - Send confirmation email with new benefits
5. POST /api/membership/renew - Renew annual subscription:
   - Check if renewal is due (within 30 days of expiry)
   - Process payment
   - Extend expiry date by 1 year
   - Send renewal reminder notifications

6. Scheduled job (node-cron):
   - Daily check for expiring memberships (7 days before)
   - Auto-downgrade expired memberships after grace period
   - Send expiry warning emails

Include:
- Membership tier benefits comparison endpoint
- Prorated refund calculation logic for downgrades
- Audit log for all membership changes
```

#### Prompt 2.3: Savings Products APIs
```
Implement comprehensive savings products API endpoints:

1. Flex Save:
   - GET /api/savings/flex - Get flex save balance and accrued interest
   - POST /api/savings/flex/deposit - Deposit from wallet (instant)
   - POST /api/savings/flex/withdraw - Withdraw to wallet (instant, no penalty)
   - Daily interest calculation job (compound interest at 11% APY)

2. Target Savings Goals:
   - GET /api/savings/targets - List all user's target goals
   - POST /api/savings/targets - Create new goal
   - PUT /api/savings/targets/:id - Update goal
   - POST /api/savings/targets/:id/contribute - Add funds to goal
   - POST /api/savings/targets/:id/withdraw - Withdraw upon completion
   - DELETE /api/savings/targets/:id - Cancel goal (with penalty rules)

3. Fixed Save Locks:
   - GET /api/savings/fixed - List fixed deposits
   - POST /api/savings/fixed/create - Create fixed deposit (30/60/90/180/365 days)
   - GET /api/savings/fixed/:id - Get lock details with accumulated interest
   - POST /api/savings/fixed/:id/withdraw - Early withdrawal (with penalty) or maturity withdrawal
   - Auto-renewal processing at maturity

4. Harvest Save Plans:
   - GET /api/savings/harvest - List harvest-linked savings
   - POST /api/savings/harvest - Create seasonal savings plan
   - POST /api/savings/harvest/:id/contribute - Add funds
   - POST /api/savings/harvest/:id/release - Release funds at harvest date

Include:
- Interest calculation service with daily compounding
- Early withdrawal penalty logic per product type
- Scheduled jobs for interest accrual and maturity processing
- Validation for minimum/maximum deposit amounts per tier
```

#### Prompt 2.4: Cooperative Shares APIs
```
Implement cooperative shares trading and dividend API:

1. GET /api/shares/portfolio - Get user's share portfolio:
   - Shares owned, current price, book value, total dividends
   - Price trend history (last 12 months)
2. GET /api/shares/price - Get current share price and NAV
3. POST /api/shares/buy - Purchase shares:
   - Validate wallet balance
   - Check membership tier limits (Silver: 2000 max, Gold/Platinum: unlimited)
   - Execute purchase at current price
   - Update share registry
4. POST /api/shares/sell - Sell shares:
   - Validate share ownership
   - Calculate capital gains/losses
   - Process sale at current price
   - Credit wallet after T+2 settlement
5. GET /api/shares/dividends - Get dividend history
6. POST /api/shares/dividends/claim - Claim available dividends

Admin endpoints:
- POST /api/admin/shares/issue - Issue new shares (board approval required)
- POST /api/admin/shares/price-update - Update share price (daily NAV calculation)
- POST /api/admin/shares/dividend-declare - Declare dividend distribution

Include:
- Share registry ledger with double-entry bookkeeping
- Dividend distribution algorithm (pro-rata based on holdings)
- Lock-up periods for newly purchased shares
- Audit trail for all share transactions
```

#### Prompt 2.5: Equipment Booking APIs
```
Implement agricultural equipment booking and rental API:

1. GET /api/equipment/available - List available equipment:
   - Filter by type, location, date range
   - Real-time availability status
2. GET /api/equipment/:id - Get equipment details:
   - Specifications, pricing, operator info
   - Availability calendar
   - Past reviews and ratings
3. POST /api/bookings/equipment - Create equipment booking:
   - Select equipment, date, time slot, acreage
   - Calculate total cost (base rate × acreage × duration)
   - Apply membership discount (Silver 5%, Gold 10%, Platinum 20%)
   - Require deposit (30% of total)
   - Generate booking confirmation
4. GET /api/bookings/equipment - List user's bookings
5. GET /api/bookings/equipment/:id - Get booking details with GPS tracking
6. PUT /api/bookings/equipment/:id/cancel - Cancel booking:
   - Apply cancellation policy (full refund >48hrs, 50% >24hrs, none <24hrs)
   - Process refund to wallet
7. PUT /api/bookings/equipment/:id/complete - Mark booking complete:
   - Operator submits completion evidence
   - Farmer confirms and rates service
   - Release remaining payment to operator

Operator features:
- GET /api/operator/bookings - Assigned bookings
- PUT /api/operator/bookings/:id/accept - Accept booking
- PUT /api/operator/bookings/:id/update-location - GPS location update
- PUT /api/operator/bookings/:id/submit-evidence - Upload completion photos

Include:
- Geospatial queries for nearest equipment
- Real-time GPS tracking integration (WebSocket)
- Automated dispatch algorithm
- Dynamic pricing based on demand/season
```

---

### PHASE 3: Marketplace & Community Features (Weeks 6-8)

#### Prompt 3.1: Agricultural Services Marketplace APIs
```
Implement professional agricultural services booking API:

1. GET /api/services/categories - List all service categories:
   - Soil Testing, Farm Mapping, Precision Agriculture, Drone Services, etc.
   - Include pricing, ratings, reviews count
2. GET /api/services/providers - List verified service providers:
   - Filter by category, location, rating, availability
   - Provider profiles with certifications
3. POST /api/services/bookings - Book a service:
   - Select service, provider, date, location
   - Specify requirements (acreage, crop type, special needs)
   - Get instant quote
   - Pay deposit or full amount
4. GET /api/services/my-bookings - User's service bookings
5. PUT /api/services/bookings/:id/rate - Submit rating and review:
   - 1-5 star rating
   - Written review
   - Optional photos
   - Only allowed after completed service

Provider portal:
- GET /api/provider/bookings - Incoming bookings
- PUT /api/provider/bookings/:id/confirm - Confirm booking
- PUT /api/provider/bookings/:id/complete - Mark complete
- GET /api/provider/analytics - Earnings, ratings, completion rate

Include:
- Service provider verification workflow (KYC, certifications)
- Escrow payment system for large projects
- Dispute resolution mechanism
- Automated invoicing and receipts
```

#### Prompt 3.2: Product Marketplace APIs
```
Implement e-commerce product marketplace API:

1. GET /api/products - List products with pagination and filters:
   - Category, price range, merchant, in-stock only
   - Search by name, description
   - Sort by price, rating, newest
2. GET /api/products/:id - Product details:
   - Images, description, specifications
   - Stock availability
   - Merchant info and ratings
   - Related products
3. POST /api/cart/items - Add to cart:
   - Merge quantities for duplicate products
   - Validate stock availability
   - Calculate subtotal with membership discounts
4. GET /api/cart - Get current cart
5. PATCH /api/cart/items/:id - Update quantity
6. DELETE /api/cart/items/:id - Remove from cart
7. POST /api/orders - Checkout and create order:
   - Validate cart items and stock
   - Calculate totals (subtotal, delivery fee, discounts)
   - Process payment from wallet or gateway
   - Create order with unique reference
   - Reduce stock levels atomically
   - Send order confirmation email
8. GET /api/orders - User's order history
9. GET /api/orders/:id - Order details with tracking
10. POST /api/orders/:id/cancel - Cancel order (if not shipped)

Merchant portal:
- POST /api/merchant/products - Create product listing
- PUT /api/merchant/products/:id - Update product
- PUT /api/merchant/products/:id/stock - Update stock levels
- GET /api/merchant/orders - Incoming orders
- PUT /api/merchant/orders/:id/process - Update order status

Delivery integration:
- Delivery fee calculation based on distance and weight
- Integration with logistics partners (GIG Logistics, Kwik Delivery)
- Real-time order tracking

Include:
- Inventory management with low-stock alerts
- Product review moderation system
- Return/refund workflow
- Bulk import/export for merchants
```

#### Prompt 3.3: Adashe/Esusu Contribution Groups APIs
```
Implement rotating savings and credit association (ROSCA) API:

1. GET /api/contribution/groups - List available groups:
   - Filter by frequency, contribution amount, membership tier requirement
   - Show current slots filled, next payout date
2. GET /api/contribution/groups/:id - Group details:
   - Members list with positions
   - Contribution history
   - Payout schedule
   - Chat messages
   - Active votes
3. POST /api/contribution/groups/:id/join - Join a group:
   - Validate eligibility (tier, wallet balance for first contribution)
   - Assign position in rotation
   - Process initial contribution
   - Add to group chat
4. POST /api/contribution/groups - Create new group:
   - Set contribution amount, frequency, max members
   - Define purpose/goal
   - Invite initial members
5. POST /api/contribution/groups/:id/contribute - Make contribution:
   - Deduct from wallet
   - Add to group pool
   - Update contribution history
6. POST /api/contribution/groups/:id/payout - Process rotation payout:
   - Admin-only or automated based on schedule
   - Transfer pool to next member in rotation
   - Reset pool for next cycle
7. GET /api/contribution/groups/:id/chat - Get chat history
8. POST /api/contribution/groups/:id/chat - Send message
9. POST /api/contribution/groups/:id/votes - Create vote/proposal
10. POST /api/contribution/groups/:id/votes/:voteId - Cast vote

Governance features:
- Quorum validation for votes
- Proposal types (amount change, member swap, rule modification)
- Voting period management
- Attendance tracking for meetings

Include:
- Automated contribution reminders (email, SMS, push)
- Default handling and recovery process
- Group dissolution and fund distribution logic
- Fraud detection for suspicious patterns
```

---

### PHASE 4: Agent System & Admin Portal (Weeks 9-10)

#### Prompt 4.1: Agent Referral & Commission APIs
```
Implement agent referral network and commission tracking API:

1. GET /api/agent/dashboard - Agent overview:
   - Total referrals, active farmers
   - Total commissions earned (monthly, lifetime)
   - Current level and progress to next level
   - Leaderboard ranking
2. GET /api/agent/referrals - List referred farmers:
   - Filter by status (pending KYC, verified, active)
   - Show each farmer's activity and generated commissions
3. POST /api/agent/register-farmer - Register new farmer:
   - Capture farmer details and KYC documents
   - Link to referring agent
   - Trigger KYC verification workflow
   - Instant commission on successful registration
4. GET /api/agent/commissions - Commission history:
   - Breakdown by activity type
   - Pending vs paid commissions
   - Export to CSV
5. POST /api/agent/withdraw-commission - Withdraw commissions to wallet

Commission structure:
- Registration bonus: ₦2,500 per verified farmer
- Membership upgrade: 10% of upgrade fee
- Savings deposit: 0.5% of deposit amount
- Equipment booking: 5% of booking value
- Marketplace purchase: 2.5% of order value

Level progression:
- Bronze Agent: 0-10 referrals, base rates
- Silver Agent: 11-50 referrals, +10% bonus
- Gold Agent: 51-200 referrals, +25% bonus
- Platinum Agent: 200+ referrals, +50% bonus + priority support

Include:
- Anti-fraud checks (prevent self-referrals)
- Clawback logic for refunded transactions
- Monthly reconciliation reports
- Tax document generation
```

#### Prompt 4.2: Admin Dashboard & Operations APIs
```
Implement comprehensive admin portal for platform operations:

User management:
- GET /api/admin/users - List all users with filters
- GET /api/admin/users/:id - User profile and activity
- PUT /api/admin/users/:id/verify-kyc - Approve/reject KYC
- PUT /api/admin/users/:id/suspend - Suspend user account
- POST /api/admin/users/:id/impersonate - Login as user (audit logged)

Financial operations:
- GET /api/admin/transactions - All platform transactions
- GET /api/admin/transactions/:id - Transaction details
- PUT /api/admin/transactions/:id/reverse - Reverse transaction (superadmin only)
- GET /api/admin/settlements - Pending settlements to operators/merchants
- POST /api/admin/settlements/process - Batch process settlements

Content management:
- CRUD for service categories
- CRUD for product categories
- Manage homepage banners and promotions
- Moderate reviews and flag inappropriate content

System configuration:
- GET/PUT /api/admin/config - Platform settings
- Manage membership tier benefits and pricing
- Configure interest rates for savings products
- Set share price and dividend parameters
- Manage payment gateway credentials

Analytics and reporting:
- GET /api/admin/analytics/overview - Key metrics dashboard
- GET /api/admin/analytics/users - User growth, retention, churn
- GET /api/admin/analytics/financial - Revenue, transaction volume, outstanding liabilities
- GET /api/admin/analytics/engagement - Feature usage, session duration
- Export reports in PDF/Excel formats

Audit and compliance:
- GET /api/admin/audit-logs - System-wide audit trail
- GET /api/admin/compliance/reports - Regulatory reports
- POST /api/admin/compliance/data-export - User data export (GDPR)

Include:
- Multi-level admin roles (support, manager, superadmin)
- Two-factor authentication for admin accounts
- IP whitelisting for admin access
- Session management and forced logout
```

---

### PHASE 5: Frontend Integration & Polish (Weeks 11-13)

#### Prompt 5.1: Authentication UI Implementation
```
Replace the mock authentication in the frontend with real authentication flows:

1. Create authentication pages:
   - /login - Login form with email/phone and password
   - /register - Multi-step registration wizard:
     Step 1: Personal details (name, email, phone, password)
     Step 2: Location (state, LGA, address, GPS capture)
     Step 3: Identity verification (NIN/BVN/Voters Card upload)
     Step 4: Agent referral code (optional)
     Step 5: Terms acceptance and submission
   - /forgot-password - Request password reset
   - /reset-password - Set new password with token
   - /verify-email - Email verification landing page
   - /kyc-pending - KYC verification pending state

2. Implement protected routes:
   - Create AuthGuard component wrapping protected routes
   - Redirect unauthenticated users to login
   - Show loading spinner during auth check
   - Handle token refresh silently

3. Update App.tsx navigation:
   - Replace hardcoded "Aliyu" with authenticated user name
   - Show/hide Agent Dashboard based on user role
   - Display membership tier from API response

4. Session management:
   - Store JWT in httpOnly cookie (not localStorage)
   - Implement token refresh before expiry
   - Handle 401 responses with automatic logout
   - Multiple tab synchronization

5. Security enhancements:
   - CSRF token handling
   - XSS prevention in forms
   - Rate limit exceeded UI feedback
   - Account lockout after failed attempts

Use React Hook Form with Zod validation for all forms. Include proper error messages, loading states, and success feedback.
```

#### Prompt 5.2: Wallet Integration with Payment Gateways
```
Integrate real payment gateways for wallet funding and withdrawals:

1. Payment gateway selection component:
   - Display available gateways (Paystack, Flutterwave, Monnify)
   - Show processing fees and estimated time
   - Remember user's preferred gateway

2. Deposit flow implementation:
   - Input amount with validation (min ₦100, max ₦1,000,000 per transaction)
   - Quick amount buttons (₦5000, ₦10000, ₦25000, ₦50000)
   - Gateway popup/modal integration
   - Polling for payment status
   - Success/failure handling with appropriate messaging
   - Auto-redirect back to wallet on completion

3. Withdrawal flow:
   - Bank account selection/addition
   - NUBAN validation API integration
   - Amount input with balance check
   - Withdrawal limits display (based on tier and KYC level)
   - Processing time estimate
   - Withdrawal history with status tracking

4. Transfer to member:
   - Search by name, phone, or member ID
   - Real-time validation of recipient
   - Amount input with tier-based limits
   - Optional note/message
   - Confirmation modal with fee disclosure
   - Instant transfer with receipt generation

5. Transaction history improvements:
   - Advanced filtering (date range, type, status, amount range)
   - Export to CSV/PDF
   - Transaction detail modal
   - Search functionality
   - Infinite scroll or pagination

6. Webhook simulation for development:
   - Mock webhook endpoint for local testing
   - Test cards for each gateway's sandbox
   - Simulate various scenarios (success, failure, pending, timeout)

Include proper error handling for network failures, insufficient funds, gateway downtime, and transaction timeouts.
```

#### Prompt 5.3: Real-Time Features with WebSockets
```
Implement real-time features using WebSocket connections:

1. WebSocket setup:
   - Install socket.io-client
   - Create WebSocket context provider
   - Connection management with auto-reconnect
   - Authentication handshake with JWT

2. Live notifications:
   - Receive push notifications for:
     * Payment confirmations
     * Booking status updates
     * Contribution group messages
     * Dividend announcements
     * System alerts
   - Badge counter update in real-time
   - Toast notifications for critical updates
   - Notification preferences management

3. Equipment tracking:
   - Live GPS updates for active equipment bookings
   - Map visualization with moving markers
   - ETA calculation and updates
   - Operator status (en-route, on-site, completed)
   - Geofence alerts (equipment entering/leaving farm boundary)

4. Contribution group chat:
   - Real-time messaging in group chat
   - Message read receipts
   - Typing indicators
   - File/image sharing
   - Message search
   - Chat history pagination

5. Trading floor updates:
   - Live share price ticker
   - Order book updates (for future trading feature)
   - Dividend announcement broadcasts
   - Market news feed

6. Admin live dashboard:
   - Real-time transaction counter
   - Active users metric
   - System health indicators
   - Alert stream for anomalies

Implement proper connection state management, offline queueing for messages, and graceful degradation when WebSocket is unavailable.
```

#### Prompt 5.4: Performance Optimization
```
Optimize the frontend application for enterprise-scale performance:

1. Code splitting and lazy loading:
   - Lazy load route components with React.lazy and Suspense
   - Split by feature modules (Dashboard, Wallet, Savings, etc.)
   - Preload critical chunks
   - Loading skeletons for lazy components

2. Bundle optimization:
   - Analyze bundle with vite-bundle-visualizer
   - Tree-shake unused code
   - Replace heavy libraries with lighter alternatives
   - Dynamic imports for large dependencies
   - Target bundle size < 500KB initial load

3. Caching strategy:
   - Implement SWR-style caching with RTK Query
   - Stale-while-revalidate pattern
   - Cache invalidation on mutations
   - Persistent cache with IndexedDB
   - Optimistic updates for better UX

4. Image optimization:
   - Convert to WebP format
   - Responsive images with srcset
   - Lazy loading for below-fold images
   - Blur-up placeholders
   - CDN integration for static assets

5. Virtual scrolling:
   - Implement react-window for long lists (transactions, orders, messages)
   - Pagination for large datasets
   - Infinite scroll where appropriate

6. Memoization:
   - React.memo for pure components
   - useMemo for expensive calculations
   - useCallback for event handlers passed as props
   - Profile with React DevTools Profiler

7. Network optimization:
   - HTTP/2 multiplexing
   - Request debouncing and throttling
   - Batch related API calls
   - Compression with gzip/brotli
   - Service worker for offline support

8. Performance monitoring:
   - Web Vitals tracking (LCP, FID, CLS)
   - Custom performance marks
   - Error tracking with source maps
   - Real User Monitoring (RUM) setup

Provide specific code examples for implementing at least 5 of these optimizations in the existing codebase.
```

---

### PHASE 6: Testing & Quality Assurance (Weeks 14-15)

#### Prompt 6.1: Backend Unit & Integration Tests
```
Create comprehensive test suite for the backend:

1. Test setup:
   - Jest configuration with TypeScript
   - Test database with test containers or in-memory PostgreSQL
   - Factory functions for test data generation
   - Mock utilities for external services (payment gateways, email)

2. Unit tests for services (examples):
   - wallet.service.test.ts:
     * calculateDepositFee()
     * validateWithdrawalAmount()
     * applyMembershipDiscount()
     * accrueDailyInterest()
   - membership.service.test.ts:
     * getUpgradeCost()
     * calculateProratedRefund()
     * checkTierEligibility()
   - shares.service.test.ts:
     * calculateDividendDistribution()
     * executeSharePurchase()
     * computeCapitalGains()

3. Integration tests for API endpoints:
   - auth.e2e.test.ts:
     * POST /api/auth/register - success and validation errors
     * POST /api/auth/login - success, invalid credentials, locked account
     * POST /api/auth/refresh-token - valid and expired tokens
   - wallet.e2e.test.ts:
     * GET /api/wallet/balance - authenticated and unauthenticated
     * POST /api/wallet/deposit - initiate and webhook confirmation
     * POST /api/wallet/transfer - sufficient and insufficient funds
   - bookings.e2e.test.ts:
     * POST /api/bookings/equipment - create, cancel, complete
     * Time slot conflict detection
     * Membership discount application

4. Test coverage requirements:
   - Minimum 80% line coverage
   - Minimum 70% branch coverage
   - Critical paths at 100% coverage
   - Generate coverage reports with lcov

5. CI integration:
   - Run tests on every pull request
   - Fail build on coverage regression
   - Parallel test execution
   - Flaky test detection

Provide example test files demonstrating proper mocking, assertions, and test organization.
```

#### Prompt 6.2: Frontend Component & E2E Tests
```
Implement comprehensive frontend testing strategy:

1. Component testing with Vitest and React Testing Library:
   - Setup configuration for component tests
   - Test utility functions and custom hooks
   - Test individual components in isolation
   
   Example test cases:
   - DigitalWalletView:
     * Renders balance correctly
     * Deposit button opens modal
     * Form validation shows errors
     * Successful deposit shows success toast
     * Network error shows error message
   - MembershipView:
     * Displays current tier correctly
     * Upgrade button disabled for current tier
     * Cost calculation is accurate
     * Benefits list renders completely
   - EquipmentBookingView:
     * Calendar date picker works
     * Price calculation updates with acreage
     * Membership discount applied correctly
     * Booking confirmation shows summary

2. Custom hook tests:
   - useAuth: login, logout, token refresh
   - useWallet: deposit, withdraw, transfer
   - useBookings: create, cancel, track

3. End-to-end tests with Playwright:
   - Critical user journeys:
     * Complete registration flow
     * Fund wallet and make deposit
     * Book equipment and track delivery
     * Join contribution group and participate
     * Purchase shares and receive dividends
     * Agent registers farmer and earns commission
   - Cross-browser testing (Chrome, Firefox, Safari)
   - Mobile viewport testing
   - Accessibility testing with axe-core

4. Visual regression testing:
   - Setup Percy or Chromatic
   - Capture baseline screenshots
   - Detect unintended UI changes
   - Review visual diffs in PR workflow

5. Performance tests:
   - Lighthouse CI integration
   - Budget enforcement (bundle size, load time)
   - Load testing with k6 for API endpoints

Provide example test files for at least 3 components and 2 E2E user journeys.
```

---

### PHASE 7: DevOps & Deployment (Weeks 16-17)

#### Prompt 7.1: Infrastructure as Code
```
Create infrastructure as code for production deployment:

1. Docker configuration:
   - Multi-stage Dockerfile for backend (optimized image size)
   - Dockerfile for frontend (nginx serving built assets)
   - docker-compose.yml for local development:
     * PostgreSQL service
     * Redis for caching and sessions
     * Backend API
     * Frontend dev server
     * Mailhog for email testing
   - Health checks for all services

2. Kubernetes manifests (or Docker Swarm):
   - Deployment configs for backend and frontend
   - Service definitions for internal routing
   - Ingress configuration with TLS termination
   - Horizontal Pod Autoscaler based on CPU/memory
   - Resource limits and requests
   - ConfigMaps for environment variables
   - Secrets management

3. Database migrations:
   - Prisma migration scripts
   - Rollback procedures
   - Seed data for production
   - Backup and restore procedures

4. CI/CD pipeline (GitHub Actions):
   - Workflow for backend:
     * Lint and type check
     * Run tests with coverage
     * Build Docker image
     * Push to container registry
     * Deploy to staging
     * Run smoke tests
     * Manual approval for production
     * Deploy to production
     * Health check verification
   - Workflow for frontend:
     * Lint and type check
     * Run tests
     * Build optimized bundle
     * Deploy to CDN (Cloudflare Pages, Netlify, or S3+CloudFront)
     * Invalidate cache

5. Monitoring and alerting:
   - Prometheus metrics collection
   - Grafana dashboards for:
     * API response times
     * Error rates
     * Database performance
     * Memory/CPU usage
     * Business metrics (transactions, signups)
   - Alertmanager configuration for:
     * High error rate (>1%)
     * Slow response times (p95 > 2s)
     * Database connection pool exhaustion
     * Disk space warnings
     * SSL certificate expiry

Provide complete Dockerfile, docker-compose.yml, and GitHub Actions workflow files.
```

#### Prompt 7.2: Security Hardening
```
Implement enterprise-grade security measures:

1. API security:
   - Rate limiting per endpoint and user tier
   - Request validation and sanitization
   - SQL injection prevention (parameterized queries)
   - XSS prevention (content security policy)
   - CSRF token validation
   - Request signing for sensitive operations
   - API versioning strategy

2. Data protection:
   - Encryption at rest (AES-256 for sensitive fields)
   - Encryption in transit (TLS 1.3)
   - PCI DSS compliance for payment data
   - NDPR/GDPR compliance for user data
   - Data retention policies
   - Right to deletion implementation

3. Authentication hardening:
   - Multi-factor authentication (TOTP, SMS)
   - Password complexity requirements
   - Account lockout after failed attempts
   - Session management with secure cookies
   - Concurrent session limits
   - Device fingerprinting

4. Infrastructure security:
   - Network segmentation (public/private subnets)
   - WAF (Web Application Firewall) rules
   - DDoS protection
   - Regular vulnerability scanning
   - Penetration testing procedures
   - Security headers (HSTS, X-Frame-Options, CSP)

5. Audit and compliance:
   - Comprehensive audit logging
   - Log retention and analysis
   - Compliance reporting automation
   - Incident response procedures
   - Data breach notification workflow

6. Third-party risk:
   - Vendor security assessment
   - API key rotation procedures
   - Webhook signature verification
   - Dependency vulnerability scanning (Dependabot, Snyk)

Provide implementation examples for rate limiting, audit logging middleware, and security header configuration.
```

---

### PHASE 8: Documentation & Handover (Week 18)

#### Prompt 8.1: API Documentation
```
Generate comprehensive API documentation:

1. OpenAPI/Swagger specification:
   - Document all endpoints with request/response schemas
   - Include authentication requirements
   - Provide example requests and responses
   - Document error codes and meanings
   - Interactive API explorer

2. Developer guide:
   - Getting started tutorial
   - Authentication flow explanation
   - Rate limiting and quotas
   - Webhook integration guide
   - SDK examples (JavaScript, Python, cURL)
   - Postman collection

3. Internal API docs:
   - Architecture decision records (ADRs)
   - Database schema documentation
   - Service dependency diagram
   - Data flow diagrams
   - Sequence diagrams for complex flows

4. Change management:
   - API versioning policy
   - Deprecation timeline
   - Breaking change communication
   - Changelog maintenance

Use tools like Swagger UI, Redoc, or Stoplight for interactive documentation.
```

#### Prompt 8.2: User & Operations Manuals
```
Create comprehensive documentation for end users and operations team:

1. User guides:
   - Getting started for farmers
   - Feature-by-feature tutorials with screenshots
   - Video walkthroughs for key workflows
   - FAQ section
   - Troubleshooting guide
   - Membership tier comparison
   - Fee schedule and pricing

2. Agent handbook:
   - How to register farmers effectively
   - Commission structure explained
   - Best practices and tips
   - Code of conduct
   - Support escalation process

3. Operations manual:
   - Customer support playbook
   - Common issues and resolutions
   - Escalation matrix
   - SLA definitions
   - Refund and dispute handling procedures
   - Fraud detection and response

4. Admin training:
   - Dashboard navigation
   - User management procedures
   - Financial reconciliation steps
   - Report generation guide
   - Emergency procedures (outage, breach)

5. Release notes template:
   - Feature announcements
   - Bug fixes
   - Known issues
   - Upgrade instructions

Provide templates and example content for each documentation type.
```

---

## Implementation Timeline Summary

| Phase | Duration | Focus Area | Deliverables |
|-------|----------|------------|--------------|
| 1 | Weeks 1-2 | Foundation | Backend架构，认证系统，Redux状态管理 |
| 2 | Weeks 3-5 | Core APIs | 钱包、会员、储蓄、股份、设备预约 API |
| 3 | Weeks 6-8 | Marketplace | 服务市场、产品电商、Adashe 群组 API |
| 4 | Weeks 9-10 | Agent & Admin | 代理系统、管理后台 API |
| 5 | Weeks 11-13 | Frontend | 认证集成、支付网关、实时功能、性能优化 |
| 6 | Weeks 14-15 | Testing | 单元测试、集成测试、E2E 测试 |
| 7 | Weeks 16-17 | DevOps | Docker、K8s、CI/CD、安全加固 |
| 8 | Week 18 | Documentation | API 文档、用户手册、运维指南 |

**Total Estimated Timeline: 18 weeks (4.5 months)**

---

## Success Criteria

### Functional Requirements
- ✅ All 10 modules fully integrated with real backend
- ✅ Secure authentication with MFA option
- ✅ Real payment processing with 3 gateways
- ✅ Real-time notifications and GPS tracking
- ✅ Complete admin portal for operations

### Non-Functional Requirements
- ✅ API response time p95 < 500ms
- ✅ Frontend Lighthouse score > 90
- ✅ 99.9% uptime SLA
- ✅ SOC 2 Type II compliance ready
- ✅ NDPR/GDPR compliant data handling
- ✅ 80%+ test coverage
- ✅ Zero critical security vulnerabilities

### Business Metrics
- ✅ Support 10,000 concurrent users
- ✅ Process 1,000 transactions per minute
- ✅ Scale to 100,000 registered farmers
- ✅ Multi-tenant ready for expansion

---

## Next Steps

1. **Review and prioritize** this prompt sequence with stakeholders
2. **Set up project management** (Jira, Linear, or similar) with epics matching each phase
3. **Assemble team** with required skills (backend, frontend, DevOps, QA)
4. **Begin Phase 1** with Prompt 1.1 for backend architecture
5. **Establish cadence** for code reviews, demos, and retrospectives
6. **Plan beta launch** after Phase 5 completion with select user group
7. **Schedule security audit** before production launch

---

*This document serves as a comprehensive roadmap for transforming the mock-data prototype into a production-ready, enterprise-grade Cooperative Farming Portal. Each prompt is designed to be used sequentially with an AI coding assistant or given to development team members as detailed task specifications.*
