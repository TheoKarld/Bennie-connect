import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AdminUserDocument } from '../schemas/admin-user.schema';
import { AdminPermissionsService } from '../admin-permissions.service';
import { hasPermission } from '../permissions.util';

/**
 * Runs after AdminJwtGuard. Reads @RequirePermissions('resource:action'),
 * resolves the admin's effective permissions, and allows only if every required
 * permission is satisfied (exact / `resource:*` / `*`). Super-Admin-only
 * reserved permissions are satisfiable only by `*`.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: AdminPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const admin: AdminUserDocument | undefined = request.admin;

    if (!admin) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'ADMIN_AUTH_006',
          message: 'Insufficient permission',
        },
      });
    }

    const effective =
      await this.permissionsService.getEffectivePermissions(admin);

    const satisfied = required.every((perm) => hasPermission(effective, perm));

    if (!satisfied) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'ADMIN_AUTH_006',
          message: 'Insufficient permission',
        },
      });
    }

    return true;
  }
}
