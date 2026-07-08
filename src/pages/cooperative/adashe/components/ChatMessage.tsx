/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AlertCircle } from "lucide-react";

import type { GroupMessage } from "../../../../types/adashe";

interface ChatMessageProps {
  message: GroupMessage;
  isMe: boolean;
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

export default function ChatMessage({ message, isMe }: ChatMessageProps) {
  if (message.senderType === "system") {
    return (
      <div className="my-3 flex justify-center">
        <div className="flex max-w-lg items-start gap-2 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-2 text-center text-[11px] font-semibold leading-relaxed text-amber-800 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>{message.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex max-w-xl gap-3 ${isMe ? "ml-auto flex-row-reverse" : ""}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          isMe ? "bg-primary text-white" : "bg-primary/10 text-primary"
        }`}
      >
        {initials(message.senderName)}
      </div>

      <div className="min-w-0 space-y-1">
        <div
          className={`flex items-center gap-2 ${isMe ? "justify-end" : ""}`}
        >
          <span className="text-xs font-bold text-ink">
            {isMe ? "You" : message.senderName}
          </span>
          <span className="font-mono text-[9.5px] text-muted">
            {timeLabel(message.createdAt)}
          </span>
        </div>

        <div
          className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
            isMe
              ? "rounded-tr-none bg-primary text-white"
              : "rounded-tl-none border border-border bg-surface text-ink"
          } ${message.pending ? "opacity-60" : ""}`}
        >
          {message.message}
          {message.pending && (
            <span className="ml-1.5 text-[9px] uppercase tracking-wide opacity-70">
              sending…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
