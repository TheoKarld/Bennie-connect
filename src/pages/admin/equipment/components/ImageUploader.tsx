/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Multi-file equipment image uploader.
 *
 * Each selected file streams to `POST /admin/upload` via
 * `adminUploadService.upload(file, { onProgress })`; the returned
 * `FileMetadata.url` is collected into `value` (an ordered URL list). Thumbnails
 * with a per-file progress ring, remove buttons, and set-primary (reorder to
 * front). Drag-drop and click-to-pick. Light/dark aware, brand tokens.
 */

import React, { useCallback, useRef, useState } from "react";
import { ImagePlus, Star, X } from "lucide-react";

import adminUploadService, {
  extractAdminUploadError,
} from "../../../../services/adminUpload.service";
import { pushToast } from "../../../../components/ui";

interface Uploading {
  key: string;
  name: string;
  percent: number;
}

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  className?: string;
}

export default function ImageUploader({ value, onChange, className = "" }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;

      await Promise.all(
        images.map(async (file) => {
          const key = `${file.name}-${Date.now()}-${Math.random()}`;
          setUploads((u) => [...u, { key, name: file.name, percent: 0 }]);
          try {
            const meta = await adminUploadService.upload(file, {
              folder: "equipment",
              onProgress: (p) =>
                setUploads((u) =>
                  u.map((x) => (x.key === key ? { ...x, percent: p.percent } : x))
                ),
            });
            onChange([...valueRef.current, meta.url]);
          } catch (err) {
            pushToast({
              tone: "alert",
              title: "Upload failed",
              message: extractAdminUploadError(err, `Could not upload ${file.name}.`),
            });
          } finally {
            setUploads((u) => u.filter((x) => x.key !== key));
          }
        })
      );
    },
    [onChange]
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void uploadFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) void uploadFiles(Array.from(e.dataTransfer.files));
  };

  const remove = (url: string) => onChange(value.filter((u) => u !== url));
  const setPrimary = (url: string) =>
    onChange([url, ...value.filter((u) => u !== url)]);

  return (
    <div className={className}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-surface-2 hover:border-primary/40"
        }`}
      >
        <ImagePlus className="mb-2 h-7 w-7 text-primary" />
        <p className="text-sm font-semibold text-ink">Add photos</p>
        <p className="mt-0.5 text-xs text-muted">
          Drag &amp; drop or click — the first image is the primary.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPick}
      />

      {(value.length > 0 || uploads.length > 0) && (
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((url, i) => (
            <div
              key={url}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-surface-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Equipment ${i + 1}`}
                className="h-full w-full object-cover"
              />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#1A2421]">
                  Primary
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                {i !== 0 && (
                  <button
                    type="button"
                    title="Set as primary"
                    onClick={() => setPrimary(url)}
                    className="rounded-full bg-white/90 p-1 text-[#1A2421] transition hover:bg-white"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  title="Remove"
                  onClick={() => remove(url)}
                  className="rounded-full bg-white/90 p-1 text-danger transition hover:bg-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {uploads.map((u) => (
            <div
              key={u.key}
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2 p-2"
            >
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <span className="w-full truncate text-center text-[9px] text-muted">
                {u.percent}%
              </span>
              <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${u.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
