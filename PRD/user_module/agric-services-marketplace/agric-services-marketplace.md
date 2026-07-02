# PRD 07: Agricultural Services Marketplace Module

## Overview
Marketplace for agricultural services connecting farmers with service providers using NestJS and MongoDB.

## Database Schema

### ServiceCategory Collection
```typescript
{
  _id: ObjectId;
  name: string;
  slug: string (unique);
  description: string;
  icon: string;
  parentCategoryId?: ObjectId (ref: ServiceCategory);
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
}
```

### ServiceProvider Collection
```typescript
{
  _id: ObjectId;
  userId: ObjectId (ref: User);
  businessName: string;
  categoryIds: [ObjectId];
  description: string;
  serviceAreas: [{ state: string; lga: string }];
  rating: { average: number; count: number };
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  documents: [{ type: string; url: string; status: string }];
  workingHours: { days: string[]; startTime: string; endTime: string };
  contactInfo: { phone: string; email: string; address: string };
  bankDetails: { accountNumber: string; bankName: string };
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### ServiceListing Collection
```typescript
{
  _id: ObjectId;
  providerId: ObjectId (ref: ServiceProvider);
  title: string;
  description: string;
  categoryId: ObjectId (ref: ServiceCategory);
  pricingType: 'FIXED' | 'HOURLY' | 'PER_UNIT' | 'NEGOTIABLE';
  price: number;
  unit: string; // 'hour', 'acre', 'item', etc.
  images: [string];
  duration?: number; // Estimated duration in minutes
  isAvailable: boolean;
  bookingSettings: { minAdvanceHours: number; maxBookingsPerDay: number };
  totalBookings: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### ServiceBooking Collection
```typescript
{
  _id: ObjectId;
  listingId: ObjectId (ref: ServiceListing);
  customerId: ObjectId (ref: User);
  providerId: ObjectId (ref: ServiceProvider);
  bookingReference: string (unique);
  scheduledDate: Date;
  scheduledTime: string;
  location: { lat: number; lng: number; address: string };
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  totalAmount: number;
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED';
  notes?: string;
  completionNotes?: string;
  rating?: { score: number; comment: string; createdAt: Date };
  cancelledBy?: ObjectId;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

### Customer Endpoints
- GET /api/v1/services - Search services
- GET /api/v1/services/:id - Service details
- POST /api/v1/services/bookings - Book a service
- GET /api/v1/services/my-bookings - Customer's bookings
- POST /api/v1/services/bookings/:id/rate - Rate completed service

### Provider Endpoints
- POST /api/v1/provider/profile - Create/update provider profile
- POST /api/v1/provider/listings - Create service listing
- GET /api/v1/provider/listings - Provider's listings
- GET /api/v1/provider/bookings - Provider's bookings
- PATCH /api/v1/provider/bookings/:id/status - Update booking status

## Business Logic

### Booking Flow
1. Customer searches/browses services
2. Selects service and provides details
3. Payment held in escrow
4. Provider confirms booking
5. Service delivery
6. Customer confirmation
7. Funds released to provider (minus commission)
8. Rating and review

### Commission Model
- Platform commission: 10-15% per transaction
- Released after successful completion
- Refund policy for disputes

## Environment Variables
```bash
SERVICE_BOOKING_PREFIX=SRB
PLATFORM_COMMISSION_PERCENT=12
ESCROW_RELEASE_DAYS=3
MAX_ADVANCE_BOOKING_DAYS=90
```
