# PRD 08: E-commerce Marketplace Module

## Overview
Agricultural products e-commerce marketplace for farmers to sell produce using NestJS and MongoDB.

## Database Schema

### Product Collection
```typescript
{
  _id: ObjectId;
  sellerId: ObjectId (ref: User);
  cooperativeId?: ObjectId (ref: Cooperative);
  name: string;
  slug: string (unique);
  description: string;
  category: {
    primary: ObjectId;
    subcategories: [ObjectId];
  };
  pricing: {
    unitPrice: number;
    currency: string;
    unit: string; // 'kg', 'bag', 'piece', etc.
    minOrderQuantity: number;
    bulkPricing?: [{ quantity: number; price: number }];
  };
  inventory: {
    available: number;
    reserved: number;
    lowStockThreshold: number;
  };
  images: [string];
  harvestDate?: Date;
  expiryDate?: Date;
  origin: { state: string; lga: string; farmName?: string };
  certifications?: [string]; // 'ORGANIC', 'GAP', etc.
  shippingOptions: [{ method: string; cost: number; durationDays: number }];
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
  rating: { average: number; count: number };
  totalSales: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Order Collection
```typescript
{
  _id: ObjectId;
  orderNumber: string (unique);
  buyerId: ObjectId (ref: User);
  items: [{
    productId: ObjectId;
    productName: string;
    sellerId: ObjectId;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }];
  pricing: {
    subtotal: number;
    shippingCost: number;
    platformFee: number;
    discount: number;
    total: number;
  };
  shippingAddress: {
    name: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    coordinates?: { lat: number; lng: number };
  };
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';
  fulfillmentStatus: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentData: { transactionRef: string; method: string; paidAt?: Date };
  trackingInfo?: { carrier: string; trackingNumber: string; updates: [{ status: string; location: string; timestamp: Date }] };
  deliveredAt?: Date;
  cancelledBy?: ObjectId;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

### Buyer Endpoints
- GET /api/v1/marketplace/products - Browse products
- POST /api/v1/marketplace/cart - Add to cart
- POST /api/v1/marketplace/orders - Place order
- GET /api/v1/marketplace/my-orders - Order history

### Seller Endpoints
- POST /api/v1/seller/products - Create product
- GET /api/v1/seller/products - Manage products
- GET /api/v1/seller/orders - Received orders
- PATCH /api/v1/seller/orders/:id/status - Update order status

## Environment Variables
```bash
ORDER_NUMBER_PREFIX=ORD
PLATFORM_FEE_PERCENT=5
LOW_STOCK_THRESHOLD=10
MAX_ORDER_DAYS_ADVANCE=60
```
