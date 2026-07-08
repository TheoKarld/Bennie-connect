/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Merchant Hub — Products tab: listing cards with ACTIVE/INACTIVE toggle +
 * moderation chips, inline stock stepper (no re-moderation), and the
 * create/edit modal with the media manager. Content edits warn about
 * re-entering moderation (merchant_panel.md §6.3).
 */

import React, { useEffect, useState } from "react";
import {
  Plus,
  ImageOff,
  Pencil,
  Trash2,
  Minus,
  AlertCircle,
  RefreshCw,
  PackageOpen,
  ShieldAlert,
  Info,
} from "lucide-react";

import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  pushToast,
} from "../../../../components/ui";
import { formatNaira } from "../../../../lib/format";
import { useMerchantStore } from "../../../../store/merchantStore";
import { useMarketplaceStore } from "../../../../store/marketplaceStore";
import type {
  MerchantProduct,
  MerchantProductCreatePayload,
} from "../../../../types/merchant";
import type { FileMetadata } from "../../../../types/upload";
import MediaManager from "./MediaManager";
import { ModerationChip } from "./merchantMeta";

// --- Create / edit modal --------------------------------------------------------

function ProductFormModal({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: MerchantProduct | null;
  onClose: () => void;
}) {
  const createProduct = useMerchantStore((s) => s.createProduct);
  const updateProduct = useMerchantStore((s) => s.updateProduct);
  const categories = useMarketplaceStore((s) => s.categories);
  const fetchCategories = useMarketplaceStore((s) => s.fetchCategories);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [stock, setStock] = useState("");
  const [images, setImages] = useState<FileMetadata[]>([]);
  const [video, setVideo] = useState<FileMetadata | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    void fetchCategories();
    setErrors({});
    if (product) {
      setName(product.name);
      setDescription(product.description);
      setCategoryId(product.categoryId);
      setPrice(String(product.price));
      setUnit(product.unit);
      setStock(String(product.stock?.available ?? 0));
      setImages(product.images ?? []);
      setVideo(product.video ?? null);
    } else {
      setName("");
      setDescription("");
      setCategoryId("");
      setPrice("");
      setUnit("");
      setStock("");
      setImages([]);
      setVideo(null);
    }
  }, [open, product, fetchCategories]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (name.trim().length < 3) next.name = "Name must be at least 3 characters.";
    if (description.trim().length < 10)
      next.description = "Description must be at least 10 characters.";
    if (!categoryId) next.categoryId = "Choose a category.";
    const p = Number(price);
    if (!Number.isInteger(p) || p < 1)
      next.price = "Price must be a whole naira amount (≥ 1).";
    if (!unit.trim() || unit.trim().length > 40)
      next.unit = "Unit is required (max 40 characters).";
    const s = Number(stock);
    if (!Number.isInteger(s) || s < 0)
      next.stock = "Stock must be a whole number (≥ 0).";
    if (images.length < 1) next.images = "Add at least one image.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload: MerchantProductCreatePayload = {
      name: name.trim(),
      description: description.trim(),
      categoryId,
      price: Number(price),
      unit: unit.trim(),
      stock: Number(stock),
      images,
      video,
    };
    try {
      if (product) {
        await updateProduct(product.id, payload);
        pushToast({
          title: "Listing updated",
          message: "Content edits go back through moderation before going live.",
          tone: "success",
        });
      } else {
        await createProduct(payload);
        pushToast({
          title: "Listing created",
          message: "It will appear in the marketplace once approved.",
          tone: "success",
        });
      }
      onClose();
    } catch (err) {
      pushToast({
        title: "Listing",
        message: (err as Error)?.message || "Could not save this listing.",
        tone: "alert",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={product ? "Edit listing" : "New listing"}
      className="max-h-[90vh] max-w-2xl overflow-y-auto"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3.5 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Content edits (name, description, category, price, unit, media) send
          this listing back for admin approval. Stock and visibility changes
          apply immediately.
        </div>

        <Field label="Product name" error={errors.name}>
          <Input
            value={name}
            invalid={Boolean(errors.name)}
            onChange={(e) => setName(e.target.value.slice(0, 120))}
            placeholder="e.g. Hybrid Maize Seeds (10kg)"
          />
        </Field>

        <Field label="Description" error={errors.description}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
            rows={4}
            placeholder="Describe quality, origin, grading, storage…"
            className={`w-full resize-none rounded-2xl border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted/70 transition focus:outline-none focus:ring-2 ${
              errors.description
                ? "border-danger/60 focus:ring-danger/25"
                : "border-border focus:border-primary focus:ring-primary/15"
            }`}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category" error={errors.categoryId}>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`w-full rounded-2xl border bg-surface px-4 py-3 text-sm text-ink transition focus:outline-none focus:ring-2 ${
                errors.categoryId
                  ? "border-danger/60 focus:ring-danger/25"
                  : "border-border focus:border-primary focus:ring-primary/15"
              }`}
            >
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unit" error={errors.unit} hint='e.g. "50kg Bag", "1L Bottle"'>
            <Input
              value={unit}
              invalid={Boolean(errors.unit)}
              onChange={(e) => setUnit(e.target.value.slice(0, 40))}
              placeholder="50kg Bag"
            />
          </Field>
          <Field label="Price (₦ per unit)" error={errors.price}>
            <Input
              value={price}
              invalid={Boolean(errors.price)}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="18500"
              inputMode="numeric"
            />
          </Field>
          <Field label="Stock (units)" error={errors.stock}>
            <Input
              value={stock}
              invalid={Boolean(errors.stock)}
              onChange={(e) => setStock(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="45"
              inputMode="numeric"
            />
          </Field>
        </div>

        <div>
          <MediaManager
            images={images}
            video={video}
            disabled={saving}
            onChange={(next) => {
              setImages(next.images);
              setVideo(next.video);
              setErrors((e) => ({ ...e, images: "" }));
            }}
          />
          {errors.images && (
            <p className="mt-1.5 text-xs font-medium text-danger">
              {errors.images}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            {product ? "Save changes" : "Create listing"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Listing card ---------------------------------------------------------------------

function ListingCard({
  product,
  readOnly,
  onEdit,
  onDelete,
}: {
  product: MerchantProduct;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const updateProduct = useMerchantStore((s) => s.updateProduct);
  const [busy, setBusy] = useState(false);

  const stock = product.stock?.available ?? 0;
  const image = product.images?.[0]?.url ?? null;

  const patch = async (
    body: Parameters<typeof updateProduct>[1],
    success?: string
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await updateProduct(product.id, body);
      if (success) {
        pushToast({ title: "Listing", message: success, tone: "success", duration: 2200 });
      }
    } catch (err) {
      pushToast({
        title: "Listing",
        message: (err as Error)?.message || "Could not update this listing.",
        tone: "alert",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
      {/* Thumb */}
      <div className="h-20 w-full shrink-0 overflow-hidden rounded-2xl bg-surface-2 sm:h-20 sm:w-20">
        {image ? (
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <ImageOff className="h-5 w-5 opacity-40" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <ModerationChip status={product.moderationStatus} />
          {product.isSuspended && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <ShieldAlert className="h-3 w-3" /> Suspended by admin
            </span>
          )}
          {product.status === "INACTIVE" && <Badge tone="neutral">Hidden</Badge>}
        </div>
        <p className="truncate text-sm font-semibold text-ink">{product.name}</p>
        <p className="font-mono text-xs text-muted">
          {formatNaira(product.price)} / {product.unit}
        </p>
        {product.moderationStatus === "REJECTED" && product.moderationNote && (
          <p className="rounded-xl bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            Moderator: {product.moderationNote}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
        {/* Stock stepper (no re-moderation) */}
        <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
          <button
            type="button"
            onClick={() => void patch({ stock: Math.max(0, stock - 1) })}
            disabled={busy || readOnly || stock <= 0}
            aria-label="Reduce stock"
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink transition hover:bg-primary/5 disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-8 text-center font-mono text-xs font-bold text-ink">
            {stock}
          </span>
          <button
            type="button"
            onClick={() => void patch({ stock: stock + 1 })}
            disabled={busy || readOnly}
            aria-label="Increase stock"
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink transition hover:bg-primary/5 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* ACTIVE/INACTIVE toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={product.status === "ACTIVE"}
            aria-label="Toggle listing visibility"
            disabled={busy || readOnly}
            onClick={() =>
              void patch(
                { status: product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
                product.status === "ACTIVE"
                  ? "Listing hidden from buyers."
                  : "Listing visible to buyers (once approved)."
              )
            }
            className={`relative h-6 w-11 rounded-full transition disabled:opacity-40 ${
              product.status === "ACTIVE" ? "bg-primary" : "bg-muted/30"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                product.status === "ACTIVE" ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>

          <button
            type="button"
            onClick={onEdit}
            disabled={readOnly}
            aria-label="Edit listing"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-primary/10 hover:text-primary disabled:opacity-40"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={readOnly}
            aria-label="Delete listing"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Tab ---------------------------------------------------------------------------------

export default function ProductsTab({ readOnly }: { readOnly: boolean }) {
  const products = useMerchantStore((s) => s.products);
  const status = useMerchantStore((s) => s.productsStatus);
  const error = useMerchantStore((s) => s.productsError);
  const fetchProducts = useMerchantStore((s) => s.fetchProducts);
  const deleteProduct = useMerchantStore((s) => s.deleteProduct);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MerchantProduct | null>(null);
  const [deleting, setDeleting] = useState<MerchantProduct | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteProduct(deleting.id);
      pushToast({
        title: "Listing deleted",
        message: deleting.name,
        tone: "success",
      });
      setDeleting(null);
    } catch (err) {
      pushToast({
        title: "Delete listing",
        message: (err as Error)?.message || "Could not delete this listing.",
        tone: "alert",
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {status === "ready"
            ? `${products.length} listing${products.length === 1 ? "" : "s"}`
            : "Your listings"}
        </p>
        <Button
          size="sm"
          disabled={readOnly}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New listing
        </Button>
      </div>

      {readOnly && (
        <p className="rounded-2xl bg-surface-2 px-4 py-2.5 text-xs font-semibold text-muted">
          Listings are read-only while your account is suspended.
        </p>
      )}

      {status === "loading" && products.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-surface-2" />
          ))}
        </div>
      ) : status === "error" && products.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface py-14 text-center">
          <AlertCircle className="mx-auto mb-2 h-6 w-6 text-danger" />
          <p className="text-sm font-semibold text-ink">
            Couldn&apos;t load your listings
          </p>
          <p className="mt-1 text-xs text-muted">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void fetchProducts()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
            <PackageOpen className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-ink">No listings yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            Create your first product — it goes live once an admin approves it.
          </p>
          {!readOnly && (
            <Button
              size="sm"
              className="mt-4"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Create your first listing
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <ListingCard
              key={p.id}
              product={p}
              readOnly={readOnly}
              onEdit={() => {
                setEditing(p);
                setFormOpen(true);
              }}
              onDelete={() => setDeleting(p)}
            />
          ))}
        </div>
      )}

      <ProductFormModal
        open={formOpen}
        product={editing}
        onClose={() => setFormOpen(false)}
      />

      {/* Delete confirm */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Delete this listing?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">{deleting?.name}</span>{" "}
            will be removed from the marketplace. Existing orders keep their
            purchase records.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              disabled={deleteBusy}
              onClick={() => setDeleting(null)}
            >
              Keep listing
            </Button>
            <Button
              loading={deleteBusy}
              onClick={() => void confirmDelete()}
              className="bg-danger shadow-danger/20 hover:brightness-110"
            >
              Delete listing
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
