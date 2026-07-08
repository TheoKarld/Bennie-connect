/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin group realtime hook for one open Adashe group workspace.
 *
 * The admin-plane mirror of `useGroupSocket`: owns the `/rt/admin` socket
 * lifecycle for a single group room (an admin may join ANY group):
 *   - connects on mount (a fresh socket, independent of AdminNotificationProvider),
 *   - emits `group:join {groupId}` after connect (and re-joins on reconnect),
 *   - folds `group:message:new` into the admin store (`addMessage`) and
 *     `group:activity` into `applyActivity`,
 *   - emits `group:leave` + disconnects on unmount / group change.
 *
 * The server tags an admin-sent `group:message` with `senderType: 'admin'` from
 * the token, so the composer just emits the raw text. Returns
 * `{ status, sendMessage }` for the ChatPanel (optimistic send, reconnect pill).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { createRealtimeSocket, type Socket } from "../lib/socket";
import storage from "../lib/storage";
import { useAdminAdasheStore } from "../store/adminAdasheStore";
import type { GroupActivity, GroupMessage } from "../types/adashe";

export type AdminGroupSocketStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "closed";

interface UseAdminGroupSocketResult {
  status: AdminGroupSocketStatus;
  /** Emit an admin chat message over the socket (does not persist locally). */
  sendMessage: (message: string) => boolean;
}

export function useAdminGroupSocket(
  groupId: string | null
): UseAdminGroupSocketResult {
  const [status, setStatus] = useState<AdminGroupSocketStatus>("connecting");
  const socketRef = useRef<Socket | null>(null);

  const addMessage = useAdminAdasheStore((s) => s.addMessage);
  const applyActivity = useAdminAdasheStore((s) => s.applyActivity);

  useEffect(() => {
    if (!groupId) {
      setStatus("closed");
      return;
    }

    setStatus("connecting");

    const socket = createRealtimeSocket({
      namespace: "/rt/admin",
      getToken: () => storage.getAdminToken(),
    });
    socketRef.current = socket;

    const join = () => socket.emit("group:join", { groupId });

    const handleConnect = () => {
      setStatus("connected");
      join();
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

    const handleMessageNew = (payload: {
      groupId: string;
      message: GroupMessage;
    }) => {
      if (payload?.groupId !== groupId || !payload?.message) return;
      addMessage(payload.message);
    };

    const handleActivity = (payload: {
      groupId: string;
      activity: GroupActivity;
    }) => {
      if (payload?.groupId !== groupId || !payload?.activity) return;
      applyActivity(payload.activity);
    };

    const handleGroupError = (err: unknown) => {
      // eslint-disable-next-line no-console
      console.info("[rt/admin] group:error", err);
      setStatus("error");
    };

    socket.on("connect", handleConnect);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("group:message:new", handleMessageNew);
    socket.on("group:activity", handleActivity);
    socket.on("group:error", handleGroupError);

    try {
      socket.connect();
    } catch {
      setStatus("error");
    }

    return () => {
      try {
        socket.emit("group:leave", { groupId });
      } catch {
        /* ignore — disconnecting anyway */
      }
      socket.off("connect", handleConnect);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("group:message:new", handleMessageNew);
      socket.off("group:activity", handleActivity);
      socket.off("group:error", handleGroupError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [groupId, addMessage, applyActivity]);

  const sendMessage = useCallback(
    (message: string): boolean => {
      const socket = socketRef.current;
      const trimmed = message.trim();
      if (!socket || !socket.connected || !groupId || !trimmed) return false;
      socket.emit("group:message", { groupId, message: trimmed });
      return true;
    },
    [groupId]
  );

  return { status, sendMessage };
}

export default useAdminGroupSocket;
