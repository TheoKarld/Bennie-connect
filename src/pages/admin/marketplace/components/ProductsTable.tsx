/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-paginated admin products table. Faceted filters (moderation status,
 * sell-status, source, low-stock, suspended), full-text search, status chips,
 * source pill, and a thumbnail. Rows deep-link to the product detail page.
 * Approve / reject (queue actions) live in the moderation queue; this table
 * offers the create wizard + edit/detail. Brand tokens, light/dark aware.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Plus, Search } from "lucide-react";

import { Button } from "../../../../components/ui";
import { useAdminAuth } from "../../../../hooks/useAdminAuth";
import { useAdminMarketplaceStore } from "../../../../store/adminMarketplaceStore";
import type {
  AdminProductListFilters,
  ModerationStatus,
  ProductSource,
} from "../../../../types/adminMarketplace";
import ProductWizard from "./ProductWizard";
import {
  EmptyBlock,
  ErrorBlock,
  ListingStatusChip,
  LoadingBlock,
  ModerationChip,
  Pager,
  SourcePill,
  ngn,
} from "./shared";

const MODERATION_CHIPS: (ModerationStatus | "")[] = [
  "",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
];
const SOURCE_CHIPS: (ProductSource | "")[] = ["", "ADMIN", "MERCHANT"];

export default function ProductsTable() {
  const products = useAdminMarketplaceStore((s) => s.products);
  const status = useAdminMarketplaceStore((s) => s.productsStatus);
  const error = useAdminMarketplaceStore((s) => s.productsError);
  const total = useAdminMarketplaceStore((s) => s.productsTotal);
  const page = useAdminMarketplaceStore((s) => s.productsPage);
  const limit = useAdminMarketplaceStore((s) => s.productsLimit);
  const filters = useAdminMarketplaceStore((s) => s.productFilters);
  const setFilters = useAdminMarketplaceStore((s) => s.setProductFilters);
  const fetchProducts = useAdminMarketplaceStore((s) => s.fetchProducts);
  const categories = useAdminMarketplaceStore((s) => s.categories);
  const fetchCategories = useAdminMarketplaceStore((s) => s.fetchCategories);
  const lowStockThreshold = useAdminMarketplaceStore((s) => s.lowStockThreshold);

  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("marketplace:create");

  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    void fetchProducts();
    void fetchCategories({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (patch: Partial<AdminProductListFilters>) => {
    setFilters({ ...patch, page: 1 });
    void fetchProducts();
  };
  const goPage = (p: number) => {
    setFilters({ page: p });
    void fetchProducts();
  };
  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    apply({ q: search.trim() || undefined });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-ink">
          Products <span className="text-muted">({total.toLocaleString()})</span>
        </h2>
        {canCreate && (
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4" /> New product
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {MODERATION_CHIPS.map((m) => (
              <button
                key={m || "ALL"}
                type="button"
                onClick={() => apply({ moderationStatus: m || undefined })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  (filters.moderationStatus ?? "") === m
                    ? "bg-primary text-white"
                    : "bg-primary/8 text-primary hover:bg-primary/15"
                }`}
              >
                {m ? m.replace(/_/g, " ") : "All"}
              </button>
            ))}
          </div>
          <form onSubmit={onSearch} className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SOURCE_CHIPS.map((s) => (
            <button
              key={s || "ALL_SRC"}
              type="button"
              onClick={() => apply({ source: s || undefined })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                (filters.source ?? "") === s
                  ? "bg-primary text-white"
                  : "bg-primary/8 text-primary hover:bg-primary/15"
              }`}
            >
              {s ? (s === "ADMIN" ? "Platform" : "Merchant") : "Any source"}
            </button>
          ))}
          <select
            value={filters.categoryId ?? ""}
            onChange={(e) => apply({ categoryId: e.target.value || undefined })}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => apply({ lowStock: filters.lowStock ? undefined : true })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filters.lowStock
                ? "bg-accent text-[#1A2421]"
                : "bg-accent/12 text-[#a6701c] hover:bg-accent/20 dark:text-accent"
            }`}
          >
            Low stock
          </button>
          <button
            type="button"
            onClick={() => apply({ suspended: filters.suspended ? undefined : true })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filters.suspended
                ? "bg-danger text-white"
                : "bg-danger/10 text-danger hover:bg-danger/20"
            }`}
          >
            Suspended
          </button>
        </div>
      </div>

      {status === "loading" && <LoadingBlock label="Loading products" />}
      {status === "error" && (
        <ErrorBlock
          message={error ?? "Unable to load products."}
          onRetry={() => void fetchProducts()}
        />
      )}
      {status === "ready" && products.length === 0 && (
        <EmptyBlock
          icon={Package}
          title="No products match"
          hint="Adjust the filters, or create a platform product."
          action={
            canCreate ? (
              <Button size="sm" onClick={() => setWizardOpen(true)}>
                <Plus className="h-4 w-4" /> New product
              </Button>
            ) : undefined
          }
        />
      )}

      {status === "ready" && products.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface/70">
          <div className="hidden grid-cols-[minmax(0,2.4fr)_1fr_0.8fr_1fr_1.2fr] gap-3 border-b border-border px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted lg:grid">
            <span>Product</span>
            <span>Category</span>
            <span>Price</span>
            <span>Stock</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-border">
            {products.map((p) => {
              const available = p.inventory?.available ?? p.stock?.available ?? 0;
              const low = available <= (p.inventory?.lowStockThreshold ?? lowStockThreshold);
              return (
                <li key={p.id}>
                  <Link
                    to={`/bennie/market-place/products/${p.id}`}
                    className="grid grid-cols-1 gap-3 px-5 py-3.5 transition hover:bg-primary/[0.03] lg:grid-cols-[minmax(0,2.4fr)_1fr_0.8fr_1fr_1.2fr] lg:items-center"
                  >
                    <div className="flex items-center gap-3">
                      {p.images?.[0]?.url ? (
                        <img
                          src={p.images[0].url}
                          alt={p.name}
                          className="h-11 w-11 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-border/40 text-muted">
                          <Package className="h-5 w-5" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-ink">
                            {p.name}
                          </p>
                          <SourcePill source={p.source} />
                        </div>
                        <p className="truncate text-[11px] text-muted">
                          {p.productId ?? p.slug ?? p.id}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted">
                      {p.category?.name ?? "—"}
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      {ngn(p.price)}
                    </span>
                    <span className={`text-sm ${low ? "font-semibold text-danger" : "text-ink"}`}>
                      {available} {p.unit}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ModerationChip status={p.moderationStatus} />
                      <ListingStatusChip status={p.status} />
                      {p.suspended && (
                        <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[9px] font-bold uppercase text-danger">
                          Delisted
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Pager page={page} limit={limit} total={total} onPage={goPage} />

      {canCreate && (
        <ProductWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          defaultThreshold={lowStockThreshold}
        />
      )}
    </section>
  );
}
