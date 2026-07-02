/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared formatting helpers used across feature views.
 * Money is NGN throughout the app.
 */

/** Full currency string, e.g. "₦12,500.00". */
export const formatCurrency = (amt: number): string => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(amt);
};

/** Compact NGN with the ₦ symbol and no decimals, e.g. "₦12,500". */
export const formatNaira = (amt: number): string => {
  return "₦" + Math.round(amt).toLocaleString("en-NG");
};

/** Plain grouped number, e.g. "12,500". */
export const formatNumber = (amt: number): string => {
  return amt.toLocaleString("en-NG");
};
