/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Theme controls built on the `useTheme` foundation:
 *   - <ThemeToggle />        3-option segmented control (light / dark / system)
 *                            with a sliding active indicator (motion).
 *   - <ThemeToggleButton />  compact single icon that cycles the preference.
 *
 * Both read/write the shared theme store so they stay in sync wherever mounted
 * (navbar, avatar dropdown, settings). They use semantic tokens so they render
 * correctly in both themes, are keyboard-accessible, and respect reduced motion.
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Sun, Moon, Monitor } from "lucide-react";

import { useTheme, type Theme } from "../../hooks/useTheme";

const OPTIONS: {
  value: Theme;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

interface ThemeToggleProps {
  className?: string;
  /** Hide the text labels, rendering an icon-only segmented control. */
  compact?: boolean;
}

/**
 * Segmented light / dark / system control with a sliding active pill.
 */
export function ThemeToggle({ className = "", compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const reduce = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={`inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-1 ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={`relative inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              active ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId="theme-toggle-active"
                aria-hidden
                className="absolute inset-0 rounded-full bg-surface shadow-sm ring-1 ring-border"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
                }
              />
            )}
            <Icon className="relative h-4 w-4" />
            {!compact && <span className="relative">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Order used by the cycling single-button variant. */
const CYCLE: Theme[] = ["light", "dark", "system"];

interface ThemeToggleButtonProps {
  className?: string;
}

/**
 * Compact single icon button that cycles light -> dark -> system. Handy for
 * tight spots like a navbar or an avatar dropdown row.
 */
export function ThemeToggleButton({ className = "" }: ThemeToggleButtonProps) {
  const { theme, setTheme } = useTheme();

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];
  const { Icon, label } = current;

  const next = () => {
    const idx = CYCLE.indexOf(theme);
    setTheme(CYCLE[(idx + 1) % CYCLE.length]);
  };

  return (
    <button
      type="button"
      onClick={next}
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:text-ink hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default ThemeToggle;
