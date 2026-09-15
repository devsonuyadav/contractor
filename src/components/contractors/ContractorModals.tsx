'use client';

import { useEffect, useState } from 'react';
import { Button, Checkbox, CheckboxGroup, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@heroui/react';
import type { ContractorRow, ContractorStatus } from '@/lib/types';
import { STATUS_META, plural, possessive } from '@/lib/describe';
import { Api, useAction, useGroups, useSites } from '@/services/queries';
import { Callout } from '@/components/ui';

const STATUS_COPY: Record<ContractorStatus, { title: string; body: string; action: string; color: 'primary' | 'warning' | 'danger' | 'default' | 'success' }> = {
  Approved: {
    title: 'Approve this contractor?',
    body: 'Their workers can badge in at assigned sites as long as their checklist stays compliant. They get an email.',
    action: 'Approve contractor',
    color: 'success',
  },
  Pending: { title: 'Move back to Pending?', body: "They'll show as waiting for a decision. Workers can't badge in while pending.", action: 'Set to Pending', color: 'warning' },
  Denied: { title: 'Deny this contractor?', body: "Their workers are stopped at every gate and reminders stop. Tell them why; they'll get your note by email.", action: 'Deny contractor', color: 'danger' },
  New: { title: 'Reset to New?', body: 'They will need to submit their application again.', action: 'Reset to New', color: 'default' },
};

export function StatusModal({ contractor, target, onClose }: { contractor: ContractorRow; target: ContractorStatus | null; onClose: () => void }) {
  const [note, setNote] = useState('');
  useEffect(() => setNote(''), [target]);
  const save = useAction(() => Api.setStatus({ id: contractor.id, status: target!, note }), `${contractor.name} is now ${target ?? ''}`);
  const copy = target ? STATUS_COPY[target] : null;
  const openItems = contractor.company_score.total - contractor.company_score.compliant;
  return (
    <Modal isOpen={!!target} onOpenChange={(open) => !open && onClose()} size="md">
      <ModalContent>
        {() =>
          copy && (
            <>
              <ModalHeader>{copy.title}</ModalHeader>
              <ModalBody className="gap-3">
                <p className="text-ink-2">{copy.body}</p>
                {target === 'Approved' && openItems > 0 && (
                  <Callout tone="warn" title={`${plural(openItems, 'company requirement')} not compliant yet`}>
                    You can still approve. Workers are checked against their own and the company's requirements at the gate.
                  </Callout>
                )}
                <Textarea
                  id="status-note"
                  label={target === 'Denied' ? 'Reason (sent to the contractor)' : 'Note (optional)'}
                  labelPlacement="outside"
                  placeholder={target === 'Denied' ? 'e.g. No workers’ compensation coverage' : 'Anything the contractor should know'}
                  variant="bordered"
                  isRequired={target === 'Denied'}
                  value={note}
                  onValueChange={setNote}
                />
                <p className="text-[12px] text-ink-3">{STATUS_META[target!].hint}</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color={copy.color} isLoading={save.isPending} isDisabled={target === 'Denied' && !note.trim()} onPress={() => save.mutate(undefined, { onSuccess: onClose })}>
                  {copy.action}
                </Button>
              </ModalFooter>
            </>
          )
        }
      </ModalContent>
    </Modal>
  );
}

export function AssignModal({
  contractor,
  kind,
  onClose,
  allowedSiteIds,
}: {
  contractor: ContractorRow;
  kind: 'groups' | 'sites' | null;
  onClose: () => void;
  allowedSiteIds?: string[] | null;
}) {
  const { data: groups } = useGroups();
  const { data: sites } = useSites();
  const [value, setValue] = useState<string[]>([]);
  // A subcontractor can only work where its sponsor does.
  const siteChoices = (sites ?? []).filter((s) => !contractor.sponsor || (allowedSiteIds ?? []).includes(s.id));

  useEffect(() => {
    if (kind === 'groups') setValue(contractor.group_ids);
    if (kind === 'sites') setValue(contractor.site_ids);
  }, [kind, contractor.group_ids, contractor.site_ids]);

  const save = useAction(
    () => (kind === 'groups' ? Api.assignGroups({ contractor_id: contractor.id, group_ids: value }) : Api.assignSites({ contractor_id: contractor.id, site_ids: value })),
    (r) => `Saved. ${plural(r.added, 'requirement')} added, ${r.removed} removed.`,
  );

  return (
    <Modal isOpen={!!kind} onOpenChange={(open) => !open && onClose()} size="lg" scrollBehavior="inside">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-0.5">
              {kind === 'groups' ? 'Requirement groups' : 'Projects & sites'}
              <span className="text-[13px] font-normal text-ink-3">
                {kind === 'groups'
                  ? `${contractor.name} gets every requirement in the groups you tick. Unticking removes items that no other group or site needs.`
                  : contractor.sponsor
                    ? `As ${possessive(contractor.sponsor.name)} subcontractor they can only work on ${possessive(contractor.sponsor.name)} sites.`
                    : 'Sites decide where their crew can badge in, and a site can add its own requirement groups.'}
              </span>
            </ModalHeader>
            <ModalBody>
              {kind === 'groups' ? (
                <CheckboxGroup id="assign-groups" aria-label="Requirement groups" value={value} onValueChange={setValue}>
                  {(groups ?? []).map((g) => (
                    <Checkbox key={g.id} value={g.id}>
                      <span className="block text-[13.5px]">
                        {g.name} <span className="text-ink-3">· {plural(g.requirement_ids.length, 'requirement')}</span>
                      </span>
                      <span className="block text-[12px] text-ink-3">{g.description}</span>
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              ) : (
                <CheckboxGroup id="assign-sites" aria-label="Projects and sites" value={value} onValueChange={setValue}>
                  {siteChoices.map((s) => (
                    <Checkbox key={s.id} value={s.id}>
                      <span className="block text-[13.5px]">
                        {s.name} <span className="text-ink-3">· {s.code}</span>
                      </span>
                      <span className="block text-[12px] text-ink-3">{s.group_names.length ? `${s.address} · adds ${s.group_names.join(', ')}` : s.address}</span>
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" isLoading={save.isPending} onPress={() => save.mutate(undefined, { onSuccess: onClose })}>
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export function ConfirmModal({
  isOpen,
  title,
  body,
  action,
  color = 'primary',
  busy,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  body: React.ReactNode;
  action: string;
  color?: 'primary' | 'danger' | 'warning';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="sm">
      <ModalContent>
        {() => (
          <>
            <ModalHeader>{title}</ModalHeader>
            <ModalBody>
              <div className="text-ink-2">{body}</div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color={color} isLoading={busy} onPress={onConfirm}>
                {action}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
