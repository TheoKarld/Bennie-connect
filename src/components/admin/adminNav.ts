/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Building2,
  PiggyBank,
  ShoppingCart,
  Receipt,
  Store,
  BadgeCheck,
  Tractor,
  Users2,
  Percent,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for the admin primary navigation. Consumed by the
 * desktop sidebar, the mobile drawer, and (a subset of) the mobile bottom-nav.
 * Each item is gated by ANY-OF its `permissions` — matched with the shared
 * RBAC helper (exact / `resource:*` / `*`). Per the layout PRD nav table.
 */

export type NavGroup = "Operations" | "Administration";

export interface AdminNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Any-of gating permissions. Empty ⇒ always visible (Dashboard). */
  permissions: string[];
  group: NavGroup;
  /** react-router `end` for exact matching of the index route. */
  end?: boolean;
}

export const ADMIN_NAV: AdminNavItem[] = [
  {
    label: "Dashboard",
    to: "/bennie/dashboard",
    icon: LayoutDashboard,
    permissions: [], // always visible to any authenticated admin
    group: "Operations",
    end: true,
  },
  {
    label: "Users",
    to: "/bennie/users",
    icon: Users,
    permissions: ["users:view"],
    group: "Operations",
  },
  {
    label: "Cooperative",
    to: "/bennie/cooperative",
    icon: Building2,
    permissions: ["cooperatives:view", "shares:view", "dividends:view"],
    group: "Operations",
  },
  {
    label: "Savings Plans",
    to: "/bennie/savings-plans",
    icon: PiggyBank,
    permissions: ["savings-plans:view"],
    group: "Operations",
  },
  {
    label: "Marketplace",
    to: "/bennie/market-place",
    icon: ShoppingCart,
    permissions: ["marketplace:view"],
    group: "Operations",
  },
  {
    label: "Orders",
    to: "/bennie/orders",
    icon: Receipt,
    permissions: ["orders:view"],
    group: "Operations",
  },
  {
    label: "Merchants",
    to: "/bennie/merchants",
    icon: Store,
    permissions: ["merchants:view"],
    group: "Operations",
  },
  {
    label: "Equipment Booking",
    to: "/bennie/equipment-booking",
    icon: Tractor,
    permissions: ["equipment:view"],
    group: "Operations",
  },
  {
    label: "Adashe",
    to: "/bennie/adashesu-contributions",
    icon: Users2,
    permissions: ["adashe-groups:view"],
    group: "Operations",
  },
  {
    label: "Agent Commission",
    to: "/bennie/agent-commission",
    icon: Percent,
    permissions: ["agent-commission:view"],
    group: "Operations",
  },
  {
    label: "Admins & Roles",
    to: "/bennie/admin",
    icon: ShieldCheck,
    permissions: ["admins:view", "roles:view"],
    group: "Administration",
  },
  {
    label: "Membership Tiers",
    to: "/bennie/membership-tiers",
    icon: BadgeCheck,
    permissions: ["membership-tiers:view", "memberships:view"],
    group: "Administration",
  },
  {
    label: "Settings",
    to: "/bennie/settings",
    icon: Settings,
    permissions: ["settings:view"],
    group: "Administration",
  },
];

/** Bottom-nav key sections (mobile). "More" is rendered separately. */
export const ADMIN_BOTTOM_NAV_ROUTES = [
  "/bennie/dashboard",
  "/bennie/users",
  "/bennie/cooperative",
  "/bennie/market-place",
];

/** Human page titles keyed by route for the navbar breadcrumb. */
export const ADMIN_ROUTE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Users",
  admin: "Admins & Roles",
  cooperative: "Cooperative",
  "savings-plans": "Savings Plans",
  "market-place": "Marketplace",
  orders: "Orders",
  merchants: "Merchants",
  "membership-tiers": "Membership Tiers",
  "equipment-booking": "Equipment Booking",
  "adashesu-contributions": "Adashe Contributions",
  "agent-commission": "Agent Commission",
  settings: "Settings",
  "change-password": "Change Password",
};
