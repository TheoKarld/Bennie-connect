/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin merchant detail (`/bennie/merchants/:id`).
 *
 * Tabs: Overview (KYC split-pane reviewer — business + ID data + Prembly
 * advisory panel + KYC documents via signed URLs; approve/reject/suspend/
 * reinstate), Earnings (ledger + counters), Payouts (this merchant's requests
 * with the lifecycle stepper + mark-sent/cancel). Approve/reject gated by
 * `merchants:approve`; suspend/reinstate by `merchants:suspend`; mark-sent by
 * `merchants:mark-payout-sent` (Super-Admin-only). Server-backed via
 * `adminMerchantsStore`, permission-aware, light/dark aware.
 */

import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Banknote,
  Coins,
  FileWarning,
  IdCard,
  Send,
  ShieldCheck,
  Store,
  UserCheck,
} from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../components/ui";
import PermissionGate from "../../../components/admin/PermissionGate";
import { useAdminAuth } from "../../../hooks/useAdminAuth";
import { useAdminMerchantsStore } from "../../../store/adminMerchantsStore";
import type { AdminPayoutRequest } from "../../../types/adminMarketplace";
import KycDocViewer from "./components/KycDocViewer";
import ReasonModal from "../marketplace/components/ReasonModal";
import {
  EarningChip,
  ErrorBlock,
  InfoRow,
  KycChip,
  LoadingBlock,
  PayoutChip,
  PremblyBadge,
  dateTimeLabel,
  ngn,
  titleCase,
} from "../marketplace/components/shared";

type TabKey = "overview" | "earnings" | "payouts";

const PAYOUT_FLOW = ["REQUESTED", "MARKED_SENT", "CONFIRMED_RECEIVED"] as const;

export default function AdminMerchantDetailPage() {
  const { id = "" } = useParams();
  const reduce = useReducedMotion();
  const [params, setParams] = useSearchParams();

  const detail = useAdminMerchantsStore((s) => s.detail);
  const status = useAdminMerchantsStore((s) => s.detailStatus);
  const error = useAdminMerchantsStore((s) => s.detailError);
  const loadMerchant = useAdminMerchantsStore((s) => s.loadMerchant);
  const clearDetail = useAdminMerchantsStore((s) => s.clearDetail);
  const approveMerchant = useAdminMerchantsStore((s) => s.approveMerchant);
  const rejectMerchant = useAdminMerchantsStore((s) => s.rejectMerchant);
  const suspendMerchant = useAdminMerchantsStore((s) => s.suspendMerchant);
  const reinstateMerchant = useAdminMerchantsStore((s) => s.reinstateMerchant);

  const earnings = useAdminMerchantsStore((s) => s.earnings);
  const earningsStatus = useAdminMerchantsStore((s) => s.earningsStatus);
  const fetchEarnings = useAdminMerchantsStore((s) => s.fetchEarnings);

  const merchantPayouts = useAdminMerchantsStore((s) => s.merchantPayouts);
  const merchantPayoutsStatus = useAdminMerchantsStore((s) => s.merchantPayoutsStatus);
  const fetchMerchantPayouts = useAdminMerchantsStore((s) => s.fetchMerchantPayouts);
  const markPayoutSent = useAdminMerchantsStore((s) => s.markPayoutSent);
  const cancelPayout = useAdminMerchantsStore((s) => s.cancelPayout);

  const { hasPermission } = useAdminAuth();
  const canApprove = hasPermission("merchants:approve");
  const canSuspend = hasPermission("merchants:suspend");
  const canMarkSent = hasPermission("merchants:mark-payout-sent");

  const initial = (params.get("tab") as TabKey) || "overview";
  const [tab, setTab] = useState<TabKey>(
    ["overview", "earnings", "payouts"].includes(initial) ? initial : "overview"
  );

  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reinstating, setReinstating] = useState(false);

  // Mark-sent modal.
  const [markSentReq, setMarkSentReq] = useState<AdminPayoutRequest | null>(null);
  const [reference, setReference] = useState("");
  const [markSending, setMarkSending] = useState(false);
  const [markSentErr, setMarkSentErr] = useState<string | null>(null);
  const [cancelReq, setCancelReq] = useState<AdminPayoutRequest | null>(null);

  useEffect(() => {
    if (id) void loadMerchant(id);
    return () => clearDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (tab === "earnings" && id) void fetchEarnings(id);
    if (tab === "payouts" && id) void fetchMerchantPayouts(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  const setTabAndUrl = (t: TabKey) => {
    setTab(t);
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };

  const doApprove = async () => {
    setApproving(true);
    try {
      await approveMerchant(id);
      pushToast({ tone: "success", title: "Merchant approved" });
      setApproveOpen(false);
    } catch (err) {
      pushToast({
        tone: "alert",
        title: "Approve failed",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setApproving(false);
    }
  };

  const doReinstate = async () => {
    setReinstating(true);
    try {
      await reinstateMerchant(id);
      pushToast({ tone: "success", title: "Merchant reinstated" });
    } catch (err) {
      pushToast({
        tone: "alert",
        title: "Reinstate failed",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setReinstating(false);
    }
  };

  const submitMarkSent = async (e: React.FormEvent) => {
    e.preventDefault();
    setMarkSentErr(null);
    if (reference.trim().length < 2) {
      setMarkSentErr("A payment reference is required.");
      return;
    }
    if (!markSentReq) return;
    setMarkSending(true);
    try {
      await markPayoutSent(markSentReq.id, { paymentReference: reference.trim() });
      pushToast({ tone: "success", title: "Payout marked sent" });
      setMarkSentReq(null);
      setReference("");
    } catch (err) {
      setMarkSentErr(err instanceof Error ? err.message : "Could not mark the payout sent.");
    } finally {
      setMarkSending(false);
    }
  };

  const purged = !!detail?.kycDocsPurgedAt;
  const isPendingReview = detail?.kycStatus === "PENDING_REVIEW";

  return (
    <PermissionGate anyOf={["merchants:view"]}>
      <div className="space-y-6">
        <Link
          to="/bennie/merchants"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to merchants
        </Link>

        {status === "loading" && <LoadingBlock label="Loading merchant" />}
        {status === "error" && (
          <ErrorBlock
            message={error ?? "Unable to load this merchant."}
            onRetry={() => void loadMerchant(id)}
          />
        )}

        {status === "ready" && detail && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                  <Store className="h-7 w-7" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-semibold text-ink">
                      {detail.businessName}
                    </h1>
                    <KycChip status={detail.kycStatus} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {detail.owner?.name ?? "—"}
                    {detail.owner?.email ? ` · ${detail.owner.email}` : ""} ·{" "}
                    {detail.merchantId ?? detail.id}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canApprove && isPendingReview && (
                  <>
                    <Button size="sm" onClick={() => setApproveOpen(true)}>
                      <UserCheck className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="!text-danger hover:!bg-danger/5"
                      onClick={() => setRejectOpen(true)}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {canSuspend && detail.kycStatus === "APPROVED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="!text-danger hover:!bg-danger/5"
                    onClick={() => setSuspendOpen(true)}
                  >
                    Suspend
                  </Button>
                )}
                {canSuspend && detail.kycStatus === "SUSPENDED" && (
                  <Button size="sm" loading={reinstating} onClick={() => void doReinstate()}>
                    Reinstate
                  </Button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
              {(
                [
                  { key: "overview", label: "Overview", icon: ShieldCheck },
                  { key: "earnings", label: "Earnings", icon: Coins },
                  { key: "payouts", label: "Payouts", icon: Banknote },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTabAndUrl(t.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                      tab === t.key
                        ? "bg-primary text-white"
                        : "text-muted hover:bg-primary/8 hover:text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Overview — KYC split-pane reviewer */}
            {tab === "overview" && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Left — application / ID data */}
                <div className="space-y-4">
                  <div className="rounded-3xl border border-border bg-surface/70 p-5">
                    <h3 className="mb-3 font-display text-sm font-semibold text-ink">
                      Business profile
                    </h3>
                    <InfoRow label="Business" value={detail.businessName} />
                    <InfoRow label="Phone" value={detail.businessPhone ?? "—"} />
                    <InfoRow label="Email" value={detail.businessEmail ?? "—"} />
                    <InfoRow
                      label="Address"
                      value={
                        detail.businessAddress
                          ? [
                              detail.businessAddress.street,
                              detail.businessAddress.city,
                              detail.businessAddress.state,
                            ]
                              .filter(Boolean)
                              .join(", ") || "—"
                          : "—"
                      }
                    />
                    <InfoRow
                      label="Registered biz"
                      value={detail.isRegisteredBusiness ? "Yes" : "No"}
                    />
                    {detail.cacRcNumber && (
                      <InfoRow label="CAC RC" value={detail.cacRcNumber} mono />
                    )}
                    {detail.businessDescription && (
                      <p className="mt-2 border-t border-border pt-2 text-xs leading-relaxed text-muted">
                        {detail.businessDescription}
                      </p>
                    )}
                  </div>

                  <div className="rounded-3xl border border-border bg-surface/70 p-5">
                    <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-ink">
                      <IdCard className="h-4 w-4 text-primary" /> Identity
                    </h3>
                    <InfoRow label="ID type" value={titleCase(detail.idType)} />
                    <InfoRow label="ID number" value={detail.idNumber ?? "—"} mono />
                    {typeof detail.resubmissionCount === "number" &&
                      detail.resubmissionCount > 0 && (
                        <InfoRow
                          label="Resubmissions"
                          value={detail.resubmissionCount}
                        />
                      )}
                    <InfoRow label="Submitted" value={dateTimeLabel(detail.submittedAt)} />
                    {detail.reviewedAt && (
                      <InfoRow label="Reviewed" value={dateTimeLabel(detail.reviewedAt)} />
                    )}
                    {detail.rejectionReason && (
                      <p className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
                        Rejected: {detail.rejectionReason}
                      </p>
                    )}
                    {detail.suspensionReason && (
                      <p className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
                        Suspended: {detail.suspensionReason}
                      </p>
                    )}
                  </div>

                  {/* Prembly advisory panel */}
                  <div className="rounded-3xl border border-border bg-surface/70 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-display text-sm font-semibold text-ink">
                        Prembly verification
                      </h3>
                      <PremblyBadge
                        status={
                          detail.premblyResult?.status ??
                          (detail.premblyResult?.checked === false ? "SKIPPED" : undefined)
                        }
                      />
                    </div>
                    <p className="mb-2 text-[11px] leading-relaxed text-muted">
                      Advisory signal only — the admin makes the final decision.
                    </p>
                    {detail.premblyResult ? (
                      <>
                        <InfoRow
                          label="Matched name"
                          value={detail.premblyResult.matchedName ?? "—"}
                        />
                        {detail.premblyResult.matchedName &&
                          detail.owner?.name &&
                          detail.premblyResult.matchedName.trim().toLowerCase() !==
                            detail.owner.name.trim().toLowerCase() && (
                            <p className="rounded-xl bg-accent/12 px-3 py-2 text-[11px] text-[#a6701c] dark:text-accent">
                              Name differs from the account holder ({detail.owner.name}).
                            </p>
                          )}
                        <InfoRow label="Endpoint" value={detail.premblyResult.endpoint ?? "—"} />
                        <InfoRow
                          label="Checked"
                          value={dateTimeLabel(detail.premblyResult.checkedAt)}
                        />
                      </>
                    ) : (
                      <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
                        Verification not run — the Prembly service is not configured.
                      </p>
                    )}
                    {detail.cacResult && (
                      <div className="mt-3 border-t border-border pt-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                            CAC check
                          </span>
                          <PremblyBadge status={detail.cacResult.status} />
                        </div>
                        <InfoRow
                          label="Matched"
                          value={detail.cacResult.matchedName ?? "—"}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right — evidence (KYC documents) */}
                <div className="space-y-4">
                  <div className="rounded-3xl border border-border bg-surface/70 p-5">
                    <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-ink">
                      <FileWarning className="h-4 w-4 text-primary" /> KYC documents
                    </h3>
                    {purged ? (
                      <div className="rounded-2xl border border-dashed border-border bg-surface-2 px-4 py-8 text-center">
                        <p className="text-sm font-semibold text-ink">
                          Documents purged
                        </p>
                        <p className="mt-1 text-[11px] text-muted">
                          Uploaded ID documents were deleted on the final KYC decision
                          ({dateTimeLabel(detail.kycDocsPurgedAt)}) — NDPR data
                          minimisation. The verified ID data lives on above.
                        </p>
                      </div>
                    ) : detail.kycDocs.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-surface-2 px-4 py-8 text-center">
                        <p className="text-sm text-muted">
                          No documents on file for this merchant.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {detail.kycDocs.map((d) => (
                          <KycDocViewer key={d.fileId} doc={d} />
                        ))}
                      </div>
                    )}
                    {isPendingReview && !purged && (
                      <p className="mt-3 rounded-xl bg-accent/12 px-3 py-2 text-[11px] text-[#a6701c] dark:text-accent">
                        Approving or rejecting permanently deletes these documents.
                      </p>
                    )}
                  </div>

                  {/* Earnings snapshot */}
                  <div className="rounded-3xl border border-border bg-surface/70 p-5">
                    <h3 className="mb-3 font-display text-sm font-semibold text-ink">
                      Earnings snapshot
                    </h3>
                    <InfoRow label="Available" value={ngn(detail.earnings?.availableBalance)} />
                    <InfoRow label="Lifetime earned" value={ngn(detail.earnings?.lifetimeEarned)} />
                    <InfoRow label="Lifetime paid out" value={ngn(detail.earnings?.lifetimePaidOut)} />
                    <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3">
                      <Link
                        to={`/bennie/market-place?tab=sellers`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Listings →
                      </Link>
                      <Link
                        to={`/bennie/orders?merchantId=${detail.id}`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Orders →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Earnings ledger */}
            {tab === "earnings" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["Available", earnings?.summary.availableBalance],
                    ["Lifetime earned", earnings?.summary.lifetimeEarned],
                    ["Paid out", earnings?.summary.lifetimePaidOut],
                  ].map(([label, val]) => (
                    <div
                      key={label as string}
                      className="rounded-2xl border border-border bg-surface/70 p-4"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        {label}
                      </p>
                      <p className="mt-1 text-lg font-bold text-ink">
                        {ngn(val as number)}
                      </p>
                    </div>
                  ))}
                </div>

                {earningsStatus === "loading" && <LoadingBlock label="Loading ledger" />}
                {earningsStatus !== "loading" &&
                  (!earnings || earnings.entries.length === 0) && (
                    <div className="rounded-3xl border border-dashed border-border bg-canvas/60 px-6 py-12 text-center text-sm text-muted">
                      No earnings entries yet.
                    </div>
                  )}
                {earnings && earnings.entries.length > 0 && (
                  <div className="overflow-hidden rounded-3xl border border-border bg-surface/70">
                    <ul className="divide-y divide-border">
                      {earnings.entries.map((e) => (
                        <li
                          key={e.id}
                          className="flex flex-wrap items-center gap-3 px-5 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-ink">
                                {titleCase(e.type)}
                              </p>
                              <EarningChip status={e.status} />
                            </div>
                            <p className="text-[11px] text-muted">
                              {e.orderNumber ? `Order ${e.orderNumber} · ` : ""}
                              {dateTimeLabel(e.bookedAt ?? e.createdAt)}
                              {e.note ? ` · ${e.note}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-bold ${
                                e.net < 0 ? "text-danger" : "text-ink"
                              }`}
                            >
                              {ngn(e.net)}
                            </p>
                            <p className="text-[10px] text-muted">
                              gross {ngn(e.gross)} · fee {ngn(e.platformFee)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Payouts */}
            {tab === "payouts" && (
              <div className="space-y-4">
                {detail.payoutBankAccount && (
                  <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-xs text-muted">
                    Payout account:{" "}
                    <span className="font-semibold text-ink">
                      {detail.payoutBankAccount.accountName}
                    </span>{" "}
                    · {detail.payoutBankAccount.bankName} ·{" "}
                    {detail.payoutBankAccount.accountNumber}
                  </div>
                )}
                {merchantPayoutsStatus === "loading" && (
                  <LoadingBlock label="Loading payouts" />
                )}
                {merchantPayoutsStatus !== "loading" && merchantPayouts.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-border bg-canvas/60 px-6 py-12 text-center text-sm text-muted">
                    No payout requests yet.
                  </div>
                )}
                {merchantPayouts.map((r) => {
                  const flowIdx = PAYOUT_FLOW.indexOf(r.status as never);
                  return (
                    <div
                      key={r.id}
                      className="rounded-3xl border border-border bg-surface/70 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-ink">
                              {ngn(r.amount)}
                            </p>
                            <PayoutChip status={r.status} />
                          </div>
                          <p className="text-[11px] text-muted">
                            {r.requestId ?? r.id} · {dateTimeLabel(r.requestedAt)}
                            {r.paymentReference ? ` · ref ${r.paymentReference}` : ""}
                          </p>
                        </div>
                        {canMarkSent && (
                          <div className="flex gap-1.5">
                            {r.status === "REQUESTED" && (
                              <Button size="sm" onClick={() => setMarkSentReq(r)}>
                                <Send className="h-3.5 w-3.5" /> Mark sent
                              </Button>
                            )}
                            {["REQUESTED", "MARKED_SENT"].includes(r.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="!text-danger hover:!bg-danger/5"
                                onClick={() => setCancelReq(r)}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Lifecycle stepper */}
                      {r.status !== "CANCELLED" && (
                        <div className="mt-4 flex items-center gap-1">
                          {PAYOUT_FLOW.map((s, i) => (
                            <React.Fragment key={s}>
                              <div className="flex flex-col items-center gap-1">
                                <span
                                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ${
                                    i <= flowIdx
                                      ? "bg-primary text-white"
                                      : "bg-surface-2 text-muted"
                                  }`}
                                >
                                  {i + 1}
                                </span>
                                <span className="hidden text-[9px] font-semibold text-muted sm:inline">
                                  {titleCase(s)}
                                </span>
                              </div>
                              {i < PAYOUT_FLOW.length - 1 && (
                                <span
                                  className={`h-px flex-1 ${
                                    i < flowIdx ? "bg-primary" : "bg-border"
                                  }`}
                                />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                      {r.status === "MARKED_SENT" && (
                        <p className="mt-3 rounded-xl bg-accent/12 px-3 py-2 text-[11px] text-[#a6701c] dark:text-accent">
                          Awaiting merchant confirmation of receipt.
                        </p>
                      )}
                      {r.status === "CANCELLED" && r.cancelReason && (
                        <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[11px] text-danger">
                          Cancelled: {r.cancelReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Approve confirm */}
        <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Approve merchant">
          <p className="mb-4 text-sm text-muted">
            Approving permanently deletes the uploaded ID documents (the verified ID data
            is retained). The merchant can then sell on the marketplace.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button loading={approving} onClick={() => void doApprove()}>
              Approve merchant
            </Button>
          </div>
        </Modal>

        {/* Reject */}
        <ReasonModal
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
          title="Reject merchant"
          confirmLabel="Reject application"
          tone="danger"
          description="Rejecting permanently deletes the uploaded ID documents. The merchant may edit and resubmit (re-uploading documents). A reason is required."
          onConfirm={async (reason) => {
            await rejectMerchant(id, reason);
            pushToast({ tone: "success", title: "Merchant rejected" });
          }}
        />

        {/* Suspend */}
        <ReasonModal
          open={suspendOpen}
          onClose={() => setSuspendOpen(false)}
          title="Suspend merchant"
          confirmLabel="Suspend merchant"
          tone="danger"
          description="Suspending delists all the merchant's products and blocks new listings and payout requests. In-flight orders continue. A reason is required."
          onConfirm={async (reason) => {
            await suspendMerchant(id, reason);
            pushToast({ tone: "success", title: "Merchant suspended" });
          }}
        />

        {/* Mark-sent modal */}
        <Modal
          open={!!markSentReq}
          onClose={() => setMarkSentReq(null)}
          title="Mark payout sent"
        >
          <div className="mb-4 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-xs text-muted">
            Confirm that {ngn(markSentReq?.amount)} was wired off-platform to{" "}
            <span className="font-semibold text-ink">
              {markSentReq?.bankAccount?.accountName ??
                detail?.payoutBankAccount?.accountName ??
                "the merchant"}
            </span>
            . The merchant is prompted to confirm receipt.
          </div>
          <form onSubmit={submitMarkSent} className="space-y-4">
            <Field label="Payment reference (required)" htmlFor="msd-ref">
              <Input
                id="msd-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="GTB-TRF-90233812"
                invalid={!!markSentErr}
              />
            </Field>
            {markSentErr && (
              <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                {markSentErr}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setMarkSentReq(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={markSending}>
                <Send className="h-4 w-4" /> Mark sent
              </Button>
            </div>
          </form>
        </Modal>

        {/* Cancel payout */}
        <ReasonModal
          open={!!cancelReq}
          onClose={() => setCancelReq(null)}
          title="Cancel payout request"
          confirmLabel="Cancel request"
          tone="danger"
          description="This voids the request and unlocks the merchant's earnings back to available. A reason is required."
          onConfirm={async (reason) => {
            if (!cancelReq) return;
            await cancelPayout(cancelReq.id, reason);
            pushToast({ tone: "success", title: "Payout request cancelled" });
          }}
        />
      </div>
    </PermissionGate>
  );
}
