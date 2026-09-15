'use client';

import Link from 'next/link';
import { Button } from '@heroui/react';
import type { SlotView } from '@/lib/types';
import { TYPE_META } from '@/lib/describe';
import { slotWhen } from '@/lib/slot';
import { StateChip, TypeIconTile } from '@/components/ui';

/** What the contractor can do with an item, and whether it's the main call to action. */
export function ctaFor(s: SlotView): { label: string; primary: boolean } {
  const open = s.submission.status === 'OPEN' || s.submission.status === 'REJECTED';
  if (s.state === 'REJECTED') return { label: 'Fix and resubmit', primary: true };
  if (open && (s.renewal_open || s.state === 'EXPIRED')) return { label: 'Renew', primary: s.needs_action };
  if (s.state === 'NOT_STARTED' && s.needs_action) return { label: TYPE_META[s.req.type].action, primary: true };
  return { label: 'View', primary: false };
}

/** Lapsed and sent-back items first, then overdue, then everything else. */
function urgency(s: SlotView): number {
  if (s.state === 'EXPIRED') return 0;
  if (s.state === 'REJECTED') return 1;
  if (s.overdue) return 2;
  if (s.state === 'NOT_STARTED') return 3;
  if (s.needs_action) return 4;
  return 5;
}

export function sortByUrgency(list: SlotView[]): SlotView[] {
  const days = (s: SlotView) => s.due_in_days ?? s.expires_in_days ?? 9999;
  return [...list].sort((a, b) => urgency(a) - urgency(b) || days(a) - days(b) || a.req.title.localeCompare(b.req.title));
}

export default function ChecklistRow({ slot, showWorker = true, showClient = false }: { slot: SlotView; showWorker?: boolean; showClient?: boolean }) {
  const when = slotWhen(slot);
  const urgent = slot.overdue || slot.state === 'EXPIRED' || slot.state === 'REJECTED';
  const cta = ctaFor(slot);
  const worker = [showClient ? slot.client_name : null, showWorker ? slot.worker_name : null].filter(Boolean).join(' · ') || null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap">
      <TypeIconTile type={slot.req.type} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{slot.req.title}</p>
        <p className="text-[12.5px] text-ink-3">
          {worker && <span className="text-ink-2">{worker}</span>}
          {worker && when ? ' · ' : null}
          {when && <span className={urgent ? 'font-medium text-danger' : undefined}>{when}</span>}
        </p>
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <StateChip state={slot.state} extra={slot.awaiting_sponsor ? `with ${slot.sponsor_name}` : slot.exception_pending ? 'exception requested' : undefined} />
        <Button
          as={Link}
          href={`/portal/item/${slot.id}`}
          size="sm"
          color={cta.primary ? 'primary' : 'default'}
          variant={cta.primary ? 'solid' : 'flat'}
          className="min-w-[104px]"
        >
          {cta.label}
        </Button>
      </div>
    </li>
  );
}
