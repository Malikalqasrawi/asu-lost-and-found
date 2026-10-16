import { createTestApp, TestContext } from './support/app.js';

describe('GET /api/health', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('reports the database as up without signing in', async () => {
    const response = await ctx.http().get('/api/health').expect(200);

    expect(response.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('sends security headers and hides the framework', async () => {
    const response = await ctx.http().get('/api/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('answers 404 outside the api prefix', async () => {
    await ctx.http().get('/health').expect(404);
  });
});
