/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ThumbsUp, ThumbsDown, ArrowLeftRight, ShieldCheck } from "lucide-react";

import { Badge, pushToast } from "../../../../components/ui";
import { useAdasheStore } from "../../../../store/adasheStore";
import type { Proposal, ProposalStatus } from "../../../../types/adashe";

interface ProposalCardProps {
  proposal: Proposal;
  groupId: string;
}

const STATUS_TONE: Record<
  ProposalStatus,
  { tone: "green" | "gold" | "neutral" | "danger"; label: string }
> = {
  ACTIVE: { tone: "green", label: "Open for voting" },
  PASSED: { tone: "green", label: "Passed" },
  REJECTED: { tone: "neutral", label: "Rejected" },
  AWAITING_ADMIN: { tone: "gold", label: "Awaiting admin" },
  APPROVED: { tone: "green", label: "Approved" },
  DECLINED: { tone: "danger", label: "Declined" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
};

export default function ProposalCard({ proposal, groupId }: ProposalCardProps) {
  const voteProposal = useAdasheStore((s) => s.voteProposal);
  const [voting, setVoting] = useState<"yes" | "no" | null>(null);

  const { yes, no } = proposal.tally;
  const totalVoted = yes + no;
  const eligible = proposal.eligibleCount || 0;
  const pctYes = totalVoted > 0 ? Math.round((yes / totalVoted) * 100) : 0;
  const pctNo = totalVoted > 0 ? Math.round((no / totalVoted) * 100) : 0;
  const status = STATUS_TONE[proposal.status];
  const isSlotShift = proposal.kind === "SLOT_SHIFT";
  const canVote = proposal.status === "ACTIVE";

  const handleVote = async (vote: "yes" | "no") => {
    setVoting(vote);
    try {
      await voteProposal(groupId, proposal.id, vote);
    } catch (err) {
      pushToast({
        title: "Vote failed",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setVoting(null);
    }
  };

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {isSlotShift && (
              <Badge tone="gold">
                <ArrowLeftRight className="h-3 w-3" /> Slot-shift
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-bold leading-relaxed text-ink">
            {proposal.title}
          </h4>
          {proposal.text && (
            <p className="text-xs leading-relaxed text-muted">
              {proposal.text}
            </p>
          )}
          {isSlotShift && proposal.slotShift && (
            <p className="text-[11px] font-medium text-primary">
              Swap Slot #{proposal.slotShift.requesterPosition}
              {proposal.slotShift.requesterName
                ? ` (${proposal.slotShift.requesterName})`
                : ""}{" "}
              ↔ Slot #{proposal.slotShift.targetPosition}
              {proposal.slotShift.targetName
                ? ` (${proposal.slotShift.targetName})`
                : ""}
            </p>
          )}
        </div>

        {proposal.myVote && (
          <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10.5px] font-bold text-primary">
            You voted: {proposal.myVote.toUpperCase()}
          </span>
        )}
      </div>

      {/* Tally bars */}
      <div className="space-y-2 rounded-2xl border border-border bg-surface-2 p-4">
        <div className="flex justify-between text-xs font-semibold text-ink">
          <span className="flex items-center gap-1.5">
            <ThumbsUp className="h-3.5 w-3.5 text-primary" /> Yes ({yes})
          </span>
          <span>{pctYes}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pctYes}%` }}
          />
        </div>

        <div className="flex justify-between pt-1 text-xs font-semibold text-ink">
          <span className="flex items-center gap-1.5">
            <ThumbsDown className="h-3.5 w-3.5 text-muted" /> No ({no})
          </span>
          <span>{pctNo}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-muted transition-all duration-500"
            style={{ width: `${pctNo}%` }}
          />
        </div>

        <p className="pt-1 text-[10.5px] text-muted">
          {totalVoted} of {eligible || "?"} members voted
          {isSlotShift ? " · all must vote before admin decides" : ""}
        </p>
      </div>

      {proposal.status === "AWAITING_ADMIN" && (
        <div className="flex items-center gap-2 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Voting complete — awaiting an admin decision on this swap.
        </div>
      )}

      {canVote && (
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleVote("yes")}
            disabled={voting !== null}
            className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/8 px-4 py-2 text-xs font-bold text-primary transition hover:bg-primary/15 disabled:opacity-50"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {proposal.myVote === "yes" ? "Yes (voted)" : "Vote Yes"}
          </button>
          <button
            onClick={() => handleVote("no")}
            disabled={voting !== null}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-muted transition hover:bg-surface-2 disabled:opacity-50"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            {proposal.myVote === "no" ? "No (voted)" : "Vote No"}
          </button>
          {proposal.myVote && (
            <span className="ml-auto text-[10.5px] text-muted">
              You can change your vote while open
            </span>
          )}
        </div>
      )}
    </div>
  );
}
