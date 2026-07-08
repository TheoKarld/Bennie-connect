/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * My bookings — the user's equipment bookings with per-status lifecycle CTAs:
 *   PENDING   → "Awaiting admin approval"
 *   APPROVED  → "Pay from wallet ({totalCost})"  (opens PaymentConfirmModal)
 *   CONFIRMED → "Awaiting handover"
 *   IN_USE    → "Track live"                       (opens the tracking page)
 *   COMPLETED → "Rate"                             (opens RateBookingModal)
 *   + Cancel where allowed (PENDING/APPROVED/CONFIRMED).
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Wallet,
  Navigation,
  Star,
  Hourglass,
  PackageCheck,
  RefreshCw,
  AlertCircle,
  ClipboardList,
  MapPin,
  Ban,
} from "lucide-react";

import { Button, Spinner, pushToast } from "../../../components/ui";
import { formatNaira } from "../../../lib/format";
import { useEquipmentStore } from "../../../store/equipmentStore";
import type { EquipmentBooking } from "../../../types/equipment";
import BookingStatusBadge from "./components/BookingStatusBadge";
import PaymentConfirmModal from "./components/PaymentConfirmModal";
import RateBookingModal from "./components/RateBookingModal";
import { CATEGORY_META, formatWindow } from "./components/equipmentMeta";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "To pay" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "IN_USE", label: "In use" },
  { key: "COMPLETED", label: "Completed" },
];

const CANCELLABLE = new Set(["PENDING", "APPROVED", "CONFIRMED"]);

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function MyBookingsPage() {
  const navigate = useNavigate();

  const myBookings = useEquipmentStore((s) => s.myBookings);
  const bookingsStatus = useEquipmentStore((s) => s.bookingsStatus);
  const bookingsError = useEquipmentStore((s) => s.bookingsError);
  const fetchMyBookings = useEquipmentStore((s) => s.fetchMyBookings);
  const cancelBooking = useEquipmentStore((s) => s.cancelBooking);

  const [tab, setTab] = useState("");
  const [payTarget, setPayTarget] = useState<EquipmentBooking | null>(null);
  const [rateTarget, setRateTarget] = useState<EquipmentBooking | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    void fetchMyBookings();
  }, [fetchMyBookings]);

  const filtered = useMemo(
    () => (tab ? myBookings.filter((b) => b.status === tab) : myBookings),
    [myBookings, tab]
  );

  const handleCancel = async (b: EquipmentBooking) => {
    const confirmMsg =
      b.status === "CONFIRMED"
        ? "Cancel this confirmed booking? A refund is issued to your wallet per the cancellation policy."
        : "Cancel this booking request?";
    if (!window.confirm(confirmMsg)) return;
    setCancelling(b.id);
    try {
      await cancelBooking(b.id);
      pushToast({
        title: "Booking cancelled",
        message:
          b.status === "CONFIRMED"
            ? "Any eligible refund is on its way to your wallet."
            : "Your request has been cancelled.",
        tone: "info",
      });
    } catch (err) {
      pushToast({
        title: "Could not cancel",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setCancelling(null);
    }
  };

  /** The primary status-driven CTA for a booking. */
  const renderPrimaryCta = (b: EquipmentBooking) => {
    switch (b.status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Hourglass className="h-4 w-4" /> Awaiting admin approval
          </span>
        );
      case "APPROVED":
        return (
          <Button size="sm" onClick={() => setPayTarget(b)}>
            <Wallet className="h-4 w-4" /> Pay {formatNaira(b.totalCost)}
          </Button>
        );
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <PackageCheck className="h-4 w-4" /> Awaiting handover
          </span>
        );
      case "IN_USE":
      case "OVERDUE":
        return (
          <Button
            size="sm"
            onClick={() => navigate(`/app/equipment/bookings/${b.id}/track`)}
          >
            <Navigation className="h-4 w-4" /> Track live
          </Button>
        );
      case "COMPLETED":
        return typeof b.rating === "number" && b.rating > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Star className="h-4 w-4 fill-accent text-accent" /> Rated{" "}
            {b.rating}/5
          </span>
        ) : (
          <Button size="sm" variant="accent" onClick={() => setRateTarget(b)}>
            <Star className="h-4 w-4" /> Rate
          </Button>
        );
      case "REJECTED":
        return (
          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
            {b.rejectionReason || "Request rejected"}
          </span>
        );
      default:
        return null;
    }
  };

  const name = (b: EquipmentBooking) =>
    b.equipment?.equipmentName ?? b.equipmentName ?? "Equipment";
  const category = (b: EquipmentBooking) =>
    b.equipment?.category ?? b.equipmentCategory ?? "OTHER";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/app/equipment")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-2 text-muted transition hover:text-ink"
            aria-label="Back to fleet"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div>
            <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
              <ClipboardList className="h-5 w-5 text-primary" /> My bookings
            </h1>
            <p className="text-xs text-muted">
              Track each booking through its lifecycle.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/app/equipment")}>
          Browse fleet
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const active = tab === t.key;
          const count = t.key
            ? myBookings.filter((b) => b.status === t.key).length
            : myBookings.length;
          return (
            <button
              key={t.key || "all"}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                active
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border bg-surface text-muted hover:text-ink"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? "bg-white/20" : "bg-surface-2 text-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {bookingsStatus === "loading" && myBookings.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner label="Loading your bookings" />
        </div>
      ) : bookingsStatus === "error" && myBookings.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm font-semibold text-ink">
            Couldn&apos;t load your bookings
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            {bookingsError}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => fetchMyBookings()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-ink">
            {tab ? "No bookings in this state" : "No bookings yet"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            Browse the fleet and request a booking to get started.
          </p>
          <Button
            className="mt-4"
            onClick={() => navigate("/app/equipment")}
          >
            Browse fleet
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b, i) => {
            const meta = CATEGORY_META[category(b)] ?? CATEGORY_META.OTHER;
            const Icon = meta.icon;
            const image = b.equipment?.images?.[0];
            return (
              <Reveal key={b.id} delay={0.03 * i}>
                <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5 shadow-sm transition hover:border-primary/25 sm:flex-row sm:items-center">
                  {/* Thumb */}
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-2">
                    {image ? (
                      <img
                        src={image}
                        alt={name(b)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon className="h-7 w-7 text-muted" />
                    )}
                  </div>

                  {/* Info */}
                  <button
                    onClick={() =>
                      navigate(`/app/equipment/bookings/${b.id}/track`)
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-display text-base font-semibold text-ink">
                        {name(b)}
                      </h3>
                      <BookingStatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      {b.bookingReference}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>{formatWindow(b.startDate, b.endDate)}</span>
                      {b.pickupLocation?.address && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary" />
                          <span className="max-w-[180px] truncate">
                            {b.pickupLocation.address}
                          </span>
                        </span>
                      )}
                      <span className="font-semibold text-ink">
                        {formatNaira(b.totalCost)}
                      </span>
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    {renderPrimaryCta(b)}
                    {CANCELLABLE.has(b.status) && (
                      <button
                        onClick={() => handleCancel(b)}
                        disabled={cancelling === b.id}
                        className="inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-muted transition hover:text-red-500 disabled:opacity-50"
                      >
                        <Ban className="h-3 w-3" />
                        {cancelling === b.id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}

      <PaymentConfirmModal
        open={!!payTarget}
        booking={payTarget}
        onClose={() => setPayTarget(null)}
        onPaid={() => setPayTarget(null)}
      />
      <RateBookingModal
        open={!!rateTarget}
        booking={rateTarget}
        onClose={() => setRateTarget(null)}
      />
    </div>
  );
}
