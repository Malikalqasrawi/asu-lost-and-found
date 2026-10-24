import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { queryClient } from '@/api/query-client';
import { clearTokens } from '@/session/tokens';
import { authResponse, emptyBrowse, mockApi, requestsTo } from '@/test/mock-api';
import { press, type } from '@/test/screen';

const { resetSecureStore } = SecureStore as unknown as { resetSecureStore: () => void };

describe('signing in and out', () => {
  let fetchMock: jest.SpyInstance | undefined;

  beforeEach(async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:4000/api';
    resetSecureStore();
    await clearTokens();
  });

  afterEach(() => {
    fetchMock?.mockRestore();
  });

  it('opens on the sign-in screen when nobody is signed in', async () => {
    fetchMock = mockApi({});

    await renderRouter('./src/app');

    expect(await screen.findByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('signs in and shows the Browse screen', async () => {
    fetchMock = mockApi({ 'POST /auth/login': () => [200, authResponse], ...emptyBrowse });
    await renderRouter('./src/app');
    await screen.findByRole('header', { name: 'Sign in' });

    await type('University email', ' ahmad@asu.edu.jo ');
    await type('Password', 'correct-horse-42');
    await press('Sign in');

    expect(await screen.findByText('Hi, Ahmad')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/auth/login')[0][1].body).toBe(
      JSON.stringify({ email: 'ahmad@asu.edu.jo', password: 'correct-horse-42' }),
    );
    expect(await SecureStore.getItemAsync('refreshToken')).toBe('refresh-1');
  });

  it('shows the message from the server when sign-in fails', async () => {
    fetchMock = mockApi({
      'POST /auth/login': () => [401, { message: 'Email or password is incorrect' }],
    });
    await renderRouter('./src/app');
    await screen.findByRole('header', { name: 'Sign in' });

    await type('University email', 'ahmad@asu.edu.jo');
    await type('Password', 'wrong-password');
    await press('Sign in');

    expect(await screen.findByText('Email or password is incorrect')).toBeOnTheScreen();
  });

  it('asks security office accounts for the emailed code after the password', async () => {
    const security = { ...authResponse, user: { ...authResponse.user, role: 'SECURITY' } };
    fetchMock = mockApi({
      'POST /auth/login': (body) =>
        body.code === '482913'
          ? [200, security]
          : [403, { message: 'We emailed you a 6-digit code.', code: 'SIGN_IN_CODE_REQUIRED' }],
      'GET /desk/items': () => [200, []],
      ...emptyBrowse,
    });
    await renderRouter('./src/app');
    await screen.findByRole('header', { name: 'Sign in' });

    await type('University email', 'desk@asu.edu.jo');
    await type('Password', 'correct-horse-42');
    await press('Sign in');

    expect(await screen.findByRole('header', { name: 'Enter your code' })).toBeOnTheScreen();
    await type('Code', '482913');
    await press('Sign in');

    expect(await screen.findByText('Hi, Ahmad')).toBeOnTheScreen();
    const sent = requestsTo(fetchMock, 'POST', '/auth/login').map(([, init]) =>
      JSON.parse(init.body),
    );
    expect(sent).toEqual([
      { email: 'desk@asu.edu.jo', password: 'correct-horse-42' },
      { email: 'desk@asu.edu.jo', password: 'correct-horse-42', code: '482913' },
    ]);
  });

  it('sends an unverified student to the code screen and verifies them', async () => {
    fetchMock = mockApi({
      'POST /auth/login': () => [
        403,
        { message: 'Verify your email first.', code: 'EMAIL_NOT_VERIFIED' },
      ],
      'POST /auth/resend-code': () => [202, { message: 'sent' }],
      'POST /auth/verify-email': () => [200, authResponse],
      ...emptyBrowse,
    });
    await renderRouter('./src/app');
    await screen.findByRole('header', { name: 'Sign in' });

    await type('University email', 'ahmad@asu.edu.jo');
    await type('Password', 'correct-horse-42');
    await press('Sign in');
    await screen.findByRole('header', { name: 'Check your email' });
    await type('Code', '12a3456');
    await press('Verify email');

    expect(await screen.findByText('Hi, Ahmad')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/auth/resend-code')).toHaveLength(1);
    expect(JSON.parse(requestsTo(fetchMock, 'POST', '/auth/verify-email')[0][1].body)).toEqual({
      email: 'ahmad@asu.edu.jo',
      password: 'correct-horse-42',
      code: '123456',
    });
  });

  it('creates an account and asks for the emailed code', async () => {
    fetchMock = mockApi({
      'POST /auth/register': () => [202, { message: 'sent' }],
      'POST /auth/verify-email': () => [200, authResponse],
      ...emptyBrowse,
    });
    await renderRouter('./src/app');
    await press('New here? Create an account');
    await screen.findByRole('header', { name: 'Create an account' });

    await type('Full name', 'Ahmad Saleh');
    await type('University email', 'ahmad@asu.edu.jo');
    await type('Password', 'correct-horse-42');
    await press('Create account');
    await screen.findByText('We sent a 6-digit code to ahmad@asu.edu.jo.');
    await type('Code', '123456');
    await press('Verify email');

    expect(await screen.findByText('Hi, Ahmad')).toBeOnTheScreen();
  });

  it('checks the form before sending it', async () => {
    fetchMock = mockApi({});
    await renderRouter('./src/app');
    await press('New here? Create an account');
    await screen.findByRole('header', { name: 'Create an account' });

    await type('Password', 'short');
    await press('Create account');

    expect(screen.getByText('Enter your full name.')).toBeOnTheScreen();
    expect(screen.getByText('Enter your university email.')).toBeOnTheScreen();
    expect(screen.getByText('Use at least 8 characters.')).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the university email rule under the email field', async () => {
    fetchMock = mockApi({
      'POST /auth/register': () => [
        400,
        {
          message:
            'Use your student email (your 9-digit student number@students.asu.edu.jo) or a staff email (@asu.edu.jo)',
          code: 'EMAIL_DOMAIN_NOT_ALLOWED',
        },
      ],
    });
    await renderRouter('./src/app');
    await press('New here? Create an account');
    await screen.findByRole('header', { name: 'Create an account' });

    await type('Full name', 'Ahmad Saleh');
    await type('University email', 'ahmad@gmail.com');
    await type('Password', 'correct-horse-42');
    await press('Create account');

    expect(await screen.findByText(/Use your student email/)).toBeOnTheScreen();
  });

  it('resets a forgotten password', async () => {
    fetchMock = mockApi({
      'POST /auth/forgot-password': () => [202, { message: 'sent' }],
      'POST /auth/reset-password': () => [204],
    });
    await renderRouter('./src/app');
    await press('Forgot your password?');
    await screen.findByRole('header', { name: 'Reset your password' });

    await type('University email', 'ahmad@asu.edu.jo');
    await press('Send code');
    await screen.findByRole('header', { name: 'Choose a new password' });
    await type('Code', '654321');
    await type('New password', 'a-brand-new-password');
    await press('Change password');

    expect(
      await screen.findByText('Your password was changed. Sign in with the new one.'),
    ).toBeOnTheScreen();
    expect(JSON.parse(requestsTo(fetchMock, 'POST', '/auth/reset-password')[0][1].body)).toEqual({
      email: 'ahmad@asu.edu.jo',
      code: '654321',
      newPassword: 'a-brand-new-password',
    });
  });

  it('keeps the student signed in after the app restarts', async () => {
    await SecureStore.setItemAsync('refreshToken', 'stored-refresh');
    fetchMock = mockApi({
      'POST /auth/refresh': (body) =>
        body.refreshToken === 'stored-refresh'
          ? [200, { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 }]
          : [401],
      'GET /users/me': () => [200, authResponse.user],
      ...emptyBrowse,
    });

    await renderRouter('./src/app');

    expect(await screen.findByText('Hi, Ahmad')).toBeOnTheScreen();
  });

  it('shows sign-in when the stored session has ended', async () => {
    await SecureStore.setItemAsync('refreshToken', 'revoked-refresh');
    fetchMock = mockApi({ 'POST /auth/refresh': () => [401, { message: 'ended' }] });

    await renderRouter('./src/app');

    expect(await screen.findByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
    expect(await SecureStore.getItemAsync('refreshToken')).toBeNull();
  });

  it("forgets the student's data when the session ends while the app is open", async () => {
    await SecureStore.setItemAsync('refreshToken', 'stored-refresh');
    let ended = false;
    fetchMock = mockApi({
      'POST /auth/refresh': () =>
        ended
          ? [401]
          : [200, { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 }],
      'GET /users/me': () => [200, authResponse.user],
      'GET /posts': () => (ended ? [401] : [200, { items: [], nextCursor: null }]),
    });
    await renderRouter('./src/app');
    await screen.findByText('Hi, Ahmad');

    ended = true;
    await act(() => queryClient.refetchQueries({ queryKey: ['posts'] }));

    expect(await screen.findByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
    const cachedPosts = queryClient.getQueryCache().findAll({ queryKey: ['posts'] });
    expect(cachedPosts.every((query) => query.state.data === undefined)).toBe(true);
  });

  it('signs out, tells the server and forgets the token', async () => {
    fetchMock = mockApi({
      'POST /auth/login': () => [200, authResponse],
      'POST /auth/logout': () => [204],
      ...emptyBrowse,
    });
    await renderRouter('./src/app');
    await screen.findByRole('header', { name: 'Sign in' });
    await type('University email', 'ahmad@asu.edu.jo');
    await type('Password', 'correct-horse-42');
    await press('Sign in');
    await screen.findByText('Hi, Ahmad');
    await fireEvent.press(screen.getByText('Account'));

    await press('Sign out');

    expect(await screen.findByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
    expect(JSON.parse(requestsTo(fetchMock, 'POST', '/auth/logout')[0][1].body)).toEqual({
      refreshToken: 'refresh-1',
    });
    await waitFor(async () => expect(await SecureStore.getItemAsync('refreshToken')).toBeNull());
  });
});
