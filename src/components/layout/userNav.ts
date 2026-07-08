/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LayoutDashboard,
  Wallet,
  PiggyBank,
  Users,
  Compass,
  Wrench,
  ShoppingBag,
  Store,
  TrendingUp,
  CreditCard,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for the end-user portal primary navigation. Consumed
 * by the desktop sidebar, the mobile drawer, and (a subset of) the mobile
 * bottom-nav. Mirrors the admin `adminNav.ts` data-driven pattern.
 */

export interface UserNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** react-router `end` for exact matching of the index route. */
  end?: boolean;
}

export const USER_NAV: UserNavItem[] = [
  { label: "Overview", to: "/app", icon: LayoutDashboard, end: true },
  { label: "Wallet", to: "/app/wallet", icon: Wallet },
  { label: "Savings", to: "/app/savings", icon: PiggyBank },
  { label: "Adashe", to: "/app/adashe", icon: Users },
  { label: "Equipment", to: "/app/equipment", icon: Compass },
  { label: "Agro Services", to: "/app/services", icon: Wrench },
  { label: "Marketplace", to: "/app/marketplace", icon: ShoppingBag },
  { label: "Merchant Hub", to: "/app/merchant", icon: Store },
  { label: "Shares", to: "/app/shares", icon: TrendingUp },
  { label: "Membership", to: "/app/membership", icon: CreditCard },
  { label: "Agent", to: "/app/agent", icon: Briefcase },
];

/** Bottom-nav key sections (mobile). "More" is rendered separately. */
export const USER_BOTTOM_NAV_ROUTES = [
  "/app",
  "/app/wallet",
  "/app/savings",
  "/app/adashe",
];

/**
 * Human page titles keyed by the first path segment after `/app` for the
 * navbar breadcrumb. The index route ("" segment) maps to "Overview".
 */
export const USER_ROUTE_TITLES: Record<string, string> = {
  "": "Overview",
  wallet: "Wallet",
  savings: "Savings",
  adashe: "Adashe",
  equipment: "Equipment Booking",
  services: "Agro Services",
  marketplace: "Marketplace",
  merchant: "Merchant Hub",
  shares: "Shares",
  membership: "Membership",
  agent: "Agent Terminal",
};
