/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Header cart button with a live line-count badge — opens the cart drawer.
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ShoppingBasket } from "lucide-react";

import { useMarketplaceStore } from "../../../../store/marketplaceStore";

export default function CartButton({
  className = "",
  light = false,
}: {
  className?: string;
  /** Light variant for use on the dark hero band. */
  light?: boolean;
}) {
  const reduce = useReducedMotion();
  const count = useMarketplaceStore((s) => s.cart?.items.length ?? 0);
  const openCart = useMarketplaceStore((s) => s.openCart);

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Open basket (${count} line${count === 1 ? "" : "s"})`}
      className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 ${
        light
          ? "bg-white/10 text-white ring-white/30 hover:bg-white/15 focus:ring-white/40"
          : "border border-border bg-surface text-ink hover:border-primary/25 hover:text-primary focus:ring-primary/25"
      } ${className}`}
    >
      <ShoppingBasket className="h-4.5 w-4.5" />
      <span className="hidden sm:inline">Basket</span>
      {count > 0 && (
        <motion.span
          key={count}
          initial={reduce ? false : { scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold text-[#1A2421] shadow-sm"
        >
          {count > 99 ? "99+" : count}
        </motion.span>
      )}
    </button>
  );
}
