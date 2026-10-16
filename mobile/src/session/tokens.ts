import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'refreshToken';

let accessToken: string | null = null;
let expiredListener: (() => void) | null = null;

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveTokens(tokens: Tokens): Promise<void> {
  accessToken = tokens.accessToken;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
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
