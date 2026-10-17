import { ApiError } from '@/api/client';
import { errorMessage } from '@/api/errors';

describe('errorMessage', () => {
  it.each([
    [429, 'Too many requests. Wait a few minutes and try again.'],
    [429, 'You can post up to 10 items a day. Try again tomorrow.'],
    [404, 'This post does not exist or was closed.'],
    [400, 'Choose a place from the list'],
  ])('shows the message the server sent with a %i', (status, message) => {
    expect(errorMessage(new ApiError(status, message))).toBe(message);
  });

  it('hides server errors behind a friendly message', () => {
    expect(errorMessage(new ApiError(500, 'Internal server error'))).toBe(
      'Something went wrong on our side. Try again in a moment.',
    );
  });

  it('treats anything else as a connection problem', () => {
    expect(errorMessage(new TypeError('Network request failed'))).toBe(
      "Can't reach the server. Check your connection and try again.",
    );
  });
});
