/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import api from "../lib/api";
import { AuthResponseData, AuthUser } from "../types";

/**
 * Thin wrappers over the live backend auth endpoints (base /api/v1/auth).
 * Success envelope shape: { success, message?, data: { user, accessToken,
 * expiresIn } }. Each helper unwraps `.data`.
 *
 * The refresh token is NOT returned in the body — it is set as an httpOnly
 * cookie (`bennie_user_rt`). `refresh()` and `logout()` therefore send no body
 * and rely on `withCredentials` (configured on the shared `api` instance) so
 * the browser attaches that cookie.
 */

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** Nigerian phone in +234 format. Required by the backend RegisterDto. */
  phoneNumber: string;
  referralCode?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

/** Generic success envelope for the password-recovery endpoints. */
export interface SimpleResult {
  success: boolean;
  message: string;
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

function unwrap(res: { data: Envelope<AuthResponseData> | AuthResponseData }): AuthResponseData {
  const body = res.data as Envelope<AuthResponseData> & Partial<AuthResponseData>;
  // Support both the enveloped and bare shapes defensively.
  if (body && "data" in body && body.data) return body.data;
  return res.data as AuthResponseData;
}

export const authService = {
  async register(payload: RegisterPayload): Promise<AuthResponseData> {
    const res = await api.post("/auth/register", payload);
    return unwrap(res);
  },

  async login(payload: LoginPayload): Promise<AuthResponseData> {
    const res = await api.post("/auth/login", payload);
    return unwrap(res);
  },

  async loginWithGoogle(accessToken: string): Promise<AuthResponseData> {
    const res = await api.post("/auth/google", { accessToken });
    return unwrap(res);
  },

  async refresh(): Promise<AuthResponseData> {
    // No body: the backend reads the httpOnly `bennie_user_rt` cookie.
    // `api` already sets `withCredentials: true`.
    const res = await api.post("/auth/refresh");
    return unwrap(res);
  },

  async me(): Promise<AuthUser> {
    const res = await api.get("/auth/me");
    const body = res.data as Envelope<{ user: AuthUser }> | { user: AuthUser } | AuthUser;
    // /auth/me may return { data: { user } }, { user }, or the user directly.
    const withData = body as Envelope<{ user: AuthUser }>;
    if (withData && withData.data && withData.data.user) return withData.data.user;
    const withUser = body as { user?: AuthUser };
    if (withUser && withUser.user) return withUser.user;
    return body as AuthUser;
  },

  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } catch {
      // Logout is best-effort; the client session is cleared regardless.
    }
  },

  /**
   * Request a password-reset link. The backend always responds 200 with a
   * generic message (no account enumeration), so callers can show the same
   * confirmation regardless of whether the email exists.
   */
  async forgotPassword(email: string): Promise<SimpleResult> {
    const res = await api.post("/auth/forgot-password", { email });
    const body = res.data as Partial<SimpleResult>;
    return {
      success: body?.success ?? true,
      message: body?.message ?? "",
    };
  },

  /**
   * Complete a password reset with the emailed token. Resolves on 200; a 400
   * (invalid/expired token) rejects and is surfaced by the caller.
   */
  async resetPassword(token: string, password: string): Promise<SimpleResult> {
    const res = await api.post("/auth/reset-password", { token, password });
    const body = res.data as Partial<SimpleResult>;
    return {
      success: body?.success ?? true,
      message: body?.message ?? "",
    };
  },
};

export default authService;
