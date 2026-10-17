import { ApiError } from '@/api/client';
import { shouldRetry } from '@/api/query-client';

describe('query retries', () => {
  it('tries a dropped connection again, up to twice', () => {
    const offline = new TypeError('Network request failed');

    expect(shouldRetry(0, offline)).toBe(true);
    expect(shouldRetry(1, offline)).toBe(true);
    expect(shouldRetry(2, offline)).toBe(false);
  });

  it('tries a server error again', () => {
    expect(shouldRetry(0, new ApiError(500, 'Internal server error'))).toBe(true);
  });

  it.each([400, 401, 403, 404, 429])('never repeats a %i answer', (status) => {
    expect(shouldRetry(0, new ApiError(status, 'No'))).toBe(false);
  });
});
