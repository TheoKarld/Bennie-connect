/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SHARED, idempotent Google Maps JS API loader.
 *
 * Reads `VITE_GOOGLE_MAPS_API_KEY` and injects the Maps JS script exactly once,
 * returning a cached promise for `google.maps`. Safe to call from many
 * components / both frontends (user equipment tracking + the later admin fleet
 * oversight) — concurrent callers share the single in-flight load.
 *
 * GRACEFUL by design:
 *   - No key configured  -> rejects with a clear `MapsUnavailableError` so the
 *     UI can render a "map unavailable — set VITE_GOOGLE_MAPS_API_KEY"
 *     placeholder. It never throws at import time and never crashes the app.
 *   - Script load failure -> rejects with `MapsUnavailableError` and resets the
 *     cache so a later retry can re-attempt.
 *
 * Admin-dev: reuse this module as-is. Do NOT add a second Maps <script> loader;
 * two loads of the Maps JS API on one page throw. Call `loadGoogleMaps()` and
 * `isMapsConfigured()` from the admin equipment screens.
 */

// Minimal ambient typing so we don't require @types/google.maps to be installed.
// Components that need richer typing can cast the returned namespace.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window {
    google?: { maps?: any };
    __bennieMapsCallback__?: () => void;
  }
}

/** Error thrown when Maps cannot load (no key, or script failed). */
export class MapsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapsUnavailableError";
  }
}

const CALLBACK_NAME = "__bennieMapsCallback__";
const SCRIPT_ID = "bennie-google-maps-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadPromise: Promise<any> | null = null;

/** The configured Maps browser key (may be empty). */
export function getMapsApiKey(): string {
  return ((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? "")
    .trim();
}

/** True when a Maps API key is present in the environment. */
export function isMapsConfigured(): boolean {
  return getMapsApiKey().length > 0;
}

/**
 * Load the Google Maps JS API once and resolve with the `google.maps`
 * namespace. Rejects with `MapsUnavailableError` when no key is set or the
 * script cannot load.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadGoogleMaps(): Promise<any> {
  // Already available on the window (e.g. a previous successful load).
  if (typeof window !== "undefined" && window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (loadPromise) return loadPromise;

  const key = getMapsApiKey();
  if (!key) {
    // Do not cache this rejection — a later config change + retry should work.
    return Promise.reject(
      new MapsUnavailableError(
        "Google Maps is unavailable — set VITE_GOOGLE_MAPS_API_KEY."
      )
    );
  }

  loadPromise = new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new MapsUnavailableError("Google Maps requires a browser."));
      return;
    }

    // A script tag may already exist (HMR / a prior partial load).
    const existing = document.getElementById(
      SCRIPT_ID
    ) as HTMLScriptElement | null;

    const fail = (msg: string) => {
      loadPromise = null; // allow a future retry
      reject(new MapsUnavailableError(msg));
    };

    window[CALLBACK_NAME] = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        fail("Google Maps loaded without the maps namespace.");
      }
    };

    if (existing) {
      // Someone already started loading; if maps is ready, resolve, else wait
      // for the shared callback above.
      if (window.google?.maps) resolve(window.google.maps);
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&libraries=marker&loading=async&callback=${CALLBACK_NAME}`;
    script.onerror = () => fail("Failed to load the Google Maps script.");
    document.head.appendChild(script);
  });

  return loadPromise;
}

export default loadGoogleMaps;
