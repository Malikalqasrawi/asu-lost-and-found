import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { canView } from '../posts/post-visibility.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportDto } from './dto/moderation.dto.js';

/** Students report what they can see: a post, or a message sent to them. */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async reportPost(
    postId: string,
    reporterId: string,
    dto: ReportDto,
  ): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || !canView(post, reporterId) || post.authorId === reporterId) {
      throw new NotFoundException('This post does not exist or was closed.');
    }
    await this.save({
      reporterId,
      postId,
      reason: dto.reason,
      details: dto.details,
    });
  }

  async reportMessage(
    messageId: string,
    reporterId: string,
    dto: ReportDto,
  ): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { handover: { select: { finderId: true, ownerId: true } } },
    });
    const { finderId, ownerId } = message?.handover ?? {};
    const sentToReporter =
      message?.senderId !== reporterId &&
      (finderId === reporterId || ownerId === reporterId);
    if (!message || !sentToReporter) {
      throw new NotFoundException('This message does not exist.');
    }
    await this.save({
      reporterId,
      messageId,
      reason: dto.reason,
      details: dto.details,
    });
  }

  private async save(data: Prisma.ReportUncheckedCreateInput): Promise<void> {
    try {
      await this.prisma.report.create({ data });
    } catch (error) {
      const twice =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';
      if (twice) {
        throw new ConflictException('You already reported this.');
      }
      throw error;
    }
  }
}
