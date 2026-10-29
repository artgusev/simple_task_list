import { useCallback, useEffect, useState } from 'react';
import { api, onUnauthorized } from './api';

/**
 * 'checking'  asking the server whether it wants a password
 * 'open'      no password configured (or the server could not be asked; the task UI then shows its own error)
 * 'locked'    a password is needed and this browser has not signed in
 * 'unlocked'  signed in
 */
export type SessionStatus = 'checking' | 'open' | 'locked' | 'unlocked';

export interface Session {
  status: SessionStatus;
  /** Marks this browser as signed in after a successful login request. */
  signedIn: () => void;
  /** Clears the session cookie and shows the login screen. */
  signOut: () => Promise<void>;
}

export function useSession(): Session {
  const [status, setStatus] = useState<SessionStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    api.getSession().then(
      (info) => {
        if (cancelled) return;
        setStatus(!info.protected ? 'open' : info.authenticated ? 'unlocked' : 'locked');
      },
      () => {
        // Let the task UI load and report "can't reach the server"; a 401 later still locks.
        if (!cancelled) setStatus('open');
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Any request answered with 401 means the session is gone: back to the login screen.
  useEffect(() => {
    onUnauthorized(() => setStatus('locked'));
    return () => onUnauthorized(null);
  }, []);

  const signedIn = useCallback(() => setStatus('unlocked'), []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setStatus('locked');
    }
  }, []);

  return { status, signedIn, signOut };
}
