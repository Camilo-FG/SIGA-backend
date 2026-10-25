import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PublicUser } from '../../../users/users.service.js';

/** Injects the authenticated user attached to the request by the JWT strategy. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: PublicUser }>();
    return request.user;
  },
);
