import { ConflictException, Injectable } from '@nestjs/common';
import { HOUR, MINUTE } from '../common/time.js';
import type { Prisma } from '../generated/prisma/client.js';
import { OutboxService } from '../mail/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  handoverFor,
  type HandoverRole,
  type HandoverWithPeople,
} from './handover-access.js';
import { newMessagesEmail } from './handover-emails.js';
import { toMessageView, type MessageView } from './handover-view.js';

const MESSAGES_SHOWN = 200;

const readNow = (role: HandoverRole, now: Date) =>
  role === 'FINDER' ? { finderReadAt: now } : { ownerReadAt: now };

/**
 * Someone who has had the chat open in the last few minutes is reading along,
 * and someone who hasn't opened it since the last email already knows.
 */
function wantsEmail(
  handover: HandoverWithPeople,
  recipient: HandoverRole,
  now: Date,
) {
  const readAt =
    recipient === 'FINDER' ? handover.finderReadAt : handover.ownerReadAt;
  const emailedAt =
    recipient === 'FINDER' ? handover.finderEmailedAt : handover.ownerEmailedAt;
  const away = now.getTime() - readAt.getTime() > 5 * MINUTE;
  return away && (!emailedAt || readAt > emailedAt);
}

/** Nobody gets more than one email an hour about the same chat. */
function notEmailedSince(
  recipient: HandoverRole,
  since: Date,
): Prisma.HandoverWhereInput {
  return recipient === 'FINDER'
    ? { OR: [{ finderEmailedAt: null }, { finderEmailedAt: { lt: since } }] }
    : { OR: [{ ownerEmailedAt: null }, { ownerEmailedAt: { lt: since } }] };
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  /** The latest messages, oldest first. Reading them marks the chat as read. */
  async list(postId: string, viewerId: string): Promise<MessageView[]> {
    const { handover, role } = await handoverFor(this.prisma, postId, viewerId);
    const [messages] = await Promise.all([
      this.prisma.message.findMany({
        where: { handoverId: handover.claimId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MESSAGES_SHOWN,
      }),
      this.prisma.handover.update({
        where: { claimId: handover.claimId },
        data: readNow(role, new Date()),
      }),
    ]);
    return messages
      .reverse()
      .map((message) => toMessageView(message, viewerId));
  }

  async send(
    postId: string,
    senderId: string,
    text: string,
  ): Promise<MessageView> {
    const { handover, role } = await handoverFor(this.prisma, postId, senderId);
    if (handover.returnedAt) {
      throw new ConflictException(
        'This item was already handed over, so the chat is closed.',
      );
    }
    const message = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const created = await tx.message.create({
        data: { handoverId: handover.claimId, senderId, text, createdAt: now },
      });
      await tx.handover.update({
        where: { claimId: handover.claimId },
        data: { ...readNow(role, now), lastActivityAt: now },
      });
      await this.emailRecipient(tx, handover, role, now);
      return created;
    });
    return toMessageView(message, senderId);
  }

  private async emailRecipient(
    tx: Prisma.TransactionClient,
    handover: HandoverWithPeople,
    senderRole: HandoverRole,
    now: Date,
  ): Promise<void> {
    const recipient: HandoverRole =
      senderRole === 'FINDER' ? 'OWNER' : 'FINDER';
    if (!wantsEmail(handover, recipient, now)) {
      return;
    }
    // Claiming the email with a conditional update means two messages sent
    // at the same moment still send one email.
    const claimed = await tx.handover.updateMany({
      where: {
        claimId: handover.claimId,
        ...notEmailedSince(recipient, new Date(now.getTime() - HOUR)),
      },
      data:
        recipient === 'FINDER'
          ? { finderEmailedAt: now }
          : { ownerEmailedAt: now },
    });
    if (claimed.count === 0) {
      return;
    }
    const to =
      recipient === 'FINDER' ? handover.finder.email : handover.owner.email;
    await this.outbox.enqueue(tx, newMessagesEmail(to, handover.post.title));
  }
}
