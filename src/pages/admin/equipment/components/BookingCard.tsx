/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A single booking card with permission-gated lifecycle actions.
 *
 * Shows the booking reference, equipment, status/payment chips, window, cost,
 * operator + tracking-token state, and the action buttons appropriate for the
 * current status:
 *   PENDING   → Approve · Reject
 *   APPROVED  → (awaiting user payment — read-only nudge) · Cancel
 *   CONFIRMED → Handover · Cancel
 *   IN_USE / OVERDUE → Complete
 * Each action button is hidden unless the admin holds the matching permission.
 */

import React from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  PackageCheck,
  Truck,
  UserCog,
  XCircle,
} from "lucide-react";

import { Button } from "../../../../components/ui";
import { useAdminAuth } from "../../../../hooks/useAdminAuth";
import type { EquipmentBooking } from "../../../../types/adminEquipment";
import {
  BookingStatusChip,
  PaymentStatusChip,
  dateLabel,
  ngn,
} from "./shared";

interface Props {
  booking: EquipmentBooking;
  onApprove?: (b: EquipmentBooking) => void;
  onReject?: (b: EquipmentBooking) => void;
  onHandover?: (b: EquipmentBooking) => void;
  onComplete?: (b: EquipmentBooking) => void;
  onCancel?: (b: EquipmentBooking) => void;
}

export default function BookingCard({
  booking: b,
  onApprove,
  onReject,
  onHandover,
  onComplete,
  onCancel,
}: Props) {
  const { hasPermission } = useAdminAuth();

  const equipmentName =
    b.equipment?.equipmentName ?? b.equipmentName ?? "Equipment";
  const hasToken = b.status === "APPROVED" || b.status === "IN_USE";

  return (
    <div className="rounded-3xl border border-border bg-surface/70 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-ink">
              {equipmentName}
            </p>
            <BookingStatusChip status={b.status} />
            <PaymentStatusChip status={b.paymentStatus} />
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-muted">
            {b.bookingReference}
          </p>
        </div>
        <p className="font-mono text-sm font-semibold text-primary">
          {ngn(b.totalCost)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-4">
        <div>
          <span className="block uppercase tracking-wider text-muted">From</span>
          <span className="font-medium text-ink">{dateLabel(b.startDate)}</span>
        </div>
        <div>
          <span className="block uppercase tracking-wider text-muted">To</span>
          <span className="font-medium text-ink">{dateLabel(b.endDate)}</span>
        </div>
        <div>
          <span className="block uppercase tracking-wider text-muted">
            Deposit
          </span>
          <span className="font-mono font-medium text-ink">
            {ngn(b.depositAmount)}
          </span>
        </div>
        <div>
          <span className="block uppercase tracking-wider text-muted">
            Operator
          </span>
          <span className="flex items-center gap-1 font-medium text-ink">
            {b.operatorName ? (
              <>
                <UserCog className="h-3 w-3 text-muted" />
                {b.operatorName}
              </>
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>

      {hasToken && (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-primary/[0.06] px-3 py-1.5 text-[11px] text-primary">
          <KeyRound className="h-3.5 w-3.5" />
          Tracking token issued
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {b.status === "PENDING" && (
          <>
            {hasPermission("equipment:approve") && onApprove && (
              <Button size="sm" onClick={() => onApprove(b)}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            )}
            {hasPermission("equipment:reject") && onReject && (
              <Button
                size="sm"
                variant="outline"
                className="!border-danger/40 !text-danger hover:!bg-danger/5"
                onClick={() => onReject(b)}
              >
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            )}
          </>
        )}

        {b.status === "APPROVED" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-[11px] font-semibold text-[#a6701c] dark:text-accent">
            <Clock className="h-3.5 w-3.5" /> Awaiting user payment
          </span>
        )}

        {b.status === "CONFIRMED" &&
          hasPermission("equipment:confirm") &&
          onHandover && (
            <Button size="sm" onClick={() => onHandover(b)}>
              <Truck className="h-4 w-4" /> Handover
            </Button>
          )}

        {(b.status === "IN_USE" || b.status === "OVERDUE") &&
          hasPermission("equipment:complete") &&
          onComplete && (
            <Button size="sm" onClick={() => onComplete(b)}>
              <PackageCheck className="h-4 w-4" /> Complete
            </Button>
          )}

        {["PENDING", "APPROVED", "CONFIRMED"].includes(b.status) &&
          hasPermission("equipment:cancel") &&
          onCancel && (
            <Button size="sm" variant="ghost" onClick={() => onCancel(b)}>
              Cancel
            </Button>
          )}

        {(b.status === "IN_USE" || b.status === "OVERDUE") && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-muted">
            Live on map <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}
