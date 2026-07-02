/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from "zustand";

import { AuthStatus, AuthUser } from "../types";
import authService, {
  LoginPayload,
  RegisterPayload,
} from "../services/auth.service";
import storage from "../lib/storage";

/**
 * Global auth store (zustand) for the end-user plane.
 *
 * Hybrid dual-session model: the session is persisted explicitly via
 * `src/lib/storage` under `userToken` (access token string) + `userData`
 * (user profile JSON). The refresh token is NOT stored in JS — it lives in the
 * httpOnly `bennie_user_rt` cookie, sent automatically on `withCredentials`
 * requests. There is no zustand `persist` middleware here, so nothing writes
 * the old `bennie_auth` blob anymore.
 *
 * The initial in-memory state is seeded from storage so a page reload keeps the
 * user logged in until `hydrate()` re-validates against GET /auth/me.
 */

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: AuthStatus;
  error: string | null;
}

interface AuthActions {
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  loginWithGoogle: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** On app load: if a token exists, GET /auth/me to hydrate the user. */
  hydrate: () => Promise<void>;
}

export type AuthStore = AuthState & AuthActions;

function extractError(err: unknown, fallback: string): string {
  const anyErr = err as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const apiMsg = anyErr?.response?.data?.message;
  if (Array.isArray(apiMsg)) return apiMsg.join(", ");
  if (typeof apiMsg === "string") return apiMsg;
  if (anyErr?.message) return anyErr.message;
  return fallback;
}

/** Seed the initial store from persisted storage (survives reloads). */
function initialState(): AuthState {
  const token = storage.getUserToken();
  const user = storage.getUserData<AuthUser>();
  return {
    user: user ?? null,
    accessToken: token,
    status: token ? "idle" : "unauthenticated",
    error: null,
  };
}

/** Persist a successful session (access token + user) to storage. */
function persistSession(user: AuthUser, accessToken: string): void {
  storage.setUserToken(accessToken);
  storage.setUserData(user);
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  ...initialState(),

  login: async (payload) => {
    set({ status: "loading", error: null });
    try {
      const data = await authService.login(payload);
      persistSession(data.user, data.accessToken);
      set({
        user: data.user,
        accessToken: data.accessToken,
        status: "authenticated",
        error: null,
      });
    } catch (err) {
      set({
        status: "unauthenticated",
        error: extractError(err, "Login failed. Check your credentials."),
      });
      throw err;
    }
  },

  register: async (payload) => {
    set({ status: "loading", error: null });
    try {
      const data = await authService.register(payload);
      persistSession(data.user, data.accessToken);
      set({
        user: data.user,
        accessToken: data.accessToken,
        status: "authenticated",
        error: null,
      });
    } catch (err) {
      set({
        status: "unauthenticated",
        error: extractError(err, "Registration failed. Please try again."),
      });
      throw err;
    }
  },

  loginWithGoogle: async (accessToken) => {
    set({ status: "loading", error: null });
    try {
      const data = await authService.loginWithGoogle(accessToken);
      persistSession(data.user, data.accessToken);
      set({
        user: data.user,
        accessToken: data.accessToken,
        status: "authenticated",
        error: null,
      });
    } catch (err) {
      set({
        status: "unauthenticated",
        error: extractError(err, "Google sign-in failed."),
      });
      throw err;
    }
  },

  logout: async () => {
    // Best-effort: clears the httpOnly refresh cookie on the backend.
    await authService.logout();
    storage.clearUser();
    set({
      user: null,
      accessToken: null,
      status: "unauthenticated",
      error: null,
    });
  },

  refresh: async () => {
    try {
      // Uses the httpOnly refresh cookie; no token passed from JS.
      const data = await authService.refresh();
      persistSession(data.user, data.accessToken);
      set({
        user: data.user,
        accessToken: data.accessToken,
        status: "authenticated",
      });
    } catch {
      storage.clearUser();
      set({
        user: null,
        accessToken: null,
        status: "unauthenticated",
      });
    }
  },

  hydrate: async () => {
    const token = get().accessToken ?? storage.getUserToken();
    if (!token) {
      set({ status: "unauthenticated" });
      return;
    }
    set({ status: "loading" });
    try {
      const fresh = await authService.me();
      storage.setUserData(fresh);
      set({ user: fresh, accessToken: token, status: "authenticated" });
    } catch {
      // Token invalid / backend unreachable: drop to unauthenticated so the
      // app renders /login instead of hanging on a splash.
      storage.clearUser();
      set({
        user: null,
        accessToken: null,
        status: "unauthenticated",
      });
    }
  },
}));
