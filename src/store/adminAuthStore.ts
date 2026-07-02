/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from "zustand";

import adminAuthService from "../services/adminAuth.service";
import storage from "../lib/storage";
import { permissionMatches } from "../lib/adminPermissions";
import type {
  AdminAuthStatus,
  AdminChangePasswordPayload,
  AdminLoginPayload,
  AdminUser,
} from "../types/admin";

/**
 * Admin-plane auth store (zustand). Fully independent of the user `authStore`.
 *
 * Persisted explicitly via `src/lib/storage` under `adminToken` (access token)
 * + `adminData` (admin profile JSON). The refresh token is NOT stored in JS —
 * it lives in the httpOnly `bennie_admin_rt` cookie sent on `withCredentials`
 * requests. No zustand `persist` middleware.
 *
 * The initial in-memory state is seeded from storage so a reload keeps the
 * admin signed in until `hydrate()` re-validates against GET /auth/me.
 */

interface AdminAuthState {
  admin: AdminUser | null;
  accessToken: string | null;
  status: AdminAuthStatus;
  effectivePermissions: string[];
  mustChangePassword: boolean;
  error: string | null;
}

interface AdminAuthActions {
  login: (payload: AdminLoginPayload) => Promise<AdminUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** On entering the admin shell: GET /auth/me to (re)hydrate. */
  hydrate: () => Promise<void>;
  changePassword: (payload: AdminChangePasswordPayload) => Promise<void>;
  /** RBAC selector: exact / `resource:*` / `*` match over effective perms. */
  hasPermission: (perm: string) => boolean;
  clearError: () => void;
}

export type AdminAuthStore = AdminAuthState & AdminAuthActions;

/** Map admin auth error codes / API messages to friendly copy. */
function extractAdminError(err: unknown, fallback: string): string {
  const anyErr = err as {
    response?: {
      status?: number;
      data?: {
        message?: string | string[];
        error?: { code?: string; message?: string };
      };
    };
    message?: string;
  };
  const code = anyErr?.response?.data?.error?.code;
  const byCode: Record<string, string> = {
    ADMIN_AUTH_001: "Invalid email or password.",
    ADMIN_AUTH_002: "Account locked after too many attempts. Try again shortly.",
    ADMIN_AUTH_003: "Your current password is incorrect.",
    ADMIN_AUTH_004: "This admin account has been banned.",
    ADMIN_AUTH_005: "This admin account has been deactivated.",
    ADMIN_AUTH_006: "You don't have permission to do that.",
    ADMIN_AUTH_007: "Please change your password to continue.",
    ADMIN_AUTH_008: "Sign-in is not allowed from this network.",
    ADMIN_AUTH_009: "A valid two-factor code is required.",
    ADMIN_AUTH_010: "Your session has expired. Please sign in again.",
    ADMIN_AUTH_011: "That password doesn't meet the security policy.",
    ADMIN_AUTH_012: "Too many attempts. Please slow down and retry.",
  };
  if (code && byCode[code]) return byCode[code];

  const apiMsg =
    anyErr?.response?.data?.error?.message ?? anyErr?.response?.data?.message;
  if (Array.isArray(apiMsg)) return apiMsg.join(", ");
  if (typeof apiMsg === "string" && apiMsg) return apiMsg;
  if (anyErr?.message) return anyErr.message;
  return fallback;
}

/** Normalise either identity payload shape into a permission list. */
function permsFrom(admin: AdminUser): string[] {
  if (admin.effectivePermissions && admin.effectivePermissions.length) {
    return admin.effectivePermissions;
  }
  return admin.role?.permissions ?? [];
}

function initialState(): AdminAuthState {
  const token = storage.getAdminToken();
  const admin = storage.getAdminData<AdminUser>();
  return {
    admin: admin ?? null,
    accessToken: token,
    status: token ? "idle" : "unauthenticated",
    effectivePermissions: admin ? permsFrom(admin) : [],
    mustChangePassword: admin?.mustChangePassword ?? false,
    error: null,
  };
}

function persistSession(admin: AdminUser, accessToken: string): void {
  storage.setAdminToken(accessToken);
  storage.setAdminData(admin);
}

export const useAdminAuthStore = create<AdminAuthStore>()((set, get) => ({
  ...initialState(),

  login: async (payload) => {
    set({ status: "loading", error: null });
    try {
      const data = await adminAuthService.login(payload);
      persistSession(data.admin, data.accessToken);
      set({
        admin: data.admin,
        accessToken: data.accessToken,
        effectivePermissions: permsFrom(data.admin),
        mustChangePassword: data.admin.mustChangePassword,
        status: "authenticated",
        error: null,
      });
      return data.admin;
    } catch (err) {
      set({
        status: "unauthenticated",
        error: extractAdminError(err, "Sign-in failed. Check your credentials."),
      });
      throw err;
    }
  },

  logout: async () => {
    await adminAuthService.logout();
    storage.clearAdmin();
    set({
      admin: null,
      accessToken: null,
      effectivePermissions: [],
      mustChangePassword: false,
      status: "unauthenticated",
      error: null,
    });
  },

  refresh: async () => {
    try {
      const data = await adminAuthService.refresh();
      if (data?.accessToken) storage.setAdminToken(data.accessToken);
      set({ accessToken: data.accessToken, status: "authenticated" });
    } catch {
      storage.clearAdmin();
      set({
        admin: null,
        accessToken: null,
        effectivePermissions: [],
        mustChangePassword: false,
        status: "unauthenticated",
      });
    }
  },

  hydrate: async () => {
    const token = get().accessToken ?? storage.getAdminToken();
    if (!token) {
      set({ status: "unauthenticated" });
      return;
    }
    set({ status: "loading" });
    try {
      const admin = await adminAuthService.me();
      storage.setAdminData(admin);
      set({
        admin,
        accessToken: token,
        effectivePermissions: permsFrom(admin),
        mustChangePassword: admin.mustChangePassword,
        status: "authenticated",
      });
    } catch {
      storage.clearAdmin();
      set({
        admin: null,
        accessToken: null,
        effectivePermissions: [],
        mustChangePassword: false,
        status: "unauthenticated",
      });
    }
  },

  changePassword: async (payload) => {
    await adminAuthService.changePassword(payload);
    // Clearing the flag locally; re-hydrate to pick up fresh server state.
    set({ mustChangePassword: false });
    try {
      const admin = await adminAuthService.me();
      storage.setAdminData(admin);
      set({
        admin,
        effectivePermissions: permsFrom(admin),
        mustChangePassword: admin.mustChangePassword,
        status: "authenticated",
      });
    } catch {
      // Non-fatal: the flag is cleared; hydrate will run on next shell entry.
    }
  },

  hasPermission: (perm) => permissionMatches(get().effectivePermissions, perm),

  clearError: () => set({ error: null }),
}));
