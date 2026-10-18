import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { MailSender } from '../../src/mail/mail-sender.js';
import { OutboxService } from '../../src/mail/outbox.service.js';
import { OutboxWorker } from '../../src/mail/outbox.worker.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { FakeMailSender } from './fake-mail-sender.js';

export interface TestContext {
  app: INestApplication<App>;
  mailer: FakeMailSender;
  /** Sends every queued email that is due, not just one batch. */
  outbox: Pick<OutboxService, 'processDue'>;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
}

// The test files share one database, so the queue can hold more than the
// outbox sends in one go; tests want everything sent before they look.
function allDue(outbox: OutboxService): Pick<OutboxService, 'processDue'> {
  return {
    async processDue() {
      let sent = 0;
      for (
        let batch = await outbox.processDue();
        batch > 0;
        batch = await outbox.processDue()
      ) {
        sent += batch;
      }
      return sent;
    },
  };
}

export async function createTestApp(): Promise<TestContext> {
  const mailer = new FakeMailSender();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailSender)
    .useValue(mailer)
    // Tests send queued emails themselves with outbox.processDue().
    .overrideProvider(OutboxWorker)
    .useValue({})
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  return {
    app,
    mailer,
    outbox: allDue(app.get(OutboxService)),
    prisma: app.get(PrismaService),
    http: () => request(app.getHttpServer()),
  };
}
