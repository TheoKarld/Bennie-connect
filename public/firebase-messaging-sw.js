/* eslint-disable no-undef */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firebase Cloud Messaging background service worker.
 *
 * HARD REQUIREMENT: this file contains NO hard-coded Firebase keys. It reads its
 * public config from the query params on its own registration URL (see
 * `src/lib/firebase.ts` -> registerMessagingSW), which keeps this static,
 * publicly-fetchable asset key-free and identical across environments.
 *
 * Uses the Firebase *compat* CDN bundles (pinned) because a classic service
 * worker cannot use ES module imports. Version is pinned to match the app's
 * `firebase` dependency major line.
 */

importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);

// --- Read public config off this worker's own URL ---------------------------
const params = new URL(self.location).searchParams;
const cfg = {
  apiKey: params.get("apiKey") || undefined,
  authDomain: params.get("authDomain") || undefined,
  projectId: params.get("projectId") || undefined,
  messagingSenderId: params.get("messagingSenderId") || undefined,
  appId: params.get("appId") || undefined,
};

// Only initialize when the essentials are present — degrade to a no-op SW
// otherwise (no console noise, no crash).
if (cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId) {
  try {
    firebase.initializeApp(cfg);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      const data = payload.data || {};
      const title = notification.title || data.title || "Bennie Connect";
      const options = {
        body: notification.body || data.message || "",
        icon: notification.icon || data.icon || "/ben_logo.png",
        badge: "/ben_logo.png",
        data: {
          // Deep-link the click handler opens. Support several common keys.
          link: data.link || data.url || (notification && notification.click_action) || "/",
          ...data,
        },
      };
      self.registration.showNotification(title, options);
    });
  } catch (err) {
    // Never let SW init crash silently take down push — just log.
    // eslint-disable-next-line no-console
    console.warn("[firebase-sw] init failed:", err);
  }
}

// --- Click handler: focus an existing tab or open the deep link -------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link =
    (event.notification.data && event.notification.data.link) || "/";
  const targetUrl = new URL(link, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          // If a tab on the same origin is already open, focus it and navigate.
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client && link && link !== "/") {
              return client.navigate(targetUrl).catch(() => undefined);
            }
            return undefined;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
