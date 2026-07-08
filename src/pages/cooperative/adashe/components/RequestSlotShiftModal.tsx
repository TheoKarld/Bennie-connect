/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";

import { Modal, Button, pushToast } from "../../../../components/ui";
import { useAdasheStore } from "../../../../store/adasheStore";
import type { GroupDetail } from "../../../../types/adashe";

interface RequestSlotShiftModalProps {
  open: boolean;
  onClose: () => void;
  detail: GroupDetail;
}

/**
 * Pick a member to SWAP payout positions with. Only distinct, unpaid, ACTIVE
 * members (excluding self) are eligible per PRD §4.3.
 */
export default function RequestSlotShiftModal({
  open,
  onClose,
  detail,
}: RequestSlotShiftModalProps) {
  const requestSlotShift = useAdasheStore((s) => s.requestSlotShift);

  const [targetMemberId, setTargetMemberId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myMemberId = detail.me.memberId;

  // Eligible swap partners: active roster members, not me, not already paid.
  const candidates = useMemo(() => {
    const paidPositions = new Set(
      detail.payoutOrder.filter((s) => s.paid).map((s) => s.position)
    );
    const roster = detail.members ?? [];
    return roster.filter(
      (m) =>
        m.memberId !== myMemberId &&
        m.status === "ACTIVE" &&
        !paidPositions.has(m.position)
    );
  }, [detail, myMemberId]);

  const handleClose = () => {
    if (submitting) return;
    setTargetMemberId("");
    setReason("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!targetMemberId) {
      setError("Choose a member to swap positions with.");
      return;
    }
    setSubmitting(true);
    try {
      await requestSlotShift(detail.id, {
        targetMemberId,
        reason: reason.trim() || undefined,
      });
      pushToast({
        title: "Slot-shift requested",
        message:
          "All active members will vote, then an admin decides the swap.",
        tone: "success",
      });
      handleClose();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Request a slot-shift">
      <p className="mb-4 text-xs leading-relaxed text-muted">
        Propose to <b>swap</b> your payout position with another member. Every
        active member votes, then an admin approves or declines the swap.
      </p>

      {candidates.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-2 p-6 text-center text-xs text-muted">
          No eligible members to swap with right now. A partner must be an active
          member whose position has not yet been paid.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-primary/10 bg-primary/5 p-3 text-xs text-ink">
            <span className="flex items-center gap-1.5 font-semibold text-primary">
              <ArrowLeftRight className="h-3.5 w-3.5" /> Your position
            </span>
            <span className="mt-0.5 block text-muted">
              You are Slot #{detail.me.position}. The chosen member&apos;s slot
              swaps with yours on approval.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Swap with
            </label>
            <select
              value={targetMemberId}
              onChange={(e) => setTargetMemberId(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Select a member…</option>
              {candidates.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  Slot #{m.position} — {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you need to swap this cycle?"
              rows={2}
              maxLength={300}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2.5 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Request swap
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
