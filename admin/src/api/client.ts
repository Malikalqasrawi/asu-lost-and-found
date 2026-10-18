export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

/** Marks requests as coming from this site; the API checks it before using the cookie. */
const ADMIN_HEADER = { 'X-Lost-Found-Admin': '1' };

type Method = 'GET' | 'POST' | 'DELETE';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

// Kept in memory only: the refresh token is in an httpOnly cookie the page can't read.
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const signedOutListeners = new Set<() => void>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[];
    code?: string;
  };
  const message = [body.message ?? []].flat().join(' ') || 'Something went wrong. Try again.';
  return new ApiError(
    response.status,
    response.status >= 500 ? 'Something went wrong. Try again.' : message,
    body.code,
  );
}

function send(method: Method, path: string, body?: unknown): Promise<Response> {
  const cookieRoute = path.startsWith('/admin/auth/');
  return fetch(`${API_URL}${path}`, {
    method,
    credentials: cookieRoute ? 'include' : 'omit',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken && !cookieRoute ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(cookieRoute ? ADMIN_HEADER : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Swaps the cookie for a new access token. Calls that come in while one is
 * running share it, because the cookie works only once.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await send('POST', '/admin/auth/refresh');
      if (!response.ok) {
        return false;
      }
      const { accessToken: token } = (await response.json()) as { accessToken: string };
      accessToken = token;
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response = await send(method, path, body);
  if (response.status === 401 && accessToken) {
    if (await refreshSession()) {
      response = await send(method, path, body);
    } else {
      accessToken = null;
      signedOutListeners.forEach((listener) => listener());
    }
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/** Photos need the access token, so they are fetched and shown from memory. */
export async function photoBlob(photoId: string): Promise<Blob> {
  const response = await send('GET', `/photos/${photoId}`);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return response.blob();
}
