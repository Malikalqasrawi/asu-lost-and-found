import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import type { Prisma } from '../generated/prisma/client.js';
import { OutboxService } from '../mail/outbox.service.js';
import { lockPost } from '../prisma/locks.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  chatPreviews,
  HANDOVER_INCLUDE,
  handoverFor,
  MAX_WRONG_CODES,
  newPickupCode,
  unreadCount,
  type HandoverWithPeople,
} from './handover-access.js';
import { pickedUpEmail } from './handover-emails.js';
import {
  toHandoverSummary,
  toHandoverView,
  type HandoverSummary,
  type HandoverView,
} from './handover-view.js';

const alreadyReturned = () =>
  new ConflictException('This item was already handed over.');

const codeLocked = () =>
  new ForbiddenException({
    message: 'Too many wrong codes. The owner can get a new code in the app.',
    code: 'CODE_LOCKED',
  });

/**
 * The finder hands the item over, unless it is at the security office: then
 * only security staff can, after checking the owner's student ID.
 */
function checkCanHandOver(
  handover: HandoverWithPeople | null,
  viewer: AuthUser,
): asserts handover is HandoverWithPeople {
  const atDesk = handover?.post.deskItem?.status === 'AT_DESK';
  if (handover && atDesk && viewer.role === 'SECURITY') {
    if (viewer.id === handover.ownerId) {
      throw new ForbiddenException(
        'Another member of staff has to hand over your own item.',
      );
    }
    return;
  }
  if (handover?.finderId !== viewer.id) {
    throw new NotFoundException('This handover does not exist.');
  }
  if (atDesk) {
    throw new ForbiddenException(
      'The item is at the security office. The owner picks it up there.',
    );
  }
}

@Injectable()
export class HandoversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async view(postId: string, viewerId: string): Promise<HandoverView> {
    const { handover, role } = await handoverFor(this.prisma, postId, viewerId);
    const unread = await unreadCount(this.prisma, handover, role);
    return toHandoverView(handover, role, unread);
  }

  /** Every handover the student is part of, the most recent activity first. */
  async mine(viewerId: string): Promise<HandoverSummary[]> {
    const handovers = await this.prisma.handover.findMany({
      where: { OR: [{ finderId: viewerId }, { ownerId: viewerId }] },
      include: HANDOVER_INCLUDE,
      orderBy: { lastActivityAt: 'desc' },
      take: 50,
    });
    const previews = await chatPreviews(
      this.prisma,
      handovers.map((handover) => handover.claimId),
      viewerId,
    );
    return handovers.map((handover) =>
      toHandoverSummary(
        handover,
        handover.finderId === viewerId ? 'FINDER' : 'OWNER',
        viewerId,
        previews.get(handover.claimId) ?? { lastMessage: null, unread: 0 },
      ),
    );
  }

  /** The owner can replace a code that was locked after too many wrong tries. */
  async newCode(postId: string, viewerId: string): Promise<HandoverView> {
    const { handover, role } = await handoverFor(this.prisma, postId, viewerId);
    if (role !== 'OWNER') {
      throw new NotFoundException('This handover does not exist.');
    }
    if (handover.returnedAt) {
      throw alreadyReturned();
    }
    if (handover.wrongCodes < MAX_WRONG_CODES) {
      throw new ConflictException('Your code still works.');
    }
    const updated = await this.prisma.handover.update({
      where: { claimId: handover.claimId },
      data: { pickupCode: newPickupCode(), wrongCodes: 0 },
      include: HANDOVER_INCLUDE,
    });
    return toHandoverView(updated, role, 0);
  }

  /**
   * Everything is checked under the item's lock, so guesses sent at the same
   * moment are counted one by one and still stop after 5.
   */
  async confirmReturn(
    postId: string,
    viewer: AuthUser,
    code: string,
  ): Promise<void> {
    const triesLeft = await this.prisma.$transaction(async (tx) => {
      await lockPost(tx, postId);
      const handover = await tx.handover.findUnique({
        where: { postId },
        include: HANDOVER_INCLUDE,
      });
      checkCanHandOver(handover, viewer);
      if (handover.returnedAt) {
        throw alreadyReturned();
      }
      if (handover.wrongCodes >= MAX_WRONG_CODES) {
        throw codeLocked();
      }
      if (code !== handover.pickupCode) {
        await tx.handover.update({
          where: { claimId: handover.claimId },
          data: { wrongCodes: { increment: 1 } },
        });
        return MAX_WRONG_CODES - handover.wrongCodes - 1;
      }
      await this.markReturned(tx, handover, viewer);
      return null;
    });
    // Thrown after the commit, so the wrong try stays counted.
    if (triesLeft !== null) {
      throw new BadRequestException(
        `That code is not right. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left.`,
      );
    }
  }

  private async markReturned(
    tx: Prisma.TransactionClient,
    handover: HandoverWithPeople,
    viewer: AuthUser,
  ): Promise<void> {
    const returned = await tx.post.updateMany({
      where: { id: handover.postId, status: 'CLAIMED' },
      data: { status: 'RETURNED' },
    });
    if (returned.count === 0) {
      throw alreadyReturned();
    }
    await tx.handover.update({
      where: { claimId: handover.claimId },
      data: { returnedAt: new Date(), returnedById: viewer.id },
    });
    // Handed over before it reached the desk, the desk no longer expects it;
    // handed over at the desk, it stays on record as picked up.
    await tx.deskItem.deleteMany({
      where: { postId: handover.postId, status: 'ON_THE_WAY' },
    });
    await tx.deskItem.updateMany({
      where: { postId: handover.postId, status: 'AT_DESK' },
      data: { status: 'PICKED_UP' },
    });
    if (viewer.id !== handover.finderId) {
      await this.outbox.enqueue(
        tx,
        pickedUpEmail(handover.finder.email, handover.post.title),
      );
    }
  }
}
