import sharp from 'sharp';

/** A black and white checkerboard photo with the phone's GPS position in its EXIF data. */
export async function photoWithGps(width = 600, height = 400): Promise<Buffer> {
  const square = 25;
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const white = (Math.floor(x / square) + Math.floor(y / square)) % 2 === 0;
      const at = (y * width + x) * 3;
      pixels.fill(white ? 255 : 0, at, at + 3);
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'PhoneMaker', Model: 'Phone 15' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '32/1 1/1 30/1' },
    })
    .toBuffer();
}

export async function contrast(image: Buffer): Promise<number> {
  const { channels } = await sharp(image).stats();
  return channels[0].stdev;
}
