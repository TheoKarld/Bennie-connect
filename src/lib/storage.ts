/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hardened localStorage wrapper for the hybrid dual-session model.
 *
 * The app runs two independent sessions in the same browser:
 *   - the end-user plane  -> keys `userToken`  + `userData`
 *   - the admin plane      -> keys `adminToken` + `adminData`
 *
 * Only the ACCESS token (a short-lived string) and the profile JSON are kept in
 * localStorage. Refresh tokens are NEVER stored in JS — they live in httpOnly
 * cookies (`bennie_user_rt`, path `/api/v1/auth`) that the browser attaches on
 * `withCredentials` requests. This keeps the refresh token out of reach of XSS.
 *
 * Every accessor is wrapped in try/catch so a disabled/quota-full localStorage
 * (Safari private mode, embedded webviews) degrades to "no session" rather than
 * throwing at import time.
 */

// --- Keys --------------------------------------------------------------------

export const STORAGE_KEYS = {
  userToken: "userToken",
  userData: "userData",
  adminToken: "adminToken",
  adminData: "adminData",
} as const;

/** Legacy zustand-persist key removed on load (was `{ user, accessToken, refreshToken, status }`). */
const LEGACY_AUTH_KEY = "bennie_auth";

// --- Low-level primitives ----------------------------------------------------

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / disabled storage */
  }
}

function removeRaw(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readJSON<T>(key: string): T | null {
  const raw = readRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON<T>(key: string, value: T): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    /* ignore serialization errors */
  }
}

// --- User plane --------------------------------------------------------------

function getUserToken(): string | null {
  return readRaw(STORAGE_KEYS.userToken);
}

function setUserToken(token: string): void {
  writeRaw(STORAGE_KEYS.userToken, token);
}

function getUserData<T = unknown>(): T | null {
  return readJSON<T>(STORAGE_KEYS.userData);
}

function setUserData<T = unknown>(data: T): void {
  writeJSON(STORAGE_KEYS.userData, data);
}

function clearUser(): void {
  removeRaw(STORAGE_KEYS.userToken);
  removeRaw(STORAGE_KEYS.userData);
}

// --- Admin plane -------------------------------------------------------------

function getAdminToken(): string | null {
  return readRaw(STORAGE_KEYS.adminToken);
}

function setAdminToken(token: string): void {
  writeRaw(STORAGE_KEYS.adminToken, token);
}

function getAdminData<T = unknown>(): T | null {
  return readJSON<T>(STORAGE_KEYS.adminData);
}

function setAdminData<T = unknown>(data: T): void {
  writeJSON(STORAGE_KEYS.adminData, data);
}

function clearAdmin(): void {
  removeRaw(STORAGE_KEYS.adminToken);
  removeRaw(STORAGE_KEYS.adminData);
}

// --- Migration ---------------------------------------------------------------

/**
 * One-time cleanup of the legacy `bennie_auth` blob left by the old zustand
 * persist. Safe to call on every load; it only touches the legacy key.
 */
export function migrateLegacyStorage(): void {
  if (readRaw(LEGACY_AUTH_KEY) !== null) {
    removeRaw(LEGACY_AUTH_KEY);
  }
}

export const storage = {
  getUserToken,
  setUserToken,
  getUserData,
  setUserData,
  clearUser,
  getAdminToken,
  setAdminToken,
  getAdminData,
  setAdminData,
  clearAdmin,
  migrateLegacyStorage,
};

export default storage;
