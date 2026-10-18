import type { ClaimForm } from '../src/claims/claims.service.js';
import type { MyClaimView } from '../src/claims/claim-view.js';
import type { DeskItemView } from '../src/handovers/desk.service.js';
import type {
  HandoverSummary,
  HandoverView,
  MessageView,
} from '../src/handovers/handover-view.js';
import type { PlaceView } from '../src/places/places.service.js';
import type { PostView } from '../src/posts/post-view.js';
import { UsersService } from '../src/users/users.service.js';
import { createVerifiedUser } from './support/accounts.js';
import { createTestApp, TestContext } from './support/app.js';
import { photoWithGps } from './support/images.js';

interface Student {
  email: string;
  token: string;
}

describe('handovers', () => {
  let ctx: TestContext;
  let places: PlaceView[];
  let finder: Student;
  let owner: Student;
  let security: Student;

  const student = async (): Promise<Student> => {
    const { email, auth } = await createVerifiedUser(ctx);
    return { email, token: auth.accessToken };
  };
  const as = (who: Student) => ({
    get: (path: string) =>
      ctx.http().get(path).set('Authorization', `Bearer ${who.token}`),
    post: (path: string, body?: object) =>
      ctx
        .http()
        .post(path)
        .set('Authorization', `Bearer ${who.token}`)
        .send(body),
    delete: (path: string) =>
      ctx.http().delete(path).set('Authorization', `Bearer ${who.token}`),
  });

  async function foundItem(): Promise<PostView> {
    const response = await ctx
      .http()
      .post('/api/posts')
      .set('Authorization', `Bearer ${finder.token}`)
      .field('type', 'FOUND')
      .field('title', 'Black leather wallet')
      .field('category', 'WALLET')
      .field('placeId', places[1].id)
      .field('happenedOn', new Date().toISOString().slice(0, 10))
      .field('questions', 'What is inside the wallet?')
      .attach('photos', await photoWithGps(200, 150), 'wallet.jpg')
      .expect(201);
    return response.body as PostView;
  }

  /** A found item whose claim by the owner the finder has accepted. */
  async function acceptedItem(
    post?: PostView,
    claimant: Student = owner,
  ): Promise<PostView> {
    const item = post ?? (await foundItem());
    const form = (
      await as(claimant).get(`/api/posts/${item.id}/claim-form`).expect(200)
    ).body as ClaimForm;
    const claim = (
      await as(claimant)
        .post(`/api/posts/${item.id}/claims`, {
          answers: [{ questionId: form.questions[0].id, answer: 'My ID card' }],
        })
        .expect(201)
    ).body as MyClaimView;
    await as(finder).post(`/api/claims/${claim.id}/accept`).expect(200);
    return item;
  }

  const handover = async (who: Student, postId: string) =>
    (await as(who).get(`/api/posts/${postId}/handover`).expect(200))
      .body as HandoverView;

  const pickupCode = async (postId: string) =>
    (await handover(owner, postId)).pickupCode!;

  const wrongCodeFor = (code: string) =>
    code === '123456' ? '654321' : '123456';

  const handOver = (who: Student, postId: string, code: string) =>
    as(who).post(`/api/posts/${postId}/handover/return`, { code });

  /** One batch of queued emails goes out in no fixed order. */
  const subjectsTo = (who: Student) =>
    ctx.mailer.sentTo(who.email).map((email) => email.subject);

  const deskItems = async (status: 'ON_THE_WAY' | 'AT_DESK') =>
    (await as(security).get(`/api/desk/items?status=${status}`).expect(200))
      .body as DeskItemView[];

  beforeAll(async () => {
    ctx = await createTestApp();
    finder = await student();
    places = (await as(finder).get('/api/places')).body;
    security = await student();
    await ctx.app.get(UsersService).setRole(security.email, 'SECURITY');
  });

  beforeEach(async () => {
    finder = await student();
    owner = await student();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('starting', () => {
    it('gives the owner a pickup code once the finder accepts the claim', async () => {
      const post = await acceptedItem();

      const asOwner = await handover(owner, post.id);
      const asFinder = await handover(finder, post.id);

      expect(asOwner).toMatchObject({
        role: 'OWNER',
        title: 'Black leather wallet',
        otherPerson: { firstName: 'Ahmad' },
        codeLocked: false,
        returnedAt: null,
      });
      expect(asOwner.pickupCode).toMatch(/^\d{6}$/);
      expect(asFinder.role).toBe('FINDER');
      expect(asFinder.pickupCode).toBeNull();
    });

    it("answers 404 to everyone else, the same as a handover that doesn't exist", async () => {
      const post = await acceptedItem();
      const stranger = await student();
      const code = await pickupCode(post.id);

      await as(stranger).get(`/api/posts/${post.id}/handover`).expect(404);
      await as(stranger).get(`/api/posts/${post.id}/messages`).expect(404);
      await as(stranger)
        .post(`/api/posts/${post.id}/messages`, { text: 'Hello' })
        .expect(404);
      await handOver(stranger, post.id, code).expect(404);
      await handOver(owner, post.id, code).expect(404);
      await as(finder)
        .post(`/api/posts/${post.id}/handover/new-code`)
        .expect(404);
    });

    it('has no handover before a claim is accepted', async () => {
      const post = await foundItem();

      await as(finder).get(`/api/posts/${post.id}/handover`).expect(404);
    });
  });

  describe('messages', () => {
    it('lets the finder and the owner write to each other and counts unread ones', async () => {
      const post = await acceptedItem();

      const sent = await as(owner)
        .post(`/api/posts/${post.id}/messages`, {
          text: '  Can we meet at the library at 2?  ',
        })
        .expect(201);

      expect(sent.body).toMatchObject({
        mine: true,
        text: 'Can we meet at the library at 2?',
      });
      expect((await handover(finder, post.id)).unread).toBe(1);
      const mine = (await as(finder).get('/api/handovers/mine').expect(200))
        .body as HandoverSummary[];
      expect(mine).toEqual([
        expect.objectContaining({
          postId: post.id,
          role: 'FINDER',
          unread: 1,
          lastMessage: expect.objectContaining({ mine: false }),
        }),
      ]);

      const read = (
        await as(finder).get(`/api/posts/${post.id}/messages`).expect(200)
      ).body as MessageView[];
      expect(read.map((message) => [message.mine, message.text])).toEqual([
        [false, 'Can we meet at the library at 2?'],
      ]);
      expect((await handover(finder, post.id)).unread).toBe(0);
    });

    it('lists the chats with the latest activity first', async () => {
      const older = await acceptedItem();
      const newer = await acceptedItem();
      await as(owner)
        .post(`/api/posts/${older.id}/messages`, { text: 'First' })
        .expect(201);
      await as(owner)
        .post(`/api/posts/${older.id}/messages`, { text: 'Second' })
        .expect(201);

      const mine = (await as(finder).get('/api/handovers/mine').expect(200))
        .body as HandoverSummary[];

      expect(
        mine.map((item) => [item.postId, item.unread, item.lastMessage?.text]),
      ).toEqual([
        [older.id, 2, 'Second'],
        [newer.id, 0, undefined],
      ]);
      const asOwner = (await as(owner).get('/api/handovers/mine').expect(200))
        .body as HandoverSummary[];
      expect(asOwner[0]).toMatchObject({
        unread: 0,
        lastMessage: { mine: true, text: 'Second' },
      });
    });

    it('refuses empty and very long messages', async () => {
      const post = await acceptedItem();

      for (const text of ['   ', 'x'.repeat(1001)]) {
        await as(owner)
          .post(`/api/posts/${post.id}/messages`, { text })
          .expect(400);
      }
    });

    it('emails someone who is away at most once an hour, without the text', async () => {
      const post = await acceptedItem();
      await ctx.prisma.handover.update({
        where: { postId: post.id },
        data: { finderReadAt: new Date(Date.now() - 10 * 60_000) },
      });
      await ctx.outbox.processDue();
      const before = ctx.mailer.sentTo(finder.email).length;

      for (const text of ['My student ID is inside', 'Are you on campus?']) {
        await as(owner)
          .post(`/api/posts/${post.id}/messages`, { text })
          .expect(201);
      }

      await ctx.outbox.processDue();
      const emails = ctx.mailer.sentTo(finder.email).slice(before);
      expect(emails.map((email) => email.subject)).toEqual([
        'New messages about an item',
      ]);
      expect(emails[0].text).not.toContain('student ID');
    });

    it('does not email again until the chat was opened since the last email', async () => {
      const post = await acceptedItem();
      const hoursAgo = (hours: number) =>
        new Date(Date.now() - hours * 3_600_000);
      await ctx.prisma.handover.update({
        where: { postId: post.id },
        data: { finderReadAt: hoursAgo(3), finderEmailedAt: hoursAgo(2) },
      });
      await ctx.outbox.processDue();
      const before = ctx.mailer.sentTo(finder.email).length;

      await as(owner)
        .post(`/api/posts/${post.id}/messages`, { text: 'Still there?' })
        .expect(201);
      await ctx.outbox.processDue();
      expect(ctx.mailer.sentTo(finder.email)).toHaveLength(before);

      await ctx.prisma.handover.update({
        where: { postId: post.id },
        data: { finderReadAt: hoursAgo(1.5) },
      });
      await as(owner)
        .post(`/api/posts/${post.id}/messages`, { text: 'Hello again' })
        .expect(201);
      await ctx.outbox.processDue();
      expect(ctx.mailer.sentTo(finder.email)).toHaveLength(before + 1);
    });

    it('does not email someone who has the chat open', async () => {
      const post = await acceptedItem();
      await ctx.outbox.processDue();
      const before = ctx.mailer.sentTo(finder.email).length;

      await as(owner)
        .post(`/api/posts/${post.id}/messages`, { text: 'Hi!' })
        .expect(201);

      await ctx.outbox.processDue();
      expect(ctx.mailer.sentTo(finder.email)).toHaveLength(before);
    });
  });

  describe('handing over with the pickup code', () => {
    it('marks the item returned when the finder types the right code', async () => {
      const post = await acceptedItem();
      const code = await pickupCode(post.id);

      await handOver(
        finder,
        post.id,
        `${code.slice(0, 3)} ${code.slice(3)}`,
      ).expect(204);

      const shown = (await as(owner).get(`/api/posts/${post.id}`).expect(200))
        .body as PostView;
      expect(shown.status).toBe('RETURNED');
      const done = await handover(owner, post.id);
      expect(done.returnedAt).not.toBeNull();
      expect(done.pickupCode).toBeNull();
      await handOver(finder, post.id, code).expect(409);
      await as(owner)
        .post(`/api/posts/${post.id}/messages`, { text: 'Thanks!' })
        .expect(409);
    });

    it('locks the code after 5 wrong tries until the owner gets a new one', async () => {
      const post = await acceptedItem();
      const code = await pickupCode(post.id);
      await as(owner)
        .post(`/api/posts/${post.id}/handover/new-code`)
        .expect(409);

      for (let left = 4; left >= 0; left--) {
        const wrong = await handOver(
          finder,
          post.id,
          wrongCodeFor(code),
        ).expect(400);
        expect(wrong.body.message).toContain(
          `${left} ${left === 1 ? 'try' : 'tries'} left`,
        );
      }
      const locked = await handOver(finder, post.id, code).expect(403);
      expect(locked.body.code).toBe('CODE_LOCKED');
      expect((await handover(owner, post.id)).codeLocked).toBe(true);

      const renewed = (
        await as(owner)
          .post(`/api/posts/${post.id}/handover/new-code`)
          .expect(200)
      ).body as HandoverView;
      expect(renewed.codeLocked).toBe(false);
      await handOver(finder, post.id, renewed.pickupCode!).expect(204);
    });

    it('counts guesses sent at the same moment one by one', async () => {
      const post = await acceptedItem();
      const wrong = wrongCodeFor(await pickupCode(post.id));

      const answers = await Promise.all(
        Array.from({ length: 8 }, () => handOver(finder, post.id, wrong)),
      );

      const statuses = answers
        .map((answer) => answer.status)
        .sort((a, b) => a - b);
      expect(statuses).toEqual([400, 400, 400, 400, 400, 403, 403, 403]);
      const stored = await ctx.prisma.handover.findUniqueOrThrow({
        where: { postId: post.id },
      });
      expect(stored.wrongCodes).toBe(5);
    });

    it('refuses a code that is not 6 digits', async () => {
      const post = await acceptedItem();

      await handOver(finder, post.id, '12345').expect(400);
    });
  });

  describe('the security office', () => {
    it('lets the finder hand an item in and change their mind until it arrives', async () => {
      const post = await foundItem();

      await as(finder).post(`/api/posts/${post.id}/desk`).expect(204);
      const shown = (await as(owner).get(`/api/posts/${post.id}`).expect(200))
        .body as PostView;
      expect(shown.desk).toBe('ON_THE_WAY');
      await as(finder).post(`/api/posts/${post.id}/desk`).expect(409);
      await as(owner).post(`/api/posts/${post.id}/desk`).expect(404);

      await as(finder).delete(`/api/posts/${post.id}/desk`).expect(204);
      const after = (await as(finder).get(`/api/posts/${post.id}`).expect(200))
        .body as PostView;
      expect(after.desk).toBeNull();
    });

    it('is only open to security staff', async () => {
      const post = await foundItem();
      await as(finder).post(`/api/posts/${post.id}/desk`).expect(204);

      await as(finder).get('/api/desk/items?status=ON_THE_WAY').expect(403);
      await as(finder).post(`/api/desk/items/${post.id}/receive`).expect(403);
      await as(security).get('/api/desk/items?status=SOMEWHERE').expect(400);
    });

    it('receives an item, tells the finder and the owner, and shows who picks it up', async () => {
      const post = await acceptedItem();
      await as(finder).post(`/api/posts/${post.id}/desk`).expect(204);
      const onTheWay = (await deskItems('ON_THE_WAY')).find(
        (item) => item.postId === post.id,
      );
      expect(onTheWay?.owner).toBeNull();

      const received = (
        await as(security)
          .post(`/api/desk/items/${post.id}/receive`)
          .expect(200)
      ).body as DeskItemView;

      expect(received).toMatchObject({
        status: 'AT_DESK',
        title: 'Black leather wallet',
        finder: { fullName: 'Ahmad Saleh', email: finder.email },
        owner: { fullName: 'Ahmad Saleh' },
      });
      expect(JSON.stringify(received)).not.toContain(owner.email);
      await ctx.outbox.processDue();
      expect(subjectsTo(finder)).toContain(
        'The security office has the item you found',
      );
      expect(subjectsTo(owner)).toContain(
        'Your item is at the security office',
      );
      await as(security).post(`/api/desk/items/${post.id}/receive`).expect(404);
      await as(finder).delete(`/api/posts/${post.id}/desk`).expect(409);
      await as(finder).post(`/api/posts/${post.id}/close`).expect(409);
    });

    it('tells the owner to go to the desk when the claim is accepted after the item arrived', async () => {
      const post = await foundItem();
      await as(finder).post(`/api/posts/${post.id}/desk`).expect(204);
      await as(security).post(`/api/desk/items/${post.id}/receive`).expect(200);

      await acceptedItem(post);

      await ctx.outbox.processDue();
      const subjects = ctx.mailer
        .sentTo(owner.email)
        .map((email) => email.subject);
      expect(subjects).toContain('Your claim was accepted');
      expect(subjects).toContain('Your item is at the security office');
    });

    it('lets only security staff hand over an item at the desk, and tells the finder', async () => {
      const post = await acceptedItem();
      await as(finder).post(`/api/posts/${post.id}/desk`).expect(204);
      await as(security).post(`/api/desk/items/${post.id}/receive`).expect(200);
      const code = await pickupCode(post.id);

      const refused = await handOver(finder, post.id, code).expect(403);
      expect(refused.body.message).toContain('security office');
      await handOver(security, post.id, code).expect(204);
      const desk = await ctx.prisma.deskItem.findUniqueOrThrow({
        where: { postId: post.id },
      });
      expect(desk.status).toBe('PICKED_UP');
      expect(desk.receivedAt).not.toBeNull();

      await ctx.outbox.processDue();
      expect(subjectsTo(finder)).toContain(
        'The item you found is back with its owner',
      );
      expect(
        (await deskItems('AT_DESK')).map((item) => item.postId),
      ).not.toContain(post.id);
    });

    it('takes an item off the desk when the finder hands it over on the way', async () => {
      const post = await acceptedItem();
      await as(finder).post(`/api/posts/${post.id}/desk`).expect(204);

      await handOver(finder, post.id, await pickupCode(post.id)).expect(204);

      const shown = (await as(finder).get(`/api/posts/${post.id}`).expect(200))
        .body as PostView;
      expect(shown.desk).toBeNull();
      await as(security).post(`/api/desk/items/${post.id}/receive`).expect(404);
      await as(security)
        .get(`/api/photos/${post.photoIds[0]}/original`)
        .expect(404);
    });

    it("doesn't let security staff hand over their own item", async () => {
      const colleague = await student();
      await ctx.app.get(UsersService).setRole(colleague.email, 'SECURITY');
      const post = await acceptedItem(undefined, security);
      await as(finder).post(`/api/posts/${post.id}/desk`).expect(204);
      await as(colleague)
        .post(`/api/desk/items/${post.id}/receive`)
        .expect(200);
      const code = (await handover(security, post.id)).pickupCode!;

      const refused = await handOver(security, post.id, code).expect(403);
      expect(refused.body.message).toContain('Another member of staff');
      await handOver(colleague, post.id, code).expect(204);
    });

    it('lets security staff hand over only items at the desk', async () => {
      const post = await acceptedItem();

      await handOver(security, post.id, await pickupCode(post.id)).expect(404);
    });

    it('shows security staff the original photos of items handed in, and no others', async () => {
      const handedIn = await foundItem();
      const other = await foundItem();
      await as(finder).post(`/api/posts/${handedIn.id}/desk`).expect(204);

      await as(security)
        .get(`/api/photos/${handedIn.photoIds[0]}/original`)
        .expect(200);
      await as(security)
        .get(`/api/photos/${other.photoIds[0]}/original`)
        .expect(404);
    });
  });
});
