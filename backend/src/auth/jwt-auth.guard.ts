import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UsersService } from '../users/users.service.js';
import type { AuthUser } from './auth-user.js';
import { IS_PUBLIC } from './decorators.js';
import { TokensService } from './tokens.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    const claims = await this.tokens.verifyAccessToken(token).catch(() => null);
    const user = claims ? await this.users.findVerifiedById(claims.sub) : null;
    const issuedAt = (claims?.iat ?? 0) * 1000;
    if (!user || issuedAt < (user.tokensValidAfter?.getTime() ?? 0)) {
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
}
