/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Location map-picker (Google Maps JS API, shared loader).
 *
 * Click the map to drop / move a pin; the pin's lat/lng is reported back, and a
 * reverse-geocode fills the address (best-effort — falls back to a lat/lng
 * string when the geocoder is unavailable). GRACEFUL: with no
 * `VITE_GOOGLE_MAPS_API_KEY` it renders a themed placeholder with manual
 * lat/lng inputs so the form still works without Maps.
 */

import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import loadGoogleMaps, { isMapsConfigured } from "../../../../lib/googleMaps";
import { useTheme } from "../../../../hooks/useTheme";
import type { GeoPoint } from "../../../../types/adminEquipment";
import { Input } from "../../../../components/ui";

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1b2320" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1b2320" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ea099" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a352f" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#13201a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#22302a" }] },
];

interface Props {
  value?: GeoPoint | null;
  onChange: (point: GeoPoint) => void;
  className?: string;
}

export default function MapPicker({ value, onChange, className = "" }: Props) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapsRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geocoderRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [state, setState] = useState<"loading" | "ready" | "error">(
    isMapsConfigured() ? "loading" : "error"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placePin = (maps: any, pos: { lat: number; lng: number }) => {
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    } else {
      markerRef.current = new maps.Marker({
        map: mapRef.current,
        position: pos,
        draggable: true,
      });
      markerRef.current.addListener("dragend", () => {
        const p = markerRef.current.getPosition();
        commit({ lat: p.lat(), lng: p.lng() });
      });
    }
  };

  const commit = (pos: { lat: number; lng: number }) => {
    const maps = mapsRef.current;
    if (maps) placePin(maps, pos);
    // Reverse-geocode (best-effort).
    if (geocoderRef.current) {
      geocoderRef.current.geocode(
        { location: pos },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (results: any[], status: string) => {
          const address =
            status === "OK" && results?.[0]?.formatted_address
              ? results[0].formatted_address
              : `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
          onChangeRef.current({ lat: pos.lat, lng: pos.lng, address });
        }
      );
    } else {
      onChangeRef.current({
        lat: pos.lat,
        lng: pos.lng,
        address: `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`,
      });
    }
  };

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
        geocoderRef.current = new maps.Geocoder();
        const center =
          value && (value.lat || value.lng)
            ? { lat: value.lat, lng: value.lng }
            : { lat: 9.082, lng: 8.6753 }; // Nigeria centroid
        mapRef.current = new maps.Map(containerRef.current, {
          center,
          zoom: value && (value.lat || value.lng) ? 13 : 6,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          styles: resolvedTheme === "dark" ? DARK_STYLE : undefined,
        });
        if (value && (value.lat || value.lng)) {
          placePin(maps, { lat: value.lat, lng: value.lng });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapRef.current.addListener("click", (e: any) => {
          commit({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // Init once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state !== "ready" || !mapRef.current) return;
    mapRef.current.setOptions({
      styles: resolvedTheme === "dark" ? DARK_STYLE : undefined,
    });
  }, [resolvedTheme, state]);

  if (state === "error") {
    // Manual lat/lng fallback keeps the form usable with no Maps key.
    return (
      <div
        className={`space-y-3 rounded-2xl border border-dashed border-border bg-surface-2 p-4 ${className}`}
      >
        <div className="flex items-center gap-2 text-xs text-muted">
          <MapPin className="h-4 w-4" />
          Map unavailable — set VITE_GOOGLE_MAPS_API_KEY, or enter coordinates
          manually.
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            step="any"
            placeholder="Latitude"
            defaultValue={value?.lat || ""}
            onChange={(e) =>
              onChange({
                lat: Number(e.target.value) || 0,
                lng: value?.lng ?? 0,
                address: value?.address ?? "",
              })
            }
          />
          <Input
            type="number"
            step="any"
            placeholder="Longitude"
            defaultValue={value?.lng || ""}
            onChange={(e) =>
              onChange({
                lat: value?.lat ?? 0,
                lng: Number(e.target.value) || 0,
                address: value?.address ?? "",
              })
            }
          />
        </div>
        <Input
          placeholder="Address / depot label"
          defaultValue={value?.address || ""}
          onChange={(e) =>
            onChange({
              lat: value?.lat ?? 0,
              lng: value?.lng ?? 0,
              address: e.target.value,
            })
          }
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className="relative h-56 overflow-hidden rounded-2xl border border-border"
        aria-label="Location picker map"
      >
        <div ref={containerRef} className="h-full w-full" />
        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
            <span className="text-xs font-medium text-muted">Loading map…</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {value && (value.lat || value.lng) ? (
          <>
            Pinned:{" "}
            <span className="font-mono text-ink">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
            {value.address ? ` · ${value.address}` : ""}
          </>
        ) : (
          "Click the map to drop a location pin."
        )}
      </p>
    </div>
  );
}
