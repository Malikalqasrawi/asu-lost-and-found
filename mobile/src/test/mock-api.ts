export type Reply = [status: number, body?: unknown];
type Handler = (body: any, headers: Record<string, string>) => Reply | Promise<Reply>;

export const authResponse = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresIn: 900,
  user: {
    id: 'user-1',
    email: 'ahmad@asu.edu.jo',
    fullName: 'Ahmad Saleh',
    role: 'STUDENT',
    hasPassword: true,
    createdAt: '2026-10-16T10:00:00.000Z',
  },
};

/** Answers fetch calls by "METHOD /path" and fails the test on anything else. */
export function mockApi(routes: Record<string, Handler>): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname.replace(/^\/api/, '');
    const key = `${init?.method ?? 'GET'} ${path}`;
    const handler = routes[key];
    if (!handler) {
      throw new Error(`Unexpected request: ${key}`);
    }
    const body =
      init?.body instanceof FormData
        ? init.body
        : init?.body
          ? JSON.parse(String(init.body))
          : undefined;
    const [status, json] = await handler(body, (init?.headers ?? {}) as Record<string, string>);
    return new Response(json === undefined ? null : JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

/** Starts the app already signed in, the way it does after a restart. */
export const signedIn = {
  'POST /auth/refresh': (): Reply => [
    200,
    { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 },
  ],
  'GET /users/me': (): Reply => [200, authResponse.user],
  'GET /handovers/mine': (): Reply => [200, []],
};

export const emptyBrowse = {
  'GET /posts': (): Reply => [200, { items: [], nextCursor: null }],
};

export function requestsTo(fetchMock: jest.SpyInstance, method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).endsWith(`/api${path}`) && (init?.method ?? 'GET') === method,
  );
}
