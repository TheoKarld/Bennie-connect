/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Confirm paying the full cost of an APPROVED booking from the LIVE wallet.
 * Shows the cost breakdown (rental + deposit = total) and the current wallet
 * balance. Blocks payment + links to fund the wallet when the balance is short,
 * and surfaces the server's EQP_009 insufficient-funds error inline.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";

import { Modal, Button, pushToast } from "../../../../components/ui";
import { formatNaira } from "../../../../lib/format";
import { useEquipmentStore } from "../../../../store/equipmentStore";
import { useWalletStore } from "../../../../store/walletStore";
import type { WalletView } from "../../../../types/wallet";
import type { EquipmentBooking } from "../../../../types/equipment";

function walletAvailable(w: WalletView | null): number | null {
  const bal = w?.balance;
  if (bal && typeof bal.available === "number") return bal.available;
  return null;
}

export default function PaymentConfirmModal({
  open,
  booking,
  onClose,
  onPaid,
}: {
  open: boolean;
  booking: EquipmentBooking | null;
  onClose: () => void;
  onPaid: (booking: EquipmentBooking) => void;
}) {
  const navigate = useNavigate();
  const payBooking = useEquipmentStore((s) => s.payBooking);
  const wallet = useWalletStore((s) => s.wallet);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setInlineError(null);
      void fetchWallet({ silent: true });
    }
  }, [open, fetchWallet]);

  if (!booking) return null;

  const available = walletAvailable(wallet);
  const short =
    typeof available === "number" && available < booking.totalCost;

  const handlePay = async () => {
    setSubmitting(true);
    setInlineError(null);
    try {
      const result = await payBooking(booking.id);
      pushToast({
        title: "Payment successful",
        message: "Your booking is confirmed.",
        tone: "success",
      });
      onPaid(result.booking);
      onClose();
    } catch (err) {
      const e = err as Error & { code?: string };
      setInlineError(e.message);
      if (e.code === "EQP_009") {
        // Insufficient funds — keep the modal open and nudge to fund the wallet.
        void fetchWallet({ silent: true });
      } else {
        pushToast({
          title: "Payment failed",
          message: e.message,
          tone: "alert",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const Row = ({
    label,
    value,
    strong = false,
  }: {
    label: string;
    value: string;
    strong?: boolean;
  }) => (
    <div
      className={`flex items-center justify-between ${
        strong ? "text-sm" : "text-xs"
      }`}
    >
      <span className={strong ? "font-bold text-ink" : "text-muted"}>
        {label}
      </span>
      <span
        className={`font-mono ${
          strong ? "font-black text-ink" : "font-bold text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pay from wallet"
      className="max-w-md"
    >
      <div className="space-y-5">
        <p className="text-xs leading-relaxed text-muted">
          Paying charges the full booking cost (rental + refundable deposit) from
          your wallet and confirms the booking. The deposit is refunded on return
          minus any damage or overdue charges.
        </p>

        {/* Breakdown */}
        <div className="space-y-2.5 rounded-2xl border border-border bg-surface-2 p-4">
          <Row label="Rental cost" value={formatNaira(booking.rentalCost)} />
          <Row
            label="Refundable deposit"
            value={formatNaira(booking.depositAmount)}
          />
          <div className="h-px bg-border" />
          <Row
            label="Total to pay now"
            value={formatNaira(booking.totalCost)}
            strong
          />
        </div>

        {/* Wallet balance */}
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
          <span className="flex items-center gap-2 text-xs font-semibold text-muted">
            <Wallet className="h-4 w-4 text-primary" /> Wallet balance
          </span>
          <span className="font-mono text-sm font-bold text-ink">
            {available === null ? "—" : formatNaira(available)}
          </span>
        </div>

        {/* Short balance / error */}
        {short && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              You need {formatNaira(booking.totalCost - (available ?? 0))} more.
              Fund your wallet, then come back to pay.
            </div>
          </div>
        )}
        {inlineError && !short && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{inlineError}</div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {short ? (
            <Button onClick={() => navigate("/app/wallet")}>
              <Wallet className="h-4 w-4" /> Fund wallet
            </Button>
          ) : (
            <Button onClick={handlePay} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Pay {formatNaira(booking.totalCost)}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
