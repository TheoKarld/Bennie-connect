/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Status-driven Merchant Hub screens: NOT_STARTED onboarding pitch,
 * PENDING_REVIEW read-only status, REJECTED decision + resubmit, and the
 * SUSPENDED banner (merchant_panel.md §6.2).
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Store,
  Building2,
  IdCard,
  FileUp,
  Hourglass,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Ban,
} from "lucide-react";

import { Button } from "../../../../components/ui";
import type { MerchantMe } from "../../../../types/merchant";
import { formatDateTime } from "../../marketplace/components/marketplaceMeta";
import { idTypeOption } from "./merchantMeta";

function Shell({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-2xl"
    >
      {children}
    </motion.div>
  );
}

// --- NOT_STARTED ----------------------------------------------------------------

export function StartScreen({ onStart }: { onStart: () => void }) {
  const requirements = [
    {
      icon: Building2,
      title: "Business information",
      copy: "Your trading name, address and contact phone.",
    },
    {
      icon: IdCard,
      title: "Government ID",
      copy: "NIN, BVN, driver's licence, voter's card or int'l passport.",
    },
    {
      icon: FileUp,
      title: "Verification documents",
      copy: "Photos of your ID and a selfie — deleted after review.",
    },
  ];

  return (
    <Shell>
      <div className="overflow-hidden rounded-[28px] border border-amber-400/25 bg-surface shadow-sm">
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-amber-500/15 via-amber-400/10 to-transparent p-8 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-400/15 dark:text-amber-300">
            <Store className="h-8 w-8" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink">
            Sell on the cooperative marketplace
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Become a verified merchant: list your produce and inputs to every
            cooperative member, fulfil orders and get paid out to your bank.
          </p>
        </div>

        {/* Requirements */}
        <div className="space-y-3 px-6 py-6 sm:px-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            What you&apos;ll need
          </p>
          {requirements.map((r) => (
            <div
              key={r.title}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface-2/50 p-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <r.icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{r.title}</p>
                <p className="text-xs text-muted">{r.copy}</p>
              </div>
            </div>
          ))}

          <Button fullWidth size="lg" className="mt-2" onClick={onStart}>
            Start application <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-center text-[11px] text-muted">
            Takes about 5 minutes. Your progress is saved as you go.
          </p>
        </div>
      </div>
    </Shell>
  );
}

// --- PENDING_REVIEW ---------------------------------------------------------------

export function PendingReviewScreen({ me }: { me: MerchantMe }) {
  return (
    <Shell>
      <div className="rounded-[28px] border border-border bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300">
          <Hourglass className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink">
          Application under review
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          The cooperative team is reviewing your merchant application.
          You&apos;ll get a notification as soon as a decision is made.
        </p>

        <dl className="mx-auto mt-6 max-w-sm divide-y divide-border rounded-2xl border border-border text-left">
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
              Business
            </dt>
            <dd className="text-sm font-semibold text-ink">
              {me.businessInfo?.businessName ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
              ID
            </dt>
            <dd className="font-mono text-sm text-ink">
              {idTypeOption(me.kyc?.idType)?.label ?? "—"} ·{" "}
              {me.kyc?.idNumberMasked ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
              Submitted
            </dt>
            <dd className="text-sm text-ink">{formatDateTime(me.submittedAt)}</dd>
          </div>
        </dl>
      </div>
    </Shell>
  );
}

// --- REJECTED ------------------------------------------------------------------------

export function RejectedScreen({
  me,
  onResubmit,
}: {
  me: MerchantMe;
  onResubmit: () => void;
}) {
  return (
    <Shell>
      <div className="rounded-[28px] border border-rose-400/30 bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <Ban className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink">
          Application not approved
        </h1>
        {me.rejectionReason ? (
          <div className="mx-auto mt-4 max-w-md rounded-2xl border border-rose-400/30 bg-rose-50/70 p-4 text-left dark:bg-rose-500/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
              Reviewer&apos;s reason
            </p>
            <p className="mt-1 text-sm text-ink">{me.rejectionReason}</p>
          </div>
        ) : (
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            The review team could not approve your application this time.
          </p>
        )}

        <div className="mx-auto mt-5 max-w-md space-y-2 text-left text-xs text-muted">
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Fix the issue above, then edit and resubmit your application.
          </p>
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Your previous documents were deleted after review — fresh uploads
            are required.
          </p>
        </div>

        <Button className="mt-6" onClick={onResubmit}>
          Edit &amp; resubmit <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Shell>
  );
}

// --- SUSPENDED banner ---------------------------------------------------------------------

export function SuspendedBanner({ me }: { me: MerchantMe }) {
  return (
    <div className="flex items-start gap-3 rounded-3xl border border-amber-400/50 bg-amber-50 p-5 dark:border-amber-400/30 dark:bg-amber-400/10">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
        <ShieldAlert className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
          Your merchant account is suspended
        </p>
        <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">
          {me.suspensionReason ||
            "Contact the cooperative for details on reinstatement."}{" "}
          Your listings are hidden from buyers and new selling actions are
          blocked — but you can (and should) still fulfil existing orders, and
          your earnings remain readable.
        </p>
      </div>
    </div>
  );
}
