'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Checkbox, CheckboxGroup, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Radio, RadioGroup, Spinner } from '@heroui/react';
import type { Site } from '@/lib/types';
import { plural, possessive } from '@/lib/describe';
import { Api, useAction, useSubcontractorOptions } from '@/services/queries';

/** A contractor brings one of its own approved contractors onto a client's work as its subcontractor. */
export default function SponsorModal({
  isOpen,
  onClose,
  relationshipId,
  clientName,
  sites,
}: {
  isOpen: boolean;
  onClose: () => void;
  relationshipId: string;
  clientName: string;
  sites: Site[];
}) {
  const { data: options, isLoading } = useSubcontractorOptions(relationshipId, isOpen);
  const [pick, setPick] = useState('');
  const [siteIds, setSiteIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setPick(options?.find((o) => !o.blocked)?.program_relationship_id ?? '');
    setSiteIds(sites.length === 1 ? [sites[0].id] : []);
  }, [isOpen, options, sites]);

  const chosen = options?.find((o) => o.program_relationship_id === pick);
  const bring = useAction(
    () => Api.sponsorSubcontractor({ id: relationshipId, program_relationship_id: pick, site_ids: siteIds }),
    (r) => `${chosen?.name ?? 'Subcontractor'} added. ${plural(r.added, 'requirement')} flowed down; ${clientName} will approve them.`,
  );

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="xl" scrollBehavior="inside">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-0.5">
              Bring a subcontractor onto {possessive(clientName)} work
              <span className="text-[13px] font-normal text-ink-3">
                Pick one of the contractors you already approve. {clientName} asks them for what it asks of you (except items it keeps for direct contractors), you check their paperwork first,
                and {clientName} approves them.
              </span>
            </ModalHeader>
            <ModalBody className="gap-5">
              {isLoading ? (
                <div className="grid place-items-center py-8">
                  <Spinner />
                </div>
              ) : options?.length ? (
                <RadioGroup id="sub-pick" label="Subcontractor" value={pick} onValueChange={setPick} classNames={{ label: 'eyebrow' }}>
                  {options.map((o) => (
                    <Radio key={o.program_relationship_id} value={o.program_relationship_id} isDisabled={!!o.blocked}>
                      <span className="block text-[13.5px]">
                        {o.name} <span className="text-ink-3">· {o.trade}</span>
                      </span>
                      <span className="block text-[12px] text-ink-3">{o.blocked ?? `Crew of ${o.crew} on your work`}</span>
                    </Radio>
                  ))}
                </RadioGroup>
              ) : (
                <p className="text-[13px] text-ink-2">
                  Subcontractors come from your own contractor program.{' '}
                  <Link href="/contractors" className="text-primary hover:underline">
                    Add and approve them there
                  </Link>{' '}
                  first.
                </p>
              )}
              <CheckboxGroup id="sub-sites" label={`Where they'll work for ${clientName}`} value={siteIds} onValueChange={setSiteIds} classNames={{ label: 'eyebrow' }}>
                {sites.map((s) => (
                  <Checkbox key={s.id} value={s.id}>
                    <span className="block text-[13.5px]">{s.name}</span>
                    <span className="block text-[12px] text-ink-3">{s.code}</span>
                  </Checkbox>
                ))}
              </CheckboxGroup>
              {!sites.length && <p className="text-[13px] text-ink-3">{clientName} hasn&apos;t put you on a site yet, so there&apos;s nowhere to bring a subcontractor.</p>}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" isLoading={bring.isPending} isDisabled={!chosen || !!chosen.blocked || !siteIds.length} onPress={() => bring.mutate(undefined, { onSuccess: onClose })}>
                Bring onto the work
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
