'use client';

import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Radio, RadioGroup, Switch } from '@heroui/react';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Card, EmptyState } from '@/components/ui';
import { plural } from '@/lib/describe';
import type { Requirement } from '@/lib/types';
import type { SelfRequirementInput } from '@/services/queries';
import { Api, useAction } from '@/services/queries';

type Draft = Omit<SelfRequirementInput, 'relationship_id'>;

const BLANK: Draft = { title: '', applies_to: 'COMPANY', has_expiry: true, document_hint: '' };

const draftOf = (r: Requirement): Draft => ({
  id: r.id,
  title: r.title,
  applies_to: r.applies_to,
  has_expiry: r.validity.kind !== 'NONE',
  document_hint: r.document_hint ?? '',
});

/** The list for a client you keep yourself: only you can see it, and only you can change it. */
export default function SelfRequirements({ relationshipId, clientName, requirements }: { relationshipId: string; clientName: string; requirements: Requirement[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const remove = useAction(Api.deleteSelfRequirement, (res) => `Removed${res.removed ? ` and ${plural(res.removed, 'item')} dropped` : ''}`);

  return (
    <>
      <Card
        title={`What ${clientName} asks you for`}
        subtitle="Your own list. Nobody else sees it, and what you upload counts as soon as you add it."
        actions={
          <Button size="sm" color="primary" variant="flat" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setDraft(BLANK)}>
            Add document
          </Button>
        }
        bodyClass="p-0"
      >
        {requirements.length ? (
          <ul className="divide-y divide-line">
            {requirements.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{r.title}</span>
                  <span className="block text-[12px] text-ink-3">
                    {r.applies_to === 'COMPANY' ? 'Once for the company' : 'Each worker'} · {r.validity.kind === 'NONE' ? "doesn't expire" : 'expires on the date on the document'}
                  </span>
                </span>
                <Button size="sm" variant="light" isIconOnly aria-label={`Edit ${r.title}`} onPress={() => setDraft(draftOf(r))}>
                  <PencilSquareIcon className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  isIconOnly
                  aria-label={`Remove ${r.title}`}
                  isLoading={remove.isPending && remove.variables?.id === r.id}
                  onPress={() => remove.mutate({ relationship_id: relationshipId, id: r.id })}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing on the list yet" body={`Add what ${clientName} asks you for, such as an insurance certificate or training cards.`} />
        )}
      </Card>

      <Modal isOpen={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <ModalContent>{draft && <Form key={draft.id ?? 'new'} draft={draft} relationshipId={relationshipId} onClose={() => setDraft(null)} />}</ModalContent>
      </Modal>
    </>
  );
}

function Form({ draft, relationshipId, onClose }: { draft: Draft; relationshipId: string; onClose: () => void }) {
  const [v, setV] = useState(draft);
  const save = useAction(Api.saveSelfRequirement, (res) => (res.added ? `Saved · ${plural(res.added, 'item')} added` : 'Saved'));
  return (
    <>
      <ModalHeader>{draft.id ? 'Edit document' : 'Add document'}</ModalHeader>
      <ModalBody className="flex flex-col gap-5">
        <Input
          id="self-req-title"
          label="What they ask for"
          labelPlacement="outside"
          placeholder="e.g. Certificate of Liability Insurance"
          variant="bordered"
          isRequired
          autoFocus
          value={v.title}
          onValueChange={(title) => setV({ ...v, title })}
        />
        <RadioGroup id="self-req-applies" label="Who needs it?" orientation="horizontal" value={v.applies_to} onValueChange={(a) => setV({ ...v, applies_to: a as Draft['applies_to'] })}>
          <Radio value="COMPANY" description="One copy, like insurance">
            The company
          </Radio>
          <Radio value="WORKER" description="One per worker, like a training card">
            Each worker
          </Radio>
        </RadioGroup>
        <Switch isSelected={v.has_expiry} onValueChange={(has_expiry) => setV({ ...v, has_expiry })}>
          <span className="text-[13.5px]">It has an expiry date</span>
        </Switch>
        <Input
          id="self-req-hint"
          label="Note to yourself"
          labelPlacement="outside"
          placeholder="Optional, e.g. must name the client as additional insured"
          variant="bordered"
          value={v.document_hint ?? ''}
          onValueChange={(document_hint) => setV({ ...v, document_hint })}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="light" onPress={onClose}>
          Cancel
        </Button>
        <Button color="primary" isDisabled={!v.title.trim()} isLoading={save.isPending} onPress={() => save.mutate({ ...v, relationship_id: relationshipId }, { onSuccess: onClose })}>
          Save
        </Button>
      </ModalFooter>
    </>
  );
}
