/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Product media uploader — up to 3 images + 1 video, staged as full
 * `FileMetadata` objects (the shape the admin marketplace API embeds on the
 * product). Each file streams to `POST /admin/upload` (public visibility) via
 * `adminUploadService.upload(file, { onProgress })`, showing a per-file
 * progress bar. Images support reorder / set-primary / remove; the video slot
 * holds one clip. Removed media cascade-deletes on save (backend). Brand
 * tokens, full light/dark support.
 */

import React, { useCallback, useRef, useState } from "react";
import { Film, ImagePlus, Star, X } from "lucide-react";

import adminUploadService, {
  extractAdminUploadError,
} from "../../../../services/adminUpload.service";
import { pushToast } from "../../../../components/ui";
import type { FileMetadata } from "../../../../types/upload";

interface Uploading {
  key: string;
  name: string;
  percent: number;
  kind: "image" | "video";
}

interface Props {
  images: FileMetadata[];
  video: FileMetadata | null;
  onImagesChange: (images: FileMetadata[]) => void;
  onVideoChange: (video: FileMetadata | null) => void;
  maxImages?: number;
}

export default function ProductMediaUploader({
  images,
  video,
  onImagesChange,
  onVideoChange,
  maxImages = 3,
}: Props) {
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const vidInputRef = useRef<HTMLInputElement | null>(null);
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const uploadImages = useCallback(
    async (files: File[]) => {
      const pics = files.filter((f) => f.type.startsWith("image/"));
      const room = maxImages - imagesRef.current.length;
      const slice = pics.slice(0, Math.max(0, room));
      if (pics.length > slice.length) {
        pushToast({
          tone: "alert",
          title: "Image limit reached",
          message: `Up to ${maxImages} images allowed.`,
        });
      }
      for (const file of slice) {
        const key = `${file.name}-${Date.now()}-${Math.random()}`;
        setUploads((u) => [...u, { key, name: file.name, percent: 0, kind: "image" }]);
        try {
          const meta = await adminUploadService.upload(file, {
            folder: "marketplace/products",
            onProgress: (p) =>
              setUploads((u) =>
                u.map((x) => (x.key === key ? { ...x, percent: p.percent } : x))
              ),
          });
          imagesRef.current = [...imagesRef.current, meta];
          onImagesChange(imagesRef.current);
        } catch (err) {
          pushToast({
            tone: "alert",
            title: "Upload failed",
            message: extractAdminUploadError(err, `Could not upload ${file.name}.`),
          });
        } finally {
          setUploads((u) => u.filter((x) => x.key !== key));
        }
      }
    },
    [maxImages, onImagesChange]
  );

  const uploadVideo = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) {
        pushToast({ tone: "alert", title: "Not a video file" });
        return;
      }
      const key = `${file.name}-${Date.now()}`;
      setUploads((u) => [...u, { key, name: file.name, percent: 0, kind: "video" }]);
      try {
        const meta = await adminUploadService.upload(file, {
          folder: "marketplace/products",
          onProgress: (p) =>
            setUploads((u) =>
              u.map((x) => (x.key === key ? { ...x, percent: p.percent } : x))
            ),
        });
        onVideoChange(meta);
      } catch (err) {
        pushToast({
          tone: "alert",
          title: "Upload failed",
          message: extractAdminUploadError(err, `Could not upload ${file.name}.`),
        });
      } finally {
        setUploads((u) => u.filter((x) => x.key !== key));
      }
    },
    [onVideoChange]
  );

  const onPickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void uploadImages(Array.from(e.target.files));
    e.target.value = "";
  };
  const onPickVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) void uploadVideo(e.target.files[0]);
    e.target.value = "";
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) void uploadImages(Array.from(e.dataTransfer.files));
  };

  const removeImage = (id: string) =>
    onImagesChange(images.filter((m) => m.id !== id));
  const setPrimary = (id: string) => {
    const target = images.find((m) => m.id === id);
    if (!target) return;
    onImagesChange([target, ...images.filter((m) => m.id !== id)]);
  };

  const imgUploads = uploads.filter((u) => u.kind === "image");
  const vidUploads = uploads.filter((u) => u.kind === "video");
  const atImageCap = images.length >= maxImages;

  return (
    <div className="space-y-5">
      {/* Images */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Images ({images.length}/{maxImages})
          </p>
          <span className="text-[10px] text-muted">First image is the primary.</span>
        </div>
        {!atImageCap && (
          <div
            onClick={() => imgInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") imgInputRef.current?.click();
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-7 text-center transition ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-surface-2 hover:border-primary/40"
            }`}
          >
            <ImagePlus className="mb-2 h-6 w-6 text-primary" />
            <p className="text-sm font-semibold text-ink">Add photos</p>
            <p className="mt-0.5 text-xs text-muted">Drag &amp; drop or click.</p>
          </div>
        )}
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPickImages}
        />

        {(images.length > 0 || imgUploads.length > 0) && (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((m, i) => (
              <div
                key={m.id}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-surface-2"
              >
                <img src={m.url} alt={m.originalName ?? `Image ${i + 1}`} className="h-full w-full object-cover" />
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
                      onClick={() => setPrimary(m.id)}
                      className="rounded-full bg-white/90 p-1 text-[#1A2421] transition hover:bg-white"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => removeImage(m.id)}
                    className="rounded-full bg-white/90 p-1 text-danger transition hover:bg-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {imgUploads.map((u) => (
              <div
                key={u.key}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2 p-2"
              >
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                <span className="text-[9px] text-muted">{u.percent}%</span>
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

      {/* Video */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Video (optional)
          </p>
          <span className="text-[10px] text-muted">Max 1 clip · ≤ 200 MB.</span>
        </div>
        {video ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Film className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {video.originalName ?? video.name}
              </p>
              <p className="text-[11px] text-muted">
                {video.fileType} · {(video.size / 1_000_000).toFixed(1)} MB
              </p>
            </div>
            <button
              type="button"
              title="Remove video"
              onClick={() => onVideoChange(null)}
              className="rounded-full p-1.5 text-danger transition hover:bg-danger/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : vidUploads.length > 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2 p-3">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <div className="flex-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${vidUploads[0].percent}%` }}
                />
              </div>
            </div>
            <span className="text-[11px] text-muted">{vidUploads[0].percent}%</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => vidInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-2 px-6 py-5 text-sm font-semibold text-ink transition hover:border-primary/40"
          >
            <Film className="h-5 w-5 text-primary" /> Add a product video
          </button>
        )}
        <input
          ref={vidInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onPickVideo}
        />
      </div>
    </div>
  );
}
