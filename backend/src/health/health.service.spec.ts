import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

function serviceWithDatabase(query: () => Promise<unknown>): HealthService {
  const prisma = { $queryRaw: vi.fn(query) } as unknown as PrismaService;
  return new HealthService(prisma);
}

describe('HealthService', () => {
  it('reports ok when the database answers', async () => {
    const health = serviceWithDatabase(() =>
      Promise.resolve([{ '?column?': 1 }]),
    );

    await expect(health.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('answers 503 when the database is unreachable', async () => {
    const health = serviceWithDatabase(() =>
      Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432')),
    );

    await expect(health.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('does not pass the database error on to the caller', async () => {
    const health = serviceWithDatabase(() =>
      Promise.reject(
        new Error('password authentication failed for user "lostfound_app"'),
      ),
    );

    const error = await health.check().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const body = (error as ServiceUnavailableException).getResponse();
    expect(JSON.stringify(body)).not.toContain('lostfound_app');
  });
});
