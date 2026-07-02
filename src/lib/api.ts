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
 * Shared axios instance for the Bennie-connect backend (user plane).
 * Base URL comes from VITE_API_URL (see .env.local).
 *
 * Hybrid dual-session model:
 * - The ACCESS token is read from localStorage via `storage.getUserToken()` and
 *   attached as `Authorization: Bearer <token>` on each request.
 * - The REFRESH token is an httpOnly cookie (`bennie_user_rt`, path
 *   `/api/v1/auth`). It is never visible to JS, so `withCredentials: true` is
 *   set so the browser sends it with `/auth/refresh` and `/auth/logout`.
 * - On a 401 (non-auth route) the interceptor calls POST /auth/refresh once
 *   (bare axios, `withCredentials`, no body), saves the new access token, and
 *   retries. On failure it clears the user session so guards route to /login.
 */

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "http://localhost:5566/api/v1";

// --- Axios instance ----------------------------------------------------------

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  // Send the httpOnly refresh-token cookie with cross-origin requests.
  withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = storage.getUserToken();
  if (token) {
    config.headers.set?.("Authorization", `Bearer ${token}`);
  }
  return config;
});

// Track a single in-flight refresh so concurrent 401s share one attempt.
let refreshPromise: Promise<string | null> | null = null;

/**
 * Exchange the httpOnly refresh cookie for a fresh access token.
 * Uses bare axios (not `api`) to avoid recursive interceptor handling, and
 * sends no body — the backend reads the `bennie_user_rt` cookie.
 */
async function performRefresh(): Promise<string | null> {
  try {
    const res = await axios.post(
      `${API_URL}/auth/refresh`,
      undefined,
      { withCredentials: true }
    );
    const data = res.data?.data ?? res.data;
    const newAccess: string | undefined = data?.accessToken;
    if (!newAccess) return null;
    storage.setUserToken(newAccess);
    return newAccess;
  } catch {
    return null;
  }
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const isAuthRoute =
      typeof original?.url === "string" &&
      (original.url.includes("/auth/login") ||
        original.url.includes("/auth/register") ||
        original.url.includes("/auth/refresh") ||
        original.url.includes("/auth/google"));

    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = performRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.set?.("Authorization", `Bearer ${newToken}`);
        return api(original);
      }
      // Refresh failed: drop the session so guards send the user to /login.
      storage.clearUser();
    }

    return Promise.reject(error);
  }
);

export default api;
