/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Clock, Check, Star } from "lucide-react";

import { formatNaira } from "../../../../lib/format";
import type { GroupDetail, PayoutOrderSlot } from "../../../../types/adashe";

interface RotationListProps {
  detail: GroupDetail;
}

/** The rotation order as a payout ring/list with live status per slot. */
export default function RotationList({ detail }: RotationListProps) {
  const perTurn = detail.contributionAmount * detail.maxSlots;
  const myPosition = detail.me.position;
  const activePosition = detail.activePosition;

  // Fill up to maxSlots so forming circles still render the full ring.
  const slots: (PayoutOrderSlot | null)[] = Array.from(
    { length: detail.maxSlots },
    (_, i) => detail.payoutOrder.find((s) => s.position === i + 1) ?? null
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {slots.map((slot, idx) => {
        const position = idx + 1;
        const isMine = position === myPosition;
        const isActive = position === activePosition;
        const isPaid = slot?.paid ?? false;
        const name = slot?.name ?? (slot ? "Member" : "Open slot");

        return (
          <div
            key={position}
            className={`flex items-center justify-between rounded-2xl border p-4 transition ${
              isActive
                ? "border-accent/40 bg-accent/8 ring-1 ring-accent/20"
                : isPaid
                  ? "border-border bg-surface-2 opacity-70"
                  : isMine
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-surface"
            }`}
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] font-bold uppercase text-muted">
                  Slot {position.toString().padStart(2, "0")}
                </span>
                {isActive && (
                  <span className="rounded-full border border-accent/30 bg-accent/15 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Active turn
                  </span>
                )}
                {isPaid && (
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-muted">
                    Paid
                  </span>
                )}
                {!isPaid && !isActive && slot && (
                  <span className="rounded-full bg-primary/8 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-primary">
                    Queued
                  </span>
                )}
              </div>
              <h4
                className={`truncate text-sm font-bold ${
                  isMine ? "text-primary" : "text-ink"
                }`}
              >
                {name}
                {isMine && " (You)"}
              </h4>
              <p className="text-[11px] text-muted">
                Payout target:{" "}
                <b className="text-ink">{formatNaira(perTurn)}</b>
              </p>
            </div>

            <div className="shrink-0">
              {isPaid ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted">
                  <Check className="h-4 w-4" />
                </div>
              ) : isActive ? (
                <Clock className="h-6 w-6 text-accent" />
              ) : isMine ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-primary/5">
                  <Star className="h-4 w-4" />
                </div>
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-border" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
