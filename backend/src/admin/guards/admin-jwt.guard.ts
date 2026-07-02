import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authenticates admin routes using the `admin-jwt` passport strategy (admin
 * secret + `scope === 'admin'`). The resolved admin document is attached to
 * `request.admin` (kept separate from the user-plane `request.user`).
 */
@Injectable()
export class AdminJwtGuard extends AuthGuard('admin-jwt') {
  handleRequest<TAdmin = any>(
    err: any,
    admin: any,
    _info: any,
    context: ExecutionContext,
  ): TAdmin {
    if (err || !admin) {
      throw (
        err ||
        new UnauthorizedException({
          success: false,
          error: {
            code: 'ADMIN_AUTH_001',
            message: 'Authentication required',
          },
        })
      );
    }
    const request = context.switchToHttp().getRequest();
    request.admin = admin;
    return admin as TAdmin;
  }
}
