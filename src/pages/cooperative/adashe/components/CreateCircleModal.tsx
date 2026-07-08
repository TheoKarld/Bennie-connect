/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Users } from "lucide-react";

import { Modal, Button, Input, pushToast } from "../../../../components/ui";
import { formatNaira } from "../../../../lib/format";
import { useAdasheStore } from "../../../../store/adasheStore";
import type { GroupType, GroupFrequency } from "../../../../types/adashe";

interface CreateCircleModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (groupId: string) => void;
}

const TYPES: GroupType[] = ["ADASHE", "ESUSU", "CUSTOM"];

export default function CreateCircleModal({
  open,
  onClose,
  onCreated,
}: CreateCircleModalProps) {
  const createGroup = useAdasheStore((s) => s.createGroup);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<GroupType>("ADASHE");
  const [amount, setAmount] = useState<number>(20000);
  const [frequency, setFrequency] = useState<GroupFrequency>("MONTHLY");
  const [maxSlots, setMaxSlots] = useState<number>(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setType("ADASHE");
    setAmount(20000);
    setFrequency("MONTHLY");
    setMaxSlots(10);
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 3) {
      setError("Circle name must be at least 3 characters.");
      return;
    }
    if (amount < 500) {
      setError("Contribution must be at least ₦500.");
      return;
    }
    if (maxSlots < 2) {
      setError("A circle needs at least 2 slots.");
      return;
    }

    setSubmitting(true);
    try {
      const detail = await createGroup({
        name: name.trim(),
        description: description.trim(),
        type,
        contributionAmount: Math.round(amount),
        frequency,
        maxSlots: Math.round(maxSlots),
      });
      pushToast({
        title: "Circle created",
        message: `${detail.name} is ready. Invite members to fill the rotation.`,
        tone: "success",
      });
      reset();
      onCreated?.(detail.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Create a new circle">
      <p className="mb-4 text-xs leading-relaxed text-muted">
        Establish a rotating thrift program. Members you invite must accept to
        take a slot in the rotation.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Circle name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Oyo Cocoa Harvesters Wheel"
            maxLength={80}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Purpose &amp; rules
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the rotation guidelines and what the pool is for..."
            rows={3}
            maxLength={500}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as GroupType)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as GroupFrequency)
              }
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Contribution (₦)
            </label>
            <Input
              type="number"
              min={500}
              step={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Slots (members)
            </label>
            <Input
              type="number"
              min={2}
              max={50}
              value={maxSlots}
              onChange={(e) => setMaxSlots(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-primary/5 p-3 text-xs text-ink">
          <span className="flex items-center gap-1.5 font-semibold text-primary">
            <Users className="h-3.5 w-3.5" /> Full cycle payout
          </span>
          <span className="mt-0.5 block text-muted">
            Each turn pays out about{" "}
            <b className="text-primary">
              {formatNaira((amount || 0) * (maxSlots || 0))}
            </b>{" "}
            when the pool is filled.
          </span>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={submitting}
          >
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
