/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Small shared building blocks + formatters for the admin Adashe surface.
 * Kept in one place so the groups page, detail tabs and modals share a single
 * visual vocabulary (forest ops-console palette, brand tokens).
 */

import React from "react";
import { AlertTriangle } from "lucide-react";

import { Badge, Button } from "../../../../components/ui";
import type {
  GroupStatus,
  MemberStatus,
  PayoutRequestStatus,
  ProposalStatus,
} from "../../../../types/adashe";

// --- formatters -------------------------------------------------------------

/** Whole-NGN currency, e.g. ₦15,000. */
export function ngn(n: number | undefined | null): string {
  if (n == null) return "—";
  return `₦${Math.round(n).toLocaleString()}`;
}

export function fmtNum(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export function relTime(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function dateLabel(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// --- status chips -----------------------------------------------------------

type Tone = "green" | "gold" | "neutral" | "danger";

const GROUP_TONE: Record<GroupStatus, Tone> = {
  FORMING: "gold",
  ACTIVE: "green",
  COMPLETED: "neutral",
  SUSPENDED: "danger",
};

export function GroupStatusChip({ status }: { status: GroupStatus }) {
  return <Badge tone={GROUP_TONE[status] ?? "neutral"}>{status}</Badge>;
}

const MEMBER_TONE: Record<MemberStatus, Tone> = {
  INVITED: "gold",
  ACTIVE: "green",
  RECEIVED_PAYOUT: "neutral",
  EXITED: "neutral",
  REMOVED: "danger",
};

export function MemberStatusChip({ status }: { status: MemberStatus }) {
  return (
    <Badge tone={MEMBER_TONE[status] ?? "neutral"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

const PAYOUT_TONE: Record<PayoutRequestStatus, Tone> = {
  REQUESTED: "gold",
  MARKED_SENT: "green",
  CONFIRMED_RECEIVED: "green",
  DISPUTED: "danger",
  CANCELLED: "neutral",
};

export function PayoutStatusChip({ status }: { status: PayoutRequestStatus }) {
  return (
    <Badge tone={PAYOUT_TONE[status] ?? "neutral"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

const PROPOSAL_TONE: Record<string, Tone> = {
  ACTIVE: "gold",
  PASSED: "green",
  AWAITING_ADMIN: "gold",
  APPROVED: "green",
  REJECTED: "danger",
  DECLINED: "danger",
  CANCELLED: "neutral",
};

export function ProposalStatusChip({ status }: { status: ProposalStatus }) {
  return (
    <Badge tone={PROPOSAL_TONE[status] ?? "neutral"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

// --- generic states ---------------------------------------------------------

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-3xl border border-border bg-surface/70 py-16 text-sm text-muted">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      {label}…
    </div>
  );
}

export function EmptyBlock({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-canvas/60 px-6 py-14 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-danger/30 bg-danger/10 px-6 py-12 text-center">
      <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-danger" />
      <p className="font-display text-base font-semibold text-ink">
        Something went wrong
      </p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && (
        <Button className="mt-4" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

// --- progress ---------------------------------------------------------------

/** Cycle progress "Cycle X of N" with a slim paid-out bar. */
export function CycleProgress({
  currentCycle,
  maxSlots,
  paidPositions,
  compact = false,
}: {
  currentCycle: number;
  maxSlots: number;
  paidPositions?: number;
  compact?: boolean;
}) {
  const total = Math.max(1, maxSlots);
  const paid = Math.max(0, Math.min(paidPositions ?? Math.max(0, currentCycle - 1), total));
  const pct = Math.round((paid / total) * 100);
  return (
    <div className={compact ? "" : "space-y-1"}>
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted">
        <span>
          Cycle {Math.min(currentCycle, total)} of {total}
        </span>
        <span className="font-mono text-primary">{pct}% paid</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
