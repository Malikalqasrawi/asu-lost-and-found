import { JobQueue, QueueFullError } from './job-queue.js';

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe('JobQueue', () => {
  it('runs at most the allowed number of jobs at the same time', async () => {
    const queue = new JobQueue(2, 10);
    const gates = [deferred(), deferred(), deferred()];
    let active = 0;
    let mostActive = 0;

    const jobs = gates.map((gate) =>
      queue.run(async () => {
        active++;
        mostActive = Math.max(mostActive, active);
        await gate.promise;
        active--;
      }),
    );
    await Promise.resolve();
    gates.forEach((gate) => gate.resolve());
    await Promise.all(jobs);

    expect(mostActive).toBe(2);
  });

  it('starts waiting jobs in the order they arrived', async () => {
    const queue = new JobQueue(1, 10);
    const first = deferred();
    const order: number[] = [];

    const jobs = [
      queue.run(async () => {
        await first.promise;
        order.push(1);
      }),
      queue.run(async () => {
        order.push(2);
      }),
      queue.run(async () => {
        order.push(3);
      }),
    ];
    first.resolve();
    await Promise.all(jobs);

    expect(order).toEqual([1, 2, 3]);
  });

  it('refuses new jobs when too many are already waiting', async () => {
    const queue = new JobQueue(1, 1);
    const gate = deferred();
    const running = queue.run(() => gate.promise);
    const waiting = queue.run(() => Promise.resolve());

    await expect(queue.run(() => Promise.resolve())).rejects.toBeInstanceOf(
      QueueFullError,
    );

    gate.resolve();
    await Promise.all([running, waiting]);
  });

  it('frees the slot when a job fails', async () => {
    const queue = new JobQueue(1, 0);

    await expect(
      queue.run(() => Promise.reject(new Error('broken photo'))),
    ).rejects.toThrow('broken photo');

    await expect(queue.run(() => Promise.resolve('next'))).resolves.toBe(
      'next',
    );
  });
});
