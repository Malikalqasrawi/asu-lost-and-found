import type { MatchView } from '../src/matches/matches.service.js';
import type { PlaceView } from '../src/places/places.service.js';
import type { PostView } from '../src/posts/post-view.js';
import { createVerifiedUser } from './support/accounts.js';
import { createTestApp, TestContext } from './support/app.js';

interface Student {
  email: string;
  token: string;
}

interface PostFields {
  type: 'LOST' | 'FOUND';
  title: string;
  category?: string;
  place?: number;
  daysAgo?: number;
  description?: string;
}

// Other test files post items dated around today into the same database, so
// these posts are dated weeks earlier to keep their matches to themselves.
const DAYS_BACK = 40;

const daysAgo = (days: number) =>
  new Date(Date.now() - (DAYS_BACK + days) * 86_400_000)
    .toISOString()
    .slice(0, 10);

describe('matches', () => {
  let ctx: TestContext;
  let places: PlaceView[];
  let owner: Student;

  const student = async (): Promise<Student> => {
    const { email, auth } = await createVerifiedUser(ctx);
    return { email, token: auth.accessToken };
  };

  async function post(author: Student, fields: PostFields): Promise<PostView> {
    const request = ctx
      .http()
      .post('/api/posts')
      .set('Authorization', `Bearer ${author.token}`)
      .field('type', fields.type)
      .field('title', fields.title)
      .field('category', fields.category ?? 'WALLET')
      .field('placeId', places[fields.place ?? 1].id)
      .field('happenedOn', daysAgo(fields.daysAgo ?? 5));
    if (fields.description) {
      request.field('description', fields.description);
    }
    if (fields.type === 'FOUND') {
      request.field('questions', 'What is inside it?');
    }
    return (await request.expect(201)).body as PostView;
  }

  const matchesFor = async (postId: string, who = owner) =>
    (
      await ctx
        .http()
        .get(`/api/posts/${postId}/matches`)
        .set('Authorization', `Bearer ${who.token}`)
        .expect(200)
    ).body as MatchView[];

  const dismiss = (postId: string, foundId: string, who = owner) =>
    ctx
      .http()
      .post(`/api/posts/${postId}/matches/${foundId}/dismiss`)
      .set('Authorization', `Bearer ${who.token}`);

  /** Emails to the owner from now on, leaving out the sign-up code. */
  async function emailsFromNow() {
    await ctx.outbox.processDue();
    const before = ctx.mailer.sentTo(owner.email).length;
    return async () => {
      await ctx.outbox.processDue();
      return ctx.mailer.sentTo(owner.email).slice(before);
    };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await student();
    places = (
      await ctx
        .http()
        .get('/api/places')
        .set('Authorization', `Bearer ${owner.token}`)
    ).body;
  });

  beforeEach(async () => {
    owner = await student();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('suggests found items in the same category around the lost day, the likeliest first', async () => {
    const lost = await post(owner, {
      type: 'LOST',
      title: 'Black leather wallet',
      daysAgo: 5,
    });
    const finder = await student();
    const likely = await post(finder, {
      type: 'FOUND',
      title: 'black leather wallet',
      daysAgo: 4,
    });
    const samePlace = await post(finder, {
      type: 'FOUND',
      title: 'Brown purse',
      daysAgo: 3,
    });
    await post(finder, {
      type: 'FOUND',
      title: 'Black leather wallet',
      category: 'PHONE',
      daysAgo: 4,
    });
    await post(finder, {
      type: 'FOUND',
      title: 'Black leather wallet',
      daysAgo: 8,
    });
    await post(owner, {
      type: 'FOUND',
      title: 'Black leather wallet',
      daysAgo: 4,
    });

    const matches = await matchesFor(lost.id);

    expect(matches.map((match) => match.post.id)).toEqual([
      likely.id,
      samePlace.id,
    ]);
    expect(matches[0].reasons).toEqual([
      'Same place',
      'Found the next day',
      'Similar title',
    ]);
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
    expect(matches[0].post.canSeeOriginals).toBe(false);
  });

  it('matches Arabic titles, typos included', async () => {
    const lost = await post(owner, {
      type: 'LOST',
      title: 'محفظة سوداء',
      place: 0,
      daysAgo: 6,
    });
    const found = await post(await student(), {
      type: 'FOUND',
      title: 'محفظه سوداء',
      place: 2,
      daysAgo: 6,
    });

    const [match] = await matchesFor(lost.id);

    expect(match.post.id).toBe(found.id);
    expect(match.reasons).toContain('Similar title');
  });

  it('finds the item when its title is one of the words in the lost description', async () => {
    const lost = await post(owner, {
      type: 'LOST',
      title: 'Lost my bag',
      category: 'BAG',
      description: 'A grey Adidas backpack with a laptop sleeve',
      place: 0,
      daysAgo: 7,
    });
    const found = await post(await student(), {
      type: 'FOUND',
      title: 'Adidas backpack',
      category: 'BAG',
      place: 2,
      daysAgo: 5,
    });

    const [match] = await matchesFor(lost.id);

    expect(match.post.id).toBe(found.id);
  });

  it('shows matches only to the student who lost the item', async () => {
    const lost = await post(owner, { type: 'LOST', title: 'Black wallet' });
    const found = await post(await student(), {
      type: 'FOUND',
      title: 'Black wallet',
    });

    const stranger = await student();
    await ctx
      .http()
      .get(`/api/posts/${lost.id}/matches`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);
    await ctx
      .http()
      .get(`/api/posts/${found.id}/matches`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);
  });

  it('hides a found item the student marked "Not mine"', async () => {
    const keys = { category: 'KEYS' };
    const lost = await post(owner, {
      type: 'LOST',
      title: 'Car keys',
      ...keys,
    });
    const finder = await student();
    const notMine = await post(finder, {
      type: 'FOUND',
      title: 'Car keys',
      ...keys,
    });
    const other = await post(finder, {
      type: 'FOUND',
      title: 'Keys on a ring',
      ...keys,
    });

    await dismiss(lost.id, notMine.id).expect(204);
    await dismiss(lost.id, notMine.id).expect(204);

    expect((await matchesFor(lost.id)).map((match) => match.post.id)).toEqual([
      other.id,
    ]);
    await dismiss(lost.id, lost.id).expect(404);
    await dismiss(lost.id, other.id, await student()).expect(404);
  });

  it('stops suggesting once the lost post is closed', async () => {
    const lost = await post(owner, { type: 'LOST', title: 'Blue umbrella' });
    await post(await student(), { type: 'FOUND', title: 'Blue umbrella' });

    await ctx
      .http()
      .post(`/api/posts/${lost.id}/close`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(await matchesFor(lost.id)).toEqual([]);
  });

  describe('emails', () => {
    it('tells the student about a strong new match at most once a day, without its details', async () => {
      await post(owner, {
        type: 'LOST',
        title: 'Black leather wallet',
        daysAgo: 3,
      });
      const finder = await student();
      const sent = await emailsFromNow();

      await post(finder, {
        type: 'FOUND',
        title: 'Black leather wallet',
        description: 'Found under a desk',
        daysAgo: 3,
      });
      await post(finder, {
        type: 'FOUND',
        title: 'Black wallet',
        daysAgo: 2,
      });

      const emails = await sent();
      expect(emails.map((email) => email.subject)).toEqual([
        'A found item may be yours',
      ]);
      expect(emails[0].text).toContain('Black leather wallet');
      expect(emails[0].text).not.toContain('desk');

      await ctx.prisma.user.update({
        where: { email: owner.email },
        data: { matchEmailedAt: new Date(Date.now() - 2 * 86_400_000) },
      });
      await post(finder, {
        type: 'FOUND',
        title: 'Black leather wallet',
        daysAgo: 1,
      });
      expect(await sent()).toHaveLength(2);
    });

    it("doesn't email everyone who lost something when a found title is one common word", async () => {
      const phone = { category: 'PHONE', daysAgo: 20 };
      await post(owner, {
        type: 'LOST',
        title: 'Black Samsung phone',
        description: 'I left the phone near the printers',
        ...phone,
      });
      const sent = await emailsFromNow();

      await post(await student(), { type: 'FOUND', title: 'phone', ...phone });

      expect(await sent()).toEqual([]);
    });

    it('emails at most 3 students about one found item', async () => {
      const ring = { category: 'JEWELRY', daysAgo: 25 };
      const losers = [owner];
      while (losers.length < 5) {
        losers.push(await student());
      }
      for (const loser of losers) {
        await post(loser, { type: 'LOST', title: 'Silver ring', ...ring });
      }
      await ctx.outbox.processDue();
      const before = losers.map(
        (loser) => ctx.mailer.sentTo(loser.email).length,
      );

      await post(await student(), {
        type: 'FOUND',
        title: 'Silver ring',
        ...ring,
      });

      await ctx.outbox.processDue();
      const emailed = losers.filter(
        (loser, index) => ctx.mailer.sentTo(loser.email).length > before[index],
      );
      expect(emailed).toHaveLength(3);
    });

    it('sends a student one match email a day, however many lost posts match', async () => {
      const books = { category: 'BOOKS', daysAgo: 30 };
      await post(owner, { type: 'LOST', title: 'Calculus textbook', ...books });
      await post(owner, { type: 'LOST', title: 'Calculus book', ...books });
      const sent = await emailsFromNow();
      const finder = await student();

      await post(finder, {
        type: 'FOUND',
        title: 'Calculus textbook',
        ...books,
      });
      await post(finder, { type: 'FOUND', title: 'Calculus book', ...books });

      expect(await sent()).toHaveLength(1);
    });

    it('stays quiet about weak matches', async () => {
      await post(owner, {
        type: 'LOST',
        title: 'Black leather wallet',
        place: 0,
        daysAgo: 12,
      });
      const sent = await emailsFromNow();

      await post(await student(), {
        type: 'FOUND',
        title: 'Brown purse',
        place: 2,
        daysAgo: 1,
      });

      expect(await sent()).toEqual([]);
    });
  });
});
