# PRD-008: Agricultural Marketplace Module

## Overview
This module manages the agricultural e-commerce marketplace for buying and selling farm inputs (seeds, fertilizers, agrochemicals, equipment, livestock inputs, irrigation equipment, greenhouse materials) and farm produce with cart management, order processing, inventory tracking, and merchant management.

## Technology Stack
- **Framework**: NestJS v10+
- **Database**: MongoDB with Mongoose ODM
- **Payment Gateway**: SeerBit API for order payments
- **Search Engine**: Elasticsearch/Meilisearch for product search
- **File Storage**: AWS S3/Cloudinary for product images
- **Real-time Updates**: Socket.io for order status changes

## Database Schema

### Merchant Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  businessName: String,
  businessType: Enum ['individual', 'registered_business', 'cooperative', 'manufacturer'],
  rcNumber: String, // Business registration number
  taxId: String,
  contactPerson: String,
  email: String,
  phone: String,
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String
  },
  warehouseLocations: [{
    name: String,
    address: String,
    coordinates: { lat: Number, lng: Number }
  }],
  categories: [ObjectId (ref: ProductCategory)],
  rating: Number (default: 0),
  totalReviews: Number (default: 0),
  totalOrders: Number (default: 0),
  responseRate: Number, // percentage
  responseTime: Number, // in hours
  verificationStatus: Enum ['pending', 'verified', 'rejected'],
  status: Enum ['active', 'suspended', 'inactive'],
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  commissionRate: Number, // default 10%
  payoutThreshold: Number, // minimum payout amount
  lastPayoutDate: Date,
  totalEarnings: Number,
  pendingBalance: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### ProductCategory Collection
```typescript
{
  _id: ObjectId,
  name: Enum [
    'Seeds',
    'Fertilizers',
    'Agrochemicals',
    'Farm Equipment',
    'Livestock Inputs',
    'Irrigation Equipment',
    'Greenhouse Materials',
    'Farm Produce'
  ],
  slug: String (unique),
  description: String,
  parentCategoryId: ObjectId (ref: ProductCategory),
  level: Number, // 1 = top level, 2 = subcategory
  icon: String,
  image: String,
  attributes: [{
    name: String,
    type: Enum ['text', 'number', 'select', 'multiselect'],
    options: [String],
    required: Boolean
  }],
  isActive: Boolean,
  sortOrder: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Product Collection
```typescript
{
  _id: ObjectId,
  merchantId: ObjectId (ref: Merchant),
  merchantName: String,
  name: String,
  slug: String,
  description: String,
  longDescription: String,
  categoryIds: [ObjectId (ref: ProductCategory)],
  primaryCategory: ObjectId (ref: ProductCategory),
  price: Number, // in NGN
  compareAtPrice: Number, // original price for discounts
  costPrice: Number, // merchant's cost
  unit: String, // e.g., "50kg Bag", "Litre", "Unit", "Packet", "Ton"
  sku: String, // Stock Keeping Unit
  barcode: String,
  stock: Number,
  lowStockThreshold: Number,
  trackInventory: Boolean,
  allowBackorder: Boolean,
  images: [{
    url: String,
    altText: String,
    isPrimary: Boolean
  }],
  videos: [String],
  specifications: {
    weight: Number, // kg
    dimensions: { length: Number, width: Number, height: Number },
    manufacturer: String,
    countryOfOrigin: String,
    expiryDate: Date, // for perishables
    shelfLife: String,
    storageInstructions: String
  },
  attributes: {
    // Dynamic attributes based on category
    seedType: String,
    germinationRate: Number,
    npkRatio: String,
    coverage: String,
    powerSource: String,
    etc: String
  },
  shipping: {
    weight: Number,
    freeShipping: Boolean,
    shippingCost: Number,
    deliveryTime: String,
    returnable: Boolean,
    returnWindow: Number // days
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },
  status: Enum ['draft', 'active', 'inactive', 'out_of_stock', 'discontinued'],
  visibility: Enum ['public', 'private', 'members_only'],
  rating: Number (default: 0),
  reviewCount: Number (default: 0),
  totalSold: Number (default: 0),
  viewCount: Number (default: 0),
  featured: Boolean,
  tags: [String],
  createdAt: Date,
  updatedAt: Date
}
```

### Cart Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, unique),
  items: [{
    productId: ObjectId (ref: Product),
    productName: String,
    productImage: String,
    merchantId: ObjectId (ref: Merchant),
    merchantName: String,
    price: Number,
    quantity: Number,
    unit: String,
    subtotal: Number,
    addedAt: Date
  }],
  totalItems: Number,
  subtotal: Number,
  shippingCost: Number,
  discount: Number,
  tax: Number,
  grandTotal: Number,
  appliedCoupons: [{
    code: String,
    discountAmount: Number,
    appliedAt: Date
  }],
  abandonedAt: Date,
  recoveredAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### ProductOrder Collection
```typescript
{
  _id: ObjectId,
  orderNumber: String (unique),
  userId: ObjectId (ref: User),
  farmerName: String,
  farmerEmail: String,
  farmerPhone: String,
  deliveryAddress: {
    recipientName: String,
    street: String,
    city: String,
    state: String,
    postalCode: String,
    phoneNumber: String,
    coordinates: { lat: Number, lng: Number },
    landmarks: String
  },
  billingAddress: {
    // Same structure as delivery or same as user profile
  },
  items: [{
    productId: ObjectId (ref: Product),
    productName: String,
    productImage: String,
    merchantId: ObjectId (ref: Merchant),
    merchantName: String,
    category: String,
    price: Number,
    quantity: Number,
    unit: String,
    subtotal: Number,
    commissionAmount: Number
  }],
  pricing: {
    subtotal: Number,
    shippingCost: Number,
    handlingFee: Number,
    discount: Number,
    tax: Number,
    grandTotal: Number
  },
  paymentStatus: Enum ['pending', 'paid', 'partially_refunded', 'fully_refunded'],
  paymentMethod: Enum ['wallet', 'card', 'bank_transfer', 'pay_on_delivery'],
  paymentId: ObjectId (ref: WalletTransaction),
  seerbitReference: String,
  status: Enum [
    'pending',
    'confirmed',
    'processing',
    'partially_shipped',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'returned',
    'disputed'
  ],
  shippingMethod: Enum ['standard', 'express', 'same_day', 'pickup'],
  trackingNumbers: [String],
  courierPartner: String,
  estimatedDeliveryDate: Date,
  actualDeliveryDate: Date,
  notes: String,
  internalNotes: String,
  cancellationReason: String,
  cancelledBy: String,
  refundDetails: {
    amount: Number,
    reason: String,
    status: Enum ['pending', 'approved', 'processed', 'completed'],
    processedAt: Date
  },
  disputeDetails: {
    reason: String,
    description: String,
    images: [String],
    status: Enum ['open', 'under_review', 'resolved', 'closed'],
    resolvedBy: ObjectId (ref: User),
    resolution: String,
    resolvedAt: Date
  },
  deliveredBy: String,
  receivedBy: String,
  signatureUrl: String,
  createdAt: Date,
  updatedAt: Date
}
```

### OrderShipment Collection
```typescript
{
  _id: ObjectId,
  orderId: ObjectId (ref: ProductOrder),
  shipmentNumber: String (unique),
  merchantId: ObjectId (ref: Merchant),
  items: [{
    productId: ObjectId (ref: Product),
    quantity: Number
  }],
  courierPartner: String,
  trackingNumber: String,
  trackingUrl: String,
  status: Enum ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'],
  origin: {
    warehouse: String,
    address: String,
    coordinates: { lat: Number, lng: Number }
  },
  destination: {
    address: String,
    coordinates: { lat: Number, lng: Number }
  },
  trackingHistory: [{
    timestamp: Date,
    status: String,
    location: String,
    message: String
  }],
  estimatedDelivery: Date,
  actualDelivery: Date,
  proofOfDelivery: {
    imageUrl: String,
    signatureUrl: String,
    receivedBy: String,
    deliveredAt: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### ProductReview Collection
```typescript
{
  _id: ObjectId,
  productId: ObjectId (ref: Product),
  orderId: ObjectId (ref: ProductOrder),
  userId: ObjectId (ref: User),
  farmerName: String,
  verified: Boolean, // verified purchase
  rating: Number, // 1-5
  title: String,
  comment: String,
  pros: [String],
  cons: [String],
  images: [String],
  videos: [String],
  helpful: Number,
  merchantResponse: {
    comment: String,
    respondedAt: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Coupon Collection
```typescript
{
  _id: ObjectId,
  code: String (unique),
  description: String,
  type: Enum ['percentage', 'fixed', 'free_shipping'],
  value: Number, // percentage or fixed amount
  minOrderAmount: Number,
  maxDiscountAmount: Number,
  applicableCategories: [ObjectId (ref: ProductCategory)],
  applicableMerchants: [ObjectId (ref: Merchant)],
  applicableProducts: [ObjectId (ref: Product)],
  usageLimit: Number,
  usedCount: Number,
  perUserLimit: Number,
  validFrom: Date,
  validUntil: Date,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Products
- `GET /api/v1/products` - List products (with filters, search, pagination)
- `GET /api/v1/products/:slug` - Get product details
- `GET /api/v1/products/featured` - Get featured products
- `GET /api/v1/products/category/:categoryId` - Get products by category
- `POST /api/v1/products` - Create product (merchant only)
- `PATCH /api/v1/products/:id` - Update product (merchant only)
- `DELETE /api/v1/products/:id` - Delete product (merchant only)
- `POST /api/v1/products/:id/images` - Upload product images
- `GET /api/v1/products/:id/reviews` - Get product reviews
- `POST /api/v1/products/:id/reviews` - Submit product review

### Categories
- `GET /api/v1/categories` - List all categories
- `GET /api/v1/categories/tree` - Get category tree
- `GET /api/v1/categories/:id` - Get category details

### Cart
- `GET /api/v1/cart` - Get user's cart
- `POST /api/v1/cart/items` - Add item to cart
- `PATCH /api/v1/cart/items/:itemId` - Update cart item quantity
- `DELETE /api/v1/cart/items/:itemId` - Remove item from cart
- `DELETE /api/v1/cart` - Clear cart
- `POST /api/v1/cart/apply-coupon` - Apply coupon code

### Orders
- `POST /api/v1/orders` - Create order (checkout)
- `GET /api/v1/orders` - Get user's orders
- `GET /api/v1/orders/:orderNumber` - Get order details
- `POST /api/v1/orders/:orderNumber/cancel` - Cancel order
- `POST /api/v1/orders/:orderNumber/rate` - Rate delivered order
- `POST /api/v1/orders/:orderNumber/dispute` - Raise dispute
- `GET /api/v1/orders/:orderNumber/invoice` - Download invoice

### Merchant Operations
- `GET /api/v1/merchant/orders` - Get merchant's orders
- `PATCH /api/v1/merchant/orders/:id/status` - Update order status
- `POST /api/v1/merchant/orders/:id/ship` - Create shipment
- `GET /api/v1/merchant/products` - Get merchant's products
- `GET /api/v1/merchant/analytics` - Get sales analytics
- `GET /api/v1/merchant/payouts` - Get payout history
- `POST /api/v1/merchant/payouts/request` - Request payout

### Admin Operations
- `GET /api/v1/admin/orders` - Get all orders
- `GET /api/v1/admin/products` - Get all products (moderation)
- `POST /api/v1/admin/products/:id/approve` - Approve product
- `GET /api/v1/admin/merchants` - Get all merchants
- `POST /api/v1/admin/merchants/:id/verify` - Verify merchant
- `GET /api/v1/admin/statistics` - Get marketplace statistics
- `POST /api/v1/admin/coupons` - Create coupon
- `GET /api/v1/admin/revenue-report` - Get revenue report

### Search
- `GET /api/v1/search` - Search products
- `GET /api/v1/search/suggestions` - Get search suggestions
- `GET /api/v1/search/filters` - Get available filters

## Business Logic

### Order Flow

#### Step 1: Cart Management
1. User adds products to cart
2. System validates stock availability
3. Prices locked for 15 minutes
4. Cart persists across sessions

#### Step 2: Checkout
1. User reviews cart items
2. Enters/confirms delivery address
3. Selects shipping method
4. Applies coupon (optional)
5. System calculates final total

#### Step 3: Payment
1. User selects payment method
2. For wallet: instant deduction
3. For card/bank: SeerBit integration
4. Payment confirmation via webhook
5. Order created with status 'pending'

#### Step 4: Order Processing
1. Merchant notified of new order
2. Merchant confirms order (within 24 hours)
3. Items picked and packed
4. Shipping label generated
5. Courier pickup scheduled

#### Step 5: Shipping
1. Package handed to courier
2. Tracking number assigned
3. Real-time tracking updates
4. Customer notified of shipment

#### Step 6: Delivery
1. Package delivered to customer
2. Proof of delivery captured
3. Order marked complete
4. Review request sent

### Pricing Calculation
```
Subtotal = Σ (Product Price × Quantity)
Shipping = Σ (Merchant Shipping Cost) or Free if threshold met
Handling Fee = Subtotal × 1% (max ₦500)
Discount = Coupon Value
Tax = (Subtotal - Discount) × 0% (VAT exempt for agricultural inputs)
Grand Total = Subtotal + Shipping + Handling - Discount + Tax
```

### Commission Structure
- Standard commission: 10% per sale
- Electronics/Equipment: 7%
- Farm Produce: 5%
- Platinum merchants: 8%
- Commission deducted before merchant payout

### Shipping Rules
- Free shipping threshold: ₦50,000
- Standard delivery: 3-7 business days
- Express delivery: 1-3 business days (+50% cost)
- Same-day delivery: Major cities only (2× cost)
- Pickup: Free at merchant warehouse

### Return Policy
- 7-day return window for non-perishables
- 48-hour return window for perishables
- Item must be unused and in original packaging
- Return shipping paid by customer (unless defective)
- Refund processed within 5 business days

### Inventory Management
- Real-time stock updates on order placement
- Low stock alerts at threshold
- Auto-hide products when out of stock
- Backorder option for popular items
- Stock reconciliation weekly

## Scheduled Jobs (BullMQ)

### Cart Abandonment Recovery
- Run every 6 hours
- Identify abandoned carts (>1 hour)
- Send reminder emails with incentive

### Order Status Follow-ups
- Run every hour
- Alert merchants on pending orders (>24 hours)
- Notify customers of delays

### Delivery Confirmation
- Run daily
- Check orders marked 'out_for_delivery' > 2 days
- Send customer satisfaction survey

### Payout Processing
- Run twice weekly (Tuesday, Friday)
- Calculate eligible merchant balances
- Initiate bank transfers
- Generate payout reports

### Price Monitoring
- Run daily
- Detect unusual price changes
- Flag potential errors

## Security Requirements
- Authentication for cart and orders
- Merchant verification (KYC + business docs)
- Secure payment processing (PCI DSS)
- Fraud detection for suspicious orders
- Rate limiting on checkout
- Inventory lock during checkout

## Error Handling
- Out-of-stock during checkout: suggest alternatives
- Payment failures: retry with different method
- Address validation errors: clear feedback
- Courier API failures: manual intervention queue
- Double-order prevention with idempotency

## Testing Requirements
- Unit tests for pricing calculations
- Integration tests for checkout flow
- E2E tests for complete order lifecycle
- Load testing for flash sales
- Minimum 85% code coverage

## Performance Requirements
- Product search < 200ms
- Cart operations < 100ms
- Checkout completion < 2 seconds
- Support 500 concurrent users
- Handle 1000 orders/hour

## Monitoring & Logging
- Sales funnel analytics
- Cart abandonment rates
- Merchant performance metrics
- Product popularity tracking
- Revenue analytics
- Customer satisfaction scores

## Notifications
- Cart abandonment reminders
- Order confirmation
- Order status updates
- Shipment notifications
- Delivery confirmations
- Review requests
- Price drop alerts
- Restock notifications
