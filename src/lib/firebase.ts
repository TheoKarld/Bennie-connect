/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Firebase Cloud Messaging (web push) — plane-agnostic client helper.
 *
 * This module is intentionally *shared* by both the user and admin frontends:
 * it holds no plane-specific logic. It only turns the browser's Notification
 * permission + a service worker into an FCM registration token that the caller
 * (a notification store) then POSTs to its own `/device-tokens` endpoint.
 *
 * Hard requirements honoured here:
 *  - Everything degrades gracefully. With no `VITE_FIREBASE_*` env, or in an
 *    unsupported browser, or when permission is denied, every export is a
 *    logged no-op that returns `null`/does nothing — it NEVER throws.
 *  - The service worker is registered from `/firebase-messaging-sw.js` with the
 *    public config passed as QUERY PARAMS (see PRD: the SW file itself is
 *    key-free and reads its config off its own URL).
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
  type MessagePayload,
} from "firebase/messaging";

// --- Public client config (non-secret; shipped in the bundle by design) ------

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
    | string
    | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

/** True only when every required client value is present. */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      VAPID_KEY
  );
}

// --- One-time "not configured" warning ---------------------------------------

let warnedMissingConfig = false;
function warnMissingConfigOnce(): void {
  if (warnedMissingConfig) return;
  warnedMissingConfig = true;
  // eslint-disable-next-line no-console
  console.info(
    "[firebase] VITE_FIREBASE_* env not fully set — web push disabled (in-app socket bell still works)."
  );
}

// --- Lazy singletons ---------------------------------------------------------

let appInstance: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;
let supportPromise: Promise<boolean> | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (appInstance) return appInstance;
  try {
    appInstance = getApps().length
      ? getApp()
      : initializeApp(firebaseConfig as Record<string, string>);
    return appInstance;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[firebase] initializeApp failed:", err);
    return null;
  }
}

/** Memoized `isSupported()` — Push/Service-Worker availability check. */
function checkSupported(): Promise<boolean> {
  if (!supportPromise) {
    supportPromise = isSupported()
      .then((ok) => ok && typeof navigator !== "undefined" && "serviceWorker" in navigator)
      .catch(() => false);
  }
  return supportPromise;
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  const supported = await checkSupported();
  if (!supported) return null;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[firebase] getMessaging failed:", err);
    return null;
  }
}

// --- Service worker registration (query-param config strategy) ---------------

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function registerMessagingSW(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistrationPromise) return swRegistrationPromise;

  swRegistrationPromise = (async () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return null;
    }
    // Pass public config as query params so the SW file stays key-free.
    const params = new URLSearchParams({
      apiKey: firebaseConfig.apiKey ?? "",
      authDomain: firebaseConfig.authDomain ?? "",
      projectId: firebaseConfig.projectId ?? "",
      messagingSenderId: firebaseConfig.messagingSenderId ?? "",
      appId: firebaseConfig.appId ?? "",
    });
    try {
      return await navigator.serviceWorker.register(
        `/firebase-messaging-sw.js?${params.toString()}`,
        { scope: "/" }
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[firebase] service worker registration failed:", err);
      return null;
    }
  })();

  return swRegistrationPromise;
}

// --- Public API --------------------------------------------------------------

/**
 * Request permission + register the SW + fetch the FCM registration token.
 * Returns the token string, or `null` if unsupported / denied / misconfigured.
 * Never throws.
 */
export async function getFcmToken(): Promise<string | null> {
  if (!isFirebaseConfigured()) {
    warnMissingConfigOnce();
    return null;
  }

  if (typeof Notification === "undefined") return null;

  const supported = await checkSupported();
  if (!supported) return null;

  try {
    // Ask for permission (no-op if already granted; returns "denied"/"default" otherwise).
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return null;

    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const registration = await registerMessagingSW();
    if (!registration) return null;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[firebase] getFcmToken failed:", err);
    return null;
  }
}

/**
 * Subscribe to foreground FCM messages (tab focused). Returns an unsubscribe
 * function. When unsupported/misconfigured it wires nothing and returns a no-op
 * unsubscribe so callers can always call it in an effect cleanup.
 */
export function onForegroundMessage(
  cb: (payload: MessagePayload) => void
): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;

  void (async () => {
    const messaging = await getMessagingInstance();
    if (!messaging || cancelled) return;
    try {
      unsub = onMessage(messaging, cb);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[firebase] onMessage subscription failed:", err);
    }
  })();

  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

/** The current browser Notification permission, guarded for unsupported envs. */
export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}
