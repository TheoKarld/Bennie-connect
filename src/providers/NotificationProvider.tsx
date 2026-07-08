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
import { useWalletStore } from "../store/walletStore";
import { useAdasheStore } from "../store/adasheStore";
import { useEquipmentStore } from "../store/equipmentStore";
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

  // Live wallet: hydrate on auth so Dashboard + top-nav show the real balance,
  // reset on logout, and refetch when a wallet-related realtime event arrives.
  const fetchWallet = useWalletStore((s) => s.fetchWallet);
  const resetWallet = useWalletStore((s) => s.reset);

  // Live Adashe: hydrate my-groups + invitations on auth so the dashboard shows
  // real circle data immediately; reset on logout, refresh on adashe/group events.
  const fetchMyGroups = useAdasheStore((s) => s.fetchMyGroups);
  const fetchInvitations = useAdasheStore((s) => s.fetchInvitations);
  const resetAdashe = useAdasheStore((s) => s.reset);

  // Live Equipment: nudge my-bookings when an equipment event lands so the
  // bookings list / status chips stay fresh; reset on logout.
  const fetchMyBookings = useEquipmentStore((s) => s.fetchMyBookings);
  const resetEquipment = useEquipmentStore((s) => s.reset);

  useEffect(() => {
    // Only run the runtime for an authenticated user.
    if (status !== "authenticated" || !userId) {
      return;
    }

    let disposed = false;

    // 1. Hydrate the durable inbox + the live wallet balance + Adashe circles.
    void hydrate();
    void fetchWallet({ silent: true });
    void fetchMyGroups({ silent: true });
    void fetchInvitations();

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
      // Refetch the live wallet when a wallet-related event lands (deposit
      // credited, withdrawal state change, transfer in/out).
      if (typeof n.event === "string" && n.event.startsWith("wallet.")) {
        void fetchWallet({ silent: true });
      }
      // Nudge Adashe when a circle event lands so the dashboard/list stay fresh
      // even when the workspace socket is not open.
      if (
        typeof n.event === "string" &&
        (n.event.startsWith("adashe.") || n.event.startsWith("group."))
      ) {
        void fetchMyGroups({ silent: true });
        if (n.event.startsWith("adashe.invite")) void fetchInvitations();
      }
      // Nudge equipment bookings when a booking lifecycle event lands (approved,
      // confirmed, in_use, completed, cancelled) so the list stays fresh.
      if (typeof n.event === "string" && n.event.startsWith("equipment.")) {
        void fetchMyBookings({ silent: true });
      }
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
  }, [
    status,
    userId,
    hydrate,
    add,
    setUnreadCount,
    fetchWallet,
    fetchMyGroups,
    fetchInvitations,
    fetchMyBookings,
  ]);

  // On leaving the authenticated state entirely, clear the server stores.
  useEffect(() => {
    if (status === "unauthenticated") {
      reset();
      resetWallet();
      resetAdashe();
      resetEquipment();
    }
  }, [status, reset, resetWallet, resetAdashe, resetEquipment]);

  return null;
}
