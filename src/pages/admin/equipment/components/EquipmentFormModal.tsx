/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Rich multi-section create / edit equipment form (PRD §8).
 *
 * Sections: Identity, Pricing (defaults pre-filled from `equipmentRateConfig`
 * for the chosen category, overridable), Location (map picker with reverse-
 * geocode), Specifications (key-value editor), Images (multi-file uploader →
 * URLs), GPS tracker (deviceId + isActive). Client-validated per PRD §5, submit
 * guarded by `equipment:create` / `equipment:update` (caller gates the trigger).
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminEquipmentStore } from "../../../../store/adminEquipmentStore";
import type {
  AdminEquipmentDetail,
  EquipmentCategory,
  EquipmentFormPayload,
  GeoPoint,
} from "../../../../types/adminEquipment";
import MapPicker from "./MapPicker";
import SpecificationsEditor from "./SpecificationsEditor";
import ImageUploader from "./ImageUploader";

const CATEGORIES: EquipmentCategory[] = [
  "TRACTOR",
  "HARVESTER",
  "PLANTER",
  "SPRAYER",
  "IRRIGATION",
  "OTHER",
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, the form is in edit mode against this equipment. */
  editing?: AdminEquipmentDetail | null;
  onSaved?: (id?: string) => void;
}

interface FormState {
  name: string;
  category: EquipmentCategory;
  model: string;
  serialNumber: string;
  yearOfManufacture: string;
  hourlyRate: string;
  dailyRate: string;
  depositRequired: string;
  location: GeoPoint | null;
  specifications: Record<string, string>;
  images: string[];
  gpsDeviceId: string;
  gpsActive: boolean;
}

function blankForm(): FormState {
  return {
    name: "",
    category: "TRACTOR",
    model: "",
    serialNumber: "",
    yearOfManufacture: "",
    hourlyRate: "",
    dailyRate: "",
    depositRequired: "",
    location: null,
    specifications: {},
    images: [],
    gpsDeviceId: "",
    gpsActive: true,
  };
}

export default function EquipmentFormModal({
  open,
  onClose,
  editing,
  onSaved,
}: Props) {
  const isEdit = !!editing;
  const [form, setForm] = useState<FormState>(blankForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const rateConfig = useAdminEquipmentStore((s) => s.rateConfig);
  const fetchRateConfig = useAdminEquipmentStore((s) => s.fetchRateConfig);
  const createEquipment = useAdminEquipmentStore((s) => s.createEquipment);
  const updateEquipment = useAdminEquipmentStore((s) => s.updateEquipment);

  // Load rate config for prefill (once, silently) when opened.
  useEffect(() => {
    if (open) void fetchRateConfig({ silent: true });
  }, [open, fetchRateConfig]);

  // Seed form from `editing` (or reset) each time it opens.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editing) {
      setForm({
        name: editing.equipmentName ?? "",
        category: editing.category,
        model: editing.model ?? "",
        serialNumber: editing.serialNumber ?? "",
        yearOfManufacture: editing.yearOfManufacture
          ? String(editing.yearOfManufacture)
          : "",
        hourlyRate: editing.hourlyRate ? String(editing.hourlyRate) : "",
        dailyRate: editing.dailyRate ? String(editing.dailyRate) : "",
        depositRequired: editing.depositRequired
          ? String(editing.depositRequired)
          : "",
        location: editing.location ?? null,
        specifications: Object.fromEntries(
          Object.entries(editing.specifications ?? {}).map(([k, v]) => [
            k,
            String(v),
          ])
        ),
        images: editing.images ?? [],
        gpsDeviceId: editing.gpsTracker?.deviceId ?? "",
        gpsActive: editing.gpsTracker?.isActive ?? true,
      });
    } else {
      setForm(blankForm());
    }
  }, [open, editing]);

  const rateForCategory = useMemo(
    () => rateConfig.find((r) => r.category === form.category),
    [rateConfig, form.category]
  );

  // Prefill rates from config when the category changes on a NEW record and the
  // fields are still empty (never clobber a user-typed override or edit value).
  const applyCategory = (category: EquipmentCategory) => {
    const cfg = rateConfig.find((r) => r.category === category);
    setForm((f) => ({
      ...f,
      category,
      hourlyRate:
        !isEdit && !f.hourlyRate && cfg ? String(cfg.defaultHourlyRate) : f.hourlyRate,
      dailyRate:
        !isEdit && !f.dailyRate && cfg ? String(cfg.defaultDailyRate) : f.dailyRate,
    }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required.";
    const hr = Number(form.hourlyRate);
    const dr = Number(form.dailyRate);
    const dep = Number(form.depositRequired);
    if (!form.hourlyRate || hr < 0 || !Number.isFinite(hr))
      e.hourlyRate = "Enter a valid hourly rate (NGN ≥ 0).";
    if (!form.dailyRate || dr < 0 || !Number.isFinite(dr))
      e.dailyRate = "Enter a valid daily rate (NGN ≥ 0).";
    if (form.depositRequired && (dep < 0 || !Number.isFinite(dep)))
      e.depositRequired = "Deposit must be NGN ≥ 0.";
    if (form.yearOfManufacture) {
      const y = Number(form.yearOfManufacture);
      if (!Number.isInteger(y) || y < 1950 || y > new Date().getFullYear() + 1)
        e.yearOfManufacture = "Enter a valid year.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const payload: EquipmentFormPayload = {
      name: form.name.trim(),
      category: form.category,
      model: form.model.trim() || undefined,
      serialNumber: form.serialNumber.trim() || undefined,
      yearOfManufacture: form.yearOfManufacture
        ? Number(form.yearOfManufacture)
        : undefined,
      hourlyRate: Number(form.hourlyRate),
      dailyRate: Number(form.dailyRate),
      depositRequired: form.depositRequired ? Number(form.depositRequired) : 0,
      location: form.location ?? undefined,
      specifications: Object.keys(form.specifications).length
        ? form.specifications
        : undefined,
      images: form.images.length ? form.images : undefined,
      gpsTracker: form.gpsDeviceId.trim()
        ? { deviceId: form.gpsDeviceId.trim(), isActive: form.gpsActive }
        : undefined,
    };

    try {
      if (isEdit && editing) {
        await updateEquipment(editing.id, payload);
        pushToast({ tone: "success", title: "Equipment updated" });
        onSaved?.(editing.id);
      } else {
        const created = await createEquipment(payload);
        pushToast({ tone: "success", title: "Equipment added" });
        onSaved?.(created?.id);
      }
      onClose();
    } catch (err) {
      pushToast({
        tone: "alert",
        title: isEdit ? "Update failed" : "Add failed",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = (key: string) =>
    errors[key] ? "border-danger/60 focus:ring-danger/25" : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit equipment" : "Add equipment"}
      className="max-w-2xl"
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[70vh] space-y-6 overflow-y-auto pr-1"
      >
        {/* Identity */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
            Identity
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="eq-name" error={errors.name} className="sm:col-span-2">
              <Input
                id="eq-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="John Deere 5075E"
                invalid={!!errors.name}
              />
            </Field>
            <Field label="Category" htmlFor="eq-cat">
              <select
                id="eq-cat"
                value={form.category}
                onChange={(e) => applyCategory(e.target.value as EquipmentCategory)}
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Model" htmlFor="eq-model">
              <Input
                id="eq-model"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="5075E"
              />
            </Field>
            <Field label="Serial number" htmlFor="eq-serial">
              <Input
                id="eq-serial"
                value={form.serialNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, serialNumber: e.target.value }))
                }
                placeholder="JD5075E-2024-0142"
              />
            </Field>
            <Field
              label="Year of manufacture"
              htmlFor="eq-year"
              error={errors.yearOfManufacture}
            >
              <Input
                id="eq-year"
                type="number"
                value={form.yearOfManufacture}
                onChange={(e) =>
                  setForm((f) => ({ ...f, yearOfManufacture: e.target.value }))
                }
                placeholder="2024"
                invalid={!!errors.yearOfManufacture}
              />
            </Field>
          </div>
        </section>

        {/* Pricing */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
              Pricing (NGN)
            </h4>
            {rateForCategory && (
              <span className="text-[10px] text-muted">
                Defaults: ₦{rateForCategory.defaultHourlyRate.toLocaleString()}/hr ·
                ₦{rateForCategory.defaultDailyRate.toLocaleString()}/day ·{" "}
                {rateForCategory.depositPercent}% deposit
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Hourly rate" htmlFor="eq-hr" error={errors.hourlyRate}>
              <Input
                id="eq-hr"
                type="number"
                value={form.hourlyRate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hourlyRate: e.target.value }))
                }
                placeholder="4500"
                invalid={!!errors.hourlyRate}
              />
            </Field>
            <Field label="Daily rate" htmlFor="eq-dr" error={errors.dailyRate}>
              <Input
                id="eq-dr"
                type="number"
                value={form.dailyRate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dailyRate: e.target.value }))
                }
                placeholder="30000"
                invalid={!!errors.dailyRate}
              />
            </Field>
            <Field
              label="Deposit required"
              htmlFor="eq-dep"
              error={errors.depositRequired}
            >
              <Input
                id="eq-dep"
                type="number"
                value={form.depositRequired}
                onChange={(e) =>
                  setForm((f) => ({ ...f, depositRequired: e.target.value }))
                }
                placeholder="25000"
                invalid={!!errors.depositRequired}
              />
            </Field>
          </div>
        </section>

        {/* Location */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
            Location
          </h4>
          <MapPicker
            value={form.location}
            onChange={(location) => setForm((f) => ({ ...f, location }))}
          />
        </section>

        {/* Specifications */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
            Specifications
          </h4>
          <SpecificationsEditor
            value={form.specifications}
            onChange={(specifications) =>
              setForm((f) => ({ ...f, specifications }))
            }
          />
        </section>

        {/* Images */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
            Images
          </h4>
          <ImageUploader
            value={form.images}
            onChange={(images) => setForm((f) => ({ ...f, images }))}
          />
        </section>

        {/* GPS tracker */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
            GPS tracker
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
            <Field label="Device ID" htmlFor="eq-gps">
              <Input
                id="eq-gps"
                value={form.gpsDeviceId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gpsDeviceId: e.target.value }))
                }
                placeholder="GPS-JD-0142"
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.gpsActive}
                onClick={() => setForm((f) => ({ ...f, gpsActive: !f.gpsActive }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  form.gpsActive ? "bg-primary" : "bg-border"
                }`}
              >
                <motion.span
                  layout
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
                  style={{ left: form.gpsActive ? 22 : 2 }}
                />
              </button>
              <span className="text-sm font-medium text-ink">
                Tracker active
              </span>
            </label>
          </div>
        </section>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-surface pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? "Save changes" : "Add equipment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
