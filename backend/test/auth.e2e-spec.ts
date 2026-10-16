import { JwtService } from '@nestjs/jwt';
import type { AuthResponse } from '../src/auth/auth.service.js';
import { UsersService } from '../src/users/users.service.js';
import {
  createVerifiedUser,
  emailedCode,
  newStudentEmail,
  PASSWORD,
  register,
} from './support/accounts.js';
import { createTestApp, TestContext } from './support/app.js';

describe('accounts', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('POST /api/auth/register', () => {
    it('accepts a university email and emails a 6-digit code', async () => {
      const { email } = await register(ctx);

      expect(await emailedCode(ctx, email)).toMatch(/^\d{6}$/);
      const user = await ctx.prisma.user.findUnique({ where: { email } });
      expect(user?.emailVerifiedAt).toBeNull();
      expect(user?.role).toBe('STUDENT');
    });

    it('stores the email in lowercase', async () => {
      const email = newStudentEmail();
      await register(ctx, email.toUpperCase());

      expect(
        await ctx.prisma.user.findUnique({ where: { email } }),
      ).not.toBeNull();
    });

    it.each([
      'ahmad@gmail.com',
      'ahmad@evilasu.edu.jo',
      'ahmad@asu.edu.jo.evil.com',
    ])('refuses %s', async (email) => {
      const response = await ctx
        .http()
        .post('/api/auth/register')
        .send({ email, password: PASSWORD, fullName: 'Ahmad Saleh' })
        .expect(400);

      expect(response.body.code).toBe('EMAIL_DOMAIN_NOT_ALLOWED');
    });

    it('refuses a short password', async () => {
      await ctx
        .http()
        .post('/api/auth/register')
        .send({
          email: newStudentEmail(),
          password: 'short',
          fullName: 'Ahmad Saleh',
        })
        .expect(400);
    });

    it('refuses a password longer than bcrypt can check', async () => {
      await ctx
        .http()
        .post('/api/auth/register')
        .send({
          email: newStudentEmail(),
          password: 'ك'.repeat(37),
          fullName: 'Ahmad Saleh',
        })
        .expect(400);
    });

    it('refuses extra fields, so nobody can sign up as an admin', async () => {
      await ctx
        .http()
        .post('/api/auth/register')
        .send({
          email: newStudentEmail(),
          password: PASSWORD,
          fullName: 'Ahmad Saleh',
          role: 'ADMIN',
        })
        .expect(400);
    });

    it.each([
      'Ahmad,\nASU IT: forward the code to helpdesk@gmail.com',
      'Visit evil.example/login',
      'Visit evil.example',
      'Ahmad 2',
      '- Ahmad',
    ])('refuses the name %j', async (fullName) => {
      await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: newStudentEmail(), password: PASSWORD, fullName })
        .expect(400);
    });

    it.each(['أحمد صالح', "Lina O'Neil-Haddad", 'Dr. Sami Khoury'])(
      'accepts the name %j',
      async (fullName) => {
        await ctx
          .http()
          .post('/api/auth/register')
          .send({ email: newStudentEmail(), password: PASSWORD, fullName })
          .expect(202);
      },
    );

    it('leaves the name out of the verification email', async () => {
      const { email } = await register(ctx);
      await ctx.outbox.processDue();

      expect(ctx.mailer.sentTo(email)[0].text).not.toContain('Ahmad');
    });

    it('sends at most 5 codes a day to one account', async () => {
      const { email } = await register(ctx);
      for (let i = 0; i < 6; i++) {
        await ctx.prisma.emailCode.updateMany({
          where: { user: { email } },
          data: { createdAt: new Date(Date.now() - 61_000 * (i + 1)) },
        });
        await ctx
          .http()
          .post('/api/auth/resend-code')
          .send({ email })
          .expect(202);
      }
      await ctx.outbox.processDue();

      expect(ctx.mailer.sentTo(email)).toHaveLength(5);
    });

    it('answers the same for an email that already has an account, and sends nothing', async () => {
      const { email } = await createVerifiedUser(ctx);
      const emailsBefore = ctx.mailer.sentTo(email).length;

      const response = await ctx
        .http()
        .post('/api/auth/register')
        .send({ email, password: 'another-password', fullName: 'Someone Else' })
        .expect(202);

      await ctx.outbox.processDue();
      expect(response.body).toEqual({
        message: 'If the email can be used, a 6-digit code is on its way.',
      });
      expect(ctx.mailer.sentTo(email)).toHaveLength(emailsBefore);
    });

    it('does not send a second code within a minute', async () => {
      const { email } = await register(ctx);
      await register(ctx, email);
      await ctx.outbox.processDue();

      expect(ctx.mailer.sentTo(email)).toHaveLength(1);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('verifies the email and signs the student in', async () => {
      const { email, password } = await register(ctx);
      const code = await emailedCode(ctx, email);

      const response = await ctx
        .http()
        .post('/api/auth/verify-email')
        .send({ email, password, code })
        .expect(200);

      const body = response.body as AuthResponse;
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));
      expect(body.user).toMatchObject({
        email,
        fullName: 'Ahmad Saleh',
        role: 'STUDENT',
      });
      expect(JSON.stringify(body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    });

    it('needs the password used at sign-up, not only the code', async () => {
      const { email } = await register(ctx);
      const code = await emailedCode(ctx, email);

      await ctx
        .http()
        .post('/api/auth/verify-email')
        .send({ email, password: 'someone-elses-password', code })
        .expect(400);
    });

    it('refuses a wrong code', async () => {
      const { email, password } = await register(ctx);
      const code = await emailedCode(ctx, email);
      const wrong = code === '000000' ? '111111' : '000000';

      await ctx
        .http()
        .post('/api/auth/verify-email')
        .send({ email, password, code: wrong })
        .expect(400);
    });

    it('stops accepting the code after 5 wrong tries', async () => {
      const { email, password } = await register(ctx);
      const code = await emailedCode(ctx, email);
      const wrong = code === '000000' ? '111111' : '000000';

      for (let i = 0; i < 5; i++) {
        await ctx
          .http()
          .post('/api/auth/verify-email')
          .send({ email, password, code: wrong })
          .expect(400);
      }
      await ctx
        .http()
        .post('/api/auth/verify-email')
        .send({ email, password, code })
        .expect(400);
    });

    it('refuses an expired code', async () => {
      const { email, password } = await register(ctx);
      const code = await emailedCode(ctx, email);
      await ctx.prisma.emailCode.updateMany({
        where: { user: { email } },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await ctx
        .http()
        .post('/api/auth/verify-email')
        .send({ email, password, code })
        .expect(400);
    });

    it('refuses a code that was already used', async () => {
      const { email, password } = await register(ctx);
      const code = await emailedCode(ctx, email);
      await ctx
        .http()
        .post('/api/auth/verify-email')
        .send({ email, password, code })
        .expect(200);

      await ctx
        .http()
        .post('/api/auth/verify-email')
        .send({ email, password, code })
        .expect(400);
    });
  });

  describe('POST /api/auth/resend-code', () => {
    it('sends a new code once the minute has passed', async () => {
      const { email } = await register(ctx);
      const first = await emailedCode(ctx, email);
      await ctx.prisma.emailCode.updateMany({
        where: { user: { email } },
        data: { createdAt: new Date(Date.now() - 61_000) },
      });

      await ctx
        .http()
        .post('/api/auth/resend-code')
        .send({ email })
        .expect(202);

      expect(ctx.mailer.sentTo(email)).toHaveLength(1);
      const second = await emailedCode(ctx, email);
      expect(ctx.mailer.sentTo(email)).toHaveLength(2);
      expect(second).toMatch(/^\d{6}$/);
      expect(first).toMatch(/^\d{6}$/);
    });

    it('answers the same for an unknown email', async () => {
      const response = await ctx
        .http()
        .post('/api/auth/resend-code')
        .send({ email: newStudentEmail() })
        .expect(202);

      expect(response.body.message).toMatch(/code is on its way/);
    });
  });

  describe('POST /api/auth/login', () => {
    it('signs in a verified student', async () => {
      const { email, password } = await createVerifiedUser(ctx);

      const response = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: email.toUpperCase(), password })
        .expect(200);

      expect((response.body as AuthResponse).user.email).toBe(email);
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const { email } = await createVerifiedUser(ctx);

      const wrongPassword = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
      const unknownEmail = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: newStudentEmail(), password: 'wrong-password' })
        .expect(401);

      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });

    it('asks an unverified student to verify first', async () => {
      const { email, password } = await register(ctx);

      const response = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(403);

      expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
    });
  });

  describe('GET /api/users/me', () => {
    it('returns the profile of the signed-in student', async () => {
      const { email, auth } = await createVerifiedUser(ctx);

      const response = await ctx
        .http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${auth.accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ email, role: 'STUDENT' });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('needs a token', async () => {
      await ctx.http().get('/api/users/me').expect(401);
    });

    it('refuses a token signed with another secret', async () => {
      const { auth } = await createVerifiedUser(ctx);
      const forger = new JwtService({ secret: 'x'.repeat(48) });
      const forged = forger.sign(
        { sub: auth.user.id, role: 'ADMIN' },
        { issuer: 'asu-lost-and-found' },
      );

      await ctx
        .http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('refuses an unsigned token', async () => {
      const { auth } = await createVerifiedUser(ctx);
      const encode = (part: object) =>
        Buffer.from(JSON.stringify(part)).toString('base64url');
      const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
        sub: auth.user.id,
        role: 'ADMIN',
        iss: 'asu-lost-and-found',
      })}.`;

      await ctx
        .http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${unsigned}`)
        .expect(401);
    });

    it('refuses an expired token', async () => {
      const { auth } = await createVerifiedUser(ctx);
      const expired = await ctx.app
        .get(JwtService, { strict: false })
        .signAsync({ sub: auth.user.id, role: 'STUDENT' }, { expiresIn: -10 });

      await ctx
        .http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });

    it('refuses a token of an account that no longer exists', async () => {
      const { email, auth } = await createVerifiedUser(ctx);
      await ctx.prisma.user.delete({ where: { email } });

      await ctx
        .http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${auth.accessToken}`)
        .expect(401);
    });

    it('shows a role given with the set-role command', async () => {
      const { email, auth } = await createVerifiedUser(ctx);
      await ctx.app.get(UsersService).setRole(email, 'SECURITY');

      const response = await ctx
        .http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${auth.accessToken}`)
        .expect(200);

      expect(response.body.role).toBe('SECURITY');
    });
  });

  describe('refresh tokens', () => {
    const refresh = (refreshToken: string) =>
      ctx.http().post('/api/auth/refresh').send({ refreshToken });

    it('swaps a refresh token for a new pair', async () => {
      const { auth } = await createVerifiedUser(ctx);

      const response = await refresh(auth.refreshToken).expect(200);

      expect(response.body.refreshToken).not.toBe(auth.refreshToken);
      await ctx
        .http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);
    });

    it('ends the whole sign-in when an old refresh token is used again', async () => {
      const { auth } = await createVerifiedUser(ctx);
      const next = (await refresh(auth.refreshToken).expect(200))
        .body as AuthResponse;

      await refresh(auth.refreshToken).expect(401);
      await refresh(next.refreshToken).expect(401);
    });

    it('refuses an unknown refresh token', async () => {
      await refresh('a'.repeat(43)).expect(401);
    });

    it('refuses an expired refresh token', async () => {
      const { email, auth } = await createVerifiedUser(ctx);
      await ctx.prisma.refreshToken.updateMany({
        where: { user: { email } },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await refresh(auth.refreshToken).expect(401);
    });

    it('stops working after logout', async () => {
      const { auth } = await createVerifiedUser(ctx);

      await ctx
        .http()
        .post('/api/auth/logout')
        .send({ refreshToken: auth.refreshToken })
        .expect(204);

      await refresh(auth.refreshToken).expect(401);
    });

    it('keeps other devices signed in after logout on one', async () => {
      const { email, password, auth } = await createVerifiedUser(ctx);
      const phone = (
        await ctx
          .http()
          .post('/api/auth/login')
          .send({ email, password })
          .expect(200)
      ).body as AuthResponse;

      await ctx
        .http()
        .post('/api/auth/logout')
        .send({ refreshToken: auth.refreshToken });

      await refresh(phone.refreshToken).expect(200);
    });
  });

  describe('password reset', () => {
    it('emails a code and lets the student choose a new password', async () => {
      const { email, password, auth } = await createVerifiedUser(ctx);

      await ctx
        .http()
        .post('/api/auth/forgot-password')
        .send({ email })
        .expect(202);
      const code = await emailedCode(ctx, email);
      await ctx
        .http()
        .post('/api/auth/reset-password')
        .send({ email, code, newPassword: 'a-brand-new-password' })
        .expect(204);

      await ctx
        .http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(401);
      await ctx
        .http()
        .post('/api/auth/login')
        .send({ email, password: 'a-brand-new-password' })
        .expect(200);
      await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: auth.refreshToken })
        .expect(401);
    });

    it('answers the same for an unknown email and sends nothing', async () => {
      const email = newStudentEmail();

      await ctx
        .http()
        .post('/api/auth/forgot-password')
        .send({ email })
        .expect(202);
      await ctx.outbox.processDue();

      expect(ctx.mailer.sentTo(email)).toHaveLength(0);
    });

    it('refuses a wrong code and keeps the old password', async () => {
      const { email, password } = await createVerifiedUser(ctx);
      await ctx
        .http()
        .post('/api/auth/forgot-password')
        .send({ email })
        .expect(202);
      const code = await emailedCode(ctx, email);
      const wrong = code === '000000' ? '111111' : '000000';

      await ctx
        .http()
        .post('/api/auth/reset-password')
        .send({ email, code: wrong, newPassword: 'a-brand-new-password' })
        .expect(400);
      await ctx
        .http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
    });

    it('does not accept a sign-up code as a reset code', async () => {
      const { email, password } = await register(ctx);
      const signUpCode = await emailedCode(ctx, email);
      await ctx
        .http()
        .post('/api/auth/verify-email')
        .send({ email, password, code: signUpCode })
        .expect(200);

      await ctx
        .http()
        .post('/api/auth/reset-password')
        .send({ email, code: signUpCode, newPassword: 'a-brand-new-password' })
        .expect(400);
    });

    it('stops accepting codes after 15 wrong guesses in a day, even new ones', async () => {
      const { email } = await createVerifiedUser(ctx);
      const guess = (code: string) =>
        ctx
          .http()
          .post('/api/auth/reset-password')
          .send({ email, code, newPassword: 'a-brand-new-password' });

      for (let round = 0; round < 3; round++) {
        await ctx.prisma.emailCode.updateMany({
          where: { user: { email }, purpose: 'RESET_PASSWORD' },
          data: { createdAt: new Date(Date.now() - 61_000 * (round + 1)) },
        });
        await ctx.http().post('/api/auth/forgot-password').send({ email });
        const code = await emailedCode(ctx, email);
        const wrong = code === '000000' ? '111111' : '000000';
        for (let i = 0; i < 5; i++) {
          await guess(wrong).expect(400);
        }
      }

      await ctx.prisma.emailCode.updateMany({
        where: { user: { email }, purpose: 'RESET_PASSWORD' },
        data: { createdAt: new Date(Date.now() - 4 * 61_000) },
      });
      await ctx.http().post('/api/auth/forgot-password').send({ email });
      await guess(await emailedCode(ctx, email)).expect(400);
    });

    it('ends access tokens issued before the reset', async () => {
      const { email, auth } = await createVerifiedUser(ctx);
      const jwt = ctx.app.get(JwtService, { strict: false });
      const earlier = await jwt.signAsync({
        sub: auth.user.id,
        role: 'STUDENT',
        iat: Math.floor(Date.now() / 1000) - 60,
      });

      await ctx.http().post('/api/auth/forgot-password').send({ email });
      await ctx
        .http()
        .post('/api/auth/reset-password')
        .send({
          email,
          code: await emailedCode(ctx, email),
          newPassword: 'a-brand-new-password',
        })
        .expect(204);

      await ctx
        .http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${earlier}`)
        .expect(401);
      const fresh = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email, password: 'a-brand-new-password' })
        .expect(200);
      await ctx
        .http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${fresh.body.accessToken}`)
        .expect(200);
    });
  });
});
