/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface FieldProps {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

/** Labelled form field wrapper with optional hint / error text. */
export default function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = "",
}: FieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-xs font-semibold uppercase tracking-wider text-[#5C6460]"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[#9AA29D]">{hint}</p>
      ) : null}
    </div>
  );
}
