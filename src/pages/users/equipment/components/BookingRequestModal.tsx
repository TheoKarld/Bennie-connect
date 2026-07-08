/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Request a PENDING booking for a chosen equipment unit. Collects the date
 * window, rate type, an optional pickup location, and notes. The server is the
 * authority on cost — the client-side estimate here is advisory only.
 */

import React, { useMemo, useState } from "react";
import { Calendar, Clock, MapPin, Info, Loader2 } from "lucide-react";

import { Modal, Button, pushToast } from "../../../../components/ui";
import { formatNaira } from "../../../../lib/format";
import { useEquipmentStore } from "../../../../store/equipmentStore";
import type {
  Equipment,
  EquipmentBooking,
  RateType,
} from "../../../../types/equipment";
import { durationForRate } from "./equipmentMeta";

/** `<input type="datetime-local">` value (local, minute precision). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default function BookingRequestModal({
  open,
  equipment,
  onClose,
  onCreated,
}: {
  open: boolean;
  equipment: Equipment | null;
  onClose: () => void;
  onCreated: (booking: EquipmentBooking) => void;
}) {
  const createBooking = useEquipmentStore((s) => s.createBooking);

  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return toLocalInput(d);
  }, []);
  const defaultEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return toLocalInput(d);
  }, []);

  const [rateType, setRateType] = useState<RateType>("DAILY");
  const [startLocal, setStartLocal] = useState(defaultStart);
  const [endLocal, setEndLocal] = useState(defaultEnd);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const startISO = startLocal ? new Date(startLocal).toISOString() : "";
  const endISO = endLocal ? new Date(endLocal).toISOString() : "";

  const units = useMemo(
    () =>
      startISO && endISO ? durationForRate(startISO, endISO, rateType) : 0,
    [startISO, endISO, rateType]
  );

  const estRental = useMemo(() => {
    if (!equipment) return 0;
    const rate =
      rateType === "HOURLY" ? equipment.hourlyRate : equipment.dailyRate;
    return rate * units;
  }, [equipment, rateType, units]);

  const validRange = !!startISO && !!endISO && new Date(endISO) > new Date(startISO);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipment) return;
    if (!validRange) {
      pushToast({
        title: "Check the dates",
        message: "The end must be after the start.",
        tone: "warning",
      });
      return;
    }
    setSubmitting(true);
    try {
      const booking = await createBooking({
        equipmentId: equipment.id,
        startDate: startISO,
        endDate: endISO,
        rateType,
        pickupLocation: address.trim()
          ? { lat: 0, lng: 0, address: address.trim() }
          : undefined,
        notes: notes.trim() || undefined,
      });
      pushToast({
        title: "Booking requested",
        message: "Awaiting admin approval — you'll be notified to pay.",
        tone: "success",
      });
      onCreated(booking);
      onClose();
    } catch (err) {
      pushToast({
        title: "Could not request booking",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!equipment) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Request · ${equipment.equipmentName}`}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Rate type */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Rate type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["DAILY", "HOURLY"] as RateType[]).map((rt) => {
              const active = rateType === rt;
              const rate =
                rt === "HOURLY" ? equipment.hourlyRate : equipment.dailyRate;
              return (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setRateType(rt)}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-surface-2 hover:border-muted"
                  }`}
                >
                  <span className="block text-xs font-bold text-ink">
                    {rt === "HOURLY" ? "Hourly" : "Daily"}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted">
                    {formatNaira(rate)} / {rt === "HOURLY" ? "hr" : "day"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <Calendar className="h-3.5 w-3.5" /> Start
            </label>
            <input
              type="datetime-local"
              required
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <Clock className="h-3.5 w-3.5" /> End
            </label>
            <input
              type="datetime-local"
              required
              value={endLocal}
              min={startLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Pickup / farm location */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <MapPin className="h-3.5 w-3.5" /> Pickup / farm location
            <span className="font-normal normal-case text-muted/70">
              (optional)
            </span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Farm plot 14, Kaduna North"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Notes <span className="font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Ploughing 6 hectares"
            className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-medium text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Estimate */}
        <div className="rounded-2xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">
              Estimated rental ({units || 0}{" "}
              {rateType === "HOURLY" ? "hr" : "day"}
              {units === 1 ? "" : "s"})
            </span>
            <span className="font-mono font-bold text-ink">
              {formatNaira(estRental)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-muted">Refundable deposit</span>
            <span className="font-mono font-bold text-ink">
              {formatNaira(equipment.depositRequired)}
            </span>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            No charge now. The admin approves availability first — you pay the
            full cost from your wallet once it's approved. Final amounts are
            computed by the server.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !validRange}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Request booking
          </Button>
        </div>
      </form>
    </Modal>
  );
}
