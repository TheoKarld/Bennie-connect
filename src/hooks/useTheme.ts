/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Theme store/hook for the app's light / dark / system foundation.
 *
 * - `theme` is the user's *preference* ('light' | 'dark' | 'system').
 * - `resolvedTheme` is what actually renders ('light' | 'dark'), with 'system'
 *   resolved live against the OS `prefers-color-scheme` media query.
 *
 * The `.dark` class on <html> is the single source of truth for `dark:`
 * utilities and the CSS variable flip in index.css. This module keeps that
 * class in sync, persists the preference to localStorage (`bennie_theme`), and
 * subscribes to OS changes while in `system` mode. It is initialised to match
 * the no-flash <script> in index.html so there is never a mismatch on load.
 */

import { create } from "zustand";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "bennie_theme";

const isBrowser = typeof window !== "undefined";

const mediaQuery = (): MediaQueryList | null =>
  isBrowser && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function readStoredTheme(): Theme {
  if (!isBrowser) return "system";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return mediaQuery()?.matches ?? false;
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

/** Apply the resolved theme to <html> (class + color-scheme). */
function applyToDocument(resolved: ResolvedTheme): void {
  if (!isBrowser) return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: Theme) => void;
  /** Recompute resolvedTheme from the current preference (used on OS change). */
  syncSystem: () => void;
}

const initialTheme = readStoredTheme();

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  resolvedTheme: resolve(initialTheme),

  setTheme: (t) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    const resolved = resolve(t);
    applyToDocument(resolved);
    set({ theme: t, resolvedTheme: resolved });
  },

  syncSystem: () => {
    const { theme } = get();
    if (theme !== "system") return;
    const resolved = resolve("system");
    applyToDocument(resolved);
    set({ resolvedTheme: resolved });
  },
}));

// Keep the DOM in sync on module load (matches the no-flash script) and wire a
// single live listener for OS scheme changes while in `system` mode.
if (isBrowser) {
  applyToDocument(useThemeStore.getState().resolvedTheme);

  const mq = mediaQuery();
  if (mq) {
    const onChange = () => useThemeStore.getState().syncSystem();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
    } else if (typeof (mq as MediaQueryList).addListener === "function") {
      // Safari < 14 fallback.
      (mq as MediaQueryList).addListener(onChange);
    }
  }
}

export interface UseThemeReturn {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: Theme) => void;
}

/** Thin selector hook over the theme store. */
export function useTheme(): UseThemeReturn {
  const theme = useThemeStore((s) => s.theme);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return { theme, resolvedTheme, setTheme };
}

export default useTheme;
