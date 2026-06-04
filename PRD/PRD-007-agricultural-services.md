# PRD-007: Agricultural Services Module

## Overview
This module manages agricultural service bookings including soil testing, farm mapping, precision agriculture, drone services, consultancy, equipment repairs, greenhouse design/construction, irrigation installation, data analytics, farm auditing, insurance, and training.

## Technology Stack
- **Framework**: NestJS v10+
- **Database**: MongoDB with Mongoose ODM
- **Payment Gateway**: SeerBit API for service payments
- **Scheduling**: Bull/BullMQ for appointment reminders
- **File Storage**: AWS S3/Cloudinary for reports and documents
- **Real-time Updates**: Socket.io for booking status changes

## Database Schema

### ServiceCategory Collection
```typescript
{
  _id: ObjectId,
  name: Enum [
    'Soil Testing',
    'Farm Mapping',
    'Precision Agriculture (IOT sensors)',
    'Drone Services',
    'Farm Consultancy',
    'Equipment Repairs',
    'Greenhouse Design',
    'Greenhouse Construction',
    'Irrigation Installation',
    'Data Analytics',
    'Farm Auditing',
    'Farm Insurance',
    'Agricultural Training'
  ],
  description: String,
  longDescription: String,
  pricePerUnit: Number, // in NGN
  unit: String, // e.g., "per sample", "per hectare", "per node", "per flight", "per hour", "per plan", "per project", "per course"
  category: String, // grouping for UI
  icon: String,
  images: [String],
  rating: Number (default: 0),
  totalReviews: Number (default: 0),
  totalBookings: Number (default: 0),
  averageCompletionTime: String, // e.g., "2-3 days", "1 week"
  requirements: [String], // what farmer needs to provide
  deliverables: [String], // what farmer receives
  isActive: Boolean,
  sortOrder: Number,
  metadata: {
    minArea: Number, // in hectares
    maxArea: Number,
    requiresSiteVisit: Boolean,
    certificationIncluded: Boolean,
    warrantyPeriod: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### ServiceProvider Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  companyName: String,
  contactPerson: String,
  email: String,
  phone: String,
  specialization: [ObjectId (ref: ServiceCategory)],
  serviceAreas: [{
    state: String,
    lgas: [String]
  }],
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String
  },
  coordinates: { lat: Number, lng: Number },
  businessRegistrationNumber: String,
  taxId: String,
  certifications: [{
    name: String,
    issuingBody: String,
    certificateNumber: String,
    expiryDate: Date,
    documentUrl: String
  }],
  insurance: {
    provider: String,
    policyNumber: String,
    coverageAmount: Number,
    expiryDate: Date
  },
  rating: Number (default: 0),
  totalJobsCompleted: Number (default: 0),
  responseTime: Number, // in hours
  verificationStatus: Enum ['pending', 'verified', 'rejected'],
  status: Enum ['active', 'suspended', 'inactive'],
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  portfolio: [String], // URLs to past work
  createdAt: Date,
  updatedAt: Date
}
```

### ServiceBooking Collection
```typescript
{
  _id: ObjectId,
  bookingReference: String (unique),
  userId: ObjectId (ref: User),
  farmerName: String,
  farmerEmail: String,
  farmerPhone: String,
  farmerLocation: {
    address: String,
    state: String,
    lga: String,
    coordinates: { lat: Number, lng: Number }
  },
  serviceId: ObjectId (ref: ServiceCategory),
  serviceName: String,
  providerId: ObjectId (ref: ServiceProvider),
  providerName: String,
  assignedExpert: String,
  expertPhone: String,
  quantity: Number, // based on unit (hectares, samples, hours, etc.)
  totalCost: Number,
  notes: String,
  specificRequirements: String,
  preferredDate: Date,
  scheduledDate: Date,
  startTime: String,
  endTime: String,
  actualStartDate: Date,
  actualEndDate: Date,
  status: Enum [
    'pending',
    'confirmed',
    'assigned',
    'in_progress',
    'awaiting_farmer_input',
    'report_generation',
    'completed',
    'cancelled',
    'disputed'
  ],
  paymentStatus: Enum ['unpaid', 'paid', 'partially_refunded', 'fully_refunded'],
  paymentMethod: Enum ['wallet', 'card', 'bank_transfer'],
  paymentId: ObjectId (ref: WalletTransaction),
  siteVisitRequired: Boolean,
  siteVisitDate: Date,
  siteVisitReport: String,
  deliverables: [{
    type: String, // "report", "map", "design", "certificate", etc.
    title: String,
    url: String,
    uploadedAt: Date,
    fileSize: Number
  }],
  farmerRating: Number,
  farmerReview: String,
  providerResponse: String,
  cancellationReason: String,
  cancelledBy: String,
  refundAmount: Number,
  disputeDetails: {
    reason: String,
    description: String,
    images: [String],
    status: Enum ['open', 'under_review', 'resolved', 'closed'],
    resolvedBy: ObjectId (ref: User),
    resolution: String,
    resolvedAt: Date
  },
  metadata: {
    soilSamplesCollected: Number,
    areaCovered: Number, // hectares
    sensorNodesInstalled: Number,
    flightDuration: Number, // minutes
    reportPages: Number,
    trainingAttendees: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### ServiceReview Collection
```typescript
{
  _id: ObjectId,
  bookingId: ObjectId (ref: ServiceBooking),
  serviceId: ObjectId (ref: ServiceCategory),
  providerId: ObjectId (ref: ServiceProvider),
  userId: ObjectId (ref: User),
  farmerName: String,
  rating: Number, // 1-5
  reviewTitle: String,
  reviewComment: String,
  pros: [String],
  cons: [String],
  wouldRecommend: Boolean,
  images: [String],
  providerResponse: {
    comment: String,
    respondedAt: Date
  },
  helpful: Number,
  verified: Boolean, // verified purchase
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Service Categories
- `GET /api/v1/services/categories` - List all service categories
- `GET /api/v1/services/categories/:id` - Get category details
- `POST /api/v1/services/categories` - Create category (admin only)
- `PATCH /api/v1/services/categories/:id` - Update category (admin only)
- `DELETE /api/v1/services/categories/:id` - Deactivate category (admin only)

### Service Providers
- `GET /api/v1/services/providers` - List service providers
- `GET /api/v1/services/providers/:id` - Get provider profile
- `GET /api/v1/services/providers/available` - Get available providers by service
- `POST /api/v1/services/providers/register` - Register as provider
- `PATCH /api/v1/services/providers/:id` - Update provider profile
- `GET /api/v1/services/providers/:id/reviews` - Get provider reviews

### Service Bookings
- `POST /api/v1/services/bookings` - Create service booking
- `GET /api/v1/services/bookings` - Get user's bookings
- `GET /api/v1/services/bookings/:id` - Get booking details
- `PATCH /api/v1/services/bookings/:id` - Update booking
- `POST /api/v1/services/bookings/:id/confirm` - Confirm booking
- `POST /api/v1/services/bookings/:id/cancel` - Cancel booking
- `POST /api/v1/services/bookings/:id/complete` - Mark complete (provider)
- `POST /api/v1/services/bookings/:id/rate` - Submit review
- `POST /api/v1/services/bookings/:id/dispute` - Raise dispute

### Quotes & Estimates
- `POST /api/v1/services/quote` - Get service quote
- `GET /api/v1/services/pricing` - Get pricing information

### Reviews
- `GET /api/v1/services/reviews` - Get all reviews (with filters)
- `GET /api/v1/services/reviews/:id` - Get specific review
- `POST /api/v1/services/reviews/:id/helpful` - Mark review helpful

### Admin Operations
- `GET /api/v1/services/admin/bookings` - Get all bookings
- `GET /api/v1/services/admin/statistics` - Get service statistics
- `POST /api/v1/services/admin/verify-provider/:id` - Verify provider
- `POST /api/v1/services/admin/resolve-dispute/:id` - Resolve dispute
- `GET /api/v1/services/admin/revenue-report` - Get revenue report

## Business Logic

### Booking Flow

#### Step 1: Service Selection
1. User browses service categories
2. Selects desired service
3. Views pricing, requirements, deliverables
4. Enters project details (area size, location, specifics)

#### Step 2: Quote Calculation
```
Base Cost = Price Per Unit × Quantity
Complexity Multiplier = 1.0 (standard) to 2.0 (complex)
Travel Cost = Distance-based if site visit required
Total = (Base Cost × Complexity Multiplier) + Travel Cost
```

#### Step 3: Provider Assignment
- Auto-assign based on:
  - Availability
  - Proximity to farmer
  - Specialization match
  - Rating threshold (>4.0)
  - Response time
- Manual selection option for premium services

#### Step 4: Payment
- Full payment upfront for services < ₦50,000
- 50% deposit for services ≥ ₦50,000
- Milestone-based payments for large projects

#### Step 5: Service Delivery
1. Provider contacts farmer to schedule
2. Site visit if required
3. Service execution
4. Progress updates
5. Deliverable submission
6. Farmer review and approval

#### Step 6: Completion
1. Final payment (if deposit was paid)
2. Deliverables handed over
3. Farmer rates service
4. Provider paid (minus platform commission)

### Pricing by Service Category

| Service | Unit | Base Price (NGN) |
|---------|------|------------------|
| Soil Testing | per sample | 15,000 |
| Farm Mapping | per hectare | 5,000 |
| Precision Agriculture (IoT) | per node | 25,000 |
| Drone Services | per flight hour | 50,000 |
| Farm Consultancy | per hour | 10,000 |
| Equipment Repairs | per hour + parts | 8,000 |
| Greenhouse Design | per plan | 150,000 |
| Greenhouse Construction | per square meter | 25,000 |
| Irrigation Installation | per hectare | 200,000 |
| Data Analytics | per report | 75,000 |
| Farm Auditing | per audit | 100,000 |
| Farm Insurance | annual premium | varies |
| Agricultural Training | per participant/day | 15,000 |

### Commission Structure
- Platform commission: 15% of service value
- Provider receives: 85%
- Platinum providers: 90% (reduced commission)
- Dispute refunds: Commission returned

### Cancellation Policy
- > 48 hours before: Full refund
- 24-48 hours before: 50% refund
- < 24 hours before: No refund
- Provider cancellation: Full refund + credit voucher

### Review System
- Only verified bookings can leave reviews
- Rating scale: 1-5 stars
- Review moderation for inappropriate content
- Provider response window: 7 days
- Helpful vote system for review ranking

## Scheduled Jobs (BullMQ)

### Appointment Reminders
- Run every hour
- Send reminders for appointments tomorrow
- Send preparation instructions

### Payment Follow-ups
- Run daily
- Identify bookings with pending balance
- Send payment reminders

### Review Requests
- Run 24 hours after completion
- Prompt farmers to leave reviews
- Second reminder after 3 days

### Provider Performance Reports
- Run weekly
- Generate performance metrics
- Identify underperforming providers

### Subscription Expiry Alerts
- Run monthly
- Alert providers with expiring certifications
- Alert for insurance renewal

## Security Requirements
- Authentication for bookings
- Provider verification (KYC + business registration)
- Secure file uploads
- Payment security (PCI DSS)
- Data privacy for farmer information
- Fraud detection

## Error Handling
- Double booking prevention
- Provider unavailability handling
- Payment failure recovery
- Service quality disputes
- Force majeure policies

## Testing Requirements
- Unit tests for pricing calculations
- Integration tests for booking flow
- E2E tests for service lifecycle
- Provider matching algorithm tests
- Minimum 85% code coverage

## Performance Requirements
- Booking creation < 500ms
- Provider search < 200ms
- Support 300 concurrent bookings
- File upload < 5 seconds

## Monitoring & Logging
- Booking conversion rates
- Provider performance metrics
- Customer satisfaction scores
- Revenue analytics by category
- Dispute frequency tracking

## Notifications
- Booking confirmation
- Provider assignment
- Appointment reminders
- Payment receipts
- Deliverable ready alerts
- Review requests
- Dispute updates
