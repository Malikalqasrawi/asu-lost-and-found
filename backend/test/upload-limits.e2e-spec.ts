import sharp from 'sharp';
import type { PlaceView } from '../src/places/places.service.js';
import { createVerifiedUser } from './support/accounts.js';
import { createTestApp, TestContext } from './support/app.js';

vi.hoisted(() => {
  process.env.RATE_LIMIT_UPLOADS_PER_MINUTE = '2';
});

describe('upload limits', () => {
  let ctx: TestContext;
  let places: PlaceView[];

  beforeAll(async () => {
    ctx = await createTestApp();
    const { auth } = await createVerifiedUser(ctx);
    places = (
      await ctx
        .http()
        .get('/api/places')
        .set('Authorization', `Bearer ${auth.accessToken}`)
    ).body;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  function newPost(token: string) {
    return ctx
      .http()
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'FOUND')
      .field('title', 'Black leather wallet')
      .field('category', 'WALLET')
      .field('placeId', places[0].id)
      .field('happenedOn', new Date().toISOString().slice(0, 10));
  }

  it('limits posts per student, not per network address', async () => {
    const ahmad = (await createVerifiedUser(ctx)).auth.accessToken;
    const sara = (await createVerifiedUser(ctx)).auth.accessToken;

    await newPost(ahmad).expect(201);
    await newPost(ahmad).expect(201);
    await newPost(ahmad).expect(429);

    await newPost(sara).expect(201);
  });

  it('refuses a small file that unpacks into a 16-bit image, without decoding it', async () => {
    const student = (await createVerifiedUser(ctx)).auth.accessToken;
    const crafted = await sharp({
      create: { width: 3000, height: 3000, channels: 3, background: 'black' },
    })
      .toColourspace('rgb16')
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect((await sharp(crafted).metadata()).depth).toBe('ushort');
    expect(crafted.length).toBeLessThan(200 * 1024);

    const started = Date.now();
    const response = await newPost(student)
      .attach('photos', crafted, 'photo.png')
      .expect(400);

    expect(response.body.message).toBe('Upload JPEG, PNG or WebP photos');
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('refuses a photo of more than 25 megapixels with a clear message', async () => {
    const student = (await createVerifiedUser(ctx)).auth.accessToken;
    const huge = await sharp({
      create: { width: 6000, height: 5000, channels: 3, background: 'grey' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    const response = await newPost(student)
      .attach('photos', huge, 'photo.png')
      .expect(400);

    expect(response.body.message).toBe(
      'This photo is too large. Use one of at most 25 megapixels.',
    );
  });

  it('refuses an animated image', async () => {
    const student = (await createVerifiedUser(ctx)).auth.accessToken;
    const frame = {
      width: 40,
      height: 40,
      channels: 3 as const,
      background: 'red',
    };
    const animated = await sharp(
      [
        await sharp({ create: frame }).png().toBuffer(),
        await sharp({ create: { ...frame, background: 'blue' } })
          .png()
          .toBuffer(),
      ],
      { join: { animated: true } },
    )
      .webp()
      .toBuffer();

    await newPost(student).attach('photos', animated, 'photo.webp').expect(400);
  });
});
