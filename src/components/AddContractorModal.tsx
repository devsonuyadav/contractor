'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { Api, useAction, useCompanySearch } from '@/services/queries';

/** Add a company to work for you. If it's already on EZForm, link it instead of creating a copy. */
export default function AddContractorModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="lg">
      <ModalContent>{isOpen && <AddContractorForm onClose={onClose} />}</ModalContent>
    </Modal>
  );
}

function AddContractorForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [trade, setTrade] = useState('');
  const { data: matches } = useCompanySearch(name);
  const create = useAction(Api.createContractor, (res) => (res.existing ? 'Contractor added' : 'Contractor added and invited'));
  const done = (res: { id: string }) => {
    onClose();
    router.push(`/contractors/${res.id}`);
  };

  return (
    <>
      <ModalHeader className="flex flex-col gap-0.5">
        <span>Add contractor</span>
        <span className="text-[12.5px] font-normal text-ink-3">They get a login, see your requirements, and upload their documents for you to approve.</span>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-4">
        <Input id="contractor-name" label="Company name" labelPlacement="outside" placeholder="e.g. Brightline Electric" variant="bordered" isRequired autoFocus value={name} onValueChange={setName} />

        {!!matches?.length && (
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-3">
            <p className="text-[13px] font-medium text-ink">Already on EZForm</p>
            <p className="mb-2 text-[12.5px] text-ink-2">Add the existing company. Their team and documents stay theirs, and they keep one account for every client.</p>
            <ul className="flex flex-col gap-1.5">
              {matches.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{m.name}</span>
                    <span className="block text-[12px] text-ink-3">{m.trade}</span>
                  </span>
                  <Button size="sm" color="primary" isLoading={create.isPending} onPress={() => create.mutate({ company_id: m.id }, { onSuccess: done })}>
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="contractor-contact" label="Contact person" labelPlacement="outside" placeholder="Full name" variant="bordered" isRequired value={contact} onValueChange={setContact} />
          <Input id="contractor-email" type="email" label="Email" labelPlacement="outside" placeholder="name@company.com" variant="bordered" isRequired value={email} onValueChange={setEmail} />
        </div>
        <Input id="contractor-trade" label="Trade" labelPlacement="outside" placeholder="Optional, e.g. Electrical" variant="bordered" value={trade} onValueChange={setTrade} />
      </ModalBody>
      <ModalFooter>
        <Button variant="light" onPress={onClose}>
          Cancel
        </Button>
        <Button
          color="primary"
          isDisabled={!name.trim() || !contact.trim() || !email.trim()}
          isLoading={create.isPending}
          onPress={() => create.mutate({ name, contact_name: contact, email, trade }, { onSuccess: done })}
        >
          Add and invite
        </Button>
      </ModalFooter>
    </>
  );
}
