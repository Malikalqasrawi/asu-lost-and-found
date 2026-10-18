import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import type { AuthUser } from './auth-user.js';
import { IS_PUBLIC } from './decorators.js';
import { TokensService } from './tokens.service.js';

function bearerToken(header: string | undefined): string | null {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = bearerToken(request.headers.authorization);
    const user = token ? await this.userFor(token) : null;
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return Boolean(
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
  }

  /**
   * The verified user the token belongs to, or null when the token is invalid,
   * the account is gone, or the token was issued before a password reset.
   */
  private async userFor(token: string): Promise<User | null> {
    const claims = await this.tokens.verifyAccessToken(token).catch(() => null);
    if (!claims) {
      return null;
    }
    const user = await this.users.findVerifiedById(claims.sub);
    const issuedAt = (claims.iat ?? 0) * 1000;
    const validAfter = user?.tokensValidAfter?.getTime() ?? 0;
    return user && issuedAt >= validAfter ? user : null;
  }
}
