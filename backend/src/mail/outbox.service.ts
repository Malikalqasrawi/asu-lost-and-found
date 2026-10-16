import { Injectable, Logger } from '@nestjs/common';
import type { OutboxEmail, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailMessage, MailSender } from './mail-sender.js';

export const MAX_SEND_ATTEMPTS = 5;
const BATCH_SIZE = 10;
const LEASE_MS = 60_000;

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailSender,
  ) {}

  async enqueue(
    db: Prisma.TransactionClient,
    message: MailMessage,
  ): Promise<void> {
    await db.outboxEmail.create({
      data: {
        toAddress: message.to,
        subject: message.subject,
        textBody: message.text,
      },
    });
  }

  async processDue(): Promise<number> {
    const batch = await this.claimDue();
    for (const email of batch) {
      await this.deliver(email);
    }
    return batch.length;
  }

  private claimDue(): Promise<OutboxEmail[]> {
    return this.prisma.$transaction(async (tx) => {
      const due = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM outbox_emails
        WHERE failed_at IS NULL AND next_attempt_at <= now()
        ORDER BY next_attempt_at
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED`;
      if (due.length === 0) {
        return [];
      }

      const ids = due.map((row) => row.id);
      await tx.outboxEmail.updateMany({
        where: { id: { in: ids } },
        data: { nextAttemptAt: new Date(Date.now() + LEASE_MS) },
      });
      return tx.outboxEmail.findMany({ where: { id: { in: ids } } });
    });
  }

  private async deliver(email: OutboxEmail): Promise<void> {
    try {
      await this.mailer.send({
        to: email.toAddress,
        subject: email.subject,
        text: email.textBody,
      });
      await this.prisma.outboxEmail.delete({ where: { id: email.id } });
    } catch (error) {
      const attempts = email.attempts + 1;
      const gaveUp = attempts >= MAX_SEND_ATTEMPTS;
      await this.prisma.outboxEmail.update({
        where: { id: email.id },
        data: {
          attempts,
          lastError: String(
            error instanceof Error ? error.message : error,
          ).slice(0, 500),
          nextAttemptAt: new Date(Date.now() + 2 ** attempts * 60_000),
          failedAt: gaveUp ? new Date() : null,
        },
      });
      this.logger.warn(
        `Email ${email.id} was not sent (attempt ${attempts} of ${MAX_SEND_ATTEMPTS})`,
      );
    }
  }
}
