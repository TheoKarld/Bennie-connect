import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AdminUserDocument } from '../schemas/admin-user.schema';
import { MUST_CHANGE_PASSWORD_EXEMPT_PATHS } from '../admin.constants';

/**
 * While an admin's `mustChangePassword` flag is set, blocks every admin route
 * except `/auth/me`, `/auth/change-password`, and `/auth/logout` with
 * 403 ADMIN_AUTH_007. Runs after AdminJwtGuard (reads `request.admin`).
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const admin: AdminUserDocument | undefined = request.admin;

    if (!admin || !admin.mustChangePassword) {
      return true;
    }

    // Exempt the change-password flow itself (paths under /admin/auth/*).
    const path: string = (request.path || request.url || '').split('?')[0];
    const isExempt = MUST_CHANGE_PASSWORD_EXEMPT_PATHS.some((p) =>
      path.endsWith(`/auth/${p}`),
    );
    if (isExempt) {
      return true;
    }

    throw new ForbiddenException({
      success: false,
      error: {
        code: 'ADMIN_AUTH_007',
        message: 'Password change required',
      },
    });
  }
}
