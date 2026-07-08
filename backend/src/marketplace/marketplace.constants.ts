import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * LIVE Marketplace error codes + notification event keys.
 * User plane: MKT_* (storefront/cart/checkout), ORD_* (orders),
 * MERCH_* (merchant hub). Admin plane: MKT_ADM_*, ORD_ADM_*, MERCH_ADM_*.
 * Contracts: PRD/user_module/{ecommerce-marketplace,cart_checkout,merchant_panel}
 * and PRD/admin_module/{marketplace,admin_orders,merchants}.
 */

// ---------------------------------------------------------------------------
// User plane — storefront / cart / checkout (MKT_*)
// ---------------------------------------------------------------------------

export const MKT_ERROR_CODES = {
  MKT_001: 'Product not found',
  MKT_002: 'Category not found',
  MKT_003: 'Product not available for purchase',
  MKT_004: 'Insufficient stock for the requested quantity',
  MKT_005: 'Cart item not found',
  MKT_006: 'Invalid quantity',
  MKT_007: 'Cart is empty — nothing to check out',
  MKT_008: 'Delivery address missing or invalid',
  MKT_009: 'Insufficient wallet balance',
  MKT_010: 'Wallet debit/refund failed',
  MKT_011: 'Checkout conflict — one or more items failed revalidation',
  MKT_012: 'Cannot purchase your own listing',
  MKT_013: 'Cart line limit reached',
} as const;
export type MktErrorCode = keyof typeof MKT_ERROR_CODES;

// ---------------------------------------------------------------------------
// User plane — orders (ORD_*)
// ---------------------------------------------------------------------------

export const ORD_ERROR_CODES = {
  ORD_001: 'Order not found',
  ORD_002: 'Invalid fulfilment status transition',
  ORD_003: 'Cancel allowed only while PENDING',
  ORD_004: 'Confirm-received allowed only when DELIVERED',
  ORD_005: 'Refund failed',
  ORD_006: 'Not authorized to act on this order',
  ORD_007: 'Order already in a terminal state',
} as const;
export type OrdErrorCode = keyof typeof ORD_ERROR_CODES;

// ---------------------------------------------------------------------------
// User plane — merchant hub (MERCH_*)
// ---------------------------------------------------------------------------

export const MERCH_ERROR_CODES = {
  MERCH_001: 'Merchant profile not found',
  MERCH_002: 'Action requires an APPROVED merchant',
  MERCH_003: 'KYC submit/edit not allowed in the current status',
  MERCH_004: 'Invalid or unsupported ID type',
  MERCH_005: 'Document set invalid',
  MERCH_006: 'ID number fails the format for the chosen type',
  MERCH_007: 'Active-listing limit reached',
  MERCH_008: 'Product not found or not owned by this merchant',
  MERCH_009: 'Media rules violated (images 1–3, video ≤ 1, type/size)',
  MERCH_010: 'Invalid fulfilment transition (must be one step forward)',
  MERCH_011: "Order not found or not this merchant's order",
  MERCH_012: 'Payout exceeds available earnings balance',
  MERCH_013: 'Payout request not found',
  MERCH_014: 'Payout not in the required state for this action',
  MERCH_015: 'An open payout request already exists',
  MERCH_016: 'Merchant is suspended — selling actions blocked',
  MERCH_017: 'KYC document purged after review — no longer retrievable',
  MERCH_018: 'Payout below the minimum amount',
} as const;
export type MerchErrorCode = keyof typeof MERCH_ERROR_CODES;

// ---------------------------------------------------------------------------
// Admin plane — marketplace products/categories/moderation (MKT_ADM_*)
// ---------------------------------------------------------------------------

export const MKT_ADM_ERROR_CODES = {
  MKT_ADM_001: 'Product not found',
  MKT_ADM_003: 'Seller (merchant) not found',
  MKT_ADM_008: 'Reason required for this action',
  MKT_ADM_009: 'Category name/slug already exists',
  MKT_ADM_010: 'Category in use — delete blocked',
  MKT_ADM_011: 'Insufficient permission for action',
  MKT_ADM_013: 'Invalid platform-fee value',
  MKT_ADM_014: 'Media limit exceeded (max 3 images / 1 video)',
  MKT_ADM_015: 'Media file not found in the files index',
  MKT_ADM_016: 'Invalid moderation transition',
  MKT_ADM_017: 'Product delete blocked — non-terminal orders contain it',
  MKT_ADM_018: 'Category inactive — new listings blocked',
  MKT_ADM_019: 'Category not found',
} as const;
export type MktAdmErrorCode = keyof typeof MKT_ADM_ERROR_CODES;

// ---------------------------------------------------------------------------
// Admin plane — orders ops (ORD_ADM_*)
// ---------------------------------------------------------------------------

export const ORD_ADM_ERROR_CODES = {
  ORD_ADM_001: 'Order not found',
  ORD_ADM_002: 'Invalid fulfilment transition',
  ORD_ADM_003: 'Refund not permitted',
  ORD_ADM_004: 'Refund amount exceeds refundable balance',
  ORD_ADM_005: 'Reason/note required for this action',
  ORD_ADM_006: 'Duplicate refund (idempotency conflict)',
  ORD_ADM_007: 'Cancel not allowed from current status',
  ORD_ADM_008:
    'Corrective move out of DELIVERED blocked — earnings locked/settled in a payout',
  ORD_ADM_009: 'Insufficient permission for action',
  ORD_ADM_010: 'Checkout group not found',
} as const;
export type OrdAdmErrorCode = keyof typeof ORD_ADM_ERROR_CODES;

// ---------------------------------------------------------------------------
// Admin plane — merchants ops (MERCH_ADM_*)
// ---------------------------------------------------------------------------

export const MERCH_ADM_ERROR_CODES = {
  MERCH_ADM_001: 'Merchant not found',
  MERCH_ADM_002: 'Invalid KYC state for this action',
  MERCH_ADM_003: 'Reason required for this action',
  MERCH_ADM_004: 'Merchant already exists for this user',
  MERCH_ADM_005: 'KYC documents already purged',
  MERCH_ADM_006: 'Prembly verification unavailable',
  MERCH_ADM_007: 'Merchant suspended — action blocked',
  MERCH_ADM_008: 'Payout request not in the required state',
  MERCH_ADM_009: 'paymentReference required to mark a payout request SENT',
  MERCH_ADM_010: 'Payout request not found',
  MERCH_ADM_011: 'Duplicate active payout request for this merchant',
  MERCH_ADM_012: 'Insufficient permission for action',
} as const;
export type MerchAdmErrorCode = keyof typeof MERCH_ADM_ERROR_CODES;

// ---------------------------------------------------------------------------
// Exception — one class, standard envelope
// ---------------------------------------------------------------------------

const ALL_CODES: Record<string, string> = {
  ...MKT_ERROR_CODES,
  ...ORD_ERROR_CODES,
  ...MERCH_ERROR_CODES,
  ...MKT_ADM_ERROR_CODES,
  ...ORD_ADM_ERROR_CODES,
  ...MERCH_ADM_ERROR_CODES,
};

export type MarketplaceErrorCode =
  | MktErrorCode
  | OrdErrorCode
  | MerchErrorCode
  | MktAdmErrorCode
  | OrdAdmErrorCode
  | MerchAdmErrorCode;

export class MarketplaceException extends HttpException {
  constructor(
    code: MarketplaceErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
    messageOverride?: string,
  ) {
    super(
      {
        success: false,
        error: {
          code,
          message: messageOverride || ALL_CODES[code],
          ...(details ? { details } : {}),
        },
      },
      status,
    );
  }
}

// ---------------------------------------------------------------------------
// Notification event keys (data_structure.md §11.8, owner-locked)
// ---------------------------------------------------------------------------

export const MKT_EVENTS = {
  ORDER_PLACED: 'order.placed',
  ORDER_STATUS: 'order.status',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_REFUNDED: 'order.refunded',
  ORDER_RECEIPT_CONFIRMED: 'order.receipt.confirmed',
  CHECKOUT_SUCCESS: 'marketplace.checkout.success',
  PRODUCT_MODERATION_PENDING: 'product.moderation.pending',
  PRODUCT_MODERATION_DECIDED: 'product.moderation.decided',
  MERCHANT_KYC_SUBMITTED: 'merchant.kyc.submitted',
  MERCHANT_KYC_DECIDED: 'merchant.kyc.decided',
  MERCHANT_SUSPENDED: 'merchant.suspended',
  MERCHANT_REINSTATED: 'merchant.reinstated',
  PAYOUT_REQUESTED: 'merchant.payout.requested',
  PAYOUT_MARKED_SENT: 'merchant.payout.marked_sent',
  PAYOUT_CONFIRMED: 'merchant.payout.confirmed',
  PAYOUT_CANCELLED: 'merchant.payout.cancelled',
} as const;

/** The 8 seeded category names (owner-locked; matches the frontend list). */
export const SEED_CATEGORY_NAMES = [
  'Seeds',
  'Fertilizers',
  'Agrochemicals',
  'Farm Equipment',
  'Livestock Inputs',
  'Irrigation Equipment',
  'Greenhouse Materials',
  'Farm Produce',
] as const;

/** Fulfilment pipeline order (index = progress). */
export const FULFILLMENT_FLOW = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
] as const;

export const MERCHANT_ID_TYPES = [
  'NIN',
  'BVN',
  'DRIVERS_LICENCE',
  'VOTERS_CARD',
  'INTL_PASSPORT',
] as const;
export type MerchantIdType = (typeof MERCHANT_ID_TYPES)[number];

/** Local ID-number format validators (checked before any Prembly call). */
export const ID_NUMBER_PATTERNS: Record<MerchantIdType, RegExp> = {
  NIN: /^\d{11}$/,
  BVN: /^\d{11}$/,
  // FRSC format tolerated variants (3 letters + digits/letters, 8–12 chars).
  DRIVERS_LICENCE: /^[A-Za-z]{3}[A-Za-z0-9]{5,9}$/,
  VOTERS_CARD: /^[A-Za-z0-9]{19}$/,
  INTL_PASSPORT: /^[A-Za-z]\d{8}$/,
};
