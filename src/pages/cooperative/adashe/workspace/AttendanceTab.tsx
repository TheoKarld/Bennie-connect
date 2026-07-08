/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Calendar, ShieldCheck, CheckCircle2 } from "lucide-react";

import { Button, Spinner, pushToast } from "../../../../components/ui";
import { useAdasheStore } from "../../../../store/adasheStore";
import type { GroupDetail } from "../../../../types/adashe";

interface AttendanceTabProps {
  detail: GroupDetail;
}

function dateLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function AttendanceTab({ detail }: AttendanceTabProps) {
  const attendance = useAdasheStore((s) => s.attendance);
  const attendanceLoaded = useAdasheStore((s) => s.attendanceLoaded);
  const fetchAttendance = useAdasheStore((s) => s.fetchAttendance);
  const checkIn = useAdasheStore((s) => s.checkIn);

  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!attendanceLoaded) void fetchAttendance(detail.id);
  }, [detail.id, attendanceLoaded, fetchAttendance]);

  const handleCheckIn = async (sessionId: string) => {
    setBusyId(sessionId);
    try {
      await checkIn(detail.id, sessionId);
      pushToast({
        title: "Checked in",
        message: "Your presence has been recorded.",
        tone: "success",
      });
    } catch (err) {
      pushToast({
        title: "Could not check in",
        message: (err as Error).message,
        tone: "alert",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-surface p-6 shadow-sm">
      <div className="border-b border-border pb-4">
        <h3 className="font-display text-lg font-semibold text-ink">
          Attendance sessions
        </h3>
        <p className="mt-0.5 text-xs text-muted">
          Verification meetings keep the circle transparent. Check in to record
          your presence.
        </p>
      </div>

      {!attendanceLoaded ? (
        <div className="flex justify-center py-12">
          <Spinner label="Loading sessions" />
        </div>
      ) : attendance.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-ink">
            No sessions yet
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted">
            When your organizer opens a verification session, it will appear
            here to check in.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {attendance.map((s) => (
            <div
              key={s.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-surface-2 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">
                    {dateLabel(s.sessionDate)}
                  </span>
                  <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-bold text-muted">
                    {s.presentCount} present
                  </span>
                </div>
                <h4 className="truncate text-sm font-semibold text-ink">
                  {s.title}
                </h4>
              </div>

              {s.iAmPresent ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-xl border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-bold text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Checked in
                </span>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleCheckIn(s.id)}
                  loading={busyId === s.id}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Check in
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
