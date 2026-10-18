import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { OutboxService } from '../mail/outbox.service.js';
import { lockPost } from '../prisma/locks.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { startHandover } from '../handovers/handover-access.js';
import { atDeskEmail } from '../handovers/handover-emails.js';
import type { MailMessage } from '../mail/mail-sender.js';
import {
  claimAcceptedEmail,
  claimClosedEmail,
  claimRejectedEmail,
  newClaimEmail,
  postClosedEmail,
} from './claim-emails.js';
import {
  FINDER_CLAIM_INCLUDE,
  FinderClaimView,
  MY_CLAIM_INCLUDE,
  MyClaimView,
  toFinderClaimView,
  toMyClaimView,
} from './claim-view.js';
import { AnswerDto, CreateClaimDto } from './dto/claim.dto.js';
import { SerialHasher } from './serial.js';

/** Claims a student gets per item; rejected and withdrawn ones both count. */
export const MAX_CLAIMS = 3;

export interface ClaimForm {
  questions: { id: string; text: string }[];
  serialRequired: boolean;
  attemptsLeft: number;
  activeClaim: MyClaimView | null;
}

export interface FinderClaims {
  privateNotes: string;
  questions: string[];
  hasSerial: boolean;
  claims: FinderClaimView[];
}

const notFound = () =>
  new NotFoundException('This item does not exist or was closed.');
const alreadyDecided = () =>
  new ConflictException('This claim was already decided.');

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function checkAnswers(questionIds: string[], answers: AnswerDto[]): void {
  const given = answers.map((item) => item.questionId);
  const everyQuestionOnce =
    given.length === questionIds.length &&
    new Set(given).size === given.length &&
    given.every((id) => questionIds.includes(id));
  if (!everyQuestionOnce) {
    throw new BadRequestException('Answer every question once.');
  }
}

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly serials: SerialHasher,
  ) {}

  /** What a student needs to claim a found item, and their own claim if they have one. */
  async claimForm(postId: string, viewerId: string): Promise<ClaimForm> {
    const post = await this.claimablePost(postId, viewerId);
    const [used, active] = await Promise.all([
      this.usedClaims(this.prisma, postId, viewerId),
      this.prisma.claim.findFirst({
        where: {
          postId,
          claimantId: viewerId,
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
        include: MY_CLAIM_INCLUDE,
      }),
    ]);
    return {
      questions: post.questions.map(({ id, text }) => ({ id, text })),
      serialRequired: Boolean(post.secret?.serialHash),
      attemptsLeft: Math.max(0, MAX_CLAIMS - used),
      activeClaim: active ? toMyClaimView(active) : null,
    };
  }

  async create(
    postId: string,
    claimantId: string,
    dto: CreateClaimDto,
  ): Promise<MyClaimView> {
    const post = await this.claimablePost(postId, claimantId);
    checkAnswers(
      post.questions.map((question) => question.id),
      dto.answers,
    );
    const serialMatches = this.serialMatches(
      post.secret?.serialHash,
      dto.serialNumber,
    );

    try {
      const claim = await this.prisma.$transaction(async (tx) => {
        await lockPost(tx, postId);
        await this.checkStillClaimable(tx, postId, claimantId);
        const created = await tx.claim.create({
          data: {
            postId,
            claimantId,
            message: dto.message ?? '',
            serialMatches,
            answers: { create: dto.answers },
          },
          include: MY_CLAIM_INCLUDE,
        });
        await this.outbox.enqueue(
          tx,
          newClaimEmail(post.author.email, post.title),
        );
        return created;
      });
      return toMyClaimView(claim);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'You already have a claim waiting for this item.',
        );
      }
      throw error;
    }
  }

  /** A found item the student can see and didn't post themselves; anything else is 404. */
  private async claimablePost(postId: string, studentId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        questions: { orderBy: { position: 'asc' } },
        secret: { select: { serialHash: true } },
        author: { select: { email: true } },
      },
    });
    const claimable =
      post?.type === 'FOUND' &&
      post.status !== 'CLOSED' &&
      !post.hiddenAt &&
      post.authorId !== studentId;
    if (!post || !claimable) {
      throw notFound();
    }
    return post;
  }

  /** Checked again under the item's lock, after any decision in progress has finished. */
  private async checkStillClaimable(
    tx: Prisma.TransactionClient,
    postId: string,
    claimantId: string,
  ): Promise<void> {
    const post = await tx.post.findUniqueOrThrow({
      where: { id: postId },
      select: { status: true },
    });
    if (post.status !== 'OPEN') {
      throw new ConflictException('This item is no longer open for claims.');
    }
    if ((await this.usedClaims(tx, postId, claimantId)) >= MAX_CLAIMS) {
      throw new ForbiddenException({
        message: `You have used all ${MAX_CLAIMS} claims for this item.`,
        code: 'CLAIM_LIMIT',
      });
    }
  }

  /** Whether the claimant's serial number matches; null when the item has none. */
  private serialMatches(
    serialHash: string | null | undefined,
    serialNumber?: string,
  ): boolean | null {
    if (!serialHash) {
      return null;
    }
    if (!serialNumber) {
      throw new BadRequestException(
        'Add the serial number or IMEI of the item.',
      );
    }
    return this.serials.hash(serialNumber) === serialHash;
  }

  /** The finder's view: their private notes next to every claim's answers. */
  async forFinder(postId: string, finderId: string): Promise<FinderClaims> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { secret: true, questions: { orderBy: { position: 'asc' } } },
    });
    if (!post || post.authorId !== finderId || post.type !== 'FOUND') {
      throw notFound();
    }
    const claims = await this.prisma.claim.findMany({
      where: { postId, status: { not: 'WITHDRAWN' } },
      include: FINDER_CLAIM_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return {
      privateNotes: post.secret?.privateNotes ?? '',
      questions: post.questions.map((question) => question.text),
      hasSerial: Boolean(post.secret?.serialHash),
      claims: claims.map(toFinderClaimView),
    };
  }

  /** Accepting one claim marks the item claimed and closes every other waiting claim. */
  async accept(claimId: string, finderId: string): Promise<FinderClaimView> {
    const claim = await this.claimForFinder(claimId, finderId);
    if (claim.post.hiddenAt) {
      throw new ConflictException(
        'A moderator hid this item, so its claims are closed.',
      );
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockPost(tx, claim.postId);
        const now = new Date();
        const opened = await tx.post.updateMany({
          where: { id: claim.postId, status: 'OPEN', hiddenAt: null },
          data: { status: 'CLAIMED' },
        });
        const accepted = await tx.claim.updateMany({
          where: { id: claimId, status: 'PENDING' },
          data: { status: 'ACCEPTED', decidedAt: now },
        });
        if (opened.count === 0 || accepted.count === 0) {
          throw alreadyDecided();
        }

        await startHandover(tx, claim, finderId);
        await this.emailAccepted(tx, claim);
        await this.closeWaiting(
          tx,
          claim.postId,
          claim.post.title,
          claimClosedEmail,
        );
      });
    } catch (error) {
      throw isUniqueViolation(error) ? alreadyDecided() : error;
    }
    return this.finderView(claimId);
  }

  async reject(claimId: string, finderId: string): Promise<FinderClaimView> {
    const claim = await this.claimForFinder(claimId, finderId);
    await this.prisma.$transaction(async (tx) => {
      await lockPost(tx, claim.postId);
      const rejected = await tx.claim.updateMany({
        where: { id: claimId, status: 'PENDING' },
        data: { status: 'REJECTED', decidedAt: new Date() },
      });
      if (rejected.count === 0) {
        throw alreadyDecided();
      }
      await this.outbox.enqueue(
        tx,
        claimRejectedEmail(claim.claimant.email, claim.post.title),
      );
    });
    return this.finderView(claimId);
  }

  /** A claimant can take back a claim the finder hasn't decided on yet. */
  async withdraw(claimId: string, claimantId: string): Promise<MyClaimView> {
    const withdrawn = await this.prisma.claim.updateMany({
      where: { id: claimId, claimantId, status: 'PENDING' },
      data: { status: 'WITHDRAWN', decidedAt: new Date() },
    });
    if (withdrawn.count === 0) {
      const exists = await this.prisma.claim.count({
        where: { id: claimId, claimantId },
      });
      throw exists
        ? alreadyDecided()
        : new NotFoundException('This claim does not exist.');
    }
    const claim = await this.prisma.claim.findUniqueOrThrow({
      where: { id: claimId },
      include: MY_CLAIM_INCLUDE,
    });
    return toMyClaimView(claim);
  }

  async mine(claimantId: string): Promise<MyClaimView[]> {
    const claims = await this.prisma.claim.findMany({
      where: { claimantId },
      include: MY_CLAIM_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return claims.map(toMyClaimView);
  }

  /** An item that is already at the security office is picked up there. */
  private async emailAccepted(
    tx: Prisma.TransactionClient,
    claim: {
      postId: string;
      claimant: { email: string };
      post: { title: string };
    },
  ): Promise<void> {
    const { email } = claim.claimant;
    await this.outbox.enqueue(tx, claimAcceptedEmail(email, claim.post.title));
    const desk = await tx.deskItem.findUnique({
      where: { postId: claim.postId },
    });
    if (desk?.status === 'AT_DESK') {
      await this.outbox.enqueue(tx, atDeskEmail(email, claim.post.title));
    }
  }

  /** Closing an item closes its waiting claims and tells those claimants. */
  async closeForPost(
    tx: Prisma.TransactionClient,
    postId: string,
    title: string,
    email: (to: string, title: string) => MailMessage = postClosedEmail,
  ): Promise<void> {
    await lockPost(tx, postId);
    await this.closeWaiting(tx, postId, title, email);
  }

  private async closeWaiting(
    tx: Prisma.TransactionClient,
    postId: string,
    title: string,
    email: (to: string, title: string) => MailMessage,
  ): Promise<void> {
    const waiting = await tx.claim.findMany({
      where: { postId, status: 'PENDING' },
      include: { claimant: { select: { email: true } } },
    });
    await tx.claim.updateMany({
      where: { id: { in: waiting.map((claim) => claim.id) } },
      data: { status: 'CLOSED', decidedAt: new Date() },
    });
    for (const claim of waiting) {
      await this.outbox.enqueue(tx, email(claim.claimant.email, title));
    }
  }

  private usedClaims(
    db: Prisma.TransactionClient,
    postId: string,
    claimantId: string,
  ): Promise<number> {
    return db.claim.count({
      where: { postId, claimantId, status: { in: ['REJECTED', 'WITHDRAWN'] } },
    });
  }

  /** Someone else's claim answers 404, the same as a claim that doesn't exist. */
  private async claimForFinder(claimId: string, finderId: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        post: { select: { authorId: true, title: true, hiddenAt: true } },
        claimant: { select: { email: true } },
      },
    });
    if (!claim || claim.post.authorId !== finderId) {
      throw new NotFoundException('This claim does not exist.');
    }
    return claim;
  }

  private async finderView(claimId: string): Promise<FinderClaimView> {
    const claim = await this.prisma.claim.findUniqueOrThrow({
      where: { id: claimId },
      include: FINDER_CLAIM_INCLUDE,
    });
    return toFinderClaimView(claim);
  }
}
