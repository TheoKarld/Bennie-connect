/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Moderation queue — PENDING merchant listings (oldest first) in a list with a
 * side-by-side reviewer panel: image gallery + video, pricing, merchant trust
 * summary (KYC badge + deep-link to `/bennie/merchants/:id`), and Approve /
 * Request changes / Reject actions (reject/request-changes open a reason modal).
 * Approve/reject gated by `marketplace:approve` / `marketplace:reject`. Brand
 * tokens, full light/dark support.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, ExternalLink, Film } from "lucide-react";

import { Button, pushToast } from "../../../../components/ui";
import { useAdminAuth } from "../../../../hooks/useAdminAuth";
import { useAdminMarketplaceStore } from "../../../../store/adminMarketplaceStore";
import type { AdminProduct } from "../../../../types/adminMarketplace";
import ReasonModal from "./ReasonModal";
import { EmptyBlock, LoadingBlock, SourcePill, ngn, relTime } from "./shared";

export default function ModerationQueue() {
  const queue = useAdminMarketplaceStore((s) => s.queue);
  const status = useAdminMarketplaceStore((s) => s.queueStatus);
  const fetchQueue = useAdminMarketplaceStore((s) => s.fetchQueue);
  const approveProduct = useAdminMarketplaceStore((s) => s.approveProduct);
  const rejectProduct = useAdminMarketplaceStore((s) => s.rejectProduct);

  const { hasPermission } = useAdminAuth();
  const canApprove = hasPermission("marketplace:approve");
  const canReject = hasPermission("marketplace:reject");

  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const [reason, setReason] = useState<{ mode: "reject" | "changes" } | null>(null);

  useEffect(() => {
    void fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected && queue.length > 0) setSelected(queue[0]);
    if (selected && !queue.some((q) => q.id === selected.id)) {
      setSelected(queue[0] ?? null);
    }
  }, [queue, selected]);

  const approve = async (p: AdminProduct) => {
    try {
      await approveProduct(p.id);
      pushToast({ tone: "success", title: "Listing approved" });
    } catch (err) {
      pushToast({
        tone: "alert",
        title: "Approve failed",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  const submitReason = async (r: string) => {
    if (!selected || !reason) return;
    await rejectProduct(selected.id, r, reason.mode === "changes");
    pushToast({
      tone: "success",
      title: reason.mode === "changes" ? "Changes requested" : "Listing rejected",
    });
  };

  if (status === "loading") return <LoadingBlock label="Loading moderation queue" />;
  if (queue.length === 0) {
    return (
      <EmptyBlock
        icon={CheckCircle2}
        title="Nothing to review"
        hint="Merchant listings awaiting approval appear here (oldest first)."
      />
    );
  }

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_1.4fr]">
      {/* Queue list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-ink">
            Pending ({queue.length})
          </h3>
        </div>
        <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
          {queue.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                selected?.id === p.id
                  ? "border-primary bg-primary/[0.06]"
                  : "border-border bg-surface/70 hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-3">
                {p.images?.[0]?.url ? (
                  <img
                    src={p.images[0].url}
                    alt={p.name}
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-border/40 text-muted">
                    <ClipboardCheck className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                  <p className="truncate text-[11px] text-muted">
                    {p.seller?.businessName ?? p.seller?.displayName ?? "Merchant"} ·{" "}
                    {relTime(p.createdAt)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-primary">{ngn(p.price)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Reviewer panel */}
      {selected && (
        <div className="space-y-4 rounded-3xl border border-border bg-surface/70 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold text-ink">
                  {selected.name}
                </h3>
                <SourcePill source={selected.source} />
              </div>
              <p className="text-xs text-muted">
                {selected.category?.name ?? "—"} · {selected.unit}
              </p>
            </div>
            <p className="shrink-0 text-xl font-bold text-primary">
              {ngn(selected.price)}
            </p>
          </div>

          {/* Gallery */}
          {selected.images?.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {selected.images.map((m) => (
                <img
                  key={m.id}
                  src={m.url}
                  alt={m.originalName ?? selected.name}
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              ))}
            </div>
          )}
          {selected.video?.url && (
            <a
              href={selected.video.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary/8 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15"
            >
              <Film className="h-4 w-4" /> View product video
            </a>
          )}

          {selected.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
              {selected.description}
            </p>
          )}

          {/* Merchant trust summary */}
          {selected.merchantId && (
            <Link
              to={`/bennie/merchants/${selected.merchantId}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 transition hover:border-primary/30"
            >
              <div>
                <p className="text-xs font-semibold text-ink">
                  {selected.seller?.businessName ??
                    selected.seller?.displayName ??
                    "Merchant"}
                </p>
                <p className="text-[11px] text-muted">Open the merchant profile</p>
              </div>
              <ExternalLink className="h-4 w-4 text-primary" />
            </Link>
          )}

          {/* Actions */}
          {(canApprove || canReject) && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {canApprove && (
                <Button size="sm" onClick={() => void approve(selected)}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
              )}
              {canReject && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setReason({ mode: "changes" })}
                  >
                    Request changes
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="!text-danger hover:!bg-danger/5"
                    onClick={() => setReason({ mode: "reject" })}
                  >
                    Reject
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <ReasonModal
        open={!!reason}
        onClose={() => setReason(null)}
        title={reason?.mode === "changes" ? "Request changes" : "Reject listing"}
        confirmLabel={reason?.mode === "changes" ? "Request changes" : "Reject listing"}
        tone={reason?.mode === "changes" ? "primary" : "danger"}
        description={
          reason?.mode === "changes"
            ? "The merchant is notified and may edit and resubmit. A reason is required."
            : "This rejects the listing. The merchant is notified with your reason."
        }
        onConfirm={submitReason}
      />
    </section>
  );
}
