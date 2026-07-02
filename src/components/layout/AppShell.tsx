/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Sprout,
  LayoutDashboard,
  Wallet,
  PiggyBank,
  TrendingUp,
  Users,
  Menu,
  X,
  CreditCard,
  Compass,
  Wrench,
  ShoppingBag,
  Briefcase,
  LogOut,
} from "lucide-react";

import { useAuth } from "../../hooks/useAuth";
import { useAppState } from "../../hooks/useAppState";
import NotificationBell from "./NotificationBell";
import NotificationProvider from "../../providers/NotificationProvider";
import { Toaster } from "../ui";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/wallet", label: "Wallet", icon: Wallet },
  { to: "/app/savings", label: "Savings", icon: PiggyBank },
  { to: "/app/adashe", label: "Adashe Groups", icon: Users },
  { to: "/app/equipment", label: "Equipment Booking", icon: Compass },
  { to: "/app/services", label: "Agro Services", icon: Wrench },
  { to: "/app/marketplace", label: "Inputs Marketplace", icon: ShoppingBag },
  { to: "/app/shares", label: "Shares", icon: TrendingUp },
  { to: "/app/membership", label: "Membership", icon: CreditCard },
  { to: "/app/agent", label: "Agent Terminal", icon: Briefcase },
];

function linkClasses(isActive: boolean): string {
  return `w-full text-left px-4 py-2.5 rounded-full font-semibold flex items-center gap-3 transition ${
    isActive
      ? "bg-[#135D39] text-white shadow-md shadow-[#135D39]/15"
      : "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5"
  }`;
}

export default function AppShell() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const state = useAppState();

  const firstName = user?.firstName || "Farmer";
  const initials =
    (user?.firstName?.[0] || "F") + (user?.lastName?.[0] || "");

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col space-y-1 text-sm pt-4">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => linkClasses(isActive)}
        >
          <Icon className="w-4.5 h-4.5" /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A2421] flex flex-col justify-between selection:bg-[#135D39]/10 selection:text-[#135D39] border-t-4 border-[#135D39] relative overflow-hidden">
      {/* Real-time notification runtime (hydrate + socket + FCM) */}
      <NotificationProvider />
      {/* Toast stack for live arrivals (mounted once) */}
      <Toaster />

      {/* Background radial ambient glowing effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#135D39]/3 blur-[120px] rounded-full pointer-events-none -mr-64 -mt-64"></div>
      <div className="absolute bottom-40 left-0 w-[400px] h-[450px] bg-[#E7A13C]/3 blur-[100px] rounded-full pointer-events-none -ml-48"></div>

      <div className="flex flex-col lg:flex-row flex-grow w-full max-w-7xl mx-auto relative z-20">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between p-6 border-r border-[#E6E5DF] h-screen sticky top-0 bg-[#FAF8F5]/30">
          <div className="space-y-8">
            {/* Brand Logo */}
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigate("/app")}
            >
              <div className="w-10 h-10 rounded-full bg-[#135D39] flex items-center justify-center shadow-lg shadow-[#135D39]/10">
                <Sprout className="w-5.5 h-5.5 text-white" />
              </div>
              <div>
                <span className="font-display font-medium text-[#1A2421] text-base tracking-tight block">
                  Bennie Connect
                </span>
                <span className="text-[10px] text-[#135D39] font-bold uppercase tracking-wider block -mt-1 leading-none">
                  Cooperative Portal
                </span>
              </div>
            </div>

            <SidebarNav />
          </div>

          <div className="bg-[#135D39]/5 border border-[#135D39]/10 p-4 rounded-3xl mt-auto">
            <span className="text-[10px] font-bold text-[#135D39] uppercase tracking-wider block">
              Coop Card ID
            </span>
            <span className="font-mono text-sm font-bold text-[#1A2421] block mt-1">
              {state.membership.cardNumber}
            </span>
            <p className="text-[10px] text-[#5C6460] mt-1 leading-normal font-medium">
              Verified Active registry ticket
            </p>
          </div>
        </aside>

        {/* MAIN BODY AREA (Top Navbar + Views) */}
        <div className="flex-grow flex flex-col min-h-screen lg:max-w-[calc(100%-16rem)]">
          <header className="sticky top-0 z-40 bg-[#FAF8F5]/80 backdrop-blur-md border-b border-[#E6E5DF] h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 w-full">
            {/* Hamburger Trigger for Mobile */}
            <div className="flex items-center gap-2 lg:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-[#1A2421] hover:bg-[#135D39]/5 focus:outline-none p-2 rounded-xl transition"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => navigate("/app")}
              >
                <div className="w-8 h-8 rounded-full bg-[#135D39] flex items-center justify-center">
                  <Sprout className="w-4 h-4 text-white" />
                </div>
                <span className="font-display font-bold text-[#1A2421] text-sm tracking-tight">
                  Bennie Connect
                </span>
              </div>
            </div>

            <div className="hidden lg:block">
              <span className="text-xs uppercase text-[#5C6460] font-bold tracking-wider">
                Farmer Portal / Welcome, {firstName}
              </span>
            </div>

            {/* Right side tools */}
            <div className="flex items-center gap-3 sm:gap-4">
              <NotificationBell />

              {/* User badge */}
              <div className="w-9 h-9 rounded-full bg-[#135D39] text-white flex items-center justify-center font-bold text-xs uppercase ring-2 ring-[#135D39]/10">
                {initials}
              </div>

              <button
                onClick={handleLogout}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C6460] hover:text-[#135D39] transition px-3 py-2 rounded-full hover:bg-[#135D39]/5"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </header>

          {/* MOBILE SIDEBAR DROPDOWN */}
          {isMobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-50 bg-[#FAF8F5]/98 backdrop-blur-md shadow-2xl flex flex-col justify-between p-6">
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-[#E6E5DF]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#135D39] flex items-center justify-center">
                      <Sprout className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-display font-semibold text-[#1A2421] text-base">
                      Bennie Connect
                    </span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-[#1A2421] p-1 h-8 w-8 hover:bg-slate-100 rounded-lg transition flex items-center justify-center"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <SidebarNav onNavigate={() => setIsMobileMenuOpen(false)} />

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-4 py-3 rounded-full font-semibold flex items-center gap-3 transition text-[#5C6460] hover:text-[#135D39] hover:bg-[#135D39]/5"
                >
                  <LogOut className="w-5 h-5" /> Logout
                </button>
              </div>

              <div className="bg-[#135D39]/5 border border-[#135D39]/10 p-4 rounded-3xl mt-auto">
                <span className="text-[10px] font-bold text-[#135D39] uppercase tracking-wider block">
                  Coop Card ID
                </span>
                <span className="font-mono text-sm font-bold text-[#1A2421] block mt-1">
                  {state.membership.cardNumber}
                </span>
                <p className="text-[10px] text-[#5C6460] mt-1 leading-normal font-medium">
                  Verified Active registry ticket
                </p>
              </div>
            </div>
          )}

          {/* Main Page Content Body */}
          <main className="flex-grow w-full py-8 md:py-10">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Foot banner */}
      <footer className="bg-[#FAF8F5] text-[#5C6460] py-12 border-t border-[#E6E5DF] mt-16 text-xs relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#135D39] flex items-center justify-center">
                <Sprout className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-medium text-[#1A2421] tracking-widest uppercase">
                Bennie Connect
              </span>
            </div>
            <p className="max-w-md text-[#5C6460] leading-relaxed text-[11px]">
              Bennie Connect Coop Society is formatted under agricultural bylaws to
              build mutual micro-capital, targeted tractor reserves, and verified
              shares safely.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-8 border-t border-[#E6E5DF] text-[#5C6460] flex justify-between items-center text-[10px]">
          <span>© 1999 - 2026 Bennie Connect Cooperative. All rights reserved.</span>
          <span className="flex items-center gap-1 font-mono">
            Secure SHA-256 Ledger • SeerBit Interfacing Active
          </span>
        </div>
      </footer>
    </div>
  );
}
