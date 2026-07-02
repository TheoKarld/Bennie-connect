/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

import { useAdminAuth } from "../../hooks/useAdminAuth";
import { Button, Input, Field } from "../../components/ui";
import { PasswordStrength, isPasswordValid } from "../../components/ui";
import AdminAuthShell from "../../components/admin/AdminAuthShell";
import storage from "../../lib/storage";

/**
 * Forced change-password screen. Reached when `mustChangePassword === true`.
 * Modal-locked: the rest of the app is inaccessible until the password is
 * changed. On success it clears the flag and routes to /bennie/dashboard.
 */
export default function AdminChangePasswordPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { admin, mustChangePassword, changePassword, status } = useAdminAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ current?: string; confirm?: string }>(
    {}
  );

  const hasToken = !!storage.getAdminToken();

  // Not signed in at all → bounce to sign-in.
  if (!hasToken && status !== "authenticated") {
    return <Navigate to="/bennie/auth" replace />;
  }

  // Flag already cleared → nothing to do here.
  useEffect(() => {
    if (status === "authenticated" && !mustChangePassword) {
      navigate("/bennie/dashboard", { replace: true });
    }
  }, [status, mustChangePassword, navigate]);

  const strongEnough = isPasswordValid(newPassword);
  const matches = newPassword.length > 0 && newPassword === confirm;
  const differs = newPassword.length > 0 && newPassword !== currentPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs: { current?: string; confirm?: string } = {};
    if (!currentPassword) errs.current = "Enter your current password.";
    if (!matches) errs.confirm = "Passwords don't match.";
    setFieldErr(errs);
    if (Object.keys(errs).length > 0) return;
    if (!strongEnough) {
      setError("Your new password doesn't meet the security policy.");
      return;
    }
    if (!differs) {
      setError("Your new password must differ from your current one.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      navigate("/bennie/dashboard", { replace: true });
    } catch (err) {
      const anyErr = err as {
        response?: { data?: { error?: { code?: string; message?: string } } };
      };
      const code = anyErr?.response?.data?.error?.code;
      if (code === "ADMIN_AUTH_003") {
        setFieldErr((p) => ({ ...p, current: "Your current password is incorrect." }));
      } else if (code === "ADMIN_AUTH_011") {
        setError("That password doesn't meet the security policy.");
      } else {
        setError(
          anyErr?.response?.data?.error?.message ??
            "Couldn't change your password. Try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminAuthShell>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7A13C]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#a6701c]">
            <ShieldCheck className="h-3 w-3" />
            Security · Required
          </span>
          <h2 className="font-display text-2xl font-semibold text-[#1A2421]">
            Set a new password
          </h2>
          <p className="text-sm text-[#5C6460]">
            {admin?.firstName ? `${admin.firstName}, y` : "Y"}our account requires
            a password change before you can continue.
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
          <Field
            label="Current password"
            htmlFor="cur-pw"
            error={fieldErr.current}
          >
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA29D]"
                aria-hidden
              />
              <Input
                id="cur-pw"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pl-10 pr-11"
                invalid={!!fieldErr.current}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#9AA29D] transition hover:bg-[#135D39]/5 hover:text-[#135D39] focus:outline-none focus:ring-2 focus:ring-[#135D39]/25"
              >
                {showCurrent ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </Field>

          <Field label="New password" htmlFor="new-pw">
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA29D]"
                aria-hidden
              />
              <Input
                id="new-pw"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a strong password"
                className="pl-10 pr-11"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#9AA29D] transition hover:bg-[#135D39]/5 hover:text-[#135D39] focus:outline-none focus:ring-2 focus:ring-[#135D39]/25"
              >
                {showNew ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <PasswordStrength password={newPassword} />
          </Field>

          <Field
            label="Confirm new password"
            htmlFor="confirm-pw"
            error={fieldErr.confirm}
          >
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA29D]"
                aria-hidden
              />
              <Input
                id="confirm-pw"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                className="pl-10 pr-11"
                invalid={!!fieldErr.confirm}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {matches && (
                <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#135D39]" />
              )}
            </div>
          </Field>

          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={submitting}
            disabled={!strongEnough || !matches || !currentPassword}
          >
            Update password & continue
          </Button>
        </form>

        <p className="text-center text-[11px] text-[#9AA29D]">
          For your security, all other admin actions are blocked until this is
          done.
        </p>
      </div>
    </AdminAuthShell>
  );
}
