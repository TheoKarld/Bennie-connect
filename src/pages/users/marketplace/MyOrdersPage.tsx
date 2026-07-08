/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * My orders (`/app/marketplace/orders`) — purchases grouped by
 * checkoutGroupId, filter chips and load-more pagination.
 */

import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { Button } from "../../../components/ui";
import { formatNaira } from "../../../lib/format";
import { useMarketplaceStore } from "../../../store/marketplaceStore";
import CartButton from "./components/CartButton";
import {
  OrderStatusChip,
  SellerBadge,
  formatDateTime,
} from "./components/marketplaceMeta";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function MyOrdersPage() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();

  const groups = useMarketplaceStore((s) => s.orderGroups);
  const total = useMarketplaceStore((s) => s.ordersTotal);
  const status = useMarketplaceStore((s) => s.ordersStatus);
  const error = useMarketplaceStore((s) => s.ordersError);
  const appending = useMarketplaceStore((s) => s.ordersAppending);
  const statusFilter = useMarketplaceStore((s) => s.ordersStatusFilter);
  const setOrdersStatusFilter = useMarketplaceStore(
    (s) => s.setOrdersStatusFilter
  );
  const fetchOrders = useMarketplaceStore((s) => s.fetchOrders);

  useEffect(() => {
    void fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const hasMore = groups.length < total;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/app/marketplace"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Marketplace
        </Link>
        <CartButton />
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          My orders
        </h1>
        <p className="mt-1 text-sm text-muted">
          Each purchase is split into one order per seller — track and manage
          them here.
        </p>
      </div>

      {/* Filter chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const active = statusFilter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setOrdersStatusFilter(f.value)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                active
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-muted hover:border-primary/25 hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {status === "loading" && groups.length === 0 ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-3xl bg-surface-2" />
          ))}
        </div>
      ) : status === "error" && groups.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10">
            <AlertCircle className="h-6 w-6 text-danger" />
          </div>
          <p className="text-sm font-semibold text-ink">
            Couldn&apos;t load your orders
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void fetchOrders()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-ink">No orders yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            Your marketplace purchases will show here, split per seller.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => navigate("/app/marketplace")}
          >
            Browse marketplace
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, gi) => (
            <motion.section
              key={group.checkoutGroupId}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: Math.min(gi, 6) * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="overflow-hidden rounded-3xl border border-border bg-surface"
            >
              {/* Group header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-muted">
                    {group.checkoutGroupId}
                  </p>
                  <p className="text-xs font-semibold text-ink">
                    Placed {formatDateTime(group.placedAt)}
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-primary">
                  {formatNaira(group.grandTotal)}
                </span>
              </div>

              {/* Sub-orders */}
              <div className="divide-y divide-border">
                {group.orders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => navigate(`/app/marketplace/orders/${o.id}`)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-primary/[0.03]"
                  >
                    <div className="min-w-0 space-y-1">
                      <SellerBadge seller={o.seller} />
                      <p className="font-mono text-[11px] text-muted">
                        {o.orderNumber} · {o.itemCount} item
                        {o.itemCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className="hidden font-mono text-xs font-bold text-ink sm:block">
                        {formatNaira(o.totalAmount)}
                      </span>
                      <OrderStatusChip status={o.status} />
                      <ChevronRight className="h-4 w-4 text-muted" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Address footer */}
              <div className="flex items-center gap-1.5 border-t border-border px-5 py-2.5 text-[11px] text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{group.deliveryAddress}</span>
              </div>
            </motion.section>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                loading={appending}
                onClick={() => void fetchOrders({ append: true })}
              >
                Load more ({groups.length} of {total})
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
