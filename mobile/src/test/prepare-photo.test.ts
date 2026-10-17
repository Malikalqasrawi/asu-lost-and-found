import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { MAX_SIDE, preparePhoto } from '@/media/prepare-photo';

const manipulate = jest.mocked(ImageManipulator.manipulate);

describe('preparePhoto', () => {
  beforeEach(() => {
    manipulate.mockClear();
  });

  it('shrinks the photo while reading it, never past the maximum side', async () => {
    await preparePhoto('file:///photo.jpg');

    expect(manipulate).toHaveBeenCalledWith('file:///photo.jpg', {
      maxWidth: MAX_SIDE,
      maxHeight: MAX_SIDE,
    });
  });

  it('saves the photo as a JPEG', async () => {
    const photo = await preparePhoto('file:///photo.heic');

    const context = manipulate.mock.results[0].value as { renderAsync: jest.Mock };
    const image = await context.renderAsync.mock.results[0].value;
    expect(image.saveAsync).toHaveBeenCalledWith({ compress: 0.8, format: SaveFormat.JPEG });
    expect(photo).toEqual({ uri: 'file:///photo.heic' });
  });
});
