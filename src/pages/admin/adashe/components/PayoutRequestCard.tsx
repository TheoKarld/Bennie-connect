/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A single payout-request card. Used both in the cross-group queue (groups page)
 * and a group's Payout Requests tab. "Mark sent" only renders/enables for
 * admins with `adashe-contributions:mark-sent` (Super-Admin-only); "Cancel"
 * renders when the request is still open and the admin may act on the queue.
 */

import React from "react";
import { Banknote, Send, XCircle, Clock } from "lucide-react";

import { Button } from "../../../../components/ui";
import { PayoutStatusChip, ngn, relTime } from "./shared";
import type { AdminPayoutRequest } from "../../../../types/adashe";

interface Props {
  request: AdminPayoutRequest;
  canMarkSent: boolean;
  canCancel: boolean;
  onMarkSent: (r: AdminPayoutRequest) => void;
  onCancel: (r: AdminPayoutRequest) => void;
  /** Show the group name (cross-group queue context). */
  showGroup?: boolean;
}

export default function PayoutRequestCard({
  request,
  canMarkSent,
  canCancel,
  onMarkSent,
  onCancel,
  showGroup,
}: Props) {
  const open = request.status === "REQUESTED";
  const sent = request.status === "MARKED_SENT";
  const disputed = request.status === "DISPUTED";

  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm ${
        disputed
          ? "border-danger/30 bg-danger/[0.06]"
          : open
          ? "border-accent/40 bg-accent/[0.05]"
          : "border-border bg-surface/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
            <Banknote className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {request.recipientName ?? "Member"}
            </p>
            <p className="text-[11px] text-muted">
              {showGroup && request.groupName ? `${request.groupName} · ` : ""}
              Cycle #{request.cycle} · position {request.position}
            </p>
          </div>
        </div>
        <PayoutStatusChip status={request.status} />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-primary/5 px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Pool amount
        </span>
        <span className="ml-auto font-mono text-base font-bold text-primary">
          {ngn(request.poolAmount)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
        <Clock className="h-3.5 w-3.5" />
        {open && `Requested ${relTime(request.requestedAt)}`}
        {sent &&
          `Marked sent ${relTime(request.markedSentAt)}${
            request.paymentReference ? ` · ref ${request.paymentReference}` : ""
          }`}
        {request.status === "CONFIRMED_RECEIVED" &&
          `Confirmed ${relTime(request.confirmedAt)}`}
        {disputed && "Recipient disputes receipt"}
        {request.status === "CANCELLED" && `Cancelled${request.cancelReason ? ` · ${request.cancelReason}` : ""}`}
      </div>

      {sent && (
        <p className="mt-2 rounded-xl bg-accent/10 px-3 py-2 text-[11px] font-medium text-[#a6701c] dark:text-accent">
          Awaiting recipient confirmation of receipt.
        </p>
      )}

      {(open || sent || disputed) && (canMarkSent || canCancel) && (
        <div className="mt-4 flex gap-2">
          {(open || disputed) && (
            <Button
              size="sm"
              fullWidth
              disabled={!canMarkSent}
              onClick={() => onMarkSent(request)}
            >
              <Send className="h-4 w-4" /> Mark sent
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              fullWidth={!open && !disputed}
              variant="outline"
              onClick={() => onCancel(request)}
              className="!border-danger/40 !text-danger hover:!bg-danger/10"
            >
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      )}

      {(open || disputed) && !canMarkSent && (
        <p className="mt-2 text-center text-[11px] text-muted">
          Marking sent is a Super-Admin-only action.
        </p>
      )}
    </div>
  );
}
