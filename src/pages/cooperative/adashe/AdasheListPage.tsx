/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  Plus,
  Users,
  ChevronRight,
  Mail,
  Check,
  X,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { Button, Badge, Spinner, pushToast } from "../../../components/ui";
import { formatNaira } from "../../../lib/format";
import { useAdasheStore } from "../../../store/adasheStore";
import CreateCircleModal from "./components/CreateCircleModal";
import type { GroupSummary } from "../../../types/adashe";

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

function progressOf(g: GroupSummary): number {
  const denom = g.contributionAmount * g.maxSlots;
  if (denom <= 0) return 0;
  return Math.min(100, Math.round((g.poolBalance / denom) * 100));
}

export default function AdasheListPage() {
  const navigate = useNavigate();

  const myGroups = useAdasheStore((s) => s.myGroups);
  const invitations = useAdasheStore((s) => s.invitations);
  const listStatus = useAdasheStore((s) => s.listStatus);
  const listError = useAdasheStore((s) => s.listError);
  const fetchMyGroups = useAdasheStore((s) => s.fetchMyGroups);
  const fetchInvitations = useAdasheStore((s) => s.fetchInvitations);
  const acceptInvitation = useAdasheStore((s) => s.acceptInvitation);
  const declineInvitation = useAdasheStore((s) => s.declineInvitation);

  const [createOpen, setCreateOpen] = useState(false);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);

  useEffect(() => {
    void fetchMyGroups();
    void fetchInvitations();
  }, [fetchMyGroups, fetchInvitations]);

  const stats = useMemo(() => {
    const active = myGroups.filter((g) => g.status === "ACTIVE").length;
    const pooled = myGroups.reduce((sum, g) => sum + (g.poolBalance || 0), 0);
    const myTurns = myGroups.filter((g) => g.isMyTurn).length;
    return { active, pooled, myTurns };
  }, [myGroups]);

  const handleAccept = async (invId: string) => {
    setBusyInvite(invId);
    try {
      await acceptInvitation(invId);
      pushToast({
        title: "Joined the circle",
        message: "You now hold a slot in the rotation.",
        tone: "success",
      });
    } catch (err) {
      pushToast({
        title: "Could not accept",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setBusyInvite(null);
    }
  };

  const handleDecline = async (invId: string) => {
    setBusyInvite(invId);
    try {
      await declineInvitation(invId);
    } catch (err) {
      pushToast({
        title: "Could not decline",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setBusyInvite(null);
    }
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
                <Users className="h-4 w-4 text-emerald-300" /> Thrift savings
              </div>
              <h1 className="font-display text-3xl font-medium tracking-tight">
                Adashe circles
              </h1>
              <p className="max-w-2xl text-xs leading-relaxed text-emerald-100/90 sm:text-sm">
                Rotating savings with trusted farmers. Pool contributions each
                cycle and get paid out in turn — invite-only and member-governed.
              </p>
            </div>

            <Button
              variant="accent"
              onClick={() => setCreateOpen(true)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              Create circle
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-white/15 pt-6 sm:grid-cols-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                Active circles
              </span>
              <h2 className="mt-1 font-mono text-2xl font-bold">
                {stats.active}
              </h2>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                Total pooled
              </span>
              <h2 className="mt-1 font-mono text-2xl font-bold">
                {formatNaira(stats.pooled)}
              </h2>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                Your turns due
              </span>
              <h2 className="mt-1 font-mono text-2xl font-bold text-[#E9A42F]">
                {stats.myTurns}
              </h2>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Invitations */}
      {invitations.length > 0 && (
        <Reveal>
          <div className="space-y-4 rounded-3xl border border-accent/25 bg-accent/5 p-6">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              <h2 className="font-display text-lg font-semibold text-ink">
                Pending invitations
              </h2>
              <Badge tone="gold">{invitations.length}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <h3 className="truncate text-sm font-bold text-ink">
                      {inv.groupName}
                    </h3>
                    <p className="text-xs text-muted">
                      {inv.inviterName ? `From ${inv.inviterName} · ` : ""}
                      {inv.contributionAmount
                        ? `${formatNaira(inv.contributionAmount)}`
                        : ""}
                      {inv.frequency ? ` / ${inv.frequency.toLowerCase()}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(inv.id)}
                      loading={busyInvite === inv.id}
                    >
                      <Check className="h-3.5 w-3.5" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDecline(inv.id)}
                      disabled={busyInvite === inv.id}
                    >
                      <X className="h-3.5 w-3.5" /> Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* My circles */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink">
            My circles
          </h2>
          <button
            onClick={() => {
              void fetchMyGroups();
              void fetchInvitations();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary transition hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {listStatus === "loading" && myGroups.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner label="Loading your circles" />
          </div>
        ) : listStatus === "error" && myGroups.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-ink">
              Couldn&apos;t load your circles
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
              {listError}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fetchMyGroups()}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          </div>
        ) : myGroups.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-ink">
              You&apos;re not in any circles yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
              Create a circle and invite trusted farmers, or accept an
              invitation to join an existing rotation.
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Create your first circle
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {myGroups.map((g, i) => {
              const progress = progressOf(g);
              return (
                <Reveal key={g.id} delay={0.04 * i}>
                  <button
                    onClick={() => navigate(`/app/adashe/${g.id}`)}
                    className="flex h-full w-full flex-col justify-between rounded-3xl border border-border bg-surface p-6 text-left shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1.5">
                          <h3 className="truncate font-display text-lg font-semibold text-ink">
                            {g.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="green">{g.type}</Badge>
                            <Badge
                              tone={
                                g.status === "ACTIVE"
                                  ? "green"
                                  : g.status === "FORMING"
                                    ? "gold"
                                    : "neutral"
                              }
                            >
                              {g.status}
                            </Badge>
                            {g.isMyTurn && <Badge tone="gold">Your turn</Badge>}
                          </div>
                        </div>
                        {typeof g.pendingActionCount === "number" &&
                          g.pendingActionCount > 0 && (
                            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-stone-900">
                              {g.pendingActionCount} to act
                            </span>
                          )}
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-surface-2 p-3 text-xs">
                        <div>
                          <span className="block text-[10.5px] font-medium text-muted">
                            Cycle
                          </span>
                          <span className="mt-0.5 block font-bold text-ink">
                            {g.currentCycle} / {g.maxSlots}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10.5px] font-medium text-muted">
                            Your slot
                          </span>
                          <span className="mt-0.5 block font-bold text-primary">
                            {g.myPosition ? `#${g.myPosition}` : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-medium text-muted">
                          <span>Pool progress</span>
                          <span>
                            {formatNaira(g.poolBalance)} ({progress}%)
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-5">
                      <span className="text-[11px] text-muted">
                        {formatNaira(g.contributionAmount)} /{" "}
                        {g.frequency.toLowerCase()}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold text-primary">
                        Open workspace <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>

      <CreateCircleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => navigate(`/app/adashe/${id}`)}
      />
    </div>
  );
}
