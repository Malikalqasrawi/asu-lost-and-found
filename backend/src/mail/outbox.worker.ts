import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OutboxService } from './outbox.service.js';

@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name);
  private running = false;

  constructor(private readonly outbox: OutboxService) {}

  @Interval(5_000)
  async sendDueEmails(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.outbox.processDue();
    } catch (error) {
      this.logger.error('Could not process the email outbox', error);
    } finally {
      this.running = false;
    }
  }
}
