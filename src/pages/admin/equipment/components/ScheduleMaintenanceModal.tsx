/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Schedule-maintenance modal (PRD §3.3). Captures type, due date, notes and a
 * "block availability now" toggle (immediately sets the unit MAINTENANCE and
 * rejects overlapping bookings). Guarded by `equipment:maintenance` at the call
 * site.
 */

import React, { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminEquipmentStore } from "../../../../store/adminEquipmentStore";

interface Props {
  open: boolean;
  onClose: () => void;
  equipmentId: string;
}

export default function ScheduleMaintenanceModal({
  open,
  onClose,
  equipmentId,
}: Props) {
  const scheduleMaintenance = useAdminEquipmentStore((s) => s.scheduleMaintenance);
  const [type, setType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [blockNow, setBlockNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType("");
      setDueDate("");
      setNotes("");
      setBlockNow(true);
      setError(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type.trim()) {
      setError("Enter a maintenance type.");
      return;
    }
    if (!dueDate) {
      setError("Pick a due date.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await scheduleMaintenance(equipmentId, {
        type: type.trim(),
        dueDate,
        notes: notes.trim() || undefined,
        blockNow,
      });
      pushToast({ tone: "success", title: "Maintenance scheduled" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Schedule maintenance">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Type" htmlFor="mt-type">
          <Input
            id="mt-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="SERVICE_500H"
          />
        </Field>
        <Field label="Due date" htmlFor="mt-date">
          <Input
            id="mt-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label="Notes (optional)" htmlFor="mt-notes">
          <textarea
            id="mt-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Engine oil + filters"
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <input
            type="checkbox"
            checked={blockNow}
            onChange={(e) => setBlockNow(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
          />
          <span className="text-xs leading-relaxed text-muted">
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <Wrench className="h-3.5 w-3.5" /> Block availability now
            </span>
            Immediately mark the unit MAINTENANCE and reject overlapping new
            bookings.
          </span>
        </label>

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
            Schedule
          </Button>
        </div>
      </form>
    </Modal>
  );
}
