'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Checkbox, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import type { NewClientInput } from '@/services/queries';
import { Api, useAction } from '@/services/queries';
import { Callout } from './ui';

const STARTERS: (NewClientInput['requirements'][number] & { checked: boolean })[] = [
  { title: 'Insurance certificate', for: 'COMPANY', has_expiry: true, hint: '', checked: true },
  { title: "Workers' comp insurance", for: 'COMPANY', has_expiry: true, hint: '', checked: false },
  { title: 'Safety program', for: 'COMPANY', has_expiry: false, hint: '', checked: false },
  { title: 'OSHA 10 card', for: 'PERSON', has_expiry: false, hint: '', checked: true },
  { title: 'Site orientation', for: 'PERSON', has_expiry: true, hint: '', checked: false },
  { title: 'First aid / CPR', for: 'PERSON', has_expiry: true, hint: '', checked: false },
];

/** Track a client that isn't on EZForm yourself. */
export default function AddClientModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="lg">
      <ModalContent>{isOpen && <AddClientForm onClose={onClose} />}</ModalContent>
    </Modal>
  );
}

function AddClientForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState(STARTERS.filter((s) => s.checked).map((s) => s.title));
  const create = useAction(Api.createClient, 'Client added');

  const submit = () =>
    create.mutate(
      { name, requirements: STARTERS.filter((s) => picked.includes(s.title)).map(({ checked: _checked, ...r }) => r) },
      {
        onSuccess: (res) => {
          onClose();
          router.push(`/clients/${res.id}`);
        },
      },
    );

  return (
    <>
      <ModalHeader className="flex flex-col gap-0.5">
        <span>Add a client</span>
        <span className="text-[12.5px] font-normal text-ink-3">Keep track of what a company you work for asks of you, so nothing expires before they notice.</span>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-4">
        <Callout>
          For clients that aren't on EZForm. A client that is on EZForm adds you as their contractor instead, and shows up here by itself.
        </Callout>
        <Input id="client-name" label="Client name" labelPlacement="outside" placeholder="e.g. Harbor Chemicals" variant="bordered" isRequired autoFocus value={name} onValueChange={setName} />
        <div>
          <p className="mb-2 text-[13.5px] font-medium text-ink">What do they ask for?</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <Checkbox
                key={s.title}
                isSelected={picked.includes(s.title)}
                onValueChange={(on) => setPicked(on ? [...picked, s.title] : picked.filter((t) => t !== s.title))}
              >
                <span className="text-[13.5px]">{s.title}</span>
                <span className="block text-[12px] text-ink-3">{s.for === 'COMPANY' ? 'Company' : 'Each person'}</span>
              </Checkbox>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-ink-3">You can add, change or remove these later.</p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="light" onPress={onClose}>
          Cancel
        </Button>
        <Button color="primary" isDisabled={!name.trim()} isLoading={create.isPending} onPress={submit}>
          Add client
        </Button>
      </ModalFooter>
    </>
  );
}
