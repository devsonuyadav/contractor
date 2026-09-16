'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Chip, Spinner } from '@heroui/react';
import { BuildingOffice2Icon, CheckCircleIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import AddClientModal from '@/components/portal/AddClientModal';
import ChecklistRow, { sortByUrgency } from '@/components/portal/ChecklistRow';
import { Card, EmptyState, PageHeader, ScoreBar, Stat, StatusChip } from '@/components/ui';
import { plural, possessive } from '@/lib/describe';
import { usePortalOverview, useSessionContext } from '@/services/queries';

/** The contractor side of a company: every client it works for, and everything they need from it. */
export default function PortalOverviewPage() {
  const { data, isLoading } = usePortalOverview();
  const { data: ctx } = useSessionContext();
  const [adding, setAdding] = useState(false);
  const addButton = (
    <Button color="primary" variant="flat" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setAdding(true)}>
      Add a client
    </Button>
  );

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }

  const { org, clients } = data;
  const action = sortByUrgency(data.action);
  const approved = clients.filter((c) => c.status === 'Approved').length;
  const waiting = clients.reduce((n, c) => n + c.waiting_on_client, 0);
  const expired = clients.reduce((n, c) => n + c.expired, 0);

  if (!clients.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="My compliance" description={`What the companies ${org.name} works for need from you. Nothing yet.`} actions={addButton} />
        <Card>
          <EmptyState
            icon={BuildingOffice2Icon}
            title="No clients yet"
            body="A company on EZForm that adds you as its contractor appears here by itself. For a client that doesn't use EZForm, add it yourself and keep its paperwork here."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {addButton}
                {ctx && !ctx.program.enabled && (
                  <Button as={Link} href="/setup" variant="flat">
                    Manage your own contractors
                  </Button>
                )}
              </div>
            }
          />
        </Card>
        <AddClientModal isOpen={adding} onClose={() => setAdding(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My compliance"
        description={`What ${clients.length === 1 ? 'the company you work for needs' : `the ${clients.length} companies you work for need`} from ${org.name}. Your profile, workers and documents are shared across all of them; each one keeps its own checklist. Clients that don't use EZForm you add and keep yourself.`}
        actions={addButton}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Clients" value={clients.length} hint={`${approved} approved you to work`} />
        <Stat label="Needs your action" value={action.length} hint={action.length ? 'Across every client' : "You're all caught up"} tone={action.length ? 'warn' : 'good'} />
        <Stat label="Waiting on clients" value={waiting} hint="Submissions and exception requests" tone="info" />
        <Stat label="Expired" value={expired} hint={expired ? 'Crews are stopped at those gates' : 'Nothing has lapsed'} tone={expired ? 'bad' : 'good'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/portal/clients/${c.id}`}
            className="card group flex flex-col gap-3 p-4 transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-50 text-[13px] font-semibold text-primary">{c.client.short}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">{c.client.name}</p>
                {c.sponsor_name && <p className="truncate text-[12.5px] text-primary-700">As {possessive(c.sponsor_name)} subcontractor</p>}
                <p className="truncate text-[12.5px] text-ink-3">
                  {c.self_managed ? 'Your own list · nobody reviews it' : c.site_names.length ? c.site_names.join(', ') : 'No sites assigned yet'}
                </p>
              </div>
              {c.self_managed ? (
                <Chip size="sm" variant="flat" color="secondary" className="font-medium">
                  Tracked by you
                </Chip>
              ) : (
                <StatusChip status={c.status} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12.5px]">
              <div>
                <p className="mb-1 text-ink-3">Company</p>
                <ScoreBar score={c.company_score} />
              </div>
              <div>
                <p className="mb-1 text-ink-3">Crew of {c.crew}</p>
                <ScoreBar score={c.worker_score} />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-3 text-[13px]">
              <span className={c.open_items ? 'font-medium text-ink' : 'text-ink-3'}>
                {c.status === 'New' && !c.self_managed ? 'Application not sent · ' : ''}
                {c.open_items ? `${plural(c.open_items, 'item')} to do` : 'Nothing to do'}
                {c.subcontractors ? ` · ${plural(c.subcontractors, 'subcontractor')}` : ''}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-primary">
                Open checklist <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <AddClientModal isOpen={adding} onClose={() => setAdding(false)} />

      <Card title="Needs your action, every client" subtitle={action.length ? plural(action.length, 'item') : undefined} bodyClass="p-0">
        {action.length ? (
          <ul className="divide-y divide-line">
            {action.map((s) => (
              <ChecklistRow key={s.id} slot={s} showClient />
            ))}
          </ul>
        ) : (
          <EmptyState icon={CheckCircleIcon} title="You're all caught up" body="Nothing needs your attention for any client. We'll email you 30 days before anything expires." />
        )}
      </Card>
    </div>
  );
}
