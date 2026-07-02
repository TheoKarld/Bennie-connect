/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import { useAdminAuth } from "../hooks/useAdminAuth";
import storage from "../lib/storage";
import Spinner from "../components/ui/Spinner";
import { Button } from "../components/ui";

/**
 * Gates the /bennie/* shell (independent of any user session).
 *
 * Flow:
 *  1. If no admin token is present at all → redirect to /bennie/auth,
 *     preserving the intended destination.
 *  2. Otherwise hydrate once via GET /auth/me (asserts admin scope + resolves
 *     effectivePermissions + mustChangePassword).
 *  3. While hydrating → spinner. On failure → retriable error (not a blank
 *     screen). On success:
 *       - mustChangePassword === true → force /bennie/change-password.
 *       - else render the shell.
 */
export default function AdminProtectedRoute() {
  const location = useLocation();
  const { status, mustChangePassword, hydrate } = useAdminAuth();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  const hasToken = !!storage.getAdminToken();

  const runHydrate = () => {
    setFailed(false);
    hydrate().catch(() => setFailed(true));
  };

  useEffect(() => {
    if (!hasToken) return;
    if (ran.current) return;
    ran.current = true;
    runHydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  // No admin session at all → sign-in.
  if (!hasToken && status !== "authenticated") {
    return (
      <Navigate
        to="/bennie/auth"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // Retriable hydration error (backend unreachable / me() failed).
  if (failed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] px-6">
        <div className="max-w-sm rounded-3xl border border-[#E6E5DF] bg-white p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </span>
          <h2 className="font-display text-lg font-semibold text-[#1A2421]">
            Couldn't load your session
          </h2>
          <p className="mt-1.5 text-sm text-[#5C6460]">
            We couldn't reach the admin service. Check your connection and try
            again.
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              ran.current = false;
              runHydrate();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Hydrating.
  if (status === "loading" || status === "idle") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5]">
        <Spinner size={36} label="Loading admin console…" />
      </div>
    );
  }

  // Rejected token / refresh failure.
  if (status !== "authenticated") {
    return (
      <Navigate
        to="/bennie/auth"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // Forced password change lock.
  if (mustChangePassword) {
    return <Navigate to="/bennie/change-password" replace />;
  }

  return <Outlet />;
}
