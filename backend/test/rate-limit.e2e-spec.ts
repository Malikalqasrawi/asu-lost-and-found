import { newStudentEmail } from './support/accounts.js';
import { createTestApp, TestContext } from './support/app.js';

vi.hoisted(() => {
  process.env.RATE_LIMIT_EMAILS_PER_HOUR = '2';
  process.env.RATE_LIMIT_LOGINS_PER_15_MIN = '3';
});

describe('rate limits', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('limits requests that send an email', async () => {
    const forgot = () =>
      ctx
        .http()
        .post('/api/auth/forgot-password')
        .send({ email: newStudentEmail() });

    await forgot().expect(202);
    await forgot().expect(202);
    const blocked = await forgot().expect(429);

    expect(blocked.headers['retry-after-email']).toBeDefined();
  });

  it('counts register, resend and forgot-password together', async () => {
    await ctx
      .http()
      .post('/api/auth/resend-code')
      .send({ email: newStudentEmail() })
      .expect(202);
    await ctx
      .http()
      .post('/api/auth/forgot-password')
      .send({ email: newStudentEmail() })
      .expect(202);

    await ctx
      .http()
      .post('/api/auth/register')
      .send({
        email: newStudentEmail(),
        password: 'correct-horse-42',
        fullName: 'Ahmad Saleh',
      })
      .expect(429);
  });

  it('limits sign-in attempts', async () => {
    const login = () =>
      ctx
        .http()
        .post('/api/auth/login')
        .send({ email: newStudentEmail(), password: 'guess' });

    for (let i = 0; i < 3; i++) {
      await login().expect(401);
    }
    await login().expect(429);
  });

  it('counts code guesses as sign-in attempts', async () => {
    const guess = () =>
      ctx.http().post('/api/auth/reset-password').send({
        email: newStudentEmail(),
        code: '123456',
        newPassword: 'a-new-password',
      });

    for (let i = 0; i < 3; i++) {
      await guess().expect(400);
    }
    await ctx
      .http()
      .post('/api/auth/login')
      .send({ email: newStudentEmail(), password: 'x' })
      .expect(429);
  });

  it('does not limit other endpoints with the strict limits', async () => {
    for (let i = 0; i < 5; i++) {
      await ctx.http().get('/api/health').expect(200);
    }
  });
});
