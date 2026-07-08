/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Approve-availability modal (PENDING → APPROVED). Captures the optional
 * operator identity fields (name / phone / plate) + a note, then approves — the
 * server issues a per-booking `trackingToken` and awaits the user's wallet
 * payment. No money is collected here.
 */

import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminEquipmentStore } from "../../../../store/adminEquipmentStore";
import type { EquipmentBooking } from "../../../../types/adminEquipment";

interface Props {
  open: boolean;
  onClose: () => void;
  booking: EquipmentBooking | null;
}

export default function ApproveBookingModal({ open, onClose, booking }: Props) {
  const approveBooking = useAdminEquipmentStore((s) => s.approveBooking);
  const [operatorName, setOperatorName] = useState("");
  const [operatorPhone, setOperatorPhone] = useState("");
  const [operatorPlate, setOperatorPlate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && booking) {
      setOperatorName(booking.operatorName ?? "");
      setOperatorPhone(booking.operatorPhone ?? "");
      setOperatorPlate(booking.operatorPlate ?? "");
      setNote("");
      setError(null);
    }
  }, [open, booking]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await approveBooking(booking.id, {
        operatorName: operatorName.trim() || undefined,
        operatorPhone: operatorPhone.trim() || undefined,
        operatorPlate: operatorPlate.trim() || undefined,
        note: note.trim() || undefined,
      });
      pushToast({
        tone: "success",
        title: "Booking approved",
        message: res.trackingToken
          ? "Tracking token issued. Awaiting user payment."
          : "Awaiting user payment.",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Approve availability">
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted">
          Approving confirms the unit is available and issues a tracking token.{" "}
          <span className="font-semibold text-ink">No money is collected</span> —
          the user then pays the full cost from their wallet to confirm.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Operator name (optional)" htmlFor="op-name">
            <Input
              id="op-name"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Musa Ibrahim"
            />
          </Field>
          <Field label="Operator phone (optional)" htmlFor="op-phone">
            <Input
              id="op-phone"
              value={operatorPhone}
              onChange={(e) => setOperatorPhone(e.target.value)}
              placeholder="+2348030000000"
            />
          </Field>
          <Field
            label="Vehicle / plate (optional)"
            htmlFor="op-plate"
            className="sm:col-span-2"
          >
            <Input
              id="op-plate"
              value={operatorPlate}
              onChange={(e) => setOperatorPlate(e.target.value)}
              placeholder="KAD-123-XA"
            />
          </Field>
        </div>
        <Field label="Note (optional)" htmlFor="op-note">
          <textarea
            id="op-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Approved; assigned operator. Awaiting user payment."
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </Field>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Approve &amp; issue token
          </Button>
        </div>
      </form>
    </Modal>
  );
}
