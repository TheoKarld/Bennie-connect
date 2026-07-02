/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Sparkles,
  Wallet,
  TrendingUp,
  ShieldCheck,
  PiggyBank,
} from "lucide-react";
import { useAuthStore } from "../../../store/authStore";

/* Small stylized savings ring (SVG) */
function SavingsRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#135D39" strokeOpacity="0.12" strokeWidth="7" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="#E7A13C"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
      />
    </svg>
  );
}

/* Shares sparkline built from the real priceTrend shape */
function Sparkline() {
  const pts = [410, 435, 450, 485, 500];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const w = 120;
  const h = 40;
  const path = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#135D39" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#135D39" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill="url(#sparkFill)" />
      <path d={path} fill="none" stroke="#135D39" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TRUST = [
  { label: "Members saved", value: "₦2.4B+" },
  { label: "Dividends paid", value: "₦180M" },
  { label: "Cooperatives", value: "60+" },
];

export default function HeroSection() {
  const reduce = useReducedMotion();
  const status = useAuthStore((s) => s.status);
  const isAuthed = status === "authenticated";

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
  };
  const item = reduce
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: 22 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
        },
      };

  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-20 lg:pt-36 lg:pb-28">
      {/* Ambient mesh + grid */}
      <div className="lp-mesh-bg lp-mesh pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="lp-grid pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(60%_50%_at_50%_20%,black,transparent)]" aria-hidden />

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8">
        {/* Copy */}
        <motion.div variants={container} initial="hidden" animate="show" className="text-center lg:text-left">
          <motion.span
            variants={item}
            className="inline-flex items-center gap-2 rounded-full border border-[#135D39]/15 bg-white/70 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#135D39] shadow-sm backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#E7A13C]" /> Cooperative finance for Nigerian farmers
          </motion.span>

          <motion.h1
            variants={item}
            className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-[#1A2421] sm:text-5xl lg:text-[3.5rem]"
          >
            Grow farm wealth <span className="lp-text-gradient">together</span>, the cooperative way.
          </motion.h1>

          <motion.p
            variants={item}
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#5C6460] sm:text-lg lg:mx-0"
          >
            One Naira-native portal for savings, a digital wallet, cooperative shares &amp;
            dividends, Adashe thrift circles, equipment booking, an input marketplace, and a
            rewarded agent network — built for farmers, powered by community.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start"
          >
            <Link
              to={isAuthed ? "/app" : "/signup"}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#135D39] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#135D39]/25 transition hover:bg-[#0f4c2f] hover:shadow-xl hover:shadow-[#135D39]/30 focus:outline-none focus:ring-2 focus:ring-[#135D39]/40 sm:w-auto"
            >
              {isAuthed ? "Go to dashboard" : "Get started free"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <a
              href="#features"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#135D39]/25 bg-white/60 px-7 py-3.5 text-base font-semibold text-[#135D39] backdrop-blur transition hover:bg-[#135D39]/5 focus:outline-none focus:ring-2 focus:ring-[#135D39]/30 sm:w-auto"
            >
              Explore features
            </a>
          </motion.div>

          {/* Trust strip */}
          <motion.div variants={item} className="mt-10">
            <p className="text-xs font-medium uppercase tracking-wider text-[#5C6460]/80">
              Trusted by cooperatives across Nigeria
            </p>
            <div className="mt-4 flex items-center justify-center gap-6 sm:gap-9 lg:justify-start">
              {TRUST.map((t) => (
                <div key={t.label} className="text-center lg:text-left">
                  <div className="font-mono text-xl font-semibold text-[#135D39] sm:text-2xl">{t.value}</div>
                  <div className="mt-0.5 text-[11px] text-[#5C6460]">{t.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] italic text-[#5C6460]/60">Figures illustrative.</p>
          </motion.div>
        </motion.div>

        {/* Visual mockup */}
        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          {/* Glow behind */}
          <div className="absolute inset-0 -z-10 rounded-[2.5rem] bg-gradient-to-br from-[#135D39]/20 via-transparent to-[#E7A13C]/20 blur-2xl" aria-hidden />

          {/* Main wallet card */}
          <div className="lp-float relative rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-2xl shadow-[#135D39]/15 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#135D39] text-white">
                  <Wallet className="h-4.5 w-4.5" />
                </div>
                <span className="text-sm font-semibold text-[#1A2421]">Digital Wallet</span>
              </div>
              <span className="rounded-full bg-[#135D39]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#135D39]">
                NGN
              </span>
            </div>
            <div className="mt-5">
              <p className="text-xs text-[#5C6460]">Available balance</p>
              <p className="mt-1 font-mono text-3xl font-semibold text-[#1A2421]">₦184,500.00</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#E6E5DF] bg-[#FAF8F5] p-3">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-[#135D39]" />
                  <span className="text-[11px] font-medium text-[#5C6460]">Flex Save</span>
                </div>
                <p className="mt-1 font-mono text-sm font-semibold text-[#1A2421]">₦420,000</p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#E6E5DF] bg-[#FAF8F5] p-3">
                <SavingsRing pct={60} />
                <div>
                  <p className="text-[11px] font-medium text-[#5C6460]">Target</p>
                  <p className="font-mono text-sm font-semibold text-[#135D39]">60%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Floating shares card */}
          <div className="lp-float-slow absolute -bottom-8 -left-4 w-52 rounded-2xl border border-white/60 bg-white/85 p-4 shadow-xl shadow-[#135D39]/10 backdrop-blur-xl sm:-left-8">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1A2421]">Coop Shares</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#135D39]/10 px-2 py-0.5 text-[10px] font-bold text-[#135D39]">
                <TrendingUp className="h-3 w-3" /> +18.2%
              </span>
            </div>
            <Sparkline />
            <p className="mt-1 font-mono text-sm font-semibold text-[#1A2421]">₦500 / share</p>
          </div>

          {/* Floating dividend chip */}
          <div className="lp-float absolute -right-2 -top-5 flex items-center gap-2 rounded-2xl border border-white/60 bg-white/85 px-4 py-3 shadow-xl shadow-[#E7A13C]/15 backdrop-blur-xl sm:-right-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E7A13C]/15 text-[#a6701c]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-[#5C6460]">Dividend paid</p>
              <p className="font-mono text-sm font-semibold text-[#135D39]">₦18,400</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
