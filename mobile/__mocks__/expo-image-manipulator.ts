// The real module is native. In tests a photo comes back as it went in.
export const SaveFormat = { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' };

export const ImageManipulator = {
  manipulate: jest.fn((uri: string) => ({
    renderAsync: jest.fn(async () => ({
      saveAsync: jest.fn(async () => ({ uri, width: 0, height: 0 })),
    })),
  })),
};
