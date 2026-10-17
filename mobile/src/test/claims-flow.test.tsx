import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import type { ClaimForm, FinderClaim, FinderClaims, MyClaim } from '@/api/claims';
import type { Post } from '@/api/posts';
import { clearTokens } from '@/session/tokens';
import { mockApi, requestsTo, signedIn } from '@/test/mock-api';
import { press, type } from '@/test/screen';

const { resetSecureStore } = SecureStore as unknown as { resetSecureStore: () => void };

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    type: 'FOUND',
    status: 'OPEN',
    title: 'Black leather wallet',
    description: '',
    category: 'WALLET',
    place: { id: 'place-library', name: 'Library' },
    placeDetails: '',
    happenedOn: '2026-10-16',
    createdAt: '2026-10-16T10:00:00.000Z',
    author: { firstName: 'Sara' },
    isMine: false,
    canSeeOriginals: false,
    photoIds: [],
    ...overrides,
  };
}

function myClaim(overrides: Partial<MyClaim> = {}): MyClaim {
  return {
    id: 'claim-1',
    status: 'PENDING',
    post: { id: 'post-1', title: 'Black leather wallet', type: 'FOUND' },
    message: '',
    answers: [{ question: 'What is inside it?', answer: 'My student ID' }],
    createdAt: '2026-10-17T09:00:00.000Z',
    decidedAt: null,
    ...overrides,
  };
}

function claimForm(overrides: Partial<ClaimForm> = {}): ClaimForm {
  return {
    questions: [
      { id: 'question-1', text: 'What is inside it?' },
      { id: 'question-2', text: 'What colour is the zip?' },
    ],
    serialRequired: false,
    attemptsLeft: 3,
    activeClaim: null,
    ...overrides,
  };
}

function finderClaim(overrides: Partial<FinderClaim> = {}): FinderClaim {
  return {
    id: 'claim-1',
    status: 'PENDING',
    claimant: { firstName: 'Ahmad' },
    message: 'I lost it on Monday',
    answers: [{ question: 'What is inside it?', answer: 'My student ID' }],
    serialMatches: null,
    createdAt: '2026-10-17T09:00:00.000Z',
    decidedAt: null,
    ...overrides,
  };
}

function finderClaims(overrides: Partial<FinderClaims> = {}): FinderClaims {
  return {
    privateNotes: 'Student ID of Ahmad, two receipts',
    questions: ['What is inside it?'],
    hasSerial: false,
    claims: [finderClaim()],
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

describe('claims', () => {
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

  it('claims a found item by answering the questions', async () => {
    let sent: unknown;
    let form = claimForm();
    fetchMock = await openPost(post(), {
      'GET /posts/post-1/claim-form': () => [200, form],
      'POST /posts/post-1/claims': (body?: unknown) => {
        sent = body;
        form = claimForm({ activeClaim: myClaim() });
        return [201, myClaim()];
      },
    });

    await pressWhenShown('This is mine');
    await screen.findByLabelText('What is inside it?');
    await press('Send claim');
    expect(screen.getAllByText('Answer this question.')).toHaveLength(2);
    expect(requestsTo(fetchMock, 'POST', '/posts/post-1/claims')).toHaveLength(0);

    await type('What is inside it?', ' My student ID ');
    await type('What colour is the zip?', 'Red');
    await type('Message to the finder (optional)', 'I lost it on Monday');
    await press('Send claim');

    expect(
      await screen.findByText(
        'Your claim is waiting for the finder. You get an email when they decide.',
      ),
    ).toBeOnTheScreen();
    expect(sent).toEqual({
      answers: [
        { questionId: 'question-1', answer: 'My student ID' },
        { questionId: 'question-2', answer: 'Red' },
      ],
      message: 'I lost it on Monday',
    });
  });

  it('asks for the serial number when the finder saved one', async () => {
    let sent: unknown;
    fetchMock = await openPost(post({ category: 'PHONE', title: 'Blue phone' }), {
      'GET /posts/post-1/claim-form': () => [
        200,
        claimForm({
          questions: [{ id: 'question-1', text: 'What is the wallpaper?' }],
          serialRequired: true,
        }),
      ],
      'POST /posts/post-1/claims': (body?: unknown) => {
        sent = body;
        return [201, myClaim()];
      },
    });
    await pressWhenShown('This is mine');
    await type('What is the wallpaper?', 'A cat');

    await type('Serial number or IMEI', 'ab!');
    await press('Send claim');
    expect(screen.getByText(/Enter the serial number or IMEI/)).toBeOnTheScreen();

    await type('Serial number or IMEI', ' 3567-8901 ');
    await press('Send claim');

    await waitFor(() => expect(sent).toMatchObject({ serialNumber: '3567-8901' }));
  });

  it('keeps the answers when the server refuses the claim', async () => {
    fetchMock = await openPost(post(), {
      'GET /posts/post-1/claim-form': () => [
        200,
        claimForm({ questions: [{ id: 'question-1', text: 'What is inside it?' }] }),
      ],
      'POST /posts/post-1/claims': () => [
        409,
        { statusCode: 409, message: 'This item is no longer open for claims.', error: 'Conflict' },
      ],
    });
    await pressWhenShown('This is mine');
    await type('What is inside it?', 'My student ID');

    await press('Send claim');

    expect(await screen.findByText('This item is no longer open for claims.')).toBeOnTheScreen();
    expect(screen.getByLabelText('What is inside it?')).toHaveDisplayValue('My student ID');
  });

  it('withdraws a waiting claim after asking', async () => {
    confirmAlertWith('Withdraw');
    fetchMock = await openPost(post(), {
      'GET /posts/post-1/claim-form': () => [200, claimForm({ activeClaim: myClaim() })],
      'POST /claims/claim-1/withdraw': () => [200, myClaim({ status: 'WITHDRAWN' })],
    });

    await pressWhenShown('Withdraw my claim');

    await waitFor(() =>
      expect(requestsTo(fetchMock!, 'POST', '/claims/claim-1/withdraw')).toHaveLength(1),
    );
  });

  it('shows how many claims are left', async () => {
    fetchMock = await openPost(post(), {
      'GET /posts/post-1/claim-form': () => [200, claimForm({ attemptsLeft: 1 })],
    });

    expect(await screen.findByText('1 of 3 claims left for this item.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'This is mine' })).toBeOnTheScreen();
  });

  it('stops the student after three rejected claims', async () => {
    fetchMock = await openPost(post(), {
      'GET /posts/post-1/claim-form': () => [200, claimForm({ attemptsLeft: 0 })],
    });

    expect(await screen.findByText('You have used all 3 claims for this item.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'This is mine' })).toBeNull();
  });

  it('shows the originals to the student whose claim was accepted', async () => {
    fetchMock = await openPost(
      post({ status: 'CLAIMED', canSeeOriginals: true, photoIds: ['photo-1'] }),
      {
        'GET /posts/post-1/claim-form': () => [
          200,
          claimForm({ activeClaim: myClaim({ status: 'ACCEPTED' }) }),
        ],
      },
    );

    expect(await screen.findByText(/The finder accepted your claim/)).toBeOnTheScreen();
    expect(
      screen.getByText('You can see the original photos because the finder accepted your claim.'),
    ).toBeOnTheScreen();
  });

  it('tells other students when the item went to someone else', async () => {
    fetchMock = await openPost(post({ status: 'CLAIMED' }), {
      'GET /posts/post-1/claim-form': () => [200, claimForm()],
    });

    expect(
      await screen.findByText('The finder already gave this item to its owner.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'This is mine' })).toBeNull();
  });

  it('lets the finder compare the answers with the notes and accept a claim', async () => {
    confirmAlertWith('Accept');
    fetchMock = await openPost(post({ isMine: true, canSeeOriginals: true }), {
      'GET /posts/post-1/claims': () => [
        200,
        finderClaims({ hasSerial: true, claims: [finderClaim({ serialMatches: true })] }),
      ],
      'POST /claims/claim-1/accept': () => [200, finderClaim({ status: 'ACCEPTED' })],
    });

    await pressWhenShown('See claims');

    expect(await screen.findByText('Student ID of Ahmad, two receipts')).toBeOnTheScreen();
    expect(screen.getByText('My student ID')).toBeOnTheScreen();
    expect(screen.getByText('I lost it on Monday')).toBeOnTheScreen();
    expect(screen.getByText('The serial number matches.')).toBeOnTheScreen();
    await press('Accept');
    await waitFor(() =>
      expect(requestsTo(fetchMock!, 'POST', '/claims/claim-1/accept')).toHaveLength(1),
    );
  });

  it('lets the finder reject a claim and shows decided claims without buttons', async () => {
    confirmAlertWith('Reject');
    fetchMock = await openPost(post({ isMine: true }), {
      'GET /posts/post-1/claims': () => [
        200,
        finderClaims({
          claims: [
            finderClaim(),
            finderClaim({ id: 'claim-2', status: 'REJECTED', claimant: { firstName: 'Omar' } }),
          ],
        }),
      ],
      'POST /claims/claim-1/reject': () => [200, finderClaim({ status: 'REJECTED' })],
    });
    await pressWhenShown('See claims');
    await screen.findByText('Omar');

    expect(screen.getAllByRole('button', { name: 'Reject' })).toHaveLength(1);
    await press('Reject');
    await waitFor(() =>
      expect(requestsTo(fetchMock!, 'POST', '/claims/claim-1/reject')).toHaveLength(1),
    );
  });

  it('tells the finder when nobody has claimed the item yet', async () => {
    fetchMock = await openPost(post({ isMine: true }), {
      'GET /posts/post-1/claims': () => [200, finderClaims({ privateNotes: '', claims: [] })],
    });

    await pressWhenShown('See claims');

    expect(
      await screen.findByText('No claims yet. You get an email when someone claims this item.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('You did not add private notes.')).toBeOnTheScreen();
  });

  it('lists my claims with their status', async () => {
    fetchMock = mockApi({
      ...signedIn,
      'GET /posts': () => [200, { items: [], nextCursor: null }],
      'GET /claims/mine': () => [
        200,
        [
          myClaim(),
          myClaim({
            id: 'claim-2',
            status: 'REJECTED',
            post: { id: 'post-2', title: 'Blue phone', type: 'FOUND' },
          }),
        ],
      ],
    });
    await renderRouter('./src/app');
    await screen.findByText('Hi, Ahmad');

    await fireEvent.press(screen.getByText('My claims'));

    expect(
      await screen.findByRole('button', {
        name: 'Claim for Black leather wallet: Waiting for the finder',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Claim for Blue phone: Not accepted' }),
    ).toBeOnTheScreen();
  });
});
