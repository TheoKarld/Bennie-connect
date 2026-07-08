/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Live GPS tracking map (Google Maps JS API).
 *
 * Renders:
 *   - the pickup / equipment location marker (static),
 *   - the live operator marker that smooth-moves as new positions arrive,
 *   - the recent trail as a polyline.
 *
 * GRACEFUL: when `VITE_GOOGLE_MAPS_API_KEY` is absent (or the script fails), it
 * renders a themed "map unavailable" placeholder instead of crashing. Map
 * styling flips with the app theme (dark JSON style in dark mode).
 *
 * Admin-dev: this component is user-plane specific (reads the user store's
 * tracking), but the underlying `loadGoogleMaps()` loader and the dark map style
 * here are safe to reuse.
 */

import React, { useEffect, useRef, useState } from "react";
import { MapPinned, WifiOff } from "lucide-react";

import loadGoogleMaps, {
  isMapsConfigured,
} from "../../../../lib/googleMaps";
import { useTheme } from "../../../../hooks/useTheme";
import type { GeoPoint, GpsPosition } from "../../../../types/equipment";

// A muted dark map style so the map reads as part of the dark theme.
const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1b2320" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1b2320" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ea099" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2a352f" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#13201a" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#22302a" }],
  },
];

function hasCoords(p?: GpsPosition | GeoPoint | null): p is GeoPoint {
  return (
    !!p &&
    typeof (p as GeoPoint).lat === "number" &&
    typeof (p as GeoPoint).lng === "number" &&
    !((p as GeoPoint).lat === 0 && (p as GeoPoint).lng === 0)
  );
}

interface Props {
  pickup?: GeoPoint | null;
  currentPosition?: GpsPosition | null;
  trail?: GpsPosition[];
  className?: string;
}

export default function EquipmentTrackingMap({
  pickup,
  currentPosition,
  trail = [],
  className = "",
}: Props) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Live map objects (kept off-render in refs).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapsRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operatorMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pickupMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trailLineRef = useRef<any>(null);

  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    isMapsConfigured() ? "loading" : "error"
  );

  // Initialise the map once.
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

        const center = hasCoords(currentPosition)
          ? { lat: currentPosition.lat, lng: currentPosition.lng }
          : hasCoords(pickup)
            ? { lat: pickup.lat, lng: pickup.lng }
            : { lat: 9.082, lng: 8.6753 }; // Nigeria centroid fallback

        mapRef.current = new maps.Map(containerRef.current, {
          center,
          zoom: hasCoords(currentPosition) || hasCoords(pickup) ? 14 : 6,
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
    // Init once; theme + position updates are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply the map style on theme change.
  useEffect(() => {
    if (state !== "ready" || !mapRef.current) return;
    mapRef.current.setOptions({
      styles: resolvedTheme === "dark" ? DARK_STYLE : undefined,
    });
  }, [resolvedTheme, state]);

  // Pickup marker.
  useEffect(() => {
    const maps = mapsRef.current;
    if (state !== "ready" || !maps || !mapRef.current) return;
    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setMap(null);
      pickupMarkerRef.current = null;
    }
    if (hasCoords(pickup)) {
      pickupMarkerRef.current = new maps.Marker({
        map: mapRef.current,
        position: { lat: pickup.lat, lng: pickup.lng },
        title: pickup.address || "Pickup location",
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#E7A13C",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
    }
  }, [pickup, state]);

  // Operator live marker + trail.
  useEffect(() => {
    const maps = mapsRef.current;
    if (state !== "ready" || !maps || !mapRef.current) return;

    if (hasCoords(currentPosition)) {
      const pos = { lat: currentPosition.lat, lng: currentPosition.lng };
      if (!operatorMarkerRef.current) {
        operatorMarkerRef.current = new maps.Marker({
          map: mapRef.current,
          position: pos,
          title: "Operator",
          zIndex: 999,
          icon: {
            path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 5,
            rotation: currentPosition.heading ?? 0,
            fillColor: "#135D39",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        mapRef.current.panTo(pos);
      } else {
        // "Smooth-move" — Google's Marker animates the setPosition transition.
        operatorMarkerRef.current.setPosition(pos);
        const icon = operatorMarkerRef.current.getIcon();
        if (icon && typeof icon === "object") {
          operatorMarkerRef.current.setIcon({
            ...icon,
            rotation: currentPosition.heading ?? icon.rotation ?? 0,
          });
        }
        mapRef.current.panTo(pos);
      }
    }

    // Trail polyline.
    const points = trail
      .filter(hasCoords)
      .map((p) => ({ lat: p.lat, lng: p.lng }));
    if (points.length >= 2) {
      if (!trailLineRef.current) {
        trailLineRef.current = new maps.Polyline({
          map: mapRef.current,
          path: points,
          strokeColor: "#E7A13C",
          strokeOpacity: 0.9,
          strokeWeight: 4,
        });
      } else {
        trailLineRef.current.setPath(points);
      }
    }
  }, [currentPosition, trail, state]);

  if (state === "error") {
    const noKey = !isMapsConfigured();
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2 p-8 text-center ${className}`}
      >
        {noKey ? (
          <MapPinned className="h-8 w-8 text-muted" />
        ) : (
          <WifiOff className="h-8 w-8 text-muted" />
        )}
        <p className="text-sm font-semibold text-ink">Map unavailable</p>
        <p className="max-w-xs text-xs text-muted">
          {noKey
            ? "Set VITE_GOOGLE_MAPS_API_KEY to enable the live tracking map."
            : "The map couldn't load right now. Live position updates still arrive below."}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
          <span className="text-xs font-medium text-muted">Loading map…</span>
        </div>
      )}
    </div>
  );
}
