'use client';

import { useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { ClipboardDocumentListIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import RequirementModal, { BLANK_REQUIREMENT, type RequirementDraft } from '@/components/RequirementModal';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { plural } from '@/lib/describe';
import { Api, useAction, useRequirements } from '@/services/queries';

export default function RequirementsPage() {
  const { data } = useRequirements();
  const [draft, setDraft] = useState<RequirementDraft | null>(null);
  const remove = useAction(Api.deleteRequirement, 'Requirement removed');
  const add = (
    <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setDraft(BLANK_REQUIREMENT)}>
      Add requirement
    </Button>
  );

  return (
    <>
      <PageHeader title="What I ask for" description="Every contractor you add gets this list. Company items are uploaded once; person items are uploaded for each of their people." actions={add} />
      <Card bodyClass="p-0">
        {!data ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : !data.length ? (
          <EmptyState icon={ClipboardDocumentListIcon} title="Your list is empty" body="Add what contractors must have before they work for you, like insurance or site orientation." action={add} />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Who needs it</th>
                  <th>Expires</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <p className="font-medium text-ink">{r.title}</p>
                      {r.hint && <p className="text-[12px] text-ink-3">{r.hint}</p>}
                    </td>
                    <td>{r.for === 'COMPANY' ? 'The company' : 'Each person'}</td>
                    <td>{r.has_expiry ? 'Yes' : 'No'}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="light" isIconOnly aria-label={`Edit ${r.title}`} onPress={() => setDraft(r)}>
                          <PencilSquareIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          color="danger"
                          isIconOnly
                          aria-label={`Remove ${r.title}`}
                          isLoading={remove.isPending && remove.variables === r.id}
                          onPress={() => remove.mutate(r.id)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line px-4 py-2.5 text-[12px] text-ink-3">Asked of {plural(data[0].contractors, 'contractor')}.</p>
          </div>
        )}
      </Card>
      <RequirementModal draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}
