/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared building blocks + formatters for the admin Marketplace / Orders /
 * Merchants surfaces. Status chips, generic loading/empty/error blocks, NGN and
 * date formatters, and an InfoRow — one visual vocabulary (brand tokens; full
 * light/dark support).
 */

import React from "react";
import { AlertTriangle } from "lucide-react";

import { Badge, Button } from "../../../../components/ui";
import type {
  EarningStatus,
  FulfillmentStatus,
  MerchantKycStatus,
  ModerationStatus,
  OrderPaymentStatus,
  PayoutStatus,
  PremblyStatus,
} from "../../../../types/adminMarketplace";

// --- formatters -------------------------------------------------------------

export function ngn(n: number | undefined | null): string {
  if (n == null) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}₦${Math.abs(Math.round(n)).toLocaleString()}`;
}

export function relTime(iso?: string | null): string {
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

export function dateLabel(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function dateTimeLabel(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function titleCase(s?: string | null): string {
  if (!s) return "—";
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- status chips -----------------------------------------------------------

type Tone = "green" | "gold" | "neutral" | "danger";

const MODERATION_TONE: Record<ModerationStatus, Tone> = {
  PENDING: "gold",
  APPROVED: "green",
  REJECTED: "danger",
  CHANGES_REQUESTED: "gold",
};

export function ModerationChip({ status }: { status?: ModerationStatus }) {
  if (!status) return null;
  return <Badge tone={MODERATION_TONE[status] ?? "neutral"}>{titleCase(status)}</Badge>;
}

const LISTING_TONE: Record<string, Tone> = {
  ACTIVE: "green",
  INACTIVE: "neutral",
  OUT_OF_STOCK: "danger",
};

export function ListingStatusChip({ status }: { status?: string }) {
  if (!status) return null;
  return <Badge tone={LISTING_TONE[status] ?? "neutral"}>{titleCase(status)}</Badge>;
}

const FULFILLMENT_TONE: Record<FulfillmentStatus, Tone> = {
  PENDING: "gold",
  PROCESSING: "gold",
  SHIPPED: "green",
  DELIVERED: "green",
  CANCELLED: "neutral",
};

export function FulfillmentChip({ status }: { status?: FulfillmentStatus }) {
  if (!status) return null;
  return (
    <Badge tone={FULFILLMENT_TONE[status] ?? "neutral"}>{titleCase(status)}</Badge>
  );
}

const PAYMENT_TONE: Record<OrderPaymentStatus, Tone> = {
  PAID: "green",
  PARTIALLY_REFUNDED: "gold",
  REFUNDED: "neutral",
};

export function PaymentChip({ status }: { status?: OrderPaymentStatus }) {
  if (!status) return null;
  return <Badge tone={PAYMENT_TONE[status] ?? "neutral"}>{titleCase(status)}</Badge>;
}

const KYC_TONE: Record<MerchantKycStatus, Tone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "neutral",
  PENDING_REVIEW: "gold",
  APPROVED: "green",
  REJECTED: "danger",
  SUSPENDED: "danger",
};

export function KycChip({ status }: { status?: MerchantKycStatus }) {
  if (!status) return <Badge tone="neutral">Unknown</Badge>;
  return <Badge tone={KYC_TONE[status] ?? "neutral"}>{titleCase(status)}</Badge>;
}

const PAYOUT_TONE: Record<PayoutStatus, Tone> = {
  REQUESTED: "gold",
  MARKED_SENT: "gold",
  CONFIRMED_RECEIVED: "green",
  CANCELLED: "neutral",
};

export function PayoutChip({ status }: { status?: PayoutStatus }) {
  if (!status) return null;
  return <Badge tone={PAYOUT_TONE[status] ?? "neutral"}>{titleCase(status)}</Badge>;
}

const EARNING_TONE: Record<EarningStatus, Tone> = {
  AVAILABLE: "green",
  LOCKED: "gold",
  SETTLED: "neutral",
  REVERSED: "danger",
};

export function EarningChip({ status }: { status?: EarningStatus }) {
  if (!status) return null;
  return <Badge tone={EARNING_TONE[status] ?? "neutral"}>{titleCase(status)}</Badge>;
}

/** Prembly advisory badge (never a decision). */
export function PremblyBadge({ status }: { status?: PremblyStatus }) {
  const map: Record<PremblyStatus, { tone: Tone; label: string }> = {
    VERIFIED: { tone: "green", label: "✓ Verified match" },
    NOT_VERIFIED: { tone: "danger", label: "✗ No match" },
    ERROR: { tone: "gold", label: "Check error" },
    SKIPPED: { tone: "neutral", label: "— Not checked" },
  };
  const cfg = status ? map[status] : map.SKIPPED;
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

/** Platform vs Merchant source pill. */
export function SourcePill({ source }: { source?: string }) {
  const isPlatform = source === "ADMIN" || source === "PLATFORM";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        isPlatform
          ? "bg-primary/12 text-primary"
          : "bg-accent/15 text-[#a6701c] dark:text-accent"
      }`}
    >
      {isPlatform ? "Platform" : "Merchant"}
    </span>
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
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-canvas/60 px-6 py-14 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
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

/** A tidy label/value pair for detail panels. */
export function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className={`text-sm text-ink ${mono ? "font-mono" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}

/** Simple server-pagination bar. */
export function Pager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <p className="text-xs text-muted">
        Page {page} of {pages} · {total.toLocaleString()} total
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
