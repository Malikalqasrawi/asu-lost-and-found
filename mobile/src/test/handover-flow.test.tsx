import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import type { ClaimForm } from '@/api/claims';
import type { DeskItem } from '@/api/desk';
import type { Handover, HandoverSummary, Message } from '@/api/handovers';
import type { Post } from '@/api/posts';
import { clearTokens } from '@/session/tokens';
import { authResponse, mockApi, requestsTo, signedIn, type Reply } from '@/test/mock-api';
import { press, type } from '@/test/screen';

const { resetSecureStore } = SecureStore as unknown as { resetSecureStore: () => void };

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    type: 'FOUND',
    status: 'CLAIMED',
    title: 'Black leather wallet',
    description: '',
    category: 'WALLET',
    place: { id: 'place-library', name: 'Library' },
    placeDetails: '',
    happenedOn: '2026-10-16',
    createdAt: '2026-10-16T10:00:00.000Z',
    author: { firstName: 'Sara' },
    isMine: false,
    canSeeOriginals: true,
    photoIds: [],
    desk: null,
    hidden: false,
    ...overrides,
  };
}

function handover(overrides: Partial<Handover> = {}): Handover {
  return {
    postId: 'post-1',
    title: 'Black leather wallet',
    role: 'OWNER',
    otherPerson: { firstName: 'Sara' },
    pickupCode: '482913',
    codeLocked: false,
    returnedAt: null,
    unread: 0,
    ...overrides,
  };
}

const finderHandover = (overrides: Partial<Handover> = {}) =>
  handover({ role: 'FINDER', otherPerson: { firstName: 'Ahmad' }, pickupCode: null, ...overrides });

const acceptedForm: ClaimForm = {
  questions: [],
  serialRequired: false,
  attemptsLeft: 3,
  activeClaim: {
    id: 'claim-1',
    status: 'ACCEPTED',
    post: { id: 'post-1', title: 'Black leather wallet', type: 'FOUND' },
    message: '',
    answers: [],
    createdAt: '2026-10-17T09:00:00.000Z',
    decidedAt: '2026-10-17T10:00:00.000Z',
  },
};

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    mine: false,
    text: 'I am at the library until 3',
    removed: false,
    createdAt: '2026-10-17T11:00:00.000Z',
    ...overrides,
  };
}

function deskItem(overrides: Partial<DeskItem> = {}): DeskItem {
  return {
    postId: 'post-1',
    status: 'ON_THE_WAY',
    title: 'Black leather wallet',
    category: 'WALLET',
    place: 'Library',
    happenedOn: '2026-10-16',
    photoIds: [],
    finder: { fullName: 'Sara Haddad', email: 'sara@asu.edu.jo' },
    owner: null,
    handedInAt: '2026-10-17T12:00:00.000Z',
    receivedAt: null,
    ...overrides,
  };
}

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
  await pressWhenShown(`Found: ${item.title}`);
  return fetchMock;
}

function confirmAlertWith(buttonText: string) {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.text === buttonText)?.onPress?.();
  });
}

describe('handovers', () => {
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

  describe('the owner', () => {
    it('sees the pickup code and writes to the finder', async () => {
      let sent: unknown;
      const messages = [message()];
      fetchMock = await openPost(post(), {
        'GET /posts/post-1/claim-form': () => [200, acceptedForm],
        'GET /posts/post-1/handover': () => [200, handover({ unread: 1 })],
        'GET /posts/post-1/messages': () => [200, messages],
        'POST /posts/post-1/messages': (body) => {
          sent = body;
          messages.push(message({ id: 'message-2', mine: true, text: body.text }));
          return [201, messages.at(-1)];
        },
      });

      expect(await screen.findByText('482 913')).toBeOnTheScreen();
      expect(
        screen.getByText('Agree with Sara where to meet, then show them this code.'),
      ).toBeOnTheScreen();
      await press('Messages with Sara (1 new)');

      expect(await screen.findByText('I am at the library until 3')).toBeOnTheScreen();
      await type('Message', ' On my way! ');
      await press('Send');

      expect(await screen.findByText('On my way!')).toBeOnTheScreen();
      expect(sent).toEqual({ text: 'On my way!' });
    });

    it('is told to go to the security office when the item is there', async () => {
      fetchMock = await openPost(post({ desk: 'AT_DESK' }), {
        'GET /posts/post-1/claim-form': () => [200, acceptedForm],
        'GET /posts/post-1/handover': () => [200, handover()],
      });

      expect(
        await screen.findByText(/Pick it up at the university security office/),
      ).toBeOnTheScreen();
    });

    it('gets a new code after too many wrong tries', async () => {
      let locked = true;
      fetchMock = await openPost(post(), {
        'GET /posts/post-1/claim-form': () => [200, acceptedForm],
        'GET /posts/post-1/handover': () => [200, handover({ codeLocked: locked })],
        'POST /posts/post-1/handover/new-code': () => {
          locked = false;
          return [200, handover({ pickupCode: '105377' })];
        },
      });

      await pressWhenShown('Get a new code');

      await waitFor(() =>
        expect(requestsTo(fetchMock!, 'POST', '/posts/post-1/handover/new-code')).toHaveLength(1),
      );
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Get a new code' })).toBeNull(),
      );
    });

    it('sees when the item is back', async () => {
      fetchMock = await openPost(post({ status: 'RETURNED' }), {
        'GET /posts/post-1/claim-form': () => [200, acceptedForm],
        'GET /posts/post-1/handover': () => [
          200,
          handover({ pickupCode: null, returnedAt: '2026-10-17T13:00:00.000Z' }),
        ],
      });

      expect(
        await screen.findByText('You have this item back. Glad it found its way home.'),
      ).toBeOnTheScreen();
    });
  });

  describe('the finder', () => {
    const mine = (overrides: Partial<Post> = {}) => post({ isMine: true, ...overrides });

    it("types the owner's pickup code to finish the handover", async () => {
      let sent: unknown;
      fetchMock = await openPost(mine(), {
        'GET /posts/post-1/handover': () => [200, finderHandover()],
        'POST /posts/post-1/handover/return': (body) => {
          sent = body;
          return [204];
        },
      });

      await pressWhenShown('Enter pickup code');
      await screen.findByLabelText('Pickup code');
      await press('Confirm handover');
      expect(screen.getByText('The pickup code has 6 digits.')).toBeOnTheScreen();

      await type('Pickup code', '482 913');
      await press('Confirm handover');

      expect(
        await screen.findByText('Handed over. The item is marked as returned.'),
      ).toBeOnTheScreen();
      expect(sent).toEqual({ code: '482913' });
    });

    it('shows why a code was refused', async () => {
      fetchMock = await openPost(mine(), {
        'GET /posts/post-1/handover': () => [200, finderHandover()],
        'POST /posts/post-1/handover/return': () => [
          400,
          {
            statusCode: 400,
            message: 'That code is not right. 4 tries left.',
            error: 'Bad Request',
          },
        ],
      });
      await pressWhenShown('Enter pickup code');
      await type('Pickup code', '111111');

      await press('Confirm handover');

      expect(await screen.findByText('That code is not right. 4 tries left.')).toBeOnTheScreen();
    });

    it('hands a valuable item to the security office after asking', async () => {
      confirmAlertWith('Hand it in');
      fetchMock = await openPost(mine({ status: 'OPEN' }), {
        'POST /posts/post-1/desk': () => [204],
      });

      expect(
        await screen.findByText(
          'For valuables, we suggest leaving it at the university security office.',
        ),
      ).toBeOnTheScreen();
      await press('Hand to security office');

      await waitFor(() =>
        expect(requestsTo(fetchMock!, 'POST', '/posts/post-1/desk')).toHaveLength(1),
      );
    });

    it('can keep the item after all while it is on the way', async () => {
      fetchMock = await openPost(mine({ status: 'OPEN', desk: 'ON_THE_WAY' }), {
        'DELETE /posts/post-1/desk': () => [204],
      });

      await pressWhenShown("I'll keep it myself");

      await waitFor(() =>
        expect(requestsTo(fetchMock!, 'DELETE', '/posts/post-1/desk')).toHaveLength(1),
      );
      expect(screen.queryByRole('button', { name: 'Close post' })).toBeNull();
    });

    it('leaves the pickup to the security office once it has the item', async () => {
      fetchMock = await openPost(mine({ desk: 'AT_DESK' }), {
        'GET /posts/post-1/handover': () => [200, finderHandover()],
      });

      expect(
        await screen.findByText(/The university security office has this item/),
      ).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Enter pickup code' })).toBeNull();
    });
  });

  it('lists the chats with their unread messages', async () => {
    const summaries: HandoverSummary[] = [
      {
        postId: 'post-1',
        title: 'Black leather wallet',
        role: 'OWNER',
        otherPerson: { firstName: 'Sara' },
        lastMessage: message(),
        unread: 2,
        returnedAt: null,
      },
    ];
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [], nextCursor: null }],
      'GET /handovers/mine': () => [200, summaries],
    });
    await renderRouter('./src/app');
    await screen.findByText('Hi, Ahmad');

    await fireEvent.press(screen.getByText('Messages'));

    expect(
      await screen.findByRole('button', { name: 'Black leather wallet, with Sara, 2 new' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('I am at the library until 3')).toBeOnTheScreen();
  });

  describe('the security desk', () => {
    const asSecurity = {
      'GET /users/me': (): Reply => [200, { ...authResponse.user, role: 'SECURITY' }],
    };

    it('is not shown to students', async () => {
      fetchMock = mockApi({
        ...signedIn,
        'GET /posts': () => [200, { items: [], nextCursor: null }],
      });
      await renderRouter('./src/app');
      await screen.findByText('Hi, Ahmad');

      expect(screen.queryByText('Desk')).toBeNull();
    });

    it('receives the items students bring in', async () => {
      confirmAlertWith('Received');
      fetchMock = mockApi({
        ...signedIn,
        ...asSecurity,
        'GET /posts': () => [200, { items: [], nextCursor: null }],
        'GET /desk/items': () => [200, [deskItem()]],
        'POST /desk/items/post-1/receive': () => [200, deskItem({ status: 'AT_DESK' })],
      });
      await renderRouter('./src/app');
      await screen.findByText('Hi, Ahmad');
      await fireEvent.press(screen.getByText('Desk'));

      expect(await screen.findByText('Found by Sara Haddad (sara@asu.edu.jo)')).toBeOnTheScreen();
      await press('Received');

      await waitFor(() =>
        expect(requestsTo(fetchMock!, 'POST', '/desk/items/post-1/receive')).toHaveLength(1),
      );
    });

    it('shows whose student ID to check before handing an item over', async () => {
      fetchMock = mockApi({
        ...signedIn,
        ...asSecurity,
        'GET /posts': () => [200, { items: [], nextCursor: null }],
        'GET /desk/items': () => [
          200,
          [deskItem({ status: 'AT_DESK', owner: { fullName: 'Ahmad Saleh' } })],
        ],
      });
      await renderRouter('./src/app');
      await screen.findByText('Hi, Ahmad');
      await fireEvent.press(screen.getByText('Desk'));
      await pressWhenShown('At the desk');

      expect(
        await screen.findByText('Goes to Ahmad Saleh. Check their student ID.'),
      ).toBeOnTheScreen();
      await press('Hand over');

      expect(
        await screen.findByText(/Check the student ID first: it should say Ahmad Saleh/),
      ).toBeOnTheScreen();
    });
  });
});
