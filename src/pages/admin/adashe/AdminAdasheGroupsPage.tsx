/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin Adashe groups directory (`/bennie/adashesu-contributions`).
 *
 * - A filterable groups table (status chips, cycle progress, % paid, pending
 *   badges) whose rows deep-link to the group detail.
 * - A prominent cross-group Payout Requests queue (REQUESTED → mark-sent),
 *   gated by `adashe-contributions:mark-sent` for the action itself.
 * - Create circle + invite-on-detail, permission-gated.
 *
 * Deep-link filters `?hasPendingPayout=true` / `?hasPendingSlotShift=true` from
 * the dashboard pre-apply the corresponding filter.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  Users2,
  Plus,
  Search,
  Banknote,
  ArrowRight,
  Inbox,
} from "lucide-react";

import PermissionGate from "../../../components/admin/PermissionGate";
import { Button } from "../../../components/ui";
import { useAdminAuth } from "../../../hooks/useAdminAuth";
import { useAdminAdasheStore } from "../../../store/adminAdasheStore";
import CreateCircleModal from "./components/CreateCircleModal";
import MarkSentModal from "./components/MarkSentModal";
import ReasonModal from "./components/ReasonModal";
import PayoutRequestCard from "./components/PayoutRequestCard";
import {
  CycleProgress,
  EmptyBlock,
  ErrorBlock,
  GroupStatusChip,
  LoadingBlock,
  ngn,
} from "./components/shared";
import type {
  AdminGroupRow,
  AdminPayoutRequest,
  GroupStatus,
} from "../../../types/adashe";

const STATUS_FILTERS: (GroupStatus | "ALL")[] = [
  "ALL",
  "ACTIVE",
  "FORMING",
  "SUSPENDED",
  "COMPLETED",
];

function GroupsTable({ rows }: { rows: AdminGroupRow[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface/70 shadow-sm">
      <div className="hidden grid-cols-12 gap-4 border-b border-border bg-surface-2 px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-muted md:grid">
        <span className="col-span-4">Circle</span>
        <span className="col-span-2">Status</span>
        <span className="col-span-3">Progress</span>
        <span className="col-span-2 text-right">Pool</span>
        <span className="col-span-1" />
      </div>
      <ul className="divide-y divide-border">
        {rows.map((g, i) => (
          <motion.li
            key={g.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
          >
            <Link
              to={`/bennie/adashesu-contributions/${g.id}`}
              className="grid grid-cols-1 gap-3 px-6 py-4 transition hover:bg-primary/[0.03] md:grid-cols-12 md:items-center md:gap-4"
            >
              <div className="col-span-4 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-ink">
                    {g.name}
                  </p>
                  {g.organizerType === "admin" && (
                    <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#a6701c] dark:text-accent">
                      Overseen
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {g.type} · {g.frequency} · {ngn(g.contributionAmount)} ·{" "}
                  {g.totalMembers}/{g.maxSlots} members
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(g.pendingPayoutRequests ?? 0) > 0 && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#a6701c] dark:text-accent">
                      {g.pendingPayoutRequests} payout due
                    </span>
                  )}
                  {(g.pendingSlotShifts ?? 0) > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                      {g.pendingSlotShifts} slot-shift
                    </span>
                  )}
                  {g.hasArrears && (
                    <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-danger">
                      Arrears
                    </span>
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <GroupStatusChip status={g.status} />
              </div>

              <div className="col-span-3">
                <CycleProgress
                  currentCycle={g.currentCycle}
                  maxSlots={g.maxSlots}
                  paidPositions={g.paidPositions}
                />
              </div>

              <div className="col-span-2 md:text-right">
                <p className="font-mono text-sm font-semibold text-primary">
                  {ngn(g.poolBalance)}
                </p>
              </div>

              <div className="col-span-1 flex md:justify-end">
                <ArrowRight className="h-4 w-4 text-muted/60" />
              </div>
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function GroupsSection() {
  const [params] = useSearchParams();

  const groups = useAdminAdasheStore((s) => s.groups);
  const listStatus = useAdminAdasheStore((s) => s.listStatus);
  const listError = useAdminAdasheStore((s) => s.listError);
  const filters = useAdminAdasheStore((s) => s.filters);
  const setFilters = useAdminAdasheStore((s) => s.setFilters);
  const fetchGroups = useAdminAdasheStore((s) => s.fetchGroups);

  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("adashe-groups:create");

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Apply deep-link filters from the dashboard once on mount.
  useEffect(() => {
    const patch: Record<string, boolean> = {};
    if (params.get("hasPendingPayout") === "true") patch.hasPendingPayout = true;
    if (params.get("hasPendingSlotShift") === "true")
      patch.hasPendingSlotShift = true;
    if (Object.keys(patch).length) setFilters(patch);
    void fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when the status filter or q changes.
  const activeStatus = (filters.status ?? "ALL") as GroupStatus | "ALL";

  const applyStatus = (s: GroupStatus | "ALL") => {
    setFilters({ status: s === "ALL" ? undefined : s, page: 1 });
    void fetchGroups();
  };

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ q: search.trim() || undefined, page: 1 });
    void fetchGroups();
  };

  return (
    <section aria-label="Contribution groups" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-ink">
          Contribution groups
        </h2>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create circle
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => applyStatus(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeStatus === s
                  ? "bg-primary text-white"
                  : "bg-primary/8 text-primary hover:bg-primary/15"
              }`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <form onSubmit={applySearch} className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search circles…"
            className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </form>
      </div>

      {listStatus === "loading" && <LoadingBlock label="Loading circles" />}
      {listStatus === "error" && (
        <ErrorBlock
          message={listError ?? "Unable to load circles."}
          onRetry={() => void fetchGroups()}
        />
      )}
      {listStatus === "ready" && groups.length === 0 && (
        <EmptyBlock
          icon={Users2}
          title="No circles match"
          hint="Adjust the filters, or create a new circle to get started."
        />
      )}
      {listStatus === "ready" && groups.length > 0 && (
        <GroupsTable rows={groups} />
      )}

      <CreateCircleModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </section>
  );
}

function PayoutQueueSection() {
  const payoutQueue = useAdminAdasheStore((s) => s.payoutQueue);
  const status = useAdminAdasheStore((s) => s.payoutQueueStatus);
  const fetchPayoutQueue = useAdminAdasheStore((s) => s.fetchPayoutQueue);

  const { hasPermission } = useAdminAuth();
  const canMarkSent = hasPermission("adashe-contributions:mark-sent");
  const canCancel = hasPermission("adashe-contributions:view");

  const [markTarget, setMarkTarget] = useState<AdminPayoutRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminPayoutRequest | null>(
    null
  );
  const cancelPayout = useAdminAdasheStore((s) => s.cancelPayout);

  useEffect(() => {
    void fetchPayoutQueue();
  }, [fetchPayoutQueue]);

  const dueCount = payoutQueue.length;

  return (
    <section
      aria-label="Payout requests queue"
      className="rounded-3xl border border-accent/30 bg-accent/[0.06] p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent/20 text-[#a6701c] dark:text-accent">
            <Banknote className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-ink">
              Payout requests
            </h2>
            <p className="text-[11px] text-muted">
              Cross-group queue awaiting mark-sent
            </p>
          </div>
        </div>
        {dueCount > 0 && (
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-white">
            {dueCount} due
          </span>
        )}
      </div>

      {status === "loading" && <LoadingBlock label="Loading queue" />}
      {status === "error" && (
        <ErrorBlock
          message="Unable to load the payout queue."
          onRetry={() => void fetchPayoutQueue()}
        />
      )}
      {status === "ready" && payoutQueue.length === 0 && (
        <EmptyBlock
          icon={Inbox}
          title="No payouts due"
          hint="Matured rotation turns raise a payout request here for you to wire and mark sent."
        />
      )}
      {status === "ready" && payoutQueue.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {payoutQueue.map((r) => (
            <PayoutRequestCard
              key={r.id}
              request={r}
              canMarkSent={canMarkSent}
              canCancel={canCancel}
              onMarkSent={setMarkTarget}
              onCancel={setCancelTarget}
              showGroup
            />
          ))}
        </div>
      )}

      <MarkSentModal
        open={!!markTarget}
        onClose={() => setMarkTarget(null)}
        groupId={markTarget?.groupId ?? ""}
        request={markTarget}
      />
      <ReasonModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel payout request"
        tone="danger"
        confirmLabel="Cancel request"
        reasonLabel="Reason"
        description="Voiding a payout request (e.g. duplicate or dispute) is audited. State why."
        onConfirm={async (reason) => {
          if (cancelTarget) {
            await cancelPayout(cancelTarget.groupId, cancelTarget.id, reason);
          }
        }}
      />
    </section>
  );
}

export default function AdminAdasheGroupsPage() {
  const reduce = useReducedMotion();
  return (
    <PermissionGate anyOf={["adashe-groups:view", "adashe-contributions:view"]}>
      <div className="space-y-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-display text-2xl font-semibold text-ink">
            Adashe / Esusu
          </h1>
          <p className="mt-1 text-sm text-muted">
            Govern rotating savings circles, work the manual-payout queue, and
            decide member-voted slot swaps.
          </p>
        </motion.div>

        <PayoutQueueSection />
        <GroupsSection />
      </div>
    </PermissionGate>
  );
}
