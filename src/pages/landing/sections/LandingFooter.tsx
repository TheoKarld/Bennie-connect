/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how" },
      { label: "Membership", href: "#tiers" },
      { label: "For agents", href: "#proof" },
    ],
  },
  {
    title: "Modules",
    links: [
      { label: "Digital Wallet", href: "#features" },
      { label: "Savings", href: "#features" },
      { label: "Cooperative Shares", href: "#features" },
      { label: "Adashe Thrift", href: "#features" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Get started", href: "/signup" },
    ],
  },
];

export default function LandingFooter() {
  return (
    <footer className="relative border-t border-[#E6E5DF] bg-white/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#135D39] shadow-lg shadow-[#135D39]/20">
                <Sprout className="h-5 w-5 text-white" aria-hidden />
              </div>
              <div className="leading-none">
                <span className="block font-display text-base font-bold tracking-tight text-[#1A2421]">
                  Bennie Connect
                </span>
                <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#135D39]">
                  Cooperative Portal
                </span>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#5C6460]">
              Cooperative finance and agri-services for Nigerian farmers — savings,
              shares, thrift, equipment and marketplace in one Naira-native portal.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A2421]">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) =>
                  l.href.startsWith("/") ? (
                    <li key={l.label}>
                      <Link
                        to={l.href}
                        className="text-sm text-[#5C6460] transition hover:text-[#135D39]"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-[#5C6460] transition hover:text-[#135D39]"
                      >
                        {l.label}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#E6E5DF] pt-6 sm:flex-row">
          <span className="text-xs text-[#5C6460]">
            © 1999 – 2026 Bennie Connect Cooperative. All rights reserved.
          </span>
          <span className="font-mono text-xs text-[#5C6460]">
            Secure SHA-256 Ledger · SeerBit Active
          </span>
        </div>
      </div>
    </footer>
  );
}
