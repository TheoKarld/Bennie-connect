/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Star, Quote } from "lucide-react";
import Reveal from "./Reveal";

const STATS = [
  { value: "12,000+", label: "Farmers onboarded" },
  { value: "60+", label: "Cooperatives" },
  { value: "₦2.4B+", label: "Member savings" },
  { value: "98%", label: "Adashe repayment" },
];

const TESTIMONIALS = [
  {
    quote:
      "The Adashe circle paid out ₦360,000 straight to my wallet — no bank, no delay. I bought a disc plough for the season the same week.",
    name: "Ibrahim Kabiru",
    role: "Maize farmer · Kano",
    initials: "IK",
  },
  {
    quote:
      "As a field agent I register farmers and earn a commission on every activity. It has changed how our whole community saves and invests.",
    name: "Aliyu Mohammed",
    role: "Bronze Agent · Zaria",
    initials: "AM",
  },
];

export default function SocialProofSection() {
  return (
    <section id="proof" className="relative bg-surface/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Stats band */}
        <Reveal>
          <div className="grid grid-cols-2 gap-6 rounded-3xl border border-border bg-surface/70 p-8 shadow-sm sm:grid-cols-4 sm:p-10">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-mono text-3xl font-semibold text-primary sm:text-4xl">
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-muted sm:text-sm">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] italic text-muted/60">
            Figures illustrative of platform scale.
          </p>
        </Reveal>

        {/* Testimonials */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <figure className="flex h-full flex-col rounded-3xl border border-border bg-surface/70 p-7 shadow-sm">
                <Quote className="h-7 w-7 text-accent" aria-hidden />
                <blockquote className="mt-4 flex-1 text-base leading-relaxed text-ink">
                  "{t.quote}"
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary font-mono text-sm font-semibold text-white">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-ink">{t.name}</div>
                    <div className="text-xs text-muted">{t.role}</div>
                  </div>
                  <div className="ml-auto flex gap-0.5" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className="h-4 w-4 fill-accent text-accent" aria-hidden />
                    ))}
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
