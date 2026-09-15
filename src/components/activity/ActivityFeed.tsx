'use client';

import type { ActivityEvent } from '@/lib/types';
import { timeAgo } from '@/lib/dates';
import { EmptyState } from '@/components/ui';

const TONE: Record<string, string> = {
  good: 'bg-success',
  warn: 'bg-warning',
  bad: 'bg-danger',
  info: 'bg-primary',
};

export default function ActivityFeed({ events, now, max }: { events: ActivityEvent[]; now: string; max?: string }) {
  if (!events.length) return <EmptyState title="No activity yet" />;
  return (
    <ul className={`divide-y divide-line overflow-y-auto ${max ?? 'max-h-[340px]'}`}>
      {events.map((e) => (
        <li key={e.id} className="flex gap-3 px-4 py-2.5">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[e.tone ?? 'info']}`} aria-hidden />
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">{e.text}</p>
          <time className="shrink-0 whitespace-nowrap text-[11.5px] text-ink-3" dateTime={e.at}>
            {timeAgo(e.at, now)}
          </time>
        </li>
      ))}
    </ul>
  );
}
