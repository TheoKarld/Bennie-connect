# PRD 01: Authentication & User Management Module

## Overview
Enterprise-grade authentication and user management system for the Cooperative Farming Portal using NestJS, MongoDB, and JWT-based security.

---

## Database Schema (MongoDB with Mongoose)

### User Collection
```typescript
{
  _id: ObjectId;
  email: string (unique, indexed);
  phone: string (unique, indexed);
  password: string (bcrypt hashed);
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'COOP_MANAGER' | 'MEMBER' | 'AGENT';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  profileImage?: string;
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country: string;
    postalCode?: string;
    coordinates?: { lat: number; lng: number }
  };
  bvn?: string; // Bank Verification Number
  nin?: string; // National Identity Number
  nextOfKin?: {
    name: string;
    phone: string;
    relationship: string;
    address?: string;
  };
  bankDetails?: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
  };
  referralCode: string (unique);
  referredBy?: ObjectId (ref: User);
  lastLoginAt?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
  passwordChangedAt?: Date;
  refreshToken?: string;
  permissions: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### RefreshToken Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User, indexed);
  token: string (hashed, unique);
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  isRevoked: boolean;
  createdAt: Date;
}
```

### PasswordResetToken Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User);
  token: string (hashed, unique);
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}
```

### EmailVerificationToken Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User);
  token: string (hashed, unique);
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}
```

---

## API Endpoints

### Authentication Endpoints

#### POST /api/v1/auth/register
**Description:** Register a new user account
**Request Body:**
```json
{
  "email": "user@example.com",
  "phone": "+2348012345678",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "MEMBER",
  "referralCode": "optional_code"
}
```
**Response:** 201 Created
```json
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "MEMBER",
      "isEmailVerified": false
    },
    "accessToken": "jwt_token"
  }
}
```

#### POST /api/v1/auth/login
**Description:** Authenticate user and receive tokens
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "MEMBER",
      "permissions": ["wallet:view", "savings:create"]
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "expiresIn": 900
  }
}
```

#### POST /api/v1/auth/refresh-token
**Description:** Refresh access token using refresh token
**Request Body:**
```json
{
  "refreshToken": "valid_refresh_token"
}
```
**Response:** 200 OK

#### POST /api/v1/auth/logout
**Description:** Logout user and revoke tokens
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "refreshToken": "optional_refresh_token"
}
```
**Response:** 200 OK

#### POST /api/v1/auth/forgot-password
**Description:** Request password reset email
**Request Body:**
```json
{
  "email": "user@example.com"
}
```
**Response:** 200 OK

#### POST /api/v1/auth/reset-password
**Description:** Reset password using token
**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePass123!"
}
```
**Response:** 200 OK

#### POST /api/v1/auth/verify-email
**Description:** Verify email address
**Request Body:**
```json
{
  "token": "email_verification_token"
}
```
**Response:** 200 OK

#### POST /api/v1/auth/resend-verification
**Description:** Resend email verification
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### GET /api/v1/auth/me
**Description:** Get current user profile
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### PATCH /api/v1/auth/change-password
**Description:** Change password for authenticated user
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```
**Response:** 200 OK

#### PUT /api/v1/auth/profile
**Description:** Update user profile
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+2348012345678",
  "dateOfBirth": "1990-01-01",
  "gender": "MALE",
  "address": {
    "street": "123 Farm Road",
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria"
  }
}
```
**Response:** 200 OK

### Admin User Management Endpoints

#### GET /api/v1/admin/users
**Description:** List all users (admin only)
**Headers:** Authorization: Bearer <token>
**Query Params:** page, limit, search, role, status, sortBy, sortOrder
**Response:** 200 OK

#### GET /api/v1/admin/users/:id
**Description:** Get user by ID (admin only)
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### PATCH /api/v1/admin/users/:id/status
**Description:** Update user status (admin only)
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "status": "ACTIVE"
}
```
**Response:** 200 OK

#### PATCH /api/v1/admin/users/:id/role
**Description:** Update user role (admin only)
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "role": "COOP_MANAGER"
}
```
**Response:** 200 OK

#### DELETE /api/v1/admin/users/:id
**Description:** Soft delete user (admin only)
**Headers:** Authorization: Bearer <token>
**Response:** 204 No Content

---

## Business Logic

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*)

### Account Lockout Policy
- Maximum 5 failed login attempts
- Account locked for 30 minutes after 5 failed attempts
- Login attempts reset on successful login
- Locked accounts return generic error message

### Token Management
- Access token expiry: 15 minutes
- Refresh token expiry: 7 days
- Single refresh token per device (tracked by userAgent + IP)
- Token rotation on each refresh
- Immediate revocation on logout

### Email Verification Flow
1. Generate unique token with 24-hour expiry
2. Send verification email with link
3. Token invalidated after use
4. Resend available every 60 seconds

### Password Reset Flow
1. Generate unique token with 1-hour expiry
2. Send reset email with link
3. Token invalidated after use or expiry
4. Rate limit: max 3 requests per hour per email

### Referral System
- Auto-generate unique referral code on registration
- Track referrer in user document
- Prepare for future reward calculations

---

## Security Requirements

### Authentication
- JWT-based authentication with RS256 algorithm
- Password hashing with bcrypt (cost factor: 12)
- Secure random token generation (crypto.randomBytes)
- Token blacklisting for immediate logout

### Authorization
- Role-based access control (RBAC)
- Permission-based authorization for fine-grained access
- Custom decorators for route protection
- Dynamic permission checking

### Input Validation
- class-validator for all DTOs
- Sanitization of user inputs
- XSS prevention
- SQL/NoSQL injection prevention

### Rate Limiting
- Login endpoint: 10 requests per minute per IP
- Password reset: 3 requests per hour per email
- Registration: 5 requests per hour per IP
- General API: 100 requests per minute per user

### Audit Logging
- Log all authentication events (login, logout, password change)
- Log admin actions on user management
- Store IP address, user agent, timestamp
- Retain logs for 90 days

---

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Invalid credentials",
    "details": {}
  }
}
```

### Error Codes
- AUTH_001: Invalid credentials
- AUTH_002: Account locked
- AUTH_003: Account suspended
- AUTH_004: Email not verified
- AUTH_005: Token expired
- AUTH_006: Invalid token
- AUTH_007: Token revoked
- AUTH_008: Password requirements not met
- AUTH_009: User already exists
- AUTH_010: User not found
- AUTH_011: Rate limit exceeded
- AUTH_012: Invalid reset token
- AUTH_013: Reset token expired

---

## Testing Requirements

### Unit Tests
- Password hashing and comparison
- Token generation and validation
- Email verification logic
- Password reset flow
- Role and permission checks

### Integration Tests
- Registration flow end-to-end
- Login/logout flow
- Password reset flow
- Token refresh flow
- Admin user management operations

### Security Tests
- Brute force attack prevention
- Token tampering detection
- SQL/NoSQL injection attempts
- XSS attempt prevention
- Rate limiting effectiveness

### Performance Tests
- Concurrent login handling (1000 users)
- Token validation under load
- Database query optimization

---

## Performance Specifications

### Response Time Targets
- Login: < 200ms (p95)
- Token validation: < 50ms (p95)
- User profile fetch: < 100ms (p95)

### Scalability
- Support 10,000 concurrent users
- Horizontal scaling ready (stateless auth)
- Redis caching for frequently accessed user data

### Database Indexing
- Unique index on email
- Unique index on phone
- Unique index on referralCode
- Compound index on role + status
- TTL index on token collections

---

## Monitoring & Observability

### Metrics to Track
- Successful/failed login attempts
- Registration rate
- Password reset requests
- Token refresh rate
- Account lockouts
- Average response times

### Alerts
- Spike in failed login attempts (>100 in 5 min)
- High account lockout rate
- Unusual registration patterns
- Token validation failures

### Logging
- Structured JSON logging
- Correlation IDs for request tracing
- Sensitive data masking (passwords, tokens)

---

## Notifications

### Email Templates Required
1. Welcome Email (on registration)
2. Email Verification
3. Password Reset Request
4. Password Changed Successfully
5. Account Activated/Suspended
6. Login from New Device

### SMS Templates Required
1. OTP for Phone Verification (future)
2. Login Alert (optional)

---

## Environment Variables Required

```bash
# JWT Configuration
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30

# Email Service
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
EMAIL_FROM=noreply@coopfarming.com

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# Application
NODE_ENV=production
API_PREFIX=/api/v1
CORS_ORIGINS=https://app.coopfarming.com
```

---

## Implementation Checklist

- [ ] Set up NestJS project with TypeScript
- [ ] Configure Mongoose with MongoDB connection
- [ ] Create User schema and model
- [ ] Create Token schemas (RefreshToken, PasswordResetToken, EmailVerificationToken)
- [ ] Implement AuthModule with all guards and strategies
- [ ] Implement UserService with CRUD operations
- [ ] Implement AuthService with login, register, token management
- [ ] Create all DTOs with validation
- [ ] Implement JWT strategy and guards
- [ ] Implement RBAC guards and decorators
- [ ] Create email service integration
- [ ] Implement rate limiting
- [ ] Set up audit logging
- [ ] Write unit tests (80%+ coverage)
- [ ] Write integration tests
- [ ] Security penetration testing
- [ ] Performance testing
- [ ] API documentation with Swagger
- [ ] Deploy to staging environment
- [ ] Load testing
- [ ] Production deployment

---

## Dependencies

### Core Dependencies
- @nestjs/core, @nestjs/common, @nestjs/platform-express
- @nestjs/mongoose, mongoose
- @nestjs/jwt, @nestjs/passport, passport, passport-jwt
- @nestjs/config
- bcryptjs
- class-validator, class-transformer
- uuid
- @nestjs/swagger (for API docs)

### Optional Dependencies
- nodemailer (for email)
- twilio (for SMS)
- redis (for caching and rate limiting)
- winston (for logging)

---

## Future Enhancements

1. Multi-factor authentication (TOTP, SMS)
2. Social login (Google, Facebook, Apple)
3. Biometric authentication support
4. Session management dashboard for users
5. Advanced fraud detection
6. OAuth2 provider support
7. SSO integration capabilities
