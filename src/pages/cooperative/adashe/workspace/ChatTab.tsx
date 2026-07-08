/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Send, Users, Wifi, WifiOff, Loader2 } from "lucide-react";

import { Spinner, pushToast } from "../../../../components/ui";
import { useAuth } from "../../../../hooks/useAuth";
import { useAdasheStore } from "../../../../store/adasheStore";
import ChatMessage from "../components/ChatMessage";
import type { GroupDetail, GroupMessage } from "../../../../types/adashe";
import type { GroupSocketStatus } from "../../../../hooks/useGroupSocket";

interface ChatTabProps {
  detail: GroupDetail;
  socketStatus: GroupSocketStatus;
  sendMessage: (message: string) => boolean;
}

function StatusPill({ status }: { status: GroupSocketStatus }) {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
        <Wifi className="h-3 w-3" /> Live
      </span>
    );
  }
  if (status === "connecting" || status === "reconnecting") {
    return (
      <span className="flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
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

export default function ChatTab({
  detail,
  socketStatus,
  sendMessage,
}: ChatTabProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? user?.userId;
  const myName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "You";

  const messages = useAdasheStore((s) => s.messages);
  const messagesLoaded = useAdasheStore((s) => s.messagesLoaded);
  const fetchMessages = useAdasheStore((s) => s.fetchMessages);
  const addMessage = useAdasheStore((s) => s.addMessage);

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Load persisted history once per group.
  useEffect(() => {
    if (!messagesLoaded) void fetchMessages(detail.id);
  }, [detail.id, messagesLoaded, fetchMessages]);

  // Auto-scroll to newest.
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

    // Optimistic echo; reconciled when group:message:new lands (dedupe in store).
    const optimistic: GroupMessage = {
      id: `optimistic_${Date.now()}`,
      groupId: detail.id,
      senderType: "user",
      senderId: myUserId,
      senderName: myName,
      message: text,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    addMessage(optimistic);
    setInput("");
  };

  const isMine = (m: GroupMessage) =>
    (m.senderId && m.senderId === myUserId) ||
    (!m.senderId && m.senderName === myName);

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">
              {detail.name} chat
            </h3>
            <p className="text-[11px] text-muted">
              Live cooperative discussion
            </p>
          </div>
        </div>
        <StatusPill status={socketStatus} />
      </div>

      {/* Messages */}
      <div className="flex-grow space-y-4 overflow-y-auto bg-surface-2/40 p-6">
        {!messagesLoaded ? (
          <div className="flex h-full items-center justify-center">
            <Spinner label="Loading messages" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-ink">
              No messages yet
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted">
              Say hello to your circle. Messages stream live to everyone here.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <ChatMessage key={m.id} message={m} isMe={isMine(m)} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 border-t border-border bg-surface-2 p-4"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message your circle…"
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
    </div>
  );
}
