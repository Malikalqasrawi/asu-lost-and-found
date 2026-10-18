import {
  accessTokenExpired,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  notifySessionExpired,
  saveTokens,
  type Tokens,
} from '@/session/tokens';

const REQUEST_TIMEOUT_MS = 10_000;

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function apiUrl(path: string): string {
  return `${baseUrl()}${path}`;
}

function baseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error('EXPO_PUBLIC_API_URL is not set. Copy mobile/.env.example to mobile/.env.');
  }
  return url.replace(/\/+$/, '');
}

async function send(
  method: Method,
  path: string,
  { body, auth, timeoutMs = REQUEST_TIMEOUT_MS }: RequestOptions,
) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) {
    headers['Content-Type'] = 'application/json';
  }
  const token = auth ? getAccessToken() : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined || isForm ? (body as FormData | undefined) : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[];
    code?: string;
  };
  const message = Array.isArray(body.message) ? body.message[0] : body.message;
  return new ApiError(
    response.status,
    message ?? `Request failed with status ${response.status}`,
    body.code,
  );
}

let refreshing: Promise<boolean> | null = null;

/**
 * Gets a new access token with the stored refresh token. Requests that fail
 * at the same time share one refresh, because a refresh token works only once.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        return false;
      }
      const response = await send('POST', '/auth/refresh', { body: { refreshToken } });
      if (!response.ok) {
        if (response.status === 401) {
          await clearTokens();
        }
        return false;
      }
      await saveTokens((await response.json()) as Tokens);
      return true;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * Ids in paths can come from a link that opened the app, so a path may never
 * climb to another route with dot segments (also spelled %2e) or cut itself
 * short with #.
 */
function checkPath(path: string): void {
  const [route] = path.split('?');
  const climbs = route.split('/').some((part) => {
    const dots = part.replace(/%2e/gi, '.');
    return dots === '.' || dots === '..';
  });
  if (climbs || route.includes('#')) {
    throw new Error(`Refused an unsafe API path: ${route}`);
  }
}

export async function apiRequest<T>(
  method: Method,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  checkPath(path);
  if (options.auth && accessTokenExpired()) {
    await refreshSession();
  }
  let response = await send(method, path, options);

  if (response.status === 401 && options.auth) {
    if (await refreshSession()) {
      response = await send(method, path, options);
    } else {
      notifySessionExpired();
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
