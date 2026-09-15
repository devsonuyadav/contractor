'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, CheckboxGroup, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@heroui/react';
import { plural, possessive } from '@/lib/describe';
import { Api, useAction, useRoster } from '@/services/queries';

/** Pick which workers from the company roster go on one client's crew. */
export default function CrewModal({ isOpen, onClose, relationshipId, clientName }: { isOpen: boolean; onClose: () => void; relationshipId: string; clientName: string }) {
  const { data, isLoading } = useRoster();
  const [value, setValue] = useState<string[]>([]);

  const current = useMemo(
    () => (data?.workers ?? []).filter((w) => w.deployments.some((d) => d.relationship_id === relationshipId && d.on_crew)).map((w) => w.id),
    [data, relationshipId],
  );
  useEffect(() => {
    if (isOpen) setValue(current);
  }, [isOpen, current]);

  const save = useAction(
    async () => {
      let added = 0;
      let changed = 0;
      for (const w of data?.workers ?? []) {
        const on = value.includes(w.id);
        if (on === current.includes(w.id)) continue;
        const r = await Api.setCrew({ relationship_id: relationshipId, worker_id: w.id, on_crew: on });
        added += r.added;
        changed++;
      }
      return { added, changed };
    },
    (r) => (r.changed ? `Crew updated${r.added ? `. ${plural(r.added, 'requirement')} assigned.` : '.'}` : 'No changes'),
  );

  const active = (data?.workers ?? []).filter((w) => w.active);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="lg" scrollBehavior="inside">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-0.5">
              Your crew for {clientName}
              <span className="text-[13px] font-normal text-ink-3">
                Only the people you tick can badge in at {possessive(clientName)} sites, and only they get {possessive(clientName)} worker requirements. Taking someone off keeps their records in case they come back.
              </span>
            </ModalHeader>
            <ModalBody>
              {isLoading ? (
                <div className="grid place-items-center py-8">
                  <Spinner />
                </div>
              ) : active.length ? (
                <CheckboxGroup id="crew-picker" aria-label={`Crew for ${clientName}`} value={value} onValueChange={setValue}>
                  {active.map((w) => {
                    const elsewhere = w.deployments.filter((d) => d.on_crew && d.relationship_id !== relationshipId).map((d) => d.client.name);
                    return (
                      <Checkbox key={w.id} value={w.id}>
                        <span className="block text-[13.5px]">
                          {w.name} <span className="text-ink-3">· {w.trade}</span>
                        </span>
                        <span className="block text-[12px] text-ink-3">
                          {w.badge_id}
                          {elsewhere.length ? ` · also on ${elsewhere.join(', ')}` : ''}
                        </span>
                      </Checkbox>
                    );
                  })}
                </CheckboxGroup>
              ) : (
                <p className="text-ink-3">Add workers to your company roster first.</p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" isLoading={save.isPending} onPress={() => save.mutate(undefined, { onSuccess: onClose })}>
                Save crew
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
