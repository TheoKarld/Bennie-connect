/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Confirm-with-reason modal for the decisive equipment actions that require a
 * note: reject a booking request, cancel a booking. Keeps the reason validation
 * (`>= 5` chars when required) in one place.
 */

import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Modal, Field, Button } from "../../../../components/ui";

export interface ReasonModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  reasonRequired?: boolean;
  reasonLabel?: string;
  placeholder?: string;
  tone?: "danger" | "primary" | "accent";
  onConfirm: (reason: string) => Promise<void> | void;
}

export default function ReasonModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  reasonRequired = true,
  reasonLabel = "Reason",
  placeholder = "Add a brief reason for the audit trail…",
  tone = "primary",
  onConfirm,
}: ReasonModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = reason.trim();
    if (reasonRequired && value.length < 5) {
      setError("Please give a reason of at least 5 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(value);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {description && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
          {tone === "danger" && (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          )}
          <div className="text-xs leading-relaxed text-muted">{description}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label={reasonRequired ? reasonLabel : `${reasonLabel} (optional)`}
          htmlFor="eqp-reason-ta"
        >
          <textarea
            id="eqp-reason-ta"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </Field>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={submitting}
            variant={tone === "danger" ? "primary" : tone}
            className={
              tone === "danger"
                ? "!bg-danger hover:!brightness-95 !shadow-danger/20"
                : ""
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
