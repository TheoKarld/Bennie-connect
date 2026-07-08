/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LIVE marketplace types (storefront + cart + checkout + orders) mirroring the
 * backend serializers in `backend/src/marketplace/*` under the
 * `{ success, data }` envelope (base `/api/v1/marketplace`).
 *
 * Contracts: PRD/user_module/ecommerce-marketplace + cart_checkout and
 * PRD/data_structure.md §11. These REPLACE the mock `Product` / `CartItem` /
 * `ProductOrder` types previously in `src/types.ts`.
 */

import type { FileMetadata } from "./upload";

// --- Shared ---------------------------------------------------------------

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type SellerType = "PLATFORM" | "MERCHANT";

/** Seller card attached to products, cart lines and orders. */
export interface SellerRef {
  type: SellerType;
  merchantId?: string;
  displayName: string;
}

// --- Categories -------------------------------------------------------------

export interface MarketplaceCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  sortOrder: number;
  productCount: number;
}

// --- Products (storefront view) ----------------------------------------------

export type ProductSort = "newest" | "price_asc" | "price_desc" | "popular";

export interface StorefrontProduct {
  id: string;
  /** Human business id, e.g. "PRD_...". */
  productId?: string;
  name: string;
  slug?: string;
  description: string;
  category: { id: string; name: string | null } | null;
  price: number; // whole NGN per unit
  unit: string;
  stock: { available: number };
  images: FileMetadata[];
  /** List view only — the detail view returns the full `video`. */
  hasVideo?: boolean;
  /** Detail view only. */
  video?: FileMetadata | null;
  seller: SellerRef;
  totalSold: number;
  /** Detail view only — the caller's current cart line for this product. */
  inCart?: { itemId: string; quantity: number } | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductFilters {
  q?: string;
  category?: string;
  sort?: ProductSort;
  page?: number;
  limit?: number;
  inStockOnly?: boolean;
}

// --- Cart ---------------------------------------------------------------------

export type CartLineIssue =
  | "UNAVAILABLE"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_STOCK"
  | "OWN_LISTING";

export interface CartLineProduct {
  id: string;
  name: string | null;
  unit?: string;
  price?: number;
  image?: FileMetadata | null;
  seller?: SellerRef;
  stockAvailable?: number;
}

export interface CartLine {
  itemId: string;
  product: CartLineProduct;
  quantity: number;
  lineTotal: number;
  valid: boolean;
  issue: CartLineIssue | null;
}

export interface CartSellerGroup {
  seller: SellerRef;
  itemCount: number;
  subtotal: number;
}

export type CartBlockedReason = "EMPTY_CART" | "INVALID_ITEMS";

/** GET /marketplace/cart — enriched + validated view. */
export interface CartView {
  items: CartLine[];
  sellerGroups: CartSellerGroup[];
  grandTotal: number;
  wallet: { available: number; sufficient: boolean };
  checkoutBlocked: boolean;
  blockedReason: CartBlockedReason | null;
}

// --- Orders ---------------------------------------------------------------------

export type FulfillmentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type OrderPaymentStatus = "PAID" | "REFUNDED";

/** Immutable item snapshot embedded on orders at checkout. */
export interface OrderItemSnapshot {
  productId: string;
  productName: string;
  imageUrl: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderTimelineEntry {
  status: string;
  at: string;
  actorType?: "buyer" | "merchant" | "admin" | "system" | string;
  actorId?: string | null;
  note?: string | null;
}

export interface OrderPricing {
  subtotal: number;
  deliveryFee: number;
  total: number;
  platformFeePercent?: number;
  platformFee?: number;
  merchantNet?: number | null;
}

/** Row inside an order group (GET /marketplace/orders). */
export interface OrderSummary {
  id: string;
  orderNumber: string;
  seller: SellerRef;
  status: FulfillmentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: OrderPaymentStatus;
  totalAmount: number;
  itemCount: number;
  buyerConfirmedAt: string | null;
}

/** One purchase = the orders sharing a checkoutGroupId. */
export interface OrderGroup {
  checkoutGroupId: string;
  placedAt: string;
  grandTotal: number;
  deliveryAddress: string;
  walletPaymentRef?: string;
  orders: OrderSummary[];
}

export interface OrderGroupsPage {
  groups: OrderGroup[];
  total: number;
  page: number;
  limit: number;
}

export interface SiblingOrder {
  id: string;
  orderNumber: string;
  status: FulfillmentStatus;
  totalAmount: number;
  itemCount: number;
  seller: SellerRef;
}

/** GET /marketplace/orders/:id — full order view (buyer plane). */
export interface OrderDetail {
  id: string;
  orderNumber: string;
  checkoutGroupId: string;
  seller: SellerRef;
  items: OrderItemSnapshot[];
  pricing?: OrderPricing;
  /** Alias of pricing.total. */
  totalAmount: number;
  /** Alias of fulfillmentStatus. */
  status: FulfillmentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: OrderPaymentStatus;
  walletPaymentRef?: string;
  refundRef?: string | null;
  refundedTotal?: number | null;
  deliveryAddress: string;
  timeline: OrderTimelineEntry[];
  deliveredAt?: string | null;
  buyerConfirmedAt?: string | null;
  confirmedReceivedAt?: string | null;
  cancelledBy?: { type?: string; id?: string } | string | null;
  cancellationReason?: string | null;
  siblingOrders?: SiblingOrder[];
  createdAt: string;
  updatedAt?: string;
}

// --- Checkout ---------------------------------------------------------------------

export interface CheckoutOrderResult {
  id: string;
  orderNumber: string;
  seller: SellerRef;
  totalAmount: number;
  status: FulfillmentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: OrderPaymentStatus;
  items: OrderItemSnapshot[];
}

/** POST /marketplace/checkout — the checkout group receipt. */
export interface CheckoutResult {
  checkoutGroupId: string;
  walletPaymentRef: string;
  grandTotal: number;
  wallet: { balance?: { available?: number }; available?: number } & Record<
    string,
    unknown
  >;
  orders: CheckoutOrderResult[];
}

// --- Cancel / confirm results -------------------------------------------------------

export interface CancelOrderResult {
  id: string;
  status: FulfillmentStatus;
  paymentStatus: OrderPaymentStatus;
  refundRef: string;
  refunded: number;
  wallet: Record<string, unknown>;
}

export interface ConfirmReceivedResult {
  id: string;
  status: FulfillmentStatus;
  buyerConfirmedAt: string;
  confirmedReceivedAt: string;
}
