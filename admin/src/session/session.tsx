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

import { api, onSignedOut, refreshSession, setAccessToken } from '@/api/client';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

type Status = 'loading' | 'signedOut' | 'signedIn';

interface Session {
  status: Status;
  user: AdminUser | null;
  /** Checks the password and emails a code; returns the challenge for the second step. */
  startSignIn: (email: string, password: string) => Promise<string>;
  finishSignIn: (challenge: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

interface Verified {
  accessToken: string;
  user: AdminUser;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AdminUser | null>(null);

  const forget = useCallback(() => {
    setAccessToken(null);
    queryClient.clear();
    setUser(null);
    setStatus('signedOut');
  }, [queryClient]);

  useEffect(() => {
    let active = true;
    // The cookie from an earlier visit may still be valid.
    void (async () => {
      const restored =
        (await refreshSession()) && (await api<AdminUser>('GET', '/users/me').catch(() => null));
      if (!active) {
        return;
      }
      setUser(restored || null);
      setStatus(restored ? 'signedIn' : 'signedOut');
    })();
    const stop = onSignedOut(forget);
    return () => {
      active = false;
      stop();
    };
  }, [forget]);

  const startSignIn = useCallback(async (email: string, password: string) => {
    const { challenge } = await api<{ challenge: string }>('POST', '/admin/auth/login', {
      email,
      password,
    });
    return challenge;
  }, []);

  const finishSignIn = useCallback(async (challenge: string, code: string) => {
    const verified = await api<Verified>('POST', '/admin/auth/verify', { challenge, code });
    setAccessToken(verified.accessToken);
    setUser(verified.user);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await api<void>('POST', '/admin/auth/logout').catch(() => undefined);
    forget();
  }, [forget]);

  const value = useMemo(
    () => ({ status, user, startSignIn, finishSignIn, signOut }),
    [status, user, startSignIn, finishSignIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return session;
}
