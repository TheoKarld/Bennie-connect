/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

type Tone = "green" | "gold" | "neutral" | "danger";

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

const TONES: Record<Tone, string> = {
  green: "bg-primary/10 text-primary",
  gold: "bg-accent/15 text-[#a6701c] dark:text-accent",
  neutral: "bg-muted/10 text-muted",
  danger: "bg-danger/10 text-danger",
};

export default function Badge({ tone = "green", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
