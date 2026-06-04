# PRD-001: Authentication & User Management Module

## Overview
This module handles user authentication, authorization, KYC verification, and farmer profile management for the Cooperative Farming Portal.

## Technology Stack
- **Framework**: NestJS v10+
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with refresh tokens
- **Password Hashing**: bcrypt
- **Validation**: class-validator, class-transformer

## Database Schema

### User Collection
```typescript
{
  _id: ObjectId,
  email: String (unique, required),
  phone: String (unique, required),
  password: String (hashed, required),
  firstName: String,
  lastName: String,
  role: Enum ['farmer', 'agent', 'admin', 'service_provider', 'merchant'],
  isActive: Boolean,
  isVerified: Boolean,
  kycStatus: Enum ['Pending', 'Verified', 'Rejected'],
  kycDocuments: [{
    type: String,
    url: String,
    uploadedAt: Date,
    status: String
  }],
  profileImage: String,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### FarmerProfile Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  location: {
    state: String,
    lga: String,
    address: String,
    coordinates: { lat: Number, lng: Number }
  },
  farmSize: Number, // in hectares
  farmType: [String], // crops, livestock, mixed
  cropsGrown: [String],
  livestockType: [String],
  yearsOfExperience: Number,
  cooperativeId: ObjectId (ref: Cooperative),
  membershipTier: Enum ['Bronze', 'Silver', 'Gold', 'Platinum'],
  membershipStatus: Enum ['Inactive', 'Active', 'Suspended'],
  identityVerification: {
    identityType: Enum ['NIN', 'BVN', 'Voters Card', 'National ID'],
    identityNumber: String,
    verifiedAt: Date
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### AgentProfile Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  agentLevel: Enum ['Bronze Agent', 'Silver Agent', 'Gold Agent', 'Platinum Agent'],
  totalFarmersRegistered: Number,
  activeFarmers: Number,
  totalCommissionEarned: Number,
  currentMonthCommission: Number,
  ranking: Number,
  performanceMetrics: {
    registrationCount: Number,
    upgradeCount: Number,
    savingsVolume: Number,
    marketplaceVolume: Number
  },
  assignedTerritory: {
    state: String,
    lgas: [String]
  },
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password
- `POST /api/v1/auth/verify-email` - Verify email address
- `POST /api/v1/auth/resend-verification` - Resend verification email

### User Management
- `GET /api/v1/users/profile` - Get current user profile
- `PATCH /api/v1/users/profile` - Update user profile
- `PUT /api/v1/users/password` - Change password
- `DELETE /api/v1/users/account` - Delete account (soft delete)

### Farmer Profile
- `GET /api/v1/farmers/profile` - Get farmer profile
- `PATCH /api/v1/farmers/profile` - Update farmer profile
- `POST /api/v1/farmers/kyc/submit` - Submit KYC documents
- `GET /api/v1/farmers/kyc/status` - Get KYC status

### Agent Profile
- `GET /api/v1/agents/profile` - Get agent profile
- `GET /api/v1/agents/dashboard` - Get agent dashboard stats
- `GET /api/v1/agents/farmers` - Get registered farmers list
- `GET /api/v1/agents/commissions` - Get commission history
- `GET /api/v1/agents/ranking` - Get agent ranking

## Business Logic

### Registration Flow
1. User submits registration data (email, phone, password, basic info)
2. System validates uniqueness of email and phone
3. Password is hashed using bcrypt (cost factor: 10)
4. User record created with `isVerified: false`
5. Verification email/SMS sent with OTP
6. Upon verification, `isVerified` set to true
7. Welcome notification sent

### Login Flow
1. User submits credentials (email/phone + password)
2. System validates credentials
3. JWT access token (15min expiry) and refresh token (7days) generated
4. Last login timestamp updated
5. Tokens returned to client

### KYC Verification Flow
1. Farmer uploads identity document (NIN, BVN, etc.)
2. Document stored in cloud storage (AWS S3/Cloudinary)
3. KYC status set to 'Pending'
4. Admin reviews and approves/rejects
5. Notification sent to farmer
6. If approved, farmer can access full features

### Agent Commission Calculation
- Bronze Agent: 2% on registrations, 1% on transactions
- Silver Agent: 3% on registrations, 1.5% on transactions
- Gold Agent: 4% on registrations, 2% on transactions
- Platinum Agent: 5% on registrations, 2.5% on transactions

## Security Requirements
- Password complexity: min 8 chars, uppercase, lowercase, number, special char
- Rate limiting: 5 failed login attempts = 15min lockout
- JWT tokens stored in HTTP-only cookies
- CSRF protection enabled
- Input sanitization on all endpoints
- MongoDB injection prevention
- Audit logging for sensitive operations

## Integration Points
- **Email Service**: SendGrid/Nodemailer for transactional emails
- **SMS Service**: Twilio/Termii for OTP and notifications
- **Cloud Storage**: AWS S3/Cloudinary for document storage
- **SeerBit Payment Gateway**: For identity verification fees (if applicable)

## Error Handling
- Standardized error response format
- HTTP status codes: 200, 201, 400, 401, 403, 404, 409, 422, 500
- Custom exception filters for common errors
- Error logging with correlation IDs

## Testing Requirements
- Unit tests for all services (Jest)
- Integration tests for API endpoints (Supertest)
- E2E tests for critical flows (registration, login, KYC)
- Minimum 80% code coverage

## Performance Requirements
- Response time < 200ms for auth endpoints
- Support 1000 concurrent users
- Token refresh without re-authentication

## Monitoring & Logging
- Request/response logging with Winston
- Performance metrics with Prometheus
- Error tracking with Sentry
- Audit trail for security events
