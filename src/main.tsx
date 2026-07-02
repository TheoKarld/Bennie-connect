/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";

import App from "./App.tsx";
import { useAuthStore } from "./store/authStore";
import storage from "./lib/storage";
import "./index.css";

// Guard against an empty client id so GoogleOAuthProvider never throws.
const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || "";

// One-time cleanup of the legacy `bennie_auth` session blob.
storage.migrateLegacyStorage();

// On startup, if a persisted token exists, hydrate the session via GET /auth/me.
useAuthStore.getState().hydrate();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </BrowserRouter>
  </StrictMode>
);
