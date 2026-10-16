import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../generated/prisma/client.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(role: Role | undefined): ExecutionContext {
  const user = role
    ? { id: 'u1', email: 'a@asu.edu.jo', fullName: 'A', role }
    : undefined;
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: Role[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: () => roles } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('lets anyone through when the endpoint names no roles', () => {
    expect(guardRequiring(undefined).canActivate(contextFor('STUDENT'))).toBe(
      true,
    );
  });

  it('lets a user with a listed role through', () => {
    expect(
      guardRequiring(['SECURITY', 'ADMIN']).canActivate(contextFor('SECURITY')),
    ).toBe(true);
  });

  it('answers 403 for a user without a listed role', () => {
    expect(() =>
      guardRequiring(['ADMIN']).canActivate(contextFor('STUDENT')),
    ).toThrow(ForbiddenException);
  });

  it('answers 403 when nobody is signed in', () => {
    expect(() =>
      guardRequiring(['ADMIN']).canActivate(contextFor(undefined)),
    ).toThrow(ForbiddenException);
  });
});
