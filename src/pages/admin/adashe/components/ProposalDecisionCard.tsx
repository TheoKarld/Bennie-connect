/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A slot-shift decision card: vote tally (FOR / AGAINST / eligible), the swap
 * preview (from ↔ to positions), and Approve / Reject actions. AWAITING_ADMIN
 * items are actionable (with `adashe-groups:configure`); OPEN/other statuses
 * render read-only. General (non-slot-shift) proposals show as informational.
 */

import React from "react";
import { ArrowLeftRight, Check, X, Vote } from "lucide-react";

import { Button } from "../../../../components/ui";
import { ProposalStatusChip, relTime } from "./shared";
import type { AdminProposal } from "../../../../types/adashe";

interface Props {
  proposal: AdminProposal;
  canDecide: boolean;
  onApprove: (p: AdminProposal) => void;
  onReject: (p: AdminProposal) => void;
  /** When true shows the group name (cross-group queue context). */
  showGroup?: boolean;
}

function tallyOf(p: AdminProposal): { for: number; against: number; eligible: number } {
  if (p.tally) return p.tally;
  // Tolerate the user-plane `{ yes, no }` tally shape via votes fallback.
  const votes = p.votes ?? [];
  const forCount = votes.filter((v) => v.vote === "yes").length;
  const againstCount = votes.filter((v) => v.vote === "no").length;
  return { for: forCount, against: againstCount, eligible: votes.length };
}

export default function ProposalDecisionCard({
  proposal,
  canDecide,
  onApprove,
  onReject,
  showGroup,
}: Props) {
  const isSlotShift = proposal.kind === "SLOT_SHIFT";
  const awaiting = proposal.status === "AWAITING_ADMIN";
  const t = tallyOf(proposal);
  const total = Math.max(1, t.for + t.against);
  const forPct = Math.round((t.for / total) * 100);

  const from = proposal.slotShift?.requesterPosition ?? proposal.fromPosition;
  const to = proposal.slotShift?.targetPosition ?? proposal.toPosition;
  const fromName = proposal.slotShift?.requesterName;
  const toName = proposal.slotShift?.targetName;

  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm ${
        awaiting
          ? "border-accent/40 bg-accent/[0.05]"
          : "border-border bg-surface/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/8 text-primary">
              {isSlotShift ? (
                <ArrowLeftRight className="h-4 w-4" />
              ) : (
                <Vote className="h-4 w-4" />
              )}
            </span>
            <p className="truncate text-sm font-semibold text-ink">
              {proposal.title ?? (isSlotShift ? "Slot-shift request" : "Proposal")}
            </p>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {showGroup && proposal.groupName ? `${proposal.groupName} · ` : ""}
            {proposal.requestedByName ? `by ${proposal.requestedByName} · ` : ""}
            {relTime(proposal.createdAt)}
          </p>
        </div>
        <ProposalStatusChip status={proposal.status} />
      </div>

      {proposal.text && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {proposal.text}
        </p>
      )}

      {/* Swap preview */}
      {isSlotShift && from != null && to != null && (
        <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <div className="text-center">
            <p className="font-mono text-lg font-bold text-primary">#{from}</p>
            <p className="max-w-[7rem] truncate text-[10px] text-muted">
              {fromName ?? "Requester"}
            </p>
          </div>
          <ArrowLeftRight className="h-5 w-5 shrink-0 text-accent" />
          <div className="text-center">
            <p className="font-mono text-lg font-bold text-primary">#{to}</p>
            <p className="max-w-[7rem] truncate text-[10px] text-muted">
              {toName ?? "Target"}
            </p>
          </div>
        </div>
      )}

      {/* Vote tally */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-primary">{t.for} FOR</span>
          <span className="text-muted">{t.eligible} eligible</span>
          <span className="text-danger">{t.against} AGAINST</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-danger/15">
          <div
            className="h-full bg-primary"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>

      {/* Decision actions */}
      {isSlotShift && awaiting && (
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            fullWidth
            disabled={!canDecide}
            onClick={() => onApprove(proposal)}
          >
            <Check className="h-4 w-4" /> Approve swap
          </Button>
          <Button
            size="sm"
            fullWidth
            variant="outline"
            disabled={!canDecide}
            onClick={() => onReject(proposal)}
            className="!border-danger/40 !text-danger hover:!bg-danger/10"
          >
            <X className="h-4 w-4" /> Reject
          </Button>
        </div>
      )}

      {isSlotShift && awaiting && !canDecide && (
        <p className="mt-2 text-center text-[11px] text-muted">
          Deciding requires the rotation-configure permission.
        </p>
      )}

      {proposal.decisionReason && (
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[11px] text-muted">
          <span className="font-semibold">Decision note:</span>{" "}
          {proposal.decisionReason}
        </p>
      )}
    </div>
  );
}
