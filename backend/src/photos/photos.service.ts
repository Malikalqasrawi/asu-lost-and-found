import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
  async readPublic(photoId: string, viewerId: string): Promise<Buffer> {
    const photo = await this.findWithPost(photoId);
    if (!photo || !canView(photo.post, viewerId)) {
      throw new NotFoundException('This photo is not available.');
    }
    return this.storage.read(photo.publicKey);
  }

  /** The unblurred photo, only for the student who posted it. */
  async readOriginal(photoId: string, viewerId: string): Promise<Buffer> {
    const photo = await this.findWithPost(photoId);
    if (!photo || photo.post.authorId !== viewerId) {
      throw new NotFoundException('This photo is not available.');
    }
    return this.storage.read(photo.originalKey);
  }

  private findWithPost(photoId: string) {
    return this.prisma.postPhoto.findUnique({
      where: { id: photoId },
      include: { post: { select: { status: true, authorId: true } } },
    });
  }
}
