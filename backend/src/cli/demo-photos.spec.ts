import sharp from 'sharp';
import { demoPhoto, type DemoItem } from './demo-photos.js';

const items: DemoItem[] = [
  'wallet',
  'keys',
  'umbrella',
  'earbuds',
  'calculator',
  'bottle',
  'backpack',
  'books',
  'phone',
];

describe('demoPhoto', () => {
  it.each(items)('draws the %s as a 1200 by 900 JPEG', async (item) => {
    const metadata = await sharp(await demoPhoto(item)).metadata();

    expect(metadata).toMatchObject({
      format: 'jpeg',
      width: 1200,
      height: 900,
    });
  });
});
