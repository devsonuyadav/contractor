'use client';

import { useEffect, useState } from 'react';
import { Button, Checkbox, CheckboxGroup, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import type { Worker } from '@/lib/types';
import { plural } from '@/lib/describe';
import { Api, useAction } from '@/services/queries';

/**
 * Add or edit a worker. A worker belongs to their employer's roster and can be on several client crews.
 * - Client side: pass `relationshipId`; a new worker joins the contractor's roster and your crew.
 * - Contractor side: pass `crewChoices` (your clients); a new worker joins your roster and the crews you tick.
 */
export default function WorkerModal({
  isOpen,
  onClose,
  worker,
  relationshipId,
  crewChoices,
  defaultCrew,
}: {
  isOpen: boolean;
  onClose: () => void;
  worker?: Worker | null;
  relationshipId?: string;
  crewChoices?: { id: string; name: string }[];
  defaultCrew?: string[];
}) {
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [crew, setCrew] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setName(worker?.name ?? '');
    setTrade(worker?.trade ?? '');
    setEmail(worker?.email ?? '');
    setPhone(worker?.phone ?? '');
    setCrew(defaultCrew ?? (crewChoices?.length === 1 ? [crewChoices[0].id] : []));
  }, [isOpen, worker, defaultCrew, crewChoices]);

  const create = useAction(
    () => Api.createWorker({ relationship_id: relationshipId, crew_for: relationshipId ? undefined : crew, name, trade, email, phone }),
    (r) => `Added ${name}, badge ${r.badge_id}${r.added ? `. ${plural(r.added, 'requirement')} assigned.` : '.'}`,
  );
  const update = useAction(() => Api.updateWorker({ id: worker!.id, name, trade, email, phone }), 'Worker details saved');
  const busy = create.isPending || update.isPending;
  const save = () => (worker ? update : create).mutate(undefined, { onSuccess: onClose });

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="lg">
      <ModalContent>
        {() => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <ModalHeader>{worker ? `Edit ${worker.name}` : 'Add a worker'}</ModalHeader>
            <ModalBody className="gap-4">
              {!worker && (
                <p className="text-[13px] text-ink-2">
                  {relationshipId
                    ? "They're added to the contractor's roster and your crew, with a badge ID and every worker-level requirement from your groups and sites."
                    : 'New workers get a badge ID that works at every client. Each client crew you put them on assigns that client’s worker requirements.'}
                </p>
              )}
              <Input id="worker-name" label="Full name" labelPlacement="outside" placeholder="e.g. Dana Whitfield" variant="bordered" isRequired autoFocus value={name} onValueChange={setName} />
              <Input id="worker-trade" label="Trade or role" labelPlacement="outside" placeholder="e.g. Roofer" variant="bordered" value={trade} onValueChange={setTrade} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input id="worker-email" type="email" label="Email" labelPlacement="outside" placeholder="name@company.com" variant="bordered" value={email} onValueChange={setEmail} />
                <Input id="worker-phone" label="Phone" labelPlacement="outside" placeholder="(555) 010-0000" variant="bordered" value={phone} onValueChange={setPhone} />
              </div>
              {!worker && !relationshipId && !!crewChoices?.length && (
                <CheckboxGroup id="worker-crews" label="Put them on these client crews" value={crew} onValueChange={setCrew} classNames={{ label: 'text-[13px] text-ink' }}>
                  {crewChoices.map((c) => (
                    <Checkbox key={c.id} value={c.id}>
                      <span className="text-[13.5px]">{c.name}</span>
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              )}
              {worker && <p className="text-[12px] text-ink-3">Badge ID {worker.badge_id} stays the same.</p>}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" type="submit" isLoading={busy} isDisabled={!name.trim()}>
                {worker ? 'Save changes' : 'Add worker'}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
