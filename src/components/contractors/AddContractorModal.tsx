'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, CheckboxGroup, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { BuildingOffice2Icon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { OrgMatch } from '@/lib/types';
import { plural } from '@/lib/describe';
import { Api, useAction, useGroups, useOrgSearch, useRequirements, useSites } from '@/services/queries';

export default function AddContractorModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const { data: groups } = useGroups();
  const { data: sites } = useSites();
  const { data: requirements } = useRequirements();
  const [name, setName] = useState('');
  const [term, setTerm] = useState('');
  const [picked, setPicked] = useState<OrgMatch | null>(null);
  const [trade, setTrade] = useState('');
  const [contactName, setContactName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const { data: matches } = useOrgSearch(picked ? '' : term);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setTerm('');
    setPicked(null);
    setTrade('');
    setContactName('');
    setTitle('');
    setEmail('');
    setPhone('');
    const baseline = groups?.find((g) => /baseline/i.test(g.name));
    setGroupIds(baseline ? [baseline.id] : []);
    setSiteIds([]);
    setTags('');
  }, [isOpen, groups]);

  // Search the EZForm directory as they type, so a company already on the platform is linked instead of duplicated.
  useEffect(() => {
    const t = setTimeout(() => setTerm(name), 250);
    return () => clearTimeout(t);
  }, [name]);

  // What the new contractor will be asked for, before workers are added.
  const preview = useMemo(() => {
    const ids = new Set<string>();
    groupIds.forEach((gid) => groups?.find((g) => g.id === gid)?.requirement_ids.forEach((r) => ids.add(r)));
    siteIds.forEach((sid) => sites?.find((s) => s.id === sid)?.group_ids.forEach((gid) => groups?.find((g) => g.id === gid)?.requirement_ids.forEach((r) => ids.add(r))));
    const reqs = [...ids].map((id) => requirements?.find((r) => r.id === id)).filter((r) => !!r && !r.retired);
    return { company: reqs.filter((r) => r!.applies_to === 'COMPANY').length, worker: reqs.filter((r) => r!.applies_to === 'WORKER').length };
  }, [groupIds, siteIds, groups, sites, requirements]);

  const tagList = () => tags.split(',').map((t) => t.trim()).filter(Boolean);
  const create = useAction(
    () =>
      picked
        ? Api.createContractor({ org_id: picked.id, group_ids: groupIds, site_ids: siteIds, tags: tagList() })
        : Api.createContractor({ name, trade, contact: { name: contactName, title, email, phone }, group_ids: groupIds, site_ids: siteIds, tags: tagList() }),
    (r) => `${r.existing ? 'Added' : 'Invited'} ${picked?.name ?? name} with ${plural(r.added, 'requirement')}. The email is in the outbox.`,
  );

  const exact = matches?.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());
  const canSave = picked ? true : !!name.trim() && !exact && !!contactName.trim() && /\S+@\S+\.\S+/.test(email);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="3xl" scrollBehavior="inside">
      <ModalContent>
        {() => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSave) return;
              create.mutate(undefined, {
                onSuccess: (r) => {
                  onClose();
                  onCreated?.(r.id);
                },
              });
            }}
          >
            <ModalHeader className="flex flex-col gap-0.5">
              Add a contractor
              <span className="text-[13px] font-normal text-ink-3">
                Search first: if the company already uses EZForm, its profile and workers come with it and it doesn&apos;t have to set anything up again.
              </span>
            </ModalHeader>
            <ModalBody className="gap-5">
              {picked ? (
                <div className="flex items-start gap-3 rounded-xl border border-success-200 bg-success-50/60 p-3">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{picked.name}</p>
                    <p className="text-[12.5px] text-ink-2">
                      {picked.trade} · {picked.contact_name} ({picked.contact_email})
                    </p>
                    <p className="mt-1 text-[12px] text-ink-3">Already on EZForm. They get a notice that you added them, and fill in your checklist from their existing account.</p>
                  </div>
                  <Button size="sm" variant="light" onPress={() => setPicked(null)}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input id="new-name" label="Company name" labelPlacement="outside" placeholder="e.g. Ironwood Welding" variant="bordered" isRequired autoFocus value={name} onValueChange={setName} />
                      <Input id="new-trade" label="Trade" labelPlacement="outside" placeholder="e.g. Welding" variant="bordered" value={trade} onValueChange={setTrade} />
                    </div>
                    {!!matches?.length && (
                      <div className="rounded-xl border border-line bg-[#FAFAFD] p-2">
                        <p className="px-2 pb-1.5 pt-1 text-[12px] font-medium text-ink-2">Already on EZForm</p>
                        <ul className="space-y-1">
                          {matches.map((m) => (
                            <li key={m.id}>
                              <button
                                type="button"
                                onClick={() => setPicked(m)}
                                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                              >
                                <BuildingOffice2Icon className="h-5 w-5 shrink-0 text-ink-3" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13.5px] font-medium text-ink">{m.name}</span>
                                  <span className="block truncate text-[12px] text-ink-3">
                                    {m.trade} · {m.contact_name}
                                  </span>
                                </span>
                                {m.runs_program && (
                                  <Chip size="sm" variant="flat" className="hidden sm:inline-flex">
                                    Also manages its own contractors
                                  </Chip>
                                )}
                                <span className="shrink-0 text-[12.5px] font-medium text-primary">Add</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {exact && <p className="px-2 pb-1 pt-1.5 text-[12px] text-warning-700">{exact.name} is already on EZForm. Add the existing company instead of creating another one.</p>}
                      </div>
                    )}
                  </div>
                  <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <legend className="eyebrow mb-2">Main contact</legend>
                    <Input id="new-contact" label="Name" labelPlacement="outside" placeholder="Full name" variant="bordered" isRequired value={contactName} onValueChange={setContactName} />
                    <Input id="new-title" label="Job title" labelPlacement="outside" placeholder="e.g. Owner" variant="bordered" value={title} onValueChange={setTitle} />
                    <Input id="new-email" type="email" label="Email" labelPlacement="outside" placeholder="name@company.com" variant="bordered" isRequired value={email} onValueChange={setEmail} />
                    <Input id="new-phone" label="Phone" labelPlacement="outside" placeholder="(555) 010-0000" variant="bordered" value={phone} onValueChange={setPhone} />
                  </fieldset>
                </>
              )}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <CheckboxGroup id="new-groups" label="Requirement groups" value={groupIds} onValueChange={setGroupIds} classNames={{ label: 'eyebrow' }}>
                  {(groups ?? []).map((g) => (
                    <Checkbox key={g.id} value={g.id}>
                      <span className="block text-[13px]">{g.name}</span>
                      <span className="block text-[12px] text-ink-3">{plural(g.requirement_ids.length, 'requirement')}</span>
                    </Checkbox>
                  ))}
                </CheckboxGroup>
                <CheckboxGroup id="new-sites" label="Projects & sites" value={siteIds} onValueChange={setSiteIds} classNames={{ label: 'eyebrow' }}>
                  {(sites ?? []).map((s) => (
                    <Checkbox key={s.id} value={s.id}>
                      <span className="block text-[13px]">{s.name}</span>
                      <span className="block text-[12px] text-ink-3">{s.group_names.length ? `Adds ${s.group_names.join(', ')}` : 'No extra requirements'}</span>
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              </div>
              <Input id="new-tags" label="Tags" labelPlacement="outside" placeholder="Comma separated, e.g. Night shift, Union" variant="bordered" value={tags} onValueChange={setTags} />
              <p className="rounded-lg bg-primary-50 px-3 py-2.5 text-[13px] text-primary-800">
                They&apos;ll be asked for {plural(preview.company, 'company requirement')}
                {preview.worker ? `, plus ${plural(preview.worker, 'requirement')} for each worker on the crew they send you` : ''}.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" type="submit" isLoading={create.isPending} isDisabled={!canSave}>
                {picked ? 'Add contractor' : 'Send invitation'}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
