/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

import { useAdminAuth } from "../../hooks/useAdminAuth";
import { hasAnyPermission } from "../../lib/adminPermissions";
import { Button } from "../ui";

/**
 * Deep-link protection for a section. Renders children only if the admin's
 * effective permissions satisfy ANY of `anyOf`; otherwise an in-shell 403
 * "no access to this section" panel (not a redirect loop).
 */
export default function PermissionGate({
  anyOf,
  children,
}: {
  anyOf: string[];
  children: React.ReactNode;
}) {
  const { effectivePermissions } = useAdminAuth();

  if (anyOf.length > 0 && !hasAnyPermission(effectivePermissions, anyOf)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-[#E6E5DF] bg-white/70 p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5C6460]/10 text-[#5C6460]">
            <Lock className="h-6 w-6" />
          </span>
          <h2 className="font-display text-lg font-semibold text-[#1A2421]">
            You don't have access to this section
          </h2>
          <p className="mt-1.5 text-sm text-[#5C6460]">
            Your role doesn't include permission to view this area. Contact a
            Super Admin if you believe this is a mistake.
          </p>
          <Link to="/bennie/dashboard">
            <Button className="mt-5" variant="secondary">
              Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
