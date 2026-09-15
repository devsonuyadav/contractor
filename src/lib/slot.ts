import type { Evidence, SlotView } from './types';
import { addPeriod, fmtDate, relDays } from './dates';

/** One line describing where an item stands in time. */
export function slotWhen(s: SlotView): string {
  switch (s.state) {
    case 'APPROVED':
      return s.approval?.expires_at ? `Valid until ${fmtDate(s.approval.expires_at)}` : 'No expiry';
    case 'EXPIRING': {
      const base = `Expires ${fmtDate(s.approval?.expires_at)} (${relDays(s.expires_in_days ?? 0)})`;
      return s.awaiting_review ? `${base} · renewal submitted` : base;
    }
    case 'EXPIRED':
      return `Expired ${fmtDate(s.approval?.expires_at)}`;
    case 'SUBMITTED':
      return `Submitted ${fmtDate(s.submission.submitted_at)}`;
    case 'REJECTED':
      return `Sent back ${fmtDate(s.submission.reviewed_at)}`;
    case 'WAIVED':
      return `Exception until ${fmtDate(s.waived_until)}`;
    case 'NOT_STARTED':
      if (s.due_in_days === null) return '';
      return s.due_in_days < 0 ? `Overdue by ${-s.due_in_days} days` : `Due ${fmtDate(s.submission.due_at)} (${relDays(s.due_in_days)})`;
  }
}

export function whoLine(s: SlotView): string {
  return s.worker_name ? `${s.contractor_name} · ${s.worker_name}` : s.contractor_name;
}

/** Evidence worth showing first: the pending submission, else what's currently approved. */
export function currentEvidence(s: SlotView): Evidence | null {
  return s.submission.evidence ?? s.approval?.evidence ?? null;
}

/** When the pending submission would expire if approved: undefined = nothing pending, null = never. */
export function expiryIfApproved(s: SlotView): string | null | undefined {
  const ev = s.submission.evidence;
  if (!ev || s.submission.status !== 'SUBMITTED') return undefined;
  const v = s.req.validity;
  if (v.kind === 'NONE') return null;
  if (v.kind === 'DOCUMENT_DATE') return ev.kind === 'DOCUMENT' ? ev.expires_at ?? null : null;
  return addPeriod(s.submission.submitted_at ?? new Date().toISOString(), v.every, v.unit);
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
