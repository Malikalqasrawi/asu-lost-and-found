import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { ServerStatus } from '@/components/server-status';

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ServerStatus />
    </QueryClientProvider>,
  );
}

describe('ServerStatus', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:4000/api';
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.useRealTimers();
  });

  it('shows a checking state while the request is running', async () => {
    jest.useFakeTimers();
    fetchMock.mockReturnValue(new Promise(() => {}));

    await renderWithQueryClient();

    expect(screen.getByText('Checking server…')).toBeOnTheScreen();
  });

  it('shows online when the backend answers', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', database: 'up' }), { status: 200 }),
    );

    await renderWithQueryClient();

    expect(await screen.findByText('Server online')).toBeOnTheScreen();
  });

  it('shows offline when the backend cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await renderWithQueryClient();

    expect(await screen.findByText('Server offline')).toBeOnTheScreen();
  });

  it('shows offline when the backend reports its database is down', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'error', database: 'down' }), { status: 503 }),
    );

    await renderWithQueryClient();

    expect(await screen.findByText('Server offline')).toBeOnTheScreen();
  });
});
