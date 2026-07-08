/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Storefront product card — image, category chip, seller badge, price/unit,
 * stock hint and an optimistic add-to-cart control (stepper once carted).
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ImageOff, Minus, Plus, ShoppingBasket, Video } from "lucide-react";

import { pushToast } from "../../../../components/ui";
import { formatNaira } from "../../../../lib/format";
import { useMarketplaceStore } from "../../../../store/marketplaceStore";
import type { StorefrontProduct } from "../../../../types/marketplace";
import {
  LOW_STOCK_THRESHOLD,
  SellerBadge,
  firstImageUrl,
} from "./marketplaceMeta";

export default function ProductCard({
  product,
  index = 0,
}: {
  product: StorefrontProduct;
  index?: number;
}) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();

  const cart = useMarketplaceStore((s) => s.cart);
  const addToCart = useMarketplaceStore((s) => s.addToCart);
  const updateCartItem = useMarketplaceStore((s) => s.updateCartItem);
  const removeCartItem = useMarketplaceStore((s) => s.removeCartItem);

  const [busy, setBusy] = useState(false);

  const available = product.stock?.available ?? 0;
  const outOfStock = available <= 0;
  const lowStock = !outOfStock && available < LOW_STOCK_THRESHOLD;
  const image = firstImageUrl(product.images);

  const line =
    cart?.items.find((i) => i.product?.id === product.id) ?? null;

  const goDetail = () => navigate(`/app/marketplace/products/${product.id}`);

  const run = async (fn: () => Promise<void>, fallback: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      pushToast({
        title: "Basket",
        message: (err as Error)?.message || fallback,
        tone: "warning",
      });
    } finally {
      setBusy(false);
    }
  };

  const onAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    void run(async () => {
      await addToCart(product.id, 1);
      pushToast({
        title: "Added to basket",
        message: product.name,
        tone: "success",
        duration: 2500,
      });
    }, "Could not add this item.");
  };

  const onStep = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    if (!line) return;
    const next = line.quantity + delta;
    void run(async () => {
      if (next <= 0) {
        await removeCartItem(line.itemId);
      } else {
        await updateCartItem(line.itemId, next);
      }
    }, "Could not update the quantity.");
  };

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      onClick={goDetail}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-surface transition duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-xl"
    >
      {/* Media */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
        {image ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <ImageOff className="h-8 w-8 opacity-40" />
          </div>
        )}
        {product.category?.name && (
          <span className="absolute left-3 top-3 rounded-full bg-canvas/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink backdrop-blur-sm">
            {product.category.name}
          </span>
        )}
        {product.hasVideo && (
          <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-canvas/85 text-ink backdrop-blur-sm">
            <Video className="h-3.5 w-3.5" />
          </span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/70 backdrop-blur-[2px]">
            <span className="rounded-full border border-rose-400/40 bg-rose-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
              Out of stock
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <SellerBadge seller={product.seller} className="self-start" />
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
          {product.name}
        </h3>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-lg font-bold text-primary">
              {formatNaira(product.price)}
            </p>
            <p className="truncate text-[11px] text-muted">
              per {product.unit}
            </p>
            <p
              className={`mt-1 text-[11px] font-semibold ${
                outOfStock
                  ? "text-rose-600 dark:text-rose-300"
                  : lowStock
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-muted"
              }`}
            >
              {outOfStock
                ? "Out of stock"
                : lowStock
                  ? `Only ${available} left`
                  : `${available} available`}
            </p>
          </div>

          {/* Add-to-cart / stepper */}
          {line ? (
            <div
              className="flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/5 p-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => onStep(e, -1)}
                disabled={busy}
                aria-label="Reduce quantity"
                className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-6 text-center font-mono text-sm font-bold text-primary">
                {line.quantity}
              </span>
              <button
                type="button"
                onClick={(e) => onStep(e, 1)}
                disabled={busy || line.quantity >= available}
                aria-label="Increase quantity"
                className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              disabled={outOfStock || busy}
              aria-label={`Add ${product.name} to basket`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/20 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <ShoppingBasket className="h-4.5 w-4.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
