import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { EnvironmentVariables } from '../config/env.validation.js';
import type { EmailCodePurpose, Prisma } from '../generated/prisma/client.js';
import { lastDay } from '../common/time.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const CODE_TTL_MS = 15 * 60_000;
export const MAX_CODE_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60_000;
// Per account and purpose, across all codes. Without these a new code every
// minute would give an attacker 5 fresh guesses each time.
export const MAX_CODES_PER_DAY = 5;
export const MAX_GUESSES_PER_DAY = 15;

/** When an email with a code just issued stops being worth sending. */
export const codeExpiry = () => new Date(Date.now() + CODE_TTL_MS);

function sameHash(a: string, b: string): boolean {
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

@Injectable()
export class EmailCodesService {
  private readonly key: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.key = `${config.get('JWT_SECRET', { infer: true })}:email-codes`;
  }

  /**
   * Keyed, because a plain hash of one of a million codes is reversed in
   * milliseconds by anyone who reads the table.
   */
  private hashCode(code: string): string {
    return createHmac('sha256', this.key).update(code).digest('hex');
  }

  /**
   * Creates a new 6-digit code and expires the older ones. Returns null when
   * the last code is less than a minute old or the daily limit is reached.
   */
  async issue(
    db: Prisma.TransactionClient,
    userId: string,
    purpose: EmailCodePurpose,
  ): Promise<string | null> {
    const latest = await db.emailCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      return null;
    }
    const issuedToday = await db.emailCode.count({
      where: { userId, purpose, createdAt: lastDay() },
    });
    if (issuedToday >= MAX_CODES_PER_DAY) {
      return null;
    }

    await db.emailCode.updateMany({
      where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await db.emailCode.create({
      data: {
        userId,
        purpose,
        codeHash: this.hashCode(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    return code;
  }

  /**
   * Every guess, right or wrong, uses up one attempt before the code is
   * compared, so parallel requests can't get more than MAX_CODE_ATTEMPTS tries.
   */
  async consume(
    userId: string,
    purpose: EmailCodePurpose,
    code: string,
  ): Promise<boolean> {
    const current = await this.prisma.emailCode.findFirst({
      where: { userId, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!current || current.expiresAt <= new Date()) {
      return false;
    }
    const today = await this.prisma.emailCode.aggregate({
      where: { userId, purpose, createdAt: lastDay() },
      _sum: { attempts: true },
    });
    if ((today._sum.attempts ?? 0) >= MAX_GUESSES_PER_DAY) {
      return false;
    }

    const attempt = await this.prisma.emailCode.updateMany({
      where: {
        id: current.id,
        usedAt: null,
        attempts: { lt: MAX_CODE_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });
    if (
      attempt.count === 0 ||
      !sameHash(current.codeHash, this.hashCode(code))
    ) {
      return false;
    }

    const used = await this.prisma.emailCode.updateMany({
      where: { id: current.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return used.count === 1;
  }
}
