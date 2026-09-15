'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Checklist from '@/components/Checklist';
import RequirementModal, { BLANK_REQUIREMENT, type RequirementDraft } from '@/components/RequirementModal';
import UploadModal from '@/components/UploadModal';
import { Callout, Card, CompliantChip, EmptyState, PageHeader, ProgressLine } from '@/components/ui';
import type { Item } from '@/lib/types';
import { Api, useAction, useClient, useClock } from '@/services/queries';

function UploadButton({ item, onPress }: { item: Item; onPress: () => void }) {
  if (item.state === 'WAITING') return null;
  if (item.state === 'OK')
    return (
      <Button size="sm" variant="light" onPress={onPress}>
        Replace
      </Button>
    );
  return (
    <Button size="sm" color="primary" variant={item.state === 'EXPIRING' ? 'flat' : 'solid'} onPress={onPress}>
      {item.state === 'EXPIRING' ? 'Upload new copy' : 'Upload'}
    </Button>
  );
}

export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isError } = useClient(id);
  const { data: clock } = useClock();
  const [uploading, setUploading] = useState<Item | null>(null);
  const [draft, setDraft] = useState<RequirementDraft | null>(null);
  const remove = useAction(Api.deleteRequirement, 'Requirement removed');

  if (isError) return <Callout tone="bad">You don't work for that client.</Callout>;
  if (!data || !clock) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }
  const client = data.row.company;

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/clients', label: 'Clients' }]}
        title={client.name}
        description={
          data.reviewed
            ? `${client.name} added you as a contractor. They set the list and review what you upload.`
            : `${client.name} isn't on EZForm, so you keep this list yourself. Your uploads count as soon as you add them.`
        }
        actions={
          <div className="flex items-center gap-3">
            <ProgressLine progress={data.row.progress} className="w-44" />
            <CompliantChip compliant={data.row.compliant} progress={data.row.progress} />
          </div>
        }
      />

      {!data.reviewed && (
        <Card
          className="mb-5"
          title={`What ${client.name} asks for`}
          subtitle="Only you see this list."
          actions={
            <Button size="sm" color="primary" variant="flat" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setDraft(BLANK_REQUIREMENT)}>
              Add requirement
            </Button>
          }
          bodyClass="p-0"
        >
          {data.own_requirements.length ? (
            <ul className="divide-y divide-line">
              {data.own_requirements.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{r.title}</span>
                    <span className="block text-[12px] text-ink-3">
                      {r.for === 'COMPANY' ? 'The company' : 'Each person'} · {r.has_expiry ? 'expires' : "doesn't expire"}
                    </span>
                  </span>
                  <Button size="sm" variant="light" isIconOnly aria-label={`Edit ${r.title}`} onPress={() => setDraft(r)}>
                    <PencilSquareIcon className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="light" color="danger" isIconOnly aria-label={`Remove ${r.title}`} onPress={() => remove.mutate(r.id)}>
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing on the list yet" body={`Add what ${client.name} asks of you, like an insurance certificate or training cards.`} />
          )}
        </Card>
      )}

      {data.reviewed && !data.row.progress.total && (
        <Card>
          <EmptyState title="Nothing asked yet" body={`${client.name} hasn't listed any requirements. When they do, they show up here.`} />
        </Card>
      )}
      <Checklist
        detail={data}
        peopleNote={
          <>
            Your own team. Add people in{' '}
            <Link href="/people" className="text-primary hover:underline">
              My people
            </Link>
            .
          </>
        }
        action={(i) => <UploadButton item={i} onPress={() => setUploading(i)} />}
      />

      <UploadModal item={uploading} today={clock.today} reviewed={data.reviewed} clientName={client.name} onClose={() => setUploading(null)} />
      <RequirementModal draft={draft} linkId={data.row.id} onClose={() => setDraft(null)} />
    </>
  );
}
