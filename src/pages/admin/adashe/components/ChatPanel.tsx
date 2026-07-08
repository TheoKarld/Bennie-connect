/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Admin group-chat oversight panel. Loads full persisted history via GET
 * messages, streams live `group:message:new` over `/rt/admin`, and lets the
 * admin post (server tags `senderType: 'admin'`). Admin messages are clearly
 * staff-badged. The composer is hidden for admins lacking
 * `adashe-groups:message`.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  Users,
  Wifi,
  WifiOff,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

import { pushToast } from "../../../../components/ui";
import { useAdminAuth } from "../../../../hooks/useAdminAuth";
import { useAdminAdasheStore } from "../../../../store/adminAdasheStore";
import { LoadingBlock } from "./shared";
import type { GroupMessage } from "../../../../types/adashe";
import type { AdminGroupSocketStatus } from "../../../../hooks/useAdminGroupSocket";

interface Props {
  groupId: string;
  groupName: string;
  socketStatus: AdminGroupSocketStatus;
  sendMessage: (message: string) => boolean;
  canPost: boolean;
}

function StatusPill({ status }: { status: AdminGroupSocketStatus }) {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
        <Wifi className="h-3 w-3" /> Live
      </span>
    );
  }
  if (status === "connecting" || status === "reconnecting") {
    return (
      <span className="flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-[#a6701c] dark:text-accent">
        <Loader2 className="h-3 w-3 animate-spin" />
        {status === "reconnecting" ? "Reconnecting" : "Connecting"}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[10px] font-bold text-muted">
      <WifiOff className="h-3 w-3" /> Offline
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function MessageRow({ m, mine }: { m: GroupMessage; mine: boolean }) {
  if (m.senderType === "system") {
    return (
      <div className="my-3 flex justify-center">
        <div className="flex max-w-lg items-start gap-2 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-2 text-center text-[11px] font-semibold leading-relaxed text-[#a6701c] dark:text-accent">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>{m.message}</span>
        </div>
      </div>
    );
  }

  const isAdmin = m.senderType === "admin";

  return (
    <div className={`flex max-w-xl gap-3 ${mine ? "ml-auto flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          isAdmin
            ? "bg-accent text-white"
            : "bg-primary/10 text-primary"
        }`}
      >
        {isAdmin ? <ShieldCheck className="h-4 w-4" /> : initials(m.senderName)}
      </div>

      <div className="min-w-0 space-y-1">
        <div className={`flex items-center gap-2 ${mine ? "justify-end" : ""}`}>
          <span className="text-xs font-bold text-ink">
            {mine ? "You" : m.senderName}
          </span>
          {isAdmin && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#a6701c] dark:text-accent">
              Staff
            </span>
          )}
          <span className="font-mono text-[9.5px] text-muted">
            {timeLabel(m.createdAt)}
          </span>
        </div>

        <div
          className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
            mine
              ? "rounded-tr-none bg-primary text-white"
              : isAdmin
              ? "rounded-tl-none border border-accent/25 bg-accent/5 text-ink"
              : "rounded-tl-none border border-border bg-surface text-ink"
          } ${m.pending ? "opacity-60" : ""}`}
        >
          {m.message}
          {m.pending && (
            <span className="ml-1.5 text-[9px] uppercase tracking-wide opacity-70">
              sending…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel({
  groupId,
  groupName,
  socketStatus,
  sendMessage,
  canPost,
}: Props) {
  const { admin } = useAdminAuth();
  const myAdminId = admin?.adminId;
  const myName =
    [admin?.firstName, admin?.lastName].filter(Boolean).join(" ") || "Admin";

  const messages = useAdminAdasheStore((s) => s.messages);
  const messagesLoaded = useAdminAdasheStore((s) => s.messagesLoaded);
  const fetchMessages = useAdminAdasheStore((s) => s.fetchMessages);
  const addMessage = useAdminAdasheStore((s) => s.addMessage);

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!messagesLoaded) void fetchMessages(groupId);
  }, [groupId, messagesLoaded, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const ok = sendMessage(text);
    if (!ok) {
      pushToast({
        title: "Not connected",
        message: "Reconnecting to the group chat — try again in a moment.",
        tone: "warning",
      });
      return;
    }

    const optimistic: GroupMessage = {
      id: `optimistic_${Date.now()}`,
      groupId,
      senderType: "admin",
      senderId: myAdminId,
      senderName: myName,
      message: text,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    addMessage(optimistic);
    setInput("");
  };

  const isMine = (m: GroupMessage) =>
    m.senderType === "admin" &&
    ((m.senderId && m.senderId === myAdminId) ||
      (!m.senderId && m.senderName === myName));

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">{groupName} chat</h3>
            <p className="text-[11px] text-muted">
              Oversight — you post as staff, visible to all members
            </p>
          </div>
        </div>
        <StatusPill status={socketStatus} />
      </div>

      <div className="flex-grow space-y-4 overflow-y-auto bg-canvas/40 p-6">
        {!messagesLoaded ? (
          <LoadingBlock label="Loading messages" />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-ink">No messages yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted">
              This circle hasn't started chatting. Your posts appear here badged
              as staff.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageRow key={m.id} m={m} mine={isMine(m)} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {canPost ? (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 border-t border-border bg-surface-2 p-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Post an oversight message…"
            className="flex-grow rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex shrink-0 items-center justify-center rounded-2xl bg-primary p-3 text-white transition hover:bg-[#0f4c2f] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      ) : (
        <div className="border-t border-border bg-surface-2 px-6 py-4 text-center text-[11px] text-muted">
          You have read-only access to this chat.
        </div>
      )}
    </div>
  );
}
