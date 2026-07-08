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
    "bg-primary text-white hover:brightness-110 shadow-md shadow-primary/15 disabled:bg-primary/50",
  accent:
    "bg-accent text-[#1A2421] hover:brightness-105 shadow-md shadow-accent/20 disabled:opacity-50",
  secondary:
    "bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50",
  outline:
    "border border-primary/30 text-primary hover:bg-primary/5 disabled:opacity-50",
  ghost:
    "text-muted hover:text-ink hover:bg-primary/5 disabled:opacity-50",
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
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed ${
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
