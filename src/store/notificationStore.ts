/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed notification store (USER plane).
 *
 * This is the concrete USER instance of an otherwise plane-agnostic pattern:
 * it talks to the user REST surface via `src/lib/api.ts` (which already attaches
 * the user token + withCredentials). The admin frontend will build its own
 * instance against `adminApi` + the `/admin/notifications` endpoints — it can
 * reuse the `ServerNotification` shape and the socket/firebase libs, but not
 * this store (it is bound to the user api).
 *
 * Degrades gracefully: every network call is wrapped; with no backend the store
 * simply stays empty (status "error") and the merged bell falls back to the
 * offline mock (`appStore.notifications`).
 */

import { create } from "zustand";
import type { AxiosError } from "axios";

import api from "../lib/api";
import { getFcmToken, notificationPermission } from "../lib/firebase";

// --- Server notification shape (mirrors PRD notifications doc) ----------------

export type NotificationType = "info" | "success" | "warning" | "alert";

export interface ServerNotification {
  _id: string;
  audience: "user" | "admin";
  userId?: string;
  adminId?: string;
  event: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  link?: string;
  isRead: boolean;
  readAt?: string;
  channels?: { socket?: boolean; push?: boolean };
  createdAt: string;
  updatedAt?: string;
}

type Status = "idle" | "loading" | "ready" | "error";

interface NotificationState {
  items: ServerNotification[];
  unreadCount: number;
  status: Status;
  /** True once an FCM device token has been registered this session. */
  pushEnabled: boolean;
  hydrated: boolean;
}

interface NotificationActions {
  hydrate: () => Promise<void>;
  add: (n: ServerNotification) => void;
  setUnreadCount: (count: number) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  enablePush: () => Promise<boolean>;
  reset: () => void;
}

export type NotificationStore = NotificationState & NotificationActions;

// --- Helpers -----------------------------------------------------------------

/** Unwrap `{ success, data }`; tolerate either the envelope or a bare payload. */
function unwrap<T>(payload: unknown): T {
  const body = payload as { data?: T } | T;
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

const INITIAL: NotificationState = {
  items: [],
  unreadCount: 0,
  status: "idle",
  pushEnabled: false,
  hydrated: false,
};

// --- Store -------------------------------------------------------------------

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  ...INITIAL,

  hydrate: async () => {
    set({ status: "loading" });
    try {
      const [listRes, countRes] = await Promise.all([
        api.get("/notifications", { params: { page: 1, limit: 20 } }),
        api.get("/notifications/unread-count"),
      ]);

      const listData = unwrap<{
        items?: ServerNotification[];
        unreadCount?: number;
      }>(listRes.data);
      const countData = unwrap<{ count?: number; unreadCount?: number }>(
        countRes.data
      );

      const items = Array.isArray(listData?.items) ? listData.items : [];
      const unreadCount =
        countData?.count ??
        countData?.unreadCount ??
        listData?.unreadCount ??
        items.filter((n) => !n.isRead).length;

      set({
        items,
        unreadCount: unreadCount || 0,
        status: "ready",
        hydrated: true,
      });
    } catch {
      // No backend / not authenticated yet: stay empty, let the mock bell show.
      set({ status: "error", hydrated: true });
    }
  },

  add: (n) => {
    set((prev) => {
      // De-dupe by id (socket + FCM can both deliver the same doc).
      if (prev.items.some((x) => x._id === n._id)) return prev;
      return {
        items: [n, ...prev.items],
        unreadCount: n.isRead ? prev.unreadCount : prev.unreadCount + 1,
      };
    });
  },

  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),

  markRead: async (id) => {
    const target = get().items.find((n) => n._id === id);
    if (!target || target.isRead) return;

    // Optimistic update.
    set((prev) => ({
      items: prev.items.map((n) =>
        n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, prev.unreadCount - 1),
    }));

    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // Roll back on failure.
      set((prev) => ({
        items: prev.items.map((n) =>
          n._id === id ? { ...n, isRead: false, readAt: undefined } : n
        ),
        unreadCount: prev.unreadCount + 1,
      }));
    }
  },

  markAllRead: async () => {
    const hadUnread = get().items.some((n) => !n.isRead);
    if (!hadUnread) return;

    const snapshot = get().items;
    set((prev) => ({
      items: prev.items.map((n) =>
        n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() }
      ),
      unreadCount: 0,
    }));

    try {
      // PRD documents POST /notifications/read-all.
      await api.post("/notifications/read-all");
    } catch (err) {
      // Some deployments expose PATCH /notifications/read-all — try once.
      const status = (err as AxiosError)?.response?.status;
      if (status === 404 || status === 405) {
        try {
          await api.patch("/notifications/read-all");
          return;
        } catch {
          /* fall through to rollback */
        }
      }
      set({ items: snapshot, unreadCount: snapshot.filter((n) => !n.isRead).length });
    }
  },

  enablePush: async () => {
    // Already registered this session.
    if (get().pushEnabled) return true;

    const token = await getFcmToken();
    if (!token) return false;

    try {
      await api.post("/notifications/device-tokens", {
        token,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      set({ pushEnabled: true });
      return true;
    } catch {
      // Backend missing the endpoint — treat as opt-in unavailable, no throw.
      set({ pushEnabled: notificationPermission() === "granted" });
      return false;
    }
  },

  reset: () => set({ ...INITIAL, hydrated: false }),
}));
