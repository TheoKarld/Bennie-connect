/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import adminApi from "../lib/adminApi";
import type {
  AdminChangePasswordPayload,
  AdminLoginPayload,
  AdminLoginResponseData,
  AdminMeResponseData,
  AdminUser,
  DashboardOverview,
} from "../types/admin";

/**
 * Thin wrappers over the live admin backend (base `/api/v1/admin`).
 * Success envelope: `{ success, message?, data }`. Each helper unwraps `.data`.
 *
 * The admin refresh token is NOT in the body — it is an httpOnly cookie
 * (`bennie_admin_rt`); `refresh()`/`logout()` send no body and rely on
 * `withCredentials` (set on the shared `adminApi` instance).
 */

interface Envelope<T> {
  success?: boolean;
  message?: string;
  data: T;
}

function unwrap<T>(res: { data: Envelope<T> | T }): T {
  const body = res.data as Envelope<T> & Partial<{ data: T }>;
  if (body && typeof body === "object" && "data" in body && body.data != null) {
    return body.data as T;
  }
  return res.data as T;
}

export const adminAuthService = {
  async login(payload: AdminLoginPayload): Promise<AdminLoginResponseData> {
    const res = await adminApi.post("/auth/login", payload);
    return unwrap<AdminLoginResponseData>(res);
  },

  /** Rotate tokens via the httpOnly cookie. Returns the new access token. */
  async refresh(): Promise<{ accessToken: string; expiresIn?: number }> {
    const res = await adminApi.post("/auth/refresh");
    return unwrap<{ accessToken: string; expiresIn?: number }>(res);
  },

  async me(): Promise<AdminUser> {
    const res = await adminApi.get("/auth/me");
    const data = unwrap<AdminMeResponseData>(res);
    return data.admin;
  },

  async changePassword(payload: AdminChangePasswordPayload): Promise<void> {
    await adminApi.patch("/auth/change-password", payload);
  },

  async logout(): Promise<void> {
    try {
      await adminApi.post("/auth/logout");
    } catch {
      // Best-effort; the client session is cleared regardless.
    }
  },

  async getDashboardOverview(range?: "7d" | "30d"): Promise<DashboardOverview> {
    const res = await adminApi.get("/dashboard/overview", {
      params: range ? { range } : undefined,
    });
    return unwrap<DashboardOverview>(res);
  },
};

export default adminAuthService;
