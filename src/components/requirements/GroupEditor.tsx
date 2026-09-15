'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, CheckboxGroup, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@heroui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Callout, TypeBadge } from '@/components/ui';
import { describeApplies, plural } from '@/lib/describe';
import type { GroupRow, RequirementRow } from '@/lib/types';
import { Api, useAction } from '@/services/queries';

export default function GroupEditor({ isOpen, editing, requirements, onClose }: { isOpen: boolean; editing: GroupRow | null; requirements: RequirementRow[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setIds(editing?.requirement_ids ?? []);
    setQ('');
  }, [isOpen, editing]);

  const create = useAction(() => Api.createGroup({ name, description, requirement_ids: ids }), `${name} created`);
  const update = useAction(
    () => Api.updateGroup({ id: editing!.id, name, description, requirement_ids: ids }),
    (r) => `Saved. ${plural(r.added, 'assignment')} added, ${r.removed} removed.`,
  );

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return requirements.filter((r) => (!r.retired || ids.includes(r.id)) && (!term || r.title.toLowerCase().includes(term)));
  }, [requirements, q, ids]);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-0.5">
              {editing ? `Edit ${editing.name}` : 'New requirement group'}
              <span className="text-[13px] font-normal text-ink-3">A group is what you assign to a contractor or a site, so name it for the client, site or trade it covers.</span>
            </ModalHeader>
            <ModalBody className="gap-4">
              {editing && editing.contractors > 0 && (
                <Callout tone="warn" title={`In use by ${plural(editing.contractors, 'contractor')}${editing.site_names.length ? ` and ${plural(editing.site_names.length, 'site')}` : ''}`}>
                  Adding a requirement puts it on their checklists straight away. Removing one takes it off unless another group or site still needs it.
                </Callout>
              )}
              <Input id="group-name" label="Group name" labelPlacement="outside" placeholder="e.g. Crane & rigging" variant="bordered" isRequired value={name} onValueChange={setName} />
              <Textarea id="group-description" label="Description" labelPlacement="outside" placeholder="When to use this group" variant="bordered" minRows={2} value={description} onValueChange={setDescription} />
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-ink">Requirements ({ids.length} selected)</p>
                  <Input aria-label="Filter requirements" size="sm" variant="bordered" placeholder="Filter" startContent={<MagnifyingGlassIcon className="h-4 w-4 text-ink-3" />} value={q} onValueChange={setQ} className="max-w-[220px]" />
                </div>
                <CheckboxGroup id="group-requirements" aria-label="Requirements" value={ids} onValueChange={setIds} classNames={{ wrapper: 'gap-1' }}>
                  {shown.map((r) => (
                    <Checkbox key={r.id} value={r.id} classNames={{ base: 'max-w-full w-full m-0 rounded-lg px-2 py-1.5 hover:bg-gray-50', label: 'w-full' }}>
                      <span className="flex w-full items-center gap-3 text-[13px]">
                        <TypeBadge type={r.type} label={false} />
                        <span className="flex-1 text-ink">
                          {r.title}
                          {r.retired && <span className="text-ink-3"> (retired)</span>}
                        </span>
                        <span className="text-[12px] text-ink-3">{describeApplies(r.applies_to)}</span>
                      </span>
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" isLoading={create.isPending || update.isPending} isDisabled={!name.trim() || !ids.length} onPress={() => (editing ? update : create).mutate(undefined, { onSuccess: onClose })}>
                {editing ? 'Save group' : 'Create group'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
