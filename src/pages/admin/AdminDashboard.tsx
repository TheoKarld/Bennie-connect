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
      className="rounded-3xl border border-[#E6E5DF] bg-white/70 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
            accent
              ? "bg-[#E7A13C]/15 text-[#a6701c]"
              : "bg-[#135D39]/8 text-[#135D39]"
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 font-mono text-2xl font-semibold tracking-tight text-[#1A2421]">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#5C6460]">
        {label}
      </p>
      {sub && <p className="mt-1 text-[11px] text-[#9AA29D]">{sub}</p>}
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-[#E6E5DF] bg-white/70 p-5 shadow-sm">
      <div className="h-10 w-10 rounded-2xl bg-[#135D39]/8" />
      <div className="mt-4 h-7 w-20 rounded-lg bg-[#E6E5DF]" />
      <div className="mt-2 h-3 w-24 rounded bg-[#E6E5DF]" />
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
    <div className="rounded-3xl border border-dashed border-[#E6E5DF] bg-[#FAF8F5]/60 p-5">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#5C6460]/8 text-[#9AA29D]">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className="rounded-full bg-[#5C6460]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#9AA29D]">
          Not yet live
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-[#5C6460]">{meta.label}</p>
      <p className="mt-0.5 text-[11px] text-[#9AA29D]">
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
          <h1 className="font-display text-2xl font-semibold text-[#1A2421]">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[#5C6460]">
            Operational overwatch across the cooperative platform.
          </p>
        </div>
        {state === "loaded" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#135D39]/8 px-3 py-1.5 text-[11px] font-semibold text-[#135D39]">
            <TrendingUp className="h-3.5 w-3.5" /> Live data
          </span>
        )}
      </div>

      {/* Error */}
      {state === "error" && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-red-500" />
          <p className="font-display text-lg font-semibold text-[#1A2421]">
            Couldn't load the dashboard
          </p>
          <p className="mt-1 text-sm text-[#5C6460]">
            The overview service is unavailable right now.
          </p>
          <button
            onClick={load}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#135D39] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4c2f]"
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
              [...userKpis, ...adminKpis].map((kpi, i) => (
                <KpiCard key={kpi.label} kpi={kpi} index={i} />
              ))}
            {state === "loaded" &&
              userKpis.length === 0 &&
              adminKpis.length === 0 && (
                <div className="col-span-full rounded-3xl border border-[#E6E5DF] bg-white/70 p-8 text-center text-sm text-[#5C6460]">
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
            className="rounded-3xl border border-[#E6E5DF] bg-white/70 p-6 shadow-sm lg:col-span-2"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-[#1A2421]">
                  New signups
                </h2>
                <p className="text-xs text-[#9AA29D]">Last 30 days</p>
              </div>
              {u?.available && (
                <span className="font-mono text-lg font-semibold text-[#135D39]">
                  +{fmtNum(u.newLast30d)}
                </span>
              )}
            </div>
            {state === "loading" ? (
              <div className="h-[200px] animate-pulse rounded-2xl bg-[#E6E5DF]/60" />
            ) : (
              <SignupsChart data={signupTrend} />
            )}
          </section>

          {/* Recent activity */}
          <section
            aria-label="Recent activity"
            className="rounded-3xl border border-[#E6E5DF] bg-white/70 p-6 shadow-sm"
          >
            <h2 className="mb-4 font-display text-base font-semibold text-[#1A2421]">
              Recent activity
            </h2>
            {state === "loading" ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex animate-pulse items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#E6E5DF]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 rounded bg-[#E6E5DF]" />
                      <div className="h-2.5 w-1/2 rounded bg-[#E6E5DF]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !canAudit ? (
              <p className="py-6 text-center text-sm text-[#9AA29D]">
                You don't have access to the activity feed.
              </p>
            ) : (data?.recentActivity ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-[#9AA29D]">
                No recent admin activity.
              </p>
            ) : (
              <ul className="space-y-3">
                {(data?.recentActivity ?? []).slice(0, 12).map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#135D39]/8 text-[10px] font-bold uppercase text-[#135D39]">
                      {item.actorEmail?.[0]?.toUpperCase() ?? "S"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#1A2421]">
                        {humanAction(item)}
                      </p>
                      <p className="truncate text-[11px] text-[#9AA29D]">
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

      {/* Admins by role */}
      {state === "loaded" && canAdmins && roleCounts.length > 0 && (
        <section
          aria-label="Admins by role"
          className="rounded-3xl border border-[#E6E5DF] bg-white/70 p-6 shadow-sm"
        >
          <h2 className="mb-4 font-display text-base font-semibold text-[#1A2421]">
            Admins by role
          </h2>
          <div className="flex flex-wrap gap-3">
            {roleCounts.map((r) => (
              <div
                key={r.name ?? r.role}
                className="flex items-center gap-2.5 rounded-2xl border border-[#E6E5DF] bg-white px-4 py-2.5"
              >
                <ShieldCheck className="h-4 w-4 text-[#135D39]" />
                <span className="text-sm font-medium text-[#1A2421]">
                  {r.name ?? r.role}
                </span>
                <span className="font-mono text-sm font-semibold text-[#135D39]">
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
          <h2 className="mb-4 font-display text-base font-semibold text-[#1A2421]">
            Quick links
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {quickLinks.map(({ label, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-[#E6E5DF] bg-white/70 p-4 shadow-sm transition hover:border-[#135D39]/30 hover:shadow-md"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#135D39]/8 text-[#135D39]">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-[#1A2421]">
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
            <h2 className="font-display text-base font-semibold text-[#1A2421]">
              Coming online
            </h2>
            <span className="rounded-full bg-[#5C6460]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#9AA29D]">
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
