/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Notification runtime for the authenticated ADMIN area (`/bennie/*`).
 *
 * Mounted inside the authenticated admin shell (AdminLayout). On an authenticated
 * admin it:
 *   1. hydrates the server-backed admin notification store (REST via adminApi),
 *   2. connects the `/rt/admin` socket namespace with the admin access token,
 *   3. subscribes to `notification:new` (-> add + toast),
 *      `notification:unread_count` (-> setUnreadCount) and (optional)
 *      `support:message`,
 *   4. registers a foreground FCM handler (-> add + toast) when push is available.
 *
 * On logout / unmount it tears everything down (disconnect socket, unsubscribe
 * FCM, reset store). StrictMode-safe: the effect fully cleans up so the
 * double-invoke in dev does not leak sockets or listeners — mirroring the user
 * NotificationProvider.
 *
 * Degrades gracefully: socket connect failures are swallowed/logged; with no
 * Firebase env the FCM handler is a no-op; with no backend the store stays empty
 * and the admin bell shows its empty-state.
 */

import { useEffect, useRef } from "react";

import { useAdminAuth } from "../hooks/useAdminAuth";
import { useAdminNotificationStore } from "../store/adminNotificationStore";
import type { ServerNotification } from "../store/adminNotificationStore";
import { createRealtimeSocket, type Socket } from "../lib/socket";
import { onForegroundMessage } from "../lib/firebase";
import storage from "../lib/storage";
import { pushToast } from "../components/ui/Toast";

function toToastTone(
  t: string | undefined
): "info" | "success" | "warning" | "alert" {
  if (t === "success" || t === "warning" || t === "alert") return t;
  return "info";
}

export default function AdminNotificationProvider() {
  const { status, admin } = useAdminAuth();
  const adminId = admin?.adminId;

  const socketRef = useRef<Socket | null>(null);

  const hydrate = useAdminNotificationStore((s) => s.hydrate);
  const add = useAdminNotificationStore((s) => s.add);
  const setUnreadCount = useAdminNotificationStore((s) => s.setUnreadCount);
  const reset = useAdminNotificationStore((s) => s.reset);

  useEffect(() => {
    // Only run the runtime for an authenticated admin.
    if (status !== "authenticated") {
      return;
    }

    let disposed = false;

    // 1. Hydrate the durable inbox.
    void hydrate();

    // 2. Connect the admin realtime socket (/rt/admin, admin token).
    const socket = createRealtimeSocket({
      namespace: "/rt/admin",
      getToken: () => storage.getAdminToken(),
    });
    socketRef.current = socket;

    const handleNew = (
      payload: { notification: ServerNotification } | ServerNotification
    ) => {
      const n =
        (payload as { notification?: ServerNotification })?.notification ??
        (payload as ServerNotification);
      if (!n || !n._id) return;
      add(n);
      pushToast({
        title: n.title,
        message: n.message,
        tone: toToastTone(n.type),
      });
    };

    const handleUnreadCount = (payload: {
      count?: number;
      unreadCount?: number;
    }) => {
      const count = payload?.count ?? payload?.unreadCount;
      if (typeof count === "number") setUnreadCount(count);
    };

    const handleSupportMessage = (payload: { message?: string; name?: string }) => {
      if (payload?.message) {
        pushToast({
          title: payload.name ? `Message from ${payload.name}` : "Support message",
          message: payload.message,
          tone: "info",
        });
      }
    };

    const handleConnectError = (err: Error) => {
      // Swallow: no backend / bad token — the inbox REST still works.
      // eslint-disable-next-line no-console
      console.info("[rt/admin] socket connect_error:", err?.message ?? err);
    };

    socket.on("notification:new", handleNew);
    socket.on("notification:unread_count", handleUnreadCount);
    socket.on("support:message", handleSupportMessage);
    socket.on("connect_error", handleConnectError);

    try {
      socket.connect();
    } catch {
      /* ignore — reconnection logic + connect_error cover this */
    }

    // 3. Foreground FCM messages (tab focused).
    const unsubFcm = onForegroundMessage((payload) => {
      if (disposed) return;
      const data = (payload.data ?? {}) as Record<string, string>;
      const notification = payload.notification ?? {};
      const title = notification.title || data.title || "Notification";
      const body = notification.body || data.message || "";
      pushToast({ title, message: body, tone: toToastTone(data.type) });
    });

    return () => {
      disposed = true;
      socket.off("notification:new", handleNew);
      socket.off("notification:unread_count", handleUnreadCount);
      socket.off("support:message", handleSupportMessage);
      socket.off("connect_error", handleConnectError);
      socket.disconnect();
      socketRef.current = null;
      unsubFcm();
    };
  }, [status, adminId, hydrate, add, setUnreadCount]);

  // On leaving the authenticated state entirely, clear the server store.
  useEffect(() => {
    if (status === "unauthenticated") {
      reset();
    }
  }, [status, reset]);

  return null;
}
