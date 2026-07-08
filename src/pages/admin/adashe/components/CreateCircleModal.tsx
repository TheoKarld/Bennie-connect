/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin-overseer "Create circle" modal. The admin creates the group as a
 * non-paying overseer (`organizerType: 'admin'`) and can invite members after.
 * Permission-gated by the caller (`adashe-groups:create`).
 */

import React, { useState } from "react";
import { Sprout } from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminAdasheStore } from "../../../../store/adminAdasheStore";
import type {
  AdminCreateGroupPayload,
  GroupFrequency,
  GroupType,
} from "../../../../types/adashe";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (groupId: string) => void;
}

const TYPES: GroupType[] = ["ADASHE", "ESUSU", "CUSTOM"];
const FREQS: GroupFrequency[] = ["WEEKLY", "MONTHLY"];

export default function CreateCircleModal({ open, onClose, onCreated }: Props) {
  const createGroup = useAdminAdasheStore((s) => s.createGroup);

  const [form, setForm] = useState<AdminCreateGroupPayload>({
    name: "",
    description: "",
    type: "ADASHE",
    contributionAmount: 5000,
    frequency: "MONTHLY",
    maxSlots: 8,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof AdminCreateGroupPayload>(
    k: K,
    v: AdminCreateGroupPayload[K]
  ) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.name.trim().length < 3) {
      setError("Give the circle a name (at least 3 characters).");
      return;
    }
    if (form.contributionAmount < 1) {
      setError("Contribution amount must be greater than zero.");
      return;
    }
    if (form.maxSlots < 2) {
      setError("A circle needs at least 2 slots.");
      return;
    }
    setSubmitting(true);
    try {
      const detail = await createGroup({
        ...form,
        name: form.name.trim(),
        organizerType: "admin",
      });
      pushToast({
        title: "Circle created",
        message: `"${detail.name}" is ready. Invite members to fill the rotation.`,
        tone: "success",
      });
      onCreated?.(detail.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the circle.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create a circle" className="max-w-xl">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sprout className="h-5 w-5" />
        </span>
        <p className="text-xs text-muted">
          You create this circle as a <strong>non-paying overseer</strong>. Only
          invited members hold rotation slots and contribute to the pool.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Circle name" htmlFor="cc-name">
          <Input
            id="cc-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Kaduna Farmers Monthly Adashe"
            autoFocus
          />
        </Field>

        <Field label="Description" htmlFor="cc-desc">
          <Input
            id="cc-desc"
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What is this circle for?"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type">
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("type", t)}
                  className={`flex-1 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                    form.type === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted hover:border-primary/30"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Frequency">
            <div className="flex gap-2">
              {FREQS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set("frequency", f)}
                  className={`flex-1 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                    form.frequency === f
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted hover:border-primary/30"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Contribution amount (₦)" htmlFor="cc-amt">
            <Input
              id="cc-amt"
              type="number"
              min={1}
              value={form.contributionAmount}
              onChange={(e) =>
                set("contributionAmount", Number(e.target.value) || 0)
              }
            />
          </Field>

          <Field label="Slots (max members)" htmlFor="cc-slots">
            <Input
              id="cc-slots"
              type="number"
              min={2}
              max={50}
              value={form.maxSlots}
              onChange={(e) => set("maxSlots", Number(e.target.value) || 0)}
            />
          </Field>
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
            Create circle
          </Button>
        </div>
      </form>
    </Modal>
  );
}
