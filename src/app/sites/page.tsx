'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Checkbox, CheckboxGroup, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Progress, Spinner, Textarea } from '@heroui/react';
import { MapPinIcon, PlusIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Card, EmptyState, PageHeader, StatusChip } from '@/components/ui';
import { plural } from '@/lib/describe';
import type { SiteRow } from '@/lib/types';
import { Api, useAction, useGroups, useSites } from '@/services/queries';

export default function SitesPage() {
  const { data: sites, isLoading } = useSites();
  const [editor, setEditor] = useState<{ open: boolean; row: SiteRow | null }>({ open: false, row: null });

  return (
    <>
      <PageHeader
        title="Projects & sites"
        description="Where contractors work. A site can add its own requirement groups, and the gate only lets in workers from contractors assigned to it."
        actions={
          <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setEditor({ open: true, row: null })}>
            New project or site
          </Button>
        }
      />
      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : sites?.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sites.map((s) => {
            const pct = s.workers_total ? Math.round((s.workers_clear * 100) / s.workers_total) : null;
            return (
              <Card
                key={s.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {s.name}
                    {s.code && (
                      <Chip size="sm" variant="bordered" className="tabular">
                        {s.code}
                      </Chip>
                    )}
                  </span>
                }
                subtitle={
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="h-3.5 w-3.5" />
                    {s.address}
                  </span>
                }
                actions={
                  <div className="flex gap-1">
                    <Button as={Link} href={`/gate?site=${s.id}`} size="sm" variant="light" startContent={<ShieldCheckIcon className="h-4 w-4" />}>
                      Gate
                    </Button>
                    <Button size="sm" variant="flat" onPress={() => setEditor({ open: true, row: s })}>
                      Edit
                    </Button>
                  </div>
                }
              >
                <p className="text-[13px] text-ink-2">{s.description}</p>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="eyebrow mb-1.5">Site requirements</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.group_names.length ? s.group_names.map((g) => <Chip key={g} size="sm" variant="flat" color="primary">{g}</Chip>) : <span className="text-[13px] text-ink-3">Only each contractor's own groups</span>}
                    </div>
                  </div>
                  <div>
                    <p className="eyebrow mb-1.5">Cleared at the gate right now</p>
                    {pct === null ? (
                      <span className="text-[13px] text-ink-3">No workers yet</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Progress aria-label="Workers cleared" size="sm" value={pct} color={pct === 100 ? 'success' : pct >= 70 ? 'primary' : 'warning'} className="flex-1" />
                        <span className="tabular text-[13px] text-ink">
                          {s.workers_clear}/{s.workers_total}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="eyebrow mb-1.5">Contractors ({s.contractors.length})</p>
                  {s.contractors.length ? (
                    <ul className="divide-y divide-line rounded-lg border border-line">
                      {s.contractors.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <Link href={`/contractors/${c.id}`} className="text-[13px] font-medium text-ink hover:text-primary hover:underline">
                            {c.name}
                          </Link>
                          <StatusChip status={c.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-ink-3">Assign contractors to this site from their page.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={MapPinIcon} title="No projects or sites yet" action={<Button color="primary" onPress={() => setEditor({ open: true, row: null })}>New project or site</Button>} />
      )}
      <SiteEditor isOpen={editor.open} editing={editor.row} onClose={() => setEditor({ open: false, row: null })} />
    </>
  );
}

function SiteEditor({ isOpen, editing, onClose }: { isOpen: boolean; editing: SiteRow | null; onClose: () => void }) {
  const { data: groups } = useGroups();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setName(editing?.name ?? '');
    setCode(editing?.code ?? '');
    setAddress(editing?.address ?? '');
    setDescription(editing?.description ?? '');
    setGroupIds(editing?.group_ids ?? []);
  }, [isOpen, editing]);

  const body = { name, code, address, description, group_ids: groupIds };
  const create = useAction(() => Api.createSite(body), `${name} created`);
  const update = useAction(() => Api.updateSite({ ...body, id: editing!.id }), (r) => `Saved. ${plural(r.added, 'assignment')} added, ${r.removed} removed.`);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {() => (
          <>
            <ModalHeader>{editing ? `Edit ${editing.name}` : 'New project or site'}</ModalHeader>
            <ModalBody className="gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                <Input id="site-name" label="Name" labelPlacement="outside" placeholder="e.g. Harbor Terminal Expansion" variant="bordered" isRequired value={name} onValueChange={setName} />
                <Input id="site-code" label="Code" labelPlacement="outside" placeholder="HTE-26" variant="bordered" value={code} onValueChange={setCode} />
              </div>
              <Input id="site-address" label="Address" labelPlacement="outside" placeholder="Street, city" variant="bordered" value={address} onValueChange={setAddress} />
              <Textarea id="site-description" label="Description" labelPlacement="outside" placeholder="What's happening here" variant="bordered" minRows={2} value={description} onValueChange={setDescription} />
              <CheckboxGroup id="site-groups" label="Extra requirements for anyone working here" value={groupIds} onValueChange={setGroupIds} description="Every contractor assigned to this site gets these groups on top of their own." classNames={{ label: 'text-[13px] text-ink' }}>
                {(groups ?? []).map((g) => (
                  <Checkbox key={g.id} value={g.id}>
                    <span className="block text-[13px]">{g.name}</span>
                    <span className="block text-[12px] text-ink-3">{g.description}</span>
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" isLoading={create.isPending || update.isPending} isDisabled={!name.trim()} onPress={() => (editing ? update : create).mutate(undefined, { onSuccess: onClose })}>
                {editing ? 'Save' : 'Create'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
