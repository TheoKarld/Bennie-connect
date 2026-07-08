/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sellers view — merchants with GMV / listing-count / order-count aggregates
 * and KYC chips. Read-only here; rows deep-link to `/bennie/merchants/:id`
 * (all actions live in the Merchants section). Brand tokens, light/dark aware.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Store } from "lucide-react";

import { useAdminMarketplaceStore } from "../../../../store/adminMarketplaceStore";
import { EmptyBlock, KycChip, LoadingBlock, ngn } from "./shared";

export default function SellersView() {
  const sellers = useAdminMarketplaceStore((s) => s.sellers);
  const status = useAdminMarketplaceStore((s) => s.sellersStatus);
  const fetchSellers = useAdminMarketplaceStore((s) => s.fetchSellers);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void fetchSellers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchSellers({ q: search.trim() || undefined });
  };

  return (
    <section className="space-y-4">
      <form onSubmit={onSearch} className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sellers…"
          className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
      </form>

      {status === "loading" && <LoadingBlock label="Loading sellers" />}
      {status !== "loading" && sellers.length === 0 && (
        <EmptyBlock
          icon={Store}
          title="No sellers yet"
          hint="Approved merchants with listings appear here."
        />
      )}
      {sellers.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface/70">
          <div className="hidden grid-cols-[minmax(0,2fr)_1fr_0.8fr_0.8fr_1fr] gap-3 border-b border-border px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted lg:grid">
            <span>Business</span>
            <span>KYC</span>
            <span>Listings</span>
            <span>Orders</span>
            <span>GMV</span>
          </div>
          <ul className="divide-y divide-border">
            {sellers.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/bennie/merchants/${s.id}`}
                  className="grid grid-cols-1 gap-2 px-5 py-3.5 transition hover:bg-primary/[0.03] lg:grid-cols-[minmax(0,2fr)_1fr_0.8fr_0.8fr_1fr] lg:items-center"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                      <Store className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {s.businessName}
                      </p>
                      <p className="truncate text-[11px] text-muted">{s.merchantId ?? s.id}</p>
                    </div>
                  </div>
                  <span>
                    <KycChip status={s.kycStatus} />
                  </span>
                  <span className="text-sm text-ink">{s.listings}</span>
                  <span className="text-sm text-ink">{s.orders}</span>
                  <span className="text-sm font-semibold text-ink">{ngn(s.gmv)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
