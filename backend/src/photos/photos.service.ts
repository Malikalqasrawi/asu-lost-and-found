import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../auth/auth-user.js';
import type { DeskStatus, PostStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canView } from '../posts/post-visibility.js';
import { FileStorage } from '../storage/file-storage.js';
import { JobQueue, QueueFullError } from './job-queue.js';
import {
  processPhoto,
  ProcessedPhoto,
  UnsupportedPhotoError,
} from './photo-processor.js';

export interface StoredPhoto {
  originalKey: string;
  publicKey: string;
}

const newKey = () => `${randomUUID()}.jpg`;

// Server-wide: two photos are resized at a time and a few more may wait.
const MAX_RUNNING_JOBS = 2;
const MAX_WAITING_JOBS = 16;

interface PhotoPost {
  authorId: string;
  status: PostStatus;
  deskItem: { status: DeskStatus } | null;
  /** The viewer's accepted claim on the post, if any. */
  claims: { id: string }[];
}

/**
 * The unblurred photo is for the poster, the student whose claim they
 * accepted, and the security office while it handles the item.
 */
function mayReadOriginal(post: PhotoPost, viewer: AuthUser): boolean {
  if (post.authorId === viewer.id || post.claims.length > 0) {
    return true;
  }
  const stillOpen = post.status === 'OPEN' || post.status === 'CLAIMED';
  return viewer.role === 'SECURITY' && Boolean(post.deskItem) && stillOpen;
}

@Injectable()
export class PhotosService {
  private readonly queue = new JobQueue(MAX_RUNNING_JOBS, MAX_WAITING_JOBS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
  ) {}

  /** One photo at a time, so a single upload can't hold more than one slot. */
  async process(
    uploads: Buffer[],
    { blur }: { blur: boolean },
  ): Promise<ProcessedPhoto[]> {
    const processed: ProcessedPhoto[] = [];
    try {
      for (const upload of uploads) {
        processed.push(
          await this.queue.run(() => processPhoto(upload, { blur })),
        );
      }
      return processed;
    } catch (error) {
      if (error instanceof UnsupportedPhotoError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof QueueFullError) {
        throw new ServiceUnavailableException(
          'Too many uploads right now. Try again in a minute.',
        );
      }
      throw error;
    }
  }

  async store(photos: ProcessedPhoto[]): Promise<StoredPhoto[]> {
    const stored: StoredPhoto[] = [];
    try {
      for (const photo of photos) {
        const keys = { originalKey: newKey(), publicKey: newKey() };
        await this.storage.save(keys.originalKey, photo.original);
        stored.push(keys);
        await this.storage.save(keys.publicKey, photo.public);
      }
      return stored;
    } catch (error) {
      await this.discard(stored);
      throw error;
    }
  }

  async discard(photos: StoredPhoto[]): Promise<void> {
    await Promise.all(
      photos.flatMap((photo) => [
        this.storage.remove(photo.originalKey),
        this.storage.remove(photo.publicKey),
      ]),
    );
  }

  /** The blurred (found) or resized (lost) version that anyone who can see the post gets. */
  /** What students see; admins also see it on hidden posts, to decide about reports. */
  async readPublic(photoId: string, viewer: AuthUser): Promise<Buffer> {
    const photo = await this.findWithPost(photoId);
    const moderating = viewer.role === 'ADMIN' && viewer.adminSession;
    if (!photo || !(canView(photo.post, viewer.id) || moderating)) {
      throw new NotFoundException('This photo is not available.');
    }
    return this.storage.read(photo.publicKey);
  }

  async readOriginal(photoId: string, viewer: AuthUser): Promise<Buffer> {
    const photo = await this.prisma.postPhoto.findUnique({
      where: { id: photoId },
      include: {
        post: {
          select: {
            authorId: true,
            status: true,
            deskItem: { select: { status: true } },
            claims: {
              where: { claimantId: viewer.id, status: 'ACCEPTED' },
              select: { id: true },
            },
          },
        },
      },
    });
    if (!photo || !mayReadOriginal(photo.post, viewer)) {
      throw new NotFoundException('This photo is not available.');
    }
    return this.storage.read(photo.originalKey);
  }

  private findWithPost(photoId: string) {
    return this.prisma.postPhoto.findUnique({
      where: { id: photoId },
      include: {
        post: { select: { status: true, authorId: true, hiddenAt: true } },
      },
    });
  }
}
