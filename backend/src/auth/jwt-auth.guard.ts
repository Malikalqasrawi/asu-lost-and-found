import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User } from '../generated/prisma/client.js';
import { isBanned } from '../users/bans.js';
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
    const signedIn = token ? await this.userFor(token) : null;
    if (!signedIn) {
      throw new UnauthorizedException();
    }

    const { user, adminSession } = signedIn;
    request.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      adminSession,
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
   * the account is gone or banned, or the token was issued before a password
   * reset or a ban.
   */
  private async userFor(
    token: string,
  ): Promise<{ user: User; adminSession: boolean } | null> {
    const claims = await this.tokens.verifyAccessToken(token).catch(() => null);
    if (!claims) {
      return null;
    }
    const user = await this.users.findVerifiedById(claims.sub);
    const issuedAt = (claims.iat ?? 0) * 1000;
    const validAfter = user?.tokensValidAfter?.getTime() ?? 0;
    if (!user || issuedAt < validAfter || isBanned(user)) {
      return null;
    }
    return { user, adminSession: claims.admin === true };
  }
}
