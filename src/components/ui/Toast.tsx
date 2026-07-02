/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal, tasteful toast system for real-time notification arrivals.
 *
 * Plane-agnostic: exposes an imperative `pushToast()` plus a `<Toaster />` that
 * is mounted ONCE at the app root. Any store/provider can fire a toast without a
 * React context by calling `pushToast(...)`.
 */

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Info, AlertTriangle, Bell, X } from "lucide-react";

export type ToastTone = "info" | "success" | "warning" | "alert";

export interface ToastInput {
  id?: string;
  title: string;
  message?: string;
  tone?: ToastTone;
  /** Auto-dismiss delay in ms (default 5000). */
  duration?: number;
  /** Optional click handler (e.g. open the bell / deep link). */
  onClick?: () => void;
}

interface ToastItem extends Required<Pick<ToastInput, "title">> {
  id: string;
  message?: string;
  tone: ToastTone;
  duration: number;
  onClick?: () => void;
}

// --- Tiny external event bus (no context needed) -----------------------------

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();

/** Fire a toast from anywhere (stores, providers, plain functions). */
export function pushToast(input: ToastInput): void {
  const item: ToastItem = {
    id: input.id ?? `toast_${Math.random().toString(36).slice(2, 8)}`,
    title: input.title,
    message: input.message,
    tone: input.tone ?? "info",
    duration: input.duration ?? 5000,
    onClick: input.onClick,
  };
  listeners.forEach((l) => l(item));
}

// --- Visuals -----------------------------------------------------------------

const TONE_STYLES: Record<
  ToastTone,
  { icon: React.ComponentType<{ className?: string }>; ring: string; iconColor: string }
> = {
  success: { icon: CheckCircle2, ring: "border-[#135D39]/20", iconColor: "text-[#135D39]" },
  info: { icon: Info, ring: "border-[#135D39]/15", iconColor: "text-[#135D39]" },
  warning: { icon: AlertTriangle, ring: "border-[#E7A13C]/30", iconColor: "text-[#a6701c]" },
  alert: { icon: Bell, ring: "border-red-200", iconColor: "text-red-500" },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { icon: Icon, ring, iconColor } = TONE_STYLES[toast.tone];

  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={`pointer-events-auto w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-white/95 p-3.5 shadow-xl shadow-[#135D39]/10 backdrop-blur ${ring}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </span>
        <button
          type="button"
          onClick={() => {
            toast.onClick?.();
            onDismiss(toast.id);
          }}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate font-display text-sm font-semibold text-[#1A2421]">
            {toast.title}
          </p>
          {toast.message && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#5C6460]">
              {toast.message}
            </p>
          )}
        </button>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-lg p-1 text-[#9AA29D] transition hover:bg-[#135D39]/5 hover:text-[#1A2421]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

/** Mount once (e.g. inside AppShell). Renders the toast stack. */
export default function Toaster() {
  const reduce = useReducedMotion();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (t) => {
      setToasts((prev) => [...prev.slice(-3), t]); // cap the stack
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2.5"
    >
      <AnimatePresence initial={!reduce}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
