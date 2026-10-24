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

  const forgot = (email = newStudentEmail()) =>
    ctx.http().post('/api/auth/forgot-password').send({ email });

  const login = (email = newStudentEmail(), password = 'guess') =>
    ctx.http().post('/api/auth/login').send({ email, password });

  it('limits requests that send an email to one account', async () => {
    const email = newStudentEmail();

    await forgot(email).expect(202);
    await forgot(email).expect(202);
    const blocked = await forgot(email).expect(429);

    expect(blocked.headers['retry-after-email']).toBeDefined();
    await forgot().expect(202);
  });

  it('counts register, resend and forgot-password together for one email', async () => {
    const email = newStudentEmail();
    await ctx.http().post('/api/auth/resend-code').send({ email }).expect(202);
    await forgot(email).expect(202);

    await ctx
      .http()
      .post('/api/auth/register')
      .send({ email, password: 'correct-horse-42', fullName: 'Ahmad Saleh' })
      .expect(429);
  });

  it('lets one network address send ten times the emails of one account', async () => {
    for (let i = 0; i < 20; i++) {
      await forgot().expect(202);
    }

    const blocked = await forgot().expect(429);
    expect(blocked.headers['retry-after-email-network']).toBeDefined();
  });

  it('limits password guesses for one account, whatever the address', async () => {
    const email = newStudentEmail();
    for (let i = 0; i < 3; i++) {
      await login(email).expect(401);
    }

    await login(email).expect(429);
    await login().expect(401);
  });

  it('lets one network address make ten times the sign-in attempts of one account', async () => {
    for (let i = 0; i < 30; i++) {
      await login().expect(401);
    }

    await login().expect(429);
  });

  it('counts code guesses as sign-in attempts for that email', async () => {
    const email = newStudentEmail();
    const guess = () =>
      ctx.http().post('/api/auth/reset-password').send({
        email,
        code: '123456',
        newPassword: 'a-new-password',
      });

    for (let i = 0; i < 3; i++) {
      await guess().expect(400);
    }
    await login(email, 'x').expect(429);
  });

  it('limits how often anyone can start a Microsoft sign-in', async () => {
    for (let i = 0; i < 20; i++) {
      await ctx.http().post('/api/auth/microsoft/start').expect(200);
    }

    await ctx.http().post('/api/auth/microsoft/start').expect(429);
  });

  it('does not limit other endpoints with the strict limits', async () => {
    for (let i = 0; i < 5; i++) {
      await ctx.http().get('/api/health').expect(200);
    }
  });
});
