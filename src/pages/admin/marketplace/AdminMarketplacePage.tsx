/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin Marketplace ops console (`/bennie/market-place`).
 *
 * Tabs: Products (table + create wizard) · Moderation (approval queue) ·
 * Categories · Low stock · Sellers. Every surface is server-backed via
 * `adminMarketplaceStore`, permission-aware, and light/dark aware. Orders and
 * Merchants get their own top-level nav items / consoles.
 */

import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ClipboardCheck,
  PackageX,
  ShoppingCart,
  Store,
  Tag,
} from "lucide-react";

import PermissionGate from "../../../components/admin/PermissionGate";
import { useAdminAuth } from "../../../hooks/useAdminAuth";
import ProductsTable from "./components/ProductsTable";
import ModerationQueue from "./components/ModerationQueue";
import CategoriesManager from "./components/CategoriesManager";
import LowStockView from "./components/LowStockView";
import SellersView from "./components/SellersView";

type TabKey = "products" | "moderation" | "categories" | "low-stock" | "sellers";

const TABS: {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "products", label: "Products", icon: ShoppingCart },
  { key: "moderation", label: "Moderation", icon: ClipboardCheck },
  { key: "categories", label: "Categories", icon: Tag },
  { key: "low-stock", label: "Low stock", icon: PackageX },
  { key: "sellers", label: "Sellers", icon: Store },
];

export default function AdminMarketplacePage() {
  const reduce = useReducedMotion();
  const { hasPermission } = useAdminAuth();
  const [params, setParams] = useSearchParams();
  const initial = (params.get("tab") as TabKey) || "products";
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initial) ? initial : "products"
  );

  const setTabAndUrl = (t: TabKey) => {
    setTab(t);
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };

  return (
    <PermissionGate anyOf={["marketplace:view"]}>
      <div className="space-y-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-display text-2xl font-semibold text-ink">Marketplace</h1>
          <p className="mt-1 text-sm text-muted">
            Govern the catalogue — products, moderation, categories, inventory and
            seller oversight.
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTabAndUrl(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-primary/8 hover:text-primary"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "products" && <ProductsTable />}
        {tab === "moderation" && <ModerationQueue />}
        {tab === "categories" && (
          <CategoriesManager canConfigure={hasPermission("marketplace:configure")} />
        )}
        {tab === "low-stock" && <LowStockView />}
        {tab === "sellers" && <SellersView />}
      </div>
    </PermissionGate>
  );
}
