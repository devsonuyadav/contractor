'use client';

import { Fragment, useState } from 'react';
import { Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner, Tooltip } from '@heroui/react';
import { ChevronRightIcon, PencilSquareIcon, PlusIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import ChecklistRow, { sortByUrgency } from '@/components/portal/ChecklistRow';
import WorkerModal from '@/components/workers/WorkerModal';
import { Card, EmptyState, PageHeader, ScoreBar, StatusChip } from '@/components/ui';
import { plural, possessive } from '@/lib/describe';
import type { Deployment, RosterWorker } from '@/lib/types';
import { Api, useAction, useRoster } from '@/services/queries';

function gateTip(d: Deployment): string {
  if (d.clear) return `Can badge in at ${possessive(d.client.name)} assigned sites.`;
  return d.reasons.length ? d.reasons.join(' · ') : `Blocked at ${d.client.name}.`;
}

/** The company roster. Workers belong to the company; each client only gets the crew you put on its work. */
export default function PortalWorkers() {
  const { data, isLoading } = useRoster();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RosterWorker | null>(null);
  const [confirm, setConfirm] = useState<RosterWorker | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleActive = useAction(
    (w: RosterWorker) => Api.setWorkerActive({ id: w.id, active: !w.active }),
    (_r, w) => `${w.active ? 'Deactivated' : 'Reactivated'} ${w.name}`,
  );
  const crew = useAction(
    (v: { w: RosterWorker; d: Deployment }) => Api.setCrew({ relationship_id: v.d.relationship_id, worker_id: v.w.id, on_crew: !v.d.on_crew }),
    (r, v) => (v.d.on_crew ? `${v.w.name} is off the ${v.d.client.name} crew` : `${v.w.name} is on the ${v.d.client.name} crew${r.added ? `. ${plural(r.added, 'requirement')} assigned.` : '.'}`),
  );

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers"
        description={`${possessive(data.org.name)} roster. One badge works for every client, and each client only sees and checks the crew you put on its work.`}
        actions={
          <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setAdding(true)}>
            Add worker
          </Button>
        }
      />

      <Card bodyClass="p-0">
        {data.workers.length === 0 ? (
          <EmptyState
            icon={UserGroupIcon}
            title="No workers yet"
            body="Add the people you bring on site. They get a badge ID, and the training and certificates each client asks for once you put them on that client's crew."
            action={
              <Button color="primary" variant="flat" onPress={() => setAdding(true)}>
                Add your first worker
              </Button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table min-w-[900px]">
              <thead>
                <tr>
                  <th className="w-10" aria-label="Expand" />
                  <th>Worker</th>
                  <th>Badge</th>
                  <th>Contact</th>
                  <th>Client crews</th>
                  <th>To do</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.workers.map((w) => {
                  const on = w.deployments.filter((d) => d.on_crew);
                  const todo = on.reduce((n, d) => n + d.open_items, 0);
                  const isOpen = expanded.has(w.id);
                  return (
                    <Fragment key={w.id}>
                      <tr className={w.active ? '' : 'opacity-60'}>
                        <td className="pr-0">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? 'Hide' : 'Show'} ${w.name}'s crews and requirements`}
                            onClick={() => toggle(w.id)}
                            className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-gray-100"
                          >
                            <ChevronRightIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                          </button>
                        </td>
                        <td>
                          <p className="font-medium text-ink">{w.name}</p>
                          <p className="text-[12px] text-ink-3">{w.trade}</p>
                        </td>
                        <td className="tabular whitespace-nowrap font-mono text-[12.5px]">{w.badge_id}</td>
                        <td className="text-[12.5px] text-ink-2">
                          <p className="max-w-[200px] truncate">{w.email || '—'}</p>
                          <p className="text-ink-3">{w.phone || ''}</p>
                        </td>
                        <td>
                          {!w.active ? (
                            <span className="text-[12.5px] text-ink-3">Inactive</span>
                          ) : on.length ? (
                            <div className="flex flex-wrap gap-1">
                              {on.map((d) => (
                                <Tooltip key={d.relationship_id} content={gateTip(d)} delay={200}>
                                  <Chip size="sm" variant="flat" color={d.clear ? 'success' : 'danger'} className="font-medium">
                                    {d.client.name}
                                  </Chip>
                                </Tooltip>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[12.5px] text-ink-3">Not on a client crew</span>
                          )}
                        </td>
                        <td className="tabular">{todo ? <span className="font-medium text-ink">{todo}</span> : <span className="text-ink-3">0</span>}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <Button isIconOnly size="sm" variant="light" aria-label={`Edit ${w.name}`} onPress={() => setEditing(w)}>
                              <PencilSquareIcon className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="light" color={w.active ? 'danger' : 'primary'} onPress={() => setConfirm(w)}>
                              {w.active ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="bg-[#FAFAFD] p-0">
                            {w.deployments.length ? (
                              <div className="divide-y divide-line">
                                {w.deployments.map((d) => (
                                  <div key={d.relationship_id}>
                                    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                                      <p className="font-medium text-ink">{d.client.name}</p>
                                      <StatusChip status={d.status} />
                                      {d.on_crew && w.active && (
                                        <>
                                          <Tooltip content={gateTip(d)} delay={200}>
                                            <Chip size="sm" variant="dot" color={d.clear ? 'success' : 'danger'}>
                                              {d.clear ? 'Clear at the gate' : 'Blocked at the gate'}
                                            </Chip>
                                          </Tooltip>
                                          {d.score && <ScoreBar score={d.score} />}
                                        </>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="flat"
                                        color={d.on_crew ? 'default' : 'primary'}
                                        className="ml-auto"
                                        isDisabled={!w.active}
                                        isLoading={crew.isPending && crew.variables?.d.relationship_id === d.relationship_id && crew.variables?.w.id === w.id}
                                        onPress={() => crew.mutate({ w, d })}
                                      >
                                        {d.on_crew ? 'Take off crew' : 'Put on crew'}
                                      </Button>
                                    </div>
                                    {d.on_crew && w.active && (
                                      d.slots.length ? (
                                        <ul className="divide-y divide-line border-t border-line bg-white">
                                          {sortByUrgency(d.slots).map((s) => (
                                            <ChecklistRow key={s.id} slot={s} showWorker={false} />
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="px-4 pb-3 text-[13px] text-ink-3">{d.client.name} has no worker requirements for {w.name} at your current sites.</p>
                                      )
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="px-4 py-3 text-[13px] text-ink-3">You don&apos;t work for any clients yet.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <WorkerModal isOpen={adding} onClose={() => setAdding(false)} crewChoices={data.clients.map((c) => ({ id: c.id, name: c.name }))} />
      <WorkerModal isOpen={!!editing} onClose={() => setEditing(null)} worker={editing} />

      <Modal isOpen={!!confirm} onOpenChange={(open) => !open && setConfirm(null)} size="sm">
        <ModalContent>
          {() =>
            confirm && (
              <>
                <ModalHeader>{confirm.active ? `Deactivate ${confirm.name}?` : `Reactivate ${confirm.name}?`}</ModalHeader>
                <ModalBody>
                  <p className="text-ink-2">
                    {confirm.active
                      ? `${confirm.name}'s badge stops working at every client, and their items stop counting toward your scores. Their records are kept.`
                      : `${confirm.name}'s badge works again, and the requirements for the crews they're on come back.`}
                  </p>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={() => setConfirm(null)}>
                    Cancel
                  </Button>
                  <Button
                    color={confirm.active ? 'danger' : 'primary'}
                    isLoading={toggleActive.isPending}
                    onPress={() => toggleActive.mutate(confirm, { onSuccess: () => setConfirm(null) })}
                  >
                    {confirm.active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </ModalFooter>
              </>
            )
          }
        </ModalContent>
      </Modal>
    </div>
  );
}
