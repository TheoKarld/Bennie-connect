/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Product media manager — up to 3 image slots + 1 video slot, uploaded through
 * the user upload service (public bucket) with per-file progress bars, remove
 * and reorder. Emits the embedded `FileMetadata` arrays the product API
 * expects (merchant_panel.md §3.4).
 */

import React, { useRef, useState } from "react";
import {
  ImagePlus,
  Video,
  X,
  ArrowLeft,
  ArrowRight,
  Film,
} from "lucide-react";

import { pushToast } from "../../../../components/ui";
import uploadService, {
  extractUploadError,
} from "../../../../services/upload.service";
import type { FileMetadata } from "../../../../types/upload";

const MAX_IMAGES = 3;

interface UploadingItem {
  key: string;
  name: string;
  percent: number;
  kind: "image" | "video";
}

export default function MediaManager({
  images,
  video,
  onChange,
  disabled = false,
}: {
  images: FileMetadata[];
  video: FileMetadata | null;
  onChange: (next: { images: FileMetadata[]; video: FileMetadata | null }) => void;
  disabled?: boolean;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<UploadingItem[]>([]);

  const busyImages = uploading.filter((u) => u.kind === "image").length;
  const busyVideo = uploading.some((u) => u.kind === "video");
  const imageSlotsLeft = MAX_IMAGES - images.length - busyImages;

  const track = (key: string, percent: number) =>
    setUploading((prev) =>
      prev.map((u) => (u.key === key ? { ...u, percent } : u))
    );

  const untrack = (key: string) =>
    setUploading((prev) => prev.filter((u) => u.key !== key));

  const uploadOne = async (file: File, kind: "image" | "video") => {
    const key = `${Date.now()}_${file.name}`;
    setUploading((prev) => [
      ...prev,
      { key, name: file.name, percent: 0, kind },
    ]);
    try {
      const meta = await uploadService.upload(file, {
        folder: "marketplace/products",
        visibility: "public",
        onProgress: (p) => track(key, p.percent),
      });
      if (kind === "image") {
        onChange({ images: [...images, meta], video });
      } else {
        onChange({ images, video: meta });
      }
    } catch (err) {
      pushToast({
        title: "Upload failed",
        message: extractUploadError(err, `Could not upload ${file.name}.`),
        tone: "alert",
      });
    } finally {
      untrack(key);
    }
  };

  const onPickImages = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).slice(0, Math.max(0, imageSlotsLeft));
    for (const file of picked) {
      if (!file.type.startsWith("image/")) {
        pushToast({
          title: "Images only",
          message: `${file.name} is not an image.`,
          tone: "warning",
        });
        continue;
      }
      void uploadOne(file, "image");
    }
  };

  const onPickVideo = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      pushToast({
        title: "Video only",
        message: `${file.name} is not a video file.`,
        tone: "warning",
      });
      return;
    }
    void uploadOne(file, "video");
  };

  const removeImage = (id: string) =>
    onChange({ images: images.filter((i) => i.id !== id), video });

  const moveImage = (index: number, delta: number) => {
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ images: next, video });
  };

  return (
    <div className="space-y-4">
      {/* Images */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Images ({images.length}/{MAX_IMAGES}) · first image is the cover
          </p>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {images.map((img, i) => (
            <div
              key={img.id}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-surface-2"
            >
              <img
                src={img.url}
                alt={img.originalName}
                className="h-full w-full object-cover"
              />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Cover
                </span>
              )}
              {!disabled && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveImage(i, -1)}
                    disabled={i === 0}
                    aria-label="Move image left"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30 disabled:opacity-30"
                  >
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    aria-label="Remove image"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/80 text-white backdrop-blur-sm transition hover:bg-rose-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(i, 1)}
                    disabled={i === images.length - 1}
                    aria-label="Move image right"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30 disabled:opacity-30"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* In-flight image uploads */}
          {uploading
            .filter((u) => u.kind === "image")
            .map((u) => (
              <div
                key={u.key}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-2"
              >
                <p className="w-full truncate text-center text-[10px] font-semibold text-muted">
                  {u.name}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${u.percent}%` }}
                  />
                </div>
                <p className="font-mono text-[10px] font-bold text-primary">
                  {u.percent}%
                </p>
              </div>
            ))}

          {/* Add slot */}
          {!disabled && imageSlotsLeft > 0 && (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-muted transition hover:border-primary/40 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px] font-semibold">Add image</span>
            </button>
          )}
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            onPickImages(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Video */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Video (optional, max 1)
        </p>
        <div className="mt-2">
          {video ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Film className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-ink">
                    {video.originalName}
                  </span>
                  <span className="block text-[10px] text-muted">
                    {(video.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </span>
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange({ images, video: null })}
                  aria-label="Remove video"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : busyVideo ? (
            uploading
              .filter((u) => u.kind === "video")
              .map((u) => (
                <div
                  key={u.key}
                  className="space-y-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3"
                >
                  <p className="truncate text-xs font-semibold text-muted">
                    Uploading {u.name}…
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${u.percent}%` }}
                    />
                  </div>
                </div>
              ))
          ) : (
            !disabled && (
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                <Video className="h-4 w-4" /> Add a product video
              </button>
            )
          )}
        </div>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            onPickVideo(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
