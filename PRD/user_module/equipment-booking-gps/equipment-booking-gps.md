# PRD 06: Equipment Booking with GPS Tracking Module

## Overview
Agricultural equipment booking and rental system with real-time GPS tracking using NestJS and MongoDB.

## Database Schema

### Equipment Collection
```typescript
{
  _id: ObjectId;
  cooperativeId: ObjectId (ref: Cooperative);
  name: string;
  category: 'TRACTOR' | 'HARVESTER' | 'PLANTER' | 'SPRAYER' | 'IRRIGATION' | 'OTHER';
  model: string;
  serialNumber: string;
  yearOfManufacture: number;
  status: 'AVAILABLE' | 'BOOKED' | 'MAINTENANCE' | 'RETIRED';
  hourlyRate: number;
  dailyRate: number;
  depositRequired: number;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  gpsTracker: {
    deviceId: string;
    isActive: boolean;
    lastUpdateAt?: Date;
  };
  specifications: Record<string, any>;
  images: [string];
  maintenanceSchedule: [{
    type: string;
    dueDate: Date;
    completedAt?: Date;
    notes: string;
  }];
  bookingHistory: number; // Total bookings count
  createdAt: Date;
  updatedAt: Date;
}
```

### EquipmentBooking Collection
```typescript
{
  _id: ObjectId;
  equipmentId: ObjectId (ref: Equipment);
  userId: ObjectId (ref: User);
  bookingReference: string (unique);
  startDate: Date;
  endDate: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  status: 'PENDING' | 'CONFIRMED' | 'IN_USE' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
  totalCost: number;
  depositPaid: number;
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID';
  pickupLocation: { lat: number; lng: number; address: string };
  returnLocation: { lat: number; lng: number; address: string };
  operator?: ObjectId (ref: User); // If equipment requires operator
  notes?: string;
  cancellationReason?: string;
  damageReport?: {
    description: string;
    costEstimate: number;
    deductedFromDeposit: number;
  };
  gpsTracking: [{
    timestamp: Date;
    lat: number;
    lng: number;
    speed?: number;
  }];
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

### User Endpoints
- GET /api/v1/equipment - List available equipment
- GET /api/v1/equipment/:id - Equipment details
- POST /api/v1/equipment/bookings - Create booking
- GET /api/v1/equipment/my-bookings - User's bookings
- POST /api/v1/equipment/bookings/:id/cancel - Cancel booking
- GET /api/v1/equipment/bookings/:id/tracking - Live GPS tracking

### Admin Endpoints
- POST /api/v1/admin/equipment - Add equipment
- PUT /api/v1/admin/equipment/:id - Update equipment
- GET /api/v1/admin/equipment/bookings - All bookings
- POST /api/v1/admin/equipment/bookings/:id/confirm - Confirm booking
- POST /api/v1/admin/equipment/bookings/:id/complete - Complete booking
- POST /api/v1/admin/equipment/:id/maintenance - Schedule maintenance

## Business Logic

### Booking Flow
1. Search available equipment by date/category
2. Check availability and conflicts
3. Calculate cost (hourly/daily rates)
4. Require deposit payment
5. Admin confirmation (optional auto-confirm)
6. Equipment handover with checklist
7. GPS tracking during usage
8. Return inspection
9. Deposit refund/deduction

### GPS Tracking
- Real-time location updates every 30 seconds
- Geofencing alerts for unauthorized areas
- Speed monitoring
- Usage hour logging
- Historical route playback

## Environment Variables
```bash
EQUIPMENT_BOOKING_PREFIX=EQB
GPS_UPDATE_INTERVAL_SECONDS=30
GEOFENCE_ALERT_ENABLED=true
MAX_BOOKING_DAYS=30
DEPOSIT_PERCENTAGE=20
```
