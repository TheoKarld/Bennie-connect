import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { DEFAULT_ALLOWED_MIME_TYPES, UPLOAD_ERRORS } from './storage.constants';

// Interceptor options are evaluated at decorator time, so the allowlist + cap
// are read from env here (same source of truth as configuration.gcp). The
// allowlist can be widened via GCP_ALLOWED_MIME_TYPES (comma-separated).
// Shared by the user (`/upload`) and admin (`/admin/upload`) controllers so
// both planes enforce identical limits.
export const MAX_UPLOAD_BYTES = parseInt(
  process.env.GCP_MAX_UPLOAD_BYTES || '209715200',
  10,
);

const ALLOWED_MIME_TYPES = (process.env.GCP_ALLOWED_MIME_TYPES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const EFFECTIVE_ALLOWLIST =
  ALLOWED_MIME_TYPES.length > 0
    ? ALLOWED_MIME_TYPES
    : DEFAULT_ALLOWED_MIME_TYPES;

export const uploadFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (EFFECTIVE_ALLOWLIST.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(
    new BadRequestException({
      code: UPLOAD_ERRORS.INVALID_TYPE,
      message: `File type "${file.mimetype}" is not allowed`,
    }),
    false,
  );
};
