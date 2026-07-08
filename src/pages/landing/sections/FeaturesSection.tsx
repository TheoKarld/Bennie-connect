/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  Users,
  Tractor,
  Sprout,
  ShoppingBasket,
  BadgeDollarSign,
} from "lucide-react";
import Reveal from "./Reveal";

const FEATURES = [
  {
    icon: Wallet,
    title: "Digital Wallet",
    text: "Fund, withdraw and transfer in Naira on secure SeerBit-backed rails.",
  },
  {
    icon: PiggyBank,
    title: "High-yield Savings",
    text: "Flex, Target, Fixed-lock and Harvest plans earning up to 14.5% APY.",
  },
  {
    icon: TrendingUp,
    title: "Shares & Dividends",
    text: "Own verified cooperative equity and earn semi-annual dividend payouts.",
  },
  {
    icon: Users,
    title: "Adashe / Esusu Thrift",
    text: "Rotating savings circles with voting, chat, attendance and payouts.",
  },
  {
    icon: Tractor,
    title: "Equipment Booking",
    text: "Reserve tractors, harvesters and drones with live GPS operator tracking.",
  },
  {
    icon: Sprout,
    title: "Agric Services",
    text: "Book ploughing, threshing, processing and agronomy support on demand.",
  },
  {
    icon: ShoppingBasket,
    title: "Input Marketplace",
    text: "Buy fertilizer, seeds and tools at member prices, delivered to farm.",
  },
  {
    icon: BadgeDollarSign,
    title: "Agent Commissions",
    text: "Field agents register farmers and earn rewards on every activity.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Everything in one portal
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            The full cooperative toolkit
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Eight connected modules that move money, grow savings and power
            agri-services — all sharing one wallet and one membership.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={(i % 4) * 0.06}>
              <div className="group h-full rounded-3xl border border-border bg-surface/70 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl hover:shadow-[#135D39]/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
                  <Icon className="h-5.5 w-5.5" aria-hidden />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
