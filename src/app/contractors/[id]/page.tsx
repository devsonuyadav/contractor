'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fragment, useState } from 'react';
import { Button, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Spinner, Tab, Tabs } from '@heroui/react';
import { ArrowRightEndOnRectangleIcon, ChevronDownIcon, ChevronRightIcon, PencilSquareIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import ActivityFeed from '@/components/activity/ActivityFeed';
import { AssignModal, ConfirmModal, StatusModal } from '@/components/contractors/ContractorModals';
import ContractorTable from '@/components/contractors/ContractorTable';
import ReviewModal from '@/components/review/ReviewModal';
import { Callout, Card, EmptyState, KV, PageHeader, ScoreBar, StateChip, Stat, StatusChip, TypeBadge } from '@/components/ui';
import WorkerModal from '@/components/workers/WorkerModal';
import { fmtDate, fmtDateTime, timeAgo } from '@/lib/dates';
import { firstName, plural, possessive, shortOrg } from '@/lib/describe';
import { slotWhen } from '@/lib/slot';
import type { ContractorStatus, Evidence, SlotView, Worker } from '@/lib/types';
import { Api, useAction, useClock, useContractor, usePersonas } from '@/services/queries';
import { useSession } from '@/session/SessionProvider';

type TabKey = 'requirements' | 'workers' | 'profile' | 'activity';

function evidenceSummary(ev: Evidence | null | undefined): string {
  if (!ev) return '—';
  switch (ev.kind) {
    case 'DOCUMENT':
      return ev.file.name;
    case 'FORM':
      return `${Object.keys(ev.answers).length} answers`;
    case 'TRAINING':
      return `Scored ${ev.score}% · ${ev.trainee}`;
    case 'SIGNOFF':
      return `Signed by ${ev.signed_name}`;
  }
}

function SlotTable({ slots, onOpen, showWorker = false }: { slots: SlotView[]; onOpen: (id: string) => void; showWorker?: boolean }) {
  const flowed = (s: SlotView) => s.sources.length > 0 && s.sources.every((src) => src.startsWith('flow:'));
  // Only worth marking when a subcontractor has both inherited and directly assigned items.
  const markFlow = slots.some(flowed) && slots.some((s) => !flowed(s));
  if (!slots.length) return <EmptyState title="Nothing assigned" body="Assign a requirement group or a site to generate this checklist." />;
  return (
    <div className="table-scroll">
      <table className="data-table min-w-[820px]">
        <thead>
          <tr>
            <th>Requirement</th>
            {showWorker && <th>Worker</th>}
            <th>State</th>
            <th>When</th>
            <th>Evidence</th>
            <th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => {
            const actionable = s.awaiting_review || s.exception_pending;
            return (
              <tr key={s.id} className="clickable" onClick={() => onOpen(s.id)}>
                <td>
                  <div className="flex items-center gap-2">
                    <TypeBadge type={s.req.type} label={false} />
                    <span className="font-medium text-ink">{s.req.title}</span>
                    {markFlow && flowed(s) && (
                      <Chip size="sm" variant="flat" color="primary" className="h-5 text-[11px]">
                        Flows down
                      </Chip>
                    )}
                    {!s.req.scored && (
                      <Chip size="sm" variant="bordered" className="h-5 text-[11px]">
                        Not scored
                      </Chip>
                    )}
                  </div>
                </td>
                {showWorker && <td className="text-ink-2">{s.worker_name}</td>}
                <td>
                  <div className="flex flex-wrap gap-1">
                    <StateChip state={s.state} extra={s.awaiting_sponsor ? `with ${s.sponsor_name}` : undefined} />
                    {s.exception_pending && (
                      <Chip size="sm" variant="flat" color="secondary">
                        Exception asked
                      </Chip>
                    )}
                    {s.state === 'EXPIRING' && s.awaiting_review && (
                      <Chip size="sm" variant="flat" color="primary">
                        Renewal in review
                      </Chip>
                    )}
                  </div>
                </td>
                <td className={`text-[12.5px] ${s.overdue || s.state === 'EXPIRED' ? 'font-medium text-danger' : 'text-ink-2'}`}>{slotWhen(s)}</td>
                <td className="max-w-[240px] truncate text-[12.5px] text-ink-3">{evidenceSummary(s.submission.evidence ?? s.approval?.evidence)}</td>
                <td className="text-right">
                  <Button size="sm" variant="flat" color={actionable || s.awaiting_sponsor ? 'primary' : 'default'} onPress={() => onOpen(s.id)}>
                    {s.awaiting_review ? 'Review' : s.exception_pending ? 'Decide' : 'View'}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ContractorPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data, isLoading, error } = useContractor(id);
  const { data: clock } = useClock();
  const { data: personas } = usePersonas();
  const { signIn } = useSession();
  const [tab, setTab] = useState<TabKey>('requirements');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<ContractorStatus | null>(null);
  const [assign, setAssign] = useState<'groups' | 'sites' | null>(null);
  const [workerModal, setWorkerModal] = useState<{ open: boolean; worker: Worker | null }>({ open: false, worker: null });
  const [offCrew, setOffCrew] = useState<Worker | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const removeFromCrew = useAction(
    (w: Worker) => Api.setCrew({ relationship_id: id!, worker_id: w.id, on_crew: false }),
    (_r, w) => `${w.name} is off your crew`,
  );

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }
  if (error || !data) {
    return <EmptyState title="Contractor not found" body="It may have been removed when the demo data was reset." action={<Link href="/contractors" className="text-primary hover:underline">Back to contractors</Link>} />;
  }

  const c = data.contractor;
  const contactLogin = personas?.find((p) => p.org_id === c.contractor_id);
  const now = clock?.today ?? new Date().toISOString();
  const companySlots = data.slots.filter((s) => !s.worker_id);
  const waitingOnYou = c.awaiting_review + c.exceptions;
  const companyOpen = c.company_score.total - c.company_score.compliant;

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/contractors', label: 'Contractors' }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.name}
            <StatusChip status={c.status} size="md" />
          </span>
        }
        description={
          <span>
            {c.sponsor && (
              <>
                Subcontractor of{' '}
                <Link href={`/contractors/${c.sponsor.relationship_id}`} className="text-primary hover:underline">
                  {c.sponsor.name}
                </Link>
                {' · '}
              </>
            )}
            {c.trade} · {c.contact.name}
            {c.contact.title ? `, ${c.contact.title}` : ''} · {c.contact.email}
            {c.contact.phone ? ` · ${c.contact.phone}` : ''}
          </span>
        }
        actions={
          <>
            {contactLogin && (
              <Button
                variant="flat"
                startContent={<ArrowRightEndOnRectangleIcon className="h-4 w-4" />}
                onPress={() => signIn({ member_id: contactLogin.member_id }, `/portal/clients/${c.id}`)}
              >
                View as {firstName(contactLogin.name)}
              </Button>
            )}
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button color="primary" endContent={<ChevronDownIcon className="h-4 w-4" />}>
                  Change status
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Change status" disabledKeys={[c.status]} onAction={(k) => setStatusTarget(String(k) as ContractorStatus)}>
                <DropdownItem key="Approved" description="Cleared to work while compliant">
                  Approve
                </DropdownItem>
                <DropdownItem key="Pending" description="Waiting for a decision">
                  Set to Pending
                </DropdownItem>
                <DropdownItem key="Denied" className="text-danger" color="danger" description="Stopped at every gate">
                  Deny
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </>
        }
      />

      <div className="mb-5 space-y-3">
        {c.sponsor && (
          <Callout tone="info" title={`Brought in by ${c.sponsor.name}`}>
            {c.name} works on your sites as {possessive(shortOrg(c.sponsor.name))} subcontractor. It inherits {possessive(shortOrg(c.sponsor.name))} requirements, except ones you keep for direct
            contractors, and {shortOrg(c.sponsor.name)} checks its paperwork before it reaches your queue. Its crew clears your gate only while you approve {shortOrg(c.sponsor.name)},{' '}
            {shortOrg(c.sponsor.name)} approves {shortOrg(c.name)}, and you approve {shortOrg(c.name)}.
          </Callout>
        )}
        {c.status === 'Pending' && c.sponsor && (
          <Callout tone={companyOpen === 0 ? 'good' : 'warn'} title={`${c.sponsor.name} asked you to approve ${c.name} on ${fmtDate(c.profile_submitted_at)}`}>
            <span className="flex flex-wrap items-center justify-between gap-2">
              {companyOpen === 0 ? 'Every company requirement is approved.' : `${plural(companyOpen, 'company requirement')} still to approve.`}
              <Button size="sm" color="success" onPress={() => setStatusTarget('Approved')}>
                Approve subcontractor
              </Button>
            </span>
          </Callout>
        )}
        {c.status === 'New' && (
          <Callout tone="info" title={`Invited ${fmtDate(c.created_at)} by ${c.invited_by}`}>
            They haven't submitted their application yet. {plural(c.open_items, 'item')} on their checklist.
          </Callout>
        )}
        {c.status === 'Pending' && !c.sponsor && companyOpen === 0 && (
          <Callout tone="good" title="Every company requirement is approved">
            <span className="flex flex-wrap items-center justify-between gap-2">
              Application submitted {fmtDate(c.profile_submitted_at)}. This contractor is ready for a decision.
              <Button size="sm" color="success" onPress={() => setStatusTarget('Approved')}>
                Approve contractor
              </Button>
            </span>
          </Callout>
        )}
        {c.status === 'Pending' && !c.sponsor && companyOpen > 0 && (
          <Callout tone="warn" title={`Application submitted ${fmtDate(c.profile_submitted_at)}`}>
            {plural(companyOpen, 'company requirement')} still to approve{c.awaiting_review ? `, ${c.awaiting_review} of them waiting for your review` : ''}.
          </Callout>
        )}
        {c.status === 'Denied' && (
          <Callout tone="bad" title={`Denied ${fmtDate(c.status_changed_at)}`}>
            {c.status_note}
          </Callout>
        )}
        {c.status === 'Approved' && c.expired > 0 && (
          <Callout tone="bad" title={`${plural(c.expired, 'item')} expired`}>
            Workers affected by an expired item are stopped at the gate until it's renewed.
          </Callout>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Company compliance" value={c.company_score.pct === null ? '—' : `${c.company_score.pct}%`} hint={`${c.company_score.compliant} of ${c.company_score.total} scored items`} tone={c.company_score.pct === 100 ? 'good' : 'warn'} />
        <Stat label="Worker compliance" value={c.worker_score.pct === null ? '—' : `${c.worker_score.pct}%`} hint={`${plural(c.worker_count, 'active worker')}`} tone={c.worker_score.pct === null || c.worker_score.pct === 100 ? 'good' : 'warn'} />
        <Stat label="Waiting on the contractor" value={c.open_items} hint="Not started, sent back or renewal due" tone={c.open_items ? 'warn' : 'neutral'} />
        <Stat label="Waiting on you" value={waitingOnYou} hint="Reviews and exception requests" tone={waitingOnYou ? 'info' : 'neutral'} href="/reviews" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="card flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="eyebrow mb-1.5">Requirement groups</p>
            <div className="flex flex-wrap gap-1.5">
              {data.inherited_groups.map((g) => (
                <Chip key={`in-${g.id}`} variant="bordered" color="primary">
                  {g.name} · from {c.sponsor?.name.split(' ')[0]}
                </Chip>
              ))}
              {data.groups.map((g) => (
                <Chip key={g.id} variant="flat">
                  {g.name}
                </Chip>
              ))}
              {!data.groups.length && !data.inherited_groups.length && <span className="text-ink-3">None assigned</span>}
            </div>
          </div>
          <Button size="sm" variant="light" startContent={<PencilSquareIcon className="h-4 w-4" />} onPress={() => setAssign('groups')}>
            Edit
          </Button>
        </div>
        <div className="card flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="eyebrow mb-1.5">Projects & sites</p>
            <div className="flex flex-wrap gap-1.5">
              {data.sites.length ? data.sites.map((s) => <Chip key={s.id} variant="flat" color="primary">{s.name}</Chip>) : <span className="text-ink-3">Not assigned to any site</span>}
            </div>
          </div>
          <Button size="sm" variant="light" startContent={<PencilSquareIcon className="h-4 w-4" />} onPress={() => setAssign('sites')}>
            Edit
          </Button>
        </div>
      </div>

      {data.subcontractors.length > 0 && (
        <Card
          title={`Subcontractors brought in by ${c.name}`}
          subtitle={`${possessive(c.name)} requirements flow down to them, and ${c.name} checks their paperwork before you review it.`}
          bodyClass="p-0"
          className="mb-5"
        >
          <ContractorTable rows={data.subcontractors} />
        </Card>
      )}

      <Card bodyClass="p-0">
        <div className="border-b border-line px-4 pt-2">
          <Tabs aria-label="Contractor sections" variant="underlined" color="primary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as TabKey)} classNames={{ base: 'max-w-full', tabList: 'gap-6 max-w-full overflow-x-auto', tab: 'px-0 h-11 w-auto shrink-0', cursor: 'w-full' }}>
            <Tab key="requirements" title={`Company requirements (${companySlots.length})`} />
            <Tab key="workers" title={`Workers (${data.workers.filter((w) => w.active).length})`} />
            <Tab key="profile" title="Profile" />
            <Tab key="activity" title="Activity & emails" />
          </Tabs>
        </div>

        {tab === 'requirements' && <SlotTable slots={companySlots} onOpen={setReviewId} />}

        {tab === 'workers' && (
          <>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-[13px] text-ink-3">
                The crew {c.name} has put on your work. Each of them gets the worker-level requirements from your groups and sites, and the gate checks these plus the company&apos;s own.
              </p>
              <Button size="sm" color="primary" variant="flat" startContent={<UserPlusIcon className="h-4 w-4" />} onPress={() => setWorkerModal({ open: true, worker: null })}>
                Add worker
              </Button>
            </div>
            {data.workers.length ? (
              <div className="table-scroll border-t border-line">
                <table className="data-table min-w-[860px]">
                  <thead>
                    <tr>
                      <th className="w-8" />
                      <th>Worker</th>
                      <th>Badge</th>
                      <th>Compliance</th>
                      <th>At the gate</th>
                      <th>Open items</th>
                      <th className="w-40" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.workers.map((w) => {
                      const open = w.slots.filter((s) => s.needs_action).length;
                      const isOpen = !!expanded[w.id];
                      return (
                        <Fragment key={w.id}>
                          <tr className={w.active ? '' : 'opacity-55'}>
                            <td>
                              {w.slots.length > 0 && (
                                <button type="button" aria-label={isOpen ? `Hide ${w.name}'s items` : `Show ${w.name}'s items`} onClick={() => setExpanded((e) => ({ ...e, [w.id]: !isOpen }))} className="rounded p-1 text-ink-3 hover:bg-gray-100">
                                  <ChevronRightIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                                </button>
                              )}
                            </td>
                            <td>
                              <p className="font-medium text-ink">{w.name}</p>
                              <p className="text-[12px] text-ink-3">
                                {w.trade}
                                {w.email ? ` · ${w.email}` : ''}
                              </p>
                            </td>
                            <td className="tabular text-ink-2">{w.badge_id}</td>
                            <td>{w.active ? <ScoreBar score={w.score} /> : <span className="text-ink-3">Inactive</span>}</td>
                            <td>
                              {!w.active ? (
                                <Chip size="sm" variant="flat">
                                  Inactive
                                </Chip>
                              ) : w.clear && c.status === 'Approved' && companyOpen === 0 ? (
                                <Chip size="sm" variant="flat" color="success">
                                  Clear
                                </Chip>
                              ) : (
                                <Chip size="sm" variant="flat" color="danger">
                                  Blocked
                                </Chip>
                              )}
                            </td>
                            <td className="text-ink-2">{open ? plural(open, 'item') : '—'}</td>
                            <td className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="light" onPress={() => setWorkerModal({ open: true, worker: w })}>
                                  Edit
                                </Button>
                                <Button size="sm" variant="light" color="danger" onPress={() => setOffCrew(w)}>
                                  Remove from crew
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={7} className="bg-[#FAFAFD] p-0">
                                <div className="px-6 py-2">
                                  <SlotTable slots={w.slots} onOpen={setReviewId} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No one on the crew yet" body={`${c.name} chooses which of their workers come to your sites. You can also add someone for them.`} />
            )}
          </>
        )}

        {tab === 'profile' && (
          <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
            <p className="text-[13px] text-ink-3 lg:col-span-2">
              {c.name} keeps this profile up to date on EZForm. Every company they work for sees the same details; only the tags and history are yours.
            </p>
            <div>
              <p className="eyebrow mb-3">Company</p>
              <KV
                items={[
                  ['Legal name', c.name],
                  ['Trade', c.trade || '—'],
                  ['Address', c.address || <span className="text-ink-3">Not provided yet</span>],
                  ['Website', c.website || '—'],
                  ['Licence number', c.license_no || '—'],
                  ['Employees', c.employees_count ?? '—'],
                  ['Tags', c.tags.length ? c.tags.join(', ') : '—'],
                ]}
              />
            </div>
            <div>
              <p className="eyebrow mb-3">Main contact & history</p>
              <KV
                items={[
                  ['Contact', `${c.contact.name}${c.contact.title ? `, ${c.contact.title}` : ''}`],
                  ['Email', c.contact.email],
                  ['Phone', c.contact.phone || '—'],
                  ['Invited', `${fmtDate(c.created_at)} by ${c.invited_by}`],
                  ['Application', c.profile_submitted_at ? `Submitted ${fmtDate(c.profile_submitted_at)}` : 'Not submitted'],
                  ['Status', `${c.status}${c.status_changed_at ? ` since ${fmtDate(c.status_changed_at)}` : ''}`],
                  ...(c.status_note ? ([['Status note', c.status_note]] as [string, string][]) : []),
                ]}
              />
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="border-b border-line lg:border-b-0 lg:border-r">
              <p className="eyebrow px-4 pb-1 pt-4">Activity</p>
              <ActivityFeed events={data.activity} now={now} max="max-h-[480px]" />
            </div>
            <div>
              <p className="eyebrow px-4 pb-1 pt-4">Emails</p>
              {data.emails.length ? (
                <ul className="max-h-[480px] divide-y divide-line overflow-y-auto">
                  {data.emails.map((e) => (
                    <li key={e.id} className="px-4 py-2.5">
                      <details>
                        <summary className="cursor-pointer list-none">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-medium text-ink">{e.subject}</span>
                            <span className="shrink-0 text-[11.5px] text-ink-3">{timeAgo(e.at, now)}</span>
                          </span>
                          <span className="text-[12px] text-ink-3">
                            To {e.to_name} · {fmtDateTime(e.at)}
                          </span>
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-[12.5px] text-ink-2">{e.body}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No emails yet" />
              )}
            </div>
          </div>
        )}
      </Card>

      <ReviewModal assignmentId={reviewId} onClose={() => setReviewId(null)} />
      <StatusModal contractor={c} target={statusTarget} onClose={() => setStatusTarget(null)} />
      <AssignModal contractor={c} kind={assign} onClose={() => setAssign(null)} allowedSiteIds={data.sponsor_site_ids} />
      <WorkerModal isOpen={workerModal.open} worker={workerModal.worker} relationshipId={c.id} onClose={() => setWorkerModal({ open: false, worker: null })} />
      <ConfirmModal
        isOpen={!!offCrew}
        title={`Remove ${offCrew?.name} from your crew?`}
        body={`Their badge stops working at your sites and their items drop out of ${possessive(c.name)} score with you. They stay on ${possessive(c.name)} roster, and their records come back if they rejoin.`}
        action="Remove from crew"
        color="danger"
        busy={removeFromCrew.isPending}
        onClose={() => setOffCrew(null)}
        onConfirm={() => offCrew && removeFromCrew.mutate(offCrew, { onSuccess: () => setOffCrew(null) })}
      />
    </>
  );
}
