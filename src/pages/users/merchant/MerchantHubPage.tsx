/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Merchant Hub (`/app/merchant`) — an independent, status-driven section:
 * NOT_STARTED pitch → IN_PROGRESS KYC wizard → PENDING_REVIEW status →
 * REJECTED decision/resubmit → APPROVED tabbed workspace (overview / products
 * / orders / earnings) → SUSPENDED locked banner. Tabs live in the `?tab=`
 * query (merchant_panel.md §6).
 */

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  Store,
  LayoutDashboard,
  Package,
  Inbox,
  Banknote,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Hourglass,
} from "lucide-react";

import { Button, Spinner } from "../../../components/ui";
import { formatNaira } from "../../../lib/format";
import { useMerchantStore } from "../../../store/merchantStore";
import KycWizard from "./components/KycWizard";
import ProductsTab from "./components/ProductsTab";
import OrdersTab from "./components/OrdersTab";
import EarningsTab from "./components/EarningsTab";
import {
  PendingReviewScreen,
  RejectedScreen,
  StartScreen,
  SuspendedBanner,
} from "./components/StatusScreens";

type TabKey = "overview" | "products" | "orders" | "earnings";

const TABS: { key: TabKey; label: string; icon: typeof Package }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "products", label: "Products", icon: Package },
  { key: "orders", label: "Orders", icon: Inbox },
  { key: "earnings", label: "Earnings", icon: Banknote },
];

export default function MerchantHubPage() {
  const reduce = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();

  const me = useMerchantStore((s) => s.me);
  const meStatus = useMerchantStore((s) => s.meStatus);
  const meError = useMerchantStore((s) => s.meError);
  const fetchMe = useMerchantStore((s) => s.fetchMe);

  // Local "the user clicked Start / Edit & resubmit" flag — the wizard shows
  // for NOT_STARTED/REJECTED only after an explicit start.
  const [wizardStarted, setWizardStarted] = useState(false);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const status = me?.status ?? null;
  const workspace = status === "APPROVED" || status === "SUSPENDED";

  const tabParam = (searchParams.get("tab") as TabKey) || "overview";
  const tab: TabKey = TABS.some((t) => t.key === tabParam)
    ? tabParam
    : "overview";
  const setTab = (next: TabKey) => {
    setSearchParams(next === "overview" ? {} : { tab: next }, {
      replace: true,
    });
  };

  // Reset the wizard flag whenever the lifecycle moves on.
  useEffect(() => {
    if (status && status !== "NOT_STARTED" && status !== "REJECTED") {
      setWizardStarted(false);
    }
  }, [status]);

  const counts = me?.counts;
  const overviewCards = useMemo(
    () => [
      {
        label: "Listings",
        value: String(counts?.products ?? 0),
        sub:
          (counts?.pendingModeration ?? 0) > 0
            ? `${counts?.pendingModeration} awaiting approval`
            : "All reviewed",
        icon: Package,
        tab: "products" as TabKey,
      },
      {
        label: "Open orders",
        value: String(counts?.openOrders ?? 0),
        sub: "Pending → shipped",
        icon: Inbox,
        tab: "orders" as TabKey,
      },
      {
        label: "Available earnings",
        value: formatNaira(me?.earnings?.available ?? 0),
        sub: `${formatNaira(me?.earnings?.pendingPayout ?? 0)} pending payout`,
        icon: Banknote,
        tab: "earnings" as TabKey,
      },
    ],
    [counts, me?.earnings]
  );

  // --- Loading / error shells --------------------------------------------------------

  if (meStatus === "loading" && !me) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading your merchant profile" />
      </div>
    );
  }

  if (meStatus === "error" && !me) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="rounded-3xl border border-border bg-surface p-10 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-7 w-7 text-danger" />
          <p className="text-sm font-semibold text-ink">
            Couldn&apos;t load the Merchant Hub
          </p>
          <p className="mt-1 text-xs text-muted">{meError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void fetchMe()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!me || !status) return null;

  // --- Status-driven screens -----------------------------------------------------------

  if (status === "NOT_STARTED" && !wizardStarted) {
    return <StartScreen onStart={() => setWizardStarted(true)} />;
  }

  if (status === "REJECTED" && !wizardStarted) {
    return <RejectedScreen me={me} onResubmit={() => setWizardStarted(true)} />;
  }

  if (status === "PENDING_REVIEW") {
    return <PendingReviewScreen me={me} />;
  }

  if (!workspace) {
    // NOT_STARTED (started) / IN_PROGRESS / REJECTED (resubmitting) → wizard.
    return (
      <div className="space-y-6">
        <header className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
            <Store className="h-4 w-4 text-amber-500" /> Merchant application
          </div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
            Become a merchant
          </h1>
        </header>
        <KycWizard me={me} />
      </div>
    );
  }

  // --- APPROVED / SUSPENDED workspace ----------------------------------------------------

  const suspended = status === "SUSPENDED";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero band */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[28px] border border-amber-400/20 bg-gradient-to-r from-[#125D39] via-[#1a6e43] to-[#2F8537] p-6 text-white shadow-lg md:p-8"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/90">
              <Store className="h-4 w-4 text-amber-300" /> Merchant Hub
            </div>
            <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
              {me.businessInfo?.businessName ?? "Your storefront"}
            </h1>
            <p className="flex items-center gap-1.5 text-xs text-emerald-100/90">
              {suspended ? (
                <>
                  <Hourglass className="h-3.5 w-3.5 text-amber-300" />
                  Suspended — fulfilment &amp; earnings remain available
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  Approved merchant
                  {me.merchantRef ? (
                    <span className="font-mono text-white/70">
                      · {me.merchantRef}
                    </span>
                  ) : null}
                </>
              )}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Available earnings
            </p>
            <p className="font-mono text-xl font-bold">
              {formatNaira(me.earnings?.available ?? 0)}
            </p>
          </div>
        </div>
      </motion.div>

      {suspended && <SuspendedBanner me={me} />}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Merchant sections"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                active
                  ? "border-primary bg-primary text-white shadow-md shadow-primary/15"
                  : "border-border bg-surface text-muted hover:border-primary/25 hover:text-ink"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <motion.div
        key={tab}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {tab === "overview" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {overviewCards.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setTab(c.tab)}
                className="rounded-3xl border border-border bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-xl"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  <c.icon className="h-3.5 w-3.5" /> {c.label}
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-ink">
                  {c.value}
                </p>
                <p className="mt-1 text-xs text-muted">{c.sub}</p>
              </button>
            ))}
          </div>
        )}
        {tab === "products" && <ProductsTab readOnly={suspended} />}
        {tab === "orders" && <OrdersTab />}
        {tab === "earnings" && <EarningsTab readOnly={suspended} />}
      </motion.div>
    </div>
  );
}
