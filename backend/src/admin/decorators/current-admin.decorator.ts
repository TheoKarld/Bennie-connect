import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated admin (attached by AdminJwtStrategy.validate) from
 * the request. Optionally pass a property name to pull a single field.
 */
export const CurrentAdmin = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const admin = request.admin;
    return data ? admin?.[data] : admin;
  },
);
