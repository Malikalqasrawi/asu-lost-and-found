import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DAY_MS, lastDay } from '../common/time.js';
import type { Post, Prisma } from '../generated/prisma/client.js';
import { PhotosService } from '../photos/photos.service.js';
import { PlacesService } from '../places/places.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreatePostDto,
  ListPostsQuery,
  UpdatePostDto,
} from './dto/post.dto.js';
import { parseCursor, toCursor } from './cursor.js';
import { canView } from './post-visibility.js';
import { POST_INCLUDE, PostView, toPostView } from './post-view.js';

export const MAX_POSTS_PER_DAY = 10;
const DEFAULT_PAGE_SIZE = 20;
const EARLIEST_DATE = '2020-01-01';

export interface PostPage {
  items: PostView[];
  nextCursor: string | null;
}

function parseHappenedOn(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  // One day of slack, because "today" in Amman can already be tomorrow in UTC.
  const latest = new Date(Date.now() + DAY_MS);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value < EARLIEST_DATE ||
    date > latest
  ) {
    throw new BadRequestException(
      'Choose a real date that is not in the future',
    );
  }
  return date;
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly places: PlacesService,
    private readonly photos: PhotosService,
  ) {}

  async create(
    authorId: string,
    dto: CreatePostDto,
    photos: Buffer[],
  ): Promise<PostView> {
    const happenedOn = parseHappenedOn(dto.happenedOn);
    await this.checkPlace(dto.placeId);
    await this.checkDailyLimit(this.prisma, authorId);

    const processed = await this.photos.process(photos, {
      blur: dto.type === 'FOUND',
    });
    const stored = await this.photos.store(processed);

    try {
      const post = await this.prisma.$transaction(async (tx) => {
        // Uploads from the same student wait for each other here, so parallel
        // requests can't all pass the daily limit before any of them is saved.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${authorId}))`;
        await this.checkDailyLimit(tx, authorId);
        return tx.post.create({
          data: {
            authorId,
            type: dto.type,
            title: dto.title,
            description: dto.description ?? '',
            category: dto.category,
            placeId: dto.placeId,
            placeDetails: dto.placeDetails || null,
            happenedOn,
            photos: {
              create: stored.map((photo, position) => ({ ...photo, position })),
            },
          },
          include: POST_INCLUDE,
        });
      });
      return toPostView(post, authorId);
    } catch (error) {
      await this.photos.discard(stored);
      throw error;
    }
  }

  async list(viewerId: string, query: ListPostsQuery): Promise<PostPage> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.PostWhereInput = {
      status: 'OPEN',
      type: query.type,
      category: query.category,
      placeId: query.placeId,
    };
    const and: Prisma.PostWhereInput[] = [];
    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }
    if (query.cursor) {
      const after = parseCursor(query.cursor);
      and.push({
        OR: [
          { createdAt: { lt: after.createdAt } },
          { createdAt: after.createdAt, id: { lt: after.id } },
        ],
      });
    }
    where.AND = and;

    const rows = await this.prisma.post.findMany({
      where,
      include: POST_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const items = rows.slice(0, limit);
    return {
      items: items.map((post) => toPostView(post, viewerId)),
      nextCursor:
        rows.length > limit ? toCursor(items[items.length - 1]) : null,
    };
  }

  async mine(authorId: string): Promise<PostView[]> {
    const posts = await this.prisma.post.findMany({
      where: { authorId },
      include: POST_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return posts.map((post) => toPostView(post, authorId));
  }

  async findOne(id: string, viewerId: string): Promise<PostView> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: POST_INCLUDE,
    });
    if (!post || !canView(post, viewerId)) {
      throw new NotFoundException('This post does not exist or was closed.');
    }
    return toPostView(post, viewerId);
  }

  async update(
    id: string,
    authorId: string,
    dto: UpdatePostDto,
  ): Promise<PostView> {
    await this.findOpenPostOf(id, authorId);
    if (dto.placeId) {
      await this.checkPlace(dto.placeId);
    }

    const post = await this.prisma.post.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        placeId: dto.placeId,
        placeDetails:
          dto.placeDetails === undefined ? undefined : dto.placeDetails || null,
        happenedOn: dto.happenedOn
          ? parseHappenedOn(dto.happenedOn)
          : undefined,
      },
      include: POST_INCLUDE,
    });
    return toPostView(post, authorId);
  }

  async close(id: string, authorId: string): Promise<PostView> {
    await this.findOpenPostOf(id, authorId);
    const post = await this.prisma.post.update({
      where: { id },
      data: { status: 'CLOSED' },
      include: POST_INCLUDE,
    });
    return toPostView(post, authorId);
  }

  /** Someone else's post answers 404, the same as a post that doesn't exist. */
  private async findOpenPostOf(id: string, authorId: string): Promise<Post> {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post || post.authorId !== authorId) {
      throw new NotFoundException('This post does not exist or was closed.');
    }
    if (post.status !== 'OPEN') {
      throw new ConflictException('Only open posts can be changed');
    }
    return post;
  }

  private async checkPlace(placeId: string): Promise<void> {
    if (!(await this.places.exists(placeId))) {
      throw new BadRequestException('Choose a place from the list');
    }
  }

  private async checkDailyLimit(
    db: Prisma.TransactionClient,
    authorId: string,
  ): Promise<void> {
    const today = await db.post.count({
      where: { authorId, createdAt: lastDay() },
    });
    if (today >= MAX_POSTS_PER_DAY) {
      throw new HttpException(
        {
          message: `You can post up to ${MAX_POSTS_PER_DAY} items a day. Try again tomorrow.`,
          code: 'DAILY_POST_LIMIT',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
