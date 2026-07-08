/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Order detail (`/app/marketplace/orders/:id`) — fulfilment stepper timeline
 * rebuilt from the server `timeline`, item snapshots, payment/refund block,
 * cancel-while-PENDING (confirm modal → refund) and confirm-received after
 * DELIVERED. Sibling orders of the checkout group cross-link.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  ImageOff,
  MapPin,
  PackageCheck,
  RefreshCw,
  AlertCircle,
  Ban,
  Wallet,
} from "lucide-react";

import { Button, Modal, pushToast } from "../../../components/ui";
import { formatNaira } from "../../../lib/format";
import { useMarketplaceStore } from "../../../store/marketplaceStore";
import type { FulfillmentStatus } from "../../../types/marketplace";
import {
  OrderStatusChip,
  PaymentChip,
  SellerBadge,
  STATUS_LABELS,
  formatDateTime,
} from "./components/marketplaceMeta";

const FLOW: FulfillmentStatus[] = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

export default function OrderDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const order = useMarketplaceStore((s) => s.order);
  const status = useMarketplaceStore((s) => s.orderStatus);
  const error = useMarketplaceStore((s) => s.orderError);
  const loadOrder = useMarketplaceStore((s) => s.loadOrder);
  const clearOrder = useMarketplaceStore((s) => s.clearOrder);
  const cancelOrder = useMarketplaceStore((s) => s.cancelOrder);
  const confirmReceived = useMarketplaceStore((s) => s.confirmReceived);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (id) void loadOrder(id);
    return () => clearOrder();
  }, [id, loadOrder, clearOrder]);

  const cancelled = order?.status === "CANCELLED";
  const delivered = order?.status === "DELIVERED";
  const confirmed = Boolean(
    order?.buyerConfirmedAt || order?.confirmedReceivedAt
  );
  const currentIdx = order ? FLOW.indexOf(order.status) : -1;

  /** Timestamp for a completed step, from the timeline trail. */
  const stepTime = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of order?.timeline ?? []) {
      if (!map.has(entry.status)) map.set(entry.status, entry.at);
    }
    return map;
  }, [order?.timeline]);

  const doCancel = async () => {
    setActing(true);
    try {
      await cancelOrder(id, cancelReason.trim() || undefined);
      setCancelOpen(false);
      setCancelReason("");
      pushToast({
        title: "Order cancelled",
        message: `${formatNaira(order?.totalAmount ?? 0)} refunded to your wallet.`,
        tone: "success",
      });
    } catch (err) {
      pushToast({
        title: "Cancel order",
        message: (err as Error)?.message || "Could not cancel this order.",
        tone: "alert",
      });
    } finally {
      setActing(false);
    }
  };

  const doConfirm = async () => {
    setActing(true);
    try {
      await confirmReceived(id);
      pushToast({
        title: "Receipt confirmed",
        message: "Thanks — the seller has been notified.",
        tone: "success",
      });
    } catch (err) {
      pushToast({
        title: "Confirm received",
        message: (err as Error)?.message || "Could not confirm receipt.",
        tone: "alert",
      });
    } finally {
      setActing(false);
    }
  };

  if (status === "error" && !order) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="rounded-3xl border border-border bg-surface p-10 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10">
            <AlertCircle className="h-6 w-6 text-danger" />
          </div>
          <p className="text-sm font-semibold text-ink">
            Couldn&apos;t load this order
          </p>
          <p className="mt-1 text-xs text-muted">{error}</p>
          <div className="mt-5 flex justify-center gap-3">
            <Button onClick={() => navigate("/app/marketplace/orders")}>
              <ArrowLeft className="h-4 w-4" /> My orders
            </Button>
            <Button variant="outline" onClick={() => void loadOrder(id)}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-44 animate-pulse rounded-full bg-surface-2" />
        <div className="h-28 animate-pulse rounded-3xl bg-surface-2" />
        <div className="h-56 animate-pulse rounded-3xl bg-surface-2" />
        <div className="h-40 animate-pulse rounded-3xl bg-surface-2" />
      </div>
    );
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-3xl space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/app/marketplace/orders"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> My orders
        </Link>
        <div className="flex items-center gap-2">
          <PaymentChip status={order.paymentStatus} />
          <OrderStatusChip status={order.status} />
        </div>
      </div>

      <div>
        <p className="font-mono text-xs text-muted">{order.orderNumber}</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
          {formatNaira(order.totalAmount)}
        </h1>
        <div className="mt-2">
          <SellerBadge seller={order.seller} />
        </div>
      </div>

      {/* Stepper / cancelled banner */}
      {cancelled ? (
        <div className="rounded-3xl border border-rose-400/40 bg-rose-50/70 p-5 dark:border-rose-400/25 dark:bg-rose-500/5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              <Ban className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                Order cancelled
              </p>
              <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
                {formatDateTime(stepTime.get("CANCELLED"))}
                {order.cancellationReason
                  ? ` — "${order.cancellationReason}"`
                  : ""}
              </p>
            </div>
          </div>
          {order.paymentStatus === "REFUNDED" && (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-rose-100/70 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <Wallet className="h-3.5 w-3.5" />
              {formatNaira(order.refundedTotal ?? order.totalAmount)} refunded
              to your wallet
              {order.refundRef ? (
                <span className="font-mono font-normal opacity-80">
                  · {order.refundRef}
                </span>
              ) : null}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
          <ol className="flex items-start">
            {FLOW.map((step, i) => {
              const done = i <= currentIdx;
              const isLast = i === FLOW.length - 1;
              const time = stepTime.get(step);
              return (
                <li key={step} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    <div
                      className={`h-0.5 flex-1 ${
                        i === 0
                          ? "bg-transparent"
                          : done
                            ? "bg-primary"
                            : "bg-border"
                      }`}
                    />
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition ${
                        done
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-surface text-muted"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <div
                      className={`h-0.5 flex-1 ${
                        isLast
                          ? "bg-transparent"
                          : i < currentIdx
                            ? "bg-primary"
                            : "bg-border"
                      }`}
                    />
                  </div>
                  <p
                    className={`mt-2 text-center text-[11px] font-semibold ${
                      done ? "text-ink" : "text-muted"
                    }`}
                  >
                    {STATUS_LABELS[step]}
                  </p>
                  {done && time && (
                    <p className="mt-0.5 hidden text-center text-[10px] text-muted sm:block">
                      {formatDateTime(time)}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Actions */}
          <div className="mt-5 flex flex-col gap-2.5 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            {order.status === "PENDING" && (
              <>
                <p className="text-xs text-muted">
                  You can cancel while the seller hasn&apos;t started
                  processing — your wallet is refunded immediately.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-danger/40 text-danger hover:bg-danger/5"
                  onClick={() => setCancelOpen(true)}
                >
                  <Ban className="h-3.5 w-3.5" /> Cancel order
                </Button>
              </>
            )}
            {delivered && !confirmed && (
              <>
                <p className="text-xs text-muted">
                  Received your items? Confirm to close this order.
                </p>
                <Button size="sm" loading={acting} onClick={() => void doConfirm()}>
                  <PackageCheck className="h-4 w-4" /> Confirm received
                </Button>
              </>
            )}
            {delivered && confirmed && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" />
                Received on{" "}
                {formatDateTime(
                  order.buyerConfirmedAt ?? order.confirmedReceivedAt
                )}
              </p>
            )}
            {(order.status === "PROCESSING" || order.status === "SHIPPED") && (
              <p className="text-xs text-muted">
                The seller is fulfilling this order. Need help? Contact the
                cooperative.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <section className="rounded-3xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          Items ({order.items.length})
        </h2>
        <div className="divide-y divide-border">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted">
                    <ImageOff className="h-4 w-4 opacity-40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {item.productName}
                </p>
                <p className="font-mono text-[11px] text-muted">
                  {item.quantity} × {formatNaira(item.unitPrice)} · {item.unit}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm font-bold text-ink">
                {formatNaira(item.subtotal)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
          <span className="text-sm font-semibold text-ink">Order total</span>
          <span className="font-mono text-base font-bold text-primary">
            {formatNaira(order.totalAmount)}
          </span>
        </div>
      </section>

      {/* Delivery + payment */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <MapPin className="h-3.5 w-3.5" /> Delivery address
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            {order.deliveryAddress}
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <Wallet className="h-3.5 w-3.5" /> Payment
          </h2>
          <dl className="mt-2 space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Status</dt>
              <dd>
                <PaymentChip status={order.paymentStatus} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 text-muted">Payment ref</dt>
              <dd className="truncate font-mono text-ink">
                {order.walletPaymentRef ?? "—"}
              </dd>
            </div>
            {order.refundRef && (
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-muted">Refund ref</dt>
                <dd className="truncate font-mono text-ink">{order.refundRef}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Placed</dt>
              <dd className="text-ink">{formatDateTime(order.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Sibling orders */}
      {(order.siblingOrders?.length ?? 0) > 0 && (
        <section className="rounded-3xl border border-border bg-surface">
          <h2 className="border-b border-border px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            Also in this purchase
          </h2>
          <div className="divide-y divide-border">
            {order.siblingOrders!.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/app/marketplace/orders/${s.id}`)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-primary/[0.03]"
              >
                <div className="min-w-0 space-y-1">
                  <SellerBadge seller={s.seller} />
                  <p className="font-mono text-[11px] text-muted">
                    {s.orderNumber}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-ink">
                    {formatNaira(s.totalAmount)}
                  </span>
                  <OrderStatusChip status={s.status} />
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Cancel confirm modal */}
      <Modal
        open={cancelOpen}
        onClose={() => !acting && setCancelOpen(false)}
        title="Cancel this order?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            <span className="font-mono font-bold text-ink">
              {formatNaira(order.totalAmount)}
            </span>{" "}
            will be refunded to your wallet immediately and the stock returned
            to the seller. This cannot be undone.
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="Reason (optional)"
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              disabled={acting}
              onClick={() => setCancelOpen(false)}
            >
              Keep order
            </Button>
            <Button
              loading={acting}
              onClick={() => void doCancel()}
              className="bg-danger shadow-danger/20 hover:brightness-110"
            >
              Cancel &amp; refund
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
