import { readdir } from 'node:fs/promises';
import sharp from 'sharp';
import type { PlaceView } from '../src/places/places.service.js';
import type { PostView } from '../src/posts/post-view.js';
import { MAX_POSTS_PER_DAY } from '../src/posts/posts.service.js';
import { FileStorage } from '../src/storage/file-storage.js';
import { createVerifiedUser } from './support/accounts.js';
import { createTestApp, TestContext } from './support/app.js';
import { contrast, photoWithGps } from './support/images.js';

describe('posts and photos', () => {
  let ctx: TestContext;
  let places: PlaceView[];
  let finder: string;
  let other: string;

  const today = () => new Date().toISOString().slice(0, 10);

  function newPost(token: string, fields: Record<string, string> = {}) {
    const request = ctx
      .http()
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`);
    const values = {
      type: 'FOUND',
      title: 'Black leather wallet',
      description: 'Found on a bench',
      category: 'WALLET',
      placeId: places[1].id,
      happenedOn: today(),
      ...fields,
    };
    if (values.type === 'FOUND' && !('questions' in fields)) {
      request.field('questions', 'What is inside it?');
    }
    for (const [name, value] of Object.entries(values)) {
      request.field(name, value);
    }
    return request;
  }

  const get = (path: string, token: string) =>
    ctx.http().get(path).set('Authorization', `Bearer ${token}`);
  const patch = (id: string, token: string, body: object) =>
    ctx
      .http()
      .patch(`/api/posts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const close = (id: string, token: string) =>
    ctx
      .http()
      .post(`/api/posts/${id}/close`)
      .set('Authorization', `Bearer ${token}`);

  const uploadedFiles = async () =>
    (
      await readdir(String(process.env.UPLOAD_DIR), {
        recursive: true,
        withFileTypes: true,
      })
    )
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();

  beforeAll(async () => {
    ctx = await createTestApp();
    finder = (await createVerifiedUser(ctx)).auth.accessToken;
    other = (await createVerifiedUser(ctx)).auth.accessToken;
    places = (await get('/api/places', finder).expect(200)).body;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('GET /api/places', () => {
    it('lists the campus places in order', () => {
      expect(places[0].name).toBe('Main gate');
      expect(places.map((place) => place.name)).toContain('Library');
      expect(places.at(-1)?.name).toBe('Somewhere else on campus');
    });

    it('needs a signed-in student', async () => {
      await ctx.http().get('/api/places').expect(401);
    });
  });

  describe('creating a post', () => {
    it('creates a found post with photos', async () => {
      const photo = await photoWithGps();

      const response = await newPost(finder, { placeDetails: 'Second floor' })
        .attach('photos', photo, 'wallet-1.jpg')
        .attach('photos', photo, 'wallet-2.jpg')
        .expect(201);

      const post = response.body as PostView;
      expect(post).toMatchObject({
        type: 'FOUND',
        status: 'OPEN',
        title: 'Black leather wallet',
        category: 'WALLET',
        place: { id: places[1].id, name: places[1].name },
        placeDetails: 'Second floor',
        happenedOn: today(),
        author: { firstName: 'Ahmad' },
        isMine: true,
      });
      expect(post.photoIds).toHaveLength(2);
      expect(JSON.stringify(post)).not.toMatch(/\.jpg|Key|Saleh/);
    });

    it('creates a post without photos', async () => {
      const response = await newPost(finder, { type: 'LOST' }).expect(201);

      expect(response.body.photoIds).toEqual([]);
    });

    it.each([
      ['a short title', { title: 'ab' }],
      ['an unknown category', { category: 'CAR' }],
      ['an unknown type', { type: 'STOLEN' }],
      [
        'a place that is not in the list',
        { placeId: '0190f5c2-0000-7000-8000-000000000000' },
      ],
      ['a date in the future', { happenedOn: '2099-01-01' }],
      ['a date that does not exist', { happenedOn: '2026-02-30' }],
      ['a date in another format', { happenedOn: '16/10/2026' }],
      ['an extra field', { status: 'RETURNED' }],
      [
        'a title over 80 characters as the database counts them',
        { title: 'a'.repeat(79) + '❤️' },
      ],
      ['a title with a NUL character', { title: 'Black\u0000wallet' }],
      ['a title on two lines', { title: 'Black\nwallet' }],
      [
        'a title with a web address',
        { title: 'Verify at asu-portal-login.example to collect' },
      ],
      [
        'a title with an email address',
        { title: 'Keys, write to me@mail.example' },
      ],
      ['a description over 1000 characters', { description: 'é'.repeat(1001) }],
    ])('refuses %s', async (_name, fields) => {
      await newPost(finder, fields).expect(400);
    });

    it('keeps line breaks in the description', async () => {
      const response = await newPost(finder, {
        type: 'LOST',
        description: 'Black leather.\nHas a student card inside.',
      }).expect(201);

      expect(response.body.description).toBe(
        'Black leather.\nHas a student card inside.',
      );
    });

    it('refuses a file that is not a photo', async () => {
      const response = await newPost(finder)
        .attach('photos', Buffer.from('%PDF-1.7 fake'), {
          filename: 'wallet.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);

      expect(response.body.message).toBe('Upload JPEG, PNG or WebP photos');
    });

    it('refuses more than 4 photos', async () => {
      const photo = await photoWithGps(100, 100);
      const request = newPost(finder);
      for (let i = 0; i < 5; i++) {
        request.attach('photos', photo, `photo-${i}.jpg`);
      }

      await request.expect(400);
    });

    it('refuses a photo larger than 8 MB', async () => {
      await newPost(finder)
        .attach('photos', Buffer.alloc(8 * 1024 * 1024 + 1), 'huge.jpg')
        .expect(413);
    });

    it('needs a signed-in student', async () => {
      await ctx.http().post('/api/posts').field('title', 'Wallet').expect(401);
    });

    it(`allows ${MAX_POSTS_PER_DAY} posts a day per student`, async () => {
      const busy = (await createVerifiedUser(ctx)).auth.accessToken;
      for (let i = 0; i < MAX_POSTS_PER_DAY; i++) {
        await newPost(busy, { type: 'LOST', title: `Umbrella ${i}` }).expect(
          201,
        );
      }

      const refused = await newPost(busy, { type: 'LOST' }).expect(429);
      expect(refused.body.code).toBe('DAILY_POST_LIMIT');
    });

    it('keeps to the daily limit when many posts arrive at the same moment', async () => {
      const busy = (await createVerifiedUser(ctx)).auth.accessToken;
      for (let i = 0; i < MAX_POSTS_PER_DAY - 2; i++) {
        await newPost(busy, { type: 'LOST', title: `Umbrella ${i}` }).expect(
          201,
        );
      }

      const answers = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          newPost(busy, { type: 'LOST', title: `Burst ${i}` }),
        ),
      );

      const statuses = answers
        .map((answer) => answer.status)
        .sort((a, b) => a - b);
      expect(statuses).toEqual([201, 201, 429, 429, 429, 429]);
      const mine = (await get('/api/posts/mine', busy)).body as PostView[];
      expect(mine).toHaveLength(MAX_POSTS_PER_DAY);
    });
  });

  describe('photos', () => {
    let foundPost: PostView;
    let lostPost: PostView;

    beforeAll(async () => {
      const photo = await photoWithGps();
      foundPost = (
        await newPost(finder).attach('photos', photo, 'a.jpg').expect(201)
      ).body;
      lostPost = (
        await newPost(finder, {
          type: 'LOST',
          category: 'KEYS',
          title: 'Car keys',
        })
          .attach('photos', photo, 'b.jpg')
          .expect(201)
      ).body;
    });

    const photo = async (path: string, token: string) =>
      (await get(path, token).buffer(true).expect(200)).body as Buffer;

    it('shows other students a blurred photo of a found item', async () => {
      const [id] = foundPost.photoIds;

      const shown = await photo(`/api/photos/${id}`, other);
      const original = await photo(`/api/photos/${id}/original`, finder);

      expect(await contrast(shown)).toBeLessThan(
        (await contrast(original)) / 3,
      );
    });

    it('shows a lost item clearly', async () => {
      const shown = await photo(`/api/photos/${lostPost.photoIds[0]}`, other);

      expect(await contrast(shown)).toBeGreaterThan(100);
    });

    it('removes the GPS position and other EXIF data', async () => {
      const [id] = foundPost.photoIds;

      for (const image of [
        await photo(`/api/photos/${id}`, other),
        await photo(`/api/photos/${id}/original`, finder),
      ]) {
        expect((await sharp(image).metadata()).exif).toBeUndefined();
      }
    });

    it('sends photos as JPEG that browsers must not guess the type of', async () => {
      const response = await get(
        `/api/photos/${foundPost.photoIds[0]}`,
        other,
      ).expect(200);

      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['cache-control']).toContain('private');
    });

    it('never shows the original to anyone but the poster', async () => {
      await get(`/api/photos/${foundPost.photoIds[0]}/original`, other).expect(
        404,
      );
    });

    it('needs a signed-in student', async () => {
      await ctx.http().get(`/api/photos/${foundPost.photoIds[0]}`).expect(401);
    });

    it('answers 404 for an unknown photo and 400 for a malformed id', async () => {
      await get(
        '/api/photos/0190f5c2-0000-7000-8000-000000000000',
        other,
      ).expect(404);
      await get('/api/photos/../../etc/passwd', other).expect(404);
      await get('/api/photos/not-a-uuid', other).expect(400);
    });
  });

  describe('browsing', () => {
    let searcher: string;
    let marker: string;

    beforeAll(async () => {
      searcher = (await createVerifiedUser(ctx)).auth.accessToken;
      marker = `zq${Date.now()}`;
      await newPost(finder, {
        title: `Blue ${marker} bottle`,
        category: 'OTHER',
      }).expect(201);
      await newPost(finder, {
        type: 'LOST',
        title: 'Calculator',
        description: `Casio with a ${marker.toUpperCase()} sticker`,
        category: 'ELECTRONICS',
        placeId: places[2].id,
      }).expect(201);
    });

    const titlesOf = (page: { items: PostView[] }) =>
      page.items.map((post) => post.title);

    it('lists open posts, newest first', async () => {
      const page = (await get('/api/posts?limit=50', searcher).expect(200))
        .body;

      const dates = page.items.map((post: PostView) => post.createdAt);
      expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
      expect(page.items.every((post: PostView) => post.status === 'OPEN')).toBe(
        true,
      );
      expect(page.items.every((post: PostView) => !post.isMine)).toBe(true);
    });

    it('searches titles and descriptions, ignoring letter case', async () => {
      const page = (
        await get(`/api/posts?q=${marker.toUpperCase()}`, searcher).expect(200)
      ).body;

      expect(titlesOf(page).sort()).toEqual([
        `Blue ${marker} bottle`,
        'Calculator',
      ]);
    });

    it('filters by type, category and place', async () => {
      const lost = (await get(`/api/posts?q=${marker}&type=LOST`, searcher))
        .body;
      const other = (
        await get(`/api/posts?q=${marker}&category=OTHER`, searcher)
      ).body;
      const place = (
        await get(`/api/posts?q=${marker}&placeId=${places[2].id}`, searcher)
      ).body;

      expect(titlesOf(lost)).toEqual(['Calculator']);
      expect(titlesOf(other)).toEqual([`Blue ${marker} bottle`]);
      expect(titlesOf(place)).toEqual(['Calculator']);
    });

    it('pages through results with a cursor', async () => {
      const first = (await get(`/api/posts?q=${marker}&limit=1`, searcher))
        .body;
      const second = (
        await get(
          `/api/posts?q=${marker}&limit=1&cursor=${first.nextCursor}`,
          searcher,
        )
      ).body;

      expect(first.items).toHaveLength(1);
      expect(second.items).toHaveLength(1);
      expect(second.items[0].id).not.toBe(first.items[0].id);
      expect(second.nextCursor).toBeNull();
    });

    it('does not skip a post when the last one on the page was closed meanwhile', async () => {
      const poster = (await createVerifiedUser(ctx)).auth.accessToken;
      const tag = `pg${Date.now()}`;
      for (const name of ['first', 'second', 'third']) {
        await newPost(poster, { title: `${tag} ${name}` }).expect(201);
      }
      const page = (await get(`/api/posts?q=${tag}&limit=1`, searcher)).body;
      expect(titlesOf(page)).toEqual([`${tag} third`]);

      await close(page.items[0].id, poster).expect(200);
      const next = (
        await get(
          `/api/posts?q=${tag}&limit=1&cursor=${page.nextCursor}`,
          searcher,
        )
      ).body;

      expect(titlesOf(next)).toEqual([`${tag} second`]);
    });

    it('refuses a cursor it did not make', async () => {
      await get('/api/posts?cursor=not-a-cursor', searcher).expect(400);
      await get(
        '/api/posts?cursor=0190f5c2-0000-7000-8000-000000000000',
        searcher,
      ).expect(400);
    });

    it('refuses a page size over 50', async () => {
      await get('/api/posts?limit=51', searcher).expect(400);
    });

    it('needs a signed-in student', async () => {
      await ctx.http().get('/api/posts').expect(401);
    });
  });

  describe('changing and closing a post', () => {
    let post: PostView;
    let owner: string;

    beforeAll(async () => {
      owner = (await createVerifiedUser(ctx)).auth.accessToken;
    });

    beforeEach(async () => {
      post = (
        await newPost(owner, {
          title: 'Grey hoodie',
          category: 'CLOTHING',
        }).expect(201)
      ).body;
    });

    it('lets the poster edit the post', async () => {
      const response = await patch(post.id, owner, {
        title: 'Grey ASU hoodie',
        placeId: places[3].id,
        placeDetails: '',
      }).expect(200);

      expect(response.body).toMatchObject({
        title: 'Grey ASU hoodie',
        place: { id: places[3].id },
        placeDetails: null,
      });
    });

    it("answers 404 when someone edits or closes another student's post", async () => {
      await patch(post.id, other, { title: 'Mine now' }).expect(404);
      await close(post.id, other).expect(404);

      expect((await get(`/api/posts/${post.id}`, owner)).body.title).toBe(
        'Grey hoodie',
      );
    });

    it('does not let the type change from found to lost', async () => {
      await patch(post.id, owner, { type: 'LOST' }).expect(400);
    });

    it('hides a closed post from everyone but the poster', async () => {
      await close(post.id, owner).expect(200);

      await get(`/api/posts/${post.id}`, other).expect(404);
      expect(
        (await get(`/api/posts/${post.id}`, owner).expect(200)).body.status,
      ).toBe('CLOSED');
      const mine = (await get('/api/posts/mine', owner).expect(200))
        .body as PostView[];
      expect(mine.find((item) => item.id === post.id)?.status).toBe('CLOSED');
    });

    it('hides the photos of a closed post too', async () => {
      const withPhoto = (
        await newPost(owner)
          .attach('photos', await photoWithGps(100, 100), 'p.jpg')
          .expect(201)
      ).body as PostView;
      await close(withPhoto.id, owner).expect(200);

      await get(`/api/photos/${withPhoto.photoIds[0]}`, other).expect(404);
    });

    it('does not change a closed post', async () => {
      await close(post.id, owner).expect(200);

      await patch(post.id, owner, { title: 'Too late' }).expect(409);
      await close(post.id, owner).expect(409);
    });
  });

  describe('photo files of a failed upload', () => {
    let uploader: string;

    beforeAll(async () => {
      uploader = (await createVerifiedUser(ctx)).auth.accessToken;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('keeps no files when one of the photos is refused', async () => {
      const before = await uploadedFiles();

      await newPost(uploader)
        .attach('photos', await photoWithGps(100, 100), 'wallet.jpg')
        .attach('photos', Buffer.from('%PDF-1.7 fake'), {
          filename: 'receipt.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);

      expect(await uploadedFiles()).toEqual(before);
    });

    it('keeps no files from a post with a place that is not in the list', async () => {
      const before = await uploadedFiles();

      await newPost(uploader, {
        placeId: '0190f5c2-0000-7000-8000-000000000000',
      })
        .attach('photos', await photoWithGps(100, 100), 'wallet.jpg')
        .expect(400);

      expect(await uploadedFiles()).toEqual(before);
    });

    it('keeps no files when the disk fails halfway through an upload', async () => {
      const storage = ctx.app.get(FileStorage);
      const save = storage.save.bind(storage);
      vi.spyOn(storage, 'save')
        .mockImplementationOnce(save)
        .mockImplementationOnce(save)
        .mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));
      const photo = await photoWithGps(100, 100);
      const before = await uploadedFiles();

      await newPost(uploader)
        .attach('photos', photo, 'wallet-1.jpg')
        .attach('photos', photo, 'wallet-2.jpg')
        .expect(500);

      expect(await uploadedFiles()).toEqual(before);
    });

    it('keeps no files when the post cannot be saved after its photos were', async () => {
      const student = await createVerifiedUser(ctx);
      const storage = ctx.app.get(FileStorage);
      const save = storage.save.bind(storage);
      vi.spyOn(storage, 'save').mockImplementationOnce(async (key, data) => {
        await ctx.prisma.user.delete({ where: { email: student.email } });
        return save(key, data);
      });
      const before = await uploadedFiles();

      const response = await newPost(student.auth.accessToken).attach(
        'photos',
        await photoWithGps(100, 100),
        'wallet.jpg',
      );

      expect(response.status).not.toBe(201);
      expect(await uploadedFiles()).toEqual(before);
    });
  });

  describe('refused edits', () => {
    let owner: string;
    let post: PostView;

    beforeAll(async () => {
      owner = (await createVerifiedUser(ctx)).auth.accessToken;
      post = (
        await newPost(owner, {
          type: 'LOST',
          title: 'Blue umbrella',
          category: 'OTHER',
        }).expect(201)
      ).body;
    });

    it.each([
      [
        'a place that is not in the list',
        { placeId: '0190f5c2-0000-7000-8000-000000000000' },
      ],
      ['a malformed place id', { placeId: 'library' }],
      ['a date in the future', { happenedOn: '2099-01-01' }],
      ['a date before 2020', { happenedOn: '2019-12-31' }],
      ['a date that does not exist', { happenedOn: '2026-02-30' }],
      ['a date in another format', { happenedOn: '16/10/2026' }],
      ['a short title', { title: '  ab  ' }],
      ['an unknown category', { category: 'CAR' }],
      ['an extra field', { status: 'RETURNED' }],
      ['a new author', { authorId: '0190f5c2-0000-7000-8000-000000000000' }],
      ['a title set to null', { title: null }],
      ['a category set to null', { category: null }],
      ['a place set to null', { placeId: null }],
      ['a description set to null', { description: null }],
    ])('refuses %s and leaves the post as it was', async (_name, body) => {
      await patch(post.id, owner, body).expect(400);

      expect(
        (await get(`/api/posts/${post.id}`, owner).expect(200)).body,
      ).toEqual(post);
    });
  });

  describe('access to posts and photos', () => {
    const unknownId = '0190f5c2-0000-7000-8000-000000000000';
    let poster: string;
    let marker: string;
    let open: PostView;
    let closed: PostView;
    let returned: PostView;

    beforeAll(async () => {
      poster = (await createVerifiedUser(ctx)).auth.accessToken;
      marker = `zx${Date.now()}`;
      const photo = await photoWithGps(100, 100);
      open = (
        await newPost(poster, { title: `Red ${marker} scarf` })
          .attach('photos', photo, 'a.jpg')
          .expect(201)
      ).body;
      closed = (
        await newPost(poster, { title: `Green ${marker} scarf` })
          .attach('photos', photo, 'b.jpg')
          .expect(201)
      ).body;
      await close(closed.id, poster).expect(200);
      returned = (
        await newPost(poster, { title: `Grey ${marker} scarf` })
          .attach('photos', photo, 'c.jpg')
          .expect(201)
      ).body;
      await ctx.prisma.post.update({
        where: { id: returned.id },
        data: { status: 'RETURNED' },
      });
    });

    it("shows another student's post as not theirs", async () => {
      const seen = (await get(`/api/posts/${open.id}`, other).expect(200))
        .body as PostView;

      expect(seen.isMine).toBe(false);
      expect(seen.author).toEqual({ firstName: 'Ahmad' });
    });

    it('leaves closed and returned posts out of Browse, even for the poster', async () => {
      for (const token of [poster, other]) {
        const page = (await get(`/api/posts?q=${marker}`, token).expect(200))
          .body as { items: PostView[] };

        expect(page.items.map((post) => post.id)).toEqual([open.id]);
      }
    });

    it('shows other students a returned post and its photo', async () => {
      const seen = (await get(`/api/posts/${returned.id}`, other).expect(200))
        .body as PostView;

      expect(seen.status).toBe('RETURNED');
      await get(`/api/photos/${returned.photoIds[0]}`, other).expect(200);
    });

    it('does not change a returned post', async () => {
      await patch(returned.id, poster, { title: 'Grey wool scarf' }).expect(
        409,
      );
      await close(returned.id, poster).expect(409);
    });

    it('still shows the poster both photos of a closed post', async () => {
      const [id] = closed.photoIds;

      await get(`/api/photos/${id}`, poster).expect(200);
      await get(`/api/photos/${id}/original`, poster).expect(200);
    });

    it("answers 404, not 409, when someone changes another student's closed post", async () => {
      await patch(closed.id, other, { title: 'Mine now' }).expect(404);
      await close(closed.id, other).expect(404);
    });

    it("keeps other students' posts out of My posts", async () => {
      const mine = (await get('/api/posts/mine', other).expect(200))
        .body as PostView[];

      expect(mine.map((post) => post.id)).not.toContain(open.id);
      expect(mine.map((post) => post.id)).not.toContain(closed.id);
    });

    it('answers 404 for an unknown post and 400 for a malformed id', async () => {
      await get(`/api/posts/${unknownId}`, other).expect(404);
      await patch(unknownId, other, { title: 'Scarf' }).expect(404);
      await close(unknownId, other).expect(404);
      await get('/api/posts/not-a-uuid', other).expect(400);
      await patch('not-a-uuid', other, { title: 'Scarf' }).expect(400);
      await close('not-a-uuid', other).expect(400);
      await get('/api/photos/not-a-uuid/original', other).expect(400);
    });

    it.each([
      ['get', '/api/posts/mine'],
      ['get', `/api/posts/${unknownId}`],
      ['patch', `/api/posts/${unknownId}`],
      ['post', `/api/posts/${unknownId}/close`],
      ['get', `/api/photos/${unknownId}/original`],
    ] as const)('needs a signed-in student to %s %s', async (method, path) => {
      await ctx.http()[method](path).expect(401);
    });
  });
});
