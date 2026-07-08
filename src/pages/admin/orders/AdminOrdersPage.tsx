/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin Orders ops console (`/bennie/orders`).
 *
 * Server-paginated table over ALL marketplace orders (platform + merchant) with
 * faceted filters (seller type, fulfilment status, payment status, date range,
 * amount range, buyer-confirmed) and search by order # / checkout group / buyer.
 * Rows deep-link to the order detail page. Reads `productId` / `merchantId` /
 * `checkoutGroupId` query params (from cross-section deep-links). Server-backed
 * via `adminOrdersStore`, permission-aware, light/dark aware.
 */

import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Receipt, Search } from "lucide-react";

import PermissionGate from "../../../components/admin/PermissionGate";
import { useAdminOrdersStore } from "../../../store/adminOrdersStore";
import type {
  AdminOrderListFilters,
  FulfillmentStatus,
  OrderPaymentStatus,
  SellerType,
} from "../../../types/adminMarketplace";
import {
  EmptyBlock,
  ErrorBlock,
  FulfillmentChip,
  LoadingBlock,
  Pager,
  PaymentChip,
  SourcePill,
  dateTimeLabel,
  ngn,
} from "../marketplace/components/shared";

const SELLER_CHIPS: (SellerType | "")[] = ["", "PLATFORM", "MERCHANT"];
const FULFILLMENT_CHIPS: (FulfillmentStatus | "")[] = [
  "",
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];
const PAYMENT_CHIPS: (OrderPaymentStatus | "")[] = [
  "",
  "PAID",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];

export default function AdminOrdersPage() {
  const reduce = useReducedMotion();
  const [params] = useSearchParams();

  const orders = useAdminOrdersStore((s) => s.orders);
  const status = useAdminOrdersStore((s) => s.ordersStatus);
  const error = useAdminOrdersStore((s) => s.ordersError);
  const total = useAdminOrdersStore((s) => s.ordersTotal);
  const page = useAdminOrdersStore((s) => s.ordersPage);
  const limit = useAdminOrdersStore((s) => s.ordersLimit);
  const filters = useAdminOrdersStore((s) => s.orderFilters);
  const setFilters = useAdminOrdersStore((s) => s.setOrderFilters);
  const fetchOrders = useAdminOrdersStore((s) => s.fetchOrders);

  const [search, setSearch] = useState("");

  // Honour cross-section deep-links (?productId, ?merchantId, ?checkoutGroupId).
  useEffect(() => {
    const productId = params.get("productId") || undefined;
    const merchantId = params.get("merchantId") || undefined;
    const checkoutGroupId = params.get("checkoutGroupId") || undefined;
    setFilters({ productId, merchantId, checkoutGroupId, page: 1 });
    void fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const apply = (patch: Partial<AdminOrderListFilters>) => {
    setFilters({ ...patch, page: 1 });
    void fetchOrders();
  };
  const goPage = (p: number) => {
    setFilters({ page: p });
    void fetchOrders();
  };
  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    // A CHK_ prefix routes to the checkout-group filter; otherwise order number.
    if (q.startsWith("CHK_")) apply({ checkoutGroupId: q, orderNumber: undefined });
    else apply({ orderNumber: q || undefined, checkoutGroupId: undefined });
  };

  return (
    <PermissionGate anyOf={["orders:view"]}>
      <div className="space-y-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-display text-2xl font-semibold text-ink">Orders</h1>
          <p className="mt-1 text-sm text-muted">
            Cross-seller control room — every platform and merchant order, with
            fulfilment override, cancellation and refunds.
          </p>
        </motion.div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {SELLER_CHIPS.map((s) => (
                <button
                  key={s || "ALL"}
                  type="button"
                  onClick={() => apply({ sellerType: (s || undefined) as SellerType })}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    (filters.sellerType ?? "") === s
                      ? "bg-primary text-white"
                      : "bg-primary/8 text-primary hover:bg-primary/15"
                  }`}
                >
                  {s ? (s === "PLATFORM" ? "Platform" : "Merchant") : "All sellers"}
                </button>
              ))}
            </div>
            <form
              onSubmit={onSearch}
              className="relative ml-auto min-w-[220px] flex-1 sm:max-w-sm"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order # or CHK_ group…"
                className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </form>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FULFILLMENT_CHIPS.map((f) => (
              <button
                key={f || "ALL_F"}
                type="button"
                onClick={() =>
                  apply({ fulfillmentStatus: (f || undefined) as FulfillmentStatus })
                }
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  (filters.fulfillmentStatus ?? "") === f
                    ? "bg-primary text-white"
                    : "bg-primary/8 text-primary hover:bg-primary/15"
                }`}
              >
                {f ? f.charAt(0) + f.slice(1).toLowerCase() : "Any status"}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PAYMENT_CHIPS.map((pmt) => (
              <button
                key={pmt || "ALL_P"}
                type="button"
                onClick={() =>
                  apply({ paymentStatus: (pmt || undefined) as OrderPaymentStatus })
                }
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  (filters.paymentStatus ?? "") === pmt
                    ? "bg-primary text-white"
                    : "bg-primary/8 text-primary hover:bg-primary/15"
                }`}
              >
                {pmt ? pmt.replace(/_/g, " ").toLowerCase() : "Any payment"}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-[11px] text-muted">
              From
              <input
                type="date"
                value={filters.startDate?.slice(0, 10) ?? ""}
                onChange={(e) =>
                  apply({
                    startDate: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
                className="rounded-xl border border-border bg-surface px-2 py-1 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted">
              To
              <input
                type="date"
                value={filters.endDate?.slice(0, 10) ?? ""}
                onChange={(e) =>
                  apply({
                    endDate: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
                className="rounded-xl border border-border bg-surface px-2 py-1 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </label>
          </div>

          {(filters.productId || filters.merchantId || filters.checkoutGroupId) && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <span>Scoped by deep-link:</span>
              {filters.checkoutGroupId && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-primary">
                  {filters.checkoutGroupId}
                </span>
              )}
              {filters.merchantId && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  merchant
                </span>
              )}
              {filters.productId && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  product
                </span>
              )}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() =>
                  apply({
                    productId: undefined,
                    merchantId: undefined,
                    checkoutGroupId: undefined,
                  })
                }
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {status === "loading" && <LoadingBlock label="Loading orders" />}
        {status === "error" && (
          <ErrorBlock
            message={error ?? "Unable to load orders."}
            onRetry={() => void fetchOrders()}
          />
        )}
        {status === "ready" && orders.length === 0 && (
          <EmptyBlock
            icon={Receipt}
            title="No orders match"
            hint="Adjust the filters to widen the search."
          />
        )}

        {status === "ready" && orders.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-border bg-surface/70">
            <div className="hidden grid-cols-[1.1fr_1.2fr_1.3fr_0.7fr_1fr_1.4fr] gap-3 border-b border-border px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted lg:grid">
              <span>Order</span>
              <span>Buyer</span>
              <span>Seller</span>
              <span>Total</span>
              <span>Payment</span>
              <span>Fulfilment · Placed</span>
            </div>
            <ul className="divide-y divide-border">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    to={`/bennie/orders/${o.id}`}
                    className="grid grid-cols-1 gap-2 px-5 py-3.5 transition hover:bg-primary/[0.03] lg:grid-cols-[1.1fr_1.2fr_1.3fr_0.7fr_1fr_1.4fr] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-ink">
                        {o.orderNumber}
                      </p>
                      <p className="truncate text-[10px] text-muted">
                        {o.itemCount} item(s)
                      </p>
                    </div>
                    <span className="truncate text-sm text-ink">{o.buyer?.name}</span>
                    <div className="flex items-center gap-2">
                      <SourcePill source={o.seller?.type} />
                      <span className="truncate text-xs text-muted">
                        {o.seller?.businessName ?? o.seller?.displayName ?? ""}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-ink">{ngn(o.total)}</span>
                    <span>
                      <PaymentChip status={o.paymentStatus} />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <FulfillmentChip status={o.fulfillmentStatus} />
                      <span className="text-[11px] text-muted">
                        {dateTimeLabel(o.createdAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Pager page={page} limit={limit} total={total} onPage={goPage} />
      </div>
    </PermissionGate>
  );
}
