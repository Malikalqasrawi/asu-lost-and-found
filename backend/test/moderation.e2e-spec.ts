import type { ClaimForm } from '../src/claims/claims.service.js';
import type { MyClaimView } from '../src/claims/claim-view.js';
import type { MessageView } from '../src/handovers/handover-view.js';
import type { StudentView } from '../src/moderation/bans.service.js';
import type { ReportCase } from '../src/moderation/report-cases.js';
import type { PlaceView } from '../src/places/places.service.js';
import type { PostView } from '../src/posts/post-view.js';
import { createVerifiedUser, PASSWORD } from './support/accounts.js';
import { signInAsAdmin, type Admin } from './support/admin.js';
import { createTestApp, TestContext } from './support/app.js';
import { photoWithGps } from './support/images.js';

interface Student {
  id: string;
  email: string;
  token: string;
}

describe('moderation', () => {
  let ctx: TestContext;
  let places: PlaceView[];
  let admin: Admin;
  let author: Student;
  let reader: Student;

  const student = async (): Promise<Student> => {
    const { email, auth } = await createVerifiedUser(ctx);
    return { id: auth.user.id, email, token: auth.accessToken };
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
  });

  async function post(
    who: Student,
    type: 'LOST' | 'FOUND' = 'LOST',
  ): Promise<PostView> {
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

  const cases = async (status = 'OPEN') =>
    (await as(admin).get(`/api/admin/reports?status=${status}`).expect(200))
      .body as ReportCase[];

  const caseAbout = async (id: string, status = 'OPEN') =>
    (await cases(status)).find((item) => item.target.id === id);

  const report = (who: Student, path: string, reason = 'SPAM') =>
    as(who).post(path, { reason, details: 'Posted the same thing ten times' });

  /** A found item, a claim by the owner and an accepted handover chat between them. */
  async function chat(finder: Student, owner: Student): Promise<PostView> {
    const item = await post(finder, 'FOUND');
    const form = (await as(owner).get(`/api/posts/${item.id}/claim-form`))
      .body as ClaimForm;
    const claim = (
      await as(owner)
        .post(`/api/posts/${item.id}/claims`, {
          answers: [{ questionId: form.questions[0].id, answer: 'Black' }],
        })
        .expect(201)
    ).body as MyClaimView;
    await as(finder).post(`/api/claims/${claim.id}/accept`).expect(200);
    return item;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await signInAsAdmin(ctx);
    author = await student();
    places = (await as(author).get('/api/places')).body;
  });

  beforeEach(async () => {
    author = await student();
    reader = await student();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('reporting', () => {
    it('lets a student report a post once, but not their own', async () => {
      const item = await post(author);

      await report(reader, `/api/posts/${item.id}/reports`).expect(204);
      await report(reader, `/api/posts/${item.id}/reports`).expect(409);
      await report(author, `/api/posts/${item.id}/reports`).expect(404);
      await report(reader, `/api/posts/${item.id}/reports`, 'BORING').expect(
        400,
      );
    });

    it('groups the reports about one post for the admin', async () => {
      const item = await post(author);
      await report(reader, `/api/posts/${item.id}/reports`).expect(204);
      await report(await student(), `/api/posts/${item.id}/reports`, 'FAKE');

      const found = await caseAbout(item.id);

      expect(found?.target).toMatchObject({
        kind: 'POST',
        title: 'Grey umbrella',
        hidden: false,
        author: { email: author.email },
      });
      expect(found?.reports.map((item) => item.reason).sort()).toEqual([
        'FAKE',
        'SPAM',
      ]);
    });

    it('lets a student report a message sent to them, showing the admin only that message', async () => {
      await chat(author, reader);
      const item = (await as(author).get('/api/handovers/mine')).body[0];
      await as(author)
        .post(`/api/posts/${item.postId}/messages`, { text: 'First message' })
        .expect(201);
      const rude = (
        await as(author)
          .post(`/api/posts/${item.postId}/messages`, { text: 'Rude message' })
          .expect(201)
      ).body as MessageView;

      await report(author, `/api/messages/${rude.id}/reports`).expect(404);
      await report(await student(), `/api/messages/${rude.id}/reports`).expect(
        404,
      );
      await report(
        reader,
        `/api/messages/${rude.id}/reports`,
        'OFFENSIVE',
      ).expect(204);

      const found = await caseAbout(rude.id);
      expect(found?.target).toMatchObject({
        kind: 'MESSAGE',
        text: 'Rude message',
        sender: { email: author.email },
      });
      expect(JSON.stringify(found)).not.toContain('First message');
    });

    it('is for admins with a website session only', async () => {
      await as(reader).get('/api/admin/reports').expect(403);
      await as({ token: admin.appToken }).get('/api/admin/reports').expect(403);
    });
  });

  describe('deciding', () => {
    it('hides a post from everyone but its author and tells them', async () => {
      const item = await post(author);
      await report(reader, `/api/posts/${item.id}/reports`).expect(204);

      await as(admin).post(`/api/admin/posts/${item.id}/hide`).expect(204);

      await as(reader).get(`/api/posts/${item.id}`).expect(404);
      const browse = (await as(reader).get('/api/posts?limit=50')).body;
      expect(JSON.stringify(browse)).not.toContain(item.id);
      const own = (await as(author).get(`/api/posts/${item.id}`).expect(200))
        .body as PostView;
      expect(own.hidden).toBe(true);
      expect(await caseAbout(item.id)).toBeUndefined();
      expect((await caseAbout(item.id, 'RESOLVED'))?.target).toMatchObject({
        hidden: true,
      });
      await ctx.outbox.processDue();
      expect(ctx.mailer.sentTo(author.email).at(-1)?.subject).toBe(
        'A moderator hid your post',
      );

      await as(admin).post(`/api/admin/posts/${item.id}/restore`).expect(204);
      await as(reader).get(`/api/posts/${item.id}`).expect(200);
    });

    it('lets the admin see the photo of a hidden post, and nobody else but its author', async () => {
      const created = await ctx
        .http()
        .post('/api/posts')
        .set('Authorization', `Bearer ${author.token}`)
        .field('type', 'LOST')
        .field('title', 'Grey umbrella')
        .field('category', 'OTHER')
        .field('placeId', places[0].id)
        .field('happenedOn', new Date().toISOString().slice(0, 10))
        .attach('photos', await photoWithGps(200, 150), 'umbrella.jpg')
        .expect(201);
      const item = created.body as PostView;
      await as(admin).post(`/api/admin/posts/${item.id}/hide`).expect(204);

      await as(admin).get(`/api/photos/${item.photoIds[0]}`).expect(200);
      await as({ token: admin.appToken })
        .get(`/api/photos/${item.photoIds[0]}`)
        .expect(404);
      await as(reader).get(`/api/photos/${item.photoIds[0]}`).expect(404);
      await as(author).get(`/api/photos/${item.photoIds[0]}`).expect(200);
    });

    it('closes the waiting claims of a post it hides, and refuses to accept them', async () => {
      const item = await post(author, 'FOUND');
      const form = (await as(reader).get(`/api/posts/${item.id}/claim-form`))
        .body as ClaimForm;
      const claim = (
        await as(reader)
          .post(`/api/posts/${item.id}/claims`, {
            answers: [{ questionId: form.questions[0].id, answer: 'Black' }],
          })
          .expect(201)
      ).body as MyClaimView;
      const other = await student();
      const otherForm = (
        await as(other).get(`/api/posts/${item.id}/claim-form`)
      ).body as ClaimForm;
      const waiting = (
        await as(other)
          .post(`/api/posts/${item.id}/claims`, {
            answers: [{ questionId: otherForm.questions[0].id, answer: 'Red' }],
          })
          .expect(201)
      ).body as MyClaimView;

      await as(admin).post(`/api/admin/posts/${item.id}/hide`).expect(204);

      await as(author).post(`/api/claims/${claim.id}/accept`).expect(409);
      const mine = (await as(other).get('/api/claims/mine'))
        .body as MyClaimView[];
      expect(mine.find((one) => one.id === waiting.id)?.status).toBe('CLOSED');
      await ctx.outbox.processDue();
      expect(ctx.mailer.sentTo(other.email).at(-1)?.subject).toBe(
        'An item you claimed is no longer listed',
      );
    });

    it('removes a message from the chat for both students', async () => {
      const item = await chat(author, reader);
      const sent = (
        await as(author)
          .post(`/api/posts/${item.id}/messages`, { text: 'Rude message' })
          .expect(201)
      ).body as MessageView;
      await report(reader, `/api/messages/${sent.id}/reports`).expect(204);

      await as(admin).post(`/api/admin/messages/${sent.id}/remove`).expect(204);

      for (const who of [author, reader]) {
        const messages = (
          await as(who).get(`/api/posts/${item.id}/messages`).expect(200)
        ).body as MessageView[];
        expect(messages).toEqual([
          expect.objectContaining({ id: sent.id, text: '', removed: true }),
        ]);
      }
      const preview = (await as(reader).get('/api/handovers/mine')).body[0];
      expect(preview.lastMessage).toMatchObject({ text: '', removed: true });
    });

    it('dismisses reports without changing anything', async () => {
      const item = await post(author);
      await report(reader, `/api/posts/${item.id}/reports`).expect(204);

      await as(admin)
        .post(`/api/admin/posts/${item.id}/reports/dismiss`)
        .expect(204);

      expect(await caseAbout(item.id, 'DISMISSED')).toBeDefined();
      await as(reader).get(`/api/posts/${item.id}`).expect(200);
      await as(admin)
        .post(`/api/admin/posts/${item.id}/reports/dismiss`)
        .expect(404);
    });
  });

  describe('banning', () => {
    const ban = (who: Student, body: object) =>
      as(admin).post(`/api/admin/users/${who.id}/ban`, body);

    it('signs the student out, keeps them out, hides their posts and closes their claims', async () => {
      const item = await post(author);
      const found = await post(reader, 'FOUND');
      const form = (await as(author).get(`/api/posts/${found.id}/claim-form`))
        .body as ClaimForm;
      const claim = (
        await as(author)
          .post(`/api/posts/${found.id}/claims`, {
            answers: [{ questionId: form.questions[0].id, answer: 'Black' }],
          })
          .expect(201)
      ).body as MyClaimView;

      const banned = (
        await ban(author, { reason: 'Posting fake items', days: 7 }).expect(200)
      ).body as StudentView;

      expect(banned.ban).toMatchObject({ reason: 'Posting fake items' });
      await as(author).get('/api/users/me').expect(401);
      const login = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: author.email, password: PASSWORD })
        .expect(403);
      expect(login.body.code).toBe('ACCOUNT_BANNED');
      expect(login.body.message).toMatch(/blocked until/);
      await as(reader).get(`/api/posts/${item.id}`).expect(404);
      const claims = (await as(reader).get(`/api/posts/${found.id}/claims`))
        .body as { claims: { id: string; status: string }[] };
      expect(claims.claims.find((one) => one.id === claim.id)?.status).toBe(
        'CLOSED',
      );
      await ctx.outbox.processDue();
      const email = ctx.mailer.sentTo(author.email).at(-1);
      expect(email?.subject).toBe('Your ASU Lost & Found account is blocked');
      expect(email?.text).toContain('Reason: Posting fake items');
    });

    it('drops an email change the student had started', async () => {
      await as(author)
        .post('/api/users/me/email', {
          newEmail: `${String(Date.now()).slice(-9)}@students.asu.edu.jo`,
          password: PASSWORD,
        })
        .expect(202);

      await ban(author, { reason: 'Posting fake items', days: 7 }).expect(200);

      const row = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: author.id },
      });
      expect(row.pendingEmail).toBeNull();
      const codes = await ctx.prisma.emailCode.count({
        where: { userId: author.id, purpose: 'CHANGE_EMAIL' },
      });
      expect(codes).toBe(0);
    });

    it('neither finds nor bans a deleted account', async () => {
      await ctx
        .http()
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${author.token}`)
        .send({ password: PASSWORD })
        .expect(204);

      const found = (await as(admin).get('/api/admin/users?q=Deleted'))
        .body as StudentView[];
      expect(found.map((one) => one.id)).not.toContain(author.id);
      await ban(author, { reason: 'Posting fake items', days: 7 }).expect(404);
    });

    it('keeps a post a moderator hid hidden after the ban ends', async () => {
      const item = await post(author);
      await ban(author, { reason: 'Spam' }).expect(200);

      await as(admin).post(`/api/admin/posts/${item.id}/hide`).expect(204);
      await as(admin).post(`/api/admin/users/${author.id}/unban`).expect(200);

      await as(reader).get(`/api/posts/${item.id}`).expect(404);
    });

    it('keeps a restored post hidden by the ban until the ban ends', async () => {
      const item = await post(author);
      await ban(author, { reason: 'Spam' }).expect(200);
      await as(admin).post(`/api/admin/posts/${item.id}/hide`).expect(204);

      await as(admin).post(`/api/admin/posts/${item.id}/restore`).expect(204);
      await as(reader).get(`/api/posts/${item.id}`).expect(404);

      await as(admin).post(`/api/admin/users/${author.id}/unban`).expect(200);
      await as(reader).get(`/api/posts/${item.id}`).expect(200);
    });

    it('records which admin did what', async () => {
      const item = await post(author);
      await report(reader, `/api/posts/${item.id}/reports`).expect(204);
      await as(admin)
        .post(`/api/admin/posts/${item.id}/reports/dismiss`)
        .expect(204);
      await ban(author, { reason: 'Posting fake items' }).expect(200);
      await as(admin).post(`/api/admin/users/${author.id}/unban`).expect(200);

      const log = (await as(admin).get('/api/admin/log').expect(200)).body as {
        action: string;
        admin: string;
        about: string;
        note: string;
      }[];

      expect(log.slice(0, 3)).toEqual([
        expect.objectContaining({
          action: 'UNBAN',
          about: expect.stringContaining(author.email),
        }),
        expect.objectContaining({ action: 'BAN', note: 'Posting fake items' }),
        expect.objectContaining({
          action: 'DISMISS_REPORTS',
          about: 'Post "Grey umbrella"',
        }),
      ]);
      expect(log[0].admin).toBe('Ahmad Saleh');
      // The API's database login can add to the log, but not rewrite it.
      await expect(ctx.prisma.moderationLog.deleteMany()).rejects.toThrow();
      await expect(
        ctx.prisma.moderationLog.updateMany({ data: { note: '' } }),
      ).rejects.toThrow();
      await as(reader).get('/api/admin/log').expect(403);
    });

    it('lets the student back in with their posts when unbanned', async () => {
      const item = await post(author);
      await ban(author, { reason: 'Spam' }).expect(200);

      const lifted = (
        await as(admin).post(`/api/admin/users/${author.id}/unban`).expect(200)
      ).body as StudentView;

      expect(lifted.ban).toBeNull();
      await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: author.email, password: PASSWORD })
        .expect(200);
      await as(reader).get(`/api/posts/${item.id}`).expect(200);
    });

    it('ends by itself on the end date', async () => {
      const item = await post(author);
      await ban(author, { reason: 'Spam', days: 1 }).expect(200);
      await ctx.prisma.user.update({
        where: { id: author.id },
        data: { bannedUntil: new Date(Date.now() - 1000) },
      });

      await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: author.email, password: PASSWORD })
        .expect(200);
      await as(reader).get(`/api/posts/${item.id}`).expect(200);
    });

    it('needs a reason and refuses admin accounts', async () => {
      await ban(author, { days: 3 }).expect(400);
      await ban(author, { reason: 'Spam', days: 0 }).expect(400);
      const other = await signInAsAdmin(ctx);
      const otherId = (await as(other).get('/api/users/me')).body.id as string;

      await as(admin)
        .post(`/api/admin/users/${otherId}/ban`, { reason: 'Spam' })
        .expect(403);
    });

    it('finds students by name or email', async () => {
      const found = (
        await as(admin)
          .get(`/api/admin/users?q=${encodeURIComponent(author.email)}`)
          .expect(200)
      ).body as StudentView[];

      expect(found).toEqual([
        expect.objectContaining({ id: author.id, ban: null }),
      ]);
    });
  });
});
