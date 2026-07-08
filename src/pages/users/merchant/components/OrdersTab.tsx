/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Merchant Hub — Orders tab: the merchant's received-order queue with guarded
 * forward-only advance actions ("Start processing" → "Mark shipped" → "Mark
 * delivered", DELIVERED books earnings) and confirm dialogs
 * (merchant_panel.md §6.4).
 */

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  RefreshCw,
  Inbox,
  MapPin,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

import { Button, Modal, pushToast } from "../../../../components/ui";
import { formatNaira } from "../../../../lib/format";
import { useMerchantStore } from "../../../../store/merchantStore";
import type { MerchantOrder } from "../../../../types/merchant";
import type { FulfillmentStatus } from "../../../../types/marketplace";
import {
  OrderStatusChip,
  formatDateTime,
} from "../../marketplace/components/marketplaceMeta";

const NEXT_STEP: Partial<
  Record<
    FulfillmentStatus,
    { to: "PROCESSING" | "SHIPPED" | "DELIVERED"; label: string }
  >
> = {
  PENDING: { to: "PROCESSING", label: "Start processing" },
  PROCESSING: { to: "SHIPPED", label: "Mark shipped" },
  SHIPPED: { to: "DELIVERED", label: "Mark delivered" },
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

function OrderCard({
  order,
  onAdvance,
}: {
  order: MerchantOrder;
  onAdvance: (order: MerchantOrder) => void;
}) {
  const next = NEXT_STEP[order.status];
  const confirmed = Boolean(order.buyerConfirmedAt || order.confirmedReceivedAt);

  return (
    <div className="space-y-3 rounded-3xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-muted">{order.orderNumber}</p>
          <p className="text-sm font-semibold text-ink">
            {order.buyerName || "Member"} ·{" "}
            <span className="font-mono">{formatNaira(order.totalAmount)}</span>
          </p>
          {typeof order.merchantNet === "number" && (
            <p className="text-[11px] font-semibold text-primary">
              You earn {formatNaira(order.merchantNet)}
              {typeof order.platformFee === "number" && order.platformFee > 0
                ? ` (after ${formatNaira(order.platformFee)} platform fee)`
                : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {confirmed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> Received
            </span>
          )}
          <OrderStatusChip status={order.status} />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1 rounded-2xl bg-surface-2/70 px-3.5 py-2.5">
        {order.items.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="min-w-0 truncate text-ink">
              {item.productName}
              <span className="ml-1 font-mono text-muted">× {item.quantity}</span>
            </span>
            <span className="shrink-0 font-mono font-semibold text-ink">
              {formatNaira(item.subtotal)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{order.deliveryAddress}</span>
        </p>
        <p className="text-[11px] text-muted">
          Placed {formatDateTime(order.createdAt)}
        </p>
      </div>

      {next && (
        <div className="border-t border-border pt-3">
          <Button size="sm" onClick={() => onAdvance(order)}>
            {next.label} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function OrdersTab() {
  const orders = useMerchantStore((s) => s.orders);
  const status = useMerchantStore((s) => s.ordersStatus);
  const error = useMerchantStore((s) => s.ordersError);
  const fetchOrders = useMerchantStore((s) => s.fetchOrders);
  const advanceOrder = useMerchantStore((s) => s.advanceOrder);

  const [filter, setFilter] = useState("");
  const [advancing, setAdvancing] = useState<MerchantOrder | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchOrders({ status: filter || undefined });
  }, [fetchOrders, filter]);

  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const next = advancing ? NEXT_STEP[advancing.status] : undefined;

  const confirmAdvance = async () => {
    if (!advancing || !next) return;
    setBusy(true);
    try {
      await advanceOrder(advancing.id, next.to);
      pushToast({
        title:
          next.to === "DELIVERED" ? "Order delivered" : "Order updated",
        message:
          next.to === "DELIVERED"
            ? `${formatNaira(advancing.merchantNet ?? advancing.totalAmount)} booked to your earnings.`
            : `${advancing.orderNumber} is now ${next.to}.`,
        tone: "success",
      });
      setAdvancing(null);
    } catch (err) {
      pushToast({
        title: "Order",
        message: (err as Error)?.message || "Could not update this order.",
        tone: "alert",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const count = f.value ? counts[f.value] : orders.length;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                active
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-muted hover:border-primary/25 hover:text-ink"
              }`}
            >
              {f.label}
              {!filter && count ? ` · ${count}` : ""}
            </button>
          );
        })}
      </div>

      {status === "loading" && orders.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-3xl bg-surface-2" />
          ))}
        </div>
      ) : status === "error" && orders.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface py-14 text-center">
          <AlertCircle className="mx-auto mb-2 h-6 w-6 text-danger" />
          <p className="text-sm font-semibold text-ink">
            Couldn&apos;t load your orders
          </p>
          <p className="mt-1 text-xs text-muted">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void fetchOrders({ status: filter || undefined })}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
            <Inbox className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-ink">No orders yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            Orders on your approved listings appear here for fulfilment.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} onAdvance={setAdvancing} />
          ))}
        </div>
      )}

      {/* Advance confirm modal */}
      <Modal
        open={Boolean(advancing)}
        onClose={() => !busy && setAdvancing(null)}
        title={next?.label}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {next?.to === "DELIVERED" ? (
              <>
                Confirm{" "}
                <span className="font-mono font-semibold text-ink">
                  {advancing?.orderNumber}
                </span>{" "}
                has been delivered to the buyer. This books{" "}
                <span className="font-mono font-bold text-primary">
                  {formatNaira(
                    advancing?.merchantNet ?? advancing?.totalAmount ?? 0
                  )}
                </span>{" "}
                to your earnings and cannot be reversed.
              </>
            ) : (
              <>
                Move{" "}
                <span className="font-mono font-semibold text-ink">
                  {advancing?.orderNumber}
                </span>{" "}
                to <span className="font-bold text-ink">{next?.to}</span>? The
                buyer is notified immediately. Fulfilment only moves forward.
              </>
            )}
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setAdvancing(null)}
            >
              Not yet
            </Button>
            <Button loading={busy} onClick={() => void confirmAdvance()}>
              {next?.label}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
