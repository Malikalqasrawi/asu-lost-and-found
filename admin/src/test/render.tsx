import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

import { App } from '@/app';
import { SessionProvider } from '@/session/session';

export type Reply = [status: number, body?: unknown];
type Handler = (body: Record<string, string>, init: RequestInit) => Reply;

export const admin = {
  id: 'admin-1',
  email: 'rana.admin@asu.edu.jo',
  fullName: 'Rana Khalil',
  role: 'ADMIN',
};

/** Answers fetch calls by "METHOD /path" (query left out) and fails on anything else. */
export function mockApi(routes: Record<string, Handler>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname.replace(/^\/api/, '');
    const key = `${init?.method ?? 'GET'} ${path}`;
    const handler = routes[key];
    if (!handler) {
      throw new Error(`Unexpected request: ${key}`);
    }
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const [status, json] = handler(body, init ?? {});
    return new Response(json === undefined ? null : JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

/** The cookie from an earlier visit still works, so the admin is signed in. */
export const signedIn = {
  'POST /admin/auth/refresh': (): Reply => [200, { accessToken: 'access-1', expiresIn: 900 }],
  'GET /users/me': (): Reply => [200, admin],
};

export const signedOut = {
  'POST /admin/auth/refresh': (): Reply => [
    401,
    { message: 'Your session has ended. Sign in again.' },
  ],
};

export function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

export function calls(fetchMock: ReturnType<typeof mockApi>, method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      new URL(String(url)).pathname === `/api${path}` && (init?.method ?? 'GET') === method,
  );
}
