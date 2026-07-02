/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** Rounded, cream-on-white surface used across feature views. */
export default function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-[#E6E5DF] bg-white/70 p-6 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
