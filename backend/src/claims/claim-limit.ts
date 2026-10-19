import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { EnvironmentVariables } from '../config/env.validation.js';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * A deleted account keeps a keyed hash of its email instead of the email, so a
 * student can't delete their account and sign up again for new claims on an item.
 */
@Injectable()
export class ClaimLimit {
  private readonly key: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.key = config.get('SERIAL_HASH_KEY', { infer: true });
  }

  emailHash(email: string): string {
    return createHmac('sha256', this.key)
      .update(`deleted-account:${email}`)
      .digest('hex');
  }

  /** Rejected and withdrawn claims on the item, also from the student's deleted accounts. */
  async used(
    db: Prisma.TransactionClient,
    postId: string,
    claimantId: string,
  ): Promise<number> {
    const { email } = await db.user.findUniqueOrThrow({
      where: { id: claimantId },
      select: { email: true },
    });
    const deleted = await db.user.findMany({
      where: { erasedEmailHash: this.emailHash(email) },
      select: { id: true },
    });
    return db.claim.count({
      where: {
        postId,
        claimantId: { in: [claimantId, ...deleted.map(({ id }) => id)] },
        status: { in: ['REJECTED', 'WITHDRAWN'] },
      },
    });
  }
}
