import type { Item, ItemState } from './types';
import { fmtDate, relDays } from './dates';

export type ChipColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

export const STATE_META: Record<ItemState, { label: string; color: ChipColor }> = {
  MISSING: { label: 'Not uploaded', color: 'default' },
  WAITING: { label: 'Waiting for review', color: 'primary' },
  REJECTED: { label: 'Sent back', color: 'danger' },
  OK: { label: 'Done', color: 'success' },
  EXPIRING: { label: 'Expiring soon', color: 'warning' },
  EXPIRED: { label: 'Expired', color: 'danger' },
};

/** One line saying where an item stands in time. */
export function itemWhen(i: Item): string {
  const exp = i.approved?.expires_at;
  switch (i.state) {
    case 'OK':
      return exp ? `Valid until ${fmtDate(exp)}` : 'No expiry';
    case 'EXPIRING':
      return `Expires ${fmtDate(exp)} (${relDays(i.expires_in_days ?? 0)})${i.pending?.status === 'WAITING' ? ' · new copy waiting for review' : ''}`;
    case 'EXPIRED':
      return `Expired ${fmtDate(exp)}`;
    case 'WAITING':
      return `Uploaded ${fmtDate(i.pending?.uploaded_at)}`;
    case 'REJECTED':
      return `Sent back ${fmtDate(i.pending?.reviewed_at)}`;
    case 'MISSING':
      return '';
  }
}

/** "Liability insurance certificate" or "Working at heights training · Dana Brooks". */
export function itemLabel(i: Item): string {
  return i.person ? `${i.requirement.title} · ${i.person.name}` : i.requirement.title;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Browsers block opening data: URLs directly, so hand them over as blob URLs. */
export async function openDataUrl(dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
