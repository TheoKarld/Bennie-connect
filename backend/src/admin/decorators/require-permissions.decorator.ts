import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions';

/**
 * Declares the permission(s) required to invoke an admin route. Enforced by
 * PermissionsGuard against the admin's effective permission set. All listed
 * permissions must be satisfied (AND semantics).
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
