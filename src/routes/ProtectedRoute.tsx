/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import Spinner from "../components/ui/Spinner";

/**
 * Gates the /app/* section. While the auth store is hydrating (status ===
 * "loading" or the initial "idle") it shows a spinner; once resolved it either
 * renders the nested routes (authenticated) or redirects to /login.
 */
export default function ProtectedRoute() {
  const { status } = useAuth();

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5]">
        <Spinner size={36} label="Loading your cooperative portal…" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
