/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Group realtime hook for one open Adashe workspace.
 *
 * Owns the `/rt/user` socket lifecycle for a single group room:
 *   - connects on mount (a fresh socket, independent of NotificationProvider),
 *   - emits `group:join {groupId}` after connect (and re-joins on reconnect),
 *   - folds `group:message:new` into the store (`addMessage`) and
 *     `group:activity` into `applyActivity`,
 *   - emits `group:leave` + disconnects on unmount / group change.
 *
 * Membership is enforced server-side; a non-member receives `group:error`.
 * Returns a `{ status, sendMessage }` surface for the ChatTab (optimistic send,
 * reconnect indicator).
 *
 * Admin-dev: this is a reusable pattern. The admin workspace can mirror it
 * against `/rt/admin` + `getAdminToken` — the event names are identical.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { createRealtimeSocket, type Socket } from "../lib/socket";
import storage from "../lib/storage";
import { useAdasheStore } from "../store/adasheStore";
import type { GroupActivity, GroupMessage } from "../types/adashe";

export type GroupSocketStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "closed";

interface UseGroupSocketResult {
  status: GroupSocketStatus;
  /** Emit a chat message over the socket (does not persist locally). */
  sendMessage: (message: string) => boolean;
}

export function useGroupSocket(groupId: string | null): UseGroupSocketResult {
  const [status, setStatus] = useState<GroupSocketStatus>("connecting");
  const socketRef = useRef<Socket | null>(null);

  const addMessage = useAdasheStore((s) => s.addMessage);
  const applyActivity = useAdasheStore((s) => s.applyActivity);

  useEffect(() => {
    if (!groupId) {
      setStatus("closed");
      return;
    }

    setStatus("connecting");

    const socket = createRealtimeSocket({
      namespace: "/rt/user",
      getToken: () => storage.getUserToken(),
    });
    socketRef.current = socket;

    const join = () => socket.emit("group:join", { groupId });

    const handleConnect = () => {
      setStatus("connected");
      join();
    };

    // socket.io fires `reconnect` on the manager; the socket-level `connect`
    // covers both first connect and reconnect, so re-join happens on connect.
    const handleReconnectAttempt = () => setStatus("reconnecting");

    const handleDisconnect = (reason: string) => {
      // A manual disconnect (unmount) should read as "closed", not an error.
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
      // Server rejected the join (not a member / suspended). Non-fatal for the
      // REST-backed tabs; surface a soft error state.
      // eslint-disable-next-line no-console
      console.info("[rt/user] group:error", err);
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

export default useGroupSocket;
