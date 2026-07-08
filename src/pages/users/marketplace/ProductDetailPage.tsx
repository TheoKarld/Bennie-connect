/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Product detail (`/app/marketplace/products/:id`) — media gallery (up to 3
 * images + optional HTML5 video), purchase panel with quantity stepper,
 * sticky mobile add-to-cart bar, in-cart state and the MKT_001 unavailable
 * panel. Server-backed via `useMarketplaceStore`.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Minus,
  Plus,
  Play,
  RefreshCw,
  ShoppingBasket,
  PackageX,
  Boxes,
} from "lucide-react";

import { Button, pushToast } from "../../../components/ui";
import { formatNaira } from "../../../lib/format";
import { useMarketplaceStore } from "../../../store/marketplaceStore";
import CartButton from "./components/CartButton";
import {
  LOW_STOCK_THRESHOLD,
  SellerBadge,
  formatDate,
} from "./components/marketplaceMeta";

type MediaItem =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string };

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="aspect-[4/3] animate-pulse rounded-3xl bg-surface-2" />
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 w-16 animate-pulse rounded-xl bg-surface-2"
            />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-4 w-24 animate-pulse rounded-full bg-surface-2" />
        <div className="h-7 w-3/4 animate-pulse rounded-full bg-surface-2" />
        <div className="h-10 w-40 animate-pulse rounded-full bg-surface-2" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const product = useMarketplaceStore((s) => s.product);
  const status = useMarketplaceStore((s) => s.productStatus);
  const error = useMarketplaceStore((s) => s.productError);
  const errorCode = useMarketplaceStore((s) => s.productErrorCode);
  const loadProduct = useMarketplaceStore((s) => s.loadProduct);
  const clearProduct = useMarketplaceStore((s) => s.clearProduct);
  const addToCart = useMarketplaceStore((s) => s.addToCart);
  const updateCartItem = useMarketplaceStore((s) => s.updateCartItem);
  const openCart = useMarketplaceStore((s) => s.openCart);

  const [qty, setQty] = useState(1);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) void loadProduct(id);
    setQty(1);
    setMediaIndex(0);
    return () => clearProduct();
  }, [id, loadProduct, clearProduct]);

  const media: MediaItem[] = useMemo(() => {
    if (!product) return [];
    const items: MediaItem[] = (product.images ?? [])
      .filter((img) => Boolean(img?.url))
      .slice(0, 3)
      .map((img) => ({ kind: "image" as const, url: img.url }));
    if (product.video?.url) {
      items.push({ kind: "video", url: product.video.url });
    }
    return items;
  }, [product]);

  const current = media[mediaIndex] ?? null;
  const available = product?.stock?.available ?? 0;
  const outOfStock = available <= 0;
  const lowStock = !outOfStock && available < LOW_STOCK_THRESHOLD;
  const inCart = product?.inCart ?? null;

  // Keyboard gallery navigation.
  useEffect(() => {
    if (media.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      if (e.key === "ArrowLeft") {
        setMediaIndex((i) => (i - 1 + media.length) % media.length);
      } else if (e.key === "ArrowRight") {
        setMediaIndex((i) => (i + 1) % media.length);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [media.length]);

  const clampQty = (n: number) => Math.min(Math.max(1, n), Math.max(1, available));

  const onAdd = async () => {
    if (!product || busy) return;
    setBusy(true);
    try {
      if (inCart) {
        await updateCartItem(inCart.itemId, inCart.quantity + qty);
      } else {
        await addToCart(product.id, qty);
      }
      pushToast({
        title: "Added to basket",
        message: `${qty} × ${product.name}`,
        tone: "success",
        duration: 2500,
      });
    } catch (err) {
      pushToast({
        title: "Basket",
        message: (err as Error)?.message || "Could not add this item.",
        tone: "warning",
      });
    } finally {
      setBusy(false);
    }
  };

  // --- Unavailable / error panels -------------------------------------------------

  if (status === "error") {
    const unavailable = errorCode === "MKT_001";
    return (
      <div className="mx-auto max-w-2xl py-10">
        <div className="rounded-3xl border border-border bg-surface p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10">
            <PackageX className="h-7 w-7 text-danger" />
          </div>
          <h1 className="font-display text-lg font-semibold text-ink">
            {unavailable
              ? "This product is no longer available"
              : "Couldn't load this product"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            {unavailable
              ? "It may have sold out, been withdrawn by the seller, or removed from the catalogue."
              : error}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => navigate("/app/marketplace")}>
              <ArrowLeft className="h-4 w-4" /> Back to marketplace
            </Button>
            {!unavailable && (
              <Button variant="outline" onClick={() => void loadProduct(id)}>
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-28 lg:pb-0">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/app/marketplace"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Marketplace
        </Link>
        <CartButton />
      </div>

      {status !== "ready" || !product ? (
        <DetailSkeleton />
      ) : (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 gap-8 lg:grid-cols-2"
        >
          {/* --- Media gallery --- */}
          <div className="space-y-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-surface-2">
              {current?.kind === "video" ? (
                <video
                  key={current.url}
                  controls
                  preload="metadata"
                  className="h-full w-full bg-black object-contain"
                >
                  <source src={current.url} />
                  Your browser does not support HTML5 video.
                </video>
              ) : current ? (
                <img
                  src={current.url}
                  alt={`${product.name} — media ${mediaIndex + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted">
                  <ImageOff className="h-10 w-10 opacity-40" />
                </div>
              )}

              {media.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous media"
                    onClick={() =>
                      setMediaIndex((i) => (i - 1 + media.length) % media.length)
                    }
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/85 text-ink shadow-md backdrop-blur-sm transition hover:bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/25"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next media"
                    onClick={() => setMediaIndex((i) => (i + 1) % media.length)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/85 text-ink shadow-md backdrop-blur-sm transition hover:bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/25"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {media.length > 1 && (
              <div className="flex gap-2">
                {media.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMediaIndex(i)}
                    aria-label={
                      m.kind === "video"
                        ? "Play product video"
                        : `Show image ${i + 1}`
                    }
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                      i === mediaIndex
                        ? "border-primary"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    {m.kind === "video" ? (
                      <span className="flex h-full w-full items-center justify-center bg-ink/90 text-white">
                        <Play className="h-5 w-5" />
                      </span>
                    ) : (
                      <img
                        src={m.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* --- Purchase panel --- */}
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {product.category?.name && (
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {product.category.name}
                </span>
              )}
              <SellerBadge seller={product.seller} />
            </div>

            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {product.name}
            </h1>

            <div className="flex items-end gap-2">
              <span className="font-mono text-3xl font-bold text-primary">
                {formatNaira(product.price)}
              </span>
              <span className="pb-1 text-sm text-muted">/ {product.unit}</span>
            </div>

            <p
              className={`text-sm font-semibold ${
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
                  ? `Only ${available} left in stock`
                  : `${available} available`}
              {product.totalSold > 0 && (
                <span className="ml-2 font-normal text-muted">
                  · {product.totalSold} sold
                </span>
              )}
            </p>

            {/* Quantity + CTA (desktop) */}
            <div className="hidden items-center gap-3 lg:flex">
              <div className="flex items-center gap-1 rounded-full border border-border p-1">
                <button
                  type="button"
                  onClick={() => setQty((n) => clampQty(n - 1))}
                  disabled={outOfStock || qty <= 1}
                  aria-label="Reduce quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-8 text-center font-mono text-sm font-bold text-ink">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((n) => clampQty(n + 1))}
                  disabled={outOfStock || qty >= available}
                  aria-label="Increase quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                onClick={() => void onAdd()}
                disabled={outOfStock}
                loading={busy}
                className="flex-1"
              >
                <ShoppingBasket className="h-4 w-4" />
                {inCart ? `Add ${qty} more` : "Add to basket"} ·{" "}
                <span className="font-mono">{formatNaira(product.price * qty)}</span>
              </Button>
            </div>

            {inCart && (
              <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Boxes className="h-4 w-4" /> In basket × {inCart.quantity}
                </span>
                <button
                  type="button"
                  onClick={openCart}
                  className="text-xs font-bold text-primary underline underline-offset-2"
                >
                  View basket
                </button>
              </div>
            )}

            {/* Description */}
            <div className="rounded-3xl border border-border bg-surface p-5">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Description
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
                {product.description}
              </p>
            </div>

            {/* About the seller */}
            {product.seller?.type === "MERCHANT" && (
              <div className="rounded-3xl border border-amber-400/30 bg-amber-50/50 p-5 dark:border-amber-400/20 dark:bg-amber-400/5">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  About the seller
                </h2>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {product.seller.displayName}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Verified member merchant · Listed {formatDate(product.createdAt)}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Sticky mobile CTA */}
      {status === "ready" && product && (
        <div
          className="fixed inset-x-0 bottom-14 z-40 border-t border-border bg-canvas/95 px-4 py-3 backdrop-blur-md md:bottom-0 lg:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
              <button
                type="button"
                onClick={() => setQty((n) => clampQty(n - 1))}
                disabled={outOfStock || qty <= 1}
                aria-label="Reduce quantity"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-primary/5 disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-7 text-center font-mono text-sm font-bold text-ink">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((n) => clampQty(n + 1))}
                disabled={outOfStock || qty >= available}
                aria-label="Increase quantity"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-primary/5 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              onClick={() => void onAdd()}
              disabled={outOfStock}
              loading={busy}
              className="flex-1"
              size="md"
            >
              <ShoppingBasket className="h-4 w-4" />
              {outOfStock ? "Out of stock" : (
                <span className="font-mono">{formatNaira(product.price * qty)}</span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
