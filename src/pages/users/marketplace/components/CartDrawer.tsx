/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server-side cart drawer — right-hand slide-over overlaid on any marketplace
 * route. Lines with qty steppers (server PATCH per change), invalid-line
 * repair affordances, per-seller split preview, wallet line and the checkout
 * CTA (cart_checkout.md §6.1).
 */

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  X,
  ShoppingBasket,
  Minus,
  Plus,
  Trash2,
  AlertTriangle,
  ImageOff,
  Wallet,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

import { Button, pushToast, Spinner } from "../../../../components/ui";
import { formatNaira } from "../../../../lib/format";
import { useMarketplaceStore } from "../../../../store/marketplaceStore";
import type { CartLine } from "../../../../types/marketplace";
import { CART_ISSUE_COPY, SellerBadge } from "./marketplaceMeta";

function CartLineRow({ line }: { line: CartLine }) {
  const updateCartItem = useMarketplaceStore((s) => s.updateCartItem);
  const removeCartItem = useMarketplaceStore((s) => s.removeCartItem);
  const busy = useMarketplaceStore((s) => Boolean(s.cartBusy[line.itemId]));

  const stock = line.product?.stockAvailable ?? 0;

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      pushToast({
        title: "Basket",
        message: (err as Error)?.message || "Could not update your basket.",
        tone: "warning",
      });
    }
  };

  return (
    <div
      className={`rounded-2xl border p-3 transition ${
        line.valid
          ? "border-border bg-surface"
          : "border-amber-400/50 bg-amber-50/60 dark:border-amber-400/30 dark:bg-amber-400/5"
      }`}
    >
      <div className="flex gap-3">
        {/* Thumb */}
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
          {line.product?.image?.url ? (
            <img
              src={line.product.image.url}
              alt={line.product?.name ?? "Product"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              <ImageOff className="h-5 w-5 opacity-40" />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold text-ink">
            {line.product?.name ?? "Unavailable product"}
          </p>
          <p className="text-[11px] text-muted">
            {formatNaira(line.product?.price ?? 0)} / {line.product?.unit ?? "unit"}
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            {/* Stepper */}
            <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
              <button
                type="button"
                onClick={() =>
                  void act(async () => {
                    if (line.quantity <= 1) {
                      await removeCartItem(line.itemId);
                    } else {
                      await updateCartItem(line.itemId, line.quantity - 1);
                    }
                  })
                }
                disabled={busy}
                aria-label="Reduce quantity"
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-6 text-center font-mono text-xs font-bold text-ink">
                {busy ? "…" : line.quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  void act(() => updateCartItem(line.itemId, line.quantity + 1))
                }
                disabled={busy || line.quantity >= stock}
                aria-label="Increase quantity"
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink">
                {formatNaira(line.lineTotal)}
              </span>
              <button
                type="button"
                onClick={() => void act(() => removeCartItem(line.itemId))}
                disabled={busy}
                aria-label="Remove from basket"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger focus:outline-none focus:ring-2 focus:ring-danger/25 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invalid-line chip */}
      {!line.valid && line.issue && (
        <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-amber-100/70 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {CART_ISSUE_COPY[line.issue] ?? "This line needs attention"}
        </div>
      )}
    </div>
  );
}

export default function CartDrawer() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();

  const open = useMarketplaceStore((s) => s.cartOpen);
  const closeCart = useMarketplaceStore((s) => s.closeCart);
  const cart = useMarketplaceStore((s) => s.cart);
  const cartStatus = useMarketplaceStore((s) => s.cartStatus);
  const cartError = useMarketplaceStore((s) => s.cartError);
  const fetchCart = useMarketplaceStore((s) => s.fetchCart);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeCart]);

  const items = cart?.items ?? [];
  const empty = items.length === 0;
  const insufficient = cart ? !cart.wallet.sufficient : false;
  const splitCount = cart?.sellerGroups.length ?? 0;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          {/* Backdrop */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeCart}
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Basket"
            initial={reduce ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduce ? undefined : { x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-canvas shadow-2xl"
          >
            {/* Header */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShoppingBasket className="h-5 w-5" />
                </span>
                <div className="leading-tight">
                  <p className="font-display text-sm font-semibold text-ink">
                    Your basket
                  </p>
                  <p className="text-[11px] text-muted">
                    {items.length} line{items.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Close basket"
                className="rounded-xl p-2 text-muted transition hover:bg-primary/5 hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cartStatus === "loading" && !cart ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-24 animate-pulse rounded-2xl bg-surface-2"
                    />
                  ))}
                </div>
              ) : cartStatus === "error" && !cart ? (
                <div className="rounded-2xl border border-border bg-surface p-6 text-center">
                  <p className="text-sm font-semibold text-ink">
                    Couldn&apos;t load your basket
                  </p>
                  <p className="mt-1 text-xs text-muted">{cartError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => void fetchCart()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Try again
                  </Button>
                </div>
              ) : empty ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
                    <ShoppingBasket className="h-7 w-7 text-primary" />
                  </span>
                  <p className="text-sm font-semibold text-ink">
                    Your basket is empty
                  </p>
                  <p className="mt-1 max-w-[220px] text-xs text-muted">
                    Browse the marketplace and add farm inputs or produce.
                  </p>
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      closeCart();
                      navigate("/app/marketplace");
                    }}
                  >
                    Browse marketplace
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((line) => (
                    <CartLineRow key={line.itemId} line={line} />
                  ))}

                  {/* Per-seller split preview */}
                  {splitCount > 0 && (
                    <div className="rounded-2xl bg-surface-2 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                        This purchase will create {splitCount} order
                        {splitCount === 1 ? "" : "s"}
                      </p>
                      <div className="mt-2.5 space-y-2">
                        {cart?.sellerGroups.map((g, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2"
                          >
                            <SellerBadge seller={g.seller} />
                            <span className="font-mono text-xs font-bold text-ink">
                              {formatNaira(g.subtotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {!empty && cart && (
              <div className="shrink-0 space-y-3 border-t border-border px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">Total</span>
                  <span className="font-mono text-lg font-bold text-primary">
                    {formatNaira(cart.grandTotal)}
                  </span>
                </div>
                <div
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                    insufficient
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                      : "bg-primary/5 text-primary"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    Wallet: {formatNaira(cart.wallet.available)}
                  </span>
                  {insufficient && (
                    <button
                      type="button"
                      onClick={() => {
                        closeCart();
                        navigate("/app/wallet");
                      }}
                      className="font-bold underline underline-offset-2"
                    >
                      Top up wallet
                    </button>
                  )}
                </div>
                {cart.checkoutBlocked && cart.blockedReason === "INVALID_ITEMS" && (
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    Fix the highlighted lines before checking out.
                  </p>
                )}
                <Button
                  fullWidth
                  disabled={cart.checkoutBlocked}
                  onClick={() => {
                    closeCart();
                    navigate("/app/marketplace/checkout");
                  }}
                >
                  Proceed to checkout <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {cartStatus === "loading" && cart && (
              <div className="pointer-events-none absolute right-4 top-20">
                <Spinner size={16} />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
