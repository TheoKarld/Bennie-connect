/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Create / edit geofence modal (PRD §2.2, §3.4). Circle geofences (center +
 * radius) are set with the map picker; polygon is a deferred advanced case
 * (draw-on-map) — this phase supports CIRCLE with a map-picked center, plus
 * scope (ALL / CATEGORY). Guarded by `equipment:configure` at the call site.
 */

import React, { useEffect, useState } from "react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminEquipmentStore } from "../../../../store/adminEquipmentStore";
import type {
  EquipmentCategory,
  Geofence,
  GeofencePayload,
} from "../../../../types/adminEquipment";
import MapPicker from "./MapPicker";

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
  editing?: Geofence | null;
}

export default function GeofenceModal({ open, onClose, editing }: Props) {
  const isEdit = !!editing;
  const createGeofence = useAdminEquipmentStore((s) => s.createGeofence);
  const updateGeofence = useAdminEquipmentStore((s) => s.updateGeofence);

  const [name, setName] = useState("");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState("2000");
  const [appliesTo, setAppliesTo] = useState<"ALL" | "CATEGORY">("ALL");
  const [category, setCategory] = useState<EquipmentCategory>("TRACTOR");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setName(editing.name);
      setCenter(editing.center ?? null);
      setRadius(String(editing.radiusMeters ?? 2000));
      setAppliesTo(editing.appliesTo === "CATEGORY" ? "CATEGORY" : "ALL");
      setCategory((editing.category as EquipmentCategory) ?? "TRACTOR");
    } else {
      setName("");
      setCenter(null);
      setRadius("2000");
      setAppliesTo("ALL");
      setCategory("TRACTOR");
    }
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name the geofence.");
      return;
    }
    if (!center || (!center.lat && !center.lng)) {
      setError("Pick a center on the map.");
      return;
    }
    const r = Number(radius);
    if (!(r > 0)) {
      setError("Enter a radius in metres greater than 0.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload: GeofencePayload = {
      name: name.trim(),
      type: "CIRCLE",
      center,
      radiusMeters: r,
      appliesTo,
      category: appliesTo === "CATEGORY" ? category : undefined,
      isActive: editing?.isActive ?? true,
    };

    try {
      if (isEdit && editing) {
        await updateGeofence(editing.id, payload);
        pushToast({ tone: "success", title: "Geofence updated" });
      } else {
        await createGeofence(payload);
        pushToast({ tone: "success", title: "Geofence created" });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit geofence" : "Create geofence"}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="gf-name">
          <Input
            id="gf-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kaduna North Farm Cluster"
          />
        </Field>

        <Field label="Center (click the map)">
          <MapPicker
            value={
              center ? { lat: center.lat, lng: center.lng, address: "" } : null
            }
            onChange={(p) => setCenter({ lat: p.lat, lng: p.lng })}
          />
        </Field>

        <Field label="Radius (metres)" htmlFor="gf-radius">
          <Input
            id="gf-radius"
            type="number"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            placeholder="2000"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Applies to" htmlFor="gf-scope">
            <select
              id="gf-scope"
              value={appliesTo}
              onChange={(e) =>
                setAppliesTo(e.target.value as "ALL" | "CATEGORY")
              }
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            >
              <option value="ALL">All equipment</option>
              <option value="CATEGORY">A category</option>
            </select>
          </Field>
          {appliesTo === "CATEGORY" && (
            <Field label="Category" htmlFor="gf-cat">
              <select
                id="gf-cat"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as EquipmentCategory)
                }
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? "Save geofence" : "Create geofence"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
