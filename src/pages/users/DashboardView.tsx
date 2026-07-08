/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  Wallet,
  PiggyBank,
  Calendar,
  Users,
  Bell,
  ArrowUpRight,
  Vote,
  ArrowLeftRight,
  Mail,
} from "lucide-react";
import { FarmerAppState } from "../../types";
import { useAuth } from "../../hooks/useAuth";
import { useWalletStore } from "../../store/walletStore";
import { useAdasheStore } from "../../store/adasheStore";
import adasheService from "../../services/adashe.service";
import type { Proposal } from "../../types/adashe";
import { formatNaira, formatNumber } from "../../lib/format";
import { COOP_RATES, MEMBER_BOOKING_DISCOUNT } from "../../lib/constants";

interface DashboardViewProps {
  state: FarmerAppState;
  onNavigate: (tab: string) => void;
  onJoinGroup: (groupId: string) => void;
  onCancelBooking: (bookingId: string) => void;
  onReadNotification: (notifId: string) => void;
  onClearNotifications: () => void;
}

/** Entrance-reveal wrapper (respects prefers-reduced-motion). */
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

export default function DashboardView({
  state,
  onNavigate,
  onReadNotification,
  onClearNotifications,
}: DashboardViewProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.firstName || "Farmer";
  const tier = state.membership.tier;
  const myUserId = user?.id ?? user?.userId;

  // Live wallet balance (source of truth). Falls back to 0 until it hydrates.
  const walletAvailable = useWalletStore(
    (s) => s.wallet?.balance.available ?? 0
  );

  const totalSavings =
    state.flexSaveBalance +
    state.targetGoals.reduce(
      (sum, g) => sum + (g.status === "ongoing" ? g.currentAmount : 0),
      0
    ) +
    state.fixedLocks.reduce(
      (sum, l) => sum + (l.status === "locked" ? l.amount : 0),
      0
    ) +
    state.harvestPlans.reduce(
      (sum, p) => sum + (p.status === "active" ? p.amountSaved : 0),
      0
    );

  // LIVE Adashe circle (server-backed via adasheStore / GET /my-groups).
  const myGroups = useAdasheStore((s) => s.myGroups);
  const invitations = useAdasheStore((s) => s.invitations);
  const fetchMyGroups = useAdasheStore((s) => s.fetchMyGroups);
  const fetchInvitations = useAdasheStore((s) => s.fetchInvitations);

  useEffect(() => {
    // NotificationProvider hydrates these on auth; refetch on mount to be safe.
    void fetchMyGroups({ silent: true });
    void fetchInvitations();
  }, [fetchMyGroups, fetchInvitations]);

  // Prefer the circle where it's my turn, else the first ACTIVE, else first.
  const adasheGroup = useMemo(() => {
    if (myGroups.length === 0) return null;
    return (
      myGroups.find((g) => g.isMyTurn) ??
      myGroups.find((g) => g.status === "ACTIVE") ??
      myGroups[0]
    );
  }, [myGroups]);

  const adasheProgress = useMemo(() => {
    if (!adasheGroup) return 0;
    const denom = adasheGroup.contributionAmount * adasheGroup.maxSlots;
    if (denom <= 0) return 0; // guard divide-by-zero
    return Math.min(
      100,
      Math.round((adasheGroup.poolBalance / denom) * 100)
    );
  }, [adasheGroup]);

  const perTurnPayout = adasheGroup
    ? adasheGroup.contributionAmount * adasheGroup.maxSlots
    : 0;

  // Pending slot-shift / vote widget: proposals awaiting my vote + my
  // slot-shifts awaiting admin, derived across my ACTIVE circles.
  const [pendingItems, setPendingItems] = React.useState<
    {
      groupId: string;
      groupName: string;
      proposal: Proposal;
      bucket: "vote" | "awaiting_admin";
    }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const activeGroups = myGroups.filter((g) => g.status === "ACTIVE");
    if (activeGroups.length === 0) {
      setPendingItems([]);
      return;
    }
    (async () => {
      try {
        const results = await Promise.all(
          activeGroups.map(async (g) => {
            try {
              const proposals = await adasheService.getProposals(g.id);
              return { g, proposals };
            } catch {
              return { g, proposals: [] as Proposal[] };
            }
          })
        );
        if (cancelled) return;
        const items: typeof pendingItems = [];
        for (const { g, proposals } of results) {
          for (const p of proposals) {
            if (p.status === "ACTIVE" && !p.myVote) {
              items.push({
                groupId: g.id,
                groupName: g.name,
                proposal: p,
                bucket: "vote",
              });
            } else if (
              p.kind === "SLOT_SHIFT" &&
              p.status === "AWAITING_ADMIN" &&
              p.slotShift &&
              (p.slotShift.requesterMemberId === g.myPosition?.toString() ||
                p.createdByUserId === myUserId)
            ) {
              items.push({
                groupId: g.id,
                groupName: g.name,
                proposal: p,
                bucket: "awaiting_admin",
              });
            }
          }
        }
        setPendingItems(items.slice(0, 6));
      } catch {
        if (!cancelled) setPendingItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGroups, myUserId]);

  const unreadCount = state.notifications.filter((n) => !n.isRead).length;

  const RATES = [
    { label: "Flex Save (Normal)", apy: COOP_RATES.flexSave, accent: false },
    { label: "Target Goal Save", apy: COOP_RATES.targetGoal, accent: false },
    { label: "Seasonal Harvest Save", apy: COOP_RATES.harvestSave, accent: true },
  ];

  return (
    <div className="space-y-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Premium Gradient Hero Banner */}
      <Reveal>
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#125D39] via-[#2F8537] to-[#71B53B] p-6 md:p-8 text-white shadow-lg border border-primary/10">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-white/90 text-[12.5px] font-sans font-medium">
                <span className="text-sm">☀️</span> Good morning, {firstName}
              </div>

              <span className="bg-white/15 text-white backdrop-blur-md text-[10.5px] font-bold px-3 py-1 rounded-full border border-white/20 select-none uppercase tracking-wider">
                {tier} Member
              </span>
            </div>

            <h1 className="text-2xl md:text-3.5xl font-display font-medium text-white mt-1.5 tracking-tight">
              Welcome back to your cooperative
            </h1>

            {/* 3-Column Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 pt-6 border-t border-white/15">
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">
                  Wallet Balance
                </span>
                <h2 className="text-2xl md:text-3xl font-mono font-bold mt-1 text-white">
                  {formatNaira(walletAvailable)}
                </h2>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">
                  Cooperative Savings
                </span>
                <h2 className="text-2xl md:text-3xl font-mono font-bold mt-1 text-white">
                  {formatNaira(totalSavings)}
                </h2>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">
                  Shares Owned
                </span>
                <h2 className="text-2xl md:text-3xl font-mono font-bold mt-1 text-white">
                  {formatNumber(state.shares.sharesOwned)} Units
                </h2>
              </div>
            </div>

            {/* Buttons Group */}
            <div className="flex flex-wrap items-center gap-3 mt-8">
              <button
                onClick={() => onNavigate("wallet")}
                className="bg-accent hover:bg-[#d59124] text-stone-900 font-bold px-5 py-2.5 text-xs rounded-full shadow-md transition-all flex items-center gap-1 duration-200 cursor-pointer"
              >
                + Add money
              </button>
              <button
                onClick={() => {
                  const bDom = document.getElementById("active-bookings-hub");
                  if (bDom) bDom.scrollIntoView({ behavior: "smooth" });
                }}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2.5 text-xs rounded-full border border-white/25 transition-all flex items-center justify-center cursor-pointer"
              >
                Book tractor
              </button>
            </div>
          </div>
        </div>
      </Reveal>

      {/* 4-Column Quick Action Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            key: "wallet",
            label: "Coop Ledger",
            title: "Wallet",
            icon: Wallet,
            iconWrap: "bg-primary/5 text-primary border-primary/10 group-hover:bg-primary/10",
            onClick: () => onNavigate("wallet"),
          },
          {
            key: "savings",
            label: "Lock Yield",
            title: "Save",
            icon: PiggyBank,
            iconWrap: "bg-emerald-50 dark:bg-emerald-500/10 text-primary border-emerald-100 dark:border-emerald-500/20 group-hover:bg-emerald-100/70",
            onClick: () => onNavigate("savings"),
          },
          {
            key: "adashe",
            label: "Thrift Pool",
            title: "Adashe",
            icon: Users,
            iconWrap: "bg-teal-50 dark:bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-100 dark:border-teal-500/20 group-hover:bg-teal-100/80",
            onClick: () => {
              const el = document.getElementById("adashe-circle-hub");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            },
          },
          {
            key: "equipment",
            label: "Rent Booking",
            title: "Equipment",
            icon: Calendar,
            iconWrap: "bg-amber-50 dark:bg-amber-500/10 text-primary border-amber-100 dark:border-amber-500/20 group-hover:bg-amber-100/70",
            onClick: () => {
              const el = document.getElementById("active-bookings-hub");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            },
          },
        ].map((tile, i) => {
          const Icon = tile.icon;
          return (
            <Reveal key={tile.key} delay={0.05 * i}>
              <div
                onClick={tile.onClick}
                className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div className={`p-3 rounded-xl border transition-colors ${tile.iconWrap}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9.5px] uppercase font-bold text-muted tracking-wider block">
                    {tile.label}
                  </span>
                  <h3 className="text-sm font-bold text-ink mt-0.5">{tile.title}</h3>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* Two Column Layout: Active bookings (left) + Adashe Circle (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Active Bookings */}
        <Reveal className="h-full">
          <div
            id="active-bookings-hub"
            className="bg-surface rounded-3xl p-6 shadow-sm border border-border flex flex-col justify-between h-full"
          >
            <div>
              <div className="flex justify-between items-center border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-semibold text-ink text-lg">
                    Active bookings
                  </h3>
                </div>
                <button
                  onClick={() => onNavigate("equipment")}
                  className="text-primary text-xs font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  View all <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {state.bookings.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6 text-primary stroke-[1.5]" />
                  </div>
                  <p className="text-sm font-semibold text-ink">No active bookings</p>
                  <p className="text-xs text-muted mt-1 max-w-[240px] mx-auto">
                    Book a tractor, harvester or drone sprayer and it will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border mt-2">
                  {state.bookings.map((bk) => (
                    <div
                      key={bk.id}
                      className="py-4 flex justify-between items-center gap-4 text-left"
                    >
                      <div className="space-y-1">
                        <h4 className="font-bold text-ink text-[13.5px]">
                          {bk.serviceName}
                        </h4>
                        <p className="text-xs text-muted font-sans">
                          {bk.timeSlot} • {bk.bookingDate}
                        </p>
                      </div>
                      <span className="text-[10px] bg-primary/5 text-primary border border-primary/10 font-bold px-3 py-1 rounded-full uppercase tracking-wider select-none leading-none">
                        {bk.description}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-border/50 mt-4 flex justify-end">
              <button
                onClick={() => onNavigate("equipment")}
                className="bg-primary hover:bg-[#0f4a2d] text-white font-bold text-xs py-2 px-4 rounded-xl transition duration-200 cursor-pointer shadow-sm"
              >
                Schedule New Booking
              </button>
            </div>
          </div>
        </Reveal>

        {/* Right Column: Adashe Circle (live) */}
        <Reveal delay={0.05} className="h-full">
          <div
            id="adashe-circle-hub"
            className="bg-surface rounded-3xl p-6 shadow-sm border border-border flex flex-col justify-between h-full"
          >
            {adasheGroup ? (
              <>
                <div>
                  <div className="flex justify-between items-start gap-2 border-b border-border pb-4">
                    <div>
                      <h3 className="font-display font-semibold text-ink text-lg">
                        {adasheGroup.name}
                      </h3>
                      <p className="text-xs text-primary font-medium mt-0.5">
                        Cycle {adasheGroup.currentCycle} of {adasheGroup.maxSlots}
                        {adasheGroup.myPosition
                          ? ` · You are Slot #${adasheGroup.myPosition}`
                          : ""}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase bg-surface-2 border border-border text-muted font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
                      {adasheGroup.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2 pt-6">
                    <div className="w-full bg-surface-2 h-4 rounded-full overflow-hidden relative shadow-inner">
                      <motion.div
                        className="bg-primary h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${adasheProgress}%` }}
                        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-mono text-xs font-bold text-ink tracking-tight">
                        {formatNaira(adasheGroup.poolBalance)} / {formatNaira(perTurnPayout)} met
                      </span>
                      <span className="text-primary font-mono font-bold text-sm">
                        {adasheProgress}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-border/50 mt-6">
                  <span className="text-[10.5px] text-muted font-medium">
                    {formatNaira(adasheGroup.contributionAmount)} /{" "}
                    {adasheGroup.frequency.toLowerCase()} contribution
                  </span>
                  <button
                    onClick={() => navigate(`/app/adashe/${adasheGroup.id}`)}
                    className={`font-bold px-4 py-1.5 text-xs rounded-xl transition-all cursor-pointer ${
                      adasheGroup.isMyTurn ||
                      adasheGroup.pendingPayoutRequest?.status === "MARKED_SENT"
                        ? "bg-accent hover:bg-[#d8912d] text-stone-900 shadow-sm"
                        : "border border-border hover:bg-surface-2 text-ink"
                    }`}
                  >
                    {adasheGroup.pendingPayoutRequest?.status === "MARKED_SENT"
                      ? "Confirm received"
                      : adasheGroup.isMyTurn
                        ? "Claim my payout"
                        : "Open"}
                  </button>
                </div>
              </>
            ) : (
              /* Empty state — no groups joined */
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-teal-800 dark:text-teal-300 stroke-[1.5]" />
                </div>
                <h3 className="font-display font-semibold text-ink text-lg">
                  Join an Adashe circle
                </h3>
                <p className="text-xs text-muted mt-1 max-w-[260px]">
                  Rotating thrift circles help you pool savings with trusted farmers and
                  get paid out in turn.
                </p>
                {invitations.length > 0 && (
                  <button
                    onClick={() => onNavigate("adashe")}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300"
                  >
                    <Mail className="h-3 w-3" />
                    You have {invitations.length} invitation
                    {invitations.length > 1 ? "s" : ""}
                  </button>
                )}
                <button
                  onClick={() => onNavigate("adashe")}
                  className="mt-4 bg-primary hover:bg-[#0f4a2d] text-white font-bold text-xs py-2 px-4 rounded-xl transition duration-200 cursor-pointer shadow-sm"
                >
                  Explore Adashe circles
                </button>
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* Pending circle actions (LIVE): proposals awaiting my vote + my
          slot-shifts awaiting an admin decision */}
      {pendingItems.length > 0 && (
        <Reveal>
          <div className="bg-surface rounded-3xl p-6 shadow-sm border border-border">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <Vote className="w-5 h-5 text-primary" />
              <h3 className="font-display font-semibold text-ink text-base">
                Circle actions needing you
              </h3>
              <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {pendingItems.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {pendingItems.map((item) => (
                <div
                  key={item.proposal.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-surface-2 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        {item.groupName}
                      </span>
                      {item.proposal.kind === "SLOT_SHIFT" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:text-amber-300">
                          <ArrowLeftRight className="h-2.5 w-2.5" /> Slot-shift
                        </span>
                      )}
                    </div>
                    <h4 className="truncate text-sm font-semibold text-ink">
                      {item.proposal.title}
                    </h4>
                    <p className="text-[11px] text-muted">
                      {item.proposal.tally.yes} yes · {item.proposal.tally.no} no
                      {item.proposal.eligibleCount
                        ? ` of ${item.proposal.eligibleCount}`
                        : ""}
                    </p>
                  </div>
                  {item.bucket === "vote" ? (
                    <button
                      onClick={() => navigate(`/app/adashe/${item.groupId}`)}
                      className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0f4a2d]"
                    >
                      Vote
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
                      Awaiting admin
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* Auxiliary Row: Notifications and Rates index */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Cooperative Bulletins */}
        <Reveal className="lg:col-span-8">
          <div className="bg-surface rounded-3xl p-6 shadow-sm border border-border">
            <div className="flex justify-between items-center border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-accent" />
                <h3 className="font-display font-semibold text-ink text-base">
                  Cooperative Bulletins
                </h3>
              </div>
              {unreadCount > 0 && (
                <span className="bg-accent text-stone-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} New
                </span>
              )}
            </div>

            {state.notifications.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-accent/5 border border-accent/15 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 text-accent stroke-[1.5]" />
                </div>
                <p className="text-sm font-semibold text-ink">You're all caught up</p>
                <p className="text-xs text-muted mt-1">
                  No new cooperative alerts right now.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {state.notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 text-xs ${
                      notif.isRead
                        ? "bg-surface-2 border-border text-muted"
                        : "bg-primary/5 border-primary/10 text-ink font-medium"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-ink text-[12px]">
                        {notif.title}
                      </span>
                      {!notif.isRead && (
                        <button
                          onClick={() => onReadNotification(notif.id)}
                          className="text-[10px] font-bold text-primary hover:underline cursor-pointer bg-primary/10 px-1.5 py-0.5 rounded border border-primary/10 leading-none"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    <p className="text-muted mt-1 leading-relaxed text-[11.5px]">
                      {notif.message}
                    </p>
                    <div className="mt-2 text-[10px] text-muted font-mono flex justify-between items-center">
                      <span>{new Date(notif.date).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1 text-[9px] uppercase font-bold text-primary/80">
                        ● {notif.type}
                      </span>
                    </div>
                  </div>
                ))}

                <button
                  onClick={onClearNotifications}
                  className="w-full text-center py-2.5 bg-surface hover:bg-surface-2 border border-border text-ink rounded-xl transition text-xs font-semibold mt-2 cursor-pointer"
                >
                  Clear All Notifications
                </button>
              </div>
            )}
          </div>
        </Reveal>

        {/* Rates Index */}
        <Reveal delay={0.05} className="lg:col-span-4">
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
            <h3 className="font-display font-medium text-ink text-base">
              Cooperative Rates Index
            </h3>
            <p className="text-xs text-muted mt-1">
              Guaranteed annual percentage yields (APY)
            </p>

            <div className="space-y-3 mt-4 text-xs">
              {RATES.map((r, i) => (
                <div
                  key={r.label}
                  className={`flex justify-between items-center py-1.5 ${
                    i < RATES.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <span className="text-muted">{r.label}</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded border border-primary/10 leading-none ${
                      r.accent ? "text-primary" : "text-ink"
                    } bg-primary/10`}
                  >
                    {r.apy}% APY
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 bg-accent/5 p-3 rounded-2xl border border-accent/10 text-xs leading-relaxed text-ink">
              <p className="font-bold text-accent flex items-center gap-1">
                🚜 Machineries Discount!
              </p>
              Your{" "}
              <span className="font-bold underline text-primary">{tier} Tier</span> gives
              you a whopping {MEMBER_BOOKING_DISCOUNT}% cash savings on tractor and milling
              station processing bookings!
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
