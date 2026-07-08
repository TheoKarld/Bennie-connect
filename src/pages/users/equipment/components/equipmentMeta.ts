/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Small presentational helpers shared across the equipment pages — category
 * labels/icons and duration math. Kept plane-agnostic (no store/api imports).
 */

import {
  Tractor,
  Wheat,
  Sprout,
  SprayCan,
  Droplets,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { EquipmentCategory, RateType } from "../../../../types/equipment";

export const CATEGORY_META: Record<
  EquipmentCategory,
  { label: string; icon: LucideIcon }
> = {
  TRACTOR: { label: "Tractor", icon: Tractor },
  HARVESTER: { label: "Harvester", icon: Wheat },
  PLANTER: { label: "Planter", icon: Sprout },
  SPRAYER: { label: "Sprayer", icon: SprayCan },
  IRRIGATION: { label: "Irrigation", icon: Droplets },
  OTHER: { label: "Equipment", icon: Wrench },
};

export const CATEGORY_OPTIONS: { value: EquipmentCategory; label: string }[] =
  Object.entries(CATEGORY_META).map(([value, { label }]) => ({
    value: value as EquipmentCategory,
    label,
  }));

/**
 * Duration between two ISO dates, expressed in the units of the chosen rate
 * type (hours or days). Days are rounded up; hours are rounded up too so a
 * partial period bills as a full unit — matches the server's inclusive model.
 */
export function durationForRate(
  startISO: string,
  endISO: string,
  rateType: RateType
): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  const ms = end - start;
  if (rateType === "HOURLY") {
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
  }
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** A short human window label, e.g. "10 Jul → 12 Jul". */
export function formatWindow(startISO?: string, endISO?: string): string {
  if (!startISO || !endISO) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
  };
  const s = new Date(startISO).toLocaleDateString("en-NG", opts);
  const e = new Date(endISO).toLocaleDateString("en-NG", opts);
  return `${s} → ${e}`;
}
