/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  Wallet, 
  PiggyBank, 
  TrendingUp, 
  Calendar, 
  Users, 
  Bell, 
  ArrowUpRight, 
  Check, 
  X, 
  MapPin, 
  ArrowRight,
  ShieldCheck,
  Percent
} from "lucide-react";
import { FarmerAppState, AgriBooking, ContributionGroup, FarmerNotification } from "../types";

interface DashboardViewProps {
  state: FarmerAppState;
  onNavigate: (tab: string) => void;
  onJoinGroup: (groupId: string) => void;
  onCancelBooking: (bookingId: string) => void;
  onReadNotification: (notifId: string) => void;
  onClearNotifications: () => void;
}

export default function DashboardView({
  state,
  onNavigate,
  onJoinGroup,
  onCancelBooking,
  onReadNotification,
  onClearNotifications,
}: DashboardViewProps) {
  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(amt);
  };

  const totalSavings = 
    state.flexSaveBalance + 
    state.targetGoals.reduce((sum, g) => sum + (g.status === "ongoing" ? g.currentAmount : 0), 0) +
    state.fixedLocks.reduce((sum, l) => sum + (l.status === "locked" ? l.amount : 0), 0) +
    state.harvestPlans.reduce((sum, p) => sum + (p.status === "active" ? p.amountSaved : 0), 0);

  const totalSharesValue = state.shares.sharesOwned * state.shares.currentSharePrice;

  // Active bookings count
  const activeBookings = state.bookings.filter(b => b.status !== "completed" && b.status !== "cancelled");
  // Unread notifications
  const unreadNotifications = state.notifications.filter(n => !n.isRead);

  return (
    <div className="space-y-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Premium Gradient Hero Banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#125D39] via-[#2F8537] to-[#71B53B] p-6 md:p-8 text-white shadow-lg border border-[#135D39]/10">
        
        {/* Subtle top right light circle glow */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 text-white/90 text-[12.5px] font-sans font-medium">
              <span className="text-sm">☀️</span> Good morning, Aliyu
            </div>
            
            <span className="bg-white/15 text-white backdrop-blur-md text-[10.5px] font-bold px-3 py-1 rounded-full border border-white/20 select-none uppercase tracking-wider">
              {state.membership.tier} Member
            </span>
          </div>

          <h1 className="text-2xl md:text-3.5xl font-display font-medium text-white mt-1.5 tracking-tight">
            Welcome back to your cooperative
          </h1>

          {/* 3-Column Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 pt-6 border-t border-white/15">
            <div>
              <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Wallet Balance</span>
              <h2 className="text-2xl md:text-3xl font-mono font-bold mt-1 text-white">
                ₦{Math.round(state.walletBalance).toLocaleString()}
              </h2>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Cooperative Savings</span>
              <h2 className="text-2xl md:text-3xl font-mono font-bold mt-1 text-white">
                ₦{Math.round(totalSavings).toLocaleString()}
              </h2>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Shares Owned</span>
              <h2 className="text-2xl md:text-3xl font-mono font-bold mt-1 text-white">
                {state.shares.sharesOwned.toLocaleString()} Units
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

      {/* 4-Column Quick Action Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Tile 1: Wallet */}
        <div 
          onClick={() => onNavigate("wallet")}
          className="bg-white border border-[#E6E5DF] rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-[#135D39]/30 hover:shadow-xs transition-all duration-350 group"
        >
          <div className="p-3 bg-[#135D39]/5 text-[#135D39] rounded-xl border border-[#135D39]/10 group-hover:bg-[#135D39]/10 transition-colors">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9.5px] uppercase font-bold text-[#5C6460] tracking-wider block">Coop Ledger</span>
            <h3 className="text-sm font-bold text-[#1A2421] mt-0.5">Wallet</h3>
          </div>
        </div>

        {/* Tile 2: Save */}
        <div 
          onClick={() => onNavigate("savings")}
          className="bg-white border border-[#E6E5DF] rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-[#135D39]/30 hover:shadow-xs transition-all duration-350 group"
        >
          <div className="p-3 bg-emerald-50 text-[#135D39] rounded-xl border border-emerald-100 group-hover:bg-emerald-100/70 transition-colors">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9.5px] uppercase font-bold text-[#5C6460] tracking-wider block">Lock Yield</span>
            <h3 className="text-sm font-bold text-[#1A2421] mt-0.5">Save</h3>
          </div>
        </div>

        {/* Tile 3: Adashe */}
        <div 
          onClick={() => {
            const circleDom = document.getElementById("adashe-circle-hub");
            if (circleDom) circleDom.scrollIntoView({ behavior: "smooth" });
          }}
          className="bg-white border border-[#E6E5DF] rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-[#135D39]/30 hover:shadow-xs transition-all duration-350 group"
        >
          <div className="p-3 bg-teal-50 text-teal-800 rounded-xl border border-teal-100 group-hover:bg-teal-100/80 transition-colors">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9.5px] uppercase font-bold text-[#5C6460] tracking-wider block">Thrift Pool</span>
            <h3 className="text-sm font-bold text-[#1A2421] mt-0.5">Adashe</h3>
          </div>
        </div>

        {/* Tile 4: Equipment */}
        <div 
          onClick={() => {
            const bDom = document.getElementById("active-bookings-hub");
            if (bDom) bDom.scrollIntoView({ behavior: "smooth" });
          }}
          className="bg-white border border-[#E6E5DF] rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-[#135D39]/30 hover:shadow-xs transition-all duration-350 group"
        >
          <div className="p-3 bg-amber-50 text-[#135D39] rounded-xl border border-amber-100 group-hover:bg-amber-100/70 transition-colors">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9.5px] uppercase font-bold text-[#5C6460] tracking-wider block">Rent Booking</span>
            <h3 className="text-sm font-bold text-[#1A2421] mt-0.5">Equipment</h3>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Active bookings (left) + Adashe Rice Circle (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Active Bookings */}
        <div id="active-bookings-hub" className="bg-white rounded-3xl p-6 shadow-sm border border-[#E6E5DF] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-[#E6E5DF] pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#135D39]" />
                <h3 className="font-display font-semibold text-[#1A2421] text-lg">Active bookings</h3>
              </div>
              <button 
                onClick={() => onNavigate("equipment")}
                className="text-[#135D39] text-xs font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                View all ↗
              </button>
            </div>

            <div className="divide-y divide-stone-100 mt-2">
              {state.bookings.map((bk) => (
                <div key={bk.id} className="py-4 flex justify-between items-center gap-4 text-left">
                  <div className="space-y-1">
                    <h4 className="font-bold text-[#1A2421] text-[13.5px]">{bk.serviceName}</h4>
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

        {/* Right Column: Adashe Kano Rice Circle */}
        <div id="adashe-circle-hub" className="bg-white rounded-3xl p-6 shadow-sm border border-[#E6E5DF] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-2 border-b border-[#E6E5DF] pb-4">
              <div>
                <h3 className="font-display font-semibold text-[#1A2421] text-lg">Adashe — Kano Rice Circle</h3>
                <p className="text-xs text-[#135D39] font-medium mt-0.5">Next payout to you in 3 weeks</p>
              </div>
              <span className="text-[10px] uppercase bg-stone-100 border border-[#E6E5DF] text-[#5C6460] font-bold px-3 py-1.5 rounded-full">
                12 members
              </span>
            </div>

            {/* Thick Sleek Progress Bar */}
            <div className="space-y-2 pt-6">
              <div className="w-full bg-[#EAE8E2] h-4 rounded-full overflow-hidden relative shadow-inner">
                <div 
                  className="bg-[#135D39] h-full rounded-full transition-all duration-500 ease-out" 
                  style={{ width: "68%" }} 
                />
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="font-mono text-xs font-bold text-[#1A2421] tracking-tight">₦340,000 / ₦500,000 met</span>
                <span className="text-[#135D39] font-mono font-bold text-sm">68%</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-[#E6E5DF]/50 mt-6">
            <span className="text-[10.5px] text-[#5C6460] font-medium">Auto-renew active each cycle</span>
            <button 
              onClick={() => {
                alert("Kano Rice Circle is verified and locked for rotating thrift. Your monthly contribution of ₦30,000 is cleared.");
              }}
              className="border border-[#E6E5DF] hover:bg-stone-50 text-stone-800 font-bold px-4 py-1.5 text-xs rounded-xl transition-all cursor-pointer"
            >
              Open
            </button>
          </div>
        </div>

      </div>

      {/* Auxiliary Row: Notifications and Rates index */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Cooperative Bulletins Notification Panel */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 shadow-sm border border-[#E6E5DF]">
          <div className="flex justify-between items-center border-b border-[#E6E5DF] pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#E7A13C]" />
              <h3 className="font-display font-semibold text-[#1A2421] text-base">Cooperative Bulletins</h3>
            </div>
            {state.notifications.filter(n => !n.isRead).length > 0 && (
              <span className="bg-[#E7A13C] text-stone-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {state.notifications.filter(n => !n.isRead).length} New
              </span>
            )}
          </div>

          {state.notifications.length === 0 ? (
            <div className="py-8 text-center text-stone-400">
              <Bell className="w-8 h-8 text-[#5C6460] mx-auto stroke-1 mb-2" />
              <p className="text-[#5C6460] text-xs">All clear! No new cooperative alerts.</p>
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
                    <span className="font-bold text-[#1A2421] text-[12px]">{notif.title}</span>
                    {!notif.isRead && (
                      <button 
                        onClick={() => onReadNotification(notif.id)}
                        className="text-[10px] font-bold text-[#135D39] hover:underline cursor-pointer bg-[#135D39]/10 px-1.5 py-0.5 rounded border border-[#135D39]/10 leading-none"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                  <p className="text-[#5C6460] mt-1 leading-relaxed text-[11.5px]">{notif.message}</p>
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

        {/* Rates Index panel */}
        <div className="lg:col-span-4 bg-white border border-[#E6E5DF] rounded-3xl p-6 shadow-sm">
          <h3 className="font-display font-medium text-[#1A2421] text-base">Cooperative Rates Index</h3>
          <p className="text-xs text-[#5C6460] mt-1">Guaranteed annual percentage yields (APY)</p>
          
          <div className="space-y-3 mt-4 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-[#E6E5DF]">
              <span className="text-[#5C6460]">Flex Save (Normal)</span>
              <span className="font-mono font-bold text-stone-950 bg-[#135D39]/10 px-2 py-0.5 rounded border border-[#135D39]/10 leading-none">8.5% APY</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-[#E6E5DF]">
              <span className="text-[#5C6460]">Target Goal Save</span>
              <span className="font-mono font-bold text-stone-950 bg-[#135D39]/10 px-2 py-0.5 rounded border border-[#135D39]/10 leading-none">11.5% APY</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-[#5C6460]">Seasonal Harvest Save</span>
              <span className="font-mono font-bold text-[#135D39] bg-[#135D39]/10 px-2 py-0.5 rounded border border-[#135D39]/10 leading-none">12.5% APY</span>
            </div>
          </div>

          <div className="mt-5 bg-[#E7A13C]/5 p-3 rounded-2xl border border-[#E7A13C]/10 text-xs leading-relaxed text-stone-950">
            <p className="font-bold text-[#E7A13C] flex items-center gap-1">
              🚜 Machineries Discount!
            </p>
            Your <span className="font-bold underline text-[#135D39]">{state.membership.tier} Tier</span> gives you a whopping 10% cash savings on tractor and milling station processing bookings!
          </div>
        </div>
      </div>

    </div>
  );
}
