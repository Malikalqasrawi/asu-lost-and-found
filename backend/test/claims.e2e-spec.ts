import type { ClaimForm, FinderClaims } from '../src/claims/claims.service.js';
import type { MyClaimView } from '../src/claims/claim-view.js';
import type { PlaceView } from '../src/places/places.service.js';
import type { PostView } from '../src/posts/post-view.js';
import { createVerifiedUser } from './support/accounts.js';
import { signInAsAdmin } from './support/admin.js';
import { createTestApp, TestContext } from './support/app.js';
import { photoWithGps } from './support/images.js';

interface Student {
  email: string;
  token: string;
}

describe('claims', () => {
  let ctx: TestContext;
  let places: PlaceView[];
  let finder: Student;

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
  });

  async function foundItem(
    fields: Record<string, string | string[]> = {},
  ): Promise<PostView> {
    const values: Record<string, string | string[]> = {
      type: 'FOUND',
      title: 'Black leather wallet',
      category: 'WALLET',
      placeId: places[1].id,
      happenedOn: new Date().toISOString().slice(0, 10),
      privateNotes: 'Library card for Ahmad and a 10 JOD note',
      questions: ['What is inside the wallet?', 'What colour is it inside?'],
      ...fields,
    };
    const request = ctx
      .http()
      .post('/api/posts')
      .set('Authorization', `Bearer ${finder.token}`)
      .attach('photos', await photoWithGps(200, 150), 'wallet.jpg');
    for (const [name, value] of Object.entries(values)) {
      for (const item of [value].flat()) {
        request.field(name, item);
      }
    }
    return (await request.expect(201)).body as PostView;
  }

  async function claimForm(who: Student, postId: string): Promise<ClaimForm> {
    return (await as(who).get(`/api/posts/${postId}/claim-form`).expect(200))
      .body as ClaimForm;
  }

  async function claim(
    who: Student,
    postId: string,
    extra: object = {},
  ): Promise<MyClaimView> {
    const form = await claimForm(who, postId);
    const answers = form.questions.map((question) => ({
      questionId: question.id,
      answer: 'A library card and some cash',
    }));
    return (
      await as(who)
        .post(`/api/posts/${postId}/claims`, { answers, ...extra })
        .expect(201)
    ).body as MyClaimView;
  }

  const finderClaims = async (postId: string) =>
    (await as(finder).get(`/api/posts/${postId}/claims`).expect(200))
      .body as FinderClaims;

  beforeAll(async () => {
    ctx = await createTestApp();
    finder = await student();
    places = (await as(finder).get('/api/places')).body;
  });

  // A new finder for every test, so no one reaches the limit of posts a day.
  beforeEach(async () => {
    finder = await student();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('setting up a found item', () => {
    it('needs at least one question for a found item', async () => {
      await ctx
        .http()
        .post('/api/posts')
        .set('Authorization', `Bearer ${finder.token}`)
        .field('type', 'FOUND')
        .field('title', 'Black leather wallet')
        .field('category', 'WALLET')
        .field('placeId', places[1].id)
        .field('happenedOn', new Date().toISOString().slice(0, 10))
        .expect(400);
    });

    it('refuses questions on a lost item', async () => {
      await ctx
        .http()
        .post('/api/posts')
        .set('Authorization', `Bearer ${finder.token}`)
        .field('type', 'LOST')
        .field('title', 'Black leather wallet')
        .field('category', 'WALLET')
        .field('placeId', places[1].id)
        .field('happenedOn', new Date().toISOString().slice(0, 10))
        .field('questions', 'What is inside it?')
        .expect(400);
    });

    it('refuses more than 3 questions', async () => {
      const request = ctx
        .http()
        .post('/api/posts')
        .set('Authorization', `Bearer ${finder.token}`)
        .field('type', 'FOUND')
        .field('title', 'Black leather wallet')
        .field('category', 'WALLET')
        .field('placeId', places[1].id)
        .field('happenedOn', new Date().toISOString().slice(0, 10));
      for (let i = 0; i < 4; i++) {
        request.field('questions', `Question number ${i}?`);
      }
      await request.expect(400);
    });

    it('never shows the private notes or the serial number in the post', async () => {
      const post = await foundItem({ serialNumber: 'C02X-1234-ABCD' });
      const visitor = await student();

      const shown = await as(visitor).get(`/api/posts/${post.id}`).expect(200);
      const listed = await as(visitor).get('/api/posts?limit=50').expect(200);

      for (const body of [shown.body, listed.body]) {
        const json = JSON.stringify(body);
        expect(json).not.toContain('Library card for Ahmad');
        expect(json).not.toMatch(/C02X|serial/i);
        expect(json).not.toContain('What is inside the wallet?');
      }
      const stored = await ctx.prisma.postSecret.findUnique({
        where: { postId: post.id },
      });
      expect(stored?.serialHash).not.toContain('C02X');
    });

    it('accepts a found item with every field filled in', async () => {
      const post = await foundItem({
        title: 'Silver laptop',
        category: 'LAPTOP',
        description: 'A silver laptop in a grey sleeve',
        placeDetails: 'Second floor, near the printers',
        questions: [
          'What sticker is on the lid?',
          'What is the wallpaper?',
          'What colour is the sleeve inside?',
        ],
        serialNumber: 'C02X-1234-ABCD',
      });

      expect(post.title).toBe('Silver laptop');
    });

    it('refuses a serial number without at least 4 letters or digits', async () => {
      await ctx
        .http()
        .post('/api/posts')
        .set('Authorization', `Bearer ${finder.token}`)
        .field('type', 'FOUND')
        .field('title', 'Silver laptop')
        .field('category', 'LAPTOP')
        .field('placeId', places[1].id)
        .field('happenedOn', new Date().toISOString().slice(0, 10))
        .field('questions', 'What sticker is on the lid?')
        .field('serialNumber', '----')
        .expect(400);
    });
  });

  describe('the claim form', () => {
    it('shows the questions, but not the answers or notes', async () => {
      const post = await foundItem();
      const owner = await student();

      const form = await claimForm(owner, post.id);

      expect(form.questions.map((question) => question.text)).toEqual([
        'What is inside the wallet?',
        'What colour is it inside?',
      ]);
      expect(form).toMatchObject({
        serialRequired: false,
        attemptsLeft: 3,
        activeClaim: null,
      });
      expect(JSON.stringify(form)).not.toContain('Library card');
    });

    it('answers 404 for the finder, a lost item and a closed item', async () => {
      const post = await foundItem();
      const lost = (
        await ctx
          .http()
          .post('/api/posts')
          .set('Authorization', `Bearer ${finder.token}`)
          .field('type', 'LOST')
          .field('title', 'Grey umbrella')
          .field('category', 'OTHER')
          .field('placeId', places[1].id)
          .field('happenedOn', new Date().toISOString().slice(0, 10))
      ).body as PostView;
      const closed = await foundItem();
      await as(finder).post(`/api/posts/${closed.id}/close`).expect(200);
      const owner = await student();

      await as(finder).get(`/api/posts/${post.id}/claim-form`).expect(404);
      await as(owner).get(`/api/posts/${lost.id}/claim-form`).expect(404);
      await as(owner).get(`/api/posts/${closed.id}/claim-form`).expect(404);
    });
  });

  describe('making a claim', () => {
    it('sends the claim and emails the finder, without the answers', async () => {
      const post = await foundItem();
      const owner = await student();

      const sent = await claim(owner, post.id, { message: 'It is mine!' });

      expect(sent).toMatchObject({
        status: 'PENDING',
        message: 'It is mine!',
        post: { id: post.id, title: 'Black leather wallet' },
      });
      expect(sent).not.toHaveProperty('serialMatches');
      await ctx.outbox.processDue();
      const email = ctx.mailer.sentTo(finder.email).at(-1);
      expect(email?.subject).toBe('Someone says an item you found is theirs');
      expect(email?.text).toContain('Black leather wallet');
      expect(email?.text).not.toContain('library card');
    });

    it('needs an answer to every question, once', async () => {
      const post = await foundItem();
      const owner = await student();
      const form = await claimForm(owner, post.id);
      const [first, second] = form.questions;
      const answer = (questionId: string) => ({ questionId, answer: 'Cash' });

      for (const answers of [
        [answer(first.id)],
        [answer(first.id), answer(first.id)],
        [answer(first.id), answer('0190f5c2-0000-7000-8000-000000000000')],
      ]) {
        await as(owner)
          .post(`/api/posts/${post.id}/claims`, { answers })
          .expect(400);
      }
      await as(owner)
        .post(`/api/posts/${post.id}/claims`, {
          answers: [answer(first.id), answer(second.id)],
        })
        .expect(201);
    });

    it('allows one waiting claim per student per item', async () => {
      const post = await foundItem();
      const owner = await student();
      await claim(owner, post.id);
      const form = await claimForm(owner, post.id);

      const again = await as(owner)
        .post(`/api/posts/${post.id}/claims`, {
          answers: form.questions.map((question) => ({
            questionId: question.id,
            answer: 'Cash',
          })),
        })
        .expect(409);

      expect(again.body.message).toBe(
        'You already have a claim waiting for this item.',
      );
      expect(form.activeClaim?.status).toBe('PENDING');
    });

    it('does not let the finder claim their own item', async () => {
      const post = await foundItem();

      await as(finder)
        .post(`/api/posts/${post.id}/claims`, {
          answers: [
            {
              questionId: '0190f5c2-0000-7000-8000-000000000000',
              answer: 'x',
            },
          ],
        })
        .expect(404);
    });
  });

  describe('the finder deciding', () => {
    it("shows the finder's notes next to every claim", async () => {
      const post = await foundItem();
      await claim(await student(), post.id);

      const view = await finderClaims(post.id);

      expect(view.privateNotes).toBe(
        'Library card for Ahmad and a 10 JOD note',
      );
      expect(view.questions).toHaveLength(2);
      expect(view.claims[0]).toMatchObject({
        status: 'PENDING',
        claimant: { firstName: 'Ahmad' },
        serialMatches: null,
      });
      expect(view.claims[0].answers[0]).toEqual({
        question: 'What is inside the wallet?',
        answer: 'A library card and some cash',
      });
    });

    it('answers 404 to anyone but the finder', async () => {
      const post = await foundItem();
      const owner = await student();
      const sent = await claim(owner, post.id);
      const other = await student();

      await as(other).get(`/api/posts/${post.id}/claims`).expect(404);
      await as(owner).get(`/api/posts/${post.id}/claims`).expect(404);
      await as(other).post(`/api/claims/${sent.id}/accept`).expect(404);
      await as(owner).post(`/api/claims/${sent.id}/reject`).expect(404);
    });

    it('stops a student after 3 rejected claims on the same item', async () => {
      const post = await foundItem();
      const guesser = await student();

      for (let attempt = 0; attempt < 3; attempt++) {
        const sent = await claim(guesser, post.id);
        await as(finder).post(`/api/claims/${sent.id}/reject`).expect(200);
      }

      const form = await claimForm(guesser, post.id);
      expect(form.attemptsLeft).toBe(0);
      const refused = await as(guesser)
        .post(`/api/posts/${post.id}/claims`, {
          answers: form.questions.map((question) => ({
            questionId: question.id,
            answer: 'Cash',
          })),
        })
        .expect(403);
      expect(refused.body.code).toBe('CLAIM_LIMIT');
    });

    it('tells the claimant a claim was rejected, without a reason', async () => {
      const post = await foundItem();
      const owner = await student();
      const sent = await claim(owner, post.id);

      const decided = await as(finder)
        .post(`/api/claims/${sent.id}/reject`)
        .expect(200);

      expect(decided.body.status).toBe('REJECTED');
      await ctx.outbox.processDue();
      expect(ctx.mailer.sentTo(owner.email).at(-1)?.subject).toBe(
        'Your claim was not accepted',
      );
      const mine = (await as(owner).get('/api/claims/mine'))
        .body as MyClaimView[];
      expect(mine[0]).toMatchObject({ id: sent.id, status: 'REJECTED' });
      expect(JSON.stringify(mine)).not.toMatch(/reason/i);
    });

    it('accepts one claim, closes the others and marks the item claimed', async () => {
      const post = await foundItem();
      const owner = await student();
      const other = await student();
      const winning = await claim(owner, post.id);
      const losing = await claim(other, post.id);

      await as(finder).post(`/api/claims/${winning.id}/accept`).expect(200);

      const view = await finderClaims(post.id);
      expect(view.claims.map((item) => [item.id, item.status])).toEqual([
        [winning.id, 'ACCEPTED'],
        [losing.id, 'CLOSED'],
      ]);
      const seen = (await as(other).get(`/api/posts/${post.id}`))
        .body as PostView;
      expect(seen.status).toBe('CLAIMED');
      const browse = (await as(other).get('/api/posts?limit=50')).body;
      expect(browse.items.map((item: PostView) => item.id)).not.toContain(
        post.id,
      );
      await ctx.outbox.processDue();
      expect(ctx.mailer.sentTo(owner.email).at(-1)?.subject).toBe(
        'Your claim was accepted',
      );
      expect(ctx.mailer.sentTo(other.email).at(-1)?.subject).toBe(
        'An item you claimed went to someone else',
      );
    });

    it('lets only the accepted claimant see the original photos', async () => {
      const post = await foundItem();
      const owner = await student();
      const other = await student();
      const sent = await claim(owner, post.id);
      await as(finder).post(`/api/claims/${sent.id}/accept`).expect(200);
      const [photoId] = post.photoIds;

      const ownerView = (await as(owner).get(`/api/posts/${post.id}`)).body;
      const otherView = (await as(other).get(`/api/posts/${post.id}`)).body;

      expect(ownerView.canSeeOriginals).toBe(true);
      expect(otherView.canSeeOriginals).toBe(false);
      await as(owner).get(`/api/photos/${photoId}/original`).expect(200);
      await as(other).get(`/api/photos/${photoId}/original`).expect(404);
    });

    it('takes no new claims and no second acceptance once claimed', async () => {
      const post = await foundItem();
      const first = await claim(await student(), post.id);
      const second = await claim(await student(), post.id);
      await as(finder).post(`/api/claims/${first.id}/accept`).expect(200);
      const late = await student();
      const form = await claimForm(late, post.id);

      await as(finder).post(`/api/claims/${second.id}/accept`).expect(409);
      await as(late)
        .post(`/api/posts/${post.id}/claims`, {
          answers: form.questions.map((question) => ({
            questionId: question.id,
            answer: 'Cash',
          })),
        })
        .expect(409);
    });

    it('accepts only one claim when two are accepted at the same moment', async () => {
      const post = await foundItem();
      const first = await claim(await student(), post.id);
      const second = await claim(await student(), post.id);

      const answers = await Promise.all([
        as(finder).post(`/api/claims/${first.id}/accept`),
        as(finder).post(`/api/claims/${second.id}/accept`),
      ]);

      expect(
        answers.map((answer) => answer.status).sort((a, b) => a - b),
      ).toEqual([200, 409]);
      const accepted = await ctx.prisma.claim.count({
        where: { postId: post.id, status: 'ACCEPTED' },
      });
      expect(accepted).toBe(1);
    });
  });

  describe('withdrawing', () => {
    it('lets the claimant take back a waiting claim, which uses one attempt', async () => {
      const post = await foundItem();
      const owner = await student();
      const sent = await claim(owner, post.id);

      const withdrawn = await as(owner)
        .post(`/api/claims/${sent.id}/withdraw`)
        .expect(200);

      expect(withdrawn.body.status).toBe('WITHDRAWN');
      expect((await claimForm(owner, post.id)).attemptsLeft).toBe(2);
      await claim(owner, post.id);
    });

    it('hides withdrawn claims from the finder', async () => {
      const post = await foundItem();
      const owner = await student();
      const sent = await claim(owner, post.id, {
        message: 'Call me on 0790000000',
      });

      await as(owner).post(`/api/claims/${sent.id}/withdraw`).expect(200);

      const view = await finderClaims(post.id);
      expect(view.claims).toEqual([]);
      expect(JSON.stringify(view)).not.toContain('0790000000');
    });

    it('stops a student who keeps withdrawing and claiming again', async () => {
      const post = await foundItem();
      const owner = await student();
      for (let i = 0; i < 3; i++) {
        const sent = await claim(owner, post.id);
        await as(owner).post(`/api/claims/${sent.id}/withdraw`).expect(200);
      }
      const form = await claimForm(owner, post.id);

      const refused = await as(owner)
        .post(`/api/posts/${post.id}/claims`, {
          answers: form.questions.map((question) => ({
            questionId: question.id,
            answer: 'Once more',
          })),
        })
        .expect(403);

      expect(form.attemptsLeft).toBe(0);
      expect(refused.body.code).toBe('CLAIM_LIMIT');
    });

    it("answers 404 for someone else's claim and 409 for a decided one", async () => {
      const post = await foundItem();
      const owner = await student();
      const sent = await claim(owner, post.id);

      await as(await student())
        .post(`/api/claims/${sent.id}/withdraw`)
        .expect(404);
      await as(finder).post(`/api/claims/${sent.id}/reject`).expect(200);
      await as(owner).post(`/api/claims/${sent.id}/withdraw`).expect(409);
    });
  });

  describe('closing a found item', () => {
    it('closes the waiting claims and tells the claimants', async () => {
      const post = await foundItem();
      const owner = await student();
      const sent = await claim(owner, post.id);

      await as(finder).post(`/api/posts/${post.id}/close`).expect(200);

      const mine = (await as(owner).get('/api/claims/mine').expect(200))
        .body as MyClaimView[];
      expect(mine.find((item) => item.id === sent.id)?.status).toBe('CLOSED');
      await ctx.outbox.processDue();
      expect(ctx.mailer.sentTo(owner.email).at(-1)?.subject).toBe(
        'An item you claimed is no longer listed',
      );
    });

    it('keeps the claim history: a claimant or an item with claims cannot be deleted', async () => {
      const post = await foundItem();
      const owner = await student();
      await claim(owner, post.id);

      await expect(
        ctx.prisma.user.delete({ where: { email: owner.email } }),
      ).rejects.toThrow();
      await expect(
        ctx.prisma.post.delete({ where: { id: post.id } }),
      ).rejects.toThrow();
    });
  });

  describe('serial numbers', () => {
    it('tells the finder whether the serial number matches, and only the finder', async () => {
      const laptop = await foundItem({
        title: 'Silver laptop',
        category: 'LAPTOP',
        serialNumber: 'C02X-1234-ABCD',
        questions: 'What sticker is on the lid?',
      });
      const owner = await student();
      const guesser = await student();
      expect((await claimForm(owner, laptop.id)).serialRequired).toBe(true);

      const right = await claim(owner, laptop.id, {
        serialNumber: 'c02x 1234 abcd',
      });
      await claim(guesser, laptop.id, { serialNumber: 'C02X-9999-ABCD' });

      const view = await finderClaims(laptop.id);
      expect(view.hasSerial).toBe(true);
      expect(view.claims.map((item) => item.serialMatches)).toEqual([
        true,
        false,
      ]);
      expect(right).not.toHaveProperty('serialMatches');
    });

    it('refuses a claimed serial number made only of dashes and spaces', async () => {
      const laptop = await foundItem({
        category: 'LAPTOP',
        serialNumber: 'C02X-1234-ABCD',
        questions: 'What sticker is on the lid?',
      });
      const owner = await student();
      const form = await claimForm(owner, laptop.id);

      await as(owner)
        .post(`/api/posts/${laptop.id}/claims`, {
          answers: [{ questionId: form.questions[0].id, answer: 'A cat' }],
          serialNumber: '- - -',
        })
        .expect(400);
    });

    it('needs the serial number when the finder saved one', async () => {
      const laptop = await foundItem({
        category: 'LAPTOP',
        serialNumber: 'C02X-1234-ABCD',
        questions: 'What sticker is on the lid?',
      });
      const owner = await student();
      const form = await claimForm(owner, laptop.id);

      await as(owner)
        .post(`/api/posts/${laptop.id}/claims`, {
          answers: [{ questionId: form.questions[0].id, answer: 'A cat' }],
        })
        .expect(400);
    });
  });

  describe('claim history for admins', () => {
    it('lists claimants with the most rejected claims first, for admins only', async () => {
      const post = await foundItem();
      const guesser = await student();
      for (let attempt = 0; attempt < 2; attempt++) {
        const sent = await claim(guesser, post.id);
        await as(finder).post(`/api/claims/${sent.id}/reject`).expect(200);
      }
      const admin = await signInAsAdmin(ctx);

      await as(guesser).get('/api/admin/claimants').expect(403);
      await as({ email: admin.email, token: admin.appToken })
        .get('/api/admin/claimants')
        .expect(403);
      const history = (await as(admin).get('/api/admin/claimants').expect(200))
        .body as { email: string; rejected: number; claims: number }[];

      const row = history.find((item) => item.email === guesser.email);
      expect(row).toMatchObject({ claims: 2, rejected: 2 });
      expect(history[0].rejected).toBeGreaterThanOrEqual(2);
    });
  });
});
