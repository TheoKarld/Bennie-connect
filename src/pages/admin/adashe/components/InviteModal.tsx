/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Invite-a-member-by-email modal. The invitee accepts on the user plane, which
 * creates their GroupMember + rotation slot. Permission-gated by the caller
 * (`adashe-groups:invite`).
 */

import React, { useState } from "react";
import { Mail } from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminAdasheStore } from "../../../../store/adminAdasheStore";

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InviteModal({ open, onClose, groupId, groupName }: Props) {
  const invite = useAdminAdasheStore((s) => s.invite);

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
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
      setError(err instanceof Error ? err.message : "Could not send the invite.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite a member">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mail className="h-5 w-5" />
        </span>
        <p className="text-xs text-muted">
          Invite someone to join{" "}
          <strong>{groupName ?? "this circle"}</strong>. They accept in their app
          to claim the next rotation slot.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email address" htmlFor="inv-email">
          <Input
            id="inv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@example.com"
            autoFocus
          />
        </Field>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
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
