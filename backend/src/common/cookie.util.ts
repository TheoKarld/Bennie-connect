import { Response } from 'express';

export interface RefreshCookieOptions {
  name: string;
  path: string;
  secure: boolean;
  maxAgeMs?: number;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sets an httpOnly refresh-token cookie scoped to a single plane's path so the
 * user and admin refresh cookies can coexist and each is only sent to its own
 * endpoints.
 */
export function setRefreshCookie(
  res: Response,
  token: string,
  opts: RefreshCookieOptions,
): void {
  res.cookie(opts.name, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: opts.secure,
    maxAge: opts.maxAgeMs ?? SEVEN_DAYS_MS,
    path: opts.path,
  });
}

/** Clears a previously-set refresh-token cookie (must match name + path). */
export function clearRefreshCookie(
  res: Response,
  opts: Pick<RefreshCookieOptions, 'name' | 'path' | 'secure'>,
): void {
  res.clearCookie(opts.name, {
    httpOnly: true,
    sameSite: 'lax',
    secure: opts.secure,
    path: opts.path,
  });
}
