/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Sprout,
  ShieldCheck,
  Lock,
  Activity,
  Star,
} from "lucide-react";

const OPS_PROPS = [
  { icon: ShieldCheck, text: "Granular role-based access control" },
  { icon: Activity, text: "Full audit trail on every admin action" },
  { icon: Lock, text: "Separate, hardened admin identity plane" },
];

/**
 * Premium split-panel wrapper for the admin auth surfaces (sign-in + forced
 * change-password). A darker forest ops-console panel on the left distinguishes
 * it from the user auth layout while staying on-brand.
 */
export default function AdminAuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {/* LEFT — ops brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[#0B3020] p-12 text-white lg:flex xl:w-1/2 xl:p-14">
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(38rem 38rem at 82% -6%, rgba(19,93,57,0.55), transparent 60%)," +
              "radial-gradient(30rem 30rem at 6% 14%, rgba(231,161,60,0.20), transparent 55%)," +
              "radial-gradient(34rem 34rem at 50% 112%, rgba(11,48,32,0.7), transparent 62%)",
          }}
        />
        <div className="lp-grid absolute inset-0 opacity-[0.10]" aria-hidden />
        <motion.div
          aria-hidden
          className="absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#135D39]/25 blur-[120px]"
          animate={
            reduce ? undefined : { scale: [1, 1.12, 1], opacity: [0.5, 0.8, 0.5] }
          }
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-40 -left-40 h-[380px] w-[380px] rounded-full bg-[#E7A13C]/12 blur-[120px]"
          animate={
            reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.4, 0.6, 0.4] }
          }
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10 flex w-max items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Sprout className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="block font-display text-lg font-semibold leading-none tracking-tight">
              Bennie Connect
            </span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#E7A13C]">
              Admin Console
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-8">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/85 ring-1 ring-white/15">
              <Star className="h-3 w-3 fill-[#E7A13C] text-[#E7A13C]" />
              Operations Overwatch
            </span>
            <h1 className="font-display text-[2rem] font-semibold leading-[1.15] xl:text-[2.35rem]">
              Supervise the cooperative from a single secure console.
            </h1>
            <p className="text-sm leading-relaxed text-white/70">
              Users, wallets, savings, shares, marketplace, equipment and the
              audit trail — governed by granular permissions, every action
              logged.
            </p>
          </motion.div>

          <div className="space-y-3 pt-1">
            {OPS_PROPS.map(({ icon: Icon, text }, i) => (
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative z-10 font-mono text-[11px] text-white/40">
          © 1999 - 2026 Bennie Connect Cooperative · Admin Plane
        </p>
      </div>

      {/* RIGHT — form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <div className="mb-8 w-full max-w-md lg:hidden">
          <div className="flex w-max items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
              <Sprout className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="block font-display text-lg font-semibold leading-none text-ink">
                Bennie Connect
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
                Admin Console
              </span>
            </div>
          </div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md rounded-[28px] bg-surface/70 p-7 shadow-[0_8px_40px_-12px_rgba(19,93,57,0.15)] ring-1 ring-border backdrop-blur-sm sm:p-9"
        >
          {children}
        </motion.div>

        <p className="mt-6 max-w-md text-center text-[11px] text-muted">
          Restricted access. All sessions are monitored and audited.
        </p>
      </div>
    </div>
  );
}
