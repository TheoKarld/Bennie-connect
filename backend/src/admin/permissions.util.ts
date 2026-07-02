import { isSuperAdminOnlyPermission } from './admin.constants';

/**
 * Compute effective permissions:  (role.permissions ∪ granted) \ revoked.
 * Returns the raw effective set (may contain `*` and `resource:*` wildcards).
 */
export function resolveEffectivePermissions(
  rolePermissions: string[] = [],
  granted: string[] = [],
  revoked: string[] = [],
): string[] {
  const revokedSet = new Set(revoked);
  const effective = new Set<string>();
  for (const p of [...rolePermissions, ...granted]) {
    if (!revokedSet.has(p)) {
      effective.add(p);
    }
  }
  return [...effective];
}

/**
 * True when the effective permission set satisfies the required permission via
 * exact / `resource:*` / `*` matching.
 *
 * Super-Admin-only (non-delegable) permissions are satisfiable ONLY by an
 * effective set containing `*` — an explicitly-granted reserved permission on a
 * non-`*` set does NOT satisfy the check.
 */
export function hasPermission(effective: string[], required: string): boolean {
  const set = new Set(effective);

  // `*` always satisfies everything.
  if (set.has('*')) {
    return true;
  }

  // Reserved (non-delegable) permissions require `*` — which we already ruled
  // out above.
  if (isSuperAdminOnlyPermission(required)) {
    return false;
  }

  if (set.has(required)) {
    return true;
  }

  const resource = required.split(':')[0];
  return set.has(`${resource}:*`);
}
