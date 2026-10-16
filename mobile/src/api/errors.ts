import { ApiError } from '@/api/client';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return 'Too many attempts. Wait a few minutes and try again.';
    }
    if (error.status >= 500) {
      return 'Something went wrong on our side. Try again in a moment.';
    }
    return error.message;
  }
  return "Can't reach the server. Check your connection and try again.";
}

export function isApiError(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
