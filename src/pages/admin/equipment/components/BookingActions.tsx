/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Orchestrates the booking lifecycle modals (approve / reject / handover /
 * complete / cancel) for a list of `BookingCard`s. Owns the modal state and
 * wires the store actions, so both the approval queue and the equipment detail
 * page can render bookings with working, permission-gated actions from one place.
 */

import React, { useState } from "react";

import { pushToast } from "../../../../components/ui";
import { useAdminEquipmentStore } from "../../../../store/adminEquipmentStore";
import type { EquipmentBooking } from "../../../../types/adminEquipment";
import BookingCard from "./BookingCard";
import ApproveBookingModal from "./ApproveBookingModal";
import CompleteBookingModal from "./CompleteBookingModal";
import ReasonModal from "./ReasonModal";

interface Props {
  bookings: EquipmentBooking[];
  /** One or two columns. */
  columns?: 1 | 2;
}

export default function BookingActions({ bookings, columns = 1 }: Props) {
  const rejectBooking = useAdminEquipmentStore((s) => s.rejectBooking);
  const handoverBooking = useAdminEquipmentStore((s) => s.handoverBooking);
  const cancelBooking = useAdminEquipmentStore((s) => s.cancelBooking);

  const [approveTarget, setApproveTarget] = useState<EquipmentBooking | null>(null);
  const [rejectTarget, setRejectTarget] = useState<EquipmentBooking | null>(null);
  const [completeTarget, setCompleteTarget] = useState<EquipmentBooking | null>(
    null
  );
  const [cancelTarget, setCancelTarget] = useState<EquipmentBooking | null>(null);

  const doHandover = async (b: EquipmentBooking) => {
    try {
      await handoverBooking(b.id);
      pushToast({
        tone: "success",
        title: "Equipment handed over",
        message: "GPS tracking is now active.",
      });
    } catch (err) {
      pushToast({
        tone: "alert",
        title: "Handover failed",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  return (
    <>
      <div
        className={
          columns === 2
            ? "grid grid-cols-1 gap-3 lg:grid-cols-2"
            : "space-y-3"
        }
      >
        {bookings.map((b) => (
          <BookingCard
            key={b.id}
            booking={b}
            onApprove={setApproveTarget}
            onReject={setRejectTarget}
            onHandover={doHandover}
            onComplete={setCompleteTarget}
            onCancel={setCancelTarget}
          />
        ))}
      </div>

      <ApproveBookingModal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        booking={approveTarget}
      />

      <CompleteBookingModal
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        booking={completeTarget}
      />

      <ReasonModal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject booking request"
        tone="danger"
        confirmLabel="Reject request"
        description="Rejecting declines this availability request. The user is notified. State why."
        onConfirm={async (reason) => {
          if (rejectTarget) {
            await rejectBooking(rejectTarget.id, reason);
            pushToast({ tone: "success", title: "Booking rejected" });
          }
        }}
      />

      <ReasonModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel booking"
        tone="danger"
        confirmLabel="Cancel booking"
        description="Cancelling a confirmed booking triggers a wallet refund per policy. This is audited."
        onConfirm={async (reason) => {
          if (cancelTarget) {
            await cancelBooking(cancelTarget.id, reason);
            pushToast({ tone: "success", title: "Booking cancelled" });
          }
        }}
      />
    </>
  );
}
