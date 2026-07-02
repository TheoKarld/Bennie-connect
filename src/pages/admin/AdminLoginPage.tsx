/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";

import { useAdminAuth } from "../../hooks/useAdminAuth";
import { Button, Input, Field } from "../../components/ui";
import AdminAuthShell from "../../components/admin/AdminAuthShell";

interface LocationState {
  from?: string;
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const { login, status, error, clearError } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);

  const from =
    (location.state as LocationState | null)?.from ??
    new URLSearchParams(location.search).get("from") ??
    undefined;

  // Already authenticated → skip the form.
  useEffect(() => {
    if (status === "authenticated") {
      navigate("/bennie/dashboard", { replace: true });
    }
  }, [status, navigate]);

  // Clear any stale store error when the form mounts.
  useEffect(() => {
    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (): boolean => {
    let ok = true;
    setEmailErr(null);
    setPasswordErr(null);
    if (!email.trim()) {
      setEmailErr("Email is required.");
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailErr("Enter a valid email address.");
      ok = false;
    }
    if (!password) {
      setPasswordErr("Password is required.");
      ok = false;
    }
    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const admin = await login({
        email: email.trim().toLowerCase(),
        password,
      });
      if (admin.mustChangePassword) {
        navigate("/bennie/change-password", { replace: true });
      } else {
        navigate(from && from.startsWith("/bennie") ? from : "/bennie/dashboard", {
          replace: true,
        });
      }
    } catch {
      // error surfaced via store `error`
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || status === "loading";

  return (
    <AdminAuthShell>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-semibold text-[#1A2421]">
            Admin sign-in
          </h2>
          <p className="text-sm text-[#5C6460]">
            Access the Bennie Connect operations console.
          </p>
        </div>

        {error && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="admin-email" error={emailErr ?? undefined}>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA29D]"
                aria-hidden
              />
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                placeholder="admin@bennieconnect.com"
                className="pl-10"
                invalid={!!emailErr}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!emailErr}
                required
              />
            </div>
          </Field>

          <Field
            label="Password"
            htmlFor="admin-password"
            error={passwordErr ?? undefined}
          >
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA29D]"
                aria-hidden
              />
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pl-10 pr-11"
                invalid={!!passwordErr}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!passwordErr}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#9AA29D] transition hover:bg-[#135D39]/5 hover:text-[#135D39] focus:outline-none focus:ring-2 focus:ring-[#135D39]/25"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </Field>

          <Button type="submit" fullWidth size="lg" loading={busy}>
            Sign in
          </Button>
        </form>

        <p className="text-center text-[11px] leading-relaxed text-[#9AA29D]">
          Admin accounts are provisioned by a Super Admin. There is no
          self-registration.
        </p>
      </div>
    </AdminAuthShell>
  );
}
