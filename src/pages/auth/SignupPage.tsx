/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { AlertCircle, Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react";

import { useAuth } from "../../hooks/useAuth";
import {
  Button,
  Input,
  Field,
  PasswordStrength,
  isPasswordValid,
  GoogleAuthButton,
} from "../../components/ui";
import { PASSWORD_MIN_LENGTH } from "../../lib/constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Nigerian phone in strict +234 followed by 10 digits. */
const PHONE_RE = /^\+234\d{10}$/;

export default function SignupPage() {
  const navigate = useNavigate();
  const { register, loginWithGoogle, status, error } = useAuth();
  const reduce = useReducedMotion();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === "authenticated") navigate("/app", { replace: true });
  }, [status, navigate]);

  const passwordValid = isPasswordValid(password);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required.";
    if (!lastName.trim()) errs.lastName = "Last name is required.";
    if (!EMAIL_RE.test(email)) errs.email = "Enter a valid email address.";
    if (!PHONE_RE.test(phoneNumber.trim()))
      errs.phone = "Enter a Nigerian number, e.g. +2348012345678.";
    if (!passwordValid)
      errs.password = "Password does not meet all requirements.";
    if (confirmPassword !== password)
      errs.confirmPassword = "Passwords do not match.";
    if (!acceptedTerms) errs.terms = "Please accept the terms to continue.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
        referralCode: referralCode.trim() || undefined,
      });
      navigate("/app", { replace: true });
    } catch {
      /* store error handles messaging */
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
          Create your account
        </h2>
        <p className="text-sm text-[#5C6460]">
          Join the cooperative and start building farm wealth today.
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="firstName" error={fieldErrors.firstName}>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA29D]" aria-hidden />
              <Input
                id="firstName"
                autoComplete="given-name"
                placeholder="Aliyu"
                className="pl-10"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                invalid={!!fieldErrors.firstName}
                aria-invalid={!!fieldErrors.firstName}
                required
              />
            </div>
          </Field>
          <Field label="Last name" htmlFor="lastName" error={fieldErrors.lastName}>
            <Input
              id="lastName"
              autoComplete="family-name"
              placeholder="Yusuf"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              invalid={!!fieldErrors.lastName}
              aria-invalid={!!fieldErrors.lastName}
              required
            />
          </Field>
        </div>

        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA29D]" aria-hidden />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="farmer@example.com"
              className="pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!fieldErrors.email}
              aria-invalid={!!fieldErrors.email}
              required
            />
          </div>
        </Field>

        <Field
          label="Phone number"
          htmlFor="phone"
          error={fieldErrors.phone}
          hint="Nigerian number in +234 format."
        >
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA29D]" aria-hidden />
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+2348012345678"
              className="pl-10"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              invalid={!!fieldErrors.phone}
              aria-invalid={!!fieldErrors.phone}
              required
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="password" error={fieldErrors.password}>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA29D]" aria-hidden />
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
              minLength={PASSWORD_MIN_LENGTH}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#9AA29D] hover:text-[#135D39] hover:bg-[#135D39]/5 transition focus:outline-none focus:ring-2 focus:ring-[#135D39]/25"
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
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA29D]" aria-hidden />
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#9AA29D] hover:text-[#135D39] hover:bg-[#135D39]/5 transition focus:outline-none focus:ring-2 focus:ring-[#135D39]/25"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>

        <Field label="Referral code" htmlFor="referral" hint="Optional">
          <Input
            id="referral"
            autoComplete="off"
            placeholder="e.g. BENNIE-2026"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
          />
        </Field>

        <div>
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              aria-invalid={!!fieldErrors.terms}
              className="mt-0.5 h-4 w-4 rounded border-[#E6E5DF] text-[#135D39] accent-[#135D39] focus:ring-2 focus:ring-[#135D39]/25"
            />
            <span className="text-xs text-[#5C6460] leading-relaxed">
              I agree to the{" "}
              <Link to="/terms" className="font-semibold text-[#135D39] hover:underline">
                cooperative terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="font-semibold text-[#135D39] hover:underline">
                privacy policy
              </Link>
              .
            </span>
          </label>
          {fieldErrors.terms && (
            <p className="text-xs font-medium text-red-500 mt-1.5">{fieldErrors.terms}</p>
          )}
        </div>

        <Button type="submit" fullWidth size="lg" loading={busy}>
          Create account
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[#E6E5DF]" />
        <span className="text-[11px] uppercase tracking-wider text-[#9AA29D] font-semibold">
          or sign up with
        </span>
        <span className="h-px flex-1 bg-[#E6E5DF]" />
      </div>

      <GoogleAuthButton
        label="Sign up with Google"
        onToken={handleGoogle}
        onError={() => setLocalError("Google sign-in failed.")}
        onUnconfigured={() =>
          setLocalError("Google sign-in isn't configured yet.")
        }
      />

      <p className="text-center text-sm text-[#5C6460]">
        Already a member?{" "}
        <Link to="/login" className="font-semibold text-[#135D39] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
