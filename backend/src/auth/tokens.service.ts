import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  iat?: number;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function invalidRefreshToken(): UnauthorizedException {
  return new UnauthorizedException('Your session has ended. Sign in again.');
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issue(
    user: { id: string; role: Role },
    db: Prisma.TransactionClient = this.prisma,
    familyId: string = randomUUID(),
  ): Promise<TokenPair> {
    const claims: AccessTokenClaims = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(claims);
    const refreshToken = randomBytes(32).toString('base64url');

    await db.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    return this.jwt.verifyAsync<AccessTokenClaims>(token);
  }

  /**
   * Swaps a refresh token for a new pair. A token that was already swapped
   * means it was copied, so the whole sign-in (every token in its family) ends.
   */
  async rotate(refreshToken: string): Promise<TokenPair> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!stored || stored.expiresAt <= new Date()) {
      throw invalidRefreshToken();
    }
    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      throw invalidRefreshToken();
    }

    const pair = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return count === 1 ? this.issue(stored.user, tx, stored.familyId) : null;
    });
    if (!pair) {
      await this.revokeFamily(stored.familyId);
      throw invalidRefreshToken();
    }
    return pair;
  }

  async revoke(refreshToken: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (stored) {
      await this.revokeFamily(stored.familyId);
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
