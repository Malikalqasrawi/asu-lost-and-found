import { Module } from '@nestjs/common';
import { MailSender } from './mail-sender.js';
import { OutboxService } from './outbox.service.js';
import { OutboxWorker } from './outbox.worker.js';
import { SmtpMailSender } from './smtp-mail-sender.js';

@Module({
  providers: [
    { provide: MailSender, useClass: SmtpMailSender },
    OutboxService,
    OutboxWorker,
  ],
  exports: [OutboxService],
})
export class MailModule {}
