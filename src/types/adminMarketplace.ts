/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ADMIN-plane marketplace / orders / merchants types — mirror the serializers in
 * `backend/src/marketplace/admin-*.service.ts` under the `{ success, data }`
 * envelope (bases `/api/v1/admin/marketplace`, `/api/v1/admin/orders`,
 * `/api/v1/admin/merchants`).
 *
 * These are the ADMIN equivalents of the user-plane `src/types/marketplace.ts`
 * and `src/types/merchant.ts` — do NOT import those here. Contracts:
 * PRD/admin_module/marketplace/marketplace.md, /admin_orders/orders.md,
 * /merchants/merchants.md and PRD/data_structure.md §11.
 */

import type { FileMetadata } from "./upload";

// --- Shared -----------------------------------------------------------------

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type SellerType = "PLATFORM" | "MERCHANT";
export type ProductSource = "ADMIN" | "MERCHANT";

export type ModerationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

export type ListingStatus = "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";

/** Seller card attached to admin product / order rows. */
export interface AdminSellerRef {
  type: SellerType;
  merchantId?: string;
  displayName?: string;
  businessName?: string;
}

// ===========================================================================
// Categories
// ===========================================================================

export interface AdminCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryPayload {
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}

// ===========================================================================
// Products
// ===========================================================================

export interface ProductInventory {
  available: number;
  reserved?: number;
  lowStockThreshold?: number | null;
}

export interface AdminProduct {
  id: string;
  productId?: string;
  source: ProductSource;
  merchantId?: string | null;
  name: string;
  slug?: string;
  description: string;
  categoryId: string;
  category: { id: string; name: string | null } | null;
  price: number;
  unit: string;
  inventory?: ProductInventory;
  stock?: { available: number };
  images: FileMetadata[];
  video?: FileMetadata | null;
  moderationStatus: ModerationStatus;
  moderationReason?: string | null;
  moderatedAt?: string | null;
  status: ListingStatus;
  suspended?: boolean;
  seller: AdminSellerRef;
  totalSales?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductModerationEntry {
  id: string;
  productId: string;
  merchantId?: string | null;
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "AUTO_APPROVED";
  reason?: string | null;
  reviewedBy?: string | null;
  reviewedAt: string;
  createdAt: string;
}

export interface AdminProductDetail extends AdminProduct {
  moderationHistory?: ProductModerationEntry[];
  merchant?: {
    id: string;
    merchantId?: string;
    businessName?: string;
    kycStatus?: string;
    earnings?: MerchantEarningsCounters;
  } | null;
}

export interface AdminProductListFilters {
  page?: number;
  limit?: number;
  q?: string;
  moderationStatus?: ModerationStatus;
  status?: ListingStatus;
  source?: ProductSource;
  merchantId?: string;
  categoryId?: string;
  lowStock?: boolean;
  suspended?: boolean;
  sortBy?: "createdAt" | "totalSales" | "price";
  order?: "asc" | "desc";
}

/** POST/PATCH product payload — media are already-uploaded FileMetadata. */
export interface AdminProductPayload {
  name?: string;
  description?: string;
  categoryId?: string;
  price?: number;
  unit?: string;
  inventory?: { available?: number; lowStockThreshold?: number | null };
  images?: FileMetadata[];
  video?: FileMetadata | null;
  status?: ListingStatus;
  suspended?: boolean;
}

export interface InventoryPatchPayload {
  available?: number;
  lowStockThreshold?: number | null;
}

export interface LowStockRow {
  id: string;
  productId?: string;
  name: string;
  source: ProductSource;
  available: number;
  lowStockThreshold: number;
  status: ListingStatus;
}

export interface LowStockResult {
  items: LowStockRow[];
  defaultThreshold: number;
}

// --- Sellers (read-only oversight) ------------------------------------------

export interface SellerAggregate {
  id: string;
  merchantId?: string;
  businessName: string;
  kycStatus: MerchantKycStatus;
  listings: number;
  orders: number;
  gmv: number;
  earnings?: MerchantEarningsCounters;
  createdAt: string;
}

// ===========================================================================
// Orders
// ===========================================================================

export type FulfillmentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type OrderPaymentStatus = "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";

export interface OrderItemSnapshot {
  productId: string;
  productName: string;
  imageUrl?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderPricing {
  subtotal: number;
  deliveryFee: number;
  total: number;
  platformFeePercent?: number;
  platformFee?: number;
  merchantNet?: number | null;
}

export interface OrderTimelineEntry {
  status: string;
  at: string;
  actorType?: "buyer" | "merchant" | "admin" | "system" | string;
  actorId?: string | null;
  note?: string | null;
}

export interface OrderRefund {
  amount: number;
  reason: string;
  reference: string;
  restock: boolean;
  refundedBy?: string;
  at: string;
}

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  checkoutGroupId: string;
  buyer: { id: string; name: string };
  seller: AdminSellerRef;
  itemCount: number;
  total: number;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  refundedTotal: number;
  buyerConfirmedAt: string | null;
  createdAt: string;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  checkoutGroupId: string;
  buyer: {
    id: string;
    name: string;
    phone?: string | null;
    userId?: string | null;
  };
  seller: AdminSellerRef;
  items: OrderItemSnapshot[];
  pricing?: OrderPricing;
  totalAmount?: number;
  paymentStatus: OrderPaymentStatus;
  walletPaymentRef?: string;
  refundRef?: string | null;
  refunds?: OrderRefund[];
  refundedTotal?: number;
  remainingRefundable?: number;
  status: FulfillmentStatus;
  fulfillmentStatus: FulfillmentStatus;
  deliveryAddress?:
    | { name?: string; phone?: string; street?: string; city?: string; state?: string }
    | string;
  trackingInfo?: { carrier?: string; trackingNumber?: string } | null;
  timeline: OrderTimelineEntry[];
  deliveredAt?: string | null;
  buyerConfirmedAt?: string | null;
  cancelledBy?: { type?: string; id?: string } | null;
  cancellationReason?: string | null;
  siblingOrders?: {
    id: string;
    orderNumber: string;
    sellerType?: SellerType;
    fulfillmentStatus: FulfillmentStatus;
    total: number;
  }[];
  createdAt: string;
  updatedAt?: string;
}

export interface CheckoutGroupView {
  checkoutGroupId: string;
  grandTotal: number;
  orders: (AdminOrderDetail & { seller: AdminSellerRef })[];
}

export interface AdminOrderListFilters {
  page?: number;
  limit?: number;
  orderNumber?: string;
  checkoutGroupId?: string;
  buyerId?: string;
  sellerType?: SellerType;
  merchantId?: string;
  productId?: string;
  paymentStatus?: OrderPaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  startDate?: string;
  endDate?: string;
  minTotal?: number;
  maxTotal?: number;
  buyerConfirmed?: boolean;
  sortBy?: "createdAt" | "total";
  order?: "asc" | "desc";
}

export interface FulfillmentPayload {
  fulfillmentStatus: FulfillmentStatus;
  note?: string;
  trackingInfo?: { carrier?: string; trackingNumber?: string };
}

export interface CancelOrderPayload {
  reason: string;
  restock?: boolean;
}

export interface RefundOrderPayload {
  amount?: number;
  reason: string;
  restock?: boolean;
  overrideWindow?: boolean;
}

export interface RefundResult {
  id: string;
  paymentStatus: OrderPaymentStatus;
  refundedTotal: number;
  refund: { amount: number; reference: string; seq: number };
  earningsAdjusted: boolean;
}

// ===========================================================================
// Merchants
// ===========================================================================

export type MerchantKycStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

export type MerchantIdType =
  | "NIN"
  | "BVN"
  | "DRIVERS_LICENCE"
  | "VOTERS_CARD"
  | "INTL_PASSPORT";

export type PremblyStatus = "VERIFIED" | "NOT_VERIFIED" | "ERROR" | "SKIPPED";

export interface MerchantEarningsCounters {
  availableBalance: number;
  lifetimeEarned: number;
  lifetimePaidOut: number;
}

export interface MerchantOwner {
  id: string;
  userId?: string;
  name: string;
  email?: string;
  phoneNumber?: string;
}

export interface AdminMerchantRow {
  id: string;
  merchantId?: string;
  businessName: string;
  kycStatus: MerchantKycStatus;
  idType?: MerchantIdType | null;
  premblyStatus: PremblyStatus;
  owner?: MerchantOwner | null;
  listings: number;
  earnings?: MerchantEarningsCounters;
  submittedAt?: string | null;
  createdAt: string;
}

/** ADVISORY Prembly / CAC snapshot. */
export interface PremblyResult {
  checked?: boolean;
  status?: PremblyStatus;
  verified?: boolean | null;
  endpoint?: string | null;
  checkedAt?: string | null;
  matchedName?: string | null;
  raw?: Record<string, unknown> | null;
}

export interface KycDocRef {
  label: string | null;
  fileId: string;
  originalName: string | null;
  fileType: string | null;
  size?: number | null;
  visibility?: string;
}

export interface AdminMerchantDetail {
  id: string;
  merchantId?: string;
  businessName: string;
  businessDescription?: string | null;
  businessAddress?: { street?: string; city?: string; state?: string } | null;
  businessPhone?: string;
  businessEmail?: string | null;
  isRegisteredBusiness?: boolean;
  cacRcNumber?: string | null;
  idType?: MerchantIdType | null;
  idNumber?: string | null;
  premblyResult?: PremblyResult | null;
  cacResult?: PremblyResult | null;
  kycDocs: KycDocRef[];
  kycDocsPurgedAt?: string | null;
  kycStatus: MerchantKycStatus;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  resubmissionCount?: number;
  payoutBankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;
  earnings?: MerchantEarningsCounters;
  owner?: MerchantOwner | null;
  counts?: { listings: number; openOrders: number; pendingPayouts: number };
  createdAt: string;
  updatedAt?: string;
}

export interface AdminMerchantListFilters {
  page?: number;
  limit?: number;
  q?: string;
  kycStatus?: MerchantKycStatus;
  idType?: MerchantIdType;
  premblyVerified?: "true" | "false" | "unchecked";
  hasPendingPayout?: "true" | "false";
  sortBy?: "createdAt" | "submittedAt" | "availableBalance";
  order?: "asc" | "desc";
}

// --- Earnings ---------------------------------------------------------------

export type EarningStatus = "AVAILABLE" | "LOCKED" | "SETTLED" | "REVERSED";
export type EarningType = "ORDER_EARNING" | "ADJUSTMENT";

export interface MerchantEarningEntry {
  id: string;
  merchantId: string;
  type: EarningType;
  orderId?: string | null;
  orderNumber?: string;
  gross: number;
  platformFeePercent: number;
  platformFee: number;
  net: number;
  status: EarningStatus;
  payoutRequestId?: string | null;
  note?: string | null;
  bookedAt: string;
  settledAt?: string | null;
  createdAt: string;
}

export interface MerchantEarningsPage {
  summary: MerchantEarningsCounters;
  entries: MerchantEarningEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface EarningsFilters {
  page?: number;
  limit?: number;
  status?: EarningStatus;
  type?: EarningType;
}

// --- Payouts ----------------------------------------------------------------

export type PayoutStatus =
  | "REQUESTED"
  | "MARKED_SENT"
  | "CONFIRMED_RECEIVED"
  | "CANCELLED";

export interface PayoutBankAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface AdminPayoutRequest {
  id: string;
  requestId?: string;
  merchantId: string;
  amount: number;
  entryIds?: string[];
  bankAccount?: PayoutBankAccount;
  status: PayoutStatus;
  requestedAt: string;
  markedSentAt?: string | null;
  paymentReference?: string | null;
  confirmedAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  merchant?: {
    id: string;
    merchantId?: string;
    businessName?: string;
    kycStatus?: MerchantKycStatus;
  } | null;
  entries?: MerchantEarningEntry[];
}

export interface PayoutQueueFilters {
  page?: number;
  limit?: number;
  status?: PayoutStatus | "ALL";
}

export interface MarkPayoutSentPayload {
  paymentReference: string;
  note?: string;
}

export interface MarkPayoutSentResult {
  id: string;
  requestId?: string;
  status: PayoutStatus;
  amount: number;
  paymentReference: string;
  markedSentAt: string;
  awaitingMerchantConfirmation: boolean;
}

// --- Signed URL (KYC doc viewing) -------------------------------------------

export interface SignedUrlResult {
  id?: string;
  signed: boolean;
  url: string;
  expiresAt: string | null;
}
