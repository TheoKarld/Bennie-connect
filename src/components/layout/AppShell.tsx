/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Sprout,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  PanelLeftClose,
  MoreHorizontal,
  BadgeCheck,
} from "lucide-react";

import { useAuth } from "../../hooks/useAuth";
import { useAppState } from "../../hooks/useAppState";
import { USER_NAV, USER_BOTTOM_NAV_ROUTES, USER_ROUTE_TITLES } from "./userNav";
import NotificationBell from "./NotificationBell";
import NotificationProvider from "../../providers/NotificationProvider";
import { Toaster, ThemeToggle, ThemeToggleButton } from "../ui";

const SIDEBAR_PREF_KEY = "bennie_user_sidebar";
const APP_VERSION = "v0.1.0";

/** Read the persisted collapse preference (desktop). */
function readCollapsePref(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_PREF_KEY) === "collapsed";
  } catch {
    return false;
  }
}

/** The primary nav — one component, two presentations (sidebar + drawer). */
function UserSidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {USER_NAV.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
              collapsed ? "justify-center" : ""
            } ${
              isActive
                ? "bg-white/12 text-white"
                : "text-white/60 hover:bg-white/[0.06] hover:text-white"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[#E7A13C]"
                />
              )}
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${
                  isActive ? "text-[#E7A13C]" : ""
                }`}
              />
              {!collapsed && <span className="truncate">{label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const state = useAppState();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsePref);
  const [identityOpen, setIdentityOpen] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const identityRef = useRef<HTMLDivElement>(null);

  const fullName =
    `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Farmer";
  const initials =
    (user?.firstName?.[0] ?? "F") + (user?.lastName?.[0] ?? "");
  const tier = state.membership?.tier ?? "Bronze";

  // Persist collapse preference.
  useEffect(() => {
    try {
      localStorage.setItem(
        SIDEBAR_PREF_KEY,
        collapsed ? "collapsed" : "pinned"
      );
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Close drawer + menus on route change.
  useEffect(() => {
    setDrawerOpen(false);
    setIdentityOpen(false);
  }, [location.pathname]);

  // Esc closes the drawer; focus-trap while open; restore focus on close.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const first = drawerRef.current?.querySelector<HTMLElement>(
      "a, button, [tabindex]"
    );
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Click-away for the identity menu.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        identityRef.current &&
        !identityRef.current.contains(e.target as Node)
      ) {
        setIdentityOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Esc closes the identity menu.
  useEffect(() => {
    if (!identityOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIdentityOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [identityOpen]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  // --- Breadcrumb / page title -------------------------------------------
  const pageTitle = useMemo(() => {
    const seg = location.pathname.replace(/^\/app\/?/, "").split("/")[0] || "";
    return USER_ROUTE_TITLES[seg] ?? "Overview";
  }, [location.pathname]);

  // --- Bottom nav (mobile): key sections in intended order ----------------
  const bottomItems = useMemo(
    () =>
      USER_BOTTOM_NAV_ROUTES.map((r) =>
        USER_NAV.find((p) => p.to === r)
      ).filter(Boolean) as typeof USER_NAV,
    []
  );

  const brand = (
    <Link
      to="/app"
      className="group flex items-center gap-2.5"
      aria-label="Bennie Connect — Overview"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105">
        <Sprout className="h-5 w-5 text-white" />
      </span>
      <span className="hidden leading-none sm:block">
        <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">
          Bennie Connect
        </span>
        <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
          Cooperative Portal
        </span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-primary/10 selection:text-primary">
      {/* Real-time notification runtime (hydrate + socket + FCM) */}
      <NotificationProvider />
      {/* Toast stack for live arrivals (mounted once) */}
      <Toaster />

      {/* Skip link */}
      <a
        href="#app-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <div className="flex">
        {/* DESKTOP SIDEBAR (forest brand rail) */}
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-[#0F3D28] text-white transition-[width] duration-200 md:flex ${
            collapsed ? "w-[76px]" : "w-64"
          }`}
        >
          <div className="flex h-16 items-center gap-2.5 px-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Sprout className="h-5 w-5 text-white" />
            </span>
            {!collapsed && (
              <span className="leading-none">
                <span className="block font-display text-sm font-semibold tracking-tight">
                  Bennie Connect
                </span>
                <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.16em] text-[#E7A13C]">
                  Cooperative Portal
                </span>
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <UserSidebarNav collapsed={collapsed} />
          </div>

          {/* Footer: coop card / identity + version + collapse */}
          <div className="border-t border-white/10 px-3 py-3">
            {!collapsed && (
              <div className="mb-2 rounded-2xl bg-white/[0.05] px-3 py-2.5">
                <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-[#E7A13C]">
                  Coop Card ID
                </span>
                <span className="mt-1 block truncate font-mono text-xs font-bold text-white">
                  {state.membership?.cardNumber ?? "—"}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold text-white/55 transition hover:bg-white/[0.06] hover:text-white"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" />
                  <span className="font-mono">{APP_VERSION}</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* MAIN COLUMN */}
        <div className="flex min-h-screen w-full min-w-0 flex-col">
          {/* TOP NAVBAR */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {/* Mobile hamburger */}
              <button
                ref={hamburgerRef}
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="rounded-xl p-2 text-ink transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/25 md:hidden"
                aria-label="Open navigation"
                aria-expanded={drawerOpen}
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Desktop collapse toggle */}
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="hidden rounded-xl p-2 text-muted transition hover:bg-primary/5 hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary/25 md:inline-flex"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </button>

              {/* Mobile brand */}
              <div className="md:hidden">{brand}</div>

              {/* Breadcrumb / page title (desktop) */}
              <nav
                aria-label="Breadcrumb"
                className="hidden min-w-0 items-center gap-2 md:flex"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted/70">
                  Portal
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted/50" />
                <span className="truncate font-display text-sm font-semibold text-ink">
                  {pageTitle}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Notifications */}
              <NotificationBell />

              {/* Theme toggle */}
              <ThemeToggleButton />

              {/* Identity menu */}
              <div className="relative" ref={identityRef}>
                <button
                  type="button"
                  onClick={() => setIdentityOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/25"
                  aria-label="Account menu"
                  aria-expanded={identityOpen}
                  aria-haspopup="true"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-bold uppercase text-white ring-2 ring-primary/10">
                    {initials}
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-muted sm:block" />
                </button>
                <AnimatePresence>
                  {identityOpen && (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduce ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      role="menu"
                      className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl shadow-black/10"
                    >
                      <div className="border-b border-border px-4 py-3.5">
                        <p className="truncate text-sm font-semibold text-ink">
                          {fullName}
                        </p>
                        <p className="truncate font-mono text-[11px] text-muted">
                          {user?.email}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                          <BadgeCheck className="h-3 w-3" />
                          {tier} Member
                        </span>
                      </div>
                      <div className="border-b border-border px-4 py-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                          Appearance
                        </p>
                        <ThemeToggle className="w-full justify-between" />
                      </div>
                      <div className="p-1.5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10"
                        >
                          <LogOut className="h-4 w-4" /> Logout
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

          {/* CONTENT */}
          <main
            id="app-content"
            className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 lg:px-8"
          >
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>

          {/* Slim footer */}
          <footer className="hidden border-t border-border px-4 py-4 text-center text-[11px] text-muted sm:px-6 md:block lg:px-8">
            <span>© 1999 – 2026 Bennie Connect Cooperative. </span>
            <span className="font-mono">
              Secure SHA-256 Ledger • SeerBit Interfacing Active
            </span>
          </footer>
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-canvas/95 backdrop-blur-md md:hidden"
      >
        {bottomItems.map(({ label, to, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition ${
                isActive ? "text-primary" : "text-muted"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold text-muted transition hover:text-primary"
          aria-label="More sections"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-[60] md:hidden">
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={reduce ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={reduce ? undefined : { x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-[#0F3D28] text-white shadow-2xl"
            >
              <div className="flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                    <Sprout className="h-5 w-5 text-white" />
                  </span>
                  <span className="leading-none">
                    <span className="block font-display text-sm font-semibold">
                      Bennie Connect
                    </span>
                    <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.16em] text-[#E7A13C]">
                      Cooperative Portal
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    hamburgerRef.current?.focus();
                  }}
                  className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4">
                <UserSidebarNav onNavigate={() => setDrawerOpen(false)} />
              </div>

              <div className="border-t border-white/10 px-4 py-3">
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E7A13C]/25 text-[11px] font-bold uppercase text-[#E7A13C]">
                    {initials}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-xs font-semibold">
                      {fullName}
                    </span>
                    <span className="block truncate text-[10px] text-white/50">
                      {tier} Member
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
                <p className="mt-2 px-3 font-mono text-[10px] text-white/35">
                  {APP_VERSION}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
