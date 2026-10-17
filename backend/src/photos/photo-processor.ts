import sharp from 'sharp';

export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
// About 6100 x 4100. Phones that shoot bigger photos are resized by the app first.
const MAX_INPUT_PIXELS = 25_000_000;
const ORIGINAL_SIZE = 1600;
const PUBLIC_SIZE = 800;
const BLUR_SIGMA = 30;

export class UnsupportedPhotoError extends Error {
  constructor(message = 'Upload JPEG, PNG or WebP photos') {
    super(message);
  }
}

export interface ProcessedPhoto {
  original: Buffer;
  public: Buffer;
}

/**
 * Reads only the header first, so a small file that unpacks into a huge or
 * 16-bit image is refused before any decoding work. Every accepted photo is
 * re-encoded as a new JPEG; sharp writes no metadata unless asked to, so EXIF
 * data such as the GPS position and the phone model is dropped.
 */
export async function processPhoto(
  input: Buffer,
  { blur }: { blur: boolean },
): Promise<ProcessedPhoto> {
  const header = await sharp(input)
    .metadata()
    .catch(() => null);
  if (
    !header?.format ||
    !ACCEPTED_FORMATS.has(header.format) ||
    header.depth !== 'uchar' ||
    (header.pages ?? 1) > 1
  ) {
    throw new UnsupportedPhotoError();
  }
  if (
    !header.width ||
    !header.height ||
    header.width * header.height > MAX_INPUT_PIXELS
  ) {
    throw new UnsupportedPhotoError(
      'This photo is too large. Use one of at most 25 megapixels.',
    );
  }

  try {
    const fit = { fit: 'inside', withoutEnlargement: true } as const;
    const original = await sharp(input, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: 'error',
    })
      .rotate()
      .resize(ORIGINAL_SIZE, ORIGINAL_SIZE, fit)
      .jpeg({ quality: 85 })
      .toBuffer();

    // Made from the small original, so the full photo is decoded only once.
    let shown = sharp(original).resize(PUBLIC_SIZE, PUBLIC_SIZE, fit);
    if (blur) {
      shown = shown.blur(BLUR_SIGMA);
    }
    return { original, public: await shown.jpeg({ quality: 75 }).toBuffer() };
  } catch {
    throw new UnsupportedPhotoError();
  }
}
