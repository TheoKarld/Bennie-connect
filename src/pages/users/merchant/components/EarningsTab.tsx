/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Merchant Hub — Earnings tab: summary cards (available / earned / paid out /
 * pending), the append-only earnings ledger, the request-payout modal
 * (amount ≤ available, bank details) and the payout lifecycle list
 * (REQUESTED → MARKED_SENT → CONFIRMED_RECEIVED, adashe-style)
 * (merchant_panel.md §6.5).
 */

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  RefreshCw,
  Banknote,
  Landmark,
  PiggyBank,
  Hourglass,
  HandCoins,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import {
  Button,
  Field,
  Input,
  Modal,
  pushToast,
} from "../../../../components/ui";
import { formatNaira } from "../../../../lib/format";
import { useMerchantStore } from "../../../../store/merchantStore";
import type { PayoutRequest } from "../../../../types/merchant";
import {
  formatDateTime,
} from "../../marketplace/components/marketplaceMeta";
import { PayoutChip } from "./merchantMeta";

const MIN_PAYOUT = 1000; // mirrors MERCHANT_MIN_PAYOUT_NGN default

// --- Request payout modal ------------------------------------------------------------

function PayoutModal({
  open,
  available,
  onClose,
}: {
  open: boolean;
  available: number;
  onClose: () => void;
}) {
  const requestPayout = useMerchantStore((s) => s.requestPayout);

  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setErrors({});
    }
  }, [open]);

  const submit = async () => {
    const next: Record<string, string> = {};
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt < MIN_PAYOUT)
      next.amount = `Minimum payout is ${formatNaira(MIN_PAYOUT)}.`;
    else if (amt > available)
      next.amount = `You can request at most ${formatNaira(available)}.`;
    if (bankName.trim().length < 2) next.bankName = "Enter your bank name.";
    if (!/^\d{10}$/.test(accountNumber))
      next.accountNumber = "Account number must be 10 digits (NUBAN).";
    if (accountName.trim().length < 2)
      next.accountName = "Enter the account name.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await requestPayout(amt, {
        bankName: bankName.trim(),
        accountNumber,
        accountName: accountName.trim(),
      });
      pushToast({
        title: "Payout requested",
        message: `${formatNaira(amt)} held from your balance — the cooperative will wire it and mark it sent.`,
        tone: "success",
      });
      onClose();
    } catch (err) {
      pushToast({
        title: "Payout",
        message: (err as Error)?.message || "Could not request this payout.",
        tone: "alert",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Request payout"
    >
      <div className="space-y-4">
        <p className="rounded-2xl bg-primary/5 px-4 py-2.5 text-xs font-semibold text-primary">
          Available balance: <span className="font-mono">{formatNaira(available)}</span>
        </p>
        <Field
          label="Amount (₦)"
          error={errors.amount}
          hint={`Minimum ${formatNaira(MIN_PAYOUT)}`}
        >
          <Input
            value={amount}
            invalid={Boolean(errors.amount)}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="50000"
            inputMode="numeric"
          />
        </Field>
        <Field label="Bank name" error={errors.bankName}>
          <Input
            value={bankName}
            invalid={Boolean(errors.bankName)}
            onChange={(e) => setBankName(e.target.value.slice(0, 80))}
            placeholder="GTBank"
          />
        </Field>
        <Field label="Account number" error={errors.accountNumber}>
          <Input
            value={accountNumber}
            invalid={Boolean(errors.accountNumber)}
            onChange={(e) =>
              setAccountNumber(e.target.value.replace(/[^\d]/g, "").slice(0, 10))
            }
            placeholder="0123456789"
            inputMode="numeric"
          />
        </Field>
        <Field label="Account name" error={errors.accountName}>
          <Input
            value={accountName}
            invalid={Boolean(errors.accountName)}
            onChange={(e) => setAccountName(e.target.value.slice(0, 80))}
            placeholder="Shola Farms Ltd"
          />
        </Field>
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            <HandCoins className="h-4 w-4" /> Request payout
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Payout row ----------------------------------------------------------------------------

function PayoutRow({ payout }: { payout: PayoutRequest }) {
  const cancelPayout = useMerchantStore((s) => s.cancelPayout);
  const confirmPayoutReceived = useMerchantStore((s) => s.confirmPayoutReceived);
  const [busy, setBusy] = useState(false);

  const bank = payout.bankDetails ?? payout.bankAccount;

  const act = async (fn: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await fn();
      pushToast({ title: "Payout", message: success, tone: "success" });
    } catch (err) {
      pushToast({
        title: "Payout",
        message: (err as Error)?.message || "Action failed.",
        tone: "alert",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-base font-bold text-ink">
            {formatNaira(payout.amount)}
          </p>
          <p className="text-[11px] text-muted">
            Requested {formatDateTime(payout.requestedAt ?? payout.createdAt)}
            {bank ? ` · ${bank.bankName} ····${bank.accountNumber.slice(-4)}` : ""}
          </p>
        </div>
        <PayoutChip status={payout.status} />
      </div>

      {payout.status === "MARKED_SENT" && (
        <div className="rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">
          The cooperative marked this transfer as sent
          {payout.paymentReference ? (
            <>
              {" "}
              — reference{" "}
              <span className="font-mono font-bold">
                {payout.paymentReference}
              </span>
            </>
          ) : null}
          . Confirm once the money lands in your account.
        </div>
      )}

      {(payout.status === "REQUESTED" || payout.status === "MARKED_SENT") && (
        <div className="flex justify-end gap-2 border-t border-border pt-2.5">
          {payout.status === "REQUESTED" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void act(
                  () => cancelPayout(payout.id),
                  "Payout request cancelled — the hold was released."
                )
              }
            >
              <XCircle className="h-3.5 w-3.5" /> Cancel request
            </Button>
          )}
          {payout.status === "MARKED_SENT" && (
            <Button
              size="sm"
              loading={busy}
              onClick={() =>
                void act(
                  () => confirmPayoutReceived(payout.id),
                  "Payout confirmed — your ledger is settled."
                )
              }
            >
              <CheckCircle2 className="h-4 w-4" /> I have received this payment
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Tab -----------------------------------------------------------------------------------

export default function EarningsTab({ readOnly }: { readOnly: boolean }) {
  const summary = useMerchantStore((s) => s.earningsSummary);
  const entries = useMerchantStore((s) => s.earnings);
  const status = useMerchantStore((s) => s.earningsStatus);
  const error = useMerchantStore((s) => s.earningsError);
  const fetchEarnings = useMerchantStore((s) => s.fetchEarnings);
  const payouts = useMerchantStore((s) => s.payouts);
  const payoutsStatus = useMerchantStore((s) => s.payoutsStatus);
  const fetchPayouts = useMerchantStore((s) => s.fetchPayouts);

  const [payoutOpen, setPayoutOpen] = useState(false);

  useEffect(() => {
    void fetchEarnings();
    void fetchPayouts();
  }, [fetchEarnings, fetchPayouts]);

  const available = summary?.available ?? 0;
  const openPayout = payouts.some(
    (p) => p.status === "REQUESTED" || p.status === "MARKED_SENT"
  );
  const payoutBlockedReason = readOnly
    ? "Payouts are disabled while your account is suspended."
    : openPayout
      ? "You already have an open payout request."
      : available < MIN_PAYOUT
        ? `You need at least ${formatNaira(MIN_PAYOUT)} available.`
        : null;

  const cards = [
    {
      label: "Available",
      value: available,
      icon: Banknote,
      hero: true,
    },
    { label: "Total earned", value: summary?.totalEarned ?? 0, icon: PiggyBank },
    { label: "Paid out", value: summary?.totalPaidOut ?? 0, icon: Landmark },
    {
      label: "Pending payout",
      value: summary?.pendingPayout ?? 0,
      icon: Hourglass,
    },
  ];

  if (status === "error" && !summary) {
    return (
      <div className="rounded-3xl border border-border bg-surface py-14 text-center">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-danger" />
        <p className="text-sm font-semibold text-ink">
          Couldn&apos;t load your earnings
        </p>
        <p className="mt-1 text-xs text-muted">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => void fetchEarnings()}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) =>
          status === "loading" && !summary ? (
            <div key={c.label} className="h-24 animate-pulse rounded-3xl bg-surface-2" />
          ) : (
            <div
              key={c.label}
              className={`rounded-3xl border p-4 ${
                c.hero
                  ? "border-primary/20 bg-primary/5"
                  : "border-border bg-surface"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                <c.icon className="h-3.5 w-3.5" /> {c.label}
              </div>
              <p
                className={`mt-2 font-mono font-bold ${
                  c.hero ? "text-2xl text-primary" : "text-lg text-ink"
                }`}
              >
                {formatNaira(c.value)}
              </p>
            </div>
          )
        )}
      </div>

      {/* Payout panel */}
      <section className="rounded-3xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Payouts</h3>
            <p className="text-xs text-muted">
              {summary?.platformFeePercent != null
                ? `Earnings are booked net of the ${summary.platformFeePercent}% platform fee. `
                : ""}
              The cooperative wires payouts to your bank, then you confirm
              receipt.
            </p>
          </div>
          <Button
            size="sm"
            disabled={Boolean(payoutBlockedReason)}
            onClick={() => setPayoutOpen(true)}
          >
            <HandCoins className="h-4 w-4" /> Request payout
          </Button>
        </div>
        {payoutBlockedReason && (
          <p className="mt-2 text-[11px] font-semibold text-muted">
            {payoutBlockedReason}
          </p>
        )}

        {payoutsStatus === "loading" && payouts.length === 0 ? (
          <div className="mt-4 space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : payouts.length > 0 ? (
          <div className="mt-4 space-y-3">
            {payouts.map((p) => (
              <PayoutRow key={p.id} payout={p} />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-center text-xs text-muted">
            No payout requests yet.
          </p>
        )}
      </section>

      {/* Ledger */}
      <section className="overflow-hidden rounded-3xl border border-border bg-surface">
        <h3 className="border-b border-border px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          Earnings ledger
        </h3>
        {status === "loading" && entries.length === 0 ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="px-5 py-10 text-center text-xs text-muted">
            No earnings yet — deliver your first order to book earnings.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted">
                  <th className="px-5 py-2.5">Order</th>
                  <th className="px-4 py-2.5 text-right">Gross</th>
                  <th className="px-4 py-2.5 text-right">Fee</th>
                  <th className="px-4 py-2.5 text-right">Net</th>
                  <th className="px-5 py-2.5 text-right">Booked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => (
                  <tr key={e.id} className="transition hover:bg-primary/[0.03]">
                    <td className="px-5 py-3 font-mono font-semibold text-ink">
                      {e.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-ink">
                      {formatNaira(e.grossAmount ?? e.gross ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted">
                      −{formatNaira(e.platformFee ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                      {formatNaira(e.netAmount ?? e.net ?? 0)}
                    </td>
                    <td className="px-5 py-3 text-right text-muted">
                      {formatDateTime(e.bookedAt ?? e.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PayoutModal
        open={payoutOpen}
        available={available}
        onClose={() => setPayoutOpen(false)}
      />
    </div>
  );
}
