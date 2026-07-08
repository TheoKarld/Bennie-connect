/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShieldAlert } from "lucide-react";

/** Placeholder for the future admin/ops portal (owned by admin-dev). */
export default function AdminHome() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-border bg-surface/70 p-10 text-center shadow-sm">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center text-[#a6701c] dark:text-accent">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-semibold text-ink">
          Admin — coming soon
        </h2>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          The cooperative administration &amp; operations console is under
          construction. User &amp; KYC management, financial settlements, content
          management and analytics will live here.
        </p>
      </div>
    </div>
  );
}
