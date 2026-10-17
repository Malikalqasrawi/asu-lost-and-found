import { ApiError } from '@/api/client';

/** The server words its own messages; only crashes and dropped connections get ours. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status >= 500
      ? 'Something went wrong on our side. Try again in a moment.'
      : error.message;
  }
  return "Can't reach the server. Check your connection and try again.";
}

export function isApiError(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
