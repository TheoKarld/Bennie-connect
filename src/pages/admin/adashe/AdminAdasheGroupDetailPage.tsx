/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin Adashe group detail (`/bennie/adashesu-contributions/:groupId`).
 *
 * Header (pool balance, cycle progress, next recipient) + tabs:
 *   Members · Rotation · Contributions · Payout Requests · Chat ·
 *   Slot-Shift Decisions · Rules.
 *
 * Chat joins the group over `/rt/admin`; Slot-Shift Decisions and Payout
 * Requests are permission-gated (`adashe-groups:configure` /
 * `adashe-contributions:mark-sent`). Every mutation flows through the store.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Users,
  Repeat,
  ListChecks,
  Banknote,
  MessageSquare,
  ArrowLeftRight,
  Sliders,
  Crown,
  Wallet,
  UserPlus,
  Ban,
  RotateCcw,
} from "lucide-react";

import PermissionGate from "../../../components/admin/PermissionGate";
import { Button, pushToast } from "../../../components/ui";
import { useAdminAuth } from "../../../hooks/useAdminAuth";
import { useAdminAdasheStore } from "../../../store/adminAdasheStore";
import { useAdminGroupSocket } from "../../../hooks/useAdminGroupSocket";
import InviteModal from "./components/InviteModal";
import MarkSentModal from "./components/MarkSentModal";
import ReasonModal from "./components/ReasonModal";
import RotationView from "./components/RotationView";
import ProposalDecisionCard from "./components/ProposalDecisionCard";
import PayoutRequestCard from "./components/PayoutRequestCard";
import ChatPanel from "./components/ChatPanel";
import {
  CycleProgress,
  EmptyBlock,
  ErrorBlock,
  GroupStatusChip,
  LoadingBlock,
  MemberStatusChip,
  ngn,
  dateLabel,
} from "./components/shared";
import type {
  AdminPayoutRequest,
  AdminProposal,
  GroupRules,
} from "../../../types/adashe";

type TabKey =
  | "members"
  | "rotation"
  | "contributions"
  | "payouts"
  | "chat"
  | "slotshift"
  | "rules";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "members", label: "Members", icon: Users },
  { key: "rotation", label: "Rotation", icon: Repeat },
  { key: "contributions", label: "Contributions", icon: ListChecks },
  { key: "payouts", label: "Payout Requests", icon: Banknote },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "slotshift", label: "Slot-Shift", icon: ArrowLeftRight },
  { key: "rules", label: "Rules", icon: Sliders },
];

// --- Members tab ------------------------------------------------------------

function MembersTab({ groupId }: { groupId: string }) {
  const members = useAdminAdasheStore((s) => s.members);
  const loaded = useAdminAdasheStore((s) => s.membersLoaded);
  const fetchMembers = useAdminAdasheStore((s) => s.fetchMembers);

  useEffect(() => {
    if (!loaded) void fetchMembers(groupId);
  }, [groupId, loaded, fetchMembers]);

  if (!loaded) return <LoadingBlock label="Loading members" />;
  if (members.length === 0)
    return (
      <EmptyBlock
        icon={Users}
        title="No members yet"
        hint="Invite members to fill the rotation."
      />
    );

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface/70 shadow-sm">
      <ul className="divide-y divide-border">
        {[...members]
          .sort((a, b) => a.position - b.position)
          .map((m) => (
            <li
              key={m.memberId}
              className="flex flex-wrap items-center gap-3 px-6 py-4"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/8 font-mono text-[11px] font-bold text-primary">
                {m.position}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {m.name}
                </p>
                {m.email && (
                  <p className="truncate font-mono text-[11px] text-muted">
                    {m.email}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted">
                <span title="Paid contributions">
                  <span className="font-mono font-semibold text-primary">
                    {m.paidCount ?? 0}
                  </span>{" "}
                  paid
                </span>
                <span title="Late contributions">
                  <span className="font-mono font-semibold text-[#a6701c] dark:text-accent">
                    {m.lateCount ?? 0}
                  </span>{" "}
                  late
                </span>
                <span title="Missed contributions">
                  <span className="font-mono font-semibold text-danger">
                    {m.missedCount ?? 0}
                  </span>{" "}
                  missed
                </span>
                {(m.arrears ?? 0) > 0 && (
                  <span className="font-mono font-semibold text-danger">
                    {ngn(m.arrears)} arrears
                  </span>
                )}
              </div>
              <MemberStatusChip status={m.status} />
            </li>
          ))}
      </ul>
    </div>
  );
}

// --- Contributions tab ------------------------------------------------------

function ContributionsTab({ groupId }: { groupId: string }) {
  const audit = useAdminAdasheStore((s) => s.contributions);
  const loaded = useAdminAdasheStore((s) => s.contributionsLoaded);
  const fetchContributions = useAdminAdasheStore((s) => s.fetchContributions);

  useEffect(() => {
    if (!loaded) void fetchContributions(groupId);
  }, [groupId, loaded, fetchContributions]);

  if (!loaded) return <LoadingBlock label="Loading contribution trail" />;
  if (!audit || audit.rows.length === 0)
    return (
      <EmptyBlock
        icon={ListChecks}
        title="No contributions recorded"
        hint="Contributions appear here once the rotation begins collecting."
      />
    );

  const toneFor = (s: string) =>
    s === "PAID"
      ? "text-primary"
      : s === "LATE"
      ? "text-[#a6701c] dark:text-accent"
      : s === "MISSED"
      ? "text-danger"
      : "text-muted";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Cycle
          </p>
          <p className="font-mono text-lg font-bold text-ink">
            #{audit.cycle}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Collected / expected
          </p>
          <p className="font-mono text-lg font-bold text-primary">
            {ngn(audit.poolCollected)} / {ngn(audit.expectedPool)}
          </p>
        </div>
        {(audit.arrears ?? 0) > 0 && (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-danger/80">
              Arrears
            </p>
            <p className="font-mono text-lg font-bold text-danger">
              {ngn(audit.arrears)}
            </p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-surface/70 shadow-sm">
        <div className="hidden grid-cols-12 gap-4 border-b border-border bg-surface-2 px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-muted sm:grid">
          <span className="col-span-4">Member</span>
          <span className="col-span-2">Amount</span>
          <span className="col-span-2">Due</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-2 text-right">Late fee</span>
        </div>
        <ul className="divide-y divide-border">
          {audit.rows.map((r) => (
            <li
              key={r.memberId}
              className="grid grid-cols-1 gap-1 px-6 py-3.5 text-sm sm:grid-cols-12 sm:items-center sm:gap-4"
            >
              <span className="col-span-4 truncate font-semibold text-ink">
                {r.name}
              </span>
              <span className="col-span-2 font-mono text-muted">
                {ngn(r.amount)}
              </span>
              <span className="col-span-2 text-[11px] text-muted">
                {dateLabel(r.dueDate)}
              </span>
              <span
                className={`col-span-2 text-xs font-bold uppercase tracking-wider ${toneFor(
                  r.status
                )}`}
              >
                {r.status}
              </span>
              <span className="col-span-2 font-mono text-muted sm:text-right">
                {r.lateFee ? ngn(r.lateFee) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// --- Payout Requests tab ----------------------------------------------------

function PayoutsTab({ groupId }: { groupId: string }) {
  const groupPayouts = useAdminAdasheStore((s) => s.groupPayouts);
  const loaded = useAdminAdasheStore((s) => s.groupPayoutsLoaded);
  const fetchGroupPayouts = useAdminAdasheStore((s) => s.fetchGroupPayouts);
  const cancelPayout = useAdminAdasheStore((s) => s.cancelPayout);

  const { hasPermission } = useAdminAuth();
  const canMarkSent = hasPermission("adashe-contributions:mark-sent");
  const canCancel = hasPermission("adashe-contributions:view");

  const [markTarget, setMarkTarget] = useState<AdminPayoutRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminPayoutRequest | null>(
    null
  );

  useEffect(() => {
    if (!loaded) void fetchGroupPayouts(groupId);
  }, [groupId, loaded, fetchGroupPayouts]);

  if (!loaded) return <LoadingBlock label="Loading payout requests" />;
  if (groupPayouts.length === 0)
    return (
      <EmptyBlock
        icon={Banknote}
        title="No payout requests"
        hint="A matured rotation turn raises a request here to wire and mark sent."
      />
    );

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {groupPayouts.map((r) => (
          <PayoutRequestCard
            key={r.id}
            request={r}
            canMarkSent={canMarkSent}
            canCancel={canCancel}
            onMarkSent={setMarkTarget}
            onCancel={setCancelTarget}
          />
        ))}
      </div>

      <MarkSentModal
        open={!!markTarget}
        onClose={() => setMarkTarget(null)}
        groupId={groupId}
        request={markTarget}
      />
      <ReasonModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel payout request"
        tone="danger"
        confirmLabel="Cancel request"
        description="Voiding a payout request is audited. State why."
        onConfirm={async (reason) => {
          if (cancelTarget) await cancelPayout(groupId, cancelTarget.id, reason);
        }}
      />
    </>
  );
}

// --- Slot-Shift Decisions tab ----------------------------------------------

function SlotShiftTab({ groupId }: { groupId: string }) {
  const proposals = useAdminAdasheStore((s) => s.proposals);
  const loaded = useAdminAdasheStore((s) => s.proposalsLoaded);
  const fetchProposals = useAdminAdasheStore((s) => s.fetchProposals);
  const approveProposal = useAdminAdasheStore((s) => s.approveProposal);
  const rejectProposal = useAdminAdasheStore((s) => s.rejectProposal);

  const { hasPermission } = useAdminAuth();
  const canDecide = hasPermission("adashe-groups:configure");

  const [approveTarget, setApproveTarget] = useState<AdminProposal | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminProposal | null>(null);

  useEffect(() => {
    if (!loaded) void fetchProposals(groupId);
  }, [groupId, loaded, fetchProposals]);

  const { awaiting, others } = useMemo(() => {
    const a = proposals.filter((p) => p.status === "AWAITING_ADMIN");
    const o = proposals.filter((p) => p.status !== "AWAITING_ADMIN");
    return { awaiting: a, others: o };
  }, [proposals]);

  if (!loaded) return <LoadingBlock label="Loading proposals" />;
  if (proposals.length === 0)
    return (
      <EmptyBlock
        icon={ArrowLeftRight}
        title="No slot-shift proposals"
        hint="When members vote through a rotation swap, the fully-voted request lands here for your decision."
      />
    );

  return (
    <>
      <div className="space-y-6">
        {awaiting.length > 0 && (
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              Awaiting your decision
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                {awaiting.length}
              </span>
            </h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {awaiting.map((p) => (
                <ProposalDecisionCard
                  key={p.id}
                  proposal={p}
                  canDecide={canDecide}
                  onApprove={setApproveTarget}
                  onReject={setRejectTarget}
                />
              ))}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-muted">
              Other proposals
            </h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {others.map((p) => (
                <ProposalDecisionCard
                  key={p.id}
                  proposal={p}
                  canDecide={canDecide}
                  onApprove={setApproveTarget}
                  onReject={setRejectTarget}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <ReasonModal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Approve slot-shift"
        confirmLabel="Approve swap"
        reasonRequired={false}
        reasonLabel="Note"
        description="Approving swaps the two rotation positions. This changes who gets paid when and is audited."
        onConfirm={async (note) => {
          if (approveTarget)
            await approveProposal(groupId, approveTarget.id, note || undefined);
        }}
      />
      <ReasonModal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject slot-shift"
        tone="danger"
        confirmLabel="Reject swap"
        description="Rejecting leaves the rotation unchanged. State why for the group and audit trail."
        onConfirm={async (reason) => {
          if (rejectTarget) await rejectProposal(groupId, rejectTarget.id, reason);
        }}
      />
    </>
  );
}

// --- Rules tab --------------------------------------------------------------

function RulesTab({ groupId }: { groupId: string }) {
  const detail = useAdminAdasheStore((s) => s.detail);
  const updateRules = useAdminAdasheStore((s) => s.updateRules);
  const suspend = useAdminAdasheStore((s) => s.suspend);
  const reinstate = useAdminAdasheStore((s) => s.reinstate);

  const { hasPermission } = useAdminAuth();
  const canConfigure = hasPermission("adashe-groups:configure");
  const canSuspend = hasPermission("adashe-groups:suspend");

  const [rules, setRules] = useState<GroupRules>(
    detail?.rules ?? { lateFeePercent: 0, missLimit: 3, exitPenalty: 0 }
  );
  const [saving, setSaving] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);

  useEffect(() => {
    if (detail?.rules) setRules(detail.rules);
  }, [detail?.rules]);

  const isSuspended = detail?.status === "SUSPENDED";

  const save = async () => {
    setSaving(true);
    try {
      await updateRules(groupId, rules);
      pushToast({
        title: "Rules updated",
        message: "New rules apply to future cycles.",
        tone: "success",
      });
    } catch (err) {
      pushToast({
        title: "Update failed",
        message: err instanceof Error ? err.message : "Could not update rules.",
        tone: "alert",
      });
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof GroupRules,
    props: { min?: number; max?: number; suffix?: string } = {}
  ) => (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          min={props.min}
          max={props.max}
          disabled={!canConfigure}
          value={rules[key]}
          onChange={(e) =>
            setRules((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))
          }
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:bg-surface-2 disabled:text-muted"
        />
        {props.suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
            {props.suffix}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-surface/70 p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-ink">
          Group rules
        </h3>
        <p className="mt-1 text-xs text-muted">
          Changes apply to future cycles only; accrued late fees are not
          recomputed.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {field("Late fee", "lateFeePercent", { min: 0, max: 100, suffix: "%" })}
          {field("Miss limit", "missLimit", { min: 1, suffix: "cycles" })}
          {field("Exit penalty", "exitPenalty", { min: 0, suffix: "₦" })}
        </div>
        {canConfigure ? (
          <div className="mt-5 flex justify-end">
            <Button onClick={save} loading={saving}>
              Save rules
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-[11px] text-muted">
            You have read-only access to the rules.
          </p>
        )}
      </div>

      {canSuspend && (
        <div className="rounded-3xl border border-border bg-surface/70 p-6 shadow-sm">
          <h3 className="font-display text-base font-semibold text-ink">
            Group state
          </h3>
          <p className="mt-1 text-xs text-muted">
            {isSuspended
              ? "This group is suspended — contributions and payout advancement are halted."
              : "Suspending halts contributions and payout advancement until reinstated."}
          </p>
          <div className="mt-4">
            {isSuspended ? (
              <Button
                variant="secondary"
                onClick={async () => {
                  await reinstate(groupId);
                  pushToast({
                    title: "Group reinstated",
                    message: "The circle is active again.",
                    tone: "success",
                  });
                }}
              >
                <RotateCcw className="h-4 w-4" /> Reinstate group
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setSuspendOpen(true)}
                className="!border-danger/40 !text-danger hover:!bg-danger/10"
              >
                <Ban className="h-4 w-4" /> Suspend group
              </Button>
            )}
          </div>
        </div>
      )}

      <ReasonModal
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        title="Suspend group"
        tone="danger"
        confirmLabel="Suspend"
        description="Suspending halts contributions and payout advancement. This is reversible and audited."
        onConfirm={async (reason) => {
          await suspend(groupId, reason);
          pushToast({
            title: "Group suspended",
            message: "Contributions and payouts are halted.",
            tone: "warning",
          });
        }}
      />
    </div>
  );
}

// --- Chat tab (needs the socket, so lives at page level) --------------------

// --- Page -------------------------------------------------------------------

function GroupDetailInner({ groupId }: { groupId: string }) {
  const reduce = useReducedMotion();

  const detail = useAdminAdasheStore((s) => s.detail);
  const detailStatus = useAdminAdasheStore((s) => s.detailStatus);
  const detailError = useAdminAdasheStore((s) => s.detailError);
  const loadGroup = useAdminAdasheStore((s) => s.loadGroup);
  const clearGroup = useAdminAdasheStore((s) => s.clearGroup);

  const { hasPermission } = useAdminAuth();
  const canInvite = hasPermission("adashe-groups:invite");
  const canPost = hasPermission("adashe-groups:message");

  const [tab, setTab] = useState<TabKey>("members");
  const [inviteOpen, setInviteOpen] = useState(false);

  // Only mount the socket when the Chat tab is active — an admin joining is an
  // audited oversight event, so we don't join every group on open.
  const socketGroupId = tab === "chat" ? groupId : null;
  const { status: socketStatus, sendMessage } =
    useAdminGroupSocket(socketGroupId);

  useEffect(() => {
    void loadGroup(groupId);
    return () => clearGroup();
  }, [groupId, loadGroup, clearGroup]);

  if (detailStatus === "loading" && !detail)
    return <LoadingBlock label="Loading circle" />;
  if (detailStatus === "error" && !detail)
    return (
      <ErrorBlock
        message={detailError ?? "Unable to load this circle."}
        onRetry={() => void loadGroup(groupId)}
      />
    );
  if (!detail) return null;

  const nextName =
    detail.nextRecipientName ??
    [...(detail.payoutOrder ?? [])]
      .sort((a, b) => a.position - b.position)
      .find((s) => !s.paid)?.name;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link
          to="/bennie/adashesu-contributions"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> All circles
        </Link>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-3xl border border-border bg-surface/70 p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-semibold text-ink">
                  {detail.name}
                </h1>
                <GroupStatusChip status={detail.status} />
                {detail.organizerType === "admin" && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#a6701c] dark:text-accent">
                    Admin-overseen
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">
                {detail.type} · {detail.frequency} ·{" "}
                {ngn(detail.contributionAmount)} per cycle
              </p>
              {detail.description && (
                <p className="mt-1 max-w-2xl text-xs text-muted">
                  {detail.description}
                </p>
              )}
            </div>

            {canInvite && detail.status !== "COMPLETED" && (
              <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" /> Invite
              </Button>
            )}
          </div>

          {/* Stat strip */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                <Wallet className="h-3.5 w-3.5" /> Pool balance
              </div>
              <p className="mt-1 font-mono text-lg font-bold text-primary">
                {ngn(detail.poolBalance)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Cycle progress
              </p>
              <div className="mt-1.5">
                <CycleProgress
                  currentCycle={detail.currentCycle}
                  maxSlots={detail.maxSlots}
                  paidPositions={
                    detail.payoutOrder?.filter((s) => s.paid).length
                  }
                />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                <Crown className="h-3.5 w-3.5" /> Next recipient
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-ink">
                {nextName ?? "—"}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Group detail"
        className="flex flex-wrap gap-1.5 border-b border-border"
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-t-xl border-b-2 px-3.5 py-2.5 text-xs font-semibold transition ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <motion.div
        key={tab}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {tab === "members" && <MembersTab groupId={groupId} />}
        {tab === "rotation" && (
          <div className="rounded-3xl border border-border bg-surface/70 p-6 shadow-sm">
            <p className="mb-4 text-xs text-muted">
              Read-only rotation order. The only sanctioned reorder is approving a
              slot-shift on the Slot-Shift tab.
            </p>
            <RotationView
              payoutOrder={detail.payoutOrder}
              activePosition={detail.activePosition}
            />
          </div>
        )}
        {tab === "contributions" && <ContributionsTab groupId={groupId} />}
        {tab === "payouts" && <PayoutsTab groupId={groupId} />}
        {tab === "chat" && (
          <ChatPanel
            groupId={groupId}
            groupName={detail.name}
            socketStatus={socketStatus}
            sendMessage={sendMessage}
            canPost={canPost}
          />
        )}
        {tab === "slotshift" && <SlotShiftTab groupId={groupId} />}
        {tab === "rules" && <RulesTab groupId={groupId} />}
      </motion.div>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupId={groupId}
        groupName={detail.name}
      />
    </div>
  );
}

export default function AdminAdasheGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <PermissionGate anyOf={["adashe-groups:view", "adashe-contributions:view"]}>
      {groupId ? (
        <GroupDetailInner groupId={groupId} />
      ) : (
        <ErrorBlock message="No group specified." />
      )}
    </PermissionGate>
  );
}
