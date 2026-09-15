'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@/lib/types';
import { ROOT } from '@/services/queries';
import { DEFAULT_SESSION, readSession, writeSession } from './storage';

interface SessionValue {
  session: Session | null;
  ready: boolean;
  signIn: (s: Session, goTo?: string) => void;
}

const SessionContext = createContext<SessionValue>({ session: null, ready: false, signIn: () => undefined });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    setSession(readSession() ?? DEFAULT_SESSION);
  }, []);

  const signIn = useCallback(
    (s: Session, goTo?: string) => {
      writeSession(s);
      setSession(s);
      qc.resetQueries({ queryKey: [ROOT] });
      router.push(goTo ?? '/');
    },
    [qc, router],
  );

  const value = useMemo(() => ({ session, ready: session !== null, signIn }), [session, signIn]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
