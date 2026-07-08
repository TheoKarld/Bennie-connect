/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  Users,
  ShieldCheck,
  Building2,
  PiggyBank,
  ShoppingCart,
  BadgeCheck,
  Percent,
  Settings,
} from "lucide-react";

import AdminSectionPlaceholder from "../../components/admin/AdminSectionPlaceholder";
import PermissionGate from "../../components/admin/PermissionGate";

/**
 * Placeholder section pages for this round. Each is permission-gated (deep-link
 * protection) and renders a tasteful "coming soon" workspace. As each section
 * ships, its route body is replaced with the real workspace.
 */

export function AdminUsersSection() {
  return (
    <PermissionGate anyOf={["users:view"]}>
      <AdminSectionPlaceholder
        title="Users"
        description="Platform users — farmers and agents — with User 360, KYC and moderation."
        icon={Users}
        bullets={[
          "Searchable user directory with status & KYC filters",
          "User 360 aggregate (wallet, savings, orders, referrals)",
          "Suspend / ban / verify actions gated per permission",
        ]}
      />
    </PermissionGate>
  );
}

export function AdminAdminsSection() {
  return (
    <PermissionGate anyOf={["admins:view", "roles:view"]}>
      <AdminSectionPlaceholder
        title="Admins & Roles"
        description="Sub-admins, roles & the permission catalog, plus the audit trail."
        icon={ShieldCheck}
        bullets={[
          "Provision sub-admins and assign roles",
          "Granular role editor with permission overrides",
          "Append-only audit-log viewer",
        ]}
      />
    </PermissionGate>
  );
}

export function AdminCooperativeSection() {
  return (
    <PermissionGate anyOf={["cooperatives:view", "shares:view", "dividends:view"]}>
      <AdminSectionPlaceholder
        title="Cooperative"
        description="Cooperatives, shares issuance & pricing, and dividend declarations."
        icon={Building2}
        bullets={[
          "Cooperative approval & lifecycle management",
          "Share issuance and price administration",
          "Dividend declaration & distribution (Super Admin)",
        ]}
      />
    </PermissionGate>
  );
}

export function AdminSavingsSection() {
  return (
    <PermissionGate anyOf={["savings-plans:view"]}>
      <AdminSectionPlaceholder
        title="Savings Plans"
        description="Savings products, APY configuration and interest accrual runs."
        icon={PiggyBank}
        bullets={[
          "Create & configure savings products",
          "Interest accrual run history & controls",
          "Force-close / forfeit accounts (Super Admin)",
        ]}
      />
    </PermissionGate>
  );
}

export function AdminMarketplaceSection() {
  return (
    <PermissionGate anyOf={["marketplace:view", "orders:view"]}>
      <AdminSectionPlaceholder
        title="Marketplace"
        description="Product moderation, orders, disputes and refunds."
        icon={ShoppingCart}
        bullets={[
          "Product moderation queue",
          "Order management & dispute mediation",
          "Refund to buyer wallet (Super Admin)",
        ]}
      />
    </PermissionGate>
  );
}

export function AdminMembershipTiersSection() {
  return (
    <PermissionGate anyOf={["membership-tiers:view", "memberships:view"]}>
      <AdminSectionPlaceholder
        title="Membership Tiers"
        description="Tier definitions, pricing & privileges, and member records."
        icon={BadgeCheck}
        bullets={[
          "Bronze / Silver / Gold / Platinum tier editor",
          "Pricing, discounts and share caps",
          "Membership application review",
        ]}
      />
    </PermissionGate>
  );
}

export function AdminCommissionSection() {
  return (
    <PermissionGate anyOf={["agent-commission:view"]}>
      <AdminSectionPlaceholder
        title="Agent Commission"
        description="Commission ledgers, rate configuration and payout batches."
        icon={Percent}
        bullets={[
          "Commission ledgers per agent",
          "Rate & withholding-tax configuration",
          "Batch-pay approved commissions (Super Admin)",
        ]}
      />
    </PermissionGate>
  );
}

export function AdminSettingsSection() {
  return (
    <PermissionGate anyOf={["settings:view"]}>
      <AdminSectionPlaceholder
        title="Settings"
        description="Platform-wide fees, rates, limits, security policy and feature flags."
        icon={Settings}
        bullets={[
          "Fees, rates, tax and wallet limits",
          "Security policy & KYC toggles",
          "Sensitive config edits (Super Admin)",
        ]}
      />
    </PermissionGate>
  );
}
