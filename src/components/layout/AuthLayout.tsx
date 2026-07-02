/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Outlet, Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  Sprout,
  ShieldCheck,
  PiggyBank,
  TrendingUp,
  Quote,
  Star,
} from "lucide-react";

const VALUE_PROPS = [
  { icon: PiggyBank, text: "Flex, Target & Harvest savings up to 14.5% APY" },
  { icon: TrendingUp, text: "Own verified cooperative equity shares" },
  { icon: ShieldCheck, text: "Bank-grade secure wallet in Naira" },
];

/**
 * Branded split wrapper for auth pages: a forest-green promotional panel on the
 * left (a slim header on mobile) and the form <Outlet/> on the right. The brand
 * panel uses a layered mesh gradient, subtle ambient motion, value props and a
 * member testimonial to match the landing page's design bar.
 */
export default function AuthLayout() {
  const reduce = useReducedMotion();

  return (
    <div className="min-h-screen flex bg-[#FAF8F5] text-[#1A2421]">
      {/* LEFT — brand panel (desktop) */}
      <div className="hidden lg:flex w-[46%] xl:w-1/2 flex-col justify-between bg-[#0F4C2F] text-white p-12 xl:p-14 relative overflow-hidden">
        {/* Layered mesh + ambient glows */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(38rem 38rem at 82% -6%, rgba(113,181,59,0.28), transparent 60%)," +
              "radial-gradient(30rem 30rem at 6% 14%, rgba(231,161,60,0.22), transparent 55%)," +
              "radial-gradient(34rem 34rem at 50% 112%, rgba(19,93,57,0.55), transparent 62%)",
          }}
        />
        <div className="lp-grid absolute inset-0 opacity-[0.12]" aria-hidden />
        <motion.div
          aria-hidden
          className="absolute -right-40 -top-40 w-[420px] h-[420px] rounded-full bg-[#71B53B]/15 blur-[120px]"
          animate={reduce ? undefined : { scale: [1, 1.12, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -left-40 -bottom-40 w-[380px] h-[380px] rounded-full bg-[#E7A13C]/15 blur-[120px]"
          animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Wordmark */}
        <Link to="/" className="flex items-center gap-3 relative z-10 w-max group">
          <div className="w-11 h-11 rounded-2xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center transition-transform group-hover:scale-105">
            <Sprout className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-display font-semibold text-lg tracking-tight block leading-none">
              Bennie Connect
            </span>
            <span className="text-[10px] text-white/70 font-bold uppercase tracking-[0.18em] block mt-1">
              Cooperative Portal
            </span>
          </div>
        </Link>

        {/* Headline + value props */}
        <div className="relative z-10 space-y-8 max-w-md">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/85">
              <Star className="w-3 h-3 text-[#E7A13C] fill-[#E7A13C]" />
              Trusted by 12,000+ farmers
            </span>
            <h1 className="font-display text-[2rem] xl:text-[2.35rem] font-semibold leading-[1.15]">
              Grow your farm with cooperative capital, savings and shares.
            </h1>
            <p className="text-white/75 text-sm leading-relaxed">
              Join thousands of Nigerian farmers building mutual wealth — flexible
              savings, rotating Adashe circles, verified equipment booking, and
              cooperative equity, all in one portal.
            </p>
          </motion.div>

          <div className="space-y-3 pt-1">
            {VALUE_PROPS.map(({ icon: Icon, text }, i) => (
              <motion.div
                key={i}
                initial={reduce ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.25 + i * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex items-center gap-3 text-sm text-white/90"
              >
                <span className="w-8 h-8 rounded-xl bg-white/10 ring-1 ring-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                {text}
              </motion.div>
            ))}
          </div>

          {/* Testimonial */}
          <motion.figure
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl bg-white/[0.07] ring-1 ring-white/10 backdrop-blur-sm p-5"
          >
            <Quote className="w-5 h-5 text-[#E7A13C] mb-2" />
            <blockquote className="text-sm text-white/90 leading-relaxed">
              "My Adashe circle paid out in time for planting season. I bought
              seed and fertilizer without a single bank loan."
            </blockquote>
            <figcaption className="mt-3 flex items-center gap-2 text-[11px] text-white/60">
              <span className="w-6 h-6 rounded-full bg-[#E7A13C]/25 ring-1 ring-white/10 flex items-center justify-center font-bold text-[10px] text-[#E7A13C]">
                AY
              </span>
              Aliyu Yusuf · Rice farmer, Kano
            </figcaption>
          </motion.figure>
        </div>

        <p className="relative z-10 text-[11px] text-white/45 font-mono">
          © 1999 - 2026 Bennie Connect Cooperative
        </p>
      </div>

      {/* RIGHT — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        {/* Mobile brand header */}
        <div className="w-full max-w-md lg:hidden mb-8">
          <Link to="/" className="flex items-center gap-2.5 w-max">
            <div className="w-9 h-9 rounded-xl bg-[#135D39] flex items-center justify-center shadow-sm">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display font-semibold text-[#1A2421] text-lg leading-none block">
                Bennie Connect
              </span>
              <span className="text-[9px] text-[#5C6460] font-bold uppercase tracking-[0.16em]">
                Cooperative Portal
              </span>
            </div>
          </Link>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md rounded-[28px] bg-white/70 ring-1 ring-[#E6E5DF] shadow-[0_8px_40px_-12px_rgba(19,93,57,0.15)] backdrop-blur-sm p-7 sm:p-9"
        >
          <Outlet />
        </motion.div>

        <p className="mt-6 text-center text-[11px] text-[#9AA29D] max-w-md">
          Protected by bank-grade encryption. By continuing you agree to our
          cooperative terms.
        </p>
      </div>
    </div>
  );
}
