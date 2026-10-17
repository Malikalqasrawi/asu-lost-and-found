import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'refreshToken';
// Refresh a little before the server would refuse the token.
const EXPIRY_MARGIN_MS = 30_000;

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;
let expiredListener: (() => void) | null = null;
const tokenListeners = new Set<() => void>();

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds the access token is valid for. */
  expiresIn: number;
}

function setAccessToken(token: string | null, expiresAt: number): void {
  accessToken = token;
  accessTokenExpiresAt = expiresAt;
  tokenListeners.forEach((listener) => listener());
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function accessTokenExpired(): boolean {
  return !accessToken || Date.now() >= accessTokenExpiresAt;
}

/** Calls the listener whenever the access token changes. */
export function subscribeToAccessToken(listener: () => void): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveTokens(tokens: Tokens): Promise<void> {
  setAccessToken(tokens.accessToken, Date.now() + tokens.expiresIn * 1000 - EXPIRY_MARGIN_MS);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  setAccessToken(null, 0);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export function onSessionExpired(listener: () => void): () => void {
  expiredListener = listener;
  return () => {
    if (expiredListener === listener) {
      expiredListener = null;
    }
  };
}

export function notifySessionExpired(): void {
  expiredListener?.();
}
