/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin order detail (`/bennie/orders/:id`).
 *
 * Items + pricing breakdown, buyer card (→ User 360), payment card (refunds
 * history + remaining refundable), fulfilment stepper timeline with actor
 * badges, the checkout-group ribbon of sibling orders, and guarded actions:
 * advance / override fulfilment (backward = corrective, note forced), cancel
 * (reason + restock, mandatory refund banner), and refund (amount + reason +
 * restock — hidden without `orders:refund`, Super-Admin-only). Server-backed via
 * `adminOrdersStore`, permission-aware, light/dark aware.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Layers,
  MapPin,
  Package,
  Truck,
  User,
} from "lucide-react";

import {
  Modal,
  Field,
  Input,
  Button,
  pushToast,
} from "../../../components/ui";
import PermissionGate from "../../../components/admin/PermissionGate";
import { useAdminAuth } from "../../../hooks/useAdminAuth";
import { useAdminOrdersStore } from "../../../store/adminOrdersStore";
import type { FulfillmentStatus } from "../../../types/adminMarketplace";
import ReasonModal from "../marketplace/components/ReasonModal";
import {
  ErrorBlock,
  FulfillmentChip,
  InfoRow,
  LoadingBlock,
  PaymentChip,
  SourcePill,
  dateTimeLabel,
  ngn,
  titleCase,
} from "../marketplace/components/shared";

const FLOW: FulfillmentStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];

function addressLine(
  addr: AdminOrderAddress | string | undefined
): string {
  if (!addr) return "—";
  if (typeof addr === "string") return addr;
  return [addr.street, addr.city, addr.state].filter(Boolean).join(", ") || "—";
}
type AdminOrderAddress = {
  name?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
};

export default function AdminOrderDetailPage() {
  const { id = "" } = useParams();
  const reduce = useReducedMotion();

  const detail = useAdminOrdersStore((s) => s.detail);
  const status = useAdminOrdersStore((s) => s.detailStatus);
  const error = useAdminOrdersStore((s) => s.detailError);
  const group = useAdminOrdersStore((s) => s.group);
  const loadOrder = useAdminOrdersStore((s) => s.loadOrder);
  const loadCheckoutGroup = useAdminOrdersStore((s) => s.loadCheckoutGroup);
  const clearDetail = useAdminOrdersStore((s) => s.clearDetail);
  const updateFulfillment = useAdminOrdersStore((s) => s.updateFulfillment);
  const cancelOrder = useAdminOrdersStore((s) => s.cancelOrder);
  const refundOrder = useAdminOrdersStore((s) => s.refundOrder);

  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("orders:update");
  const canRefund = hasPermission("orders:refund");

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState<FulfillmentStatus>("PROCESSING");
  const [advanceNote, setAdvanceNote] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [advancing, setAdvancing] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [restockCancel, setRestockCancel] = useState(true);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [restockRefund, setRestockRefund] = useState(false);
  const [overrideWindow, setOverrideWindow] = useState(false);

  useEffect(() => {
    if (id) void loadOrder(id);
    return () => clearDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (detail?.checkoutGroupId) void loadCheckoutGroup(detail.checkoutGroupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.checkoutGroupId]);

  const remaining = useMemo(() => {
    if (!detail) return 0;
    if (detail.remainingRefundable != null) return detail.remainingRefundable;
    return (detail.pricing?.total ?? detail.totalAmount ?? 0) - (detail.refundedTotal ?? 0);
  }, [detail]);

  const fromIdx = detail ? FLOW.indexOf(detail.fulfillmentStatus) : -1;
  const isCorrective = FLOW.indexOf(advanceTarget) < fromIdx;

  const submitAdvance = async () => {
    if (!detail) return;
    if (isCorrective && advanceNote.trim().length < 5) {
      pushToast({
        tone: "alert",
        title: "Note required",
        message: "Corrective (backward) moves need a note of at least 5 characters.",
      });
      return;
    }
    setAdvancing(true);
    try {
      await updateFulfillment(detail.id, {
        fulfillmentStatus: advanceTarget,
        note: advanceNote.trim() || undefined,
        trackingInfo:
          carrier || trackingNumber
            ? { carrier: carrier || undefined, trackingNumber: trackingNumber || undefined }
            : undefined,
      });
      pushToast({ tone: "success", title: `Marked ${titleCase(advanceTarget)}` });
      setAdvanceOpen(false);
      setAdvanceNote("");
      setCarrier("");
      setTrackingNumber("");
    } catch (err) {
      pushToast({
        tone: "alert",
        title: "Update failed",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setAdvancing(false);
    }
  };

  const submitCancel = async (reason: string) => {
    if (!detail) return;
    await cancelOrder(detail.id, { reason, restock: restockCancel });
    pushToast({ tone: "success", title: "Order cancelled & refunded" });
  };

  const submitRefund = async (reason: string) => {
    if (!detail) return;
    const amt = refundAmount ? Number(refundAmount) : undefined;
    const result = await refundOrder(detail.id, {
      amount: amt,
      reason,
      restock: restockRefund,
      overrideWindow,
    });
    pushToast({
      tone: "success",
      title: result.paymentStatus === "REFUNDED" ? "Order refunded" : "Partial refund credited",
      message: `${ngn(result.refund.amount)} to the buyer's wallet.`,
    });
    setRefundAmount("");
    setRestockRefund(false);
    setOverrideWindow(false);
  };

  const canCancel =
    detail && ["PENDING", "PROCESSING", "SHIPPED"].includes(detail.fulfillmentStatus);
  const isMerchant = detail?.seller?.type === "MERCHANT";

  return (
    <PermissionGate anyOf={["orders:view"]}>
      <div className="space-y-6">
        <Link
          to="/bennie/orders"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>

        {status === "loading" && <LoadingBlock label="Loading order" />}
        {status === "error" && (
          <ErrorBlock
            message={error ?? "Unable to load this order."}
            onRetry={() => void loadOrder(id)}
          />
        )}

        {status === "ready" && detail && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-mono text-xl font-semibold text-ink">
                    {detail.orderNumber}
                  </h1>
                  <SourcePill source={detail.seller?.type} />
                  <FulfillmentChip status={detail.fulfillmentStatus} />
                  <PaymentChip status={detail.paymentStatus} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {detail.seller?.businessName ?? detail.seller?.displayName ?? ""} · placed{" "}
                  {dateTimeLabel(detail.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canUpdate && detail.fulfillmentStatus !== "CANCELLED" && (
                  <Button size="sm" variant="secondary" onClick={() => setAdvanceOpen(true)}>
                    <Truck className="h-4 w-4" /> Update status
                  </Button>
                )}
                {canUpdate && canCancel && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="!text-danger hover:!bg-danger/5"
                    onClick={() => setCancelOpen(true)}
                  >
                    <Ban className="h-4 w-4" /> Cancel
                  </Button>
                )}
                {canRefund && (
                  <Button
                    size="sm"
                    className="!bg-danger hover:!brightness-95"
                    onClick={() => setRefundOpen(true)}
                    disabled={remaining <= 0}
                  >
                    <CircleDollarSign className="h-4 w-4" /> Refund
                  </Button>
                )}
              </div>
            </div>

            {/* Checkout-group ribbon */}
            {group && group.orders.length > 1 && (
              <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-ink">
                    Checkout group — {group.orders.length} sibling orders ·{" "}
                    {ngn(group.grandTotal)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.orders.map((o) => (
                    <Link
                      key={o.id}
                      to={`/bennie/orders/${o.id}`}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                        o.id === detail.id
                          ? "bg-primary text-white"
                          : "bg-primary/8 text-primary hover:bg-primary/15"
                      }`}
                    >
                      {o.seller?.businessName ?? o.seller?.displayName ?? "Seller"} ·{" "}
                      {ngn(o.totalAmount ?? o.pricing?.total)}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Left column */}
              <div className="space-y-4 lg:col-span-2">
                {/* Items */}
                <div className="rounded-3xl border border-border bg-surface/70 p-5">
                  <h3 className="mb-3 font-display text-sm font-semibold text-ink">
                    Items
                  </h3>
                  <ul className="divide-y divide-border">
                    {detail.items.map((it, i) => (
                      <li key={i} className="flex items-center gap-3 py-3">
                        {it.imageUrl ? (
                          <img
                            src={it.imageUrl}
                            alt={it.productName}
                            className="h-12 w-12 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-border/40 text-muted">
                            <Package className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {it.productName}
                          </p>
                          <p className="text-[11px] text-muted">
                            {it.quantity} × {ngn(it.unitPrice)} · {it.unit}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-ink">
                          {ngn(it.subtotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 space-y-1 border-t border-border pt-3">
                    <InfoRow label="Subtotal" value={ngn(detail.pricing?.subtotal)} />
                    <InfoRow label="Delivery fee" value={ngn(detail.pricing?.deliveryFee ?? 0)} />
                    <InfoRow label="Total" value={ngn(detail.pricing?.total ?? detail.totalAmount)} />
                    {isMerchant && (
                      <>
                        <InfoRow
                          label={`Platform fee (${detail.pricing?.platformFeePercent ?? 0}%)`}
                          value={ngn(detail.pricing?.platformFee)}
                        />
                        <InfoRow
                          label="Merchant net"
                          value={
                            detail.seller?.merchantId ? (
                              <Link
                                to={`/bennie/merchants/${detail.seller.merchantId}?tab=earnings`}
                                className="text-primary hover:underline"
                              >
                                {ngn(detail.pricing?.merchantNet)}
                              </Link>
                            ) : (
                              ngn(detail.pricing?.merchantNet)
                            )
                          }
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Fulfilment timeline */}
                <div className="rounded-3xl border border-border bg-surface/70 p-5">
                  <h3 className="mb-4 font-display text-sm font-semibold text-ink">
                    Fulfilment timeline
                  </h3>
                  {/* Stepper */}
                  <div className="mb-5 flex items-center gap-1">
                    {FLOW.map((s, i) => {
                      const reachedIdx = FLOW.indexOf(detail.fulfillmentStatus);
                      const done =
                        detail.fulfillmentStatus !== "CANCELLED" && i <= reachedIdx;
                      return (
                        <React.Fragment key={s}>
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                                done
                                  ? "bg-primary text-white"
                                  : "bg-surface-2 text-muted"
                              }`}
                            >
                              {i + 1}
                            </span>
                            <span className="hidden text-[9px] font-semibold text-muted sm:inline">
                              {titleCase(s)}
                            </span>
                          </div>
                          {i < FLOW.length - 1 && (
                            <span
                              className={`h-px flex-1 ${
                                done && i < reachedIdx ? "bg-primary" : "bg-border"
                              }`}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {detail.fulfillmentStatus === "CANCELLED" && (
                    <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                      This order was cancelled.
                      {detail.cancellationReason ? ` ${detail.cancellationReason}` : ""}
                    </p>
                  )}
                  <ol className="space-y-3">
                    {detail.timeline?.map((t, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                        <div>
                          <p className="text-sm font-semibold text-ink">
                            {titleCase(t.status)}
                            <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted">
                              {t.actorType}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted">{dateTimeLabel(t.at)}</p>
                          {t.note && <p className="mt-0.5 text-xs text-muted">{t.note}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                  {detail.buyerConfirmedAt && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary/[0.06] px-3 py-2 text-xs text-primary">
                      <CheckCircle2 className="h-4 w-4" /> Buyer confirmed receipt ·{" "}
                      {dateTimeLabel(detail.buyerConfirmedAt)}
                    </div>
                  )}
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Buyer */}
                <div className="rounded-3xl border border-border bg-surface/70 p-5">
                  <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-ink">
                    <User className="h-4 w-4 text-primary" /> Buyer
                  </h3>
                  <p className="text-sm font-semibold text-ink">{detail.buyer?.name}</p>
                  {detail.buyer?.phone && (
                    <p className="text-[11px] text-muted">{detail.buyer.phone}</p>
                  )}
                  <Link
                    to={`/bennie/users/${detail.buyer?.id}`}
                    className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                  >
                    Open User 360 →
                  </Link>
                </div>

                {/* Shipping */}
                <div className="rounded-3xl border border-border bg-surface/70 p-5">
                  <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-ink">
                    <MapPin className="h-4 w-4 text-primary" /> Delivery
                  </h3>
                  <p className="text-sm text-ink">{addressLine(detail.deliveryAddress)}</p>
                  {detail.trackingInfo?.trackingNumber && (
                    <p className="mt-1.5 text-[11px] text-muted">
                      {detail.trackingInfo.carrier} ·{" "}
                      <span className="font-mono">{detail.trackingInfo.trackingNumber}</span>
                    </p>
                  )}
                </div>

                {/* Payment */}
                <div className="rounded-3xl border border-border bg-surface/70 p-5">
                  <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-ink">
                    <CircleDollarSign className="h-4 w-4 text-primary" /> Payment
                  </h3>
                  <InfoRow
                    label="Wallet ref"
                    value={<span className="font-mono text-xs">{detail.walletPaymentRef ?? "—"}</span>}
                  />
                  <InfoRow label="Refunded" value={ngn(detail.refundedTotal ?? 0)} />
                  <InfoRow label="Remaining refundable" value={ngn(remaining)} />
                  {detail.refunds && detail.refunds.length > 0 && (
                    <ul className="mt-3 space-y-2 border-t border-border pt-3">
                      {detail.refunds.map((r, i) => (
                        <li key={i} className="text-[11px] text-muted">
                          <span className="font-semibold text-ink">{ngn(r.amount)}</span> ·{" "}
                          {r.reason} · {dateTimeLabel(r.at)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Advance / override status modal */}
        <Modal
          open={advanceOpen}
          onClose={() => setAdvanceOpen(false)}
          title="Update fulfilment"
        >
          <div className="space-y-4">
            <Field label="New status" htmlFor="adv-status">
              <select
                id="adv-status"
                value={advanceTarget}
                onChange={(e) => setAdvanceTarget(e.target.value as FulfillmentStatus)}
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                {FLOW.map((s) => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </select>
            </Field>
            {isCorrective && (
              <p className="rounded-xl bg-accent/12 px-3 py-2 text-xs font-medium text-[#a6701c] dark:text-accent">
                Corrective (backward) move — a note is required and this is audited
                high-severity.
              </p>
            )}
            <Field
              label={isCorrective ? "Note (required)" : "Note (optional)"}
              htmlFor="adv-note"
            >
              <textarea
                id="adv-note"
                value={advanceNote}
                onChange={(e) => setAdvanceNote(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                placeholder="Context for the audit trail…"
              />
            </Field>
            {advanceTarget === "SHIPPED" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Carrier" htmlFor="adv-carrier">
                  <Input
                    id="adv-carrier"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="GIG"
                  />
                </Field>
                <Field label="Tracking #" htmlFor="adv-track">
                  <Input
                    id="adv-track"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="GIG-88213"
                  />
                </Field>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAdvanceOpen(false)}>
                Cancel
              </Button>
              <Button type="button" loading={advancing} onClick={submitAdvance}>
                Update status
              </Button>
            </div>
          </div>
        </Modal>

        {/* Cancel modal */}
        <ReasonModal
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          title="Cancel order"
          confirmLabel="Cancel & refund"
          tone="danger"
          description={
            detail
              ? `Cancelling refunds ${ngn(
                  detail.pricing?.total ?? detail.totalAmount
                )} to the buyer's wallet immediately.`
              : undefined
          }
          extra={
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={restockCancel}
                onChange={(e) => setRestockCancel(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary,#2f6b3f)]"
              />
              Restock the cancelled items
            </label>
          }
          onConfirm={submitCancel}
        />

        {/* Refund modal (Super-Admin-only) */}
        <ReasonModal
          open={refundOpen}
          onClose={() => setRefundOpen(false)}
          title="Refund order"
          confirmLabel="Process refund"
          tone="danger"
          description={
            detail
              ? `Refunds credit the buyer's wallet. Remaining refundable: ${ngn(remaining)}.`
              : undefined
          }
          extra={
            <div className="space-y-3">
              <Field label="Amount (blank = full remaining)" htmlFor="ref-amt">
                <Input
                  id="ref-amt"
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={String(remaining)}
                />
              </Field>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={restockRefund}
                  onChange={(e) => setRestockRefund(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-primary,#2f6b3f)]"
                />
                Restock (full refunds only)
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={overrideWindow}
                  onChange={(e) => setOverrideWindow(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-primary,#2f6b3f)]"
                />
                Override refund window (audited)
              </label>
              {isMerchant && (
                <p className="rounded-xl bg-accent/12 px-3 py-2 text-[11px] text-[#a6701c] dark:text-accent">
                  Refunding a delivered merchant order adjusts the merchant's earnings.
                </p>
              )}
            </div>
          }
          onConfirm={submitRefund}
        />
      </div>
    </PermissionGate>
  );
}
