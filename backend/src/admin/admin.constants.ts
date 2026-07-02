/**
 * Shared constants for the admin plane: cookie names, the Super Admin role
 * name, the seed super-admin credentials, and the non-delegable
 * Super-Admin-only permission set.
 */

export const ADMIN_REFRESH_COOKIE = 'bennie_admin_rt';
export const ADMIN_COOKIE_PATH = '/api/v1/admin/auth';

export const SUPER_ADMIN_ROLE_NAME = 'Super Admin';
export const SEED_SUPER_ADMIN_EMAIL = 'superadmin@bennieconnect.com';
export const SEED_SUPER_ADMIN_PASSWORD = 'Bennie-2026';

/**
 * Routes exempt from the mustChangePassword gate (paths relative to the admin
 * auth controller, i.e. `/api/v1/admin/auth/*`).
 */
export const MUST_CHANGE_PASSWORD_EXEMPT_PATHS = [
  'me',
  'change-password',
  'logout',
];

/**
 * Financial-reversal & destructive permissions reserved for the Super Admin
 * (`*`) role only. These are NOT delegable via role assignment or per-admin
 * override — the PermissionsGuard treats them as satisfiable ONLY by an
 * effective set containing `*`. `any *:delete` and `any *:ban` are handled by
 * action-suffix matching in the guard rather than being enumerated here.
 */
export const SUPER_ADMIN_ONLY_PERMISSIONS = new Set<string>([
  'transactions:reverse',
  'orders:refund',
  'equipment:settle-deposit',
  'adashe-contributions:process-payout',
  'dividends:distribute',
  'commissions:pay-batch',
  'agent-commission:reverse',
  'savings-plans:configure',
  'settings:configure',
  'users:impersonate',
]);

/** Action suffixes that are Super-Admin-only regardless of resource. */
export const SUPER_ADMIN_ONLY_ACTIONS = new Set<string>(['delete', 'ban']);

/**
 * True when a permission string is reserved for Super Admin only (non-delegable).
 */
export function isSuperAdminOnlyPermission(permission: string): boolean {
  if (SUPER_ADMIN_ONLY_PERMISSIONS.has(permission)) {
    return true;
  }
  const action = permission.split(':')[1];
  return action ? SUPER_ADMIN_ONLY_ACTIONS.has(action) : false;
}
