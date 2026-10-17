import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { authApi, type AuthResponse, type UserProfile } from '@/api/auth';
import { refreshSession } from '@/api/client';
import { clearTokens, getRefreshToken, onSessionExpired, saveTokens } from '@/session/tokens';

type Status = 'loading' | 'signedOut' | 'signedIn';

// Kept in memory only, between the sign-up or sign-in form and the code screen,
// because the backend asks for the password again together with the code.
export interface PendingCredentials {
  email: string;
  password?: string;
}

interface SessionValue {
  status: Status;
  user: UserProfile | null;
  pending: PendingCredentials | null;
  setPending: (credentials: PendingCredentials | null) => void;
  signIn: (auth: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pending, setPending] = useState<PendingCredentials | null>(null);

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        if ((await getRefreshToken()) && (await refreshSession())) {
          const profile = await authApi.me();
          if (active) {
            setUser(profile);
            setStatus('signedIn');
          }
          return;
        }
      } catch {
        // Offline at start-up: show the sign-in screen and keep the stored token.
      }
      if (active) {
        setStatus('signedOut');
      }
    }

    restore();
    const stopListening = onSessionExpired(() => {
      queryClient.clear();
      setUser(null);
      setStatus('signedOut');
    });
    return () => {
      active = false;
      stopListening();
    };
  }, [queryClient]);

  const signIn = useCallback(async (auth: AuthResponse) => {
    await saveTokens(auth);
    setPending(null);
    setUser(auth.user);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    await clearTokens();
    queryClient.clear();
    setUser(null);
    setStatus('signedOut');
  }, [queryClient]);

  const value = useMemo(
    () => ({ status, user, pending, setPending, signIn, signOut }),
    [status, user, pending, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return session;
}
