'use client';

import type { ReactNode } from 'react';
import { Button, Chip } from '@heroui/react';
import { BuildingOffice2Icon, PaperClipIcon, UserIcon } from '@heroicons/react/24/outline';
import type { Item, LinkDetail, Upload } from '@/lib/types';
import { itemWhen, openDataUrl } from '@/lib/describe';
import { Card, EmptyState, StateChip } from './ui';

export function FileButton({ upload }: { upload: Upload | null }) {
  if (!upload?.file.data_url) return null;
  return (
    <Button size="sm" variant="light" startContent={<PaperClipIcon className="h-4 w-4" />} onPress={() => void openDataUrl(upload.file.data_url!)}>
      View file
    </Button>
  );
}

function Row({ item, action }: { item: Item; action?: ReactNode }) {
  const when = itemWhen(item);
  const shown = item.pending ?? item.approved;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-64">
        <p className="font-medium text-ink">{item.requirement.title}</p>
        <p className="text-[12.5px] text-ink-3">{[when, item.state === 'MISSING' ? item.requirement.hint : ''].filter(Boolean).join(' · ') || ' '}</p>
        {item.pending?.status === 'REJECTED' && item.pending.note && (
          <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-[12.5px] text-red-900">
            Sent back by {item.pending.reviewed_by}: “{item.pending.note}”
          </p>
        )}
      </div>
      <StateChip state={item.state} />
      <div className="flex min-w-[190px] items-center justify-end gap-1">
        <FileButton upload={shown} />
        {action}
      </div>
    </li>
  );
}

export default function Checklist({ detail, action, peopleNote }: { detail: LinkDetail; action: (i: Item) => ReactNode; peopleNote?: ReactNode }) {
  const nothing = !detail.company_items.length && !detail.people.some((p) => p.items.length);
  if (nothing) return null;
  return (
    <div className="flex flex-col gap-5">
      <Card title={<span className="flex items-center gap-2"><BuildingOffice2Icon className="h-5 w-5 text-ink-3" />For the company</span>} bodyClass="p-0">
        {detail.company_items.length ? (
          <ul className="divide-y divide-line">
            {detail.company_items.map((i) => (
              <Row key={i.key} item={i} action={action(i)} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-ink-3">Nothing is asked of the company as a whole.</p>
        )}
      </Card>

      <Card title={<span className="flex items-center gap-2"><UserIcon className="h-5 w-5 text-ink-3" />For each person</span>} subtitle={peopleNote} bodyClass="p-0">
        {!detail.people.length ? (
          <EmptyState title="No people added yet" body={`${detail.viewer === 'client' ? detail.row.company.name : 'Your company'} hasn't added anyone to its team.`} />
        ) : !detail.people.some((p) => p.items.length) ? (
          <p className="px-4 py-4 text-ink-3">Nothing is asked of each person.</p>
        ) : (
          <div className="divide-y divide-line">
            {detail.people.map(({ person, ok, items }) => (
              <div key={person.id}>
                <div className="flex flex-wrap items-center gap-3 bg-[#FAFAFD] px-4 py-2.5">
                  <span className="font-semibold text-ink">{person.name}</span>
                  <span className="text-[12.5px] text-ink-3">
                    {person.job} · badge {person.badge_id}
                  </span>
                  <Chip size="sm" variant="dot" color={ok ? 'success' : 'danger'} className="ml-auto border-none">
                    {ok ? 'All good' : 'Missing items'}
                  </Chip>
                </div>
                <ul className="divide-y divide-line">
                  {items.map((i) => (
                    <Row key={i.key} item={i} action={action(i)} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
