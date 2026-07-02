/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";

import { useAuth } from "../../hooks/useAuth";
import { Button, Input, Field, GoogleAuthButton } from "../../components/ui";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, status, error } = useAuth();
  const reduce = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // If already authenticated, skip the form.
  useEffect(() => {
    if (status === "authenticated") navigate("/app", { replace: true });
  }, [status, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate("/app", { replace: true });
    } catch {
      // error surfaced via store `error`
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async (token: string) => {
    setLocalError(null);
    try {
      await loginWithGoogle(token);
      navigate("/app", { replace: true });
    } catch {
      /* store error handles messaging */
    }
  };

  const shownError = error || localError;
  const busy = submitting || status === "loading";

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl font-semibold text-[#1A2421]">
          Welcome back
        </h2>
        <p className="text-sm text-[#5C6460]">
          Sign in to your cooperative farming portal.
        </p>
      </div>

      {shownError && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{shownError}</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA29D]"
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
              aria-invalid={!!shownError}
              required
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA29D]"
              aria-hidden
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="pl-10 pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!shownError}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#9AA29D] hover:text-[#135D39] hover:bg-[#135D39]/5 transition focus:outline-none focus:ring-2 focus:ring-[#135D39]/25"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </Field>

        <div className="flex justify-end -mt-1">
          <Link
            to="/forgot-password"
            className="text-xs font-semibold text-[#135D39] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth size="lg" loading={busy}>
          Sign in
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[#E6E5DF]" />
        <span className="text-[11px] uppercase tracking-wider text-[#9AA29D] font-semibold">
          or continue with
        </span>
        <span className="h-px flex-1 bg-[#E6E5DF]" />
      </div>

      <GoogleAuthButton
        label="Continue with Google"
        onToken={handleGoogle}
        onError={() => setLocalError("Google sign-in failed.")}
        onUnconfigured={() =>
          setLocalError("Google sign-in isn't configured yet.")
        }
      />

      <p className="text-center text-sm text-[#5C6460]">
        New to the cooperative?{" "}
        <Link
          to="/signup"
          className="font-semibold text-[#135D39] hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
