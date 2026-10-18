import { UsersService } from '../src/users/users.service.js';
import { createVerifiedUser, PASSWORD } from './support/accounts.js';
import {
  ADMIN_ORIGIN,
  cookieFrom,
  signInAsAdmin,
  type Admin,
} from './support/admin.js';
import { createTestApp, TestContext } from './support/app.js';

describe('admin website sign-in', () => {
  let ctx: TestContext;

  const fromAdminSite = (path: string, cookie?: string) => {
    const request = ctx
      .http()
      .post(path)
      .set('Origin', ADMIN_ORIGIN)
      .set('X-Lost-Found-Admin', '1');
    return cookie ? request.set('Cookie', cookie) : request;
  };

  const adminPage = (token: string) =>
    ctx
      .http()
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('the password step', () => {
    it('answers a student account like a wrong password', async () => {
      const { email } = await createVerifiedUser(ctx);

      const student = await ctx
        .http()
        .post('/api/admin/auth/login')
        .send({ email, password: PASSWORD })
        .expect(401);
      const wrong = await ctx
        .http()
        .post('/api/admin/auth/login')
        .send({ email, password: 'not-the-password' })
        .expect(401);

      expect(student.body.message).toBe(wrong.body.message);
    });

    it('emails an admin a code and returns a challenge, not tokens', async () => {
      const { email } = await createVerifiedUser(ctx);
      await ctx.app.get(UsersService).setRole(email, 'ADMIN');

      const login = await ctx
        .http()
        .post('/api/admin/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);

      expect(login.body).not.toHaveProperty('accessToken');
      expect(login.headers['set-cookie']).toBeUndefined();
      await ctx.outbox.processDue();
      expect(ctx.mailer.sentTo(email).at(-1)?.subject).toBe(
        'Your ASU Lost & Found admin sign-in code',
      );
      await ctx
        .http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${login.body.challenge}`)
        .expect(401);
    });
  });

  describe('the code step', () => {
    it('refuses a wrong code', async () => {
      const { email } = await createVerifiedUser(ctx);
      await ctx.app.get(UsersService).setRole(email, 'ADMIN');
      const login = await ctx
        .http()
        .post('/api/admin/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      await ctx.outbox.processDue();
      const code = ctx.mailer.lastCodeFor(email);

      await ctx
        .http()
        .post('/api/admin/auth/verify')
        .send({
          challenge: login.body.challenge,
          code: code === '000000' ? '111111' : '000000',
        })
        .expect(400);
      await ctx
        .http()
        .post('/api/admin/auth/verify')
        .send({ challenge: 'made-up', code })
        .expect(401);
    });

    it('keeps the refresh token in an httpOnly cookie for the admin auth path only', async () => {
      const { email } = await createVerifiedUser(ctx);
      await ctx.app.get(UsersService).setRole(email, 'ADMIN');
      const login = await ctx
        .http()
        .post('/api/admin/auth/login')
        .send({ email, password: PASSWORD });
      await ctx.outbox.processDue();

      const verified = await ctx
        .http()
        .post('/api/admin/auth/verify')
        .send({
          challenge: login.body.challenge,
          code: ctx.mailer.lastCodeFor(email),
        })
        .expect(200);

      const setCookie = [verified.headers['set-cookie'] ?? []].flat().join(';');
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Strict/i);
      expect(setCookie).toMatch(/Path=\/api\/admin\/auth/);
      // A browser-session cookie: closing the browser ends the session.
      expect(setCookie).not.toMatch(/Max-Age|Expires/i);
      expect(verified.body).not.toHaveProperty('refreshToken');
      expect(verified.body.user.role).toBe('ADMIN');
    });
  });

  describe('admin endpoints', () => {
    let admin: Admin;

    beforeAll(async () => {
      admin = await signInAsAdmin(ctx);
    });

    it('accept the admin website session', async () => {
      await adminPage(admin.token).expect(200);
    });

    it("refuse an admin's token from the app sign-in", async () => {
      const refused = await adminPage(admin.appToken).expect(403);

      expect(refused.body.code).toBe('ADMIN_SESSION_REQUIRED');
    });
  });

  describe('refreshing', () => {
    it('needs the admin site origin and header, besides the cookie', async () => {
      const admin = await signInAsAdmin(ctx);

      await ctx
        .http()
        .post('/api/admin/auth/refresh')
        .set('Cookie', admin.cookie)
        .expect(403);
      await ctx
        .http()
        .post('/api/admin/auth/refresh')
        .set('Cookie', admin.cookie)
        .set('Origin', 'https://evil.example.com')
        .set('X-Lost-Found-Admin', '1')
        .expect(403);
    });

    it('swaps the cookie for a new one, and a reused cookie ends the session', async () => {
      const admin = await signInAsAdmin(ctx);

      const refreshed = await fromAdminSite(
        '/api/admin/auth/refresh',
        admin.cookie,
      ).expect(200);
      const newCookie = cookieFrom(refreshed.headers['set-cookie']);

      expect(newCookie).not.toBe(admin.cookie);
      await adminPage(refreshed.body.accessToken).expect(200);
      await fromAdminSite('/api/admin/auth/refresh', admin.cookie).expect(401);
      await fromAdminSite('/api/admin/auth/refresh', newCookie).expect(401);
    });

    it('ends 12 hours after sign-in, however often it refreshes', async () => {
      const admin = await signInAsAdmin(ctx);
      const first = await ctx.prisma.refreshToken.findFirstOrThrow({
        where: { user: { email: admin.email }, adminSession: true },
        orderBy: { createdAt: 'desc' },
      });

      await fromAdminSite('/api/admin/auth/refresh', admin.cookie).expect(200);

      const second = await ctx.prisma.refreshToken.findFirstOrThrow({
        where: { familyId: first.familyId, revokedAt: null },
      });
      expect(second.id).not.toBe(first.id);
      expect(second.expiresAt).toEqual(first.expiresAt);
    });

    it('ends when the account is no longer an admin', async () => {
      const admin = await signInAsAdmin(ctx);
      await ctx.app.get(UsersService).setRole(admin.email, 'STUDENT');

      await fromAdminSite('/api/admin/auth/refresh', admin.cookie).expect(401);
    });

    it("can't use an app refresh token", async () => {
      const { auth } = await createVerifiedUser(ctx);

      await fromAdminSite(
        '/api/admin/auth/refresh',
        `lf_admin_refresh=${auth.refreshToken}`,
      ).expect(401);
    });
  });

  it('signs out and clears the cookie', async () => {
    const admin = await signInAsAdmin(ctx);

    const out = await fromAdminSite(
      '/api/admin/auth/logout',
      admin.cookie,
    ).expect(204);

    expect([out.headers['set-cookie'] ?? []].flat().join(';')).toMatch(
      /lf_admin_refresh=;/,
    );
    await fromAdminSite('/api/admin/auth/refresh', admin.cookie).expect(401);
  });

  it('allows browser calls from the admin site only', async () => {
    const allowed = await ctx
      .http()
      .options('/api/admin/reports')
      .set('Origin', ADMIN_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');
    const other = await ctx
      .http()
      .options('/api/admin/reports')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(allowed.headers['access-control-allow-origin']).toBe(ADMIN_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(other.headers['access-control-allow-origin']).not.toBe(
      'https://evil.example.com',
    );
  });
});
