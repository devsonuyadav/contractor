import type { Session } from '@/lib/types';

// Demo sign-in. In production the host's login cookie identifies the member and their organization.
export const SESSION_KEY = 'ezc-session';
export const DEFAULT_SESSION: Session = { member_id: 'M-PRIYA' };

export function readSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return DEFAULT_SESSION;
    const s = JSON.parse(raw) as Partial<Session>;
    if (s && typeof s.member_id === 'string' && s.member_id) return { member_id: s.member_id };
  } catch {
    // blocked storage or bad JSON
  }
  return DEFAULT_SESSION;
}

export function writeSession(s: Session): void {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // storage unavailable; the session lasts for this page view only
  }
}
