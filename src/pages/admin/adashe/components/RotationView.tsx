/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Read-only rotation timeline. Renders the payout order with paid / active /
 * upcoming states. The admin cannot reorder here — the only sanctioned reorder
 * is approving a slot-shift proposal (Slot-Shift Decisions tab).
 */

import React from "react";
import { Check, Crown, Clock } from "lucide-react";

import type { PayoutOrderSlot } from "../../../../types/adashe";

interface Props {
  payoutOrder: PayoutOrderSlot[];
  activePosition?: number;
}

export default function RotationView({ payoutOrder, activePosition }: Props) {
  const ordered = [...(payoutOrder ?? [])].sort((a, b) => a.position - b.position);
  const nextPos =
    activePosition ??
    ordered.find((s) => !s.paid)?.position ??
    ordered.length + 1;

  return (
    <ol className="relative space-y-3 pl-8">
      <span
        aria-hidden
        className="absolute left-3 top-2 bottom-2 w-px bg-border"
      />
      {ordered.map((slot) => {
        const isPaid = slot.paid;
        const isNext = !isPaid && slot.position === nextPos;
        return (
          <li key={slot.position} className="relative">
            <span
              className={`absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-canvas ${
                isPaid
                  ? "bg-primary text-white"
                  : isNext
                  ? "bg-accent text-white"
                  : "bg-border text-muted"
              }`}
            >
              {isPaid ? (
                <Check className="h-3.5 w-3.5" />
              ) : isNext ? (
                <Crown className="h-3.5 w-3.5" />
              ) : (
                <span className="font-mono text-[10px] font-bold">
                  {slot.position}
                </span>
              )}
            </span>
            <div
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                isNext
                  ? "border-accent/40 bg-accent/5"
                  : "border-border bg-surface"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {slot.name ?? `Slot ${slot.position}`}
                </p>
                <p className="text-[11px] text-muted">
                  Position {slot.position}
                  {slot.paidAt
                    ? ` · paid ${new Date(slot.paidAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <span
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  isPaid
                    ? "bg-primary/10 text-primary"
                    : isNext
                    ? "bg-accent/15 text-[#a6701c] dark:text-accent"
                    : "bg-muted/10 text-muted"
                }`}
              >
                {isPaid ? (
                  <>
                    <Check className="h-3 w-3" /> Paid
                  </>
                ) : isNext ? (
                  <>
                    <Crown className="h-3 w-3" /> Next
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3" /> Upcoming
                  </>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
