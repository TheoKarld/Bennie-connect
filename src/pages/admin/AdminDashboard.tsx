/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  Users,
  UserCheck,
  ShieldCheck,
  MailCheck,
  UserPlus,
  TrendingUp,
  Activity,
  AlertTriangle,
  ArrowRight,
  Wallet,
  PiggyBank,
  Landmark,
  Tractor,
  Wrench,
  ShoppingCart,
  Users2,
  Percent,
  Banknote,
  ArrowLeftRight,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

import adminAuthService from "../../services/adminAuth.service";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import { hasAnyPermission } from "../../lib/adminPermissions";
import { ADMIN_NAV } from "../../components/admin/adminNav";
import SignupsChart from "../../components/admin/dashboard/SignupsChart";
import type {
  DashboardOverview,
  DashboardActivityItem,
} from "../../types/admin";

// --- helpers ----------------------------------------------------------------

function fmtNum(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function fmtNgn(n: number | undefined): string {
  if (n == null) return "—";
  return `₦${Math.round(n).toLocaleString()}`;
}

function relTime(iso: string): string {
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
  return `${d}d ago`;
}

function humanAction(a: DashboardActivityItem): string {
  const verb = a.action.split(".").pop() ?? a.action;
  const nice = verb.replace(/_/g, " ");
  return `${nice} · ${a.resource}`;
}

// --- KPI card ---------------------------------------------------------------

interface Kpi {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: boolean;
  sub?: string;
}

function KpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const reduce = useReducedMotion();
  const { icon: Icon, label, value, accent, sub } = kpi;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl border border-border bg-surface/70 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
            accent
              ? "bg-accent/15 text-[#a6701c] dark:text-accent"
              : "bg-primary/8 text-primary"
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 font-mono text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      {sub && <p className="mt-1 text-[11px] text-muted">{sub}</p>}
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-border bg-surface/70 p-5 shadow-sm">
      <div className="h-10 w-10 rounded-2xl bg-primary/8" />
      <div className="mt-4 h-7 w-20 rounded-lg bg-border" />
      <div className="mt-2 h-3 w-24 rounded bg-border" />
    </div>
  );
}

// --- module placeholder cards ----------------------------------------------

const MODULE_META: Record<string, { label: string; icon: LucideIcon }> = {
  wallet: { label: "Wallet & Transactions", icon: Wallet },
  savings: { label: "Savings", icon: PiggyBank },
  shares: { label: "Shares & Dividends", icon: Landmark },
  equipment: { label: "Equipment", icon: Tractor },
  services: { label: "Agri-Services", icon: Wrench },
  marketplace: { label: "Marketplace", icon: ShoppingCart },
  adashe: { label: "Adashe", icon: Users2 },
  agents: { label: "Agents", icon: Percent },
};

function ModulePlaceholderCard({ moduleKey }: { moduleKey: string }) {
  const meta = MODULE_META[moduleKey] ?? {
    label: moduleKey,
    icon: Activity,
  };
  const Icon = meta.icon;
  return (
    <div className="rounded-3xl border border-dashed border-border bg-canvas/60 p-5">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted/8 text-muted">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className="rounded-full bg-muted/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-muted">
          Not yet live
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-muted">{meta.label}</p>
      <p className="mt-0.5 text-[11px] text-muted">
        Activates when the module ships.
      </p>
    </div>
  );
}

// --- main -------------------------------------------------------------------

type LoadState = "loading" | "loaded" | "error";

export default function AdminDashboard() {
  const reduce = useReducedMotion();
  const { admin, effectivePermissions, hasPermission } = useAdminAuth();

  const [data, setData] = useState<DashboardOverview | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const load = async () => {
    setState("loading");
    try {
      const res = await adminAuthService.getDashboardOverview("30d");
      setData(res);
      setState("loaded");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const canUsers = hasPermission("users:view");
  const canAdmins = hasAnyPermission(effectivePermissions, [
    "admins:view",
    "roles:view",
  ]);
  const canAudit = hasPermission("audit-logs:view");
  const canAdasheGroups = hasPermission("adashe-groups:view");
  const canAdasheContrib = hasPermission("adashe-contributions:view");

  // Normalise both possible field-name shapes (layout PRD vs task brief).
  const u = data?.users;
  const verified = u?.verified ?? u?.emailVerified;
  const unverified = u?.unverified ?? u?.emailUnverified;

  const a = data?.admins;
  const adminTotal = a?.total ?? a?.totalActive;
  const roleCounts = a?.roles ?? a?.byRole ?? [];

  const signupTrend = data?.signupsTrend ?? u?.signupTrend ?? [];

  const userKpis: Kpi[] = useMemo(() => {
    if (!canUsers || !u?.available) return [];
    return [
      { label: "Total users", value: fmtNum(u.total), icon: Users, accent: true },
      { label: "Active users", value: fmtNum(u.active), icon: UserCheck },
      { label: "Verified", value: fmtNum(verified), icon: MailCheck },
      {
        label: "New · 7 days",
        value: fmtNum(u.newLast7d),
        icon: UserPlus,
        sub: `${fmtNum(u.newLast30d)} in 30 days`,
      },
    ];
  }, [canUsers, u, verified]);

  const adminKpis: Kpi[] = useMemo(() => {
    if (!canAdmins || !a?.available) return [];
    return [
      { label: "Admins", value: fmtNum(adminTotal), icon: ShieldCheck },
      {
        label: "Activity · 24h",
        value: fmtNum(a.recentActivity24h),
        icon: Activity,
      },
    ];
  }, [canAdmins, a, adminTotal]);

  const ad = data?.adashe;
  const adasheAvailable = ad?.available;
  const poolBalance = ad?.totalPoolBalance ?? ad?.poolBalance;
  const payoutsDue = ad?.payoutRequestsDue ?? 0;
  const slotShiftsDue = ad?.pendingSlotShiftRequests ?? ad?.slotShiftsAwaiting ?? 0;

  const adasheKpis: Kpi[] = useMemo(() => {
    if (!adasheAvailable) return [];
    const out: Kpi[] = [];
    if (canAdasheGroups) {
      out.push({
        label: "Active groups",
        value: fmtNum(ad?.activeGroups),
        icon: Users2,
      });
    }
    if (canAdasheContrib) {
      out.push({
        label: "Pool balance",
        value: fmtNgn(poolBalance),
        icon: Banknote,
      });
      out.push({
        label: "Payout requests due",
        value: fmtNum(payoutsDue),
        icon: ClipboardList,
        accent: payoutsDue > 0,
        sub:
          (ad?.payoutsAwaitingConfirmation ?? 0) > 0
            ? `${fmtNum(ad?.payoutsAwaitingConfirmation)} awaiting confirmation`
            : undefined,
      });
    }
    if (canAdasheGroups) {
      out.push({
        label: "Slot-shift decisions",
        value: fmtNum(slotShiftsDue),
        icon: ArrowLeftRight,
        accent: slotShiftsDue > 0,
      });
    }
    return out;
  }, [
    adasheAvailable,
    canAdasheGroups,
    canAdasheContrib,
    ad,
    poolBalance,
    payoutsDue,
    slotShiftsDue,
  ]);

  // The two live Adashe approval queues (deep-linked into the section).
  const adasheApprovals = useMemo(() => {
    if (!adasheAvailable) return [];
    const rows: {
      key: string;
      label: string;
      count: number;
      icon: LucideIcon;
      link: string;
      visible: boolean;
    }[] = [
      {
        key: "payouts",
        label: "Payout requests due",
        count: payoutsDue,
        icon: Banknote,
        link: "/bennie/adashesu-contributions?hasPendingPayout=true",
        visible: canAdasheContrib,
      },
      {
        key: "slotshift",
        label: "Slot-shift decisions",
        count: slotShiftsDue,
        icon: ArrowLeftRight,
        link: "/bennie/adashesu-contributions?hasPendingSlotShift=true",
        visible: canAdasheGroups,
      },
    ];
    return rows.filter((r) => r.visible);
  }, [
    adasheAvailable,
    payoutsDue,
    slotShiftsDue,
    canAdasheContrib,
    canAdasheGroups,
  ]);

  const modules = data?.modules ?? {};
  const placeholderModules = Object.keys(modules).filter(
    (k) => modules[k]?.available === false
  );

  const quickLinks = useMemo(
    () =>
      ADMIN_NAV.filter(
        (item) =>
          item.to !== "/bennie/dashboard" &&
          (item.permissions.length === 0 ||
            hasAnyPermission(effectivePermissions, item.permissions))
      ).slice(0, 6),
    [effectivePermissions]
  );

  const firstName = admin?.firstName ?? "Admin";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Operational overwatch across the cooperative platform.
          </p>
        </div>
        {state === "loaded" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1.5 text-[11px] font-semibold text-primary">
            <TrendingUp className="h-3.5 w-3.5" /> Live data
          </span>
        )}
      </div>

      {/* Error */}
      {state === "error" && (
        <div className="rounded-3xl border border-danger/30 bg-danger/10 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-danger" />
          <p className="font-display text-lg font-semibold text-ink">
            Couldn't load the dashboard
          </p>
          <p className="mt-1 text-sm text-muted">
            The overview service is unavailable right now.
          </p>
          <button
            onClick={load}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4c2f]"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI grid */}
      {state !== "error" && (
        <section aria-label="Key metrics">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {state === "loading" &&
              Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            {state === "loaded" &&
              [...userKpis, ...adminKpis, ...adasheKpis].map((kpi, i) => (
                <KpiCard key={kpi.label} kpi={kpi} index={i} />
              ))}
            {state === "loaded" &&
              userKpis.length === 0 &&
              adminKpis.length === 0 &&
              adasheKpis.length === 0 && (
                <div className="col-span-full rounded-3xl border border-border bg-surface/70 p-8 text-center text-sm text-muted">
                  No metric cards are available for your permissions.
                </div>
              )}
          </div>
        </section>
      )}

      {state !== "error" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Signups chart */}
          <section
            aria-label="Signups trend"
            className="rounded-3xl border border-border bg-surface/70 p-6 shadow-sm lg:col-span-2"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">
                  New signups
                </h2>
                <p className="text-xs text-muted">Last 30 days</p>
              </div>
              {u?.available && (
                <span className="font-mono text-lg font-semibold text-primary">
                  +{fmtNum(u.newLast30d)}
                </span>
              )}
            </div>
            {state === "loading" ? (
              <div className="h-[200px] animate-pulse rounded-2xl bg-border/60" />
            ) : (
              <SignupsChart data={signupTrend} />
            )}
          </section>

          {/* Recent activity */}
          <section
            aria-label="Recent activity"
            className="rounded-3xl border border-border bg-surface/70 p-6 shadow-sm"
          >
            <h2 className="mb-4 font-display text-base font-semibold text-ink">
              Recent activity
            </h2>
            {state === "loading" ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex animate-pulse items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-border" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 rounded bg-border" />
                      <div className="h-2.5 w-1/2 rounded bg-border" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !canAudit ? (
              <p className="py-6 text-center text-sm text-muted">
                You don't have access to the activity feed.
              </p>
            ) : (data?.recentActivity ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                No recent admin activity.
              </p>
            ) : (
              <ul className="space-y-3">
                {(data?.recentActivity ?? []).slice(0, 12).map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8 text-[10px] font-bold uppercase text-primary">
                      {item.actorEmail?.[0]?.toUpperCase() ?? "S"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {humanAction(item)}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        <span className="font-mono">{item.actorEmail}</span> ·{" "}
                        {relTime(item.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Pending approvals (live Adashe queues) */}
      {state === "loaded" && adasheApprovals.length > 0 && (
        <section aria-label="Pending approvals">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="font-display text-base font-semibold text-ink">
              Pending approvals
            </h2>
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#a6701c] dark:text-accent">
              Live · Adashe
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {adasheApprovals.map(({ key, label, count, icon: Icon, link }) => (
              <Link
                key={key}
                to={link}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-surface/70 p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                    count > 0
                      ? "bg-accent/15 text-[#a6701c] dark:text-accent"
                      : "bg-primary/8 text-primary"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{label}</p>
                  <p className="text-[11px] text-muted">
                    {count > 0
                      ? `${count} awaiting your action`
                      : "Nothing awaiting"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-sm font-bold ${
                    count > 0
                      ? "bg-accent text-white"
                      : "bg-primary/8 text-primary"
                  }`}
                >
                  {count}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted/60 transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Admins by role */}
      {state === "loaded" && canAdmins && roleCounts.length > 0 && (
        <section
          aria-label="Admins by role"
          className="rounded-3xl border border-border bg-surface/70 p-6 shadow-sm"
        >
          <h2 className="mb-4 font-display text-base font-semibold text-ink">
            Admins by role
          </h2>
          <div className="flex flex-wrap gap-3">
            {roleCounts.map((r) => (
              <div
                key={r.name ?? r.role}
                className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface-2 px-4 py-2.5"
              >
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-ink">
                  {r.name ?? r.role}
                </span>
                <span className="font-mono text-sm font-semibold text-primary">
                  {r.count}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick links */}
      {state === "loaded" && quickLinks.length > 0 && (
        <section aria-label="Quick links">
          <h2 className="mb-4 font-display text-base font-semibold text-ink">
            Quick links
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {quickLinks.map(({ label, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface/70 p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-ink">
                  {label}
                  <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Module placeholders */}
      {state === "loaded" && placeholderModules.length > 0 && (
        <section aria-label="Modules not yet live">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="font-display text-base font-semibold text-ink">
              Coming online
            </h2>
            <span className="rounded-full bg-muted/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              {placeholderModules.length} modules
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {placeholderModules.map((k) => (
              <ModulePlaceholderCard key={k} moduleKey={k} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
