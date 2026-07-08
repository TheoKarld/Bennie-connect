/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Live GPS-tracking realtime hook for the ADMIN fleet map.
 *
 * The admin-plane mirror of `useTrackingSocket`: owns a single `/rt/admin`
 * socket for the whole active fleet.
 *   - connects on mount (fresh socket, independent of AdminNotificationProvider),
 *   - subscribes to every active booking's `track:<bookingId>` room via
 *     `equipment:tracking:subscribe {bookingId}` (re-subscribes on reconnect and
 *     whenever the active-booking set changes),
 *   - folds `equipment:position:new` into the store via `applyLivePosition`,
 *   - folds `equipment:alert` into the store via `pushAlert` (toast + panel),
 *   - unsubscribes + disconnects on unmount.
 *
 * Event names are identical to the user plane (`equipment:tracking:subscribe`,
 * `equipment:position:new`); alerts arrive on the admin stream as
 * `equipment:alert {bookingId,type,detail,position}`.
 */

import { useEffect, useRef, useState } from "react";

import { createRealtimeSocket, type Socket } from "../lib/socket";
import storage from "../lib/storage";
import { pushToast } from "../components/ui";
import { useAdminEquipmentStore } from "../store/adminEquipmentStore";
import type { AdminLivePosition, LiveAlert } from "../types/adminEquipment";

export type FleetSocketStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "closed";

interface UseAdminFleetSocketResult {
  status: FleetSocketStatus;
}

const ALERT_LABEL: Record<string, string> = {
  GEOFENCE_BREACH: "Geofence breach",
  OVERSPEED: "Overspeed",
  SIGNAL_LOST: "Signal lost",
  IDLE_ANOMALY: "Idle anomaly",
};

/**
 * @param bookingIds Active-booking ids whose tracking rooms to join. The hook
 *   re-subscribes whenever this list changes (join the joined-key string).
 * @param enabled When false, the socket is not opened (e.g. tab not visible).
 */
export function useAdminFleetSocket(
  bookingIds: string[],
  enabled = true
): UseAdminFleetSocketResult {
  const [status, setStatus] = useState<FleetSocketStatus>("connecting");
  const socketRef = useRef<Socket | null>(null);

  const applyLivePosition = useAdminEquipmentStore((s) => s.applyLivePosition);
  const pushAlert = useAdminEquipmentStore((s) => s.pushAlert);

  // Stable dependency for the effect from the id set.
  const key = [...bookingIds].sort().join(",");

  useEffect(() => {
    if (!enabled) {
      setStatus("closed");
      return;
    }

    setStatus("connecting");

    const ids = key ? key.split(",") : [];

    const socket = createRealtimeSocket({
      namespace: "/rt/admin",
      getToken: () => storage.getAdminToken(),
    });
    socketRef.current = socket;

    const subscribeAll = () => {
      ids.forEach((bookingId) =>
        socket.emit("equipment:tracking:subscribe", { bookingId })
      );
    };

    const handleConnect = () => {
      setStatus("connected");
      subscribeAll();
    };

    const handleReconnectAttempt = () => setStatus("reconnecting");

    const handleDisconnect = (reason: string) => {
      setStatus(reason === "io client disconnect" ? "closed" : "reconnecting");
    };

    const handleConnectError = () => setStatus("error");

    const handlePosition = (payload: AdminLivePosition) => {
      if (!payload?.bookingId) return;
      applyLivePosition(payload);
    };

    const handleAlert = (payload: LiveAlert) => {
      if (!payload?.bookingId) return;
      pushAlert(payload);
      pushToast({
        tone: "warning",
        title: ALERT_LABEL[payload.type] ?? "GPS alert",
        message: payload.detail,
      });
    };

    socket.on("connect", handleConnect);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("equipment:position:new", handlePosition);
    socket.on("equipment:alert", handleAlert);

    try {
      socket.connect();
    } catch {
      setStatus("error");
    }

    return () => {
      try {
        ids.forEach((bookingId) =>
          socket.emit("equipment:tracking:unsubscribe", { bookingId })
        );
      } catch {
        /* ignore — disconnecting anyway */
      }
      socket.off("connect", handleConnect);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("equipment:position:new", handlePosition);
      socket.off("equipment:alert", handleAlert);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [key, enabled, applyLivePosition, pushAlert]);

  return { status };
}

export default useAdminFleetSocket;
