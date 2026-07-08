/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SHARED upload types for the GCP Cloud Storage file-upload service
 * (backend contract: `PRD/gcp_upload.md`, base `/api/v1/upload`).
 *
 * This file is the single contract for BOTH the user-plane upload service
 * (`src/services/upload.service.ts`) and the admin-plane upload service that a
 * later agent will build against `adminApi`. Keep it framework-free (no axios,
 * no store) so either service can import it.
 */

/** Object visibility: public bucket (plain URL) vs private bucket (signed URL). */
export type FileVisibility = "public" | "private";

/**
 * The metadata record returned by every upload endpoint and persisted 1:1 in
 * the backend `files` collection. See `PRD/gcp_upload.md` §FileMetadata.
 */
export interface FileMetadata {
  /** The `files` record id (Mongo `_id` as string). */
  id: string;
  /** Stored object name — `{uuid}-{sanitized-original}` (+ optional `folder/`). */
  name: string;
  /** The client's original filename, as uploaded. */
  originalName: string;
  /** MIME type, e.g. `application/pdf`. */
  fileType: string;
  /** Size in bytes. */
  size: number;
  /** Public GCS URL `https://storage.googleapis.com/<bucket>/<path>`. */
  url: string;
  /** GCS bucket name. */
  bucket: string;
  /** Object path within the bucket (== `name`, incl. any folder prefix). */
  path: string;
  /** The uploading principal's id (`USR_…` for users); attribution/audit. */
  uploaderId: string;
  /** Uploader kind, e.g. `"user"` / `"admin"`. Optional — backend attribution. */
  uploaderType?: string;
  /**
   * `"public"` (default) or `"private"`. Private files live in the private
   * bucket and have NO usable public `url` — view via a signed URL.
   */
  visibility?: FileVisibility;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
}

/**
 * `GET /upload/:id/signed-url` — short-lived V4 signed URL for an OWN private
 * file. Public files come back with their plain URL and `signed: false`.
 */
export interface SignedUrlResult {
  id?: string;
  signed: boolean;
  url: string;
  expiresAt: string | null;
}

/**
 * A single page of the media library — `GET /upload` returns this envelope
 * (`{ items, total, page, limit }`), newest first.
 */
export interface MediaLibraryPage {
  items: FileMetadata[];
  total: number;
  page: number;
  limit: number;
}

/** Query params for the media-library listing (`GET /upload?page&limit`). */
export interface ListMediaParams {
  page?: number;
  limit?: number;
}

/**
 * Upload progress reported to `opts.onProgress` while a file is streaming to the
 * backend. `total` may be `undefined` if the browser cannot compute it, in which
 * case `percent` is `0`.
 */
export interface UploadProgress {
  /** Bytes uploaded so far. */
  loaded: number;
  /** Total bytes to upload (`undefined` when not computable). */
  total?: number;
  /** Integer 0–100. `0` when `total` is unknown. */
  percent: number;
}
