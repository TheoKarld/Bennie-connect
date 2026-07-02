/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { Check } from "lucide-react";

import { PASSWORD_MIN_LENGTH, PASSWORD_SPECIALS } from "../../lib/constants";

/**
 * Reusable password strength UI, shared by the Signup and Reset-password
 * surfaces. It renders BOTH:
 *   1. a segmented, brand-coloured strength meter (Weak -> Fair -> Good ->
 *      Strong) with an accessible label, and
 *   2. per-rule requirement "chips" giving live feedback on each backend rule.
 *
 * The strength score is derived from length + character-class variety, mirroring
 * the backend RegisterDto password rule (>=8 chars incl. upper, lower, digit and
 * a special from `@$!%*?&#^()\-_+=.`).
 */

/** RegExp-safe special-character class body (mirrors the backend rule). */
const SPECIAL_RE = new RegExp(`[${PASSWORD_SPECIALS}]`);

export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
}

/** Live password rules mirroring the backend RegisterDto pattern. */
export function passwordChecks(pw: string): PasswordChecks {
  return {
    length: pw.length >= PASSWORD_MIN_LENGTH,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw),
    special: SPECIAL_RE.test(pw),
  };
}

/** All backend rules satisfied. */
export function isPasswordValid(pw: string): boolean {
  return Object.values(passwordChecks(pw)).every(Boolean);
}

const RULE_LABELS: { key: keyof PasswordChecks; label: string }[] = [
  { key: "length", label: "8+ characters" },
  { key: "upper", label: "Uppercase" },
  { key: "lower", label: "Lowercase" },
  { key: "digit", label: "Number" },
  { key: "special", label: "Special (@$!%*?&…)" },
];

/** Score 0..4 driven by length and character-class variety. */
function scorePassword(pw: string, checks: PasswordChecks): number {
  if (!pw) return 0;
  const classes =
    (checks.upper ? 1 : 0) +
    (checks.lower ? 1 : 0) +
    (checks.digit ? 1 : 0) +
    (checks.special ? 1 : 0);

  // Base score off character-class variety, then reward genuine length.
  let score = classes; // 0..4
  if (pw.length >= 12) score += 1;
  if (pw.length < PASSWORD_MIN_LENGTH) score = Math.min(score, 1);

  // Clamp to the 0..4 band used by the meter labels.
  return Math.max(0, Math.min(4, score));
}

const LEVELS = [
  { label: "Too short", color: "#DC2626", track: 0 },
  { label: "Weak", color: "#DC2626", track: 1 },
  { label: "Fair", color: "#E7A13C", track: 2 },
  { label: "Good", color: "#71B53B", track: 3 },
  { label: "Strong", color: "#135D39", track: 4 },
] as const;

const SEGMENTS = 4;

interface PasswordStrengthProps {
  password: string;
  /** Show the per-rule requirement chips beneath the meter. Default: true. */
  showChips?: boolean;
  className?: string;
}

/**
 * Segmented strength meter + optional per-rule feedback chips.
 * Renders nothing until the user has typed at least one character.
 */
export default function PasswordStrength({
  password,
  showChips = true,
  className = "",
}: PasswordStrengthProps) {
  const checks = useMemo(() => passwordChecks(password), [password]);
  const score = useMemo(
    () => scorePassword(password, checks),
    [password, checks]
  );

  if (!password) return null;

  const level = LEVELS[score];
  // Filled segments track the level (min 1 once anything is typed).
  const filled = Math.max(1, level.track);

  return (
    <div className={`space-y-2 pt-1.5 ${className}`}>
      {/* Segmented meter */}
      <div>
        <div
          className="flex items-center gap-1.5"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={SEGMENTS}
          aria-valuenow={filled}
          aria-label={`Password strength: ${level.label}`}
        >
          {Array.from({ length: SEGMENTS }).map((_, i) => {
            const active = i < filled;
            return (
              <span
                key={i}
                aria-hidden
                className="h-1.5 flex-1 rounded-full transition-colors duration-300"
                style={{ backgroundColor: active ? level.color : "#E6E5DF" }}
              />
            );
          })}
        </div>
        <p
          className="mt-1.5 text-[11px] font-semibold"
          style={{ color: level.color }}
          aria-hidden
        >
          {level.label}
        </p>
      </div>

      {/* Per-rule requirement chips */}
      {showChips && (
        <div className="flex flex-wrap gap-1.5">
          {RULE_LABELS.map(({ key, label }) => {
            const ok = checks[key];
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium border transition-colors ${
                  ok
                    ? "bg-[#135D39]/8 text-[#135D39] border-[#135D39]/15"
                    : "bg-[#FAF8F5] text-[#9AA29D] border-[#E6E5DF]"
                }`}
              >
                <Check
                  className={`w-3 h-3 ${ok ? "opacity-100" : "opacity-30"}`}
                />
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
