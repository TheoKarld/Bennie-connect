/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared building blocks + formatters for the admin Equipment surface.
 * Status chips (equipment + booking + payment), the tracking-token pill, generic
 * loading/empty/error blocks, and NGN/date formatters — one visual vocabulary
 * (forest ops-console palette, brand tokens; light/dark aware).
 */

import React from "react";
import { AlertTriangle } from "lucide-react";

import { Badge, Button } from "../../../../components/ui";
import type {
  BookingStatus,
  EquipmentStatus,
  PaymentStatus,
} from "../../../../types/adminEquipment";

// --- formatters -------------------------------------------------------------

export function ngn(n: number | undefined | null): string {
  if (n == null) return "—";
  return `₦${Math.round(n).toLocaleString()}`;
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

export function dateTimeLabel(iso?: string): string {
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

// --- status chips -----------------------------------------------------------

type Tone = "green" | "gold" | "neutral" | "danger";

const EQUIPMENT_TONE: Record<EquipmentStatus, Tone> = {
  AVAILABLE: "green",
  BOOKED: "gold",
  MAINTENANCE: "gold",
  RETIRED: "neutral",
};

export function EquipmentStatusChip({ status }: { status?: EquipmentStatus }) {
  if (!status) return <Badge tone="neutral">Unknown</Badge>;
  return <Badge tone={EQUIPMENT_TONE[status] ?? "neutral"}>{status}</Badge>;
}

const BOOKING_TONE: Record<BookingStatus, Tone> = {
  PENDING: "gold",
  APPROVED: "gold",
  REJECTED: "danger",
  CONFIRMED: "green",
  IN_USE: "green",
  COMPLETED: "neutral",
  CANCELLED: "neutral",
  OVERDUE: "danger",
};

export function BookingStatusChip({ status }: { status: BookingStatus }) {
  return (
    <Badge tone={BOOKING_TONE[status] ?? "neutral"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  UNPAID: "gold",
  PAID: "green",
  REFUNDED: "neutral",
};

export function PaymentStatusChip({ status }: { status?: PaymentStatus }) {
  if (!status) return null;
  return <Badge tone={PAYMENT_TONE[status] ?? "neutral"}>{status}</Badge>;
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
      <span
        className={`text-sm text-ink ${mono ? "font-mono" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}
