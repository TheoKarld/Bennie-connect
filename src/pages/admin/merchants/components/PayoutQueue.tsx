/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cross-merchant payout queue — the manual payout work list
 * (`REQUESTED → MARKED_SENT → CONFIRMED_RECEIVED`). Default filter REQUESTED;
 * status chips switch the view. Mark-sent (reference required) and cancel are
 * gated by `merchants:mark-payout-sent` (Super-Admin-only). Stale MARKED_SENT
 * rows (> 5 days unconfirmed) are highlighted. Brand tokens, light/dark aware.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Banknote, Send } from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminAuth } from "../../../../hooks/useAdminAuth";
import { useAdminMerchantsStore } from "../../../../store/adminMerchantsStore";
import type {
  AdminPayoutRequest,
  PayoutStatus,
} from "../../../../types/adminMarketplace";
import ReasonModal from "../../marketplace/components/ReasonModal";
import {
  EmptyBlock,
  LoadingBlock,
  PayoutChip,
  dateTimeLabel,
  ngn,
} from "../../marketplace/components/shared";

const STATUS_CHIPS: (PayoutStatus | "ALL")[] = [
  "REQUESTED",
  "MARKED_SENT",
  "CONFIRMED_RECEIVED",
  "CANCELLED",
  "ALL",
];

const STALE_DAYS = 5;

function MarkSentModal({
  request,
  onClose,
}: {
  request: AdminPayoutRequest | null;
  onClose: () => void;
}) {
  const markPayoutSent = useAdminMerchantsStore((s) => s.markPayoutSent);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (request) {
      setReference("");
      setNote("");
      setError(null);
    }
  }, [request]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (reference.trim().length < 2) {
      setError("A payment reference is required.");
      return;
    }
    if (!request) return;
    setSubmitting(true);
    try {
      await markPayoutSent(request.id, {
        paymentReference: reference.trim(),
        note: note.trim() || undefined,
      });
      pushToast({ tone: "success", title: "Payout marked sent" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark the payout sent.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={!!request} onClose={onClose} title="Mark payout sent">
      <div className="mb-4 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-xs text-muted">
        Confirm that {ngn(request?.amount)} was wired off-platform to{" "}
        <span className="font-semibold text-ink">
          {request?.bankAccount?.accountName ?? "the merchant"}
        </span>
        {request?.bankAccount?.bankName ? ` (${request.bankAccount.bankName})` : ""}. The
        merchant is prompted to confirm receipt.
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Payment reference (required)" htmlFor="ps-ref">
          <Input
            id="ps-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="GTB-TRF-90233812"
            invalid={!!error}
          />
        </Field>
        <Field label="Note (optional)" htmlFor="ps-note">
          <Input
            id="ps-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Wired 2026-07-03"
          />
        </Field>
        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            <Send className="h-4 w-4" /> Mark sent
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function isStale(r: AdminPayoutRequest): boolean {
  if (r.status !== "MARKED_SENT" || !r.markedSentAt) return false;
  return Date.now() - new Date(r.markedSentAt).getTime() > STALE_DAYS * 86400000;
}

export default function PayoutQueue() {
  const queue = useAdminMerchantsStore((s) => s.payoutQueue);
  const status = useAdminMerchantsStore((s) => s.payoutQueueStatus);
  const fetchPayoutQueue = useAdminMerchantsStore((s) => s.fetchPayoutQueue);
  const cancelPayout = useAdminMerchantsStore((s) => s.cancelPayout);

  const { hasPermission } = useAdminAuth();
  const canMarkSent = hasPermission("merchants:mark-payout-sent");

  const [filter, setFilter] = useState<PayoutStatus | "ALL">("REQUESTED");
  const [markSent, setMarkSent] = useState<AdminPayoutRequest | null>(null);
  const [cancelReq, setCancelReq] = useState<AdminPayoutRequest | null>(null);

  useEffect(() => {
    void fetchPayoutQueue({ status: filter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const submitCancel = async (reason: string) => {
    if (!cancelReq) return;
    await cancelPayout(cancelReq.id, reason);
    pushToast({ tone: "success", title: "Payout request cancelled" });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {STATUS_CHIPS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === s
                ? "bg-primary text-white"
                : "bg-primary/8 text-primary hover:bg-primary/15"
            }`}
          >
            {s === "ALL" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {status === "loading" && <LoadingBlock label="Loading payout queue" />}
      {status !== "loading" && queue.length === 0 && (
        <EmptyBlock
          icon={Banknote}
          title="No payout requests"
          hint="Merchant payout requests land here for review and mark-sent."
        />
      )}
      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((r) => (
            <div
              key={r.id}
              className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
                isStale(r)
                  ? "border-danger/30 bg-danger/[0.05]"
                  : "border-border bg-surface/70"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/bennie/merchants/${r.merchant?.id ?? r.merchantId}?tab=payouts`}
                    className="truncate text-sm font-semibold text-ink hover:text-primary"
                  >
                    {r.merchant?.businessName ?? "Merchant"}
                  </Link>
                  <PayoutChip status={r.status} />
                  {isStale(r) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[9px] font-bold uppercase text-danger">
                      <AlertTriangle className="h-3 w-3" /> Stale
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-muted">
                  {r.requestId ?? r.id} · requested {dateTimeLabel(r.requestedAt)}
                  {r.paymentReference ? ` · ref ${r.paymentReference}` : ""}
                </p>
              </div>
              <span className="text-sm font-bold text-primary">{ngn(r.amount)}</span>
              {canMarkSent && (
                <div className="flex gap-1.5">
                  {r.status === "REQUESTED" && (
                    <Button size="sm" onClick={() => setMarkSent(r)}>
                      <Send className="h-3.5 w-3.5" /> Mark sent
                    </Button>
                  )}
                  {["REQUESTED", "MARKED_SENT"].includes(r.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="!text-danger hover:!bg-danger/5"
                      onClick={() => setCancelReq(r)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <MarkSentModal request={markSent} onClose={() => setMarkSent(null)} />
      <ReasonModal
        open={!!cancelReq}
        onClose={() => setCancelReq(null)}
        title="Cancel payout request"
        confirmLabel="Cancel request"
        tone="danger"
        description="This voids the request and unlocks the merchant's earnings back to available. A reason is required."
        onConfirm={submitCancel}
      />
    </section>
  );
}
