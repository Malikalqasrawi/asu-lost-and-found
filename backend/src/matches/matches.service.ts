import { Injectable, NotFoundException } from '@nestjs/common';
import { DAY_MS } from '../common/time.js';
import type { Prisma } from '../generated/prisma/client.js';
import { OutboxService } from '../mail/outbox.service.js';
import { POST_INCLUDE, toPostView, type PostView } from '../posts/post-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { foundItemsFor, lostPostsFor } from './match-candidates.js';
import { possibleMatchEmail } from './match-emails.js';
import {
  matchReasons,
  matchScore,
  SHOWN_FROM,
  worthAnEmail,
} from './match-score.js';

const MATCHES_SHOWN = 10;
const EMAILS_PER_FOUND_ITEM = 3;

export interface MatchView {
  post: PostView;
  /** 0 to 100. */
  score: number;
  reasons: string[];
}

const notFound = () =>
  new NotFoundException('This post does not exist or was closed.');

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  /** Found items that may be the one the student lost, the likeliest first. */
  async forLostPost(postId: string, viewerId: string): Promise<MatchView[]> {
    await this.ownLostPost(postId, viewerId);
    const scored = (await foundItemsFor(this.prisma, postId))
      .map((candidate) => ({ candidate, score: matchScore(candidate) }))
      .filter(({ score }) => score >= SHOWN_FROM)
      .sort((a, b) => b.score - a.score)
      .slice(0, MATCHES_SHOWN);

    const posts = await this.prisma.post.findMany({
      where: {
        id: { in: scored.map(({ candidate }) => candidate.foundPostId) },
        type: 'FOUND',
        status: 'OPEN',
        hiddenAt: null,
      },
      include: POST_INCLUDE,
    });
    const byId = new Map(posts.map((post) => [post.id, post]));
    return scored.flatMap(({ candidate, score }) => {
      const post = byId.get(candidate.foundPostId);
      return post
        ? [
            {
              post: toPostView(post, viewerId),
              score: Math.round(score * 100),
              reasons: matchReasons(candidate),
            },
          ]
        : [];
    });
  }

  async dismiss(
    postId: string,
    foundPostId: string,
    viewerId: string,
  ): Promise<void> {
    await this.ownLostPost(postId, viewerId);
    const found = await this.prisma.post.count({
      where: { id: foundPostId, type: 'FOUND' },
    });
    if (!found) {
      throw notFound();
    }
    await this.prisma.matchDismissal.createMany({
      data: [{ lostPostId: postId, foundPostId }],
      skipDuplicates: true,
    });
  }

  /**
   * Called in the transaction that saves a found item. The students whose
   * lost posts it matches best get an email: 3 at most for one found item,
   * and nobody gets more than one match email a day.
   */
  async alertOwners(
    tx: Prisma.TransactionClient,
    foundPostId: string,
  ): Promise<void> {
    const best = (await lostPostsFor(tx, foundPostId))
      .filter(worthAnEmail)
      .sort((a, b) => matchScore(b) - matchScore(a))
      .slice(0, EMAILS_PER_FOUND_ITEM)
      // Students are updated in a fixed order, so two found items saved at
      // the same moment can't deadlock on each other.
      .sort((a, b) => a.lostAuthorId.localeCompare(b.lostAuthorId));
    const dayAgo = new Date(Date.now() - DAY_MS);
    for (const candidate of best) {
      const claimed = await tx.user.updateMany({
        where: {
          id: candidate.lostAuthorId,
          OR: [{ matchEmailedAt: null }, { matchEmailedAt: { lt: dayAgo } }],
        },
        data: { matchEmailedAt: new Date() },
      });
      if (claimed.count > 0) {
        await this.outbox.enqueue(
          tx,
          possibleMatchEmail(candidate.lostAuthorEmail, candidate.lostTitle),
        );
      }
    }
  }

  /** Someone else's post, or a found one, answers 404. */
  private async ownLostPost(postId: string, viewerId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, type: true },
    });
    if (!post || post.authorId !== viewerId || post.type !== 'LOST') {
      throw notFound();
    }
  }
}
