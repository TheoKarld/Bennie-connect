/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { MapPin, Star, ShieldCheck, ImageOff } from "lucide-react";

import { Badge, Button } from "../../../../components/ui";
import { formatNaira } from "../../../../lib/format";
import type { Equipment } from "../../../../types/equipment";
import { CATEGORY_META } from "./equipmentMeta";

export default function EquipmentCard({
  item,
  index = 0,
  onRequest,
}: {
  item: Equipment;
  index?: number;
  onRequest: (item: Equipment) => void;
}) {
  const reduce = useReducedMotion();
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META.OTHER;
  const Icon = meta.icon;
  const image = item.images?.[0];
  const unavailable = item.available === false;

  const body = (
    <div className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      {/* Media */}
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        {image ? (
          <img
            src={image}
            alt={item.equipmentName}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted">
            <Icon className="h-10 w-10 opacity-40" />
            <span className="flex items-center gap-1 text-[11px] font-medium">
              <ImageOff className="h-3 w-3" /> No image
            </span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Badge tone="green" className="backdrop-blur-sm">
            <Icon className="h-3 w-3" /> {meta.label}
          </Badge>
        </div>
        {typeof item.rating === "number" && item.rating > 0 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <Star className="h-3 w-3 fill-accent text-accent" />
            {item.rating.toFixed(1)}
          </span>
        )}
        {unavailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-bold text-ink">
              Booked for this window
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="truncate font-display text-base font-semibold text-ink">
          {item.equipmentName}
        </h3>
        {item.model && (
          <p className="mt-0.5 truncate text-xs text-muted">{item.model}</p>
        )}

        {item.location?.address && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{item.location.address}</span>
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface-2 p-3 text-xs">
          <div>
            <span className="block text-[10px] font-medium uppercase tracking-wide text-muted">
              Daily
            </span>
            <span className="mt-0.5 block font-mono font-bold text-ink">
              {formatNaira(item.dailyRate)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-medium uppercase tracking-wide text-muted">
              Hourly
            </span>
            <span className="mt-0.5 block font-mono font-bold text-ink">
              {formatNaira(item.hourlyRate)}
            </span>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Refundable deposit {formatNaira(item.depositRequired)}
        </p>

        <div className="mt-auto pt-4">
          <Button
            fullWidth
            size="sm"
            disabled={unavailable}
            onClick={() => onRequest(item)}
          >
            {unavailable ? "Unavailable" : "Request booking"}
          </Button>
        </div>
      </div>
    </div>
  );

  if (reduce) return body;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.04 * index, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      {body}
    </motion.div>
  );
}
