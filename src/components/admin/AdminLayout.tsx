/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Sprout,
  Menu,
  X,
  Bell,
  BellRing,
  LogOut,
  KeyRound,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  MoreHorizontal,
  ShieldAlert,
  CheckCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { useAdminAuth } from "../../hooks/useAdminAuth";
import { hasAnyPermission, permissionMatches } from "../../lib/adminPermissions";
import {
  ADMIN_NAV,
  ADMIN_BOTTOM_NAV_ROUTES,
  ADMIN_ROUTE_TITLES,
} from "./adminNav";
import AdminSidebarNav from "./AdminSidebarNav";
import AdminNotificationProvider from "../../providers/AdminNotificationProvider";
import { useAdminNotificationStore } from "../../store/adminNotificationStore";
import type { ServerNotification } from "../../store/adminNotificationStore";
import { notificationPermission } from "../../lib/firebase";
import { Toaster, ThemeToggle, ThemeToggleButton } from "../ui";

const SIDEBAR_PREF_KEY = "bennie_admin_sidebar";
const APP_VERSION = "v0.1.0";

/** Read the persisted collapse preference (desktop). */
function readCollapsePref(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_PREF_KEY) === "collapsed";
  } catch {
    return false;
  }
}

/** Short relative time, e.g. "now", "5m", "3h", "2d", or a date. */
function relativeTime(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Per-severity icon + accent for a notification row. */
const NOTIF_TONE: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  success: { icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10" },
  warning: {
    icon: AlertTriangle,
    color: "text-[#a6701c] dark:text-accent",
    bg: "bg-accent/15",
  },
  alert: {
    icon: Bell,
    color: "text-danger",
    bg: "bg-danger/10",
  },
};

export default function AdminLayout() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, effectivePermissions, logout } = useAdminAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsePref);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const identityRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // --- Notification bell state (server-backed admin store) ---------------
  const notifItems = useAdminNotificationStore((s) => s.items);
  const unreadCount = useAdminNotificationStore((s) => s.unreadCount);
  const pushEnabled = useAdminNotificationStore((s) => s.pushEnabled);
  const markRead = useAdminNotificationStore((s) => s.markRead);
  const markAllRead = useAdminNotificationStore((s) => s.markAllRead);
  const enablePush = useAdminNotificationStore((s) => s.enablePush);

  // Newest-first sorted view for the dropdown.
  const sortedNotifs = useMemo(
    () =>
      [...notifItems].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [notifItems]
  );

  // Only surface the "Enable push" affordance when the browser hasn't decided.
  const [canOfferPush, setCanOfferPush] = useState(
    () => notificationPermission() === "default"
  );

  const handleEnablePush = useCallback(async () => {
    await enablePush();
    // Re-read: after the prompt the permission is granted/denied → hide the CTA.
    setCanOfferPush(notificationPermission() === "default");
  }, [enablePush]);

  const handleNotifClick = useCallback(
    (n: ServerNotification) => {
      if (!n.isRead) void markRead(n._id);
      if (n.link) {
        setNotifOpen(false);
        // Admin deep-links are `/bennie/...` app routes.
        if (n.link.startsWith("/bennie")) navigate(n.link);
      }
    },
    [markRead, navigate]
  );

  const isSuperAdmin = permissionMatches(effectivePermissions, "*");
  const roleName = admin?.role?.name ?? "Admin";
  const fullName =
    `${admin?.firstName ?? ""} ${admin?.lastName ?? ""}`.trim() || "Admin";
  const initials =
    (admin?.firstName?.[0] ?? "A") + (admin?.lastName?.[0] ?? "");

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
    setNotifOpen(false);
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

  // Click-away for identity + notifications menus.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (identityRef.current && !identityRef.current.contains(e.target as Node)) {
        setIdentityOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Esc closes the notification dropdown.
  useEffect(() => {
    if (!notifOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [notifOpen]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/bennie/auth", { replace: true });
  }, [logout, navigate]);

  // --- Breadcrumb / page title -------------------------------------------
  const { pageTitle } = useMemo(() => {
    const seg = location.pathname.replace(/^\/bennie\/?/, "").split("/")[0] || "dashboard";
    const title = ADMIN_ROUTE_TITLES[seg] ?? "Dashboard";
    return { pageTitle: title };
  }, [location.pathname]);

  // --- Bottom nav (mobile): permitted key sections, else "More" ----------
  const bottomItems = useMemo(() => {
    const permitted = ADMIN_NAV.filter(
      (item) =>
        (item.permissions.length === 0 ||
          hasAnyPermission(effectivePermissions, item.permissions)) &&
        ADMIN_BOTTOM_NAV_ROUTES.includes(item.to)
    );
    // Preserve the intended order of ADMIN_BOTTOM_NAV_ROUTES.
    return ADMIN_BOTTOM_NAV_ROUTES.map((r) =>
      permitted.find((p) => p.to === r)
    ).filter(Boolean) as typeof ADMIN_NAV;
  }, [effectivePermissions]);

  const brand = (
    <Link
      to="/bennie/dashboard"
      className="flex items-center gap-2.5 group"
      aria-label="Bennie Connect Admin — Dashboard"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary ring-1 ring-white/10 shadow-sm transition-transform group-hover:scale-105">
        <Sprout className="h-5 w-5 text-white" />
      </span>
      <span className="hidden sm:block leading-none">
        <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">
          Bennie Connect
        </span>
        <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
          Admin Console
        </span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-primary/10 selection:text-primary">
      {/* Realtime + web-push runtime (in-app socket + FCM) for the admin plane */}
      <AdminNotificationProvider />
      {/* Toast stack for live notification arrivals (mounted once) */}
      <Toaster />

      {/* Skip link */}
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <div className="flex">
        {/* DESKTOP SIDEBAR (forest ops console) */}
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
                  Admin Console
                </span>
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <AdminSidebarNav collapsed={collapsed} />
          </div>

          {/* Footer: identity + version + collapse */}
          <div className="border-t border-white/10 px-3 py-3">
            {!collapsed && (
              <div className="mb-2 flex items-center gap-2.5 rounded-2xl bg-white/[0.05] px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E7A13C]/25 text-[11px] font-bold uppercase text-[#E7A13C]">
                  {initials}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-xs font-semibold">
                    {fullName}
                  </span>
                  <span className="block truncate text-[10px] text-white/50">
                    {roleName}
                  </span>
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
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Admin
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted/60" />
                <span className="truncate font-display text-sm font-semibold text-ink">
                  {pageTitle}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Theme toggle (cycles light / dark / system) */}
              <ThemeToggleButton />

              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((v) => !v);
                    setIdentityOpen(false);
                  }}
                  className="relative rounded-xl p-2 text-muted transition hover:bg-primary/5 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  aria-label={
                    unreadCount > 0
                      ? `Notifications, ${unreadCount} unread`
                      : "Notifications"
                  }
                  aria-expanded={notifOpen}
                  aria-haspopup="true"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span
                      aria-hidden
                      className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white ring-2 ring-canvas"
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduce ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      role="menu"
                      aria-label="Notifications"
                      className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface text-ink shadow-xl shadow-primary/10"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                        <span className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
                          Notifications
                          {unreadCount > 0 && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              {unreadCount} new
                            </span>
                          )}
                        </span>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={() => void markAllRead()}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/5"
                          >
                            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                          </button>
                        )}
                      </div>

                      {/* Enable-push affordance (only when permission is undecided) */}
                      {canOfferPush && !pushEnabled && (
                        <button
                          type="button"
                          onClick={handleEnablePush}
                          className="flex w-full items-center gap-2.5 border-b border-border bg-primary/[0.03] px-4 py-2.5 text-left transition hover:bg-primary/[0.06]"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <BellRing className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 leading-tight">
                            <span className="block text-xs font-semibold text-ink">
                              Enable push notifications
                            </span>
                            <span className="block text-[11px] text-muted">
                              Get alerts even when this tab is closed.
                            </span>
                          </span>
                        </button>
                      )}

                      <div className="max-h-[22rem] overflow-y-auto">
                        {sortedNotifs.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <Bell className="mx-auto mb-2 h-6 w-6 text-muted/50" />
                            <p className="text-sm font-medium text-muted">
                              You're all caught up
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              New activity — like farmer sign-ups — shows up here
                              in real time.
                            </p>
                          </div>
                        ) : (
                          <ul className="divide-y divide-border">
                            {sortedNotifs.map((n) => {
                              const tone = NOTIF_TONE[n.type] ?? NOTIF_TONE.info;
                              const ToneIcon = tone.icon;
                              return (
                                <li key={n._id}>
                                  <button
                                    type="button"
                                    onClick={() => handleNotifClick(n)}
                                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-primary/[0.04] ${
                                      n.isRead ? "" : "bg-primary/[0.03]"
                                    }`}
                                  >
                                    <span
                                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.bg} ${tone.color}`}
                                    >
                                      <ToneIcon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1 leading-snug">
                                      <span className="flex items-center justify-between gap-2">
                                        <span
                                          className={`truncate text-[13px] ${
                                            n.isRead
                                              ? "font-medium text-muted"
                                              : "font-semibold text-ink"
                                          }`}
                                        >
                                          {n.title}
                                        </span>
                                        <span className="shrink-0 text-[10px] font-medium text-muted">
                                          {relativeTime(n.createdAt)}
                                        </span>
                                      </span>
                                      {n.message && (
                                        <span className="mt-0.5 block line-clamp-2 text-xs text-muted">
                                          {n.message}
                                        </span>
                                      )}
                                    </span>
                                    {!n.isRead && (
                                      <span
                                        aria-hidden
                                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                                      />
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Identity menu */}
              <div className="relative" ref={identityRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIdentityOpen((v) => !v);
                    setNotifOpen(false);
                  }}
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
                      className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-surface text-ink shadow-xl shadow-primary/10"
                    >
                      <div className="border-b border-border px-4 py-3.5">
                        <p className="truncate text-sm font-semibold text-ink">
                          {fullName}
                        </p>
                        <p className="truncate font-mono text-[11px] text-muted">
                          {admin?.email}
                        </p>
                        <span
                          className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            isSuperAdmin
                              ? "bg-accent/15 text-[#a6701c] dark:text-accent"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          <ShieldAlert className="h-3 w-3" />
                          {roleName}
                        </span>
                      </div>
                      {/* Theme preference (light / dark / system) */}
                      <div className="border-b border-border px-3 py-3">
                        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                          Appearance
                        </p>
                        <ThemeToggle compact className="w-full justify-between" />
                      </div>
                      <div className="p-1.5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => navigate("/bennie/change-password")}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-primary/5 hover:text-ink"
                        >
                          <KeyRound className="h-4 w-4" /> Change password
                        </button>
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
            id="admin-content"
            className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 lg:px-8"
          >
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
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
                      Admin Console
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
                <AdminSidebarNav onNavigate={() => setDrawerOpen(false)} />
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
                      {roleName}
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
