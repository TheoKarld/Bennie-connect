/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Live tracking view for one booking — the Google Maps map + an operator / ETA /
 * telemetry panel. Loads the REST tracking snapshot, then folds in live
 * `equipment:position:new` events over the `/rt/user` socket
 * (`useTrackingSocket`). Also drives the per-status CTAs (pay / rate / cancel)
 * for the loaded booking.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Phone,
  Truck,
  Navigation,
  Gauge,
  Clock,
  Radio,
  AlertCircle,
  RefreshCw,
  Wallet,
  Star,
  Ban,
  Hourglass,
  PackageCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Button, Spinner, pushToast } from "../../../components/ui";
import { formatNaira } from "../../../lib/format";
import { useEquipmentStore } from "../../../store/equipmentStore";
import { useTrackingSocket } from "../../../hooks/useTrackingSocket";
import type { EquipmentBooking } from "../../../types/equipment";
import EquipmentTrackingMap from "./components/EquipmentTrackingMap";
import BookingStatusBadge from "./components/BookingStatusBadge";
import PaymentConfirmModal from "./components/PaymentConfirmModal";
import RateBookingModal from "./components/RateBookingModal";
import { formatWindow } from "./components/equipmentMeta";

const CANCELLABLE = new Set(["PENDING", "APPROVED", "CONFIRMED"]);
const TRACKABLE = new Set(["IN_USE", "OVERDUE"]);

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

export default function BookingTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const currentBooking = useEquipmentStore((s) => s.currentBooking);
  const currentStatus = useEquipmentStore((s) => s.currentStatus);
  const currentError = useEquipmentStore((s) => s.currentError);
  const loadBooking = useEquipmentStore((s) => s.loadBooking);
  const clearCurrent = useEquipmentStore((s) => s.clearCurrent);

  const tracking = useEquipmentStore((s) => s.tracking);
  const trackingStatus = useEquipmentStore((s) => s.trackingStatus);
  const loadTracking = useEquipmentStore((s) => s.loadTracking);
  const clearTracking = useEquipmentStore((s) => s.clearTracking);
  const cancelBooking = useEquipmentStore((s) => s.cancelBooking);

  const [payOpen, setPayOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isLive = !!currentBooking && TRACKABLE.has(currentBooking.status);

  // Only open the tracking socket while the booking is actually IN_USE/OVERDUE.
  const { status: socketStatus } = useTrackingSocket(
    isLive && id ? id : null
  );

  useEffect(() => {
    if (id) void loadBooking(id);
    return () => clearCurrent();
  }, [id, loadBooking, clearCurrent]);

  // Fetch the REST tracking snapshot when the booking becomes trackable.
  useEffect(() => {
    if (id && isLive) {
      void loadTracking(id);
    }
    return () => clearTracking();
  }, [id, isLive, loadTracking, clearTracking]);

  const operator = useMemo(() => {
    const t = tracking?.operator;
    return {
      name: t?.name ?? currentBooking?.operatorName,
      phone: t?.phone ?? currentBooking?.operatorPhone,
      plate: t?.plate ?? currentBooking?.operatorPlate,
    };
  }, [tracking, currentBooking]);

  const current = tracking?.currentPosition ?? currentBooking?.currentPosition;

  const handleCancel = async (b: EquipmentBooking) => {
    if (!window.confirm("Cancel this booking?")) return;
    setCancelling(true);
    try {
      await cancelBooking(b.id);
      pushToast({
        title: "Booking cancelled",
        message: "Any eligible refund is on its way to your wallet.",
        tone: "info",
      });
    } catch (err) {
      pushToast({
        title: "Could not cancel",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setCancelling(false);
    }
  };

  if (currentStatus === "loading" && !currentBooking) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <Spinner label="Loading booking" />
      </div>
    );
  }

  if (currentStatus === "error" && !currentBooking) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm font-semibold text-ink">
            Couldn&apos;t open this booking
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            {currentError}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => id && loadBooking(id)}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/app/equipment/bookings")}
            >
              Back to bookings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentBooking) return null;
  const b = currentBooking;
  const name = b.equipment?.equipmentName ?? b.equipmentName ?? "Equipment";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/app/equipment/bookings")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-2 text-muted transition hover:text-ink"
            aria-label="Back to bookings"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-xl font-semibold text-ink">
                {name}
              </h1>
              <BookingStatusBadge status={b.status} />
            </div>
            <p className="font-mono text-[11px] text-muted">
              {b.bookingReference} · {formatWindow(b.startDate, b.endDate)}
            </p>
          </div>
        </div>

        {/* Header CTA */}
        <div className="flex shrink-0 items-center gap-2">
          {b.status === "APPROVED" && (
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <Wallet className="h-4 w-4" /> Pay {formatNaira(b.totalCost)}
            </Button>
          )}
          {b.status === "COMPLETED" &&
            !(typeof b.rating === "number" && b.rating > 0) && (
              <Button size="sm" variant="accent" onClick={() => setRateOpen(true)}>
                <Star className="h-4 w-4" /> Rate
              </Button>
            )}
          {CANCELLABLE.has(b.status) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleCancel(b)}
              disabled={cancelling}
            >
              <Ban className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Non-live states get an informational banner instead of the map */}
      {!isLive ? (
        <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
          {b.status === "PENDING" && (
            <>
              <Hourglass className="mx-auto h-8 w-8 text-amber-500" />
              <p className="mt-3 text-sm font-semibold text-ink">
                Awaiting admin approval
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted">
                Once an admin approves availability, you&apos;ll be able to pay
                from your wallet to confirm the booking.
              </p>
            </>
          )}
          {b.status === "APPROVED" && (
            <>
              <Wallet className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 text-sm font-semibold text-ink">
                Approved — pay to confirm
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted">
                Pay the full cost ({formatNaira(b.totalCost)}) from your wallet to
                lock in this booking.
              </p>
              <Button className="mt-4" onClick={() => setPayOpen(true)}>
                <Wallet className="h-4 w-4" /> Pay from wallet
              </Button>
            </>
          )}
          {b.status === "CONFIRMED" && (
            <>
              <PackageCheck className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-3 text-sm font-semibold text-ink">
                Confirmed — awaiting handover
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted">
                Live GPS tracking begins once the operator takes the equipment
                out to your site.
              </p>
            </>
          )}
          {(b.status === "COMPLETED" ||
            b.status === "CANCELLED" ||
            b.status === "REJECTED") && (
            <>
              <Truck className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-3 text-sm font-semibold text-ink">
                {b.status === "COMPLETED"
                  ? "This booking is complete"
                  : b.status === "REJECTED"
                    ? "This request was rejected"
                    : "This booking was cancelled"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted">
                {b.status === "COMPLETED"
                  ? "Live tracking is only available while the equipment is in use."
                  : b.rejectionReason || b.cancellationReason || ""}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="relative">
              <EquipmentTrackingMap
                pickup={b.pickupLocation}
                currentPosition={current}
                trail={tracking?.gpsTracking}
                className="h-[360px] w-full sm:h-[440px]"
              />
              {/* Live indicator overlay */}
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                {socketStatus === "connected" ? (
                  <>
                    <Radio className="h-3 w-3 text-emerald-300" /> Live
                  </>
                ) : socketStatus === "reconnecting" ||
                  socketStatus === "connecting" ? (
                  <>
                    <Wifi className="h-3 w-3 text-amber-300 animate-pulse" />{" "}
                    Reconnecting
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-red-300" /> Offline
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Telemetry + operator panel */}
          <div className="space-y-4">
            {/* Operator */}
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Operator
              </h3>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display font-bold text-primary">
                  {operator.name
                    ? operator.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                    : <User className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">
                    {operator.name ?? "Assigning operator…"}
                  </p>
                  {operator.phone && (
                    <a
                      href={`tel:${operator.phone}`}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" /> {operator.phone}
                    </a>
                  )}
                </div>
              </div>
              {operator.plate && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5 text-muted">
                    <Truck className="h-3.5 w-3.5 text-primary" /> Plate
                  </span>
                  <span className="font-mono font-bold text-ink">
                    {operator.plate}
                  </span>
                </div>
              )}
            </div>

            {/* Telemetry */}
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Telemetry
              </h3>
              {trackingStatus === "loading" && !current ? (
                <div className="py-6">
                  <Spinner label="Locating equipment" />
                </div>
              ) : current ? (
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-surface-2 p-3">
                    <dt className="flex items-center gap-1 text-[10px] font-medium uppercase text-muted">
                      <Gauge className="h-3 w-3" /> Speed
                    </dt>
                    <dd className="mt-0.5 font-mono text-sm font-bold text-ink">
                      {typeof current.speed === "number"
                        ? `${current.speed.toFixed(1)} km/h`
                        : "—"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-2 p-3">
                    <dt className="flex items-center gap-1 text-[10px] font-medium uppercase text-muted">
                      <Navigation className="h-3 w-3" /> Heading
                    </dt>
                    <dd className="mt-0.5 font-mono text-sm font-bold text-ink">
                      {typeof current.heading === "number"
                        ? `${Math.round(current.heading)}°`
                        : "—"}
                    </dd>
                  </div>
                  <div className="col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                    <dt className="flex items-center gap-1 text-[10px] font-medium uppercase text-muted">
                      <Clock className="h-3 w-3" /> Last update
                    </dt>
                    <dd className="mt-0.5 font-mono text-sm font-bold text-ink">
                      {timeAgo(current.at)}
                    </dd>
                  </div>
                  <div className="col-span-2 rounded-xl border border-border bg-surface-2 p-3">
                    <dt className="text-[10px] font-medium uppercase text-muted">
                      Position
                    </dt>
                    <dd className="mt-0.5 font-mono text-xs font-bold text-ink">
                      {current.lat.toFixed(5)}, {current.lng.toFixed(5)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  Waiting for the first GPS position from the operator…
                </p>
              )}
            </div>

            {/* Cost summary */}
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Booking cost
              </h3>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Rental</span>
                  <span className="font-mono font-bold text-ink">
                    {formatNaira(b.rentalCost)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Deposit</span>
                  <span className="font-mono font-bold text-ink">
                    {formatNaira(b.depositAmount)}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">Total paid</span>
                  <span className="font-mono font-black text-ink">
                    {formatNaira(b.amountPaid || b.totalCost)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <PaymentConfirmModal
        open={payOpen}
        booking={b}
        onClose={() => setPayOpen(false)}
        onPaid={() => setPayOpen(false)}
      />
      <RateBookingModal
        open={rateOpen}
        booking={b}
        onClose={() => setRateOpen(false)}
      />
    </div>
  );
}
