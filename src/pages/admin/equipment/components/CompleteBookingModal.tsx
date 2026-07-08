/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Complete-booking / return-inspection modal with deposit settlement (PRD §4.3).
 *
 * Captures the return condition (OK / DAMAGED), optional damage report, usage
 * hours, and a return location. Shows the computed deposit disposition preview
 * (deposit − damage deducted = net refund, damage-over-deposit surfaces as an
 * outstanding charge). The `condition: DAMAGED` deduction is a financial
 * reversal, so when the admin lacks `equipment:settle-deposit` the damage-
 * settlement fields are hidden and completion is limited to a clean return.
 */

import React, { useEffect, useMemo, useState } from "react";
import { PackageCheck, ShieldAlert } from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminEquipmentStore } from "../../../../store/adminEquipmentStore";
import { useAdminAuth } from "../../../../hooks/useAdminAuth";
import type {
  CompleteBookingPayload,
  EquipmentBooking,
} from "../../../../types/adminEquipment";
import { ngn } from "./shared";

interface Props {
  open: boolean;
  onClose: () => void;
  booking: EquipmentBooking | null;
}

export default function CompleteBookingModal({ open, onClose, booking }: Props) {
  const completeBooking = useAdminEquipmentStore((s) => s.completeBooking);
  const { hasPermission } = useAdminAuth();
  const canSettle = hasPermission("equipment:settle-deposit");

  const [condition, setCondition] = useState<"OK" | "DAMAGED">("OK");
  const [damageDesc, setDamageDesc] = useState("");
  const [damageCost, setDamageCost] = useState("");
  const [usageHours, setUsageHours] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCondition("OK");
      setDamageDesc("");
      setDamageCost("");
      setUsageHours("");
      setError(null);
    }
  }, [open]);

  const deposit = booking?.depositAmount ?? 0;
  const cost = Number(damageCost) || 0;

  const settlement = useMemo(() => {
    const damageDeducted = Math.min(cost, deposit);
    const refunded = Math.max(0, deposit - damageDeducted);
    const outstanding = Math.max(0, cost - deposit);
    return { damageDeducted, refunded, outstanding };
  }, [cost, deposit]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    if (condition === "DAMAGED") {
      if (!damageDesc.trim()) {
        setError("Describe the damage for the audit trail.");
        return;
      }
      if (!(cost > 0)) {
        setError("Enter a damage cost estimate greater than 0.");
        return;
      }
    }
    setSubmitting(true);
    setError(null);

    const payload: CompleteBookingPayload = {
      condition,
      actualEndDate: new Date().toISOString(),
      usageHours: usageHours ? Number(usageHours) : undefined,
      damageReport:
        condition === "DAMAGED"
          ? { description: damageDesc.trim(), costEstimate: cost }
          : undefined,
    };

    try {
      const res = await completeBooking(booking.id, payload);
      pushToast({
        tone: "success",
        title: "Booking completed",
        message:
          res.depositRefunded != null
            ? `${ngn(res.depositRefunded)} deposit refunded.`
            : "Return inspection recorded.",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Completion failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Complete return inspection">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-2">
          {(["OK", "DAMAGED"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCondition(c)}
              className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                condition === c
                  ? c === "OK"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-danger/50 bg-danger/10 text-danger"
                  : "border-border bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {c === "OK" ? "Returned OK" : "Damaged"}
            </button>
          ))}
        </div>

        <Field label="Usage hours (optional)" htmlFor="cp-hours">
          <Input
            id="cp-hours"
            type="number"
            value={usageHours}
            onChange={(e) => setUsageHours(e.target.value)}
            placeholder="6"
          />
        </Field>

        {condition === "DAMAGED" && (
          <>
            {canSettle ? (
              <div className="space-y-3 rounded-2xl border border-danger/25 bg-danger/[0.05] p-4">
                <Field label="Damage description" htmlFor="cp-desc">
                  <textarea
                    id="cp-desc"
                    value={damageDesc}
                    onChange={(e) => setDamageDesc(e.target.value)}
                    rows={2}
                    placeholder="Cracked hydraulic hose"
                    className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                </Field>
                <Field label="Cost estimate (NGN)" htmlFor="cp-cost">
                  <Input
                    id="cp-cost"
                    type="number"
                    value={damageCost}
                    onChange={(e) => setDamageCost(e.target.value)}
                    placeholder="18000"
                  />
                </Field>

                {/* Settlement preview */}
                <div className="rounded-xl border border-border bg-surface px-4 py-3 text-xs">
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Deposit portion</span>
                    <span className="font-mono text-ink">{ngn(deposit)}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Damage deducted</span>
                    <span className="font-mono text-danger">
                      −{ngn(settlement.damageDeducted)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1.5">
                    <span className="font-semibold text-ink">Net refund</span>
                    <span className="font-mono font-semibold text-primary">
                      {ngn(settlement.refunded)}
                    </span>
                  </div>
                  {settlement.outstanding > 0 && (
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-danger/10 px-2.5 py-1.5 text-danger">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span className="font-medium">
                        {ngn(settlement.outstanding)} over deposit — recorded as an
                        outstanding charge.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
                <p className="text-xs leading-relaxed text-muted">
                  Damage settlement debits the deposit — a financial reversal
                  restricted to Super Admins (
                  <span className="font-mono">equipment:settle-deposit</span>).
                  Ask a Super Admin to complete a damaged return.
                </p>
              </div>
            )}
          </>
        )}

        {condition === "OK" && (
          <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] px-4 py-3">
            <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted">
              Clean return — the full deposit portion ({ngn(deposit)}) is refunded
              to the user's wallet (minus any overdue charges).
            </p>
          </div>
        )}

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
            disabled={condition === "DAMAGED" && !canSettle}
          >
            Complete booking
          </Button>
        </div>
      </form>
    </Modal>
  );
}
