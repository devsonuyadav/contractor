'use client';

import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { Api, useAction } from '@/services/queries';

export type PersonDraft = { id?: string; name: string; job: string };

export default function PersonModal({ draft, onClose }: { draft: PersonDraft | null; onClose: () => void }) {
  return (
    <Modal isOpen={!!draft} onOpenChange={(open) => !open && onClose()}>
      <ModalContent>{draft && <PersonForm key={draft.id ?? 'new'} draft={draft} onClose={onClose} />}</ModalContent>
    </Modal>
  );
}

function PersonForm({ draft, onClose }: { draft: PersonDraft; onClose: () => void }) {
  const [v, setV] = useState(draft);
  const save = useAction(Api.savePerson, (res) => (draft.id ? 'Saved' : `Added with badge ${res.badge_id}`));
  return (
    <>
      <ModalHeader>{draft.id ? 'Edit person' : 'Add person'}</ModalHeader>
      <ModalBody className="flex flex-col gap-5">
        <Input id="person-name" label="Name" labelPlacement="outside" placeholder="Full name" variant="bordered" isRequired autoFocus value={v.name} onValueChange={(name) => setV({ ...v, name })} />
        <Input id="person-job" label="Job" labelPlacement="outside" placeholder="e.g. Electrician" variant="bordered" value={v.job} onValueChange={(job) => setV({ ...v, job })} />
      </ModalBody>
      <ModalFooter>
        <Button variant="light" onPress={onClose}>
          Cancel
        </Button>
        <Button color="primary" isDisabled={!v.name.trim()} isLoading={save.isPending} onPress={() => save.mutate(v, { onSuccess: onClose })}>
          Save
        </Button>
      </ModalFooter>
    </>
  );
}
