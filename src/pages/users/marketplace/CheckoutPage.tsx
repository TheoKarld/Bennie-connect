/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Checkout (`/app/marketplace/checkout`) — delivery address, per-seller
 * order-split preview, wallet balance / insufficient-balance top-up prompt,
 * single-submit place-order and the success (checkout group) screen.
 * Handles MKT_007 / MKT_008 / MKT_009 / MKT_011 with friendly branches.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  ShoppingBasket,
  Wallet,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

import { Button, Field, pushToast } from "../../../components/ui";
import { formatNaira } from "../../../lib/format";
import {
  MarketplaceActionError,
  useMarketplaceStore,
} from "../../../store/marketplaceStore";
import type { CheckoutResult } from "../../../types/marketplace";
import {
  CART_ISSUE_COPY,
  OrderStatusChip,
  SellerBadge,
} from "./components/marketplaceMeta";

const ADDRESS_MIN = 10;
const ADDRESS_MAX = 300;

function SuccessScreen({ result }: { result: CheckoutResult }) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <motion.div
          initial={reduce ? false : { scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10"
        >
          <CheckCircle2 className="h-9 w-9 text-success" />
        </motion.div>
        <h1 className="font-display text-2xl font-semibold text-ink">
          Payment successful
        </h1>
        <p className="mt-1 text-sm text-muted">
          <span className="font-mono font-bold text-ink">
            {formatNaira(result.grandTotal)}
          </span>{" "}
          paid from your wallet — {result.orders.length} order
          {result.orders.length === 1 ? "" : "s"} placed.
        </p>
        <p className="mt-2 font-mono text-[11px] text-muted">
          Ref {result.walletPaymentRef}
        </p>
      </div>

      <div className="space-y-3">
        {result.orders.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => navigate(`/app/marketplace/orders/${o.id}`)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-primary/25 hover:shadow-md"
          >
            <div className="min-w-0 space-y-1.5">
              <SellerBadge seller={o.seller} />
              <p className="font-mono text-xs text-muted">{o.orderNumber}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-mono text-sm font-bold text-ink">
                {formatNaira(o.totalAmount)}
              </span>
              <OrderStatusChip status={o.status} />
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button fullWidth onClick={() => navigate("/app/marketplace/orders")}>
          Track orders <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          fullWidth
          variant="outline"
          onClick={() => navigate("/app/marketplace")}
        >
          Continue shopping
        </Button>
      </div>
    </motion.div>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();

  const cart = useMarketplaceStore((s) => s.cart);
  const cartStatus = useMarketplaceStore((s) => s.cartStatus);
  const fetchCart = useMarketplaceStore((s) => s.fetchCart);
  const checkout = useMarketplaceStore((s) => s.checkout);
  const placingOrder = useMarketplaceStore((s) => s.placingOrder);
  const orderGroups = useMarketplaceStore((s) => s.orderGroups);
  const fetchOrders = useMarketplaceStore((s) => s.fetchOrders);

  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  useEffect(() => {
    void fetchCart();
    // Load the latest order so the address can be prefilled.
    if (orderGroups.length === 0) void fetchOrders({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill from the last order's address (once, if untouched).
  const lastAddress = orderGroups[0]?.deliveryAddress ?? "";
  useEffect(() => {
    if (!address && lastAddress) setAddress(lastAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAddress]);

  const items = cart?.items ?? [];
  const validItems = items.filter((i) => i.valid);
  const invalidItems = items.filter((i) => !i.valid);
  const grandTotal = cart?.grandTotal ?? 0;
  const walletAvailable = cart?.wallet.available ?? 0;
  const insufficient = grandTotal > walletAvailable;
  const shortfall = Math.max(0, grandTotal - walletAvailable);
  const balanceAfter = walletAvailable - grandTotal;

  // Group valid lines under their seller for the split preview.
  const sellerLines = useMemo(() => {
    if (!cart) return [];
    return cart.sellerGroups.map((group) => {
      const key =
        group.seller.type === "MERCHANT"
          ? `M:${group.seller.merchantId}`
          : "PLATFORM";
      const lines = validItems.filter((i) => {
        const s = i.product?.seller;
        const k = s?.type === "MERCHANT" ? `M:${s.merchantId}` : "PLATFORM";
        return k === key;
      });
      return { group, lines };
    });
  }, [cart, validItems]);

  const trimmed = address.trim();
  const addressValid =
    trimmed.length >= ADDRESS_MIN && trimmed.length <= ADDRESS_MAX;
  const canPlace =
    Boolean(cart) &&
    !cart?.checkoutBlocked &&
    !insufficient &&
    addressValid &&
    !placingOrder;

  const placeOrder = async () => {
    setAddressError(null);
    setConflict(null);
    if (!addressValid) {
      setAddressError(
        `Enter a delivery address of ${ADDRESS_MIN}–${ADDRESS_MAX} characters.`
      );
      return;
    }
    try {
      const res = await checkout(trimmed);
      setResult(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const e = err as MarketplaceActionError;
      switch (e.code) {
        case "MKT_008":
          setAddressError("The delivery address looks invalid — check it and try again.");
          break;
        case "MKT_009": {
          const req = Number(e.details?.required ?? grandTotal);
          const avail = Number(e.details?.available ?? walletAvailable);
          pushToast({
            title: "Insufficient balance",
            message: `You need ${formatNaira(req - avail)} more in your wallet to complete this order.`,
            tone: "warning",
          });
          void fetchCart({ silent: true });
          break;
        }
        case "MKT_011":
          setConflict(
            "Some items changed while you were checking out (stock or availability). Review your basket and try again."
          );
          break;
        case "MKT_007":
          setConflict("Your basket is empty — nothing to check out.");
          break;
        default:
          pushToast({
            title: "Checkout",
            message: e.message || "Checkout could not be completed.",
            tone: "alert",
          });
      }
    }
  };

  if (result) {
    return <SuccessScreen result={result} />;
  }

  // Loading skeleton.
  if (cartStatus === "loading" && !cart) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-full bg-surface-2" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl bg-surface-2" />
        ))}
      </div>
    );
  }

  // Empty basket.
  if (cart && items.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="rounded-3xl border border-border bg-surface p-10 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
            <ShoppingBasket className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-lg font-semibold text-ink">
            Your basket is empty
          </h1>
          <p className="mt-1 text-sm text-muted">
            Add products from the marketplace before checking out.
          </p>
          <Button className="mt-5" onClick={() => navigate("/app/marketplace")}>
            Browse marketplace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/app/marketplace"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </Link>
      </div>

      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Checkout
      </h1>

      {conflict && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {conflict}{" "}
            <button
              type="button"
              onClick={() => void fetchCart()}
              className="font-bold underline underline-offset-2"
            >
              Refresh basket
            </button>
          </div>
        </div>
      )}

      {invalidItems.length > 0 && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-400/10">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {invalidItems.length} item{invalidItems.length === 1 ? "" : "s"} in
            your basket need attention before checkout:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-800/90 dark:text-amber-300/90">
            {invalidItems.map((i) => (
              <li key={i.itemId}>
                • {i.product?.name ?? "Unavailable product"} —{" "}
                {CART_ISSUE_COPY[i.issue ?? ""] ?? "unavailable"}
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => useMarketplaceStore.getState().openCart()}
          >
            Open basket to fix
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left column: address + split preview */}
        <div className="space-y-6">
          {/* Delivery address */}
          <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <MapPin className="h-4 w-4 text-primary" /> Delivery address
            </h2>
            <p className="mt-1 text-xs text-muted">
              One address for this whole purchase — every seller delivers here.
            </p>
            <div className="mt-4">
              <Field
                error={addressError ?? undefined}
                hint={`${trimmed.length}/${ADDRESS_MAX} characters (minimum ${ADDRESS_MIN})`}
              >
                <textarea
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value.slice(0, ADDRESS_MAX));
                    setAddressError(null);
                  }}
                  rows={3}
                  placeholder="e.g. Kano State Maize Hub, Sector A3, Kano"
                  aria-label="Delivery address"
                  className={`w-full resize-none rounded-2xl border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted/70 transition focus:outline-none focus:ring-2 ${
                    addressError
                      ? "border-danger/60 focus:ring-danger/25"
                      : "border-border focus:border-primary focus:ring-primary/15"
                  }`}
                />
              </Field>
            </div>
          </section>

          {/* Per-seller split preview */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">
              Your purchase creates {sellerLines.length} order
              {sellerLines.length === 1 ? "" : "s"}
            </h2>
            {sellerLines.map(({ group, lines }, gi) => (
              <div
                key={gi}
                className="rounded-3xl border border-border bg-surface p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <SellerBadge seller={group.seller} />
                  <span className="font-mono text-sm font-bold text-ink">
                    {formatNaira(group.subtotal)}
                  </span>
                </div>
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {lines.map((line) => (
                    <div
                      key={line.itemId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate text-ink">
                        {line.product?.name}
                        <span className="ml-1.5 font-mono text-xs text-muted">
                          × {line.quantity}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs font-semibold text-ink">
                        {formatNaira(line.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* Right column: payment summary */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <div
            className={`rounded-3xl border p-5 ${
              insufficient
                ? "border-rose-400/50 bg-rose-50/70 dark:border-rose-400/30 dark:bg-rose-500/5"
                : "border-border bg-surface"
            }`}
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Wallet className="h-4 w-4 text-primary" /> Pay from wallet
            </h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Items total</dt>
                <dd className="font-mono font-bold text-ink">
                  {formatNaira(grandTotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Delivery fee</dt>
                <dd className="text-xs font-semibold text-muted">
                  Settled with seller
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <dt className="text-muted">Wallet balance</dt>
                <dd className="font-mono font-semibold text-ink">
                  {formatNaira(walletAvailable)}
                </dd>
              </div>
              {!insufficient && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Balance after</dt>
                  <dd className="font-mono font-semibold text-primary">
                    {formatNaira(balanceAfter)}
                  </dd>
                </div>
              )}
            </dl>

            {insufficient ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                  You&apos;re {formatNaira(shortfall)} short.
                </p>
                <Button
                  fullWidth
                  onClick={() => navigate("/app/wallet")}
                  className="bg-rose-600 shadow-rose-600/20 hover:brightness-110"
                >
                  Top up {formatNaira(shortfall)} to complete
                </Button>
                <button
                  type="button"
                  onClick={() => void fetchCart({ silent: true })}
                  className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-muted transition hover:text-ink"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> I&apos;ve topped up — refresh
                </button>
              </div>
            ) : (
              <Button
                fullWidth
                className="mt-4"
                disabled={!canPlace}
                loading={placingOrder}
                onClick={() => void placeOrder()}
              >
                Place order · {formatNaira(grandTotal)}
              </Button>
            )}

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              One secure wallet debit — cancel pending orders for a full refund.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
