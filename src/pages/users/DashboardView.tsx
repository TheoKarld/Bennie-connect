/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Wallet,
  PiggyBank,
  Calendar,
  Users,
  Bell,
  ArrowUpRight,
} from "lucide-react";
import { FarmerAppState } from "../../types";
import { useAuth } from "../../hooks/useAuth";
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
  const firstName = user?.firstName || "Farmer";
  const tier = state.membership.tier;

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

  // Real Adashe circle: prefer a group the user has joined, else the first.
  const adasheGroup = useMemo(() => {
    const groups = state.contributionGroups ?? [];
    return groups.find((g) => g.hasJoined) ?? groups[0] ?? null;
  }, [state.contributionGroups]);

  const adasheProgress = useMemo(() => {
    if (!adasheGroup || adasheGroup.totalPayoutPool <= 0) return 0;
    return Math.min(
      100,
      Math.round((adasheGroup.currentPool / adasheGroup.totalPayoutPool) * 100)
    );
  }, [adasheGroup]);

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
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#125D39] via-[#2F8537] to-[#71B53B] p-6 md:p-8 text-white shadow-lg border border-[#135D39]/10">
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
                  {formatNaira(state.walletBalance)}
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
                className="bg-[#E9A42F] hover:bg-[#d59124] text-stone-900 font-bold px-5 py-2.5 text-xs rounded-full shadow-md transition-all flex items-center gap-1 duration-200 cursor-pointer"
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
            iconWrap: "bg-[#135D39]/5 text-[#135D39] border-[#135D39]/10 group-hover:bg-[#135D39]/10",
            onClick: () => onNavigate("wallet"),
          },
          {
            key: "savings",
            label: "Lock Yield",
            title: "Save",
            icon: PiggyBank,
            iconWrap: "bg-emerald-50 text-[#135D39] border-emerald-100 group-hover:bg-emerald-100/70",
            onClick: () => onNavigate("savings"),
          },
          {
            key: "adashe",
            label: "Thrift Pool",
            title: "Adashe",
            icon: Users,
            iconWrap: "bg-teal-50 text-teal-800 border-teal-100 group-hover:bg-teal-100/80",
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
            iconWrap: "bg-amber-50 text-[#135D39] border-amber-100 group-hover:bg-amber-100/70",
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
                className="bg-white border border-[#E6E5DF] rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-[#135D39]/30 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div className={`p-3 rounded-xl border transition-colors ${tile.iconWrap}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9.5px] uppercase font-bold text-[#5C6460] tracking-wider block">
                    {tile.label}
                  </span>
                  <h3 className="text-sm font-bold text-[#1A2421] mt-0.5">{tile.title}</h3>
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
            className="bg-white rounded-3xl p-6 shadow-sm border border-[#E6E5DF] flex flex-col justify-between h-full"
          >
            <div>
              <div className="flex justify-between items-center border-b border-[#E6E5DF] pb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#135D39]" />
                  <h3 className="font-display font-semibold text-[#1A2421] text-lg">
                    Active bookings
                  </h3>
                </div>
                <button
                  onClick={() => onNavigate("equipment")}
                  className="text-[#135D39] text-xs font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  View all <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {state.bookings.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#135D39]/5 border border-[#135D39]/10 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6 text-[#135D39] stroke-[1.5]" />
                  </div>
                  <p className="text-sm font-semibold text-[#1A2421]">No active bookings</p>
                  <p className="text-xs text-[#5C6460] mt-1 max-w-[240px] mx-auto">
                    Book a tractor, harvester or drone sprayer and it will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100 mt-2">
                  {state.bookings.map((bk) => (
                    <div
                      key={bk.id}
                      className="py-4 flex justify-between items-center gap-4 text-left"
                    >
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#1A2421] text-[13.5px]">
                          {bk.serviceName}
                        </h4>
                        <p className="text-xs text-[#5C6460] font-sans">
                          {bk.timeSlot} • {bk.bookingDate}
                        </p>
                      </div>
                      <span className="text-[10px] bg-[#135D39]/5 text-[#135D39] border border-[#135D39]/10 font-bold px-3 py-1 rounded-full uppercase tracking-wider select-none leading-none">
                        {bk.description}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-[#E6E5DF]/50 mt-4 flex justify-end">
              <button
                onClick={() => onNavigate("equipment")}
                className="bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold text-xs py-2 px-4 rounded-xl transition duration-200 cursor-pointer shadow-sm"
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
            className="bg-white rounded-3xl p-6 shadow-sm border border-[#E6E5DF] flex flex-col justify-between h-full"
          >
            {adasheGroup ? (
              <>
                <div>
                  <div className="flex justify-between items-start gap-2 border-b border-[#E6E5DF] pb-4">
                    <div>
                      <h3 className="font-display font-semibold text-[#1A2421] text-lg">
                        {adasheGroup.name}
                      </h3>
                      <p className="text-xs text-[#135D39] font-medium mt-0.5">
                        Next payout {adasheGroup.nextPayoutDate} · {adasheGroup.userRank}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase bg-stone-100 border border-[#E6E5DF] text-[#5C6460] font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
                      {adasheGroup.memberCount} members
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2 pt-6">
                    <div className="w-full bg-[#EAE8E2] h-4 rounded-full overflow-hidden relative shadow-inner">
                      <motion.div
                        className="bg-[#135D39] h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${adasheProgress}%` }}
                        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-mono text-xs font-bold text-[#1A2421] tracking-tight">
                        {formatNaira(adasheGroup.currentPool)} / {formatNaira(adasheGroup.totalPayoutPool)} met
                      </span>
                      <span className="text-[#135D39] font-mono font-bold text-sm">
                        {adasheProgress}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-[#E6E5DF]/50 mt-6">
                  <span className="text-[10.5px] text-[#5C6460] font-medium">
                    {formatNaira(adasheGroup.cycleAmount)} / {adasheGroup.frequency ?? "cycle"} contribution
                  </span>
                  <button
                    onClick={() => onNavigate("adashe")}
                    className="border border-[#E6E5DF] hover:bg-stone-50 text-stone-800 font-bold px-4 py-1.5 text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Open
                  </button>
                </div>
              </>
            ) : (
              /* Empty state — no groups joined */
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-teal-800 stroke-[1.5]" />
                </div>
                <h3 className="font-display font-semibold text-[#1A2421] text-lg">
                  Join an Adashe circle
                </h3>
                <p className="text-xs text-[#5C6460] mt-1 max-w-[260px]">
                  Rotating thrift circles help you pool savings with trusted farmers and
                  get paid out in turn.
                </p>
                <button
                  onClick={() => onNavigate("adashe")}
                  className="mt-4 bg-[#135D39] hover:bg-[#0f4a2d] text-white font-bold text-xs py-2 px-4 rounded-xl transition duration-200 cursor-pointer shadow-sm"
                >
                  Explore Adashe circles
                </button>
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* Auxiliary Row: Notifications and Rates index */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Cooperative Bulletins */}
        <Reveal className="lg:col-span-8">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E6E5DF]">
            <div className="flex justify-between items-center border-b border-[#E6E5DF] pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#E7A13C]" />
                <h3 className="font-display font-semibold text-[#1A2421] text-base">
                  Cooperative Bulletins
                </h3>
              </div>
              {unreadCount > 0 && (
                <span className="bg-[#E7A13C] text-stone-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} New
                </span>
              )}
            </div>

            {state.notifications.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#E7A13C]/5 border border-[#E7A13C]/15 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 text-[#E7A13C] stroke-[1.5]" />
                </div>
                <p className="text-sm font-semibold text-[#1A2421]">You're all caught up</p>
                <p className="text-xs text-[#5C6460] mt-1">
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
                        ? "bg-[#FAF8F5] border-[#E6E5DF] text-[#5C6460]"
                        : "bg-[#135D39]/5 border-[#135D39]/10 text-[#1A2421] font-medium"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-[#1A2421] text-[12px]">
                        {notif.title}
                      </span>
                      {!notif.isRead && (
                        <button
                          onClick={() => onReadNotification(notif.id)}
                          className="text-[10px] font-bold text-[#135D39] hover:underline cursor-pointer bg-[#135D39]/10 px-1.5 py-0.5 rounded border border-[#135D39]/10 leading-none"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    <p className="text-[#5C6460] mt-1 leading-relaxed text-[11.5px]">
                      {notif.message}
                    </p>
                    <div className="mt-2 text-[10px] text-stone-450 font-mono flex justify-between items-center">
                      <span>{new Date(notif.date).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1 text-[9px] uppercase font-bold text-[#135D39]/80">
                        ● {notif.type}
                      </span>
                    </div>
                  </div>
                ))}

                <button
                  onClick={onClearNotifications}
                  className="w-full text-center py-2.5 bg-white hover:bg-stone-50 border border-[#E6E5DF] text-[#1A2421] rounded-xl transition text-xs font-semibold mt-2 cursor-pointer"
                >
                  Clear All Notifications
                </button>
              </div>
            )}
          </div>
        </Reveal>

        {/* Rates Index */}
        <Reveal delay={0.05} className="lg:col-span-4">
          <div className="bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm">
            <h3 className="font-display font-medium text-[#1A2421] text-base">
              Cooperative Rates Index
            </h3>
            <p className="text-xs text-[#5C6460] mt-1">
              Guaranteed annual percentage yields (APY)
            </p>

            <div className="space-y-3 mt-4 text-xs">
              {RATES.map((r, i) => (
                <div
                  key={r.label}
                  className={`flex justify-between items-center py-1.5 ${
                    i < RATES.length - 1 ? "border-b border-[#E6E5DF]" : ""
                  }`}
                >
                  <span className="text-[#5C6460]">{r.label}</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded border border-[#135D39]/10 leading-none ${
                      r.accent ? "text-[#135D39]" : "text-stone-950"
                    } bg-[#135D39]/10`}
                  >
                    {r.apy}% APY
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 bg-[#E7A13C]/5 p-3 rounded-2xl border border-[#E7A13C]/10 text-xs leading-relaxed text-stone-950">
              <p className="font-bold text-[#E7A13C] flex items-center gap-1">
                🚜 Machineries Discount!
              </p>
              Your{" "}
              <span className="font-bold underline text-[#135D39]">{tier} Tier</span> gives
              you a whopping {MEMBER_BOOKING_DISCOUNT}% cash savings on tractor and milling
              station processing bookings!
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
