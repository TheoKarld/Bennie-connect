/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { AlertCircle, ArrowLeft, Mail, MailCheck } from "lucide-react";

import { authService } from "../../services/auth.service";
import { Button, Input, Field } from "../../components/ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Request a password-reset link. The backend never enumerates accounts, so on
 * success we always show the same calm confirmation regardless of whether the
 * email exists.
 */
export default function ForgotPasswordPage() {
  const reduce = useReducedMotion();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <span className="w-14 h-14 rounded-2xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
            <MailCheck className="w-7 h-7 text-primary" />
          </span>
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Check your inbox
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              If an account exists for{" "}
              <span className="font-semibold text-ink">
                {email.trim()}
              </span>
              , a reset link is on its way — check your inbox.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted">
          Didn't get it? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-semibold text-primary hover:underline"
          >
            try another email
          </button>
          .
        </p>

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

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Forgot your password?
        </h2>
        <p className="text-sm text-muted">
          Enter your email and we'll send you a secure link to reset it.
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
        <Field label="Email" htmlFor="email" error={fieldError ?? undefined}>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
              aria-hidden
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="farmer@example.com"
              className="pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!fieldError}
              aria-invalid={!!fieldError}
              required
            />
          </div>
        </Field>

        <Button type="submit" fullWidth size="lg" loading={submitting}>
          Send reset link
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
