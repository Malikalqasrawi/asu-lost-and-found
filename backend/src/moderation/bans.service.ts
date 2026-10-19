import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DAY_MS } from '../common/time.js';
import type { Prisma, Role, User } from '../generated/prisma/client.js';
import { OutboxService } from '../mail/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isBanned, liftBan } from '../users/bans.js';
import { BanDto } from './dto/moderation.dto.js';
import { bannedEmail, unbannedEmail } from './moderation-emails.js';
import { logAction } from './moderation-log.js';

export interface StudentView {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: Date;
  ban: { since: Date; until: Date | null; reason: string } | null;
}

function toStudentView(user: User): StudentView {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
    ban:
      user.bannedAt && isBanned(user)
        ? {
            since: user.bannedAt,
            until: user.bannedUntil,
            reason: user.banReason ?? '',
          }
        : null,
  };
}

/** Access tokens carry their issue time in whole seconds. */
const thisSecond = () => new Date(Math.floor(Date.now() / 1000) * 1000);

@Injectable()
export class BansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async search(query = ''): Promise<StudentView[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(query && {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { fullName: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return users.map(toStudentView);
  }

  /**
   * Signs the student out everywhere and keeps them out until the end date,
   * hides their open posts and closes their waiting claims.
   */
  async ban(
    userId: string,
    adminId: string,
    dto: BanDto,
  ): Promise<StudentView> {
    const user = await this.bannable(userId, adminId);
    const until = dto.days ? new Date(Date.now() + dto.days * DAY_MS) : null;
    const banned = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          bannedAt: now,
          bannedUntil: until,
          banReason: dto.reason,
          tokensValidAfter: thisSecond(),
        },
      });
      await this.closeEverything(tx, user.id, now);
      await logAction(tx, adminId, 'BAN', { studentId: user.id }, dto.reason);
      await this.outbox.enqueue(tx, bannedEmail(user.email, until, dto.reason));
      return updated;
    });
    return toStudentView(banned);
  }

  async unban(userId: string, adminId: string): Promise<StudentView> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('No student has this id.');
    }
    const lifted = await this.prisma.$transaction(async (tx) => {
      await liftBan(tx, user.id);
      await logAction(tx, adminId, 'UNBAN', { studentId: user.id });
      if (isBanned(user)) {
        await this.outbox.enqueue(tx, unbannedEmail(user.email));
      }
      return tx.user.findUniqueOrThrow({ where: { id: user.id } });
    });
    return toStudentView(lifted);
  }

  private async bannable(userId: string, adminId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('No student has this id.');
    }
    if (user.id === adminId || user.role === 'ADMIN') {
      throw new ForbiddenException('Admin accounts cannot be banned.');
    }
    return user;
  }

  private async closeEverything(
    tx: Prisma.TransactionClient,
    userId: string,
    now: Date,
  ): Promise<void> {
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.post.updateMany({
      where: { authorId: userId, status: 'OPEN', hiddenAt: null },
      data: { hiddenAt: now, hideCause: 'BAN' },
    });
    await tx.claim.updateMany({
      where: { claimantId: userId, status: 'PENDING' },
      data: { status: 'CLOSED', decidedAt: now },
    });
  }
}
