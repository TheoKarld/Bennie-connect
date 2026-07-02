/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Notification runtime for the authenticated USER area.
 *
 * Mounted inside the authenticated shell (AppShell). On an authenticated user it:
 *   1. hydrates the server-backed notification store (REST),
 *   2. connects the `/rt/user` socket namespace,
 *   3. subscribes to `notification:new` (-> add + toast) and
 *      `notification:unread_count` (-> setUnreadCount), plus `support:reply`,
 *   4. registers a foreground FCM handler (-> add + toast) when push is available.
 *
 * On logout / unmount it tears everything down (disconnect socket, unsubscribe
 * FCM, reset store). StrictMode-safe: the effect fully cleans up so the
 * double-invoke in dev does not leak sockets or listeners.
 *
 * Degrades gracefully: socket connect failures are swallowed/logged; with no
 * Firebase env the FCM handler is a no-op; with no backend the store stays empty
 * and the bell falls back to the offline mock.
 */

import { useEffect, useRef } from "react";

import { useAuth } from "../hooks/useAuth";
import { useNotificationStore } from "../store/notificationStore";
import type { ServerNotification } from "../store/notificationStore";
import { createRealtimeSocket, type Socket } from "../lib/socket";
import { onForegroundMessage } from "../lib/firebase";
import storage from "../lib/storage";
import { pushToast } from "../components/ui/Toast";

function toToastTone(t: string | undefined): "info" | "success" | "warning" | "alert" {
  if (t === "success" || t === "warning" || t === "alert") return t;
  return "info";
}

export default function NotificationProvider() {
  const { status, user } = useAuth();
  const userId = user?.id ?? user?.userId;

  const socketRef = useRef<Socket | null>(null);

  const hydrate = useNotificationStore((s) => s.hydrate);
  const add = useNotificationStore((s) => s.add);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const reset = useNotificationStore((s) => s.reset);

  useEffect(() => {
    // Only run the runtime for an authenticated user.
    if (status !== "authenticated" || !userId) {
      return;
    }

    let disposed = false;

    // 1. Hydrate the durable inbox.
    void hydrate();

    // 2. Connect the user realtime socket.
    const socket = createRealtimeSocket({
      namespace: "/rt/user",
      getToken: () => storage.getUserToken(),
    });
    socketRef.current = socket;

    const handleNew = (payload: { notification: ServerNotification } | ServerNotification) => {
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

    const handleUnreadCount = (payload: { count?: number; unreadCount?: number }) => {
      const count = payload?.count ?? payload?.unreadCount;
      if (typeof count === "number") setUnreadCount(count);
    };

    const handleSupportReply = (payload: { message?: string }) => {
      if (payload?.message) {
        pushToast({
          title: "Support reply",
          message: payload.message,
          tone: "info",
        });
      }
    };

    const handleConnectError = (err: Error) => {
      // Swallow: no backend / bad token — the inbox REST + mock still work.
      // eslint-disable-next-line no-console
      console.info("[rt/user] socket connect_error:", err?.message ?? err);
    };

    socket.on("notification:new", handleNew);
    socket.on("notification:unread_count", handleUnreadCount);
    socket.on("support:reply", handleSupportReply);
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
      socket.off("support:reply", handleSupportReply);
      socket.off("connect_error", handleConnectError);
      socket.disconnect();
      socketRef.current = null;
      unsubFcm();
    };
  }, [status, userId, hydrate, add, setUnreadCount]);

  // On leaving the authenticated state entirely, clear the server store.
  useEffect(() => {
    if (status === "unauthenticated") {
      reset();
    }
  }, [status, reset]);

  return null;
}
