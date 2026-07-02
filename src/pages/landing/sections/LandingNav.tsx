/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sprout, Menu, X, ArrowRight } from "lucide-react";
import { useAuthStore } from "../../../store/authStore";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Savings", href: "#how" },
  { label: "Cooperative", href: "#tiers" },
  { label: "Agents", href: "#proof" },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const status = useAuthStore((s) => s.status);
  const isAuthed = status === "authenticated";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-[#E6E5DF]/80 bg-[#FAF8F5]/80 backdrop-blur-xl shadow-[0_1px_20px_rgba(19,93,57,0.06)]"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8">
        {/* Wordmark */}
        <a href="#top" className="flex items-center gap-3" aria-label="Bennie Connect home">
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
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-[#5C6460] transition hover:bg-[#135D39]/5 hover:text-[#1A2421]"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-2 md:flex">
          {isAuthed ? (
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-full bg-[#135D39] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#135D39]/15 transition hover:bg-[#0f4c2f] focus:outline-none focus:ring-2 focus:ring-[#135D39]/30"
            >
              Go to dashboard <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#5C6460] transition hover:bg-[#135D39]/5 hover:text-[#1A2421] focus:outline-none focus:ring-2 focus:ring-[#135D39]/30"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-[#135D39] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#135D39]/15 transition hover:bg-[#0f4c2f] focus:outline-none focus:ring-2 focus:ring-[#135D39]/30"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E6E5DF] bg-white/70 text-[#1A2421] transition hover:bg-[#135D39]/5 md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-[#E6E5DF]/80 bg-[#FAF8F5]/95 backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-base font-medium text-[#1A2421] transition hover:bg-[#135D39]/5"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {isAuthed ? (
                <Link
                  to="/app"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#135D39] px-5 py-3 text-sm font-semibold text-white"
                >
                  Go to dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-[#135D39]/30 px-5 py-3 text-center text-sm font-semibold text-[#135D39]"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-[#135D39] px-5 py-3 text-center text-sm font-semibold text-white"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
