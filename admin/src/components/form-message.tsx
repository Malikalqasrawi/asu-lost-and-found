import { ApiError } from '@/api/client';

export const errorText = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Can't reach the server. Check the connection and try again.";

export function FormMessage({ error, info }: { error?: unknown; info?: string }) {
  if (error) {
    return (
      <p role="alert" className="message">
        {errorText(error)}
      </p>
    );
  }
  return info ? (
    <p role="status" className="message info">
      {info}
    </p>
  ) : null;
}
