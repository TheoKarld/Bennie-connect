/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typed REST client for the ADMIN-plane GCP file-upload service
 * (base `<VITE_API_URL>/admin/upload`, via `src/lib/adminApi.ts`; backend
 * contract: `PRD/gcp_upload.md`).
 *
 * This is the admin-plane sibling of `src/services/upload.service.ts` (the user
 * plane). It reuses the shared types in `src/types/upload.ts` but is bound to
 * `adminApi` (admin token + `/admin` base) so the two dual sessions never bleed.
 *
 * Every endpoint requires the admin JWT (attached by `src/lib/adminApi.ts`) and
 * returns the `{ success, data }` envelope; each helper unwraps `.data`. Errors
 * bubble up as axios errors so callers can surface `UPLOAD_*` codes/messages
 * from `{ success:false, error:{ code, message } }` via `extractAdminUploadError`.
 */

import type { AxiosProgressEvent } from "axios";

import adminApi from "../lib/adminApi";
import type {
  FileMetadata,
  ListMediaParams,
  MediaLibraryPage,
  SignedUrlResult,
  UploadProgress,
} from "../types/upload";

/** Unwrap `{ success, data }`; tolerate a bare payload defensively. */
function unwrap<T>(payload: unknown): T {
  const body = payload as { data?: T } | T;
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

const BASE = "/upload";

export interface AdminUploadOptions {
  /** Optional bucket folder prefix, sent as the `folder` form field. */
  folder?: string;
  /** Progress callback fired as the file streams to the backend. */
  onProgress?: (p: UploadProgress) => void;
  /** Abort signal to cancel the in-flight upload. */
  signal?: AbortSignal;
}

export const adminUploadService = {
  /**
   * Upload a single file (multipart, form field `file`). Wires axios upload
   * progress through `opts.onProgress` and supports cancellation via `signal`.
   */
  async upload(
    file: File,
    opts: AdminUploadOptions = {}
  ): Promise<FileMetadata> {
    const form = new FormData();
    form.append("file", file);
    if (opts.folder) form.append("folder", opts.folder);

    const res = await adminApi.post(BASE, form, {
      headers: { "Content-Type": "multipart/form-data" },
      signal: opts.signal,
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (!opts.onProgress) return;
        const total = event.total;
        const loaded = event.loaded;
        const percent =
          total && total > 0 ? Math.round((loaded / total) * 100) : 0;
        opts.onProgress({ loaded, total, percent });
      },
    });

    return unwrap<FileMetadata>(res.data);
  },

  /**
   * Media library — list uploaded files, paginated, newest first. Tolerates
   * both the paginated envelope and a bare array response.
   */
  async mediaLibrary(params: ListMediaParams = {}): Promise<MediaLibraryPage> {
    const res = await adminApi.get(BASE, { params });
    const data = unwrap<MediaLibraryPage | FileMetadata[]>(res.data);
    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        page: params.page ?? 1,
        limit: params.limit ?? data.length,
      };
    }
    return {
      items: data?.items ?? [],
      total: data?.total ?? 0,
      page: data?.page ?? params.page ?? 1,
      limit: data?.limit ?? params.limit ?? 0,
    };
  },

  /**
   * Fetch a short-lived V4 signed URL for a PRIVATE file (e.g. a merchant KYC
   * document). Public files come back with their plain URL and `signed: false`.
   * A purged / missing file throws (`UPLOAD_004`) — callers degrade gracefully.
   */
  async signedUrl(id: string): Promise<SignedUrlResult> {
    const res = await adminApi.get(`${BASE}/${id}/signed-url`);
    return unwrap<SignedUrlResult>(res.data);
  },

  /** Delete a file by its `files` record id (removes the GCS object + DB row). */
  async remove(id: string): Promise<void> {
    await adminApi.delete(`${BASE}/${id}`);
  },
};

/** Pull a friendly message (and UPLOAD_* code) out of an axios/API error. */
export function extractAdminUploadError(
  err: unknown,
  fallback: string
): string {
  const ax = err as {
    response?: {
      data?: {
        error?: { code?: string; message?: string };
        message?: string | string[];
      };
    };
    message?: string;
  };
  const payload = ax?.response?.data;
  const apiErr = payload?.error;
  if (apiErr?.message) return apiErr.message;
  const msg = payload?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  if (ax?.message) return ax.message;
  return fallback;
}

export default adminUploadService;
