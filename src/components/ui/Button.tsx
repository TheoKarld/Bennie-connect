/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "accent";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[#135D39] text-white hover:bg-[#0f4c2f] shadow-md shadow-[#135D39]/15 disabled:bg-[#135D39]/50",
  accent:
    "bg-[#E7A13C] text-[#1A2421] hover:bg-[#d8912d] shadow-md shadow-[#E7A13C]/20 disabled:opacity-50",
  secondary:
    "bg-[#135D39]/8 text-[#135D39] hover:bg-[#135D39]/15 disabled:opacity-50",
  outline:
    "border border-[#135D39]/30 text-[#135D39] hover:bg-[#135D39]/5 disabled:opacity-50",
  ghost:
    "text-[#5C6460] hover:text-[#1A2421] hover:bg-[#135D39]/5 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "text-xs px-3 py-2",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-6 py-3",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className = "",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#135D39]/30 disabled:cursor-not-allowed ${
        VARIANTS[variant]
      } ${SIZES[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      )}
      {children}
    </button>
  );
}
