/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Single source of truth for admin RBAC permission matching on the frontend.
 * Mirrors the backend `PermissionsGuard` semantics documented in
 * `PRD/admin_module/README.md`:
 *
 *   A permission string is satisfied by an effective set if the set contains:
 *     - the exact string,               e.g. "users:view"
 *     - a matching `resource:*` wildcard, e.g. "users:*"
 *     - the global `*` wildcard          (Super Admin).
 *
 * This is a UX affordance only — the real security boundary is the backend
 * guard on each endpoint. The two must agree, so we reuse this everywhere.
 */

/** Does the effective set satisfy a single required permission? */
export function permissionMatches(
  effective: readonly string[] | undefined | null,
  required: string
): boolean {
  if (!effective || effective.length === 0) return false;
  if (effective.includes("*")) return true;
  if (effective.includes(required)) return true;

  const colon = required.indexOf(":");
  if (colon > -1) {
    const resource = required.slice(0, colon);
    if (effective.includes(`${resource}:*`)) return true;
  }
  return false;
}

/** Does the effective set satisfy ANY of the required permissions? */
export function hasAnyPermission(
  effective: readonly string[] | undefined | null,
  required: readonly string[]
): boolean {
  return required.some((p) => permissionMatches(effective, p));
}

/** Does the effective set satisfy ALL of the required permissions? */
export function hasAllPermissions(
  effective: readonly string[] | undefined | null,
  required: readonly string[]
): boolean {
  return required.every((p) => permissionMatches(effective, p));
}
