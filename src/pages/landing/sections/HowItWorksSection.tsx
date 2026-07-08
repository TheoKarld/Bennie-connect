/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { UserPlus, Wallet, Sprout, TrendingUp } from "lucide-react";
import Reveal from "./Reveal";

const STEPS = [
  {
    icon: UserPlus,
    title: "Sign up",
    text: "Register in minutes, verify your identity and pick a membership tier.",
  },
  {
    icon: Wallet,
    title: "Fund your wallet",
    text: "Top up in Naira via SeerBit — instantly ready to save, book or invest.",
  },
  {
    icon: Sprout,
    title: "Save, invest & book",
    text: "Open savings plans, buy shares, join Adashe circles and book equipment.",
  },
  {
    icon: TrendingUp,
    title: "Grow together",
    text: "Earn interest, dividends and rewards as the cooperative grows with you.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how" className="relative bg-surface/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            How it works
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            From sign-up to harvest, in four steps
          </h2>
        </Reveal>

        <div className="relative mt-16">
          {/* Connective line (desktop) */}
          <div
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent lg:block"
            aria-hidden
          />
          <ol className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal as="li" key={title} delay={i * 0.08} className="relative text-center lg:text-left">
                <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-surface-2 text-primary shadow-sm lg:mx-0">
                  <Icon className="h-6 w-6" aria-hidden />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent font-mono text-xs font-bold text-[#1A2421] shadow">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
