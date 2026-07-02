/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Centralized, single-source-of-truth constants for user-facing surfaces.
 * Keep magic numbers (rates, thresholds) out of view components and read them
 * from here so the dashboard and savings surfaces stay consistent.
 */

/**
 * Guaranteed cooperative annual percentage yields (APY) by savings product.
 * Values are whole percentages (e.g. 8.5 => "8.5% APY"). These previously lived
 * as inline magic numbers in the dashboard's "Cooperative Rates Index".
 */
export const COOP_RATES = {
  flexSave: 8.5,
  targetGoal: 11.5,
  harvestSave: 12.5,
} as const;

/** Discount (%) applied to equipment/service bookings for members. */
export const MEMBER_BOOKING_DISCOUNT = 10;

/** Password policy mirrored from the backend RegisterDto rule. */
export const PASSWORD_MIN_LENGTH = 8;
/**
 * Special characters accepted by the backend password rule
 * (`@$!%*?&#^()\-_+=.`). Kept as a character class body so it can be embedded
 * in a RegExp and shown to the user verbatim.
 */
export const PASSWORD_SPECIALS = "@$!%*?&#^()\\-_+=.";
