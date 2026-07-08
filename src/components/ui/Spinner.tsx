/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

/** Brand-green loading spinner. */
export default function Spinner({ size = 24, className = "", label }: SpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <span
        className="inline-block animate-spin rounded-full border-[3px] border-primary/20 border-t-primary"
        style={{ width: size, height: size }}
        role="status"
        aria-label={label || "Loading"}
      />
      {label && (
        <span className="text-xs font-medium text-muted">{label}</span>
      )}
    </div>
  );
}
