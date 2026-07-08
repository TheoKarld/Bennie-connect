/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 4-step admin product wizard (create / edit a PLATFORM product — PRD §8).
 *
 * Steps: Basics → Pricing & Inventory → Media (3 images + 1 video via
 * `adminUpload`) → Review. A progress stepper, per-step validation, draft state
 * held client-side. Admin-created products publish immediately (no moderation).
 * On submit calls `POST /marketplace/products` (create) or `PATCH` (edit).
 * Guarded by `marketplace:create` / `marketplace:update` (caller gates the
 * trigger). Brand tokens, full light/dark support.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Info } from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminMarketplaceStore } from "../../../../store/adminMarketplaceStore";
import type {
  AdminProductDetail,
  AdminProductPayload,
} from "../../../../types/adminMarketplace";
import type { FileMetadata } from "../../../../types/upload";
import ProductMediaUploader from "./ProductMediaUploader";
import { ModerationChip, ngn } from "./shared";

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: AdminProductDetail | null;
  /** Default low-stock threshold (settings) for prefill. */
  defaultThreshold?: number;
  onSaved?: (id?: string) => void;
}

interface FormState {
  name: string;
  categoryId: string;
  unit: string;
  description: string;
  price: string;
  available: string;
  lowStockThreshold: string;
  images: FileMetadata[];
  video: FileMetadata | null;
}

const STEPS = ["Basics", "Pricing & Inventory", "Media", "Review"] as const;

function blankForm(threshold?: number): FormState {
  return {
    name: "",
    categoryId: "",
    unit: "",
    description: "",
    price: "",
    available: "",
    lowStockThreshold: threshold != null ? String(threshold) : "",
    images: [],
    video: null,
  };
}

export default function ProductWizard({
  open,
  onClose,
  editing,
  defaultThreshold,
  onSaved,
}: Props) {
  const isEdit = !!editing;
  const categories = useAdminMarketplaceStore((s) => s.categories);
  const fetchCategories = useAdminMarketplaceStore((s) => s.fetchCategories);
  const createProduct = useAdminMarketplaceStore((s) => s.createProduct);
  const updateProduct = useAdminMarketplaceStore((s) => s.updateProduct);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => blankForm(defaultThreshold));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive || c.id === form.categoryId),
    [categories, form.categoryId]
  );

  useEffect(() => {
    if (open) void fetchCategories({ silent: true });
  }, [open, fetchCategories]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setErrors({});
    if (editing) {
      setForm({
        name: editing.name ?? "",
        categoryId: editing.categoryId ?? editing.category?.id ?? "",
        unit: editing.unit ?? "",
        description: editing.description ?? "",
        price: editing.price != null ? String(editing.price) : "",
        available:
          editing.inventory?.available != null
            ? String(editing.inventory.available)
            : "",
        lowStockThreshold:
          editing.inventory?.lowStockThreshold != null
            ? String(editing.inventory.lowStockThreshold)
            : "",
        images: editing.images ?? [],
        video: editing.video ?? null,
      });
    } else {
      setForm(blankForm(defaultThreshold));
    }
  }, [open, editing, defaultThreshold]);

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (form.name.trim().length < 3) e.name = "Name must be at least 3 characters.";
      if (!form.categoryId) e.categoryId = "Choose a category.";
      if (!form.unit.trim()) e.unit = "Unit is required (e.g. 50kg Bag).";
      if (form.description.trim().length < 10)
        e.description = "Description must be at least 10 characters.";
    }
    if (s === 1) {
      const price = Number(form.price);
      if (!form.price || !Number.isFinite(price) || price <= 0)
        e.price = "Enter a price greater than 0.";
      const avail = Number(form.available);
      if (form.available && (!Number.isInteger(avail) || avail < 0))
        e.available = "Stock must be 0 or more.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validateStep(step)) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    if (!validateStep(0) || !validateStep(1)) {
      setStep(0);
      return;
    }
    setSubmitting(true);
    const payload: AdminProductPayload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      unit: form.unit.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      inventory: {
        available: form.available ? Number(form.available) : 0,
        lowStockThreshold: form.lowStockThreshold
          ? Number(form.lowStockThreshold)
          : null,
      },
      images: form.images,
      video: form.video,
    };
    try {
      if (isEdit && editing) {
        await updateProduct(editing.id, payload);
        pushToast({ tone: "success", title: "Product updated" });
        onSaved?.(editing.id);
      } else {
        const created = await createProduct(payload);
        pushToast({ tone: "success", title: "Product published" });
        onSaved?.(created?.id);
      }
      onClose();
    } catch (err) {
      pushToast({
        tone: "alert",
        title: isEdit ? "Update failed" : "Publish failed",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selCat = categories.find((c) => c.id === form.categoryId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit product" : "New platform product"}
      className="max-w-2xl"
    >
      {/* Stepper */}
      <div className="mb-5 flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                  i < step
                    ? "bg-primary text-white"
                    : i === step
                      ? "bg-primary text-white ring-4 ring-primary/15"
                      : "bg-surface-2 text-muted"
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={`hidden text-[11px] font-semibold sm:inline ${
                  i === step ? "text-ink" : "text-muted"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="h-px flex-1 bg-border" />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
        {/* Step 0 — Basics */}
        {step === 0 && (
          <section className="space-y-3">
            <Field label="Product name" htmlFor="pw-name" error={errors.name}>
              <Input
                id="pw-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="NPK 20-10-10 Fertilizer"
                invalid={!!errors.name}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Category" htmlFor="pw-cat" error={errors.categoryId}>
                <select
                  id="pw-cat"
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoryId: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">Select a category…</option>
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {!c.isActive ? " (inactive)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unit" htmlFor="pw-unit" error={errors.unit}>
                <Input
                  id="pw-unit"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="50kg Bag"
                  invalid={!!errors.unit}
                />
              </Field>
            </div>
            <Field
              label="Description"
              htmlFor="pw-desc"
              error={errors.description}
            >
              <textarea
                id="pw-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={4}
                placeholder="Premium compound fertilizer for maize and rice."
                className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </Field>
          </section>
        )}

        {/* Step 1 — Pricing & Inventory */}
        {step === 1 && (
          <section className="space-y-3">
            <Field label="Price (NGN)" htmlFor="pw-price" error={errors.price}>
              <Input
                id="pw-price"
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="42000"
                invalid={!!errors.price}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Available stock"
                htmlFor="pw-avail"
                error={errors.available}
              >
                <Input
                  id="pw-avail"
                  type="number"
                  value={form.available}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, available: e.target.value }))
                  }
                  placeholder="120"
                  invalid={!!errors.available}
                />
              </Field>
              <Field
                label="Low-stock threshold"
                htmlFor="pw-thr"
                hint="Alerts when stock hits this level."
              >
                <Input
                  id="pw-thr"
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))
                  }
                  placeholder={String(defaultThreshold ?? 10)}
                />
              </Field>
            </div>
          </section>
        )}

        {/* Step 2 — Media */}
        {step === 2 && (
          <ProductMediaUploader
            images={form.images}
            video={form.video}
            onImagesChange={(images) => setForm((f) => ({ ...f, images }))}
            onVideoChange={(video) => setForm((f) => ({ ...f, video }))}
          />
        )}

        {/* Step 3 — Review */}
        {step === 3 && (
          <section className="space-y-4">
            {!isEdit && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-ink">
                  Admin products publish immediately — no moderation.{" "}
                  <ModerationChip status="APPROVED" />
                </p>
              </div>
            )}
            <div className="rounded-3xl border border-border bg-surface-2 p-4">
              <div className="flex gap-4">
                {form.images[0] ? (
                  <img
                    src={form.images[0].url}
                    alt={form.name}
                    className="h-24 w-24 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-border/40 text-[10px] text-muted">
                    No image
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold text-ink">
                    {form.name || "Untitled product"}
                  </p>
                  <p className="text-xs text-muted">
                    {selCat?.name ?? "—"} · {form.unit || "—"}
                  </p>
                  <p className="mt-1 text-lg font-bold text-primary">
                    {ngn(Number(form.price) || 0)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {form.available || 0} in stock ·{" "}
                    {form.images.length} image(s)
                    {form.video ? " · 1 video" : ""}
                  </p>
                </div>
              </div>
              {form.description && (
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted">
                  {form.description}
                </p>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Footer nav */}
      <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={step === 0 ? onClose : back}
        >
          {step === 0 ? (
            "Cancel"
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" /> Back
            </>
          )}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" loading={submitting} onClick={submit}>
            {isEdit ? "Save changes" : "Publish product"}
          </Button>
        )}
      </div>
    </Modal>
  );
}
