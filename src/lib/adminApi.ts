/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";

import storage from "./storage";

/**
 * Dedicated axios instance for the Bennie-connect ADMIN plane.
 *
 * This is a SEPARATE instance from `lib/api.ts` (the user plane) so the two
 * dual sessions never bleed into each other. Base URL is the user API base
 * plus the `/admin` segment (`<VITE_API_URL>/admin`).
 *
 * Hybrid dual-session model (admin):
 * - The ACCESS token is read from localStorage via `storage.getAdminToken()`
 *   and attached as `Authorization: Bearer <token>` on each request.
 * - The REFRESH token is an httpOnly cookie (`bennie_admin_rt`) invisible to
 *   JS, so `withCredentials: true` is set to send it with `/admin/auth/*`.
 * - On a 401 (non-auth route) the interceptor calls POST /admin/auth/refresh
 *   once (bare axios, `withCredentials`, no body), saves the new access token,
 *   and retries. On failure it clears the admin session and routes the SPA to
 *   `/bennie/auth`.
 */

const USER_API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "http://localhost:5566/api/v1";

/** Admin base = user base + `/admin`. */
export const ADMIN_API_URL = `${USER_API_URL}/admin`;

export const adminApi: AxiosInstance = axios.create({
  baseURL: ADMIN_API_URL,
  headers: { "Content-Type": "application/json" },
  // Send the httpOnly admin refresh-token cookie on cross-origin requests.
  withCredentials: true,
});

adminApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = storage.getAdminToken();
  if (token) {
    config.headers.set?.("Authorization", `Bearer ${token}`);
  }
  return config;
});

// Track a single in-flight refresh so concurrent 401s share one attempt.
let refreshPromise: Promise<string | null> | null = null;

/**
 * Exchange the httpOnly admin refresh cookie for a fresh access token.
 * Uses bare axios (not `adminApi`) to avoid recursive interceptor handling and
 * sends no body — the backend reads the `bennie_admin_rt` cookie.
 */
async function performAdminRefresh(): Promise<string | null> {
  try {
    const res = await axios.post(`${ADMIN_API_URL}/auth/refresh`, undefined, {
      withCredentials: true,
    });
    const data = res.data?.data ?? res.data;
    const newAccess: string | undefined = data?.accessToken;
    if (!newAccess) return null;
    storage.setAdminToken(newAccess);
    return newAccess;
  } catch {
    return null;
  }
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Redirect helper. We avoid importing the router here (this module is imported
 * by the store) and instead do a hard location change to the admin sign-in.
 * Guarded so an already-on-auth page doesn't loop.
 */
function routeToAdminAuth(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path.startsWith("/bennie/auth")) return;
  const dest = `/bennie/auth?from=${encodeURIComponent(
    path + window.location.search
  )}`;
  window.location.assign(dest);
}

adminApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const isAuthRoute =
      typeof original?.url === "string" &&
      (original.url.includes("/auth/login") ||
        original.url.includes("/auth/refresh"));

    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = performAdminRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.set?.("Authorization", `Bearer ${newToken}`);
        return adminApi(original);
      }
      // Refresh failed: drop the admin session and send to sign-in.
      storage.clearAdmin();
      routeToAdminAuth();
    }

    return Promise.reject(error);
  }
);

export default adminApi;
