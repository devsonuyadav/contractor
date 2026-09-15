'use client';

import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Radio, RadioGroup, Switch } from '@heroui/react';
import type { Requirement, RequirementFor } from '@/lib/types';
import { Api, useAction } from '@/services/queries';

export type RequirementDraft = Pick<Requirement, 'title' | 'for' | 'has_expiry' | 'hint'> & { id?: string };

export const BLANK_REQUIREMENT: RequirementDraft = { title: '', for: 'COMPANY', has_expiry: true, hint: '' };

/** Add or edit one requirement. `linkId` is set for a client the contractor tracks itself. */
export default function RequirementModal({ draft, linkId, onClose }: { draft: RequirementDraft | null; linkId?: string; onClose: () => void }) {
  return (
    <Modal isOpen={!!draft} onOpenChange={(open) => !open && onClose()}>
      <ModalContent>{draft && <RequirementForm key={draft.id ?? 'new'} draft={draft} linkId={linkId} onClose={onClose} />}</ModalContent>
    </Modal>
  );
}

function RequirementForm({ draft, linkId, onClose }: { draft: RequirementDraft; linkId?: string; onClose: () => void }) {
  const [v, setV] = useState(draft);
  const save = useAction(Api.saveRequirement, draft.id ? 'Requirement saved' : 'Requirement added');
  const submit = () => save.mutate({ ...v, link_id: linkId }, { onSuccess: onClose });

  return (
    <>
      <ModalHeader>{draft.id ? 'Edit requirement' : 'Add requirement'}</ModalHeader>
      <ModalBody className="flex flex-col gap-5">
        <Input
          id="req-title"
          label="Name"
          labelPlacement="outside"
          placeholder="e.g. Liability insurance certificate"
          variant="bordered"
          isRequired
          autoFocus
          value={v.title}
          onValueChange={(title) => setV({ ...v, title })}
        />
        <RadioGroup id="req-for" label="Who needs it?" orientation="horizontal" value={v.for} onValueChange={(f) => setV({ ...v, for: f as RequirementFor })}>
          <Radio value="COMPANY" description="One copy, like insurance">
            The company
          </Radio>
          <Radio value="PERSON" description="One per person, like training">
            Each person
          </Radio>
        </RadioGroup>
        <Switch isSelected={v.has_expiry} onValueChange={(has_expiry) => setV({ ...v, has_expiry })}>
          <span className="text-[13.5px]">It has an expiry date</span>
        </Switch>
        <Input
          id="req-hint"
          label="Note for the contractor"
          labelPlacement="outside"
          placeholder="Optional, e.g. at least $2M per occurrence"
          variant="bordered"
          value={v.hint}
          onValueChange={(hint) => setV({ ...v, hint })}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="light" onPress={onClose}>
          Cancel
        </Button>
        <Button color="primary" isDisabled={!v.title.trim()} isLoading={save.isPending} onPress={submit}>
          Save
        </Button>
      </ModalFooter>
    </>
  );
}
