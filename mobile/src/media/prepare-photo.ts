import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PickedPhoto } from '@/api/posts';

// The server keeps photos at 1600 px, so anything bigger only costs upload time.
export const MAX_SIDE = 2000;

/**
 * Shrinks a photo while it is being read, so a 48 or 108 megapixel photo is
 * never held in memory at full size, and saves it as a JPEG for the upload.
 */
export async function preparePhoto(uri: string): Promise<PickedPhoto> {
  const image = await ImageManipulator.manipulate(uri, {
    maxWidth: MAX_SIDE,
    maxHeight: MAX_SIDE,
  }).renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: saved.uri };
}
