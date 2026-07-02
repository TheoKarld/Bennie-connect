/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";

interface GoogleAuthButtonProps {
  /** Called with the Google OAuth access token on a successful popup. */
  onToken: (accessToken: string) => void;
  /** Called if the Google popup errors or is dismissed. */
  onError?: () => void;
  /**
   * Called when the button is clicked but no VITE_GOOGLE_CLIENT_ID is set.
   * The popup can't open without a client id, so we degrade gracefully here
   * instead of letting the underlying hook throw.
   */
  onUnconfigured?: () => void;
  /** Button label. Defaults to "Continue with Google". */
  label?: string;
  disabled?: boolean;
}

const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || "";

/** Multicolor Google "G" mark, inline so it needs no external asset. */
function GoogleGIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.709A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.709V4.959H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.041l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.959L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

/**
 * Branded, always-visible "Continue with Google" pill. Uses the implicit OAuth
 * flow (`flow: 'implicit'`) so it hands the parent a short-lived access token,
 * which the backend verifies against Google's userinfo endpoint.
 *
 * When VITE_GOOGLE_CLIENT_ID is empty the button still renders, but clicking it
 * won't attempt to open the popup (which would throw); it calls `onUnconfigured`.
 */
export default function GoogleAuthButton({
  onToken,
  onError,
  onUnconfigured,
  label = "Continue with Google",
  disabled = false,
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const login = useGoogleLogin({
    flow: "implicit",
    scope: "openid email profile",
    onSuccess: (resp) => {
      setLoading(false);
      onToken(resp.access_token);
    },
    onError: () => {
      setLoading(false);
      onError?.();
    },
    onNonOAuthError: () => {
      // Popup closed/dismissed without completing.
      setLoading(false);
    },
  });

  const handleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      onUnconfigured?.();
      return;
    }
    setLoading(true);
    login();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-[#E6E5DF] bg-white px-6 py-3 text-sm font-semibold text-[#1A2421] transition hover:bg-[#F7F6F1] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#135D39]/30"
    >
      {loading ? (
        <span className="inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-[#9AA29D]/40 border-t-[#135D39]" />
      ) : (
        <GoogleGIcon />
      )}
      <span>{label}</span>
    </button>
  );
}
