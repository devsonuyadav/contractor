'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button, Spinner } from '@heroui/react';
import { BuildingOffice2Icon, ClipboardDocumentListIcon, ClockIcon, InboxStackIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Callout, Card, PageHeader } from '@/components/ui';
import { fmtDate } from '@/lib/dates';
import { listNames } from '@/lib/describe';
import { Api, useAction, useSessionContext } from '@/services/queries';

const STEPS = [
  { icon: ClipboardDocumentListIcon, title: 'Your own requirements', body: 'Start from a starter library (insurance, safety rules, orientation) and edit it, or build requirements from scratch.' },
  { icon: BuildingOffice2Icon, title: 'Invite your subcontractors', body: 'Companies already on EZForm come with their profile and workers. Everyone else gets an invitation.' },
  { icon: InboxStackIcon, title: 'Review what they send', body: 'Approve certificates and forms, grant exceptions, and get reminded before anything expires.' },
  { icon: ShieldCheckIcon, title: 'Check them in at your jobs', body: 'Badge scans at your projects check the subcontractor and the worker in one go.' },
];

/** Managing your own contractors is a paid feature: ask EHSSoftware.io to turn it on. */
export default function SetupPage() {
  const { data: ctx } = useSessionContext();
  const router = useRouter();
  const request = useAction(() => Api.requestSubscription(), 'Sent to EHSSoftware.io');

  // Once EHSSoftware.io turns it on, the program screens appear.
  useEffect(() => {
    if (ctx?.program.enabled) router.replace('/dashboard');
  }, [ctx, router]);

  if (!ctx || ctx.program.enabled) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }

  const clients = ctx.clients.map((c) => c.client.name);
  const pending = ctx.program.subscription === 'REQUESTED';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Manage your own contractors"
        description={
          clients.length
            ? `${ctx.org.name} already works as a contractor for ${listNames(clients)}. From the same account you can run your own program for the subcontractors you bring in. Nothing about your client checklists changes.`
            : `Run a compliance program for the subcontractors ${ctx.org.name} brings in.`
        }
      />

      {pending ? (
        <Callout tone="warn" title="Waiting for EHSSoftware.io">
          Asked on {fmtDate(ctx.org.subscription_requested_at)}
          {ctx.org.subscription_requested_by ? ` by ${ctx.org.subscription_requested_by}` : ''}. We'll turn it on once your subscription is set up, and these screens appear straight away.
        </Callout>
      ) : (
        <Callout title="This part needs a subscription">
          Working as a contractor for your clients is free: they pay for it. Managing your own contractors is part of a paid EHSSoftware.io plan.
        </Callout>
      )}

      <Card bodyClass="p-0">
        <ul className="divide-y divide-line">
          {STEPS.map((s) => (
            <li key={s.title} className="flex gap-4 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary">
                <s.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-medium text-ink">{s.title}</span>
                <span className="block text-[13px] text-ink-2">{s.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <p className="text-[12.5px] text-ink-3">Your company profile, workers and client checklists stay exactly as they are.</p>
          {pending ? (
            <Button isDisabled variant="flat" startContent={<ClockIcon className="h-4 w-4" />}>
              Waiting for EHSSoftware.io
            </Button>
          ) : (
            <Button color="primary" isLoading={request.isPending} onPress={() => request.mutate(undefined)}>
              Request access
            </Button>
          )}
        </div>
      </Card>

      <p className="text-center text-[12.5px] text-ink-3">
        In the demo, sign in as Sam Rivera (EHSSoftware.io) to turn a subscription on.
      </p>
    </div>
  );
}
