/**
 * Storage/upload error codes surfaced to clients.
 */
export const UPLOAD_ERRORS = {
  /** Storage backend (GCP) not configured — no creds. */
  NOT_CONFIGURED: 'UPLOAD_001',
  /** File MIME type not in the allowlist. */
  INVALID_TYPE: 'UPLOAD_002',
  /** File exceeds the configured max size. */
  TOO_LARGE: 'UPLOAD_003',
  /** File record not found. */
  NOT_FOUND: 'UPLOAD_004',
  /** Signed-URL generation failed. */
  SIGNING_FAILED: 'UPLOAD_005',
} as const;

/** Default MIME allowlist — overridable via config/env if needed later. */
export const DEFAULT_ALLOWED_MIME_TYPES: string[] = [
  // images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
  // videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
];
