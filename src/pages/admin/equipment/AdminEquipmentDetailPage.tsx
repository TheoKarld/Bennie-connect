/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin equipment detail (`/bennie/equipment-booking/:id`).
 *
 * Header (name, status, rates) with Edit + Retire (permission-gated) and tabs:
 *   Overview/specs · Bookings (this unit) · Maintenance timeline · GPS (mini
 *   live map + last-seen). Every mutation flows through `adminEquipmentStore`.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Pencil,
  Archive,
  Tractor,
  ListChecks,
  Wrench,
  MapPinned,
  CheckCircle2,
  Plus,
  Radio,
} from "lucide-react";

import PermissionGate from "../../../components/admin/PermissionGate";
import { Button, pushToast } from "../../../components/ui";
import { useAdminAuth } from "../../../hooks/useAdminAuth";
import { useAdminEquipmentStore } from "../../../store/adminEquipmentStore";
import EquipmentFormModal from "./components/EquipmentFormModal";
import ScheduleMaintenanceModal from "./components/ScheduleMaintenanceModal";
import BookingActions from "./components/BookingActions";
import FleetMap from "./components/FleetMap";
import ReasonModal from "./components/ReasonModal";
import {
  EmptyBlock,
  ErrorBlock,
  EquipmentStatusChip,
  InfoRow,
  LoadingBlock,
  dateLabel,
  ngn,
} from "./components/shared";

type TabKey = "overview" | "bookings" | "maintenance" | "gps";

const TABS: {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "overview", label: "Overview", icon: Tractor },
  { key: "bookings", label: "Bookings", icon: ListChecks },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
  { key: "gps", label: "GPS", icon: MapPinned },
];

// --- Overview ---------------------------------------------------------------

function OverviewTab() {
  const detail = useAdminEquipmentStore((s) => s.detail);
  if (!detail) return null;
  const specs = Object.entries(detail.specifications ?? {});

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {detail.images && detail.images.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {detail.images.map((url, i) => (
              <div
                key={url}
                className="aspect-square overflow-hidden rounded-2xl border border-border bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${detail.equipmentName} ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <div className="rounded-3xl border border-border bg-surface/70 p-5">
          <h3 className="mb-2 font-display text-sm font-semibold text-ink">
            Specifications
          </h3>
          {specs.length === 0 ? (
            <p className="text-xs text-muted">No specifications recorded.</p>
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {specs.map(([k, v]) => (
                <InfoRow key={k} label={k} value={String(v)} />
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-border bg-surface/70 p-5">
          <h3 className="mb-2 font-display text-sm font-semibold text-ink">
            Rates &amp; identity
          </h3>
          <InfoRow label="Hourly" value={ngn(detail.hourlyRate)} mono />
          <InfoRow label="Daily" value={ngn(detail.dailyRate)} mono />
          <InfoRow label="Deposit" value={ngn(detail.depositRequired)} mono />
          <InfoRow label="Model" value={detail.model ?? "—"} />
          <InfoRow label="Serial" value={detail.serialNumber ?? "—"} />
          <InfoRow
            label="Year"
            value={detail.yearOfManufacture ?? "—"}
          />
          <InfoRow label="Uses" value={detail.bookingHistory ?? 0} mono />
        </div>

        <div className="rounded-3xl border border-border bg-surface/70 p-5">
          <h3 className="mb-2 font-display text-sm font-semibold text-ink">
            Location &amp; GPS
          </h3>
          <InfoRow
            label="Address"
            value={detail.location?.address || "—"}
          />
          {detail.location && (detail.location.lat || detail.location.lng) && (
            <InfoRow
              label="Coords"
              value={`${detail.location.lat.toFixed(4)}, ${detail.location.lng.toFixed(4)}`}
              mono
            />
          )}
          <InfoRow
            label="GPS device"
            value={detail.gpsTracker?.deviceId ?? "—"}
          />
          <InfoRow
            label="Tracker"
            value={
              detail.gpsTracker?.isActive ? (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Radio className="h-3.5 w-3.5" /> Active
                </span>
              ) : (
                "Inactive"
              )
            }
          />
        </div>
      </div>
    </div>
  );
}

// --- Bookings ---------------------------------------------------------------

function BookingsTab({ equipmentId }: { equipmentId: string }) {
  const bookings = useAdminEquipmentStore((s) => s.bookings);
  const status = useAdminEquipmentStore((s) => s.bookingsStatus);
  const setBookingFilters = useAdminEquipmentStore((s) => s.setBookingFilters);
  const fetchBookings = useAdminEquipmentStore((s) => s.fetchBookings);

  useEffect(() => {
    setBookingFilters({ equipmentId, status: undefined, page: 1 });
    void fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId]);

  if (status === "loading") return <LoadingBlock label="Loading bookings" />;
  if (status === "ready" && bookings.length === 0)
    return (
      <EmptyBlock
        icon={ListChecks}
        title="No bookings for this unit"
        hint="Booking requests for this equipment will appear here."
      />
    );
  return <BookingActions bookings={bookings} columns={2} />;
}

// --- Maintenance ------------------------------------------------------------

function MaintenanceTab({ equipmentId }: { equipmentId: string }) {
  const maintenance = useAdminEquipmentStore((s) => s.maintenance);
  const loaded = useAdminEquipmentStore((s) => s.maintenanceLoaded);
  const fetchMaintenance = useAdminEquipmentStore((s) => s.fetchMaintenance);
  const completeMaintenance = useAdminEquipmentStore((s) => s.completeMaintenance);

  const { hasPermission } = useAdminAuth();
  const canMaintain = hasPermission("equipment:maintenance");
  const [scheduleOpen, setScheduleOpen] = useState(false);

  useEffect(() => {
    if (!loaded) void fetchMaintenance(equipmentId);
  }, [equipmentId, loaded, fetchMaintenance]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ink">
          Maintenance schedule
        </h3>
        {canMaintain && (
          <Button size="sm" onClick={() => setScheduleOpen(true)}>
            <Plus className="h-4 w-4" /> Schedule
          </Button>
        )}
      </div>

      {!loaded && <LoadingBlock label="Loading maintenance" />}
      {loaded && maintenance.length === 0 && (
        <EmptyBlock
          icon={Wrench}
          title="No maintenance scheduled"
          hint="Schedule a service window; a due item blocks availability."
        />
      )}
      {loaded && maintenance.length > 0 && (
        <ul className="space-y-2">
          {maintenance.map((m, i) => {
            const done = !!m.completedAt;
            return (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/70 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl ${
                      done
                        ? "bg-primary/10 text-primary"
                        : "bg-accent/15 text-[#a6701c] dark:text-accent"
                    }`}
                  >
                    <Wrench className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{m.type}</p>
                    <p className="text-[11px] text-muted">
                      Due {dateLabel(m.dueDate)}
                      {m.notes ? ` · ${m.notes}` : ""}
                      {done ? ` · completed ${dateLabel(m.completedAt)}` : ""}
                    </p>
                  </div>
                </div>
                {!done && canMaintain && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void completeMaintenance(equipmentId, m.index ?? i)
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark done
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ScheduleMaintenanceModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        equipmentId={equipmentId}
      />
    </div>
  );
}

// --- GPS mini map -----------------------------------------------------------

function GpsTab({ equipmentId }: { equipmentId: string }) {
  const detail = useAdminEquipmentStore((s) => s.detail);
  const geofences = useAdminEquipmentStore((s) => s.geofences);
  const fetchGeofences = useAdminEquipmentStore((s) => s.fetchGeofences);

  useEffect(() => {
    void fetchGeofences({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show any live position from the unit's active booking, else the fleet
  // snapshot for this equipment, else the static equipment location.
  const positions = useMemo(() => {
    const loc = detail?.location;
    if (loc && (loc.lat || loc.lng)) {
      return [
        {
          equipmentId,
          equipmentName: detail?.equipmentName,
          position: { lat: loc.lat, lng: loc.lng, at: "" },
        },
      ];
    }
    return [];
  }, [detail, equipmentId]);

  return (
    <div className="space-y-3">
      <FleetMap
        positions={positions}
        geofences={geofences}
        className="h-[24rem]"
      />
      <p className="text-[11px] text-muted">
        Live operator positions stream to the fleet Live Map when this unit is in
        use. The pin above shows its last-known / depot location.
      </p>
    </div>
  );
}

// --- Page -------------------------------------------------------------------

export default function AdminEquipmentDetailPage() {
  const { id = "" } = useParams();
  const reduce = useReducedMotion();

  const detail = useAdminEquipmentStore((s) => s.detail);
  const status = useAdminEquipmentStore((s) => s.detailStatus);
  const error = useAdminEquipmentStore((s) => s.detailError);
  const loadEquipment = useAdminEquipmentStore((s) => s.loadEquipment);
  const retireEquipment = useAdminEquipmentStore((s) => s.retireEquipment);

  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission("equipment:update");
  const canRetire = hasPermission("equipment:delete");

  const [tab, setTab] = useState<TabKey>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);

  useEffect(() => {
    if (id) void loadEquipment(id);
  }, [id, loadEquipment]);

  return (
    <PermissionGate anyOf={["equipment:view"]}>
      <div className="space-y-6">
        <Link
          to="/bennie/equipment-booking"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to equipment
        </Link>

        {status === "loading" && <LoadingBlock label="Loading equipment" />}
        {status === "error" && (
          <ErrorBlock
            message={error ?? "Unable to load this equipment."}
            onRetry={() => void loadEquipment(id)}
          />
        )}

        {status === "ready" && detail && (
          <>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex flex-wrap items-start justify-between gap-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold text-ink">
                    {detail.equipmentName}
                  </h1>
                  <EquipmentStatusChip status={detail.status} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {detail.category.charAt(0) +
                    detail.category.slice(1).toLowerCase()}
                  {detail.model ? ` · ${detail.model}` : ""} ·{" "}
                  {ngn(detail.dailyRate)}/day
                </p>
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                )}
                {canRetire && detail.status !== "RETIRED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="!text-danger hover:!bg-danger/5"
                    onClick={() => setRetireOpen(true)}
                  >
                    <Archive className="h-4 w-4" /> Retire
                  </Button>
                )}
              </div>
            </motion.div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                      active
                        ? "bg-primary text-white"
                        : "text-muted hover:bg-primary/8 hover:text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            {tab === "overview" && <OverviewTab />}
            {tab === "bookings" && <BookingsTab equipmentId={id} />}
            {tab === "maintenance" && <MaintenanceTab equipmentId={id} />}
            {tab === "gps" && <GpsTab equipmentId={id} />}

            <EquipmentFormModal
              open={editOpen}
              onClose={() => setEditOpen(false)}
              editing={detail}
            />

            <ReasonModal
              open={retireOpen}
              onClose={() => setRetireOpen(false)}
              title="Retire equipment"
              tone="danger"
              reasonRequired={false}
              confirmLabel="Retire unit"
              description="Retiring removes the unit from availability (status RETIRED). Blocked if it has active bookings. This is audited."
              onConfirm={async () => {
                try {
                  await retireEquipment(id);
                  pushToast({ tone: "success", title: "Equipment retired" });
                } catch (err) {
                  pushToast({
                    tone: "alert",
                    title: "Retire failed",
                    message:
                      err instanceof Error ? err.message : "Please try again.",
                  });
                  throw err;
                }
              }}
            />
          </>
        )}
      </div>
    </PermissionGate>
  );
}
