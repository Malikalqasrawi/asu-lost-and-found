import * as SecureStore from 'expo-secure-store';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import type { Match } from '@/api/matches';
import type { Post } from '@/api/posts';
import { clearTokens } from '@/session/tokens';
import { mockApi, requestsTo, signedIn } from '@/test/mock-api';
import { press } from '@/test/screen';

const { resetSecureStore } = SecureStore as unknown as { resetSecureStore: () => void };

const library = { id: 'place-library', name: 'Library' };

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    type: 'LOST',
    status: 'OPEN',
    title: 'Black leather wallet',
    description: '',
    category: 'WALLET',
    place: library,
    placeDetails: '',
    happenedOn: '2026-10-16',
    createdAt: '2026-10-16T10:00:00.000Z',
    author: { firstName: 'Ahmad' },
    isMine: true,
    canSeeOriginals: true,
    photoIds: [],
    desk: null,
    hidden: false,
    ...overrides,
  };
}

const foundWallet = post({
  id: 'post-2',
  type: 'FOUND',
  title: 'Black wallet',
  author: { firstName: 'Sara' },
  isMine: false,
  canSeeOriginals: false,
  happenedOn: '2026-10-17',
});

const match: Match = {
  post: foundWallet,
  score: 88,
  reasons: ['Same place', 'Found the next day', 'Similar title'],
};

async function pressWhenShown(name: string) {
  await screen.findByRole('button', { name });
  await press(name);
}

/** The app with one post on Browse, opened by the student. */
async function openPost(item: Post, routes: Parameters<typeof mockApi>[0]) {
  const fetchMock = mockApi({
    ...signedIn,
    'GET /posts': () => [200, { items: [item], nextCursor: null }],
    'GET /posts/post-1': () => [200, item],
    ...routes,
  });
  await renderRouter('./src/app');
  await pressWhenShown(`${item.type === 'LOST' ? 'Lost' : 'Found'}: ${item.title}`);
  return fetchMock;
}

describe('matches', () => {
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

  it('shows possible matches on my lost post and why they were suggested', async () => {
    fetchMock = await openPost(post(), {
      'GET /posts/post-1/matches': () => [200, [match]],
    });

    expect(await screen.findByRole('header', { name: 'Possible matches' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Found: Black wallet' })).toBeOnTheScreen();
    expect(screen.getByText('Same place · Found the next day · Similar title')).toBeOnTheScreen();
  });

  it('opens a match so I can claim it', async () => {
    fetchMock = await openPost(post(), {
      'GET /posts/post-1/matches': () => [200, [match]],
      'GET /posts/post-2': () => [200, foundWallet],
      'GET /posts/post-2/claim-form': () => [
        200,
        { questions: [], serialRequired: false, attemptsLeft: 3, activeClaim: null },
      ],
    });

    await pressWhenShown('Found: Black wallet');

    expect(await screen.findByRole('button', { name: 'This is mine' })).toBeOnTheScreen();
  });

  it('hides a match I mark "Not mine"', async () => {
    let matches = [match];
    fetchMock = await openPost(post(), {
      'GET /posts/post-1/matches': () => [200, matches],
      'POST /posts/post-1/matches/post-2/dismiss': () => {
        matches = [];
        return [204];
      },
    });

    await pressWhenShown('Not mine');

    expect(await screen.findByText(/Nothing yet\. You get an email/)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/posts/post-1/matches/post-2/dismiss')).toHaveLength(1);
  });

  it("offers to post a found item from someone else's lost post, already filled in", async () => {
    fetchMock = await openPost(post({ isMine: false, author: { firstName: 'Omar' } }), {
      'GET /places': () => [200, [library, { id: 'place-it', name: 'IT building' }]],
    });

    await pressWhenShown('Post what I found');

    await screen.findByText('What happened?');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Library' })).toBeSelected());
    expect(screen.getByRole('button', { name: 'I found something' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Wallet' })).toBeSelected();
    expect(requestsTo(fetchMock, 'GET', '/posts/post-1/matches')).toHaveLength(0);
  });
});
