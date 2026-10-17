export class QueueFullError extends Error {
  constructor() {
    super('Too many photos are being processed right now');
  }
}

/**
 * Runs at most `maxRunning` jobs at a time and lets at most `maxWaiting` wait
 * for a turn, so a burst of uploads can't use up the server's CPU and memory.
 */
export class JobQueue {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly maxRunning: number,
    private readonly maxWaiting: number,
  ) {}

  async run<T>(job: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await job();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.running < this.maxRunning) {
      this.running++;
      return;
    }
    if (this.waiting.length >= this.maxWaiting) {
      throw new QueueFullError();
    }
    // The finishing job hands its slot straight over, so `running` stays the same.
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.running--;
    }
  }
}
