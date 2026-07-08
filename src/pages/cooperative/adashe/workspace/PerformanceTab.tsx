/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { TrendingUp, Coins, Users, Percent } from "lucide-react";

import { formatNaira } from "../../../../lib/format";
import type { GroupDetail } from "../../../../types/adashe";

interface PerformanceTabProps {
  detail: GroupDetail;
}

/** Real metrics derived from the loaded group detail (no simulated charts). */
export default function PerformanceTab({ detail }: PerformanceTabProps) {
  const stats = useMemo(() => {
    const paidCount = detail.payoutOrder.filter((s) => s.paid).length;
    const activeMembers =
      detail.members?.filter((m) => m.status === "ACTIVE").length ??
      detail.payoutOrder.length;
    const expected =
      detail.expectedPoolThisCycle ??
      detail.contributionAmount * (activeMembers || detail.maxSlots);
    const collected = detail.collectedThisCycle ?? detail.poolBalance;
    const collectionRate =
      expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
    const rotationPct =
      detail.maxSlots > 0
        ? Math.round((paidCount / detail.maxSlots) * 100)
        : 0;
    const perTurn = detail.contributionAmount * detail.maxSlots;
    return {
      paidCount,
      activeMembers,
      collectionRate,
      rotationPct,
      perTurn,
    };
  }, [detail]);

  const myMember = detail.members?.find(
    (m) => m.memberId === detail.me.memberId
  );

  const metrics = [
    {
      icon: Percent,
      label: "Collection this cycle",
      value: `${stats.collectionRate}%`,
      hint: `${formatNaira(detail.collectedThisCycle ?? detail.poolBalance)} collected`,
    },
    {
      icon: TrendingUp,
      label: "Rotation progress",
      value: `${stats.paidCount} / ${detail.maxSlots}`,
      hint: `${stats.rotationPct}% of the wheel paid`,
    },
    {
      icon: Coins,
      label: "Tracked pool",
      value: formatNaira(detail.poolBalance),
      hint: `Per-turn payout ${formatNaira(stats.perTurn)}`,
    },
    {
      icon: Users,
      label: "Active members",
      value: `${stats.activeMembers}`,
      hint: `Cycle ${detail.currentCycle} of ${detail.maxSlots}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="space-y-2 rounded-3xl border border-border bg-surface p-6 shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 text-primary">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                {m.label}
              </span>
              <h3 className="font-mono text-2xl font-bold text-ink">
                {m.value}
              </h3>
              <p className="text-[11px] leading-snug text-muted">
                {m.hint}
              </p>
            </div>
          );
        })}
      </div>

      {/* Rotation progress bar */}
      <div className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div>
          <h4 className="font-display font-semibold text-ink">
            Rotation completion
          </h4>
          <p className="text-xs text-muted">
            {stats.paidCount} of {detail.maxSlots} members have received and
            confirmed their payout.
          </p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${stats.rotationPct}%` }}
          />
        </div>
      </div>

      {/* Personal ledger */}
      <div className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div>
          <h4 className="font-display font-semibold text-ink">
            Your standing
          </h4>
          <p className="text-xs text-muted">
            Your position and contribution total in this circle.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface-2 p-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
              Your slot
            </span>
            <span className="mt-1 block font-mono text-lg font-bold text-primary">
              #{detail.me.position}
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-surface-2 p-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
              Total contributed
            </span>
            <span className="mt-1 block font-mono text-lg font-bold text-ink">
              {formatNaira(myMember?.totalContributed ?? 0)}
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-surface-2 p-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
              Status
            </span>
            <span className="mt-1 block text-sm font-bold capitalize text-ink">
              {detail.me.status.toLowerCase().replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
