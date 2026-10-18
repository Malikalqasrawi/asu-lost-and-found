import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/client.js';
import type { AuthUser } from './auth-user.js';
import { ROLES } from './decorators.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException();
    }
    // Admin powers need the admin website's sign-in with the emailed code,
    // not just an admin's password typed into the app.
    if (user.role === 'ADMIN' && !user.adminSession) {
      throw new ForbiddenException({
        message: 'Sign in on the admin website to do this.',
        code: 'ADMIN_SESSION_REQUIRED',
      });
    }
    return true;
  }
}
