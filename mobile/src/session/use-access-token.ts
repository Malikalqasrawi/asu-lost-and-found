import { useSyncExternalStore } from 'react';

import { getAccessToken, subscribeToAccessToken } from '@/session/tokens';

/** The current access token; components re-render when it is refreshed. */
export function useAccessToken(): string | null {
  return useSyncExternalStore(subscribeToAccessToken, getAccessToken);
}
