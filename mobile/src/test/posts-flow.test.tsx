import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import type { Post } from '@/api/posts';
import { clearTokens } from '@/session/tokens';
import { mockApi, requestsTo, signedIn } from '@/test/mock-api';
import { press } from '@/test/screen';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));

const { resetSecureStore } = SecureStore as unknown as { resetSecureStore: () => void };

const places = [
  { id: 'place-library', name: 'Library' },
  { id: 'place-it', name: 'Faculty of Information Technology' },
];

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    type: 'FOUND',
    status: 'OPEN',
    title: 'Black leather wallet',
    description: 'Found on a bench',
    category: 'WALLET',
    place: places[0],
    placeDetails: 'Second floor',
    happenedOn: '2026-10-16',
    createdAt: '2026-10-16T10:00:00.000Z',
    author: { firstName: 'Sara' },
    isMine: false,
    photoIds: [],
    ...overrides,
  };
}

async function fillInFoundWallet() {
  await press('Post an item');
  await screen.findByText('What happened?');
  await press('I found something');
  await fireEvent.changeText(screen.getByLabelText('Title'), 'Black leather wallet');
  await press('Wallet');
  await screen.findByRole('button', { name: 'Library' });
  await press('Library');
}

function pickOnePhoto() {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///photos/wallet.jpg', width: 800, height: 600 }],
  } as ImagePicker.ImagePickerResult);
}

describe('lost and found posts', () => {
  let fetchMock: jest.SpyInstance | undefined;
  beforeEach(async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:4000/api';
    resetSecureStore();
    await clearTokens();
    await SecureStore.setItemAsync('refreshToken', 'stored-refresh');
  });

  afterEach(() => {
    fetchMock?.mockRestore();
    jest.restoreAllMocks();
  });

  it('shows open posts on Browse and searches them', async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [
        200,
        {
          items: [post(), post({ id: 'post-2', type: 'LOST', title: 'Car keys', category: 'KEYS' })],
          nextCursor: null,
        },
      ],
    });
    await renderRouter('./src/app');

    expect(await screen.findByRole('button', { name: 'Found: Black leather wallet' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lost: Car keys' })).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Search posts'), ' wallet ');
    await waitFor(() =>
      expect(fetchMock?.mock.calls.some(([url]) => String(url).endsWith('/posts?q=wallet'))).toBe(true),
    );

    await press('Lost');
    await waitFor(() =>
      expect(
        fetchMock?.mock.calls.some(([url]) => String(url).endsWith('/posts?type=LOST&q=wallet')),
      ).toBe(true),
    );
  });

  it('posts a found item with a photo and opens it', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photos/wallet.jpg', width: 800, height: 600 }],
    } as ImagePicker.ImagePickerResult);
    let sent: [string, unknown][] = [];
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [], nextCursor: null }],
      'GET /places': () => [200, places],
      'POST /posts': (form: FormData) => {
        sent = (form as unknown as { getParts(): { fieldName: string; string?: string; uri?: string }[] })
          .getParts()
          .map((part) => [part.fieldName, part.string ?? part.uri]);
        return [201, post({ id: 'post-9', isMine: true, photoIds: ['photo-1'] })];
      },
      'GET /posts/post-9': () => [200, post({ id: 'post-9', isMine: true, photoIds: ['photo-1'] })],
    });
    await renderRouter('./src/app');
    await press('Post an item');
    await screen.findByText('What happened?');

    await press('I found something');
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Black leather wallet');
    await press('Wallet');
    await screen.findByRole('button', { name: 'Library' });
    await press('Library');
    await fireEvent.changeText(screen.getByLabelText('More about the place (optional)'), 'Second floor');
    await press('Choose photos');
    await screen.findByLabelText('Photo 1');
    await press('Post');

    expect(
      await screen.findByText('You see the original photos. Other students see them blurred.'),
    ).toBeOnTheScreen();
    expect(sent).toEqual(
      expect.arrayContaining([
        ['type', 'FOUND'],
        ['title', 'Black leather wallet'],
        ['category', 'WALLET'],
        ['placeId', 'place-library'],
        ['placeDetails', 'Second floor'],
        ['photos', 'file:///photos/wallet.jpg'],
      ]),
    );
    expect(sent.map(([name]) => name)).not.toContain('description');
  });

  it('checks the form before posting', async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [], nextCursor: null }],
      'GET /places': () => [200, places],
    });
    await renderRouter('./src/app');
    await press('Post an item');
    await screen.findByText('What happened?');

    await press('Post');

    expect(screen.getByText('Choose lost or found.')).toBeOnTheScreen();
    expect(screen.getByText('Choose a category.')).toBeOnTheScreen();
    expect(screen.getByText('Choose where it happened.')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/posts')).toHaveLength(0);
  });

  it("shows someone else's found post without a close button", async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [post()], nextCursor: null }],
      'GET /posts/post-1': () => [200, post()],
    });
    await renderRouter('./src/app');

    await screen.findByRole('button', { name: 'Found: Black leather wallet' });
    await press('Found: Black leather wallet');

    expect(await screen.findByText('Library, Second floor')).toBeOnTheScreen();
    expect(screen.getByText('Sara')).toBeOnTheScreen();
    expect(screen.getByText(/Is this yours\?/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Close post' })).toBeNull();
  });

  it('closes my own post after asking', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Close post')?.onPress?.();
    });
    const mine = post({ isMine: true, type: 'LOST', title: 'Grey hoodie', category: 'CLOTHING' });
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [mine], nextCursor: null }],
      'GET /posts/post-1': () => [200, mine],
      'POST /posts/post-1/close': () => [200, { ...mine, status: 'CLOSED' }],
    });
    await renderRouter('./src/app');
    await screen.findByRole('button', { name: 'Lost: Grey hoodie' });
    await press('Lost: Grey hoodie');

    await screen.findByRole('button', { name: 'Close post' });
    await press('Close post');

    await waitFor(() => expect(requestsTo(fetchMock!, 'POST', '/posts/post-1/close')).toHaveLength(1));
  });

  it('lists my posts, including closed ones', async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [], nextCursor: null }],
      'GET /posts/mine': () => [
        200,
        [post({ isMine: true, status: 'CLOSED', title: 'Old umbrella', category: 'OTHER' })],
      ],
    });
    await renderRouter('./src/app');
    await screen.findByText('Hi, Ahmad');

    await fireEvent.press(screen.getByText('My posts'));

    expect(await screen.findByRole('button', { name: 'Found: Old umbrella' })).toBeOnTheScreen();
    expect(screen.getByText('Closed')).toBeOnTheScreen();
  });

  it('shows why the upload failed and keeps the form', async () => {
    pickOnePhoto();
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [], nextCursor: null }],
      'GET /places': () => [200, places],
      'POST /posts': () => [
        400,
        { statusCode: 400, message: 'Upload JPEG, PNG or WebP photos', error: 'Bad Request' },
      ],
    });
    await renderRouter('./src/app');
    await fillInFoundWallet();
    await press('Choose photos');
    await screen.findByLabelText('Photo 1');

    await press('Post');

    expect(await screen.findByText('Upload JPEG, PNG or WebP photos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Title')).toHaveDisplayValue('Black leather wallet');
    expect(screen.getByLabelText('Photo 1')).toBeOnTheScreen();
  });

  it('tells the student when the upload cannot reach the server', async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [], nextCursor: null }],
      'GET /places': () => [200, places],
      'POST /posts': () => {
        throw new TypeError('Network request failed');
      },
    });
    await renderRouter('./src/app');
    await fillInFoundWallet();

    await press('Post');

    expect(
      await screen.findByText("Can't reach the server. Check your connection and try again."),
    ).toBeOnTheScreen();
    expect(screen.getByText('What happened?')).toBeOnTheScreen();
  });

  it('asks for camera access before taking a photo', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
      granted: false,
    } as ImagePicker.CameraPermissionResponse);
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [], nextCursor: null }],
      'GET /places': () => [200, places],
    });
    await renderRouter('./src/app');
    await press('Post an item');
    await screen.findByText('What happened?');

    await press('Take a photo');

    expect(
      await screen.findByText('Allow camera access in your phone settings to take a photo.'),
    ).toBeOnTheScreen();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('shows an error when the places cannot load', async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [], nextCursor: null }],
      'GET /places': () => [500, { statusCode: 500, message: 'Internal server error' }],
    });
    await renderRouter('./src/app');
    await press('Post an item');

    expect(
      await screen.findByText(
        'Something went wrong on our side. Try again in a moment.',
        {},
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Library' })).toBeNull();
  });

  it('shows an error instead of a post that cannot be opened', async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [post()], nextCursor: null }],
      'GET /posts/post-1': () => [
        404,
        { statusCode: 404, message: 'This post does not exist or was closed.' },
      ],
    });
    await renderRouter('./src/app');
    await screen.findByRole('button', { name: 'Found: Black leather wallet' });

    await press('Found: Black leather wallet');

    expect(
      await screen.findByText('This post does not exist or was closed.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Black leather wallet' })).toBeNull();
  });

  it('shows why a post could not be closed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Close post')?.onPress?.();
    });
    const mine = post({ isMine: true });
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [mine], nextCursor: null }],
      'GET /posts/post-1': () => [200, mine],
      'POST /posts/post-1/close': () => [409, { statusCode: 409, message: 'Only open posts can be changed' }],
    });
    await renderRouter('./src/app');
    await screen.findByRole('button', { name: 'Found: Black leather wallet' });
    await press('Found: Black leather wallet');
    await screen.findByRole('button', { name: 'Close post' });

    await press('Close post');

    expect(await screen.findByText('Only open posts can be changed')).toBeOnTheScreen();
  });

  it('shows an error on Browse when the posts cannot load', async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [500, { statusCode: 500, message: 'Internal server error' }],
    });

    await renderRouter('./src/app');

    expect(
      await screen.findByText(
        'Something went wrong on our side. Try again in a moment.',
        {},
      ),
    ).toBeOnTheScreen();
  });

  it('does not say there are no posts when they could not load', async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [500, { statusCode: 500, message: 'Internal server error' }],
    });
    await renderRouter('./src/app');

    await screen.findByText(
      'Something went wrong on our side. Try again in a moment.',
      {},
    );

    expect(screen.queryByText('No posts yet. Lost or found something? Post it.')).toBeNull();
  });
});
