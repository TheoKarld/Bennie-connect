/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Mail } from "lucide-react";

import { Modal, Button, Input, pushToast } from "../../../../components/ui";
import { useAdasheStore } from "../../../../store/adasheStore";

interface InviteMembersModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName?: string;
}

export default function InviteMembersModal({
  open,
  onClose,
  groupId,
  groupName,
}: InviteMembersModalProps) {
  const invite = useAdasheStore((s) => s.invite);

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (submitting) return;
    setEmail("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      await invite(groupId, value);
      pushToast({
        title: "Invitation sent",
        message: `${value} has been invited to join.`,
        tone: "success",
      });
      setEmail("");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={groupName ? `Invite to ${groupName}` : "Invite a member"}
    >
      <p className="mb-4 text-xs leading-relaxed text-muted">
        Invite a registered member by email. They must accept the invitation to
        take a slot in the rotation.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Member email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              className="pl-11"
              autoFocus
            />
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Send invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
