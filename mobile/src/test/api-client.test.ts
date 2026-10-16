import { ApiError, apiGet } from '@/api/client';

const originalUrl = process.env.EXPO_PUBLIC_API_URL;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiGet', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:4000/api/';
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    process.env.EXPO_PUBLIC_API_URL = originalUrl;
  });

  it('joins the base url and path without a double slash', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }));

    await apiGet('/health');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://10.0.2.2:4000/api/health',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('returns the parsed body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok', database: 'up' }));

    await expect(apiGet('/health')).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('throws an ApiError with the status for a failed response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'error' }, 503));

    const error = await apiGet('/health').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
  });

  it('explains a missing base url instead of calling the network', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;

    await expect(apiGet('/health')).rejects.toThrow(/EXPO_PUBLIC_API_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
