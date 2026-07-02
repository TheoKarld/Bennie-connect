/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";

interface RevealProps {
  children: React.ReactNode;
  /** Stagger delay in seconds. */
  delay?: number;
  /** Slide distance in px (default 24). */
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}

/**
 * Scroll-reveal wrapper: fades + slides its children in once, when they enter
 * the viewport. Respects prefers-reduced-motion (renders static, fully visible).
 */
export default function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
  as = "div",
}: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}
