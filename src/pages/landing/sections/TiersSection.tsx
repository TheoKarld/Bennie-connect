/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link } from "react-router-dom";
import { Check, Crown } from "lucide-react";
import { MEMBERSHIP_TIERS } from "../../../data";
import type { MembershipTierStr } from "../../../types";
import Reveal from "./Reveal";

const ORDER: MembershipTierStr[] = ["Bronze", "Silver", "Gold", "Platinum"];
const HIGHLIGHT: MembershipTierStr = "Gold";

const ACCENTS: Record<MembershipTierStr, string> = {
  Bronze: "text-amber-700 dark:text-amber-400",
  Silver: "text-slate-500 dark:text-slate-300",
  Gold: "text-[#E7A13C]",
  Platinum: "text-violet-600 dark:text-violet-400",
};

function formatCost(cost: number): string {
  if (cost === 0) return "Free";
  return `₦${cost.toLocaleString("en-NG")}`;
}

export default function TiersSection() {
  return (
    <section id="tiers" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Membership tiers
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Choose how far you grow
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Every tier unlocks deeper savings, bigger discounts and priority
            access across the whole platform. Upgrade anytime.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ORDER.map((key, i) => {
            const tier = MEMBERSHIP_TIERS[key];
            const featured = key === HIGHLIGHT;
            return (
              <Reveal key={key} delay={i * 0.06} className="h-full">
                <div
                  className={`relative flex h-full flex-col rounded-3xl border p-6 transition-all duration-300 ${
                    featured
                      ? "border-primary bg-primary text-white shadow-2xl shadow-[#135D39]/25 lg:-translate-y-2"
                      : "border-border bg-surface/70 text-ink shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-[#135D39]/10"
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1A2421] shadow">
                      <Crown className="h-3 w-3" /> Most popular
                    </span>
                  )}

                  <h3
                    className={`font-display text-xl font-bold ${
                      featured ? "text-white" : ACCENTS[key]
                    }`}
                  >
                    {tier.name}
                  </h3>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-mono text-3xl font-semibold">
                      {formatCost(tier.cost)}
                    </span>
                    {tier.cost > 0 && (
                      <span className={`text-xs ${featured ? "text-white/70" : "text-muted"}`}>
                        /year
                      </span>
                    )}
                  </div>

                  <ul className="mt-6 flex-1 space-y-3">
                    {tier.benefits.slice(0, 4).map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm leading-snug">
                        <Check
                          className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                            featured ? "text-accent" : "text-primary"
                          }`}
                          aria-hidden
                        />
                        <span className={featured ? "text-white/90" : "text-muted"}>{b}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/signup"
                    className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 ${
                      featured
                        ? "bg-white text-[#135D39] hover:bg-[#FAF8F5] focus:ring-white/50"
                        : "bg-primary/8 text-primary hover:bg-primary/15 focus:ring-[#135D39]/30"
                    }`}
                  >
                    {tier.cost === 0 ? "Start free" : `Choose ${tier.name}`}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
