/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Coins, Award, HandCoins, CheckCircle2, Lock } from "lucide-react";

import { Button, pushToast } from "../../../../components/ui";
import { formatNaira } from "../../../../lib/format";
import { useAdasheStore } from "../../../../store/adasheStore";
import RotationList from "../components/RotationList";
import type { GroupDetail } from "../../../../types/adashe";

interface RotationsTabProps {
  detail: GroupDetail;
}

export default function RotationsTab({ detail }: RotationsTabProps) {
  const contribute = useAdasheStore((s) => s.contribute);
  const requestPayout = useAdasheStore((s) => s.requestPayout);
  const confirmPayoutReceived = useAdasheStore(
    (s) => s.confirmPayoutReceived
  );

  const [paying, setPaying] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const perTurn = detail.contributionAmount * detail.maxSlots;
  const isActiveGroup = detail.status === "ACTIVE";
  const hasContributed = detail.me.hasContributedThisCycle;
  const isMyTurn = detail.me.isMyTurn;
  const payoutReq = detail.pendingPayoutRequest ?? null;

  const handleContribute = async () => {
    setPaying(true);
    try {
      const res = await contribute(detail.id);
      pushToast({
        title: "Contribution recorded",
        message: `${formatNaira(res.amount)} added to the pool for cycle ${
          res.cycle
        }.`,
        tone: "success",
      });
    } catch (err) {
      pushToast({
        title: "Could not contribute",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setPaying(false);
    }
  };

  const handleRequestPayout = async () => {
    setClaiming(true);
    try {
      await requestPayout(detail.id);
      pushToast({
        title: "Payout requested",
        message: "An admin will wire your funds. You'll confirm once received.",
        tone: "success",
      });
    } catch (err) {
      pushToast({
        title: "Could not request payout",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setClaiming(false);
    }
  };

  const handleConfirm = async () => {
    if (!payoutReq) return;
    setConfirming(true);
    try {
      await confirmPayoutReceived(detail.id, payoutReq.id);
      pushToast({
        title: "Payout confirmed",
        message: "The rotation advances to the next member.",
        tone: "success",
      });
    } catch (err) {
      pushToast({
        title: "Could not confirm",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Rotation ring */}
      <div className="space-y-6 rounded-3xl border border-border bg-surface p-6 shadow-sm lg:col-span-8">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">
            Rotation order
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Payout dispatch order. Rotation advances only when the active member
            confirms they received their off-platform payout.
          </p>
        </div>
        <RotationList detail={detail} />
      </div>

      {/* Actions column */}
      <div className="space-y-6 lg:col-span-4">
        {/* Pool status */}
        <div className="space-y-3 rounded-3xl border border-border bg-surface p-6 shadow-sm">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted">
            Tracked pool balance
          </span>
          <h2 className="font-mono text-3xl font-bold text-primary">
            {formatNaira(detail.poolBalance)}
          </h2>
          {typeof detail.collectedThisCycle === "number" &&
            typeof detail.expectedPoolThisCycle === "number" && (
              <p className="text-xs text-muted">
                Collected {formatNaira(detail.collectedThisCycle)} of{" "}
                {formatNaira(detail.expectedPoolThisCycle)} this cycle
                {detail.arrears
                  ? ` · ${formatNaira(detail.arrears)} outstanding`
                  : ""}
              </p>
            )}
          <p className="text-[10.5px] text-muted">
            Cycle {detail.currentCycle} of {detail.maxSlots}
          </p>
        </div>

        {/* Contribute */}
        <div className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
          <div className="space-y-1">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted">
              This cycle&apos;s dues
            </span>
            <h3 className="font-display text-base font-semibold text-ink">
              Pay your contribution
            </h3>
            <p className="text-xs text-muted">
              Records{" "}
              <b>{formatNaira(detail.contributionAmount)}</b> into the tracked
              pool. No wallet money moves.
            </p>
          </div>

          {hasContributed ? (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary">
              <CheckCircle2 className="h-4 w-4" />
              You&apos;ve contributed for cycle {detail.currentCycle}.
            </div>
          ) : (
            <Button
              fullWidth
              onClick={handleContribute}
              loading={paying}
              disabled={!isActiveGroup}
            >
              <Coins className="h-4 w-4" />
              Pay {formatNaira(detail.contributionAmount)}
            </Button>
          )}
          {!isActiveGroup && (
            <p className="text-center text-[10.5px] text-muted">
              Contributions open when the circle is ACTIVE.
            </p>
          )}
        </div>

        {/* Payout */}
        <div className="space-y-4 rounded-3xl border border-accent/25 bg-accent/8 p-6 shadow-sm">
          <div className="space-y-1">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              <Award className="h-3.5 w-3.5" /> Your payout turn
            </span>
            <h3 className="font-display text-base font-semibold text-ink">
              Manual payout
            </h3>
            <p className="text-xs text-muted">
              When it&apos;s your turn, request the payout of about{" "}
              <b className="text-primary">{formatNaira(perTurn)}</b>. An admin
              wires it off-platform; you then confirm receipt.
            </p>
          </div>

          {payoutReq && payoutReq.status === "MARKED_SENT" ? (
            <Button
              fullWidth
              variant="accent"
              onClick={handleConfirm}
              loading={confirming}
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm received ({formatNaira(payoutReq.amount)})
            </Button>
          ) : payoutReq && payoutReq.status === "REQUESTED" ? (
            <div className="rounded-2xl border border-accent/30 bg-surface/70 px-4 py-3 text-center text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              Requested — awaiting an admin to wire{" "}
              {formatNaira(payoutReq.amount)}.
            </div>
          ) : payoutReq && payoutReq.status === "DISPUTED" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-[11px] font-semibold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              This payout is disputed — an admin is reviewing it.
            </div>
          ) : isMyTurn ? (
            <Button
              fullWidth
              variant="accent"
              onClick={handleRequestPayout}
              loading={claiming}
            >
              <HandCoins className="h-4 w-4" />
              Request payout
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-accent/20 bg-surface/60 px-4 py-3 text-center text-[11px] font-medium text-amber-800 dark:text-amber-300">
              <Lock className="h-3.5 w-3.5" />
              Locked — the active turn is Slot #{detail.activePosition}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
