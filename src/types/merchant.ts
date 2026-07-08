/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LIVE Merchant Hub types mirroring `backend/src/marketplace/merchant.service.ts`
 * response shapes (base `/api/v1/merchant`, `{ success, data }` envelope).
 *
 * Contract: PRD/user_module/merchant_panel/merchant_panel.md +
 * PRD/data_structure.md §11.
 */

import type { FileMetadata } from "./upload";
import type {
  FulfillmentStatus,
  OrderItemSnapshot,
  OrderPaymentStatus,
  OrderPricing,
  OrderTimelineEntry,
  SellerRef,
} from "./marketplace";

// --- Lifecycle -----------------------------------------------------------------

export type MerchantStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

/** Backend-canonical id types (note: DRIVERS_LICENCE — British spelling). */
export type MerchantIdType =
  | "NIN"
  | "BVN"
  | "DRIVERS_LICENCE"
  | "VOTERS_CARD"
  | "INTL_PASSPORT";

export type KycDocLabel = "ID_FRONT" | "ID_BACK" | "SELFIE_WITH_ID";

export type PremblyStatus = "VERIFIED" | "NOT_VERIFIED" | "ERROR" | "SKIPPED";

// --- GET /merchant/me -------------------------------------------------------------

export interface MerchantBusinessInfo {
  businessName: string | null;
  businessAddress: string | null;
  state: string | null;
  lga: string | null;
  phoneNumber: string | null;
  description: string | null;
  email: string | null;
  cacNumber: string | null;
}

export interface MerchantKycDocumentRef {
  label: KycDocLabel | null;
  fileId: string;
  originalName: string | null;
  fileType: string | null;
}

export interface MerchantKycView {
  idType: MerchantIdType | null;
  idNumberMasked: string | null;
  prembly: {
    status: PremblyStatus;
    matchedName?: string | null;
    checkedAt?: string | null;
  } | null;
  documents: MerchantKycDocumentRef[];
  docsPurgedAt: string | null;
}

export interface MerchantEarningsSnapshot {
  totalEarned: number;
  totalPaidOut: number;
  pendingPayout: number;
  available: number;
}

export interface MerchantCounts {
  products: number;
  pendingModeration: number;
  openOrders: number;
}

export interface MerchantMe {
  status: MerchantStatus;
  /** Mongo _id of the merchants doc (absent while NOT_STARTED). */
  merchantId?: string;
  /** Human business id, e.g. "MCH_...". */
  merchantRef?: string;
  businessInfo?: MerchantBusinessInfo;
  kyc?: MerchantKycView;
  rejectionReason?: string | null;
  suspensionReason?: string | null;
  resubmissionCount?: number;
  earnings?: MerchantEarningsSnapshot;
  counts?: MerchantCounts;
  submittedAt?: string | null;
  reviewedAt?: string | null;
}

// --- POST /merchant/kyc -------------------------------------------------------------

export interface MerchantKycPayload {
  submit?: boolean;
  businessInfo?: {
    businessName?: string;
    businessAddress?: string;
    state?: string;
    lga?: string;
    phoneNumber?: string;
    description?: string;
    email?: string;
    cacNumber?: string;
  };
  kyc?: {
    idType?: MerchantIdType;
    idNumber?: string;
    documents?: { label: KycDocLabel; fileId: string }[];
  };
}

export interface KycDocumentUrlResult {
  url: string;
  expiresAt: string | null;
  signed: boolean;
}

// --- Products (merchant view) ---------------------------------------------------------

export type ModerationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

export type ListingStatus = "ACTIVE" | "INACTIVE";

export interface MerchantProduct {
  id: string;
  productId?: string;
  name: string;
  slug?: string;
  description: string;
  categoryId: string;
  price: number;
  unit: string;
  inventory?: { available: number; reserved?: number };
  stock: { available: number };
  images: FileMetadata[];
  video?: FileMetadata | null;
  status: ListingStatus;
  moderationStatus: ModerationStatus;
  moderationNote: string | null;
  isSuspended: boolean;
  totalSales?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface MerchantProductCreatePayload {
  name: string;
  description: string;
  categoryId: string;
  price: number;
  unit: string;
  stock: number;
  images: FileMetadata[];
  video?: FileMetadata | null;
}

export interface MerchantProductUpdatePayload {
  name?: string;
  description?: string;
  categoryId?: string;
  price?: number;
  unit?: string;
  stock?: number;
  status?: ListingStatus;
  images?: FileMetadata[];
  video?: FileMetadata | null;
}

// --- Orders (merchant view) ------------------------------------------------------------

/** GET /merchant/orders row — full order view + buyer display name. */
export interface MerchantOrder {
  id: string;
  orderNumber: string;
  checkoutGroupId: string;
  buyerName: string;
  seller?: SellerRef;
  items: OrderItemSnapshot[];
  pricing?: OrderPricing;
  totalAmount: number;
  platformFeePercent?: number;
  platformFee?: number;
  merchantNet?: number | null;
  status: FulfillmentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: OrderPaymentStatus;
  deliveryAddress: string;
  timeline: OrderTimelineEntry[];
  deliveredAt?: string | null;
  buyerConfirmedAt?: string | null;
  confirmedReceivedAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// --- Earnings ----------------------------------------------------------------------------

export type EarningStatus = "AVAILABLE" | "LOCKED" | "SETTLED";

export interface EarningEntry {
  id: string;
  orderId: string;
  orderNumber: string;
  /** Canonical fields + user-PRD aliases (both serialized by the backend). */
  gross?: number;
  grossAmount: number;
  platformFeePercent: number;
  platformFee: number;
  net?: number;
  netAmount: number;
  status: EarningStatus;
  bookedAt: string;
  createdAt: string;
}

export interface EarningsSummary {
  totalEarned: number;
  totalPaidOut: number;
  pendingPayout: number;
  available: number;
  platformFeePercent?: number;
}

export interface EarningsPage {
  summary: EarningsSummary;
  entries: EarningEntry[];
  total: number;
  page: number;
  limit: number;
}

// --- Payouts ----------------------------------------------------------------------------

export type PayoutStatus =
  | "REQUESTED"
  | "MARKED_SENT"
  | "CONFIRMED_RECEIVED"
  | "CANCELLED";

export interface PayoutBankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface PayoutRequest {
  id: string;
  /** Human business id, e.g. "MPR_...". */
  requestId?: string;
  amount: number;
  bankDetails?: PayoutBankDetails;
  /** Canonical schema field (bankDetails is the serializer alias). */
  bankAccount?: PayoutBankDetails;
  status: PayoutStatus;
  requestedAt: string;
  markedSentAt?: string | null;
  paymentReference?: string | null;
  confirmedAt?: string | null;
  cancelledBy?: "merchant" | "admin" | null;
  cancelReason?: string | null;
  createdAt: string;
}

export interface CreatePayoutResult {
  request: PayoutRequest;
  summary: MerchantEarningsSnapshot;
}
