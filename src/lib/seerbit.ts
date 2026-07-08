/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SeerBit inline-popup SDK loader (deposit UX).
 *
 * Loads `https://checkout.seerbitapi.com/api/v2/seerbit.js` once (idempotent),
 * exposing the global `SeerbitPay(config, callback, close)`. The popup is used
 * ONLY as a "user finished paying" UX signal — crediting is server-authoritative
 * via `POST /wallet/deposit/verify` (see PRD 02 As-Built §A.4/§D). We never trust
 * the callback body.
 */

const SDK_SRC = "https://checkout.seerbitapi.com/api/v2/seerbit.js";

export interface SeerbitConfig {
  public_key: string;
  amount: string; // SDK expects a string amount
  tranref: string; // backend-issued DepositRequest.reference
  currency: string; // "NGN"
  country: string; // "NG"
  email: string;
  full_name?: string;
  description?: string;
}

type SeerbitPayFn = (
  config: SeerbitConfig,
  callback: (response?: unknown, closeModal?: () => void) => void,
  close: () => void
) => void;

declare global {
  interface Window {
    SeerbitPay?: SeerbitPayFn;
  }
}

let loaderPromise: Promise<SeerbitPayFn> | null = null;

/**
 * Ensure the SeerBit inline SDK is loaded and return the global `SeerbitPay`.
 * Resolves from cache once loaded; rejects if the script fails to load (e.g.
 * blocked/offline) so callers can degrade gracefully.
 */
export function loadSeerbit(): Promise<SeerbitPayFn> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("SeerBit SDK unavailable (no window)."));
  }
  if (window.SeerbitPay) {
    return Promise.resolve(window.SeerbitPay);
  }
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<SeerbitPayFn>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_SRC}"]`
    );

    const onReady = () => {
      if (window.SeerbitPay) resolve(window.SeerbitPay);
      else reject(new Error("SeerBit SDK loaded but SeerbitPay is undefined."));
    };

    if (existing) {
      if (window.SeerbitPay) {
        resolve(window.SeerbitPay);
        return;
      }
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load SeerBit SDK.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener(
      "error",
      () => {
        loaderPromise = null; // allow a retry on next attempt
        reject(new Error("Failed to load SeerBit SDK."));
      },
      { once: true }
    );
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export interface OpenSeerbitOptions {
  config: SeerbitConfig;
  /** Fired when the user completes the popup flow (UX signal only). */
  onSuccess: () => void;
  /** Fired when the user closes/cancels the popup. */
  onClose: () => void;
  /** Fired if the SDK cannot be loaded. */
  onError?: (err: Error) => void;
}

/**
 * Open the SeerBit inline payment popup. Loads the SDK on demand.
 */
export async function openSeerbitPopup({
  config,
  onSuccess,
  onClose,
  onError,
}: OpenSeerbitOptions): Promise<void> {
  try {
    const SeerbitPay = await loadSeerbit();
    SeerbitPay(
      config,
      (_response, closeModal) => {
        try {
          closeModal?.();
        } catch {
          /* ignore */
        }
        onSuccess();
      },
      () => {
        onClose();
      }
    );
  } catch (err) {
    onError?.(err as Error);
  }
}
