/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Live fleet GPS map (Google Maps JS API, shared loader).
 *
 * Plots every in-use unit's live operator marker (smooth-moves as positions
 * arrive), colour-coded, plus geofence overlays (circles / polygons). Clicking a
 * marker reports its bookingId back to the caller. GRACEFUL: with no Maps key it
 * renders a themed placeholder — positions still stream into the side panel.
 */

import React, { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";

import loadGoogleMaps, { isMapsConfigured } from "../../../../lib/googleMaps";
import { useTheme } from "../../../../hooks/useTheme";
import type { FleetLivePosition, Geofence } from "../../../../types/adminEquipment";

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1b2320" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1b2320" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ea099" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a352f" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#13201a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#22302a" }] },
];

interface Props {
  positions: FleetLivePosition[];
  geofences?: Geofence[];
  onSelect?: (bookingId?: string) => void;
  className?: string;
}

export default function FleetMap({
  positions,
  geofences = [],
  onSelect,
  className = "",
}: Props) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapsRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fenceShapesRef = useRef<any[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [state, setState] = useState<"loading" | "ready" | "error">(
    isMapsConfigured() ? "loading" : "error"
  );

  // Init once.
  useEffect(() => {
    if (!isMapsConfigured()) {
      setState("error");
      return;
    }
    let cancelled = false;
    setState("loading");
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: 9.082, lng: 8.6753 },
          zoom: 6,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          styles: resolvedTheme === "dark" ? DARK_STYLE : undefined,
        });
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state !== "ready" || !mapRef.current) return;
    mapRef.current.setOptions({
      styles: resolvedTheme === "dark" ? DARK_STYLE : undefined,
    });
  }, [resolvedTheme, state]);

  // Geofence overlays.
  useEffect(() => {
    const maps = mapsRef.current;
    if (state !== "ready" || !maps || !mapRef.current) return;
    fenceShapesRef.current.forEach((s) => s.setMap(null));
    fenceShapesRef.current = [];
    geofences
      .filter((g) => g.isActive)
      .forEach((g) => {
        if (g.type === "CIRCLE" && g.center && g.radiusMeters) {
          fenceShapesRef.current.push(
            new maps.Circle({
              map: mapRef.current,
              center: g.center,
              radius: g.radiusMeters,
              strokeColor: "#135D39",
              strokeOpacity: 0.7,
              strokeWeight: 1.5,
              fillColor: "#135D39",
              fillOpacity: 0.06,
            })
          );
        } else if (g.type === "POLYGON" && g.polygon && g.polygon.length >= 3) {
          fenceShapesRef.current.push(
            new maps.Polygon({
              map: mapRef.current,
              paths: g.polygon,
              strokeColor: "#135D39",
              strokeOpacity: 0.7,
              strokeWeight: 1.5,
              fillColor: "#135D39",
              fillOpacity: 0.06,
            })
          );
        }
      });
  }, [geofences, state]);

  // Fleet markers (smooth-move on update, add/remove diffing).
  useEffect(() => {
    const maps = mapsRef.current;
    if (state !== "ready" || !maps || !mapRef.current) return;

    const seen = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bounds = new maps.LatLngBounds();
    let hasAny = false;

    positions.forEach((p) => {
      if (!p.position || (p.position.lat === 0 && p.position.lng === 0)) return;
      const key = p.bookingId || p.equipmentId;
      if (!key) return;
      seen.add(key);
      hasAny = true;
      const pos = { lat: p.position.lat, lng: p.position.lng };
      bounds.extend(pos);

      let marker = markersRef.current.get(key);
      const color = p.status === "OVERDUE" ? "#B4341C" : "#135D39";
      if (!marker) {
        marker = new maps.Marker({
          map: mapRef.current,
          position: pos,
          title: p.equipmentName ?? "Unit",
          icon: {
            path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 5,
            rotation: p.position.heading ?? 0,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        marker.addListener("click", () => onSelectRef.current?.(p.bookingId));
        markersRef.current.set(key, marker);
      } else {
        marker.setPosition(pos);
        const icon = marker.getIcon();
        if (icon && typeof icon === "object") {
          marker.setIcon({
            ...icon,
            rotation: p.position.heading ?? icon.rotation ?? 0,
            fillColor: color,
          });
        }
      }
    });

    // Remove markers no longer present.
    markersRef.current.forEach((marker, key) => {
      if (!seen.has(key)) {
        marker.setMap(null);
        markersRef.current.delete(key);
      }
    });

    if (hasAny && !bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, 64);
      const z = mapRef.current.getZoom();
      if (z && z > 14) mapRef.current.setZoom(14);
    }
  }, [positions, state]);

  if (state === "error") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2 p-8 text-center ${className}`}
      >
        <MapPinned className="h-8 w-8 text-muted" />
        <p className="text-sm font-semibold text-ink">Map unavailable</p>
        <p className="max-w-xs text-xs text-muted">
          Set VITE_GOOGLE_MAPS_API_KEY to enable the live fleet map. Live
          positions still list in the panel.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border ${className}`}
    >
      <div ref={containerRef} className="h-full w-full" />
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
          <span className="text-xs font-medium text-muted">Loading map…</span>
        </div>
      )}
    </div>
  );
}
