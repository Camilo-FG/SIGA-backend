import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(requiredRoles: string[] | undefined, user?: { role: Role }) {
  const handler = () => undefined;
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as never;
  const context = {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
  return { guard: new RolesGuard(reflector), context };
}

describe('RolesGuard', () => {
  it('allows routes without role metadata', () => {
    const { guard, context } = contextFor(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a user with a required role', () => {
    const { guard, context } = contextFor([Role.DIRECTOR_GENERAL], { role: Role.DIRECTOR_GENERAL });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a user without a required role', () => {
    const { guard, context } = contextFor([Role.DIRECTOR_GENERAL], { role: Role.PROFESOR });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects an unauthenticated request with role metadata', () => {
    const { guard, context } = contextFor([Role.DIRECTOR_GENERAL]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
