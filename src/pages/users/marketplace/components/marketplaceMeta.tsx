/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared presentation atoms for the LIVE marketplace surfaces: seller badge,
 * fulfilment/payment status chips, sort options and small helpers. All
 * tokenized (light + dark) — no raw hex, no non-token grays.
 */

import React from "react";
import { Store, BadgeCheck } from "lucide-react";

import type {
  FulfillmentStatus,
  OrderPaymentStatus,
  ProductSort,
  SellerRef,
} from "../../../../types/marketplace";

// --- Sorts --------------------------------------------------------------------

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price · low to high" },
  { value: "price_desc", label: "Price · high to low" },
  { value: "popular", label: "Most popular" },
];

/** UI low-stock hint threshold (mirrors MARKETPLACE_LOW_STOCK_THRESHOLD). */
export const LOW_STOCK_THRESHOLD = 10;

// --- Seller badge (shared: cards, detail, cart lines, order groups) -------------

export function SellerBadge({
  seller,
  className = "",
}: {
  seller?: SellerRef | null;
  className?: string;
}) {
  if (!seller) return null;
  if (seller.type === "PLATFORM") {
    return (
      <span
        className={`inline-flex max-w-full items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white ${className}`}
      >
        <BadgeCheck className="h-3 w-3 shrink-0" />
        <span className="truncate">{seller.displayName}</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border border-amber-400/50 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 ${className}`}
    >
      <Store className="h-3 w-3 shrink-0" />
      <span className="truncate">{seller.displayName}</span>
    </span>
  );
}

// --- Fulfilment status chips ------------------------------------------------------

const STATUS_STYLES: Record<FulfillmentStatus, string> = {
  PENDING:
    "bg-amber-50 text-amber-700 border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/25",
  PROCESSING:
    "bg-sky-50 text-sky-700 border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-300 dark:border-sky-400/25",
  SHIPPED:
    "bg-indigo-50 text-indigo-700 border-indigo-400/40 dark:bg-indigo-400/10 dark:text-indigo-300 dark:border-indigo-400/25",
  DELIVERED:
    "bg-emerald-50 text-emerald-700 border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/25",
  CANCELLED:
    "bg-rose-50 text-rose-700 border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/25",
};

export const STATUS_LABELS: Record<FulfillmentStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function OrderStatusChip({
  status,
  className = "",
}: {
  status: FulfillmentStatus;
  className?: string;
}) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${style} ${className}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function PaymentChip({
  status,
  className = "",
}: {
  status: OrderPaymentStatus;
  className?: string;
}) {
  const paid = status === "PAID";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
        paid
          ? "border-emerald-400/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300"
          : "border-sky-400/40 bg-sky-50 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300"
      } ${className}`}
    >
      {paid ? "Paid" : "Refunded"}
    </span>
  );
}

// --- Cart line issue copy -----------------------------------------------------------

export const CART_ISSUE_COPY: Record<string, string> = {
  UNAVAILABLE: "No longer available — remove to continue",
  OUT_OF_STOCK: "Out of stock — remove to continue",
  INSUFFICIENT_STOCK: "Not enough stock — reduce the quantity",
  OWN_LISTING: "Your own listing — remove to continue",
};

// --- Small helpers -------------------------------------------------------------------

/** First product image URL (or null → placeholder). */
export function firstImageUrl(
  images?: { url?: string }[] | null
): string | null {
  const url = images && images.length > 0 ? images[0]?.url : null;
  return url || null;
}

/** Friendly date, e.g. "3 Jul 2026". */
export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Friendly date + time, e.g. "3 Jul 2026, 09:14". */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
