/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Status chip for an equipment booking. Every hue is light/dark aware via the
 * theme tokens + `dark:` variants — no hardcoded neutral hex.
 */

import React from "react";

import type { BookingStatus } from "../../../../types/equipment";

const STYLES: Record<BookingStatus, { label: string; className: string }> = {
  PENDING: {
    label: "Pending approval",
    className:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/25",
  },
  APPROVED: {
    label: "Approved · pay to confirm",
    className:
      "bg-primary/10 text-primary border-primary/20 dark:bg-primary/15 dark:text-emerald-300 dark:border-primary/25",
  },
  REJECTED: {
    label: "Rejected",
    className:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25",
  },
  CONFIRMED: {
    label: "Confirmed",
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
  },
  IN_USE: {
    label: "In use · live",
    className:
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25",
  },
  COMPLETED: {
    label: "Completed",
    className:
      "bg-surface-2 text-muted border-border dark:bg-surface-2 dark:text-muted dark:border-border",
  },
  CANCELLED: {
    label: "Cancelled",
    className:
      "bg-surface-2 text-muted border-border dark:bg-surface-2 dark:text-muted dark:border-border",
  },
  OVERDUE: {
    label: "Overdue",
    className:
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/25",
  },
};

export default function BookingStatusBadge({
  status,
  className = "",
}: {
  status: BookingStatus;
  className?: string;
}) {
  const conf = STYLES[status] ?? STYLES.PENDING;
  const live = status === "IN_USE";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${conf.className} ${className}`}
    >
      {live && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {conf.label}
    </span>
  );
}
