/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * "Mark payout sent" confirm modal. This is the sensitive financial action — it
 * asserts real money was wired off-platform and unblocks rotation advance. The
 * caller only renders/enables this for admins holding
 * `adashe-contributions:mark-sent` (Super-Admin-only per the PRD).
 */

import React, { useState } from "react";
import { Banknote, ShieldAlert } from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminAdasheStore } from "../../../../store/adminAdasheStore";
import { ngn } from "./shared";
import type { AdminPayoutRequest } from "../../../../types/adashe";

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: string;
  request: AdminPayoutRequest | null;
}

export default function MarkSentModal({
  open,
  onClose,
  groupId,
  request,
}: Props) {
  const markPayoutSent = useAdminAdasheStore((s) => s.markPayoutSent);

  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setReference("");
    setNote("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;
    setError(null);
    if (reference.trim().length < 3) {
      setError("A payment reference is required to mark this as sent.");
      return;
    }
    setSubmitting(true);
    try {
      await markPayoutSent(groupId, request.id, {
        paymentReference: reference.trim(),
        note: note.trim() || undefined,
      });
      pushToast({
        title: "Payout marked sent",
        message: `${ngn(request.poolAmount)} recorded as wired. The recipient will confirm receipt.`,
        tone: "success",
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark as sent.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!request) return null;

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Mark payout as sent"
    >
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-[#a6701c] dark:text-accent">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <p className="text-xs leading-relaxed text-[#8a5e18] dark:text-accent/90">
          This confirms you have <strong>wired the pool off-platform</strong> to
          the recipient. It cannot be undone without a cancel. The recipient is
          then prompted to confirm receipt, which advances the rotation.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface-2 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Recipient
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink">
            {request.recipientName ?? "Member"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Cycle
          </p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-ink">
            #{request.cycle}
          </p>
        </div>
        <div className="col-span-2 flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2">
          <Banknote className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Pool amount
          </span>
          <span className="ml-auto font-mono text-base font-bold text-primary">
            {ngn(request.poolAmount)}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Payment reference"
          htmlFor="ms-ref"
          hint="The off-platform transfer reference (e.g. bank/GTB ref)."
        >
          <Input
            id="ms-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="GTB-TRF-88231190"
            autoFocus
          />
        </Field>

        <Field label="Note (optional)" htmlFor="ms-note">
          <Input
            id="ms-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bank transfer to recipient"
          />
        </Field>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Confirm — funds wired
          </Button>
        </div>
      </form>
    </Modal>
  );
}
