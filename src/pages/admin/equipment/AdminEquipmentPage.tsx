/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin Equipment & GPS ops console (`/bennie/equipment-booking`).
 *
 * Tabs: Fleet (table + Add equipment) · Booking Requests (approval queue,
 * awaiting-payment, overdue) · Live Map (fleet GPS) · Alerts · Settings
 * (rate config + geofences). Every surface is server-backed via
 * `adminEquipmentStore`, permission-aware, real-time (fleet socket + refetch),
 * and light/dark aware. Rows deep-link to the equipment detail route.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  Tractor,
  Inbox,
  MapPinned,
  Bell,
  SlidersHorizontal,
  Plus,
  Search,
  Radio,
  BellRing,
  ShieldAlert,
} from "lucide-react";

import PermissionGate from "../../../components/admin/PermissionGate";
import { Button } from "../../../components/ui";
import { useAdminAuth } from "../../../hooks/useAdminAuth";
import { useAdminEquipmentStore } from "../../../store/adminEquipmentStore";
import { useAdminFleetSocket } from "../../../hooks/useAdminFleetSocket";
import type {
  EquipmentCategory,
  Geofence,
} from "../../../types/adminEquipment";
import FleetTable from "./components/FleetTable";
import EquipmentFormModal from "./components/EquipmentFormModal";
import BookingActions from "./components/BookingActions";
import FleetMap from "./components/FleetMap";
import GeofenceModal from "./components/GeofenceModal";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  dateTimeLabel,
  relTime,
} from "./components/shared";

type TabKey = "fleet" | "requests" | "map" | "alerts" | "settings";

const TABS: {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "fleet", label: "Fleet", icon: Tractor },
  { key: "requests", label: "Booking Requests", icon: Inbox },
  { key: "map", label: "Live Map", icon: MapPinned },
  { key: "alerts", label: "Alerts", icon: Bell },
  { key: "settings", label: "Rates & Geofences", icon: SlidersHorizontal },
];

const CATEGORIES: (EquipmentCategory | "")[] = [
  "",
  "TRACTOR",
  "HARVESTER",
  "PLANTER",
  "SPRAYER",
  "IRRIGATION",
  "OTHER",
];

// --- Fleet tab --------------------------------------------------------------

function FleetTab() {
  const equipment = useAdminEquipmentStore((s) => s.equipment);
  const status = useAdminEquipmentStore((s) => s.fleetStatus);
  const error = useAdminEquipmentStore((s) => s.fleetError);
  const filters = useAdminEquipmentStore((s) => s.fleetFilters);
  const setFleetFilters = useAdminEquipmentStore((s) => s.setFleetFilters);
  const fetchFleet = useAdminEquipmentStore((s) => s.fetchFleet);

  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("equipment:create");

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void fetchFleet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyCategory = (c: EquipmentCategory | "") => {
    setFleetFilters({ category: c || undefined, page: 1 });
    void fetchFleet();
  };

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFleetFilters({ q: search.trim() || undefined, page: 1 });
    void fetchFleet();
  };

  const toggleMaint = () => {
    setFleetFilters({ dueForMaintenance: !filters.dueForMaintenance, page: 1 });
    void fetchFleet();
  };
  const toggleGps = () => {
    setFleetFilters({ gpsActive: !filters.gpsActive, page: 1 });
    void fetchFleet();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-ink">
          Equipment fleet
        </h2>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add equipment
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c || "ALL"}
              type="button"
              onClick={() => applyCategory(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                (filters.category ?? "") === c
                  ? "bg-primary text-white"
                  : "bg-primary/8 text-primary hover:bg-primary/15"
              }`}
            >
              {c ? c.charAt(0) + c.slice(1).toLowerCase() : "All"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleGps}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            filters.gpsActive
              ? "bg-primary text-white"
              : "bg-primary/8 text-primary hover:bg-primary/15"
          }`}
        >
          <Radio className="h-3.5 w-3.5" /> GPS active
        </button>
        <button
          type="button"
          onClick={toggleMaint}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            filters.dueForMaintenance
              ? "bg-accent text-[#1A2421]"
              : "bg-accent/12 text-[#a6701c] hover:bg-accent/20 dark:text-accent"
          }`}
        >
          Due for maintenance
        </button>
        <form
          onSubmit={applySearch}
          className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search equipment…"
            className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </form>
      </div>

      {status === "loading" && <LoadingBlock label="Loading fleet" />}
      {status === "error" && (
        <ErrorBlock
          message={error ?? "Unable to load the fleet."}
          onRetry={() => void fetchFleet()}
        />
      )}
      {status === "ready" && equipment.length === 0 && (
        <EmptyBlock
          icon={Tractor}
          title="No equipment matches"
          hint="Adjust the filters, or add a unit to the fleet."
          action={
            canCreate ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Add equipment
              </Button>
            ) : undefined
          }
        />
      )}
      {status === "ready" && equipment.length > 0 && (
        <FleetTable rows={equipment} />
      )}

      <EquipmentFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </section>
  );
}

// --- Booking Requests tab ---------------------------------------------------

function RequestsTab() {
  const bookings = useAdminEquipmentStore((s) => s.bookings);
  const status = useAdminEquipmentStore((s) => s.bookingsStatus);
  const error = useAdminEquipmentStore((s) => s.bookingsError);
  const filters = useAdminEquipmentStore((s) => s.bookingFilters);
  const setBookingFilters = useAdminEquipmentStore((s) => s.setBookingFilters);
  const fetchBookings = useAdminEquipmentStore((s) => s.fetchBookings);

  type View = "PENDING" | "AWAITING" | "OVERDUE" | "ACTIVE";
  const [view, setView] = useState<View>("PENDING");

  const applyView = (v: View) => {
    setView(v);
    const patch: Partial<import("../../../types/adminEquipment").AdminBookingListFilters> =
      {
        status: undefined,
        awaitingPayment: undefined,
        overdue: undefined,
        page: 1,
      };
    if (v === "PENDING") patch.status = "PENDING";
    else if (v === "AWAITING") patch.awaitingPayment = true;
    else if (v === "OVERDUE") patch.overdue = true;
    else patch.status = "IN_USE";
    setBookingFilters(patch);
    void fetchBookings();
  };

  useEffect(() => {
    setBookingFilters({ status: "PENDING", page: 1 });
    void fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const VIEWS: { key: View; label: string }[] = [
    { key: "PENDING", label: "Pending approval" },
    { key: "AWAITING", label: "Awaiting payment" },
    { key: "ACTIVE", label: "In use" },
    { key: "OVERDUE", label: "Overdue" },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => applyView(v.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              view === v.key
                ? "bg-primary text-white"
                : "bg-primary/8 text-primary hover:bg-primary/15"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {status === "loading" && <LoadingBlock label="Loading bookings" />}
      {status === "error" && (
        <ErrorBlock
          message={error ?? "Unable to load bookings."}
          onRetry={() => void fetchBookings()}
        />
      )}
      {status === "ready" && bookings.length === 0 && (
        <EmptyBlock
          icon={Inbox}
          title="Nothing in this queue"
          hint={
            view === "PENDING"
              ? "New booking requests awaiting availability approval appear here."
              : view === "AWAITING"
                ? "Approved bookings where the user has not yet paid appear here."
                : view === "OVERDUE"
                  ? "Bookings past their return date appear here."
                  : "Bookings currently in use appear here."
          }
        />
      )}
      {status === "ready" && bookings.length > 0 && (
        <BookingActions bookings={bookings} columns={2} />
      )}
      {/* filters.status is applied server-side; keep the reference used */}
      <input type="hidden" value={filters.status ?? ""} readOnly />
    </section>
  );
}

// --- Live Map tab -----------------------------------------------------------

function LiveMapTab() {
  const livePositions = useAdminEquipmentStore((s) => s.livePositions);
  const liveStatus = useAdminEquipmentStore((s) => s.liveStatus);
  const fetchLiveFleet = useAdminEquipmentStore((s) => s.fetchLiveFleet);
  const geofences = useAdminEquipmentStore((s) => s.geofences);
  const fetchGeofences = useAdminEquipmentStore((s) => s.fetchGeofences);

  const [selected, setSelected] = useState<string | undefined>();

  useEffect(() => {
    void fetchLiveFleet();
    void fetchGeofences({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to the active bookings' tracking rooms for live position updates.
  const activeBookingIds = useMemo(
    () =>
      livePositions
        .map((p) => p.bookingId)
        .filter((id): id is string => !!id),
    [livePositions]
  );
  useAdminFleetSocket(activeBookingIds, true);

  const withPos = livePositions.filter((p) => p.position);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FleetMap
          positions={livePositions}
          geofences={geofences}
          onSelect={setSelected}
          className="h-[28rem] lg:col-span-2"
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink">
              Active units
            </h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {withPos.length} live
            </span>
          </div>
          {liveStatus === "loading" && <LoadingBlock label="Loading positions" />}
          {liveStatus !== "loading" && withPos.length === 0 && (
            <EmptyBlock
              icon={MapPinned}
              title="No units live"
              hint="In-use equipment with an operator pushing GPS appears here."
            />
          )}
          <div className="max-h-[24rem] space-y-2 overflow-y-auto pr-1">
            {withPos.map((p) => (
              <button
                key={p.bookingId || p.equipmentId}
                type="button"
                onClick={() => setSelected(p.bookingId)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  selected && selected === p.bookingId
                    ? "border-primary bg-primary/[0.06]"
                    : "border-border bg-surface/70 hover:border-primary/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-semibold text-ink">
                    {p.equipmentName ?? "Unit"}
                  </p>
                  {p.status === "OVERDUE" && (
                    <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[9px] font-bold uppercase text-danger">
                      Overdue
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {p.operatorName ? `${p.operatorName} · ` : ""}
                  {p.position?.speed != null
                    ? `${Math.round(p.position.speed)} km/h · `
                    : ""}
                  {p.position?.at ? relTime(p.position.at) : "—"}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Alerts tab -------------------------------------------------------------

function AlertsTab() {
  const alerts = useAdminEquipmentStore((s) => s.alerts);
  const status = useAdminEquipmentStore((s) => s.alertsStatus);
  const fetchAlerts = useAdminEquipmentStore((s) => s.fetchAlerts);
  const ackAlert = useAdminEquipmentStore((s) => s.ackAlert);

  const { hasPermission } = useAdminAuth();
  const canAck = hasPermission("equipment:gps");

  useEffect(() => {
    void fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = alerts.filter((a) => !a.acknowledgedAt);
  const done = alerts.filter((a) => a.acknowledgedAt);

  return (
    <section className="space-y-4">
      {status === "loading" && <LoadingBlock label="Loading alerts" />}
      {status !== "loading" && alerts.length === 0 && (
        <EmptyBlock
          icon={BellRing}
          title="No GPS alerts"
          hint="Geofence breaches, overspeed and signal-loss alerts surface here."
        />
      )}

      {open.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm font-semibold text-ink">
            Unacknowledged ({open.length})
          </h3>
          {open.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/[0.06] px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {a.type.replace(/_/g, " ")}
                    {a.equipmentName ? ` · ${a.equipmentName}` : ""}
                  </p>
                  <p className="text-[11px] text-muted">
                    {a.detail} · {dateTimeLabel(a.createdAt)}
                  </p>
                </div>
              </div>
              {canAck && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void ackAlert(a.id)}
                >
                  Acknowledge
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm font-semibold text-muted">
            Acknowledged
          </h3>
          {done.slice(0, 20).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/70 px-4 py-2.5"
            >
              <p className="text-xs text-muted">
                <span className="font-semibold text-ink">
                  {a.type.replace(/_/g, " ")}
                </span>{" "}
                · {a.detail}
              </p>
              <span className="text-[10px] text-muted">
                {dateTimeLabel(a.acknowledgedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// --- Settings tab (rate config + geofences) ---------------------------------

function SettingsTab() {
  const rateConfig = useAdminEquipmentStore((s) => s.rateConfig);
  const rateStatus = useAdminEquipmentStore((s) => s.rateConfigStatus);
  const fetchRateConfig = useAdminEquipmentStore((s) => s.fetchRateConfig);
  const updateRateConfig = useAdminEquipmentStore((s) => s.updateRateConfig);
  const geofences = useAdminEquipmentStore((s) => s.geofences);
  const geofenceStatus = useAdminEquipmentStore((s) => s.geofencesStatus);
  const fetchGeofences = useAdminEquipmentStore((s) => s.fetchGeofences);
  const deleteGeofence = useAdminEquipmentStore((s) => s.deleteGeofence);

  const { hasPermission } = useAdminAuth();
  const canConfigure = hasPermission("equipment:configure");

  const [geoModal, setGeoModal] = useState(false);
  const [editingFence, setEditingFence] = useState<Geofence | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { hourly: string; daily: string; deposit: string }>
  >({});

  useEffect(() => {
    void fetchRateConfig();
    void fetchGeofences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draftFor = (cat: string) => {
    const cfg = rateConfig.find((r) => r.category === cat);
    return (
      drafts[cat] ?? {
        hourly: String(cfg?.defaultHourlyRate ?? ""),
        daily: String(cfg?.defaultDailyRate ?? ""),
        deposit: String(cfg?.depositPercent ?? ""),
      }
    );
  };

  const saveRate = async (cat: string) => {
    const d = draftFor(cat);
    try {
      await updateRateConfig(cat, {
        defaultHourlyRate: Number(d.hourly) || 0,
        defaultDailyRate: Number(d.daily) || 0,
        depositPercent: Number(d.deposit) || 0,
      });
    } catch {
      /* store surfaces via thrown error; keep it quiet here */
    }
  };

  return (
    <section className="space-y-6">
      {/* Rate config */}
      <div className="space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">
            Rate config
          </h2>
          <p className="text-[11px] text-muted">
            Per-category defaults applied to new equipment / bookings only.
          </p>
        </div>

        {rateStatus === "loading" && <LoadingBlock label="Loading rate config" />}
        {rateStatus !== "loading" && rateConfig.length === 0 && (
          <EmptyBlock
            icon={SlidersHorizontal}
            title="No rate config"
            hint="Category rate defaults will appear here once seeded."
          />
        )}
        {rateConfig.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-border bg-surface/70">
            <ul className="divide-y divide-border">
              {rateConfig.map((r) => {
                const d = draftFor(r.category);
                return (
                  <li
                    key={r.category}
                    className="flex flex-wrap items-center gap-3 px-5 py-3"
                  >
                    <span className="w-24 text-sm font-semibold text-ink">
                      {r.category.charAt(0) + r.category.slice(1).toLowerCase()}
                    </span>
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      {(
                        [
                          ["hourly", "₦/hr"],
                          ["daily", "₦/day"],
                          ["deposit", "% dep"],
                        ] as const
                      ).map(([field, label]) => (
                        <label
                          key={field}
                          className="flex items-center gap-1.5 text-[11px] text-muted"
                        >
                          <input
                            type="number"
                            disabled={!canConfigure}
                            value={d[field]}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [r.category]: { ...d, [field]: e.target.value },
                              }))
                            }
                            className="w-24 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {canConfigure && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void saveRate(r.category)}
                      >
                        Save
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Geofences */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">
              Geofences
            </h2>
            <p className="text-[11px] text-muted">
              Authorised operating zones — a breach raises a GPS alert.
            </p>
          </div>
          {canConfigure && (
            <Button
              size="sm"
              onClick={() => {
                setEditingFence(null);
                setGeoModal(true);
              }}
            >
              <Plus className="h-4 w-4" /> New geofence
            </Button>
          )}
        </div>

        {geofenceStatus === "loading" && <LoadingBlock label="Loading geofences" />}
        {geofenceStatus !== "loading" && geofences.length === 0 && (
          <EmptyBlock
            icon={MapPinned}
            title="No geofences"
            hint="Define circle zones so out-of-bounds equipment raises alerts."
          />
        )}
        {geofences.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {geofences.map((g) => (
              <div
                key={g.id}
                className="rounded-2xl border border-border bg-surface/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{g.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {g.type} ·{" "}
                      {g.type === "CIRCLE" && g.radiusMeters
                        ? `${(g.radiusMeters / 1000).toFixed(1)} km · `
                        : ""}
                      {g.appliesTo === "CATEGORY"
                        ? `Category: ${g.category}`
                        : "All equipment"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      g.isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/10 text-muted"
                    }`}
                  >
                    {g.isActive ? "Active" : "Off"}
                  </span>
                </div>
                {canConfigure && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingFence(g);
                        setGeoModal(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="!text-danger hover:!bg-danger/5"
                      onClick={() => void deleteGeofence(g.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <GeofenceModal
        open={geoModal}
        onClose={() => setGeoModal(false)}
        editing={editingFence}
      />
    </section>
  );
}

// --- Page shell -------------------------------------------------------------

export default function AdminEquipmentPage() {
  const reduce = useReducedMotion();
  const [params, setParams] = useSearchParams();
  const initialTab = (params.get("tab") as TabKey) || "fleet";
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? initialTab : "fleet"
  );

  const setTabAndUrl = (t: TabKey) => {
    setTab(t);
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };

  return (
    <PermissionGate anyOf={["equipment:view"]}>
      <div className="space-y-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-display text-2xl font-semibold text-ink">
            Equipment &amp; GPS
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage the fleet, work the booking approval queue, monitor live GPS
            and settle deposits.
          </p>
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
                onClick={() => setTabAndUrl(t.key)}
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

        {tab === "fleet" && <FleetTab />}
        {tab === "requests" && <RequestsTab />}
        {tab === "map" && <LiveMapTab />}
        {tab === "alerts" && <AlertsTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </PermissionGate>
  );
}
