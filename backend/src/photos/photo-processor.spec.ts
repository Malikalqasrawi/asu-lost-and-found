import sharp from 'sharp';
import { processPhoto, UnsupportedPhotoError } from './photo-processor.js';

function checkerboard(width: number, height: number): Promise<Buffer> {
  const square = 20;
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const white = (Math.floor(x / square) + Math.floor(y / square)) % 2 === 0;
      pixels.fill(
        white ? 255 : 0,
        (y * width + x) * 3,
        (y * width + x) * 3 + 3,
      );
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

async function contrast(image: Buffer): Promise<number> {
  const { channels } = await sharp(image).stats();
  return channels[0].stdev;
}

describe('processPhoto', () => {
  it('removes EXIF data, including the GPS position', async () => {
    const withGps = await sharp(await checkerboard(400, 300))
      .jpeg()
      .withExif({
        IFD0: {
          Make: 'PhoneMaker',
          Model: 'Phone 15',
          Copyright: 'Ahmad Saleh',
        },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '32/1 1/1 30/1' },
      })
      .toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeDefined();

    const processed = await processPhoto(withGps, { blur: false });

    for (const image of [processed.original, processed.public]) {
      const metadata = await sharp(image).metadata();
      expect(metadata.exif).toBeUndefined();
      expect(image.includes('Ahmad Saleh')).toBe(false);
    }
  });

  it('blurs the public photo of a found item and keeps the original sharp', async () => {
    const photo = await checkerboard(400, 400);

    const processed = await processPhoto(photo, { blur: true });

    expect(await contrast(processed.public)).toBeLessThan(
      (await contrast(processed.original)) / 3,
    );
  });

  it('keeps the public photo of a lost item clear', async () => {
    const processed = await processPhoto(await checkerboard(400, 400), {
      blur: false,
    });

    expect(await contrast(processed.public)).toBeGreaterThan(100);
  });

  it('shrinks large photos and never enlarges small ones', async () => {
    const large = await processPhoto(await checkerboard(3200, 2400), {
      blur: false,
    });
    const small = await processPhoto(await checkerboard(300, 200), {
      blur: false,
    });

    expect(await sharp(large.original).metadata()).toMatchObject({
      width: 1600,
      height: 1200,
      format: 'jpeg',
    });
    expect(await sharp(large.public).metadata()).toMatchObject({
      width: 800,
      height: 600,
    });
    expect(await sharp(small.original).metadata()).toMatchObject({
      width: 300,
      height: 200,
    });
  });

  it('turns a photo the right way up using its EXIF orientation', async () => {
    const sideways = await sharp(await checkerboard(400, 200))
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const processed = await processPhoto(sideways, { blur: false });

    expect(await sharp(processed.original).metadata()).toMatchObject({
      width: 200,
      height: 400,
    });
  });

  it.each([
    ['a text file', Buffer.from('not an image at all')],
    ['a PDF', Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n')],
    ['an SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
  ])('refuses %s', async (_name, upload) => {
    await expect(processPhoto(upload, { blur: false })).rejects.toBeInstanceOf(
      UnsupportedPhotoError,
    );
  });

  it('refuses a GIF even though it is an image', async () => {
    const gif = await sharp(await checkerboard(40, 40))
      .gif()
      .toBuffer();

    await expect(processPhoto(gif, { blur: false })).rejects.toBeInstanceOf(
      UnsupportedPhotoError,
    );
  });

  it('refuses a 16-bit image from its header, before decoding it', async () => {
    const deep = await sharp({
      create: { width: 2000, height: 2000, channels: 3, background: 'black' },
    })
      .toColourspace('rgb16')
      .png()
      .toBuffer();

    const started = performance.now();
    await expect(processPhoto(deep, { blur: true })).rejects.toBeInstanceOf(
      UnsupportedPhotoError,
    );
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('refuses a photo over 25 megapixels with a clear message', async () => {
    const huge = await sharp({
      create: { width: 6000, height: 5000, channels: 3, background: 'grey' },
    })
      .jpeg()
      .toBuffer();

    await expect(processPhoto(huge, { blur: false })).rejects.toThrow(
      'This photo is too large. Use one of at most 25 megapixels.',
    );
  });

  it('accepts a photo of exactly 25 megapixels', async () => {
    const largest = await sharp({
      create: { width: 5000, height: 5000, channels: 3, background: 'grey' },
    })
      .jpeg()
      .toBuffer();

    const processed = await processPhoto(largest, { blur: false });

    expect(await sharp(processed.original).metadata()).toMatchObject({
      width: 1600,
      height: 1600,
    });
  });

  it('refuses an animated image', async () => {
    const frames = await Promise.all(
      ['red', 'blue'].map((background) =>
        sharp({ create: { width: 40, height: 40, channels: 3, background } })
          .png()
          .toBuffer(),
      ),
    );
    const animated = await sharp(frames, { join: { animated: true } })
      .webp()
      .toBuffer();

    await expect(
      processPhoto(animated, { blur: false }),
    ).rejects.toBeInstanceOf(UnsupportedPhotoError);
  });
});
