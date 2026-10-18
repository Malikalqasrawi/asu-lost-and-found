import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Category,
  DeskStatus,
  Prisma,
} from '../generated/prisma/client.js';
import { OutboxService } from '../mail/outbox.service.js';
import { lockPost } from '../prisma/locks.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { atDeskEmail, handedInEmail } from './handover-emails.js';

const DESK_ITEM_INCLUDE = {
  post: {
    select: {
      title: true,
      category: true,
      happenedOn: true,
      place: { select: { name: true } },
      photos: { orderBy: { position: 'asc' }, select: { id: true } },
      author: { select: { fullName: true, email: true } },
      handover: {
        select: { returnedAt: true, owner: { select: { fullName: true } } },
      },
    },
  },
} as const satisfies Prisma.DeskItemInclude;

type DeskItemWithPost = Prisma.DeskItemGetPayload<{
  include: typeof DESK_ITEM_INCLUDE;
}>;

/** What the security office sees: enough to find the item and check who picks it up. */
export interface DeskItemView {
  postId: string;
  status: DeskStatus;
  title: string;
  category: Category;
  place: string;
  happenedOn: string;
  photoIds: string[];
  finder: { fullName: string; email: string };
  /** The student whose claim was accepted, to compare with their student ID. */
  owner: { fullName: string } | null;
  handedInAt: Date;
  receivedAt: Date | null;
}

function toDeskItemView(item: DeskItemWithPost): DeskItemView {
  const { post } = item;
  // The owner's name is only needed once the desk has the item to give them.
  const handover =
    item.status === 'AT_DESK' && !post.handover?.returnedAt
      ? post.handover
      : null;
  return {
    postId: item.postId,
    status: item.status,
    title: post.title,
    category: post.category,
    place: post.place.name,
    happenedOn: post.happenedOn.toISOString().slice(0, 10),
    photoIds: post.photos.map((photo) => photo.id),
    finder: post.author,
    owner: handover ? { fullName: handover.owner.fullName } : null,
    handedInAt: item.createdAt,
    receivedAt: item.receivedAt,
  };
}

const notFound = () =>
  new NotFoundException('This item does not exist or was closed.');

@Injectable()
export class DeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  /** The finder says they are taking the item to the security office. */
  async handIn(postId: string, finderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockPost(tx, postId);
      const post = await tx.post.findUnique({
        where: { id: postId },
        include: { deskItem: true },
      });
      if (!post || post.authorId !== finderId || post.type !== 'FOUND') {
        throw notFound();
      }
      if (post.status !== 'OPEN' && post.status !== 'CLAIMED') {
        throw new ConflictException(
          'Only open or claimed items can go to the security office.',
        );
      }
      if (post.deskItem) {
        throw new ConflictException(
          'This item is already going to the security office.',
        );
      }
      await tx.deskItem.create({ data: { postId } });
    });
  }

  /** Changing their mind is fine until the office has the item. */
  async cancel(postId: string, finderId: string): Promise<void> {
    const removed = await this.prisma.deskItem.deleteMany({
      where: { postId, status: 'ON_THE_WAY', post: { authorId: finderId } },
    });
    if (removed.count > 0) {
      return;
    }
    const atDesk = await this.prisma.deskItem.count({
      where: { postId, post: { authorId: finderId } },
    });
    if (atDesk) {
      throw new ConflictException('The security office already has this item.');
    }
    throw notFound();
  }

  async list(status: DeskStatus): Promise<DeskItemView[]> {
    const items = await this.prisma.deskItem.findMany({
      where: { status, post: { status: { in: ['OPEN', 'CLAIMED'] } } },
      include: DESK_ITEM_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return items.map(toDeskItemView);
  }

  async receive(postId: string, staffId: string): Promise<DeskItemView> {
    await this.prisma.$transaction(async (tx) => {
      await lockPost(tx, postId);
      const received = await tx.deskItem.updateMany({
        where: {
          postId,
          status: 'ON_THE_WAY',
          post: { status: { in: ['OPEN', 'CLAIMED'] } },
        },
        data: {
          status: 'AT_DESK',
          receivedAt: new Date(),
          receivedById: staffId,
        },
      });
      if (received.count === 0) {
        throw new NotFoundException(
          'This item is not on its way to the security office.',
        );
      }
      await this.emailReceived(tx, postId);
    });
    const item = await this.prisma.deskItem.findUniqueOrThrow({
      where: { postId },
      include: DESK_ITEM_INCLUDE,
    });
    return toDeskItemView(item);
  }

  private async emailReceived(
    tx: Prisma.TransactionClient,
    postId: string,
  ): Promise<void> {
    const post = await tx.post.findUniqueOrThrow({
      where: { id: postId },
      select: {
        title: true,
        author: { select: { email: true } },
        handover: { select: { owner: { select: { email: true } } } },
      },
    });
    await this.outbox.enqueue(tx, handedInEmail(post.author.email, post.title));
    if (post.handover) {
      await this.outbox.enqueue(
        tx,
        atDeskEmail(post.handover.owner.email, post.title),
      );
    }
  }
}
