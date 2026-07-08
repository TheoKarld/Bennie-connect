/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared presentation atoms + option data for the Merchant Hub: ID-type
 * picker options (with local format validation mirroring the backend
 * `ID_NUMBER_PATTERNS`), moderation/payout status chips and the Nigerian
 * states list. Tokenized for light + dark.
 */

import React from "react";

import type {
  MerchantIdType,
  ModerationStatus,
  PayoutStatus,
} from "../../../../types/merchant";

// --- ID types (backend canon: DRIVERS_LICENCE) -----------------------------------

export interface IdTypeOption {
  value: MerchantIdType;
  label: string;
  hint: string;
  pattern: RegExp;
  inputMode?: "numeric" | "text";
}

export const ID_TYPE_OPTIONS: IdTypeOption[] = [
  {
    value: "NIN",
    label: "NIN",
    hint: "11-digit National Identification Number",
    pattern: /^\d{11}$/,
    inputMode: "numeric",
  },
  {
    value: "BVN",
    label: "BVN",
    hint: "11-digit Bank Verification Number",
    pattern: /^\d{11}$/,
    inputMode: "numeric",
  },
  {
    value: "DRIVERS_LICENCE",
    label: "Driver's licence",
    hint: "FRSC number, e.g. ABC12345678",
    pattern: /^[A-Za-z]{3}[A-Za-z0-9]{5,9}$/,
    inputMode: "text",
  },
  {
    value: "VOTERS_CARD",
    label: "Voter's card",
    hint: "19-character VIN on your PVC",
    pattern: /^[A-Za-z0-9]{19}$/,
    inputMode: "text",
  },
  {
    value: "INTL_PASSPORT",
    label: "Int'l passport",
    hint: "Letter + 8 digits, e.g. A12345678",
    pattern: /^[A-Za-z]\d{8}$/,
    inputMode: "text",
  },
];

export function idTypeOption(
  value?: MerchantIdType | null
): IdTypeOption | undefined {
  return ID_TYPE_OPTIONS.find((o) => o.value === value);
}

// --- Nigerian states -----------------------------------------------------------------

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

// --- Moderation chips -------------------------------------------------------------------

const MODERATION_STYLES: Record<string, string> = {
  PENDING:
    "bg-amber-50 text-amber-700 border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/25",
  APPROVED:
    "bg-emerald-50 text-emerald-700 border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/25",
  REJECTED:
    "bg-rose-50 text-rose-700 border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/25",
  CHANGES_REQUESTED:
    "bg-sky-50 text-sky-700 border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-300 dark:border-sky-400/25",
};

const MODERATION_LABELS: Record<string, string> = {
  PENDING: "Awaiting approval",
  APPROVED: "Live",
  REJECTED: "Rejected",
  CHANGES_REQUESTED: "Changes requested",
};

export function ModerationChip({
  status,
  className = "",
}: {
  status: ModerationStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
        MODERATION_STYLES[status] ?? MODERATION_STYLES.PENDING
      } ${className}`}
    >
      {MODERATION_LABELS[status] ?? status}
    </span>
  );
}

// --- Payout chips ---------------------------------------------------------------------------

const PAYOUT_STYLES: Record<PayoutStatus, string> = {
  REQUESTED:
    "bg-amber-50 text-amber-700 border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/25",
  MARKED_SENT:
    "bg-sky-50 text-sky-700 border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-300 dark:border-sky-400/25",
  CONFIRMED_RECEIVED:
    "bg-emerald-50 text-emerald-700 border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/25",
  CANCELLED:
    "bg-muted/10 text-muted border-border",
};

export const PAYOUT_LABELS: Record<PayoutStatus, string> = {
  REQUESTED: "Requested",
  MARKED_SENT: "Sent by admin",
  CONFIRMED_RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export function PayoutChip({
  status,
  className = "",
}: {
  status: PayoutStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
        PAYOUT_STYLES[status] ?? PAYOUT_STYLES.REQUESTED
      } ${className}`}
    >
      {PAYOUT_LABELS[status] ?? status}
    </span>
  );
}

// --- Phone validation (mirrors the backend DTO) -----------------------------------------------

export const NG_PHONE_PATTERN = /^(\+234|0)[789][01]\d{8}$/;

export const CAC_PATTERN = /^(RC|BN|rc|bn)\d{5,8}$/;
