/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Hammer, type LucideIcon } from "lucide-react";

import { Badge } from "../ui";

/**
 * Tasteful "section coming soon" page used by the not-yet-built admin sections
 * this round. On-brand, not a bare message.
 */
export default function AdminSectionPlaceholder({
  title,
  description,
  icon: Icon,
  bullets = [],
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  bullets?: string[];
}) {
  const reduce = useReducedMotion();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <Badge tone="gold">Coming soon</Badge>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface/70 p-10 shadow-sm"
      >
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl"
        />
        <div className="relative z-10 max-w-lg space-y-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary">
            <Icon className="h-7 w-7" />
          </span>
          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold text-ink">
              This section is being built
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              The console shell, navigation and permission gating for{" "}
              <span className="font-semibold text-primary">{title}</span> are
              wired up. The interactive workspace lands in an upcoming release.
            </p>
          </div>

          {bullets.length > 0 && (
            <ul className="space-y-2 pt-1">
              {bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2.5 text-sm text-muted"
                >
                  <Hammer className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {b}
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/bennie/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Back to dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
