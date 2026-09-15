import { differenceInCalendarDays, format, parseISO } from 'date-fns';

export const DAY_MS = 86_400_000;

/** Whole calendar days from `nowIso` to `iso` (negative when `iso` is in the past). */
export function daysUntil(iso: string, nowIso: string): number {
  return differenceInCalendarDays(parseISO(iso), parseISO(nowIso));
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return format(parseISO(iso), 'd MMM yyyy');
}

export function fmtWeekday(iso: string): string {
  return format(parseISO(iso), 'EEE d MMM yyyy');
}

export function relDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** Noon local time keeps the calendar day stable across time zones. */
export function fromDateInput(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}
