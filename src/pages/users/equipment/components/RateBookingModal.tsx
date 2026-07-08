/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Post-completion review: 1–5 stars + an optional comment. */

import React, { useState } from "react";
import { Star, Loader2 } from "lucide-react";

import { Modal, Button, pushToast } from "../../../../components/ui";
import { useEquipmentStore } from "../../../../store/equipmentStore";
import type { EquipmentBooking } from "../../../../types/equipment";

export default function RateBookingModal({
  open,
  booking,
  onClose,
}: {
  open: boolean;
  booking: EquipmentBooking | null;
  onClose: () => void;
}) {
  const rateBooking = useEquipmentStore((s) => s.rateBooking);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!booking) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await rateBooking(booking.id, rating, comment.trim() || undefined);
      pushToast({
        title: "Thanks for the feedback",
        message: "Your rating has been recorded.",
        tone: "success",
      });
      onClose();
    } catch (err) {
      pushToast({
        title: "Could not submit rating",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rate this booking"
      className="max-w-md"
    >
      <div className="space-y-5">
        <p className="text-xs text-muted">
          How was your experience with{" "}
          <span className="font-semibold text-ink">
            {booking.equipment?.equipmentName ??
              booking.equipmentName ??
              "this equipment"}
          </span>
          ?
        </p>

        <div className="flex items-center justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= (hover || rating);
            return (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(star)}
                className="p-1 transition hover:scale-110"
                aria-label={`${star} star${star === 1 ? "" : "s"}`}
              >
                <Star
                  className={`h-8 w-8 ${
                    filled ? "fill-accent text-accent" : "text-muted"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Tell us about the equipment condition, the operator, or the service (optional)"
          className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-medium text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <div className="flex items-center justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit rating
          </Button>
        </div>
      </div>
    </Modal>
  );
}
