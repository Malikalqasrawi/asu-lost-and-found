import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse } from '../src/auth/auth.service.js';
import { type ClaimForm, MAX_CLAIMS } from '../src/claims/claims.service.js';
import type { MyClaimView } from '../src/claims/claim-view.js';
import type { PlaceView } from '../src/places/places.service.js';
import type { PostView } from '../src/posts/post-view.js';
import { UsersService } from '../src/users/users.service.js';
import {
  createVerifiedUser,
  emailedCode,
  PASSWORD,
  register,
} from './support/accounts.js';
import { createTestApp, TestContext } from './support/app.js';
import { microsoftIdToken, microsoftNonce } from './support/microsoft.js';

interface Student {
  id: string;
  email: string;
  token: string;
  refreshToken: string;
}

describe('account settings', () => {
  let ctx: TestContext;
  let places: PlaceView[];
  let me: Student;

  const student = async (): Promise<Student> => {
    const { email, auth } = await createVerifiedUser(ctx);
    return {
      id: auth.user.id,
      email,
      token: auth.accessToken,
      refreshToken: auth.refreshToken,
    };
  };
  const as = (who: { token: string }) => ({
    get: (path: string) =>
      ctx.http().get(path).set('Authorization', `Bearer ${who.token}`),
    post: (path: string, body?: object) =>
      ctx
        .http()
        .post(path)
        .set('Authorization', `Bearer ${who.token}`)
        .send(body),
    delete: (path: string, body?: object) =>
      ctx
        .http()
        .delete(path)
        .set('Authorization', `Bearer ${who.token}`)
        .send(body),
  });
  const login = (email: string) =>
    ctx.http().post('/api/auth/login').send({ email, password: PASSWORD });

  async function lastCode(email: string): Promise<string> {
    await ctx.outbox.processDue();
    return ctx.mailer.lastCodeFor(email);
  }

  const newStudentNumber = () =>
    `${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;

  async function post(who: Student, type: 'LOST' | 'FOUND'): Promise<PostView> {
    const request = ctx
      .http()
      .post('/api/posts')
      .set('Authorization', `Bearer ${who.token}`)
      .field('type', type)
      .field('title', 'Grey umbrella')
      .field('category', 'OTHER')
      .field('placeId', places[0].id)
      .field('happenedOn', new Date().toISOString().slice(0, 10));
    if (type === 'FOUND') {
      request.field('questions', 'What colour is the handle?');
    }
    return (await request.expect(201)).body as PostView;
  }

  async function claim(who: Student, postId: string): Promise<MyClaimView> {
    const form = (await as(who).get(`/api/posts/${postId}/claim-form`))
      .body as ClaimForm;
    return (
      await as(who)
        .post(`/api/posts/${postId}/claims`, {
          answers: [{ questionId: form.questions[0].id, answer: 'Black' }],
        })
        .expect(201)
    ).body as MyClaimView;
  }

  const fromAuth = (email: string, auth: AuthResponse): Student => ({
    id: auth.user.id,
    email,
    token: auth.accessToken,
    refreshToken: auth.refreshToken,
  });

  async function signUpAgain(email: string): Promise<Student> {
    await register(ctx, email);
    const code = await emailedCode(ctx, email);
    const response = await ctx
      .http()
      .post('/api/auth/verify-email')
      .send({ email, password: PASSWORD, code })
      .expect(200);
    return fromAuth(email, response.body as AuthResponse);
  }

  async function withMicrosoft(
    oid: string,
    email: string,
  ): Promise<AuthResponse> {
    const nonce = await microsoftNonce(ctx);
    const idToken = await microsoftIdToken({ oid, email, nonce });
    const response = await ctx
      .http()
      .post('/api/auth/microsoft')
      .send({ idToken })
      .expect(200);
    return response.body as AuthResponse;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    me = await student();
    places = (await as(me).get('/api/places')).body;
  });

  beforeEach(async () => {
    me = await student();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('says whether the account has a password', async () => {
    const profile = (await as(me).get('/api/users/me').expect(200)).body;

    expect(profile.hasPassword).toBe(true);
  });

  it('needs a signed-in student for every account setting', async () => {
    const newEmail = `${newStudentNumber()}@students.asu.edu.jo`;

    const responses = await Promise.all([
      ctx.http().post('/api/users/me/confirmation-code'),
      ctx
        .http()
        .post('/api/users/me/email')
        .send({ newEmail, password: PASSWORD }),
      ctx.http().post('/api/users/me/email/confirm').send({ code: '123456' }),
      ctx.http().delete('/api/users/me').send({ password: PASSWORD }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401, 401,
    ]);
  });

  it('never shows the pending email, the Microsoft link or any hash', async () => {
    await ctx.prisma.user.update({
      where: { id: me.id },
      data: { microsoftId: `tenant:${randomUUID()}` },
    });
    await as(me)
      .post('/api/users/me/email', {
        newEmail: `${newStudentNumber()}@students.asu.edu.jo`,
        password: PASSWORD,
      })
      .expect(202);

    const profile = (await as(me).get('/api/users/me').expect(200)).body;

    expect(Object.keys(profile).sort()).toEqual([
      'createdAt',
      'email',
      'fullName',
      'hasPassword',
      'id',
      'role',
    ]);
  });

  describe('changing the email', () => {
    it('needs the password and an address that follows the email rule', async () => {
      const newEmail = `${newStudentNumber()}@students.asu.edu.jo`;

      await as(me)
        .post('/api/users/me/email', { newEmail, password: 'not-my-password' })
        .expect(403);
      await as(me)
        .post('/api/users/me/email', {
          newEmail: 'me@gmail.com',
          password: PASSWORD,
        })
        .expect(400);
      await as(me)
        .post('/api/users/me/email', { newEmail, code: '123456' })
        .expect(403);
      await as(me).post('/api/users/me/email', { newEmail }).expect(400);
    });

    it('answers the same for an address that already has an account, without emailing it', async () => {
      const other = await student();
      await ctx.outbox.processDue();
      const before = ctx.mailer.sentTo(other.email).length;

      await as(me)
        .post('/api/users/me/email', {
          newEmail: other.email,
          password: PASSWORD,
        })
        .expect(202);

      await ctx.outbox.processDue();
      expect(ctx.mailer.sentTo(other.email)).toHaveLength(before);
    });

    it('moves the account once the code sent to the new address is entered', async () => {
      const newEmail = `${newStudentNumber()}@students.asu.edu.jo`;
      await as(me)
        .post('/api/users/me/email', { newEmail, password: PASSWORD })
        .expect(202);
      const code = await lastCode(newEmail);

      await as(me)
        .post('/api/users/me/email/confirm', {
          code: code === '000000' ? '111111' : '000000',
        })
        .expect(400);
      const changed = await as(me)
        .post('/api/users/me/email/confirm', { code })
        .expect(200);

      expect(changed.body.user.email).toBe(newEmail);
      expect(changed.body.accessToken).toEqual(expect.any(String));
      await login(newEmail).expect(200);
      await login(me.email).expect(401);
      await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: me.refreshToken })
        .expect(401);
      await ctx.outbox.processDue();
      const notice = ctx.mailer.sentTo(me.email).at(-1);
      expect(notice?.subject).toBe('Your ASU Lost & Found email was changed');
      expect(notice?.text).toContain(newEmail);
    });

    it('can be confirmed with an emailed code by an account without a password', async () => {
      await ctx.prisma.user.update({
        where: { id: me.id },
        data: { passwordHash: null },
      });
      const profile = (await as(me).get('/api/users/me')).body;
      expect(profile.hasPassword).toBe(false);

      await as(me).post('/api/users/me/confirmation-code').expect(202);
      const code = await lastCode(me.email);
      const newEmail = `${newStudentNumber()}@students.asu.edu.jo`;

      await as(me).post('/api/users/me/email', { newEmail, code }).expect(202);
      await as(me)
        .post('/api/users/me/email/confirm', { code: await lastCode(newEmail) })
        .expect(200);
    });

    it('drops the Microsoft link with the old address, and the new address links again', async () => {
      const oid = randomUUID();
      const oldEmail = `${newStudentNumber()}@students.asu.edu.jo`;
      const first = await withMicrosoft(oid, oldEmail);
      const account = fromAuth(oldEmail, first);
      await as(account).post('/api/users/me/confirmation-code').expect(202);
      const newEmail = `${newStudentNumber()}@students.asu.edu.jo`;
      await as(account)
        .post('/api/users/me/email', {
          newEmail,
          code: await lastCode(oldEmail),
        })
        .expect(202);
      await as(account)
        .post('/api/users/me/email/confirm', {
          code: await lastCode(newEmail),
        })
        .expect(200);

      const row = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: first.user.id },
      });
      expect(row).toMatchObject({ email: newEmail, microsoftId: null });
      const again = await withMicrosoft(oid, newEmail);
      expect(again.user.id).toBe(first.user.id);
    });

    it('refuses the address the account already uses', async () => {
      const response = await as(me)
        .post('/api/users/me/email', {
          newEmail: me.email.toUpperCase(),
          password: PASSWORD,
        })
        .expect(400);

      expect(response.body.message).toBe('That is already your email.');
    });

    it('refuses a code when no change was started', async () => {
      await as(me)
        .post('/api/users/me/email/confirm', { code: '123456' })
        .expect(400);
    });

    it('ends access tokens issued before the change', async () => {
      const jwt = ctx.app.get(JwtService, { strict: false });
      const earlier = await jwt.signAsync({
        sub: me.id,
        role: 'STUDENT',
        iat: Math.floor(Date.now() / 1000) - 60,
      });
      await as({ token: earlier }).get('/api/users/me').expect(200);
      const newEmail = `${newStudentNumber()}@students.asu.edu.jo`;
      await as(me)
        .post('/api/users/me/email', { newEmail, password: PASSWORD })
        .expect(202);

      const changed = await as(me)
        .post('/api/users/me/email/confirm', { code: await lastCode(newEmail) })
        .expect(200);

      await as({ token: earlier }).get('/api/users/me').expect(401);
      await as({ token: changed.body.accessToken })
        .get('/api/users/me')
        .expect(200);
    });

    it('refuses the change when the new address got an account in the meantime', async () => {
      const newEmail = `${newStudentNumber()}@students.asu.edu.jo`;
      await as(me)
        .post('/api/users/me/email', { newEmail, password: PASSWORD })
        .expect(202);
      const code = await lastCode(newEmail);
      await signUpAgain(newEmail);

      await as(me).post('/api/users/me/email/confirm', { code }).expect(409);

      await login(me.email).expect(200);
    });

    it('moves to an address that only has a sign-up nobody confirmed', async () => {
      const newEmail = `${newStudentNumber()}@students.asu.edu.jo`;
      await register(ctx, newEmail);
      await as(me)
        .post('/api/users/me/email', { newEmail, password: PASSWORD })
        .expect(202);

      await as(me)
        .post('/api/users/me/email/confirm', { code: await lastCode(newEmail) })
        .expect(200);

      const owners = await ctx.prisma.user.findMany({
        where: { email: newEmail },
      });
      expect(owners.map((owner) => owner.id)).toEqual([me.id]);
    });

    it('sends one code when two changes are asked for at the same moment', async () => {
      const number = newStudentNumber().slice(0, 8);
      const [first, second] = await Promise.all(
        [`1`, `2`].map((digit) =>
          as(me).post('/api/users/me/email', {
            newEmail: `${number}${digit}@students.asu.edu.jo`,
            password: PASSWORD,
          }),
        ),
      );

      expect([first.status, second.status].sort((a, b) => a - b)).toEqual([
        202, 429,
      ]);
    });

    it('never moves the account to an address the code was not sent to', async () => {
      const number = newStudentNumber().slice(0, 8);
      const reachable = `${number}1@students.asu.edu.jo`;
      const elsewhere = `${number}2@students.asu.edu.jo`;
      await as(me)
        .post('/api/users/me/email', {
          newEmail: reachable,
          password: PASSWORD,
        })
        .expect(202);
      const code = await lastCode(reachable);
      await as(me)
        .post('/api/users/me/email', {
          newEmail: elsewhere,
          password: PASSWORD,
        })
        .expect(429);

      await as(me).post('/api/users/me/email/confirm', { code }).expect(200);

      const row = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: me.id },
      });
      expect(row.email).toBe(reachable);
    });
  });

  describe('deleting the account', () => {
    it('erases the name and email, closes posts and claims, and frees the email', async () => {
      const lost = await post(me, 'LOST');
      const found = await post(me, 'FOUND');
      const claimant = await student();
      const waiting = await claim(claimant, found.id);
      const finder = await student();
      const otherItem = await post(finder, 'FOUND');
      const mine = await claim(me, otherItem.id);

      await as(me)
        .delete('/api/users/me', { password: 'not-my-password' })
        .expect(403);
      await as(me).delete('/api/users/me', { password: PASSWORD }).expect(204);

      await login(me.email).expect(401);
      await as(me).get('/api/users/me').expect(401);
      const row = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: me.id },
      });
      expect(row).toMatchObject({
        fullName: 'Deleted student',
        passwordHash: null,
        emailVerifiedAt: null,
      });
      expect(row.email).not.toBe(me.email);
      await as(claimant).get(`/api/posts/${lost.id}`).expect(404);
      const claims = (await as(claimant).get('/api/claims/mine'))
        .body as MyClaimView[];
      expect(claims.find((one) => one.id === waiting.id)?.status).toBe(
        'CLOSED',
      );
      const myClaim = await ctx.prisma.claim.findUniqueOrThrow({
        where: { id: mine.id },
      });
      expect(myClaim.status).toBe('WITHDRAWN');
      await ctx.outbox.processDue();
      expect(
        ctx.mailer.sentTo(me.email).map((message) => message.subject),
      ).toContain('Your ASU Lost & Found account was deleted');
      await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: me.email, password: PASSWORD, fullName: 'Ahmad Saleh' })
        .expect(202);
    });

    it('keeps the claims used before deleting when the student signs up again', async () => {
      const finder = await student();
      const item = await post(finder, 'FOUND');
      await claim(me, item.id);
      await as(me).delete('/api/users/me', { password: PASSWORD }).expect(204);

      await register(ctx, me.email);
      const code = await emailedCode(ctx, me.email);
      const again = (
        await ctx
          .http()
          .post('/api/auth/verify-email')
          .send({ email: me.email, password: PASSWORD, code })
          .expect(200)
      ).body as AuthResponse;

      const form = (
        await as({ token: again.accessToken }).get(
          `/api/posts/${item.id}/claim-form`,
        )
      ).body as ClaimForm;
      expect(form.attemptsLeft).toBe(MAX_CLAIMS - 1);
    });

    it('refuses a fourth claim on an item after deleting and making the account again', async () => {
      const finder = await student();
      const item = await post(finder, 'FOUND');
      const firstTry = await claim(me, item.id);
      await as(finder).post(`/api/claims/${firstTry.id}/reject`).expect(200);
      await as(me).delete('/api/users/me', { password: PASSWORD }).expect(204);
      const second = await signUpAgain(me.email);
      const secondTry = await claim(second, item.id);
      await as(finder).post(`/api/claims/${secondTry.id}/reject`).expect(200);
      await as(second)
        .delete('/api/users/me', { password: PASSWORD })
        .expect(204);
      const third = await signUpAgain(me.email);
      await claim(third, item.id);
      await as(third)
        .delete('/api/users/me', { password: PASSWORD })
        .expect(204);
      const fourth = await signUpAgain(me.email);
      const form = (
        await as(fourth).get(`/api/posts/${item.id}/claim-form`).expect(200)
      ).body as ClaimForm;

      const refused = await as(fourth)
        .post(`/api/posts/${item.id}/claims`, {
          answers: [{ questionId: form.questions[0].id, answer: 'Black' }],
        })
        .expect(403);

      expect(form.attemptsLeft).toBe(0);
      expect(refused.body.code).toBe('CLAIM_LIMIT');
    });

    it('keeps the claims used before deleting when the student comes back through Microsoft', async () => {
      const oid = randomUUID();
      const email = `${newStudentNumber()}@students.asu.edu.jo`;
      const first = await withMicrosoft(oid, email);
      const before = fromAuth(email, first);
      const finder = await student();
      const item = await post(finder, 'FOUND');
      await claim(before, item.id);
      await as(before).post('/api/users/me/confirmation-code').expect(202);
      await as(before)
        .delete('/api/users/me', { code: await lastCode(email) })
        .expect(204);

      const again = await withMicrosoft(oid, email);

      expect(again.user.id).not.toBe(first.user.id);
      const form = (
        await as({ token: again.accessToken }).get(
          `/api/posts/${item.id}/claim-form`,
        )
      ).body as ClaimForm;
      expect(form.attemptsLeft).toBe(MAX_CLAIMS - 1);
    });

    it('ends every session of the deleted account', async () => {
      await as(me).delete('/api/users/me', { password: PASSWORD }).expect(204);

      await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: me.refreshToken })
        .expect(401);
    });

    it('does not take a made-up password from an account without one', async () => {
      await ctx.prisma.user.update({
        where: { id: me.id },
        data: { passwordHash: null },
      });

      await as(me)
        .delete('/api/users/me', { password: 'not-a-real-password' })
        .expect(403);
    });

    it('waits until a handover is finished', async () => {
      const found = await post(me, 'FOUND');
      const owner = await student();
      const accepted = await claim(owner, found.id);
      await as(me).post(`/api/claims/${accepted.id}/accept`).expect(200);

      const refused = await as(me)
        .delete('/api/users/me', { password: PASSWORD })
        .expect(409);
      expect(refused.body.message).toMatch(/handovers/);
      await as(owner)
        .delete('/api/users/me', { password: PASSWORD })
        .expect(409);
    });

    it('is refused while banned and for admins', async () => {
      await ctx.prisma.user.update({
        where: { id: me.id },
        data: { bannedAt: new Date(), banReason: 'Spam' },
      });
      // A banned account is turned away before it reaches the account settings.
      await as(me).delete('/api/users/me', { password: PASSWORD }).expect(401);
      const admin = await student();
      await ctx.app.get(UsersService).setRole(admin.email, 'ADMIN');

      await as(admin)
        .delete('/api/users/me', { password: PASSWORD })
        .expect(403);
    });
  });
});
