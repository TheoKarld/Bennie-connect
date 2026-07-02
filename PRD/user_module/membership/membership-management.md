# PRD 03: Membership Management Module

## Overview
Enterprise-grade membership management system for cooperative farming members using NestJS and MongoDB.

---

## Database Schema

### Membership Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User, unique, indexed);
  membershipNumber: string (unique);
  cooperativeId: ObjectId (ref: Cooperative, indexed);
  status: 'PENDING' | 'PROBATION' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'RESIGNED';
  type: 'REGULAR' | 'ASSOCIATE' | 'SENIOR' | 'LIFETIME';
  joinedAt: Date;
  probationEndsAt?: Date;
  expiresAt?: Date;
  renewalCount: number;
  sharesOwned: number;
  votingRights: boolean;
  eligibility: {
    loans: boolean;
    dividends: boolean;
    equipmentBooking: boolean;
    training: boolean;
    marketAccess: boolean;
  };
  dues: {
    registrationFee: number;
    annualDue: number;
    lastPaidAt?: Date;
    nextDueDate?: Date;
    outstandingBalance: number;
  };
  documents: [{
    type: string; // 'ID_CARD', 'APPLICATION_FORM', 'GUARANTOR_FORM', etc.
    url: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    uploadedAt: Date;
    verifiedBy?: ObjectId;
    verifiedAt?: Date;
  }];
  guarantors?: [{
    userId: ObjectId (ref: User);
    relationship: string;
    contactPhone: string;
    verifiedAt?: Date;
  }];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Cooperative Collection
```typescript
{
  _id: ObjectId;
  name: string;
  code: string (unique);
  description: string;
  type: 'MULTI_PURPOSE' | 'CREDIT' | 'AGRICULTURAL' | 'CONSUMER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  registrationNumber: string;
  registeredDate: Date;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    coordinates?: { lat: number; lng: number }
  };
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };
  leadership: {
    chairman?: ObjectId (ref: User);
    secretary?: ObjectId (ref: User);
    treasurer?: ObjectId (ref: User);
  };
  membershipSettings: {
    minAge: number;
    maxAge?: number;
    registrationFee: number;
    annualDue: number;
    sharePrice: number;
    minShares: number;
    maxShares?: number;
    probationPeriodDays: number;
    requiresGuarantor: boolean;
    guarantorCount: number;
  };
  totalMembers: number;
  activeMembers: number;
  logo?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### MembershipApplication Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User);
  cooperativeId: ObjectId (ref: Cooperative);
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  applicationData: {
    occupation: string;
    monthlyIncome: number;
    farmSize?: number;
    farmLocation?: string;
    yearsOfExperience?: number;
    reasonForJoining: string;
  };
  submittedAt: Date;
  reviewedBy?: ObjectId (ref: User);
  reviewedAt?: Date;
  rejectionReason?: string;
  approvalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## API Endpoints

### Member Endpoints

#### GET /api/v1/membership/my-membership
**Description:** Get current user's membership details
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### POST /api/v1/membership/apply
**Description:** Submit membership application
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "cooperativeId": "coop_id",
  "applicationData": {
    "occupation": "Farmer",
    "monthlyIncome": 150000,
    "farmSize": 5,
    "farmLocation": "Ogun State",
    "yearsOfExperience": 3,
    "reasonForJoining": "To access cooperative benefits"
  }
}
```
**Response:** 201 Created

#### PUT /api/v1/membership/renew
**Description:** Renew membership
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### POST /api/v1/membership/resign
**Description:** Resign from cooperative
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "reason": "Relocating to another state"
}
```
**Response:** 200 OK

### Admin/Cooperative Manager Endpoints

#### GET /api/v1/admin/memberships
**Description:** List all memberships
**Headers:** Authorization: Bearer <token>
**Query Params:** page, limit, status, type, cooperativeId
**Response:** 200 OK

#### GET /api/v1/admin/memberships/:id
**Description:** Get membership details
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### PATCH /api/v1/admin/memberships/:id/status
**Description:** Update membership status
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "status": "ACTIVE",
  "reason": "Probation completed successfully"
}
```
**Response:** 200 OK

#### GET /api/v1/admin/membership-applications
**Description:** List membership applications
**Headers:** Authorization: Bearer <token>
**Query Params:** page, limit, status, cooperativeId
**Response:** 200 OK

#### POST /api/v1/admin/membership-applications/:id/approve
**Description:** Approve membership application
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "notes": "Welcome to the cooperative"
}
```
**Response:** 200 OK

#### POST /api/v1/admin/membership-applications/:id/reject
**Description:** Reject membership application
**Headers:** Authorization: Bearer <token>
**Request Body:**
```json
{
  "reason": "Incomplete documentation"
}
```
**Response:** 200 OK

#### GET /api/v1/admin/cooperatives
**Description:** List all cooperatives
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

#### POST /api/v1/admin/cooperatives
**Description:** Create new cooperative
**Headers:** Authorization: Bearer <token>
**Response:** 201 Created

#### PUT /api/v1/admin/cooperatives/:id
**Description:** Update cooperative details
**Headers:** Authorization: Bearer <token>
**Response:** 200 OK

---

## Business Logic

### Membership Lifecycle
1. Application submission
2. Document verification
3. Background check (optional)
4. Approval/Rejection
5. Probation period (if applicable)
6. Active membership
7. Renewal (annual)
8. Termination/Resignation

### Dues Management
- Registration fee: One-time payment on approval
- Annual due: Payable every anniversary
- Grace period: 30 days after due date
- Late penalty: 5% per month
- Suspension after 90 days overdue

### Share Ownership
- Minimum shares required for membership
- Additional shares can be purchased
- Shares earn dividends annually
- Shares can be withdrawn on resignation (subject to rules)

---

## Security Requirements
- Role-based access control
- Audit logging for all status changes
- Document encryption at rest
- Multi-level approval for sensitive operations

---

## Environment Variables
```bash
MEMBERSHIP_NUMBER_PREFIX=MBR
DEFAULT_PROBATION_DAYS=90
LATE_FEE_PERCENTAGE=5
GRACE_PERIOD_DAYS=30
```
