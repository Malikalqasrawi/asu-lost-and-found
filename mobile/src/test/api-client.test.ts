import * as SecureStore from 'expo-secure-store';

import { ApiError, apiRequest } from '@/api/client';
import { clearTokens, getAccessToken, onSessionExpired, saveTokens } from '@/session/tokens';
import { mockApi, requestsTo } from '@/test/mock-api';

const { resetSecureStore } = SecureStore as unknown as { resetSecureStore: () => void };
const originalUrl = process.env.EXPO_PUBLIC_API_URL;

describe('apiRequest', () => {
  let fetchMock: jest.SpyInstance | undefined;

  beforeEach(async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:4000/api/';
    resetSecureStore();
    await clearTokens();
  });

  afterEach(() => {
    fetchMock?.mockRestore();
    process.env.EXPO_PUBLIC_API_URL = originalUrl;
  });

  it('sends JSON to the base url without a double slash', async () => {
    fetchMock = mockApi({ 'POST /auth/login': () => [200, { ok: true }] });

    await expect(
      apiRequest('POST', '/auth/login', { body: { email: 'a@asu.edu.jo' } }),
    ).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://10.0.2.2:4000/api/auth/login');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@asu.edu.jo' });
  });

  it('returns nothing for 204 No Content', async () => {
    fetchMock = mockApi({ 'POST /auth/logout': () => [204] });

    await expect(apiRequest('POST', '/auth/logout')).resolves.toBeUndefined();
  });

  it('turns an error response into an ApiError with the message and code', async () => {
    fetchMock = mockApi({
      'POST /auth/login': () => [403, { message: 'Verify your email first.', code: 'EMAIL_NOT_VERIFIED' }],
    });

    const error = await apiRequest('POST', '/auth/login').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 403,
      message: 'Verify your email first.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('uses the first validation message when there are several', async () => {
    fetchMock = mockApi({
      'POST /auth/register': () => [400, { message: ['Enter a valid email address', 'too short'] }],
    });

    await expect(apiRequest('POST', '/auth/register')).rejects.toThrow('Enter a valid email address');
  });

  it('explains a missing base url instead of calling the network', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    fetchMock = mockApi({});

    await expect(apiRequest('GET', '/health')).rejects.toThrow(/EXPO_PUBLIC_API_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the access token only on requests that need it', async () => {
    await saveTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    fetchMock = mockApi({
      'GET /users/me': () => [200, {}],
      'GET /health': () => [200, {}],
    });

    await apiRequest('GET', '/users/me', { auth: true });
    await apiRequest('GET', '/health');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer access-1');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it('refreshes an expired access token and repeats the request', async () => {
    await saveTokens({ accessToken: 'old-access', refreshToken: 'refresh-1' });
    fetchMock = mockApi({
      'GET /users/me': (_body, headers) =>
        headers.Authorization === 'Bearer new-access' ? [200, { id: 'user-1' }] : [401],
      'POST /auth/refresh': (body) =>
        body.refreshToken === 'refresh-1'
          ? [200, { accessToken: 'new-access', refreshToken: 'refresh-2' }]
          : [401],
    });

    await expect(apiRequest('GET', '/users/me', { auth: true })).resolves.toEqual({ id: 'user-1' });
    expect(getAccessToken()).toBe('new-access');
    expect(await SecureStore.getItemAsync('refreshToken')).toBe('refresh-2');
  });

  it('refreshes only once when several requests fail together', async () => {
    await saveTokens({ accessToken: 'old-access', refreshToken: 'refresh-1' });
    fetchMock = mockApi({
      'GET /users/me': (_body, headers) =>
        headers.Authorization === 'Bearer new-access' ? [200, {}] : [401],
      'POST /auth/refresh': () => [200, { accessToken: 'new-access', refreshToken: 'refresh-2' }],
    });

    await Promise.all([
      apiRequest('GET', '/users/me', { auth: true }),
      apiRequest('GET', '/users/me', { auth: true }),
      apiRequest('GET', '/users/me', { auth: true }),
    ]);

    expect(requestsTo(fetchMock, 'POST', '/auth/refresh')).toHaveLength(1);
  });

  it('ends the session when the refresh token is refused', async () => {
    await saveTokens({ accessToken: 'old-access', refreshToken: 'refresh-1' });
    const expired = jest.fn();
    const stopListening = onSessionExpired(expired);
    fetchMock = mockApi({
      'GET /users/me': () => [401, { message: 'Unauthorized' }],
      'POST /auth/refresh': () => [401, { message: 'Your session has ended. Sign in again.' }],
    });

    await expect(apiRequest('GET', '/users/me', { auth: true })).rejects.toMatchObject({
      status: 401,
    });

    expect(expired).toHaveBeenCalledTimes(1);
    expect(await SecureStore.getItemAsync('refreshToken')).toBeNull();
    stopListening();
  });
});
