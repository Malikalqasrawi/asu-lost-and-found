import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import type { Handover, Message } from '@/api/handovers';
import type { Post } from '@/api/posts';
import { clearTokens } from '@/session/tokens';
import { mockApi, requestsTo, signedIn } from '@/test/mock-api';
import { press, type } from '@/test/screen';

const POST_ID = '7b1e0c3a-5f2d-4c61-9a8e-2d4f6b8c0a11';

const { resetSecureStore } = SecureStore as unknown as { resetSecureStore: () => void };

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: POST_ID,
    type: 'LOST',
    status: 'OPEN',
    title: 'Grey umbrella',
    description: '',
    category: 'OTHER',
    place: { id: 'place-library', name: 'Library' },
    placeDetails: '',
    happenedOn: '2026-10-16',
    createdAt: '2026-10-16T10:00:00.000Z',
    author: { firstName: 'Omar' },
    isMine: false,
    canSeeOriginals: false,
    photoIds: [],
    desk: null,
    hidden: false,
    ...overrides,
  };
}

const handover: Handover = {
  postId: POST_ID,
  title: 'Black wallet',
  role: 'OWNER',
  otherPerson: { firstName: 'Omar' },
  pickupCode: '482913',
  codeLocked: false,
  returnedAt: null,
  unread: 0,
};

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: '9c2f1d4b-6a3e-4d72-8b9f-3e5a7c9d1b22',
    mine: false,
    text: 'Pay me 50 JOD first',
    removed: false,
    createdAt: '2026-10-17T11:00:00.000Z',
    ...overrides,
  };
}

async function pressWhenShown(name: string) {
  await screen.findByRole('button', { name });
  await press(name);
}

async function openPost(item: Post, routes: Parameters<typeof mockApi>[0]) {
  const fetchMock = mockApi({
    ...signedIn,
    'GET /posts': () => [200, { items: [item], nextCursor: null }],
    'GET /posts/7b1e0c3a-5f2d-4c61-9a8e-2d4f6b8c0a11': () => [200, item],
    ...routes,
  });
  await renderRouter('./src/app');
  await pressWhenShown(`${item.type === 'LOST' ? 'Lost' : 'Found'}: ${item.title}`);
  return fetchMock;
}

describe('moderation in the app', () => {
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

  it("reports someone else's post with a reason", async () => {
    let sent: unknown;
    fetchMock = await openPost(post(), {
      'POST /posts/7b1e0c3a-5f2d-4c61-9a8e-2d4f6b8c0a11/reports': (body) => {
        sent = body;
        return [204];
      },
    });

    await pressWhenShown('Report this post');
    await pressWhenShown('Send report');
    expect(screen.getByText('Choose a reason.')).toBeOnTheScreen();
    await press('Spam');
    await type('More details (optional)', ' Posted ten times ');
    await press('Send report');

    expect(
      await screen.findByText('Thanks for telling us. A moderator will look at it.'),
    ).toBeOnTheScreen();
    expect(sent).toEqual({ reason: 'SPAM', details: 'Posted ten times' });
  });

  it('shows when the post was already reported', async () => {
    fetchMock = await openPost(post(), {
      'POST /posts/7b1e0c3a-5f2d-4c61-9a8e-2d4f6b8c0a11/reports': () => [
        409,
        { message: 'You already reported this.' },
      ],
    });

    await pressWhenShown('Report this post');
    await pressWhenShown('Fake or misleading');
    await press('Send report');

    expect(await screen.findByText('You already reported this.')).toBeOnTheScreen();
  });

  it('has no report button on my own post, and tells me when it was hidden', async () => {
    fetchMock = await openPost(post({ isMine: true, hidden: true }), {
      'GET /posts/7b1e0c3a-5f2d-4c61-9a8e-2d4f6b8c0a11/matches': () => [200, []],
    });

    expect(
      await screen.findByText("A moderator hid this post. Other students can't see it."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Report this post' })).toBeNull();
  });

  it('reports a chat message with a long press, and shows removed ones', async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [], nextCursor: null }],
      'GET /handovers/mine': () => [
        200,
        [{ ...handover, lastMessage: message(), unread: 0, returnedAt: null }],
      ],
      'GET /posts/7b1e0c3a-5f2d-4c61-9a8e-2d4f6b8c0a11/handover': () => [200, handover],
      'GET /posts/7b1e0c3a-5f2d-4c61-9a8e-2d4f6b8c0a11/messages': () => [
        200,
        [message({ id: 'message-0', removed: true, text: '' }), message()],
      ],
      'POST /messages/9c2f1d4b-6a3e-4d72-8b9f-3e5a7c9d1b22/reports': () => [204],
    });
    await renderRouter('./src/app');
    await screen.findByText('Hi, Ahmad');
    await fireEvent.press(screen.getByText('Messages'));
    await pressWhenShown('Black wallet, with Omar');

    expect(await screen.findByText('A moderator removed this message.')).toBeOnTheScreen();
    await fireEvent(screen.getByText('Pay me 50 JOD first'), 'longPress');
    await pressWhenShown('Offensive');
    await press('Send report');

    await waitFor(() =>
      expect(
        requestsTo(fetchMock!, 'POST', '/messages/9c2f1d4b-6a3e-4d72-8b9f-3e5a7c9d1b22/reports'),
      ).toHaveLength(1),
    );
  });

  it('refuses a report link that does not name a real post or message', async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [], nextCursor: null }],
    });
    await renderRouter('./src/app', { initialUrl: '/report?post=../posts/x/close%23' });

    expect(await screen.findByText('There is nothing to report here.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Send report' })).toBeNull();
  });

  it('tells a banned student why they cannot sign in', async () => {
    await SecureStore.deleteItemAsync('refreshToken');
    fetchMock = mockApi({
      'POST /auth/login': () => [
        403,
        {
          message: 'This account is blocked until 25 Oct 2026. Check your email for the reason.',
          code: 'ACCOUNT_BANNED',
        },
      ],
    });
    await renderRouter('./src/app');
    await screen.findByRole('header', { name: 'Sign in' });

    await type('University email', 'omar@asu.edu.jo');
    await type('Password', 'correct-horse-42');
    await press('Sign in');

    expect(
      await screen.findByText(
        'This account is blocked until 25 Oct 2026. Check your email for the reason.',
      ),
    ).toBeOnTheScreen();
  });
});
