/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Live GPS-tracking realtime hook for one open equipment booking.
 *
 * Owns the `/rt/user` socket lifecycle for a single tracking room:
 *   - connects on mount (a fresh socket, independent of NotificationProvider),
 *   - emits `equipment:tracking:subscribe {bookingId}` after connect (and
 *     re-subscribes on every reconnect),
 *   - folds `equipment:position:new` into the store via `applyLivePosition`,
 *   - emits `equipment:tracking:unsubscribe` + disconnects on unmount / change.
 *
 * Ownership is enforced server-side (only the booking's userId / admins may
 * subscribe). Returns a `{ status }` surface for the tracking page's live
 * indicator.
 *
 * Admin-dev: mirror this against `/rt/admin` + `getAdminToken` for GPS
 * oversight — the event names (`equipment:tracking:subscribe`,
 * `equipment:position:new`) are identical.
 */

import { useEffect, useRef, useState } from "react";

import { createRealtimeSocket, type Socket } from "../lib/socket";
import storage from "../lib/storage";
import { useEquipmentStore } from "../store/equipmentStore";
import type { LivePosition } from "../types/equipment";

export type TrackingSocketStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "closed";

interface UseTrackingSocketResult {
  status: TrackingSocketStatus;
}

export function useTrackingSocket(
  bookingId: string | null
): UseTrackingSocketResult {
  const [status, setStatus] = useState<TrackingSocketStatus>("connecting");
  const socketRef = useRef<Socket | null>(null);

  const applyLivePosition = useEquipmentStore((s) => s.applyLivePosition);

  useEffect(() => {
    if (!bookingId) {
      setStatus("closed");
      return;
    }

    setStatus("connecting");

    const socket = createRealtimeSocket({
      namespace: "/rt/user",
      getToken: () => storage.getUserToken(),
    });
    socketRef.current = socket;

    const subscribe = () =>
      socket.emit("equipment:tracking:subscribe", { bookingId });

    const handleConnect = () => {
      setStatus("connected");
      subscribe();
    };

    const handleReconnectAttempt = () => setStatus("reconnecting");

    const handleDisconnect = (reason: string) => {
      if (reason === "io client disconnect") {
        setStatus("closed");
      } else {
        setStatus("reconnecting");
      }
    };

    const handleConnectError = () => setStatus("error");

    const handlePosition = (payload: LivePosition) => {
      if (!payload || payload.bookingId !== bookingId) return;
      applyLivePosition(payload);
    };

    socket.on("connect", handleConnect);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("equipment:position:new", handlePosition);

    try {
      socket.connect();
    } catch {
      setStatus("error");
    }

    return () => {
      try {
        socket.emit("equipment:tracking:unsubscribe", { bookingId });
      } catch {
        /* ignore — disconnecting anyway */
      }
      socket.off("connect", handleConnect);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("equipment:position:new", handlePosition);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [bookingId, applyLivePosition]);

  return { status };
}

export default useTrackingSocket;
