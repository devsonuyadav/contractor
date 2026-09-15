'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, Chip, Spinner, Tooltip } from '@heroui/react';
import { CheckCircleIcon, ChevronDownIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import ChecklistRow, { sortByUrgency } from '@/components/portal/ChecklistRow';
import CrewModal from '@/components/portal/CrewModal';
import SponsorModal from '@/components/portal/SponsorModal';
import ReviewModal from '@/components/review/ReviewModal';
import { Callout, Card, EmptyState, PageHeader, Stat, StatusChip } from '@/components/ui';
import { firstName, plural, possessive, shortOrg } from '@/lib/describe';
import type { ContractorRow, Score } from '@/lib/types';
import { Api, useAction, useClientChecklist } from '@/services/queries';

function toneFor(pct: number | null): 'neutral' | 'good' | 'warn' | 'bad' | 'info' {
  if (pct === null) return 'neutral';
  if (pct >= 100) return 'good';
  if (pct >= 75) return 'info';
  if (pct >= 50) return 'warn';
  return 'bad';
}

const pctText = (s: Score) => (s.pct === null ? '—' : `${s.pct}%`);

function profileGaps(c: ContractorRow): string[] {
  return [!c.trade.trim() && 'trade', !c.address.trim() && 'business address', !c.contact.phone.trim() && 'contact phone'].filter((x): x is string => !!x);
}

function StatusBanner({ c, client, siteNames }: { c: ContractorRow; client: string; siteNames: string[] }) {
  const apply = useAction(() => Api.submitApplication(c.id), `Application sent to ${client}`);
  // A subcontractor's pending state is explained in the sponsor callout above.
  if (c.sponsor && c.status === 'Pending') return null;
  switch (c.status) {
    case 'New': {
      const gaps = profileGaps(c);
      return (
        <Callout tone="info" title={`Send ${client} your application`}>
          <p>
            {client} can&apos;t approve {c.name} until you apply. They&apos;ll see the company profile you already keep on EZForm
            {gaps.length ? `, which is still missing your ${gaps.join(', ')}` : ''}. You can work through the checklist at the same time.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {gaps.length ? (
              <Button as={Link} href="/portal/profile" size="sm" color="primary">
                Complete your profile
              </Button>
            ) : (
              <Button size="sm" color="primary" isLoading={apply.isPending} onPress={() => apply.mutate(undefined)}>
                Submit application to {client}
              </Button>
            )}
          </div>
        </Callout>
      );
    }
    case 'Pending':
      return (
        <Callout tone="info" title={`Your application is with ${client} for review`}>
          Keep working through the checklist meanwhile. Approval usually follows once the company items are done.
        </Callout>
      );
    case 'Approved':
      return (
        <Callout tone="good" title={`Approved by ${client}`}>
          {siteNames.length
            ? `Your crew can badge in at: ${siteNames.join(', ')}, as long as the items below stay up to date.`
            : `You're approved, but ${client} hasn't assigned you to a site yet.`}
        </Callout>
      );
    case 'Denied':
      return (
        <Callout tone="bad" title={`${client} hasn't approved ${c.name}`}>
          {c.status_note ?? `Contact ${client} to discuss it.`}
        </Callout>
      );
  }
}

export default function ClientChecklistPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : undefined;
  const { data, isLoading, isError } = useClientChecklist(id);
  const [showDone, setShowDone] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [checkId, setCheckId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const slots = data?.slots ?? [];
    const action = sortByUrgency(slots.filter((s) => s.needs_action));
    const waiting = slots
      .filter((s) => !s.needs_action && (s.awaiting_review || s.exception_pending))
      .sort((a, b) => (a.submission.submitted_at ?? a.exception?.requested_at ?? '').localeCompare(b.submission.submitted_at ?? b.exception?.requested_at ?? ''));
    const done = sortByUrgency(slots.filter((s) => !s.needs_action && !s.awaiting_review && !s.exception_pending));
    return { action, waiting, done };
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState
        title="We couldn't find that client"
        body="They may have removed you, or the demo data was reset."
        action={
          <Button as={Link} href="/portal" variant="flat">
            All clients
          </Button>
        }
      />
    );
  }

  const c = data.contractor;
  const client = data.client.name;
  const lapsed = groups.action.filter((s) => s.overdue || s.state === 'EXPIRED').length;
  const companyOk = c.status === 'Approved' && data.slots.filter((s) => !s.worker_id && s.req.scored).every((s) => s.compliant);
  const activeCrew = data.workers.filter((w) => w.active);

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ href: '/portal', label: 'Your clients' }]}
        title={client}
        description={`Hi ${firstName(c.contact.name)}. This is everything ${client} needs from ${c.name} and the crew you send them.`}
        actions={<StatusChip status={c.status} size="md" />}
      />

      {c.sponsor && (
        <Callout tone="info" title={`You're on ${possessive(client)} work as ${possessive(c.sponsor.name)} subcontractor`}>
          {c.status === 'Pending' && `${shortOrg(c.sponsor.name)} has asked ${shortOrg(client)} to approve you; keep working through the checklist meanwhile. `}
          {shortOrg(client)} asks you for what it asks of {shortOrg(c.sponsor.name)}, apart from items it keeps for direct contractors. {shortOrg(c.sponsor.name)} checks what you send before{' '}
          {shortOrg(client)} reviews it, and your crew clears {possessive(shortOrg(client))} gate only while {shortOrg(client)} approves {shortOrg(c.sponsor.name)}, {shortOrg(c.sponsor.name)}{' '}
          approves you, and {shortOrg(client)} approves you.
        </Callout>
      )}

      <StatusBanner c={c} client={client} siteNames={data.sites.map((s) => s.name)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Company compliance"
          value={pctText(c.company_score)}
          hint={c.company_score.total ? `${c.company_score.compliant} of ${c.company_score.total} company items` : 'No company items yet'}
          tone={toneFor(c.company_score.pct)}
        />
        <Stat
          label="Crew compliance"
          value={pctText(c.worker_score)}
          hint={c.worker_count ? `${c.worker_score.compliant} of ${c.worker_score.total} items · ${plural(c.worker_count, 'worker')}` : 'No one on this crew yet'}
          tone={toneFor(c.worker_score.pct)}
        />
        <Stat
          label="Needs your action"
          value={groups.action.length}
          hint={lapsed ? `${lapsed} overdue or expired` : groups.action.length ? 'Start at the top of the list' : "You're all caught up"}
          tone={lapsed ? 'bad' : groups.action.length ? 'warn' : 'good'}
        />
        <Stat label={`Waiting on ${client}`} value={groups.waiting.length} hint={groups.waiting.length ? 'Submissions and exception requests' : 'Nothing waiting'} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card title="Needs your action" subtitle={groups.action.length ? plural(groups.action.length, 'item') : undefined} bodyClass="p-0">
            {groups.action.length ? (
              <ul className="divide-y divide-line">
                {groups.action.map((s) => (
                  <ChecklistRow key={s.id} slot={s} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={CheckCircleIcon} title="You're all caught up" body={`Nothing for ${client} needs your attention right now. We'll email you 30 days before anything expires.`} />
            )}
          </Card>

          <Card title={`Waiting on ${client}`} subtitle={groups.waiting.length ? plural(groups.waiting.length, 'item') : undefined} bodyClass="p-0">
            {groups.waiting.length ? (
              <ul className="divide-y divide-line">
                {groups.waiting.map((s) => (
                  <ChecklistRow key={s.id} slot={s} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={ClockIcon} title={`Nothing is waiting on ${client}`} body="When you submit something that needs review, it shows up here until it's approved." />
            )}
          </Card>

          <Card
            title="Done"
            subtitle={plural(groups.done.length, 'item')}
            bodyClass="p-0"
            actions={
              groups.done.length ? (
                <Button
                  size="sm"
                  variant="light"
                  aria-expanded={showDone}
                  onPress={() => setShowDone((v) => !v)}
                  endContent={<ChevronDownIcon className={`h-4 w-4 transition-transform ${showDone ? 'rotate-180' : ''}`} />}
                >
                  {showDone ? 'Hide' : 'Show'}
                </Button>
              ) : undefined
            }
          >
            {showDone && groups.done.length ? (
              <ul className="divide-y divide-line">
                {groups.done.map((s) => (
                  <ChecklistRow key={s.id} slot={s} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-[13px] text-ink-3">
                {groups.done.length ? 'Approved items and exceptions. Open the list to check expiry dates.' : 'Nothing approved yet.'}
              </p>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card
            title={`Crew for ${client}`}
            subtitle={plural(activeCrew.length, 'worker')}
            bodyClass="p-0"
            actions={
              <Button size="sm" variant="flat" color="primary" onPress={() => setCrewOpen(true)}>
                Choose crew
              </Button>
            }
          >
            {activeCrew.length ? (
              <ul className="divide-y divide-line">
                {activeCrew.map((w) => {
                  const missing = w.slots.filter((s) => s.req.scored && !s.compliant).map((s) => s.req.title);
                  const clear = companyOk && missing.length === 0;
                  const why = clear
                    ? `Can badge in at ${possessive(client)} sites you're assigned to.`
                    : !companyOk
                      ? c.status !== 'Approved'
                        ? `${client} hasn't approved ${c.name} yet.`
                        : 'A company item is out of date, so the whole crew is stopped.'
                      : `Still needed: ${missing.join(', ')}`;
                  return (
                    <li key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink">{w.name}</p>
                        <p className="truncate text-[12px] text-ink-3">
                          {w.trade} · {w.badge_id}
                        </p>
                      </div>
                      <Tooltip content={why} delay={200}>
                        <Chip size="sm" variant="flat" color={clear ? 'success' : 'danger'} className="font-medium">
                          {clear ? 'Clear' : 'Blocked'}
                        </Chip>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={UserGroupIcon} title="No one on this crew" body={`Pick who from your roster works on ${client} jobs. Worker requirements only go to them.`} />
            )}
            <p className="border-t border-line px-4 py-2.5 text-[12px] text-ink-3">
              Workers live on your{' '}
              <Link href="/portal/workers" className="text-primary hover:underline">
                company roster
              </Link>
              , so one badge works for every client.
            </p>
          </Card>

          {!c.sponsor && (
            <Card
              title="Your subcontractors here"
              subtitle={data.subcontractors.length ? `${plural(data.subcontractors.length, 'company', 'companies')} on ${possessive(client)} work` : undefined}
              bodyClass="p-0"
              actions={
                <Button size="sm" variant="flat" color="primary" onPress={() => setSponsorOpen(true)} isDisabled={c.status === 'Denied'}>
                  Bring one in
                </Button>
              }
            >
              {data.subcontractors.length ? (
                <ul className="divide-y divide-line">
                  {data.subcontractors.map((sc) => {
                    const checks = data.sponsor_checks.filter((s) => s.relationship_id === sc.id);
                    return (
                      <li key={sc.id} className="space-y-2 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{sc.name}</p>
                          <StatusChip status={sc.status} />
                        </div>
                        <p className="text-[12px] text-ink-3">
                          Company {sc.company_score.pct ?? 0}% · crew of {sc.worker_count} · {sc.site_names.join(', ') || 'no sites'}
                        </p>
                        {checks.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setCheckId(s.id)}
                            className="flex w-full items-center gap-2 rounded-lg border border-primary-200 bg-primary-50/60 px-2.5 py-1.5 text-left text-[12.5px] hover:bg-primary-50"
                          >
                            <span className="min-w-0 flex-1 truncate text-ink">{s.worker_name ? `${s.req.title} · ${s.worker_name}` : s.req.title}</span>
                            <span className="shrink-0 font-medium text-primary">Check</span>
                          </button>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-3 text-[13px] text-ink-3">
                  Bringing a subcontractor onto this work? Add them from your own program. {possessive(client)} requirements flow down to them, and you check their paperwork first.
                </p>
              )}
            </Card>
          )}

          <Card title="Sites" bodyClass="p-0">
            {data.sites.length ? (
              <ul className="divide-y divide-line">
                {data.sites.map((s) => (
                  <li key={s.id} className="px-4 py-2.5">
                    <p className="text-[13.5px] font-medium text-ink">{s.name}</p>
                    <p className="text-[12px] text-ink-3">
                      {s.code}
                      {s.address ? ` · ${s.address}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-[13px] text-ink-3">{client} hasn&apos;t assigned you to a site yet.</p>
            )}
          </Card>
        </aside>
      </div>

      {id && <CrewModal isOpen={crewOpen} onClose={() => setCrewOpen(false)} relationshipId={id} clientName={client} />}
      {id && !c.sponsor && <SponsorModal isOpen={sponsorOpen} onClose={() => setSponsorOpen(false)} relationshipId={id} clientName={client} sites={data.sites} />}
      <ReviewModal assignmentId={checkId} onClose={() => setCheckId(null)} />
    </div>
  );
}
