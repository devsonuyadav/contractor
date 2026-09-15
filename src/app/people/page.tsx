'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Chip, Spinner } from '@heroui/react';
import { PencilSquareIcon, PlusIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import PersonModal, { type PersonDraft } from '@/components/PersonModal';
import { Callout, Card, EmptyState, PageHeader } from '@/components/ui';
import { Api, useAction, usePeople } from '@/services/queries';

export default function PeoplePage() {
  const { data } = usePeople();
  const [draft, setDraft] = useState<PersonDraft | null>(null);
  const remove = useAction(Api.deletePerson, 'Removed');
  const add = (
    <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setDraft({ name: '', job: '' })}>
      Add person
    </Button>
  );

  return (
    <>
      <PageHeader title="My people" description={`${data?.company.name ?? 'Your company'}'s own team. Each person gets a badge number for check-in.`} actions={add} />
      <div className="mb-5">
        <Callout title="Internal or external?">
          These people are internal to your company. When you work for a client, that client sees them as external users on your company's record, with the training and
          certificates it asks for.
        </Callout>
      </div>
      <Card bodyClass="p-0">
        {!data ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : !data.people.length ? (
          <EmptyState icon={UserGroupIcon} title="No people yet" body="Add your team to track training and certificates for the clients you work for." action={add} />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Badge</th>
                  <th>Ready for each client</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.people.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="text-[12px] text-ink-3">{p.job}</p>
                    </td>
                    <td className="tabular">{p.badge_id}</td>
                    <td>
                      {p.clients.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.clients.map((c) => (
                            <Link key={c.link_id} href={`/clients/${c.link_id}`}>
                              <Chip size="sm" variant="flat" color={c.ok ? 'success' : 'danger'} className="cursor-pointer">
                                {c.name}: {c.ok ? 'ready' : 'missing items'}
                              </Chip>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-3">No clients yet</span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="light" isIconOnly aria-label={`Edit ${p.name}`} onPress={() => setDraft(p)}>
                          <PencilSquareIcon className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="light" color="danger" isIconOnly aria-label={`Remove ${p.name}`} onPress={() => remove.mutate(p.id)}>
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <PersonModal draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}
