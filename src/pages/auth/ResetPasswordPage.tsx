/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";

import { authService } from "../../services/auth.service";
import {
  Button,
  Input,
  Field,
  PasswordStrength,
  isPasswordValid,
} from "../../components/ui";

const REDIRECT_DELAY_MS = 2200;

/**
 * Complete a password reset with the token from the emailed link. Missing token
 * -> "invalid or expired link" state. On success -> confirmation + auto-redirect
 * to /login. A 400 from the backend means the token is invalid/expired.
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const token = (params.get("token") || "").trim();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  // Redirect to sign-in shortly after a successful reset.
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(
      () => navigate("/login", { replace: true }),
      REDIRECT_DELAY_MS
    );
    return () => window.clearTimeout(t);
  }, [done, navigate]);

  // --- Missing / empty token: nothing to reset against ----------------------
  if (!token) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <span className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 ring-1 ring-red-200 dark:ring-red-900/50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-500 dark:text-red-400" />
          </span>
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Invalid or expired link
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              This password reset link is missing or has expired. Request a fresh
              one to continue.
            </p>
          </div>
        </div>

        <Link to="/forgot-password" className="block">
          <Button fullWidth size="lg">
            Request a new link
          </Button>
        </Link>

        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>
      </motion.div>
    );
  }

  // --- Success state --------------------------------------------------------
  if (done) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <span className="w-14 h-14 rounded-2xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-primary" />
          </span>
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Password updated
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              Your password has been reset. Redirecting you to sign in…
            </p>
          </div>
        </div>

        <Link to="/login" className="block">
          <Button fullWidth size="lg">
            Continue to sign in
          </Button>
        </Link>
      </motion.div>
    );
  }

  const passwordValid = isPasswordValid(password);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!passwordValid)
      errs.password = "Password does not meet all requirements.";
    if (confirmPassword !== password)
      errs.confirmPassword = "Passwords do not match.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 400) {
        setError("This reset link is invalid or has expired.");
      } else {
        setError("Something went wrong. Please try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- Reset form -----------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Set a new password
        </h2>
        <p className="text-sm text-muted">
          Choose a strong password you haven't used before.
        </p>
      </div>

      {error && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="password" error={fieldErrors.password}>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a strong password"
              className="pl-10 pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!fieldErrors.password}
              aria-invalid={!!fieldErrors.password}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/5 transition focus:outline-none focus:ring-2 focus:ring-[#135D39]/25"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Strength meter + live requirement chips */}
          <PasswordStrength password={password} />
        </Field>

        <Field
          label="Confirm password"
          htmlFor="confirmPassword"
          error={fieldErrors.confirmPassword}
        >
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden />
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className="pl-10 pr-11"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              invalid={!!fieldErrors.confirmPassword}
              aria-invalid={!!fieldErrors.confirmPassword}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              aria-pressed={showConfirm}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/5 transition focus:outline-none focus:ring-2 focus:ring-[#135D39]/25"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>

        <Button type="submit" fullWidth size="lg" loading={submitting}>
          Reset password
        </Button>
      </form>

      <Link
        to="/login"
        className="flex items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign in
      </Link>
    </div>
  );
}
