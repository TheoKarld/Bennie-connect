/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Fleet table — rows deep-link to the equipment detail. Shows a thumbnail,
 * name/category/model, status chip, rates, GPS-active indicator and booking
 * history count. Presentational; filters/search live on the page.
 */

import React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Radio, Tractor } from "lucide-react";

import type { Equipment } from "../../../../types/adminEquipment";
import { EquipmentStatusChip, ngn } from "./shared";

export default function FleetTable({ rows }: { rows: Equipment[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface/70 shadow-sm">
      <div className="hidden grid-cols-12 gap-4 border-b border-border bg-surface-2 px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-muted md:grid">
        <span className="col-span-5">Equipment</span>
        <span className="col-span-2">Status</span>
        <span className="col-span-3">Rates</span>
        <span className="col-span-1 text-right">Uses</span>
        <span className="col-span-1" />
      </div>
      <ul className="divide-y divide-border">
        {rows.map((e, i) => {
          const gpsActive =
            (e as { gpsTracker?: { isActive?: boolean } }).gpsTracker?.isActive;
          return (
            <motion.li
              key={e.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
            >
              <Link
                to={`/bennie/equipment-booking/${e.id}`}
                className="grid grid-cols-1 gap-3 px-6 py-4 transition hover:bg-primary/[0.03] md:grid-cols-12 md:items-center md:gap-4"
              >
                <div className="col-span-5 flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/8 text-primary">
                    {e.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.images[0]}
                        alt={e.equipmentName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Tractor className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {e.equipmentName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {e.category.charAt(0) + e.category.slice(1).toLowerCase()}
                      {e.model ? ` · ${e.model}` : ""}
                      {gpsActive && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-primary">
                          <Radio className="h-3 w-3" /> GPS
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="col-span-2">
                  <EquipmentStatusChip status={e.status} />
                </div>

                <div className="col-span-3 text-[11px] text-muted">
                  <span className="font-mono text-ink">{ngn(e.hourlyRate)}</span>
                  /hr ·{" "}
                  <span className="font-mono text-ink">{ngn(e.dailyRate)}</span>
                  /day
                </div>

                <div className="col-span-1 md:text-right">
                  <span className="font-mono text-sm text-ink">
                    {e.bookingHistory ?? 0}
                  </span>
                </div>

                <div className="col-span-1 flex md:justify-end">
                  <ArrowRight className="h-4 w-4 text-muted/60" />
                </div>
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
