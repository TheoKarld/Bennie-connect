/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Plus, Vote, ArrowLeftRight } from "lucide-react";

import { Button, Input, Spinner, pushToast } from "../../../../components/ui";
import { useAdasheStore } from "../../../../store/adasheStore";
import ProposalCard from "../components/ProposalCard";
import RequestSlotShiftModal from "../components/RequestSlotShiftModal";
import type { GroupDetail } from "../../../../types/adashe";

interface ProposalsTabProps {
  detail: GroupDetail;
}

export default function ProposalsTab({ detail }: ProposalsTabProps) {
  const proposals = useAdasheStore((s) => s.proposals);
  const proposalsLoaded = useAdasheStore((s) => s.proposalsLoaded);
  const fetchProposals = useAdasheStore((s) => s.fetchProposals);
  const createProposal = useAdasheStore((s) => s.createProposal);

  const [formOpen, setFormOpen] = useState(false);
  const [slotShiftOpen, setSlotShiftOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!proposalsLoaded) void fetchProposals(detail.id);
  }, [detail.id, proposalsLoaded, fetchProposals]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) return;
    setSubmitting(true);
    try {
      await createProposal(detail.id, {
        title: title.trim(),
        text: text.trim() || undefined,
      });
      pushToast({
        title: "Proposal posted",
        message: "Members can now vote on it.",
        tone: "success",
      });
      setTitle("");
      setText("");
      setFormOpen(false);
    } catch (err) {
      pushToast({
        title: "Could not post",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">
            Proposals &amp; voting
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Members decide together. Slot-shifts need every active member to
            vote, then an admin approves the swap.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSlotShiftOpen(true)}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Request slot-shift
          </Button>
          <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Post proposal
          </Button>
        </div>
      </div>

      {formOpen && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm"
        >
          <h4 className="text-sm font-semibold text-ink">
            New proposal
          </h4>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Raise monthly dues by ₦5,000"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Details (optional)
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Explain the rationale for the group…"
              rows={3}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="flex justify-end gap-2.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              disabled={title.trim().length < 3}
            >
              Submit proposal
            </Button>
          </div>
        </form>
      )}

      {!proposalsLoaded ? (
        <div className="flex justify-center py-16">
          <Spinner label="Loading proposals" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
            <Vote className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-ink">
            No proposals yet
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted">
            Post a proposal or request a slot-shift to get the circle deciding.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} groupId={detail.id} />
          ))}
        </div>
      )}

      <RequestSlotShiftModal
        open={slotShiftOpen}
        onClose={() => setSlotShiftOpen(false)}
        detail={detail}
      />
    </div>
  );
}
