import { OutboxService } from './outbox.service.js';
import { OutboxWorker } from './outbox.worker.js';

describe('OutboxWorker', () => {
  it('does not start a new round while the last one is still sending', async () => {
    let finish: () => void = () => {};
    const processDue = vi.fn(
      () => new Promise<number>((resolve) => (finish = () => resolve(1))),
    );
    const worker = new OutboxWorker({ processDue } as unknown as OutboxService);

    const first = worker.sendDueEmails();
    await worker.sendDueEmails();
    finish();
    await first;

    expect(processDue).toHaveBeenCalledTimes(1);
  });

  it('keeps running after a failed round', async () => {
    const processDue = vi
      .fn()
      .mockRejectedValueOnce(new Error('database is down'))
      .mockResolvedValueOnce(0);
    const worker = new OutboxWorker({ processDue } as unknown as OutboxService);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await worker.sendDueEmails();
    await worker.sendDueEmails();

    expect(processDue).toHaveBeenCalledTimes(2);
  });
});
