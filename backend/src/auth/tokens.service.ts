import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isBanned } from '../users/bans.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;
/** An admin website session ends a working day after sign-in, whatever happens. */
export const ADMIN_REFRESH_TOKEN_TTL_MS = 12 * 60 * 60_000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  /** Issued by the admin website after the emailed code. */
  admin?: true;
  iat?: number;
}

interface IssueOptions {
  db?: Prisma.TransactionClient;
  familyId?: string;
  adminSession?: boolean;
  /** Keeps a session's end where it was when a refresh token is swapped. */
  expiresAt?: Date;
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
    {
      db = this.prisma,
      familyId = randomUUID(),
      adminSession = false,
      expiresAt,
    }: IssueOptions = {},
  ): Promise<TokenPair> {
    const claims: AccessTokenClaims = {
      sub: user.id,
      role: user.role,
      ...(adminSession ? { admin: true } : {}),
    };
    const accessToken = await this.jwt.signAsync(claims);
    const refreshToken = randomBytes(32).toString('base64url');
    const lifetime = adminSession
      ? ADMIN_REFRESH_TOKEN_TTL_MS
      : REFRESH_TOKEN_TTL_MS;

    await db.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: expiresAt ?? new Date(Date.now() + lifetime),
        adminSession,
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
   * App and admin website sessions only ever refresh as what they are.
   */
  async rotate(refreshToken: string, adminSession = false): Promise<TokenPair> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (
      !stored ||
      stored.expiresAt <= new Date() ||
      stored.adminSession !== adminSession
    ) {
      throw invalidRefreshToken();
    }
    const noLongerAdmin = adminSession && stored.user.role !== 'ADMIN';
    if (stored.revokedAt || isBanned(stored.user) || noLongerAdmin) {
      await this.revokeFamily(stored.familyId);
      throw invalidRefreshToken();
    }

    const pair = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return count === 1
        ? this.issue(stored.user, {
            db: tx,
            familyId: stored.familyId,
            adminSession,
            // An admin website session ends 12 hours after the code was
            // typed, however often it refreshes.
            expiresAt: adminSession ? stored.expiresAt : undefined,
          })
        : null;
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
