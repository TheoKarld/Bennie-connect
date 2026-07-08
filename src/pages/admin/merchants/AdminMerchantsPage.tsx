/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin Merchants ops console (`/bennie/merchants`).
 *
 * Tabs: Directory (server-paginated table, kycStatus filter chips, Prembly
 * signal + earnings aggregates), and Payouts (the cross-merchant payout queue).
 * The KYC review queue is reachable via the `PENDING_REVIEW` filter chip. Rows
 * deep-link to the merchant detail page. Server-backed via
 * `adminMerchantsStore`, permission-aware, light/dark aware.
 */

import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Banknote, Search, Store, Users } from "lucide-react";

import PermissionGate from "../../../components/admin/PermissionGate";
import { useAdminMerchantsStore } from "../../../store/adminMerchantsStore";
import type {
  AdminMerchantListFilters,
  MerchantKycStatus,
} from "../../../types/adminMarketplace";
import PayoutQueue from "./components/PayoutQueue";
import {
  EmptyBlock,
  ErrorBlock,
  KycChip,
  LoadingBlock,
  Pager,
  PremblyBadge,
  ngn,
} from "../marketplace/components/shared";

const KYC_CHIPS: (MerchantKycStatus | "")[] = [
  "",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
  "IN_PROGRESS",
];

type TabKey = "directory" | "payouts";

function Directory() {
  const merchants = useAdminMerchantsStore((s) => s.merchants);
  const status = useAdminMerchantsStore((s) => s.merchantsStatus);
  const error = useAdminMerchantsStore((s) => s.merchantsError);
  const total = useAdminMerchantsStore((s) => s.merchantsTotal);
  const page = useAdminMerchantsStore((s) => s.merchantsPage);
  const limit = useAdminMerchantsStore((s) => s.merchantsLimit);
  const filters = useAdminMerchantsStore((s) => s.merchantFilters);
  const setFilters = useAdminMerchantsStore((s) => s.setMerchantFilters);
  const fetchMerchants = useAdminMerchantsStore((s) => s.fetchMerchants);

  const [search, setSearch] = useState("");

  useEffect(() => {
    void fetchMerchants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (patch: Partial<AdminMerchantListFilters>) => {
    setFilters({ ...patch, page: 1 });
    void fetchMerchants();
  };
  const goPage = (p: number) => {
    setFilters({ page: p });
    void fetchMerchants();
  };
  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    apply({ q: search.trim() || undefined });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {KYC_CHIPS.map((k) => (
            <button
              key={k || "ALL"}
              type="button"
              onClick={() => apply({ kycStatus: (k || undefined) as MerchantKycStatus })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                (filters.kycStatus ?? "") === k
                  ? "bg-primary text-white"
                  : "bg-primary/8 text-primary hover:bg-primary/15"
              }`}
            >
              {k ? k.replace(/_/g, " ") : "All"}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name / id / email…"
            className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </form>
      </div>

      {status === "loading" && <LoadingBlock label="Loading merchants" />}
      {status === "error" && (
        <ErrorBlock
          message={error ?? "Unable to load merchants."}
          onRetry={() => void fetchMerchants()}
        />
      )}
      {status === "ready" && merchants.length === 0 && (
        <EmptyBlock
          icon={Store}
          title="No merchants match"
          hint="Adjust the filters to widen the search."
        />
      )}

      {status === "ready" && merchants.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface/70">
          <div className="hidden grid-cols-[minmax(0,2fr)_1.2fr_1fr_0.8fr_1fr] gap-3 border-b border-border px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted lg:grid">
            <span>Business</span>
            <span>Owner</span>
            <span>KYC · Prembly</span>
            <span>Listings</span>
            <span>Available</span>
          </div>
          <ul className="divide-y divide-border">
            {merchants.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/bennie/merchants/${m.id}`}
                  className="grid grid-cols-1 gap-2 px-5 py-3.5 transition hover:bg-primary/[0.03] lg:grid-cols-[minmax(0,2fr)_1.2fr_1fr_0.8fr_1fr] lg:items-center"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                      <Store className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {m.businessName}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {m.merchantId ?? m.id}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{m.owner?.name ?? "—"}</p>
                    <p className="truncate text-[11px] text-muted">{m.owner?.email ?? ""}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <KycChip status={m.kycStatus} />
                    <PremblyBadge status={m.premblyStatus} />
                  </div>
                  <span className="text-sm text-ink">{m.listings}</span>
                  <span className="text-sm font-semibold text-ink">
                    {ngn(m.earnings?.availableBalance)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Pager page={page} limit={limit} total={total} onPage={goPage} />
    </section>
  );
}

export default function AdminMerchantsPage() {
  const reduce = useReducedMotion();
  const [params, setParams] = useSearchParams();
  const initial = (params.get("tab") as TabKey) || "directory";
  const [tab, setTab] = useState<TabKey>(
    initial === "payouts" ? "payouts" : "directory"
  );

  const setTabAndUrl = (t: TabKey) => {
    setTab(t);
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };

  const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] =
    [
      { key: "directory", label: "Directory", icon: Users },
      { key: "payouts", label: "Payouts", icon: Banknote },
    ];

  return (
    <PermissionGate anyOf={["merchants:view"]}>
      <div className="space-y-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-display text-2xl font-semibold text-ink">Merchants</h1>
          <p className="mt-1 text-sm text-muted">
            Seller identity plane — KYC review, suspension, earnings and the manual
            payout queue.
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTabAndUrl(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-primary/8 hover:text-primary"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "directory" && <Directory />}
        {tab === "payouts" && <PayoutQueue />}
      </div>
    </PermissionGate>
  );
}
