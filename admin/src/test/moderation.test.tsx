import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ReportCase, Student } from '@/api/admin';
import { calls, mockApi, renderApp, signedIn } from '@/test/render';

const author = { id: 'user-2', fullName: 'Omar Haddad', email: 'omar@asu.edu.jo' };

const postCase: ReportCase = {
  target: {
    kind: 'POST',
    id: 'post-1',
    title: 'Free iPhone, DM me',
    description: 'Send me your number',
    photoIds: [],
    type: 'FOUND',
    status: 'OPEN',
    hidden: false,
    hiddenBy: null,
    author,
  },
  status: 'OPEN',
  reports: [
    {
      id: 'r1',
      reason: 'SPAM',
      details: 'Posted ten times',
      reporter: 'Sara Ali',
      createdAt: '2026-10-18T09:00:00Z',
    },
    {
      id: 'r2',
      reason: 'FAKE',
      details: '',
      reporter: 'Lina Odeh',
      createdAt: '2026-10-18T10:00:00Z',
    },
  ],
};

const messageCase: ReportCase = {
  target: {
    kind: 'MESSAGE',
    id: 'message-1',
    text: 'Pay me 50 JOD or no wallet',
    removed: false,
    sentAt: '2026-10-18T08:00:00Z',
    postTitle: 'Black wallet',
    sender: author,
  },
  status: 'OPEN',
  reports: [
    {
      id: 'r3',
      reason: 'OFFENSIVE',
      details: '',
      reporter: 'Sara Ali',
      createdAt: '2026-10-18T11:00:00Z',
    },
  ],
};

const student: Student = {
  id: 'user-2',
  email: 'omar@asu.edu.jo',
  fullName: 'Omar Haddad',
  role: 'STUDENT',
  createdAt: '2026-10-01T10:00:00Z',
  ban: null,
};

describe('moderating', () => {
  it('shows each reported post with its reports, and hides it after asking', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let cases = [postCase];
    const fetchMock = mockApi({
      ...signedIn,
      'GET /admin/reports': () => [200, cases],
      'POST /admin/posts/post-1/hide': () => {
        cases = [];
        return [204];
      },
    });
    renderApp();

    const card = await screen.findByRole('article', { name: 'Free iPhone, DM me' });
    expect(within(card).getByText('Posted by Omar Haddad (omar@asu.edu.jo)')).toBeInTheDocument();
    expect(within(card).getByText('Spam')).toBeInTheDocument();
    expect(within(card).getByText('Fake or misleading')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Hide post' }));

    expect(await screen.findByText('Nothing here.')).toBeInTheDocument();
    expect(calls(fetchMock, 'POST', '/admin/posts/post-1/hide')).toHaveLength(1);
  });

  it('does nothing when the admin cancels', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fetchMock = mockApi({ ...signedIn, 'GET /admin/reports': () => [200, [postCase]] });
    renderApp();

    const card = await screen.findByRole('article', { name: 'Free iPhone, DM me' });
    await user.click(within(card).getByRole('button', { name: 'Dismiss reports' }));

    expect(calls(fetchMock, 'POST', '/admin/posts/post-1/reports/dismiss')).toHaveLength(0);
  });

  it('shows a reported message and removes it', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = mockApi({
      ...signedIn,
      'GET /admin/reports': () => [200, [messageCase]],
      'POST /admin/messages/message-1/remove': () => [204],
    });
    renderApp();

    const card = await screen.findByRole('article', { name: 'Message from Omar Haddad' });
    expect(within(card).getByText('Pay me 50 JOD or no wallet')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Remove message' }));

    await waitFor(() =>
      expect(calls(fetchMock, 'POST', '/admin/messages/message-1/remove')).toHaveLength(1),
    );
  });

  it('bans the author of a reported post with a reason', async () => {
    const user = userEvent.setup();
    let sent: unknown;
    mockApi({
      ...signedIn,
      'GET /admin/reports': () => [200, [postCase]],
      'POST /admin/users/user-2/ban': (body) => {
        sent = body;
        return [
          200,
          { ...student, ban: { since: '2026-10-18T12:00:00Z', until: null, reason: body.reason } },
        ];
      },
    });
    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Ban Omar Haddad' }));
    const form = screen.getByRole('form', { name: 'Ban Omar Haddad' });
    await user.click(within(form).getByRole('button', { name: 'Ban' }));
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Give a reason the student can understand.',
    );

    await user.type(within(form).getByLabelText('Reason'), 'Posting fake items');
    await user.selectOptions(within(form).getByLabelText('How long'), 'For good');
    await user.click(within(form).getByRole('button', { name: 'Ban' }));

    await waitFor(() => expect(sent).toEqual({ reason: 'Posting fake items' }));
    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'Ban Omar Haddad' })).not.toBeInTheDocument(),
    );
  });

  it('finds students and unbans one', async () => {
    const user = userEvent.setup();
    const banned = {
      ...student,
      ban: { since: '2026-10-10T10:00:00Z', until: '2026-10-25T10:00:00Z', reason: 'Spam' },
    };
    const fetchMock = mockApi({
      ...signedIn,
      'GET /admin/reports': () => [200, []],
      'GET /admin/users': () => [200, [banned]],
      'POST /admin/users/user-2/unban': () => [200, student],
    });
    renderApp();

    await user.click(await screen.findByRole('link', { name: 'Students' }));
    await user.type(screen.getByLabelText('Name or email'), 'omar');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText(/Banned until .*: Spam/)).toBeInTheDocument();
    const searched = calls(fetchMock, 'GET', '/admin/users').at(-1);
    expect(String(searched?.[0])).toContain('q=omar');
    await user.click(screen.getByRole('button', { name: 'Unban' }));
    await waitFor(() =>
      expect(calls(fetchMock, 'POST', '/admin/users/user-2/unban')).toHaveLength(1),
    );
  });

  it('lists the claim history', async () => {
    const user = userEvent.setup();
    mockApi({
      ...signedIn,
      'GET /admin/reports': () => [200, []],
      'GET /admin/claimants': () => [
        200,
        [
          {
            userId: 'user-2',
            fullName: 'Omar Haddad',
            email: 'omar@asu.edu.jo',
            claims: 6,
            accepted: 0,
            rejected: 5,
          },
        ],
      ],
    });
    renderApp();

    await user.click(await screen.findByRole('link', { name: 'Claim history' }));

    const row = (await screen.findByText('omar@asu.edu.jo')).closest('tr')!;
    expect(within(row).getByText('5')).toBeInTheDocument();
  });

  it('shows who made each decision', async () => {
    const user = userEvent.setup();
    mockApi({
      ...signedIn,
      'GET /admin/reports': () => [200, []],
      'GET /admin/log': () => [
        200,
        [
          {
            id: 'log-1',
            action: 'BAN',
            admin: 'Rana Khalil',
            about: 'Omar Haddad (omar@asu.edu.jo)',
            note: 'Posting fake items',
            createdAt: '2026-10-18T12:00:00Z',
          },
        ],
      ],
    });
    renderApp();

    await user.click(await screen.findByRole('link', { name: 'Activity' }));

    const row = (await screen.findByText('Posting fake items')).closest('tr')!;
    expect(within(row).getByText('Banned')).toBeInTheDocument();
    expect(within(row).getByText('Rana Khalil')).toBeInTheDocument();
  });
});
