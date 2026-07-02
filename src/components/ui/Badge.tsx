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
  green: "bg-[#135D39]/10 text-[#135D39]",
  gold: "bg-[#E7A13C]/15 text-[#a6701c]",
  neutral: "bg-[#5C6460]/10 text-[#5C6460]",
  danger: "bg-red-100 text-red-600",
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
