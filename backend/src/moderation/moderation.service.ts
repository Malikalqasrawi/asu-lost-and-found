import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, ReportStatus } from '../generated/prisma/client.js';
import { ClaimsService } from '../claims/claims.service.js';
import { OutboxService } from '../mail/outbox.service.js';
import { lockPost } from '../prisma/locks.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isBanned } from '../users/bans.js';
import { claimRemovedEmail, postHiddenEmail } from './moderation-emails.js';
import {
  LOG_INCLUDE,
  logAction,
  toLogEntryView,
  type LogEntryView,
} from './moderation-log.js';
import { REPORT_INCLUDE, toCases, type ReportCase } from './report-cases.js';

type Settled = Exclude<ReportStatus, 'OPEN'>;

/** What admins do with reports: hide or restore posts, remove messages, or dismiss. */
@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly claims: ClaimsService,
  ) {}

  async cases(status: ReportStatus = 'OPEN'): Promise<ReportCase[]> {
    const reports = await this.prisma.report.findMany({
      where: { status },
      include: REPORT_INCLUDE,
      orderBy: { createdAt: status === 'OPEN' ? 'asc' : 'desc' },
      take: 500,
    });
    return toCases(reports);
  }

  /**
   * Hidden from everyone but its author, also after a ban on the author ends.
   * Its waiting claims close and the open reports on it are resolved.
   */
  async hidePost(postId: string, adminId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockPost(tx, postId);
      const post = await tx.post.findUnique({
        where: { id: postId },
        include: { author: { select: { email: true } } },
      });
      if (!post) {
        throw new NotFoundException('This post does not exist.');
      }
      await tx.post.update({
        where: { id: postId },
        data: {
          hiddenAt: post.hiddenAt ?? new Date(),
          hideCause: 'MODERATION',
        },
      });
      if (!post.hiddenAt) {
        await this.outbox.enqueue(
          tx,
          postHiddenEmail(post.author.email, post.title),
        );
      }
      await this.claims.closeForPost(tx, postId, post.title, claimRemovedEmail);
      await settle(tx, { postId }, 'RESOLVED', adminId);
      await logAction(tx, adminId, 'HIDE_POST', { postId });
    });
  }

  /**
   * Brings back a post a moderator hid. While its author is banned it stays
   * hidden by the ban instead, and comes back when the ban ends.
   */
  async restorePost(postId: string, adminId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        include: { author: true },
      });
      if (post?.hideCause !== 'MODERATION') {
        throw new NotFoundException(
          'No post hidden by a moderator has this id.',
        );
      }
      await tx.post.update({
        where: { id: postId },
        data: isBanned(post.author)
          ? { hideCause: 'BAN' }
          : { hiddenAt: null, hideCause: null },
      });
      await logAction(tx, adminId, 'RESTORE_POST', { postId });
    });
  }

  async removeMessage(messageId: string, adminId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.message.updateMany({
        where: { id: messageId },
        data: { removedAt: new Date() },
      });
      if (removed.count === 0) {
        throw new NotFoundException('This message does not exist.');
      }
      await settle(tx, { messageId }, 'RESOLVED', adminId);
      await logAction(tx, adminId, 'REMOVE_MESSAGE', { messageId });
    });
  }

  /** Nothing wrong with it: the open reports are closed without a change. */
  async dismiss(
    target: { postId: string } | { messageId: string },
    adminId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const settled = await settle(tx, target, 'DISMISSED', adminId);
      if (settled === 0) {
        throw new NotFoundException('There are no open reports about this.');
      }
      await logAction(tx, adminId, 'DISMISS_REPORTS', target);
    });
  }

  async log(): Promise<LogEntryView[]> {
    const entries = await this.prisma.moderationLog.findMany({
      include: LOG_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return entries.map(toLogEntryView);
  }
}

async function settle(
  db: Prisma.TransactionClient,
  target: { postId: string } | { messageId: string },
  status: Settled,
  adminId: string,
): Promise<number> {
  const { count } = await db.report.updateMany({
    where: { ...target, status: 'OPEN' },
    data: { status, resolvedById: adminId, resolvedAt: new Date() },
  });
  return count;
}
