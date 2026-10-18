import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { admin, calls, mockApi, renderApp, signedIn, signedOut } from '@/test/render';

describe('signing in', () => {
  it('asks for the password, then the emailed code', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      ...signedOut,
      'POST /admin/auth/login': () => [
        200,
        { challenge: 'challenge-1', message: 'We emailed you a 6-digit code.' },
      ],
      'POST /admin/auth/verify': (body) =>
        body.challenge === 'challenge-1' && body.code === '123456'
          ? [200, { accessToken: 'access-1', expiresIn: 900, user: admin }]
          : [400, { message: 'The code is wrong or has expired' }],
      'GET /admin/reports': () => [200, []],
    });
    renderApp();

    await user.type(await screen.findByLabelText('University email'), admin.email);
    await user.type(screen.getByLabelText('Password'), 'correct-horse-42');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText(`We emailed a 6-digit code to ${admin.email}.`),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Code'), '123 456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByText('Rana Khalil')).toBeInTheDocument();
    const [, verifyInit] = calls(fetchMock, 'POST', '/admin/auth/verify')[0];
    expect(verifyInit?.credentials).toBe('include');
  });

  it('shows why the password step failed', async () => {
    const user = userEvent.setup();
    mockApi({
      ...signedOut,
      'POST /admin/auth/login': () => [401, { message: 'Email or password is incorrect' }],
    });
    renderApp();

    await user.type(await screen.findByLabelText('University email'), admin.email);
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('stays signed in with the cookie from an earlier visit, and never sends it elsewhere', async () => {
    const fetchMock = mockApi({ ...signedIn, 'GET /admin/reports': () => [200, []] });
    renderApp();

    expect(await screen.findByText('Nothing here.')).toBeInTheDocument();
    const [, refreshInit] = calls(fetchMock, 'POST', '/admin/auth/refresh')[0];
    expect(refreshInit?.headers).toMatchObject({ 'X-Lost-Found-Admin': '1' });
    const [, reportsInit] = calls(fetchMock, 'GET', '/admin/reports')[0];
    expect(reportsInit?.credentials).toBe('omit');
    expect(reportsInit?.headers).toMatchObject({ Authorization: 'Bearer access-1' });
  });

  it('goes back to sign-in when the session can no longer be refreshed', async () => {
    let refreshes = 0;
    mockApi({
      'POST /admin/auth/refresh': () =>
        refreshes++ === 0
          ? [200, { accessToken: 'access-1', expiresIn: 900 }]
          : [401, { message: 'ended' }],
      'GET /users/me': () => [200, admin],
      'GET /admin/reports': () => [401, { message: 'Unauthorized' }],
    });
    renderApp();

    expect(await screen.findByLabelText('University email')).toBeInTheDocument();
    await waitFor(() => expect(refreshes).toBe(2));
  });

  it('signs out', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      ...signedIn,
      'GET /admin/reports': () => [200, []],
      'POST /admin/auth/logout': () => [204],
    });
    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByLabelText('University email')).toBeInTheDocument();
    expect(calls(fetchMock, 'POST', '/admin/auth/logout')).toHaveLength(1);
  });
});
