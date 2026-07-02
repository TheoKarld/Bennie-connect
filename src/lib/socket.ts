/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plane-agnostic socket.io client factory.
 *
 * The backend exposes two namespaces on the SAME origin as the REST API but
 * WITHOUT the `/api/v1` suffix:
 *   - `/rt/user`   (user access token)
 *   - `/rt/admin`  (admin access token)
 *
 * This factory does not hard-code a namespace — the caller supplies it plus a
 * `getToken` accessor. That keeps the module reusable by both the user store
 * and the (later) admin store without duplication.
 *
 * The access token is attached on every (re)connect via `auth.token` and is
 * re-read from `getToken()` each time, so a token refreshed by the HTTP layer is
 * picked up on the next reconnect handshake.
 */

import { io, type Socket } from "socket.io-client";

/**
 * Derive the socket.io origin from the REST base URL by stripping the trailing
 * `/api/v1` (and any trailing slash). e.g.
 *   http://localhost:5566/api/v1  ->  http://localhost:5566
 */
export function getSocketOrigin(): string {
  const apiUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    "http://localhost:5566/api/v1";
  return apiUrl.replace(/\/api\/v\d+\/?$/i, "").replace(/\/$/, "");
}

export interface RealtimeSocketOptions {
  /** e.g. "/rt/user" or "/rt/admin". */
  namespace: string;
  /** Returns the current access token (or null when signed out). */
  getToken: () => string | null;
}

/**
 * Create a configured (but NOT yet connected) socket.io client for a namespace.
 * Caller controls lifecycle: call `.connect()` to open, `.disconnect()` to close.
 *
 * - `auth` is a function so socket.io re-reads the freshest token on each
 *   (re)connect handshake.
 * - `withCredentials` matches the credentialed CORS policy (httpOnly cookies).
 * - Reconnection is on with sane backoff; failures surface via `connect_error`.
 */
export function createRealtimeSocket({
  namespace,
  getToken,
}: RealtimeSocketOptions): Socket {
  const origin = getSocketOrigin();

  const socket = io(`${origin}${namespace}`, {
    // Do not connect until the caller explicitly opens it.
    autoConnect: false,
    withCredentials: true,
    // Re-read the token on every (re)connect handshake.
    auth: (cb: (data: Record<string, unknown>) => void) => {
      cb({ token: getToken() ?? "" });
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 12000,
    transports: ["websocket", "polling"],
  });

  return socket;
}

export type { Socket } from "socket.io-client";
