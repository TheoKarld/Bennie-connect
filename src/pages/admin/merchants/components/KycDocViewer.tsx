/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * KYC document viewer — renders a private-bucket document inline (image or PDF)
 * via a short-lived V4 signed URL fetched on demand from
 * `adminUploadService.signedUrl(fileId)`. Shows an expiry countdown + refresh.
 * Degrades gracefully: if the signed URL is unavailable (backend private-bucket
 * feature dormant, or the file purged) it shows a "document unavailable" state
 * rather than crashing. Brand tokens, full light/dark support.
 */

import React, { useCallback, useEffect, useState } from "react";
import { FileText, ImageOff, RefreshCw } from "lucide-react";

import adminUploadService, {
  extractAdminUploadError,
} from "../../../../services/adminUpload.service";
import type { KycDocRef } from "../../../../types/adminMarketplace";

interface Props {
  doc: KycDocRef;
}

export default function KycDocViewer({ doc }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const isImage = (doc.fileType ?? "").startsWith("image/");
  const isPdf = (doc.fileType ?? "").includes("pdf");

  const fetchUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUploadService.signedUrl(doc.fileId);
      setUrl(res.url);
      setExpiresAt(res.expiresAt);
    } catch (err) {
      setUrl(null);
      setError(
        extractAdminUploadError(
          err,
          "Document unavailable — the private bucket may not be configured, or the file was purged."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [doc.fileId]);

  useEffect(() => {
    void fetchUrl();
  }, [fetchUrl]);

  // Expiry countdown.
  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(s);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const expired = secondsLeft != null && secondsLeft <= 0;
  const label = (doc.label ?? "Document").replace(/_/g, " ");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-2">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {secondsLeft != null && !expired && (
            <span className="text-[10px] text-muted">
              expires {Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </span>
          )}
          <button
            type="button"
            onClick={() => void fetchUrl()}
            title="Refresh signed URL"
            className="rounded-lg p-1 text-muted transition hover:bg-primary/5 hover:text-primary"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex min-h-[10rem] items-center justify-center p-2">
        {loading && (
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        )}
        {!loading && error && (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <ImageOff className="h-7 w-7 text-muted" />
            <p className="text-[11px] text-muted">{error}</p>
          </div>
        )}
        {!loading && !error && url && expired && (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <p className="text-[11px] text-muted">Signed URL expired.</p>
            <button
              type="button"
              onClick={() => void fetchUrl()}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Refresh
            </button>
          </div>
        )}
        {!loading && !error && url && !expired && isImage && (
          <img
            src={url}
            alt={label}
            className="max-h-72 w-full rounded-xl object-contain"
          />
        )}
        {!loading && !error && url && !expired && !isImage && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-2 px-4 py-6 text-center text-primary hover:underline"
          >
            <FileText className="h-8 w-8" />
            <span className="text-xs font-semibold">
              {isPdf ? "Open PDF document" : "Open document"}
            </span>
            <span className="text-[10px] text-muted">
              {doc.originalName ?? doc.fileType}
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
