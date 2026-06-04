# PRD-006: Equipment Booking Module

## Overview
This module manages agricultural equipment rental and booking including tractors, harvesters, planters, irrigation systems, drone sprayers, and transport trucks with scheduling, GPS tracking, and operator management.

## Technology Stack
- **Framework**: NestJS v10+
- **Database**: MongoDB with Mongoose ODM
- **Real-time Tracking**: Socket.io for GPS location updates
- **Maps Integration**: Google Maps API / Mapbox for location services
- **Scheduling**: Bull/BullMQ for booking reminders
- **File Storage**: AWS S3/Cloudinary for equipment images and evidence

## Database Schema

### Equipment Collection
```typescript
{
  _id: ObjectId,
  name: String,
  category: Enum ['Tractors', 'Harvesters', 'Planters', 'Threshers', 'Irrigation Systems', 'Drone Sprayers', 'Fertigation Drones', 'Transport Trucks'],
  model: String,
  manufacturer: String,
  yearOfManufacture: Number,
  registrationNumber: String,
  plateNumber: String,
  capacity: String, // e.g., "50HP", "10 hectares/day"
  hourlyRate: Number,
  dailyRate: Number,
  weeklyRate: Number,
  depositAmount: Number,
  status: Enum ['available', 'booked', 'in_use', 'maintenance', 'retired'],
  currentLocation: {
    type: String (default: "Point"),
    coordinates: [Number] // [longitude, latitude]
  },
  homeBase: {
    address: String,
    state: String,
    lga: String,
    coordinates: { lat: Number, lng: Number }
  },
  images: [String],
  specifications: {
    engineType: String,
    fuelType: String,
    weight: Number,
    dimensions: String,
    features: [String]
  },
  maintenanceSchedule: {
    lastServiceDate: Date,
    nextServiceDate: Date,
    serviceIntervalHours: Number,
    totalOperatingHours: Number
  },
  insurance: {
    provider: String,
    policyNumber: String,
    expiryDate: Date,
    coverageAmount: Number
  },
  rating: Number (default: 0),
  totalBookings: Number (default: 0),
  createdAt: Date,
  updatedAt: Date
}
```

### EquipmentOperator Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  employeeId: String,
  firstName: String,
  lastName: String,
  phone: String,
  email: String,
  licenseNumber: String,
  licenseType: String,
  licenseExpiry: Date,
  specializedEquipment: [ObjectId (ref: Equipment)],
  yearsOfExperience: Number,
  rating: Number (default: 0),
  totalJobsCompleted: Number (default: 0),
  status: Enum ['active', 'on_leave', 'suspended', 'terminated'],
  currentAssignment: ObjectId (ref: AgriBooking),
  homeBase: {
    state: String,
    lga: String
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  certificationDocuments: [String],
  createdAt: Date,
  updatedAt: Date
}
```

### AgriBooking Collection
```typescript
{
  _id: ObjectId,
  bookingReference: String (unique),
  userId: ObjectId (ref: User),
  farmerName: String,
  farmerPhone: String,
  farmerLocation: {
    address: String,
    state: String,
    lga: String,
    coordinates: { lat: Number, lng: Number }
  },
  equipmentId: ObjectId (ref: Equipment),
  equipmentName: String,
  equipmentCategory: String,
  operatorId: ObjectId (ref: EquipmentOperator),
  operatorName: String,
  operatorPhone: String,
  serviceType: Enum ['plowing', 'harrowing', 'planting', 'harvesting', 'spraying', 'irrigation', 'transport'],
  acreage: Number, // in hectares
  cropType: String,
  bookingDate: Date,
  startDate: Date,
  endDate: Date,
  estimatedDuration: Number, // in hours/days
  actualStartDate: Date,
  actualEndDate: Date,
  status: Enum ['pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed'],
  pricing: {
    hourlyRate: Number,
    dailyRate: Number,
    estimatedHours: Number,
    estimatedCost: Number,
    actualHours: Number,
    actualCost: Number,
    depositPaid: Number,
    balanceDue: Number,
    totalPaid: Number,
    discountApplied: Number,
    finalAmount: Number
  },
  paymentStatus: Enum ['unpaid', 'deposit_paid', 'partially_paid', 'fully_paid', 'refunded'],
  depositPaymentId: ObjectId (ref: WalletTransaction),
  finalPaymentId: ObjectId (ref: WalletTransaction),
  distanceInKm: Number,
  travelCost: Number,
  notes: String,
  specialInstructions: String,
  gpsTrack: [{
    timestamp: Date,
    latitude: Number,
    longitude: Number,
    speed: Number,
    altitude: Number
  }],
  completionEvidence: {
    comment: String,
    images: [String],
    videoUrl: String,
    completedAt: Date,
    verifiedBy: ObjectId (ref: User)
  },
  farmerRating: Number,
  farmerRatingComment: String,
  operatorRating: Number,
  operatorRatingComment: String,
  cancellationReason: String,
  cancelledBy: String,
  disputeDetails: {
    reason: String,
    description: String,
    images: [String],
    status: Enum ['open', 'under_review', 'resolved', 'closed'],
    resolvedBy: ObjectId (ref: User),
    resolution: String,
    resolvedAt: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### BookingAvailability Collection
```typescript
{
  _id: ObjectId,
  equipmentId: ObjectId (ref: Equipment),
  date: Date,
  timeSlots: [{
    startTime: String, // "08:00"
    endTime: String, // "18:00"
    isAvailable: Boolean,
    bookedBy: ObjectId (ref: AgriBooking)
  }],
  blackoutDates: [Date],
  maintenanceScheduled: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Equipment Management
- `GET /api/v1/equipment` - List all equipment (with filters)
- `GET /api/v1/equipment/:id` - Get equipment details
- `GET /api/v1/equipment/categories` - Get equipment categories
- `GET /api/v1/equipment/available` - Get available equipment for date range
- `POST /api/v1/equipment` - Add new equipment (admin only)
- `PATCH /api/v1/equipment/:id` - Update equipment (admin only)
- `DELETE /api/v1/equipment/:id` - Retire equipment (admin only)
- `POST /api/v1/equipment/:id/maintenance` - Schedule maintenance

### Operators
- `GET /api/v1/operators` - List all operators
- `GET /api/v1/operators/:id` - Get operator details
- `GET /api/v1/operators/available` - Get available operators
- `POST /api/v1/operators` - Add new operator (admin only)
- `PATCH /api/v1/operators/:id` - Update operator (admin only)

### Booking Management
- `POST /api/v1/bookings` - Create new booking
- `GET /api/v1/bookings` - Get user's bookings
- `GET /api/v1/bookings/:id` - Get specific booking details
- `PATCH /api/v1/bookings/:id` - Update booking
- `POST /api/v1/bookings/:id/confirm` - Confirm booking
- `POST /api/v1/bookings/:id/cancel` - Cancel booking
- `POST /api/v1/bookings/:id/assign-operator` - Assign operator (admin only)
- `POST /api/v1/bookings/:id/start` - Start booking (operator)
- `POST /api/v1/bookings/:id/complete` - Complete booking (operator)
- `POST /api/v1/bookings/:id/rate` - Rate completed service
- `POST /api/v1/bookings/:id/dispute` - Raise dispute

### GPS Tracking
- `GET /api/v1/bookings/:id/tracking` - Get live equipment location
- `POST /api/v1/bookings/:id/location` - Update location (operator device)
- `GET /api/v1/bookings/:id/history` - Get GPS track history

### Pricing & Quotes
- `POST /api/v1/bookings/quote` - Get price estimate
- `GET /api/v1/bookings/pricing-rules` - Get pricing rules

### Admin Operations
- `GET /api/v1/bookings/admin/all` - Get all bookings (admin)
- `GET /api/v1/bookings/admin/statistics` - Get booking statistics
- `POST /api/v1/bookings/admin/resolve-dispute/:id` - Resolve dispute
- `GET /api/v1/bookings/admin/revenue-report` - Get revenue report

## Business Logic

### Booking Flow

#### Step 1: Equipment Selection
1. User selects equipment category and type
2. System shows available equipment with rates
3. User enters service details (acreage, location, dates)
4. System calculates estimated cost

#### Step 2: Quote Generation
```
Base Cost = (Daily Rate × Estimated Days) OR (Hourly Rate × Estimated Hours)
Travel Cost = Distance (km) × ₦200/km
Subtotal = Base Cost + Travel Cost
Deposit = Subtotal × 30%
Estimated Total = Subtotal
```

#### Step 3: Booking Creation
1. User reviews quote
2. User pays deposit via SeerBit/wallet
3. Booking created with status 'pending'
4. Confirmation sent to user

#### Step 4: Operator Assignment
1. Admin/system assigns available operator
2. Operator notified of assignment
3. Operator can accept/decline
4. Booking status updated to 'assigned'

#### Step 5: Service Delivery
1. Operator travels to farm location
2. GPS tracking activated
3. Operator starts job via mobile app
4. Real-time progress updates
5. Job completion with evidence upload
6. Farmer inspection and approval

#### Step 6: Payment & Rating
1. Final cost calculated based on actual hours
2. Balance payment requested
3. Farmer rates service
4. Operator rates farmer (optional)
5. Booking marked complete

### Pricing Rules

#### Base Rates by Category
- Tractors: ₦15,000/hour or ₦100,000/day
- Harvesters: ₦25,000/hour or ₦175,000/day
- Planters: ₦12,000/hour or ₦80,000/day
- Threshers: ₦10,000/hour or ₦70,000/day
- Irrigation Systems: ₦8,000/hour or ₦50,000/day
- Drone Sprayers: ₦20,000/hour or ₦150,000/day
- Transport Trucks: ₦30,000/hour or ₦200,000/day

#### Acreage-Based Estimates
- Plowing: 2 hectares/hour
- Harrowing: 3 hectares/hour
- Planting: 4 hectares/hour
- Harvesting: 1.5 hectares/hour
- Spraying: 5 hectares/hour

#### Travel Cost
- First 10km: Free
- Beyond 10km: ₦200/km
- Interstate: ₦500/km + accommodation if multi-day

### Cancellation Policy
- > 7 days before: Full refund
- 3-7 days before: 50% refund of deposit
- < 3 days before: No refund
- Operator cancellation: Full refund + 10% credit

### GPS Tracking Features
- Real-time location updates every 30 seconds
- Geofencing alerts (equipment leaving assigned area)
- Speed monitoring
- Operating hours tracking
- Route optimization
- Historical playback

### Maintenance Scheduling
- Automatic alerts based on operating hours
- Preventive maintenance every 250 hours
- Post-booking inspection checklist
- Downtime tracking
- Maintenance cost logging

## Scheduled Jobs (BullMQ)

### Booking Reminders
- Run every hour
- Send reminders for bookings starting tomorrow
- Send preparation instructions

### Equipment Availability Update
- Run every day at midnight
- Update availability based on completed bookings
- Release unconfirmed holds after 24 hours

### Maintenance Alerts
- Run weekly
- Check equipment approaching service interval
- Schedule maintenance windows

### Payment Follow-ups
- Run daily
- Identify bookings with pending balance
- Send payment reminders

### Rating Reminders
- Run 24 hours after booking completion
- Prompt farmers to rate service
- Second reminder after 3 days if not rated

## Real-time Features (Socket.io)
- Live GPS tracking during service
- Booking status updates
- Operator arrival notifications
- Emergency alerts
- Chat between farmer and operator

## Security Requirements
- Authentication required for all bookings
- Operator background verification
- Equipment insurance validation
- GPS data encryption
- Payment security (PCI DSS)
- Fraud detection for suspicious bookings

## Error Handling
- Double booking prevention
- Equipment breakdown contingency
- Operator no-show protocol
- Payment failure handling
- Weather-related cancellations
- Dispute resolution workflow

## Testing Requirements
- Unit tests for pricing calculations
- Integration tests for booking flow
- E2E tests for complete service lifecycle
- GPS tracking simulation tests
- Load testing for concurrent bookings
- Minimum 85% code coverage

## Performance Requirements
- Booking creation < 500ms
- GPS update processing < 100ms
- Support 200 concurrent bookings
- Real-time tracking latency < 1 second

## Monitoring & Logging
- Booking conversion funnel
- Equipment utilization rates
- Operator performance metrics
- Revenue analytics
- Customer satisfaction scores
- Incident tracking

## Notifications
- Booking confirmation
- Operator assignment
- Operator en-route
- Service start/end reminders
- Payment receipts
- Rating requests
- Maintenance alerts
