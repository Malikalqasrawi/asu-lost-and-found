type Reply = [status: number, body?: unknown];
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
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const [status, json] = await handler(body, (init?.headers ?? {}) as Record<string, string>);
    return new Response(json === undefined ? null : JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

export function requestsTo(fetchMock: jest.SpyInstance, method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).endsWith(`/api${path}`) && (init?.method ?? 'GET') === method,
  );
}
