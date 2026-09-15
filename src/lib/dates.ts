import { addDays, addMonths, addYears, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { PeriodUnit } from './types';

export const DAY_MS = 86_400_000;

export function dayKey(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

export function addPeriod(iso: string, every: number, unit: PeriodUnit): string {
  const d = parseISO(iso);
  const next = unit === 'days' ? addDays(d, every) : unit === 'months' ? addMonths(d, every) : addYears(d, every);
  return next.toISOString();
}

export function plusDays(iso: string, days: number): string {
  return addDays(parseISO(iso), days).toISOString();
}

/** Whole calendar days from `nowIso` to `iso` (negative when `iso` is in the past). */
export function daysUntil(iso: string, nowIso: string): number {
  return differenceInCalendarDays(parseISO(iso), parseISO(nowIso));
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return format(parseISO(iso), 'd MMM yyyy');
}

export function fmtShort(iso?: string | null): string {
  if (!iso) return '—';
  return format(parseISO(iso), 'd MMM');
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return format(parseISO(iso), 'd MMM yyyy, HH:mm');
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  return format(parseISO(iso), 'HH:mm');
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

export function timeAgo(iso: string, nowIso: string): string {
  const mins = Math.round((parseISO(nowIso).getTime() - parseISO(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 45) return `${days} d ago`;
  return fmtDate(iso);
}

/** yyyy-MM-dd for <input type="date">. */
export function toDateInput(iso?: string | null): string {
  return iso ? format(parseISO(iso), 'yyyy-MM-dd') : '';
}

/** Noon local time keeps the calendar day stable across time zones. */
export function fromDateInput(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}
