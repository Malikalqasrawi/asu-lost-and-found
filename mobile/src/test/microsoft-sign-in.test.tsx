import * as SecureStore from 'expo-secure-store';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { isMicrosoftRedirect } from '@/session/microsoft';
import { clearTokens } from '@/session/tokens';
import { authResponse, emptyBrowse, mockApi, type Reply, requestsTo } from '@/test/mock-api';
import { press } from '@/test/screen';

const mockPrompt = jest.fn();
const mockExchange = jest.fn();
const mockAuthRequest = jest.fn();

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: () => 'asulostfound://auth',
  AuthRequest: jest.fn().mockImplementation((config: unknown) => {
    mockAuthRequest(config);
    return { codeVerifier: 'verifier-from-pkce', promptAsync: mockPrompt };
  }),
  exchangeCodeAsync: (...args: unknown[]) => mockExchange(...args),
}));

const NONCE = 'one-time-value-from-the-server';
const startRoute = { 'POST /auth/microsoft/start': (): Reply => [200, { nonce: NONCE }] };

const { resetSecureStore } = SecureStore as unknown as { resetSecureStore: () => void };

async function openSignIn(routes: Parameters<typeof mockApi>[0] = {}) {
  const fetchMock = mockApi({ ...startRoute, ...routes });
  await renderRouter('./src/app');
  await screen.findByRole('header', { name: 'Sign in' });
  return fetchMock;
}

describe('Microsoft sign-in', () => {
  let fetchMock: jest.SpyInstance | undefined;

  beforeEach(async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:4000/api';
    process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID = '0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
    process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID = 'f1e2d3c4-b5a6-4978-8695-a4b3c2d1e0f9';
    resetSecureStore();
    await clearTokens();
    mockPrompt.mockReset();
    mockExchange.mockReset();
    mockAuthRequest.mockReset();
  });

  afterEach(() => {
    fetchMock?.mockRestore();
    delete process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID;
  });

  it('hides the button in builds made without the Microsoft IDs', async () => {
    delete process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID;
    fetchMock = await openSignIn();

    expect(screen.queryByRole('button', { name: 'Continue with Microsoft' })).toBeNull();
  });

  it('signs in with the ID token Microsoft gives back', async () => {
    mockPrompt.mockResolvedValue({ type: 'success', params: { code: 'code-from-microsoft' } });
    mockExchange.mockResolvedValue({ idToken: 'id.token.from-microsoft' });
    fetchMock = await openSignIn({
      'POST /auth/microsoft': () => [200, authResponse],
      ...emptyBrowse,
    });

    await press('Continue with Microsoft');

    expect(await screen.findByText('Hi, Ahmad')).toBeOnTheScreen();
    expect(mockExchange.mock.calls[0][0]).toMatchObject({
      code: 'code-from-microsoft',
      redirectUri: 'asulostfound://auth',
      extraParams: { code_verifier: 'verifier-from-pkce' },
    });
    const sent = JSON.parse(requestsTo(fetchMock, 'POST', '/auth/microsoft')[0][1].body);
    expect(sent).toEqual({ idToken: 'id.token.from-microsoft' });
    expect(mockAuthRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        usePKCE: true,
        extraParams: expect.objectContaining({ nonce: NONCE }),
      }),
    );
    expect(await SecureStore.getItemAsync('refreshToken')).toBe('refresh-1');
  });

  it('stays on the sign-in screen when the student closes the Microsoft page', async () => {
    mockPrompt.mockResolvedValue({ type: 'dismiss' });
    fetchMock = await openSignIn();

    await press('Continue with Microsoft');

    await waitFor(() => expect(mockPrompt).toHaveBeenCalled());
    expect(screen.getByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/auth/microsoft')).toHaveLength(0);
  });

  it('shows why the server refused the account', async () => {
    mockPrompt.mockResolvedValue({ type: 'success', params: { code: 'code-from-microsoft' } });
    mockExchange.mockResolvedValue({ idToken: 'id.token.from-microsoft' });
    fetchMock = await openSignIn({
      'POST /auth/microsoft': () => [
        400,
        { message: 'Use your student email', code: 'EMAIL_DOMAIN_NOT_ALLOWED' },
      ],
    });

    await press('Continue with Microsoft');

    expect(await screen.findByText('Use your student email')).toBeOnTheScreen();
  });

  it('does not open Microsoft when the server has Microsoft sign-in turned off', async () => {
    fetchMock = await openSignIn({
      'POST /auth/microsoft/start': () => [404, { message: 'Microsoft sign-in is not turned on.' }],
    });

    await press('Continue with Microsoft');

    expect(await screen.findByText('Microsoft sign-in is not turned on.')).toBeOnTheScreen();
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('says so when Microsoft sign-in itself fails', async () => {
    mockPrompt.mockResolvedValue({ type: 'error', error: { message: 'access_denied' } });
    fetchMock = await openSignIn();

    await press('Continue with Microsoft');

    expect(await screen.findByText('Microsoft sign-in failed. Try again.')).toBeOnTheScreen();
  });
});

describe('isMicrosoftRedirect', () => {
  it('spots the redirect in a built app and in Expo Go, and nothing else', () => {
    expect(isMicrosoftRedirect('asulostfound://auth?code=abc&state=xyz')).toBe(true);
    expect(isMicrosoftRedirect('exp://192.168.1.20:8084/--/auth?code=abc')).toBe(true);
    expect(isMicrosoftRedirect('/auth')).toBe(true);
    expect(isMicrosoftRedirect('/posts/123')).toBe(false);
    expect(isMicrosoftRedirect('asulostfound://posts/author')).toBe(false);
  });
});
