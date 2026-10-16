import { MAX_SEND_ATTEMPTS } from '../src/mail/outbox.service.js';
import { newStudentEmail, register } from './support/accounts.js';
import { createTestApp, TestContext } from './support/app.js';

describe('email outbox', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const queuedFor = (email: string) =>
    ctx.prisma.outboxEmail.findMany({ where: { toAddress: email } });

  it('deletes an email once it is sent', async () => {
    const { email } = await register(ctx);

    await ctx.outbox.processDue();

    expect(ctx.mailer.sentTo(email)).toHaveLength(1);
    expect(await queuedFor(email)).toHaveLength(0);
  });

  it('keeps a failed email and tries again later', async () => {
    const { email } = await register(ctx);
    ctx.mailer.failuresLeft = 1;

    await ctx.outbox.processDue();

    const [queued] = await queuedFor(email);
    expect(queued.attempts).toBe(1);
    expect(queued.lastError).toContain('ECONNREFUSED');
    expect(queued.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(queued.failedAt).toBeNull();
    expect(ctx.mailer.sentTo(email)).toHaveLength(0);

    await ctx.prisma.outboxEmail.update({
      where: { id: queued.id },
      data: { nextAttemptAt: new Date() },
    });
    await ctx.outbox.processDue();

    expect(ctx.mailer.sentTo(email)).toHaveLength(1);
  });

  it(`gives up after ${MAX_SEND_ATTEMPTS} failed attempts`, async () => {
    const { email } = await register(ctx);
    const [queued] = await queuedFor(email);
    await ctx.prisma.outboxEmail.update({
      where: { id: queued.id },
      data: { attempts: MAX_SEND_ATTEMPTS - 1 },
    });
    ctx.mailer.failuresLeft = 1;

    await ctx.outbox.processDue();
    await ctx.prisma.outboxEmail.update({
      where: { id: queued.id },
      data: { nextAttemptAt: new Date() },
    });
    await ctx.outbox.processDue();

    const [failed] = await queuedFor(email);
    expect(failed.failedAt).not.toBeNull();
    expect(ctx.mailer.sentTo(email)).toHaveLength(0);
  });

  it('does not send the same email twice when two workers run at once', async () => {
    const emails = [newStudentEmail(), newStudentEmail(), newStudentEmail()];
    for (const email of emails) {
      await register(ctx, email);
    }

    await Promise.all([ctx.outbox.processDue(), ctx.outbox.processDue()]);

    for (const email of emails) {
      expect(ctx.mailer.sentTo(email)).toHaveLength(1);
    }
  });
});
