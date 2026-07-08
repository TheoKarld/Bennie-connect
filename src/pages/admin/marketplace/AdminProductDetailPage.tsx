/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin product detail (`/bennie/market-place/products/:id`).
 *
 * Tabs: Details / Media, Inventory (adjust with confirm modal), Moderation
 * history timeline, Orders containing this product (deep-link to
 * `/bennie/orders?productId=…`). Header actions: edit (wizard), delete
 * (Super-Admin-only). Server-backed via `adminMarketplaceStore`,
 * permission-aware, light/dark aware.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Boxes,
  Film,
  History,
  Package,
  Pencil,
  ShoppingBag,
  Trash2,
} from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../components/ui";
import PermissionGate from "../../../components/admin/PermissionGate";
import { useAdminAuth } from "../../../hooks/useAdminAuth";
import { useAdminMarketplaceStore } from "../../../store/adminMarketplaceStore";
import ProductWizard from "./components/ProductWizard";
import ReasonModal from "./components/ReasonModal";
import {
  EarningChip,
  ErrorBlock,
  InfoRow,
  KycChip,
  ListingStatusChip,
  LoadingBlock,
  ModerationChip,
  SourcePill,
  dateTimeLabel,
  ngn,
  titleCase,
} from "./components/shared";

type TabKey = "details" | "inventory" | "history";

export default function AdminProductDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const detail = useAdminMarketplaceStore((s) => s.detail);
  const status = useAdminMarketplaceStore((s) => s.detailStatus);
  const error = useAdminMarketplaceStore((s) => s.detailError);
  const loadProduct = useAdminMarketplaceStore((s) => s.loadProduct);
  const clearDetail = useAdminMarketplaceStore((s) => s.clearDetail);
  const patchInventory = useAdminMarketplaceStore((s) => s.patchInventory);
  const deleteProduct = useAdminMarketplaceStore((s) => s.deleteProduct);
  const lowStockThreshold = useAdminMarketplaceStore((s) => s.lowStockThreshold);

  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("marketplace:update");
  const canDelete = hasPermission("marketplace:delete");

  const [tab, setTab] = useState<TabKey>("details");
  const [editOpen, setEditOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [available, setAvailable] = useState("");
  const [threshold, setThreshold] = useState("");
  const [savingInv, setSavingInv] = useState(false);

  useEffect(() => {
    if (id) void loadProduct(id);
    return () => clearDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (detail) {
      setAvailable(String(detail.inventory?.available ?? 0));
      setThreshold(
        detail.inventory?.lowStockThreshold != null
          ? String(detail.inventory.lowStockThreshold)
          : ""
      );
    }
  }, [detail]);

  const saveInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInv(true);
    try {
      await patchInventory(id, {
        available: available ? Number(available) : undefined,
        lowStockThreshold: threshold ? Number(threshold) : null,
      });
      pushToast({ tone: "success", title: "Inventory updated" });
      setInvOpen(false);
    } catch (err) {
      pushToast({
        tone: "alert",
        title: "Update failed",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSavingInv(false);
    }
  };

  const doDelete = async () => {
    await deleteProduct(id);
    pushToast({ tone: "success", title: "Product deleted" });
    navigate("/bennie/market-place");
  };

  return (
    <PermissionGate anyOf={["marketplace:view"]}>
      <div className="space-y-6">
        <Link
          to="/bennie/market-place"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </Link>

        {status === "loading" && <LoadingBlock label="Loading product" />}
        {status === "error" && (
          <ErrorBlock
            message={error ?? "Unable to load this product."}
            onRetry={() => void loadProduct(id)}
          />
        )}

        {status === "ready" && detail && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {detail.images?.[0]?.url ? (
                  <img
                    src={detail.images[0].url}
                    alt={detail.name}
                    className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                    <Package className="h-8 w-8" />
                  </span>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-semibold text-ink">
                      {detail.name}
                    </h1>
                    <SourcePill source={detail.source} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {detail.category?.name ?? "—"} · {detail.unit} ·{" "}
                    {detail.productId ?? detail.id}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <ModerationChip status={detail.moderationStatus} />
                    <ListingStatusChip status={detail.status} />
                    {detail.suspended && (
                      <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[9px] font-bold uppercase text-danger">
                        Delisted
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {canUpdate && (
                  <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="!text-danger hover:!bg-danger/5"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
              {(
                [
                  { key: "details", label: "Details", icon: Package },
                  { key: "inventory", label: "Inventory", icon: Boxes },
                  { key: "history", label: "Moderation", icon: History },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                      tab === t.key
                        ? "bg-primary text-white"
                        : "text-muted hover:bg-primary/8 hover:text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Details tab */}
            {tab === "details" && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                  <div className="rounded-3xl border border-border bg-surface/70 p-5">
                    <h3 className="mb-2 font-display text-sm font-semibold text-ink">
                      Description
                    </h3>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
                      {detail.description || "—"}
                    </p>
                  </div>
                  {(detail.images?.length > 0 || detail.video) && (
                    <div className="rounded-3xl border border-border bg-surface/70 p-5">
                      <h3 className="mb-3 font-display text-sm font-semibold text-ink">
                        Media
                      </h3>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {detail.images?.map((m) => (
                          <img
                            key={m.id}
                            src={m.url}
                            alt={m.originalName ?? detail.name}
                            className="aspect-square w-full rounded-2xl object-cover"
                          />
                        ))}
                      </div>
                      {detail.video?.url && (
                        <a
                          href={detail.video.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary/8 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15"
                        >
                          <Film className="h-4 w-4" /> View product video
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-border bg-surface/70 p-5">
                    <InfoRow label="Price" value={ngn(detail.price)} />
                    <InfoRow
                      label="Stock"
                      value={`${detail.inventory?.available ?? 0} ${detail.unit}`}
                    />
                    <InfoRow label="Reserved" value={detail.inventory?.reserved ?? 0} />
                    <InfoRow label="Total sales" value={detail.totalSales ?? 0} />
                    <InfoRow label="Created" value={dateTimeLabel(detail.createdAt)} />
                  </div>
                  {detail.merchant && (
                    <Link
                      to={`/bennie/merchants/${detail.merchant.id}`}
                      className="block rounded-3xl border border-border bg-surface/70 p-5 transition hover:border-primary/30"
                    >
                      <h3 className="mb-2 font-display text-sm font-semibold text-ink">
                        Seller
                      </h3>
                      <p className="text-sm font-semibold text-ink">
                        {detail.merchant.businessName}
                      </p>
                      <div className="mt-1.5">
                        <KycChip status={detail.merchant.kycStatus as never} />
                      </div>
                    </Link>
                  )}
                  <Link
                    to={`/bennie/orders?productId=${detail.id}`}
                    className="flex items-center justify-between gap-2 rounded-3xl border border-border bg-surface/70 p-5 transition hover:border-primary/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                      <span className="text-sm font-semibold text-ink">
                        Orders containing this product
                      </span>
                    </div>
                    <ArrowLeft className="h-4 w-4 rotate-180 text-muted" />
                  </Link>
                </div>
              </div>
            )}

            {/* Inventory tab */}
            {tab === "inventory" && (
              <div className="max-w-md space-y-4 rounded-3xl border border-border bg-surface/70 p-5">
                <InfoRow
                  label="Available"
                  value={`${detail.inventory?.available ?? 0} ${detail.unit}`}
                />
                <InfoRow label="Reserved" value={detail.inventory?.reserved ?? 0} />
                <InfoRow
                  label="Low-stock threshold"
                  value={detail.inventory?.lowStockThreshold ?? lowStockThreshold}
                />
                {canUpdate && (
                  <Button className="mt-2" size="sm" onClick={() => setInvOpen(true)}>
                    Adjust inventory
                  </Button>
                )}
              </div>
            )}

            {/* Moderation history */}
            {tab === "history" && (
              <div className="rounded-3xl border border-border bg-surface/70 p-5">
                {(!detail.moderationHistory || detail.moderationHistory.length === 0) && (
                  <p className="py-8 text-center text-sm text-muted">
                    No moderation history recorded.
                  </p>
                )}
                {detail.moderationHistory && detail.moderationHistory.length > 0 && (
                  <ol className="space-y-4">
                    {detail.moderationHistory.map((h) => (
                      <li key={h.id} className="flex gap-3">
                        <span
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                            h.decision === "REJECTED"
                              ? "bg-danger"
                              : h.decision === "APPROVED" ||
                                  h.decision === "AUTO_APPROVED"
                                ? "bg-primary"
                                : "bg-accent"
                          }`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-ink">
                            {titleCase(h.decision)}
                          </p>
                          <p className="text-[11px] text-muted">
                            {dateTimeLabel(h.reviewedAt ?? h.createdAt)}
                          </p>
                          {h.reason && (
                            <p className="mt-0.5 text-xs text-muted">{h.reason}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Edit wizard */}
        {detail && canUpdate && (
          <ProductWizard
            open={editOpen}
            onClose={() => setEditOpen(false)}
            editing={detail}
            defaultThreshold={lowStockThreshold}
          />
        )}

        {/* Inventory modal */}
        <Modal open={invOpen} onClose={() => setInvOpen(false)} title="Adjust inventory">
          <form onSubmit={saveInventory} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Available" htmlFor="inv-avail">
                <Input
                  id="inv-avail"
                  type="number"
                  value={available}
                  onChange={(e) => setAvailable(e.target.value)}
                />
              </Field>
              <Field label="Low-stock threshold" htmlFor="inv-thr">
                <Input
                  id="inv-thr"
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setInvOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={savingInv}>
                Save
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete confirm */}
        <ReasonModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          title="Delete product"
          confirmLabel="Delete permanently"
          tone="danger"
          reasonRequired={false}
          reasonLabel="Note"
          description="This permanently deletes the product and cascade-deletes its media. Blocked while non-terminal orders contain it."
          onConfirm={doDelete}
        />
      </div>
    </PermissionGate>
  );
}
