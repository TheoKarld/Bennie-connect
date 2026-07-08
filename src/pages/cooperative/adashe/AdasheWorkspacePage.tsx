/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Coins,
  MessageSquare,
  Vote,
  Calendar,
  TrendingUp,
  UserPlus,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { Badge, Button, Spinner } from "../../../components/ui";
import { useGroupSocket } from "../../../hooks/useGroupSocket";
import { useAdasheStore } from "../../../store/adasheStore";
import RotationsTab from "./workspace/RotationsTab";
import ChatTab from "./workspace/ChatTab";
import ProposalsTab from "./workspace/ProposalsTab";
import AttendanceTab from "./workspace/AttendanceTab";
import PerformanceTab from "./workspace/PerformanceTab";
import InviteMembersModal from "./components/InviteMembersModal";

type TabKey =
  | "rotations"
  | "chat"
  | "proposals"
  | "attendance"
  | "performance";

const TABS: { key: TabKey; label: string; icon: typeof Coins }[] = [
  { key: "rotations", label: "Rotations & payouts", icon: Coins },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "proposals", label: "Proposals & voting", icon: Vote },
  { key: "attendance", label: "Attendance", icon: Calendar },
  { key: "performance", label: "Performance", icon: TrendingUp },
];

export default function AdasheWorkspacePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const detail = useAdasheStore((s) => s.detail);
  const detailStatus = useAdasheStore((s) => s.detailStatus);
  const detailError = useAdasheStore((s) => s.detailError);
  const loadWorkspace = useAdasheStore((s) => s.loadWorkspace);
  const clearWorkspace = useAdasheStore((s) => s.clearWorkspace);

  const [tab, setTab] = useState<TabKey>("rotations");
  const [inviteOpen, setInviteOpen] = useState(false);

  // Own the group socket for this workspace.
  const { status: socketStatus, sendMessage } = useGroupSocket(
    groupId ?? null
  );

  useEffect(() => {
    if (groupId) void loadWorkspace(groupId);
    return () => clearWorkspace();
  }, [groupId, loadWorkspace, clearWorkspace]);

  // The correct detail for THIS route (guards a stale detail while switching).
  const ready = detail && detail.id === groupId && detailStatus === "ready";

  if (detailStatus === "loading" || (!detail && detailStatus === "idle")) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <Spinner label="Loading circle" />
      </div>
    );
  }

  if (detailStatus === "error" && !ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-surface py-16 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm font-semibold text-ink">
            Couldn&apos;t open this circle
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            {detailError}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => groupId && loadWorkspace(groupId)}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/app/adashe")}
            >
              Back to circles
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!ready || !detail) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/app/adashe")}
            className="rounded-xl border border-border p-2.5 text-ink transition hover:bg-surface-2"
            title="Back to circles"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-primary">
              Cooperative thrift circle
            </span>
            <h1 className="truncate font-display text-xl font-semibold text-ink sm:text-2xl">
              {detail.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="green">{detail.type}</Badge>
              <Badge
                tone={
                  detail.status === "ACTIVE"
                    ? "green"
                    : detail.status === "FORMING"
                      ? "gold"
                      : "neutral"
                }
              >
                {detail.status}
              </Badge>
              <span className="text-[11px] font-medium text-muted">
                You are Slot #{detail.me.position}
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setInviteOpen(true)}
          className="shrink-0"
        >
          <UserPlus className="h-3.5 w-3.5" /> Invite member
        </Button>
      </div>

      {/* Sub-nav */}
      <div className="scrollbar-thin flex gap-2 overflow-x-auto border-b border-border pb-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "rotations" && <RotationsTab detail={detail} />}
      {tab === "chat" && (
        <ChatTab
          detail={detail}
          socketStatus={socketStatus}
          sendMessage={sendMessage}
        />
      )}
      {tab === "proposals" && <ProposalsTab detail={detail} />}
      {tab === "attendance" && <AttendanceTab detail={detail} />}
      {tab === "performance" && <PerformanceTab detail={detail} />}

      <InviteMembersModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupId={detail.id}
        groupName={detail.name}
      />
    </div>
  );
}
