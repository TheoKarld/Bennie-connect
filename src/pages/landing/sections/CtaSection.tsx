/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sprout } from "lucide-react";
import Reveal from "./Reveal";

export default function CtaSection() {
  return (
    <section className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-primary px-6 py-16 text-center shadow-2xl shadow-[#135D39]/25 sm:px-12">
            {/* Decorative gradient wash */}
            <div
              className="lp-mesh pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(30rem 30rem at 15% 0%, rgba(231,161,60,0.35), transparent 60%), radial-gradient(28rem 28rem at 90% 110%, rgba(255,255,255,0.14), transparent 60%)",
              }}
              aria-hidden
            />
            <div className="relative z-10 mx-auto max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white/90 backdrop-blur">
                <Sprout className="h-3.5 w-3.5 text-accent" /> Join the cooperative
              </span>
              <h2 className="mt-6 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                Your harvest, your wealth, your community.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/80">
                Open your free account today and start saving, investing and
                booking with thousands of farmers across Nigeria.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-[#135D39] shadow-lg transition hover:bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-white/60 sm:w-auto"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/40 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40 sm:w-auto"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
