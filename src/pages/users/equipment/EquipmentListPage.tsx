/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Fleet browser — search/filter available equipment and request a PENDING
 * booking. Server-backed via `useEquipmentStore`. Fully themed + responsive.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  Tractor,
  Search,
  SlidersHorizontal,
  Calendar,
  RefreshCw,
  AlertCircle,
  ClipboardList,
  X,
} from "lucide-react";

import { Button, Spinner } from "../../../components/ui";
import { useEquipmentStore } from "../../../store/equipmentStore";
import type { Equipment, EquipmentBooking } from "../../../types/equipment";
import EquipmentCard from "./components/EquipmentCard";
import BookingRequestModal from "./components/BookingRequestModal";
import { CATEGORY_OPTIONS } from "./components/equipmentMeta";

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

/** Split ISO datetime into a `date` input value (YYYY-MM-DD). */
function toDateInput(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function EquipmentListPage() {
  const navigate = useNavigate();

  const equipment = useEquipmentStore((s) => s.equipment);
  const total = useEquipmentStore((s) => s.total);
  const filters = useEquipmentStore((s) => s.filters);
  const listStatus = useEquipmentStore((s) => s.listStatus);
  const listError = useEquipmentStore((s) => s.listError);
  const setFilters = useEquipmentStore((s) => s.setFilters);
  const fetchEquipment = useEquipmentStore((s) => s.fetchEquipment);

  // Local, uncommitted filter inputs (committed on submit/change).
  const [q, setQ] = useState(filters.q ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const [requesting, setRequesting] = useState<Equipment | null>(null);

  useEffect(() => {
    void fetchEquipment();
  }, [fetchEquipment]);

  // Refetch whenever the committed filters object changes.
  useEffect(() => {
    void fetchEquipment({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.category,
    filters.startDate,
    filters.endDate,
    filters.sortBy,
    filters.order,
    filters.q,
  ]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.category) n++;
    if (filters.startDate && filters.endDate) n++;
    return n;
  }, [filters.category, filters.startDate, filters.endDate]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ q: q.trim() });
  };

  const clearFilters = () => {
    setQ("");
    setFilters({
      q: "",
      category: "",
      startDate: undefined,
      endDate: undefined,
    });
  };

  const onCreated = (booking: EquipmentBooking) => {
    // Navigate to My bookings so the user can track the request lifecycle.
    navigate("/app/equipment/bookings", { state: { newBookingId: booking.id } });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <Reveal>
        <div className="relative overflow-hidden rounded-[28px] border border-primary/10 bg-gradient-to-r from-[#125D39] via-[#1a6e43] to-[#2F8537] p-6 text-white shadow-lg md:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
          <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/90">
                <Tractor className="h-4 w-4 text-emerald-300" /> Equipment rental
              </div>
              <h1 className="font-display text-3xl font-medium tracking-tight">
                Book farm equipment
              </h1>
              <p className="max-w-2xl text-xs leading-relaxed text-emerald-100/90 sm:text-sm">
                Request tractors, harvesters and more from the cooperative fleet.
                Pay from your wallet once approved, then track the operator live
                by GPS while it's in use.
              </p>
            </div>

            <Button
              variant="accent"
              onClick={() => navigate("/app/equipment/bookings")}
              className="shrink-0"
            >
              <ClipboardList className="h-4 w-4" />
              My bookings
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Search + filters */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form onSubmit={submitSearch} className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or model…"
              className="w-full rounded-2xl border border-border bg-surface py-3 pl-10 pr-4 text-sm font-medium text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </form>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              showFilters || activeFilterCount > 0
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-border bg-surface text-muted hover:text-ink"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-4 rounded-3xl border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Category
              </label>
              <select
                value={filters.category ?? ""}
                onChange={(e) =>
                  setFilters({
                    category:
                      (e.target.value as Equipment["category"] | "") || "",
                  })
                }
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">All categories</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date window */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                <Calendar className="h-3.5 w-3.5" /> From
              </label>
              <input
                type="date"
                value={toDateInput(filters.startDate)}
                onChange={(e) =>
                  setFilters({
                    startDate: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                <Calendar className="h-3.5 w-3.5" /> To
              </label>
              <input
                type="date"
                value={toDateInput(filters.endDate)}
                min={toDateInput(filters.startDate)}
                onChange={(e) =>
                  setFilters({
                    endDate: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Sort */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Sort by
              </label>
              <select
                value={`${filters.sortBy ?? "dailyRate"}:${filters.order ?? "asc"}`}
                onChange={(e) => {
                  const [sortBy, order] = e.target.value.split(":") as [
                    "dailyRate" | "name" | "bookingHistory",
                    "asc" | "desc",
                  ];
                  setFilters({ sortBy, order });
                }}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="dailyRate:asc">Price · low to high</option>
                <option value="dailyRate:desc">Price · high to low</option>
                <option value="name:asc">Name · A to Z</option>
                <option value="bookingHistory:desc">Most booked</option>
              </select>
            </div>

            {activeFilterCount > 0 && (
              <div className="sm:col-span-2 lg:col-span-4">
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            {listStatus === "ready"
              ? `${total} unit${total === 1 ? "" : "s"} available`
              : "Available fleet"}
          </p>
          <button
            onClick={() => fetchEquipment()}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary transition hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {listStatus === "loading" && equipment.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner label="Loading equipment" />
          </div>
        ) : listStatus === "error" && equipment.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-ink">
              Couldn&apos;t load equipment
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
              {listError}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fetchEquipment()}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          </div>
        ) : equipment.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
              <Tractor className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-ink">
              No equipment matches your search
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
              Try a different category or date window, or clear the filters.
            </p>
            {activeFilterCount > 0 && (
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {equipment.map((item, i) => (
              <EquipmentCard
                key={item.id}
                item={item}
                index={i}
                onRequest={setRequesting}
              />
            ))}
          </div>
        )}
      </div>

      <BookingRequestModal
        open={!!requesting}
        equipment={requesting}
        onClose={() => setRequesting(null)}
        onCreated={onCreated}
      />
    </div>
  );
}
