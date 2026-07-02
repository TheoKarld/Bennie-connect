/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-backed notification store (ADMIN plane).
 *
 * This is the ADMIN instance of the same plane-agnostic pattern used by
 * `src/store/notificationStore.ts` (the USER plane). It talks to the ADMIN REST
 * surface via `src/lib/adminApi.ts` (baseURL `<VITE_API_URL>/admin`, which
 * already attaches the admin token + withCredentials). It reuses the shared
 * `ServerNotification` type and the shared socket/firebase libs, but NOT the
 * user store (that one is bound to the user api).
 *
 * Unlike the user bell, the admin bell has NO offline mock source — it shows
 * server items only, and simply stays empty when the backend is unreachable.
 *
 * Degrades gracefully: every network call is wrapped; with no backend the store
 * stays empty (status "error") and the bell renders its empty-state.
 */

import { create } from "zustand";
import type { AxiosError } from "axios";

import adminApi from "../lib/adminApi";
import { getFcmToken, notificationPermission } from "../lib/firebase";
import type { ServerNotification } from "./notificationStore";

// Re-export so admin consumers can import the shape from one place.
export type { ServerNotification, NotificationType } from "./notificationStore";

type Status = "idle" | "loading" | "ready" | "error";

interface AdminNotificationState {
  items: ServerNotification[];
  unreadCount: number;
  status: Status;
  /** True once an FCM device token has been registered this session. */
  pushEnabled: boolean;
  hydrated: boolean;
}

interface AdminNotificationActions {
  hydrate: () => Promise<void>;
  add: (n: ServerNotification) => void;
  setUnreadCount: (count: number) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  enablePush: () => Promise<boolean>;
  reset: () => void;
}

export type AdminNotificationStore = AdminNotificationState &
  AdminNotificationActions;

// --- Helpers -----------------------------------------------------------------

/** Unwrap `{ success, data }`; tolerate either the envelope or a bare payload. */
function unwrap<T>(payload: unknown): T {
  const body = payload as { data?: T } | T;
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

const INITIAL: AdminNotificationState = {
  items: [],
  unreadCount: 0,
  status: "idle",
  pushEnabled: false,
  hydrated: false,
};

// --- Store -------------------------------------------------------------------

export const useAdminNotificationStore = create<AdminNotificationStore>()(
  (set, get) => ({
    ...INITIAL,

    hydrate: async () => {
      set({ status: "loading" });
      try {
        const [listRes, countRes] = await Promise.all([
          adminApi.get("/notifications", { params: { page: 1, limit: 20 } }),
          adminApi.get("/notifications/unread-count"),
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
        // No backend / not authenticated yet: stay empty, show empty-state.
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
          n._id === id
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));

      try {
        await adminApi.patch(`/notifications/${id}/read`);
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
        // PRD documents POST /admin/notifications/read-all.
        await adminApi.post("/notifications/read-all");
      } catch (err) {
        // Some deployments expose PATCH /notifications/read-all — try once.
        const status = (err as AxiosError)?.response?.status;
        if (status === 404 || status === 405) {
          try {
            await adminApi.patch("/notifications/read-all");
            return;
          } catch {
            /* fall through to rollback */
          }
        }
        set({
          items: snapshot,
          unreadCount: snapshot.filter((n) => !n.isRead).length,
        });
      }
    },

    enablePush: async () => {
      // Already registered this session.
      if (get().pushEnabled) return true;

      const token = await getFcmToken();
      if (!token) return false;

      try {
        await adminApi.post("/notifications/device-tokens", {
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
  })
);
