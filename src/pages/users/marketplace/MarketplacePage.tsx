/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LIVE storefront (`/app/marketplace`) — category rail/chips, debounced search,
 * sort, in-stock toggle, responsive product grid with load-more pagination.
 * Server-backed via `useMarketplaceStore`; filters reflected in the URL query.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ShoppingBag,
  Search,
  RefreshCw,
  AlertCircle,
  PackageSearch,
  ClipboardList,
  Store,
  ArrowRight,
} from "lucide-react";

import { Button } from "../../../components/ui";
import { useMarketplaceStore } from "../../../store/marketplaceStore";
import type { ProductSort } from "../../../types/marketplace";
import ProductCard from "./components/ProductCard";
import CartButton from "./components/CartButton";
import { SORT_OPTIONS } from "./components/marketplaceMeta";

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border bg-surface"
        >
          <div className="aspect-[4/3] animate-pulse bg-surface-2" />
          <div className="space-y-2.5 p-4">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-2" />
            <div className="h-3 w-full animate-pulse rounded-full bg-surface-2" />
            <div className="h-5 w-1/3 animate-pulse rounded-full bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MarketplacePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const categories = useMarketplaceStore((s) => s.categories);
  const products = useMarketplaceStore((s) => s.products);
  const total = useMarketplaceStore((s) => s.total);
  const filters = useMarketplaceStore((s) => s.filters);
  const listStatus = useMarketplaceStore((s) => s.listStatus);
  const listError = useMarketplaceStore((s) => s.listError);
  const appending = useMarketplaceStore((s) => s.appending);
  const setFilters = useMarketplaceStore((s) => s.setFilters);
  const fetchProducts = useMarketplaceStore((s) => s.fetchProducts);

  // Local search input (debounced into the committed filters).
  const [q, setQ] = useState(filters.q ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt URL query once on mount (shareable / back-button-safe).
  const adoptedRef = useRef(false);
  useEffect(() => {
    if (adoptedRef.current) return;
    adoptedRef.current = true;
    const urlQ = searchParams.get("q") ?? "";
    const urlCategory = searchParams.get("category") ?? "";
    const urlSort = (searchParams.get("sort") as ProductSort) || "newest";
    const urlStock = searchParams.get("inStockOnly") === "1";
    if (urlQ || urlCategory || urlSort !== "newest" || urlStock) {
      setQ(urlQ);
      setFilters({
        q: urlQ,
        category: urlCategory,
        sort: SORT_OPTIONS.some((o) => o.value === urlSort)
          ? urlSort
          : "newest",
        inStockOnly: urlStock,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect committed filters in the URL.
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.q) params.q = filters.q;
    if (filters.category) params.category = filters.category;
    if (filters.sort && filters.sort !== "newest") params.sort = filters.sort;
    if (filters.inStockOnly) params.inStockOnly = "1";
    setSearchParams(params, { replace: true });
  }, [filters.q, filters.category, filters.sort, filters.inStockOnly, setSearchParams]);

  // Fetch on committed-filter change (including first load).
  useEffect(() => {
    void fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.category, filters.sort, filters.inStockOnly]);

  // Debounced search → committed filters (350 ms).
  const onSearchChange = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters({ q: value.trim() });
    }, 350);
  };
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const hasMore = products.length < total;

  const loadMore = () => {
    setFilters({ page: (filters.page ?? 1) + 1 });
    void fetchProducts({ append: true });
  };

  const clearFilters = () => {
    setQ("");
    setFilters({ q: "", category: "", sort: "newest", inStockOnly: false });
  };

  const anyFilter = useMemo(
    () =>
      Boolean(filters.q || filters.category || filters.inStockOnly) ||
      filters.sort !== "newest",
    [filters]
  );

  const totalCatalogue = useMemo(
    () => categories.reduce((sum, c) => sum + (c.productCount || 0), 0),
    [categories]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Hero */}
      <Reveal>
        <div className="relative overflow-hidden rounded-[28px] border border-primary/10 bg-gradient-to-r from-[#125D39] via-[#1a6e43] to-[#2F8537] p-6 text-white shadow-lg md:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
          <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/90">
                <ShoppingBag className="h-4 w-4 text-emerald-300" /> Marketplace
              </div>
              <h1 className="font-display text-3xl font-medium tracking-tight">
                Farm inputs &amp; produce
              </h1>
              <p className="max-w-2xl text-xs leading-relaxed text-emerald-100/90 sm:text-sm">
                Shop a moderated catalogue from the cooperative store and
                verified member merchants. Pay securely from your wallet —
                orders are tracked to your door.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <CartButton light />
              <button
                type="button"
                onClick={() => navigate("/app/marketplace/orders")}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                <ClipboardList className="h-4 w-4" /> My orders
              </button>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Category rail (chips — horizontally scrollable) */}
      <Reveal delay={0.05}>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          <button
            type="button"
            onClick={() => setFilters({ category: "" })}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/25 ${
              !filters.category
                ? "border-primary bg-primary text-white shadow-md shadow-primary/15"
                : "border-border bg-surface text-muted hover:border-primary/25 hover:text-ink"
            }`}
          >
            All{totalCatalogue > 0 ? ` · ${totalCatalogue}` : ""}
          </button>
          {categories.map((cat) => {
            const active = filters.category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilters({ category: active ? "" : cat.id })}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                  active
                    ? "border-primary bg-primary text-white shadow-md shadow-primary/15"
                    : "border-border bg-surface text-muted hover:border-primary/25 hover:text-ink"
                }`}
              >
                {cat.name}
                <span className={active ? "opacity-80" : "opacity-60"}>
                  {" "}
                  · {cat.productCount}
                </span>
              </button>
            );
          })}
        </div>
      </Reveal>

      {/* Search + sort bar */}
      <Reveal delay={0.08}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search seeds, fertilizers, produce…"
              aria-label="Search products"
              className="w-full rounded-2xl border border-border bg-surface py-3 pl-10 pr-4 text-sm font-medium text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filters.sort ?? "newest"}
              onChange={(e) =>
                setFilters({ sort: e.target.value as ProductSort })
              }
              aria-label="Sort products"
              className="rounded-2xl border border-border bg-surface px-3 py-3 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <label className="flex cursor-pointer select-none items-center gap-2 rounded-2xl border border-border bg-surface px-3.5 py-3 text-xs font-semibold text-ink">
              <input
                type="checkbox"
                checked={Boolean(filters.inStockOnly)}
                onChange={(e) => setFilters({ inStockOnly: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              In stock only
            </label>
          </div>
        </div>
      </Reveal>

      {/* Results */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            {listStatus === "ready"
              ? `${total} product${total === 1 ? "" : "s"}`
              : "Catalogue"}
          </p>
          <button
            type="button"
            onClick={() => void fetchProducts()}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary transition hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {listStatus === "loading" && products.length === 0 ? (
          <GridSkeleton />
        ) : listStatus === "error" && products.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10">
              <AlertCircle className="h-6 w-6 text-danger" />
            </div>
            <p className="text-sm font-semibold text-ink">
              Couldn&apos;t load the marketplace
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
              {listError}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void fetchProducts()}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
              <PackageSearch className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-ink">No products found</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
              Try a different search or category
              {anyFilter ? ", or clear the filters." : "."}
            </p>
            {anyFilter && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  loading={appending}
                >
                  Load more ({products.length} of {total})
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sell link-out */}
      <Reveal delay={0.1}>
        <button
          type="button"
          onClick={() => navigate("/app/merchant")}
          className="group flex w-full items-center justify-between gap-4 rounded-3xl border border-amber-400/30 bg-amber-50/60 px-5 py-4 text-left transition hover:border-amber-400/60 dark:border-amber-400/20 dark:bg-amber-400/5 dark:hover:border-amber-400/40"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
              <Store className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">
                Sell on the marketplace
              </span>
              <span className="block text-xs text-muted">
                Open the Merchant Hub to onboard and list your products.
              </span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-amber-600 transition group-hover:translate-x-0.5 dark:text-amber-300" />
        </button>
      </Reveal>
    </div>
  );
}
