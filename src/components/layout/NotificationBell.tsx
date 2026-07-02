/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unified user notification bell.
 *
 * Merges two sources into one date-sorted list:
 *   (a) the offline mock inbox — `appStore.notifications` (FarmerNotification)
 *   (b) the server-backed inbox — `notificationStore.items` (ServerNotification)
 *
 * The unread badge is the union of both. Mark-as-read routes to the correct
 * store per item origin. A header action clears/marks-all across both. A subtle
 * "Enable push notifications" affordance calls `enablePush()` and is shown only
 * while browser permission has not yet been granted (and it is supported).
 *
 * Accessible like the AdminLayout bell: aria-expanded/haspopup, Esc to close,
 * click-away to close.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell,
  CheckCircle2,
  Info,
  AlertTriangle,
  BellRing,
  CheckCheck,
  X,
} from "lucide-react";

import { useAppStore } from "../../store/appStore";
import { useNotificationStore } from "../../store/notificationStore";
import type { ServerNotification } from "../../store/notificationStore";
import { notificationPermission } from "../../lib/firebase";

type Origin = "mock" | "server";
type Tone = "info" | "success" | "warning" | "alert";

interface MergedItem {
  key: string;
  origin: Origin;
  id: string;
  title: string;
  message: string;
  type: Tone;
  isRead: boolean;
  date: number; // epoch ms for sorting
  link?: string;
}

const TONE_ICON: Record<Tone, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  alert: BellRing,
};

const TONE_COLOR: Record<Tone, string> = {
  success: "text-[#135D39]",
  info: "text-[#135D39]",
  warning: "text-[#a6701c]",
  alert: "text-red-500",
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "Just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function NotificationBell() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Mock (offline) store.
  const mockNotifications = useAppStore((s) => s.notifications);
  const handleReadNotification = useAppStore((s) => s.handleReadNotification);
  const handleClearNotifications = useAppStore((s) => s.handleClearNotifications);

  // Server store.
  const serverItems = useNotificationStore((s) => s.items);
  const serverUnread = useNotificationStore((s) => s.unreadCount);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const enablePush = useNotificationStore((s) => s.enablePush);
  const pushEnabled = useNotificationStore((s) => s.pushEnabled);

  // Whether to show the "Enable push" affordance.
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    () => notificationPermission()
  );
  const showEnablePush = perm === "default" && !pushEnabled;

  // --- Merge + sort -----------------------------------------------------------
  const merged: MergedItem[] = useMemo(() => {
    const fromMock: MergedItem[] = (mockNotifications ?? []).map((n) => ({
      key: `mock:${n.id}`,
      origin: "mock",
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      date: new Date(n.date).getTime() || 0,
      link: undefined,
    }));

    const fromServer: MergedItem[] = (serverItems ?? []).map(
      (n: ServerNotification) => ({
        key: `server:${n._id}`,
        origin: "server",
        id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        date: new Date(n.createdAt).getTime() || 0,
        link: n.link,
      })
    );

    return [...fromServer, ...fromMock].sort((a, b) => b.date - a.date);
  }, [mockNotifications, serverItems]);

  // Union unread count.
  const mockUnread = useMemo(
    () => (mockNotifications ?? []).filter((n) => !n.isRead).length,
    [mockNotifications]
  );
  const unreadCount = mockUnread + serverUnread;

  // --- Close behaviours --------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const handleItemRead = (item: MergedItem) => {
    if (item.isRead) return;
    if (item.origin === "mock") handleReadNotification(item.id);
    else void markRead(item.id);
  };

  const handleMarkAll = () => {
    // Mark server as read; clear the mock inbox (its only "clear" primitive).
    void markAllRead();
    handleClearNotifications();
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    try {
      await enablePush();
    } finally {
      setPerm(notificationPermission());
      setPushBusy(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-xl bg-[#135D39]/5 p-2 text-[#135D39] transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#135D39]/30"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-[#E7A13C] px-1 text-[10px] font-bold leading-4 text-[#1A2421]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            role="menu"
            aria-label="Notifications"
            className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#E6E5DF] bg-white shadow-xl shadow-[#135D39]/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-[#E6E5DF] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold text-[#1A2421]">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[#135D39]/10 px-2 py-0.5 text-[10px] font-bold text-[#135D39]">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {merged.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-[#5C6460] transition hover:bg-[#135D39]/5 hover:text-[#135D39]"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>

            {/* Enable-push affordance */}
            {showEnablePush && (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={pushBusy}
                className="flex w-full items-center gap-2.5 border-b border-[#E6E5DF] bg-[#135D39]/[0.03] px-4 py-2.5 text-left transition hover:bg-[#135D39]/[0.06] disabled:opacity-60"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E7A13C]/15 text-[#a6701c]">
                  <BellRing className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[#1A2421]">
                    {pushBusy ? "Enabling…" : "Enable push notifications"}
                  </span>
                  <span className="block truncate text-[11px] text-[#5C6460]">
                    Get alerts even when this tab is closed.
                  </span>
                </span>
              </button>
            )}

            {/* List */}
            <div className="max-h-[24rem] overflow-y-auto">
              {merged.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto mb-2 h-6 w-6 text-[#C9CCC7]" />
                  <p className="text-sm font-medium text-[#5C6460]">
                    You're all caught up
                  </p>
                  <p className="mt-1 text-xs text-[#9AA29D]">
                    New activity will appear here in real time.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[#F0EFEA]">
                  {merged.map((item) => {
                    const Icon = TONE_ICON[item.type];
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => handleItemRead(item)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#135D39]/[0.03] ${
                            item.isRead ? "opacity-70" : ""
                          }`}
                        >
                          <span className={`mt-0.5 shrink-0 ${TONE_COLOR[item.type]}`}>
                            <Icon className="h-4.5 w-4.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[13px] font-semibold text-[#1A2421]">
                                {item.title}
                              </span>
                              {!item.isRead && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-[#E7A13C]" />
                              )}
                            </span>
                            <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-[#5C6460]">
                              {item.message}
                            </span>
                            <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-[#9AA29D]">
                              {timeAgo(item.date)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            {merged.length > 0 && (
              <div className="flex items-center justify-between border-t border-[#E6E5DF] px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-[#5C6460] transition hover:text-[#1A2421]"
                >
                  <X className="h-3.5 w-3.5" /> Close
                </button>
                <span className="font-mono text-[10px] text-[#9AA29D]">
                  {merged.length} total
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
