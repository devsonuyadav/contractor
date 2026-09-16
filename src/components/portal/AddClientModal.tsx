'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Checkbox, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import type { SelfClientInput } from '@/services/queries';
import { Api, useAction } from '@/services/queries';
import { Callout } from '@/components/ui';
import { plural } from '@/lib/describe';

type Starter = SelfClientInput['requirements'][number];

const STARTERS: (Starter & { on: boolean })[] = [
  { title: 'Certificate of Liability Insurance', applies_to: 'COMPANY', has_expiry: true, on: true },
  { title: "Workers' Compensation Certificate", applies_to: 'COMPANY', has_expiry: true, on: true },
  { title: 'Safety programme', applies_to: 'COMPANY', has_expiry: false, on: false },
  { title: 'OSHA 10 card', applies_to: 'WORKER', has_expiry: false, on: true },
  { title: 'Site orientation certificate', applies_to: 'WORKER', has_expiry: true, on: false },
  { title: 'First aid / CPR card', applies_to: 'WORKER', has_expiry: true, on: false },
];

/** Track a client that doesn't use EZForm: you write the list, and your uploads count straight away. */
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
  const [contact, setContact] = useState('');
  const [picked, setPicked] = useState(STARTERS.filter((s) => s.on).map((s) => s.title));
  const add = useAction(Api.addSelfClient, (res) => `Added with ${plural(res.added, 'item')} to track`);

  const submit = () =>
    add.mutate(
      {
        name,
        contact_name: contact,
        requirements: STARTERS.filter((s) => picked.includes(s.title)).map(({ on: _on, ...r }) => r),
      },
      {
        onSuccess: (res) => {
          onClose();
          router.push(`/portal/clients/${res.id}`);
        },
      },
    );

  return (
    <>
      <ModalHeader className="flex flex-col gap-0.5">
        <span>Add a client you keep track of</span>
        <span className="text-[12.5px] font-normal text-ink-3">For a company that asks you for paperwork but doesn&apos;t use EZForm.</span>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-4">
        <Callout>
          You write the list and upload against it yourself, so nobody has to review it. Renewals and reminders work as usual, which is how you catch something expiring before the client asks.
          A client that <em>is</em> on EZForm adds you instead, and appears here by itself.
        </Callout>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="self-client-name" label="Client name" labelPlacement="outside" placeholder="e.g. Harbor Chemicals" variant="bordered" isRequired autoFocus value={name} onValueChange={setName} />
          <Input id="self-client-contact" label="Their contact" labelPlacement="outside" placeholder="Optional" variant="bordered" value={contact} onValueChange={setContact} />
        </div>
        <div>
          <p className="mb-2 text-[13.5px] font-medium text-ink">What do they ask you for?</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <Checkbox key={s.title} isSelected={picked.includes(s.title)} onValueChange={(on) => setPicked(on ? [...picked, s.title] : picked.filter((t) => t !== s.title))}>
                <span className="text-[13.5px]">{s.title}</span>
                <span className="block text-[12px] text-ink-3">
                  {s.applies_to === 'COMPANY' ? 'Once for the company' : 'Each worker'}
                  {s.has_expiry ? ' · expires' : ''}
                </span>
              </Checkbox>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-ink-3">You can add, change or remove these on the client&apos;s page afterwards.</p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="light" onPress={onClose}>
          Cancel
        </Button>
        <Button color="primary" isDisabled={!name.trim()} isLoading={add.isPending} onPress={submit}>
          Add client
        </Button>
      </ModalFooter>
    </>
  );
}
