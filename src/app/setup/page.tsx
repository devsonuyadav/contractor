'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button, Spinner } from '@heroui/react';
import { BuildingOffice2Icon, ClipboardDocumentListIcon, InboxStackIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Card, PageHeader } from '@/components/ui';
import { listNames, plural } from '@/lib/describe';
import { Api, useAction, useSessionContext } from '@/services/queries';

const STEPS = [
  { icon: ClipboardDocumentListIcon, title: 'Your own requirements', body: 'Start from a starter library (insurance, safety rules, orientation) and edit it, or build requirements from scratch.' },
  { icon: BuildingOffice2Icon, title: 'Invite your subcontractors', body: "Companies already on EZForm come with their profile and workers. Everyone else gets an invitation." },
  { icon: InboxStackIcon, title: 'Review what they send', body: 'Approve certificates and forms, grant exceptions, and get reminded before anything expires.' },
  { icon: ShieldCheckIcon, title: 'Check them in at your jobs', body: 'Badge scans at your projects check the subcontractor and the worker in one go.' },
];

/** Turns on the client side for a company that so far only works for others. */
export default function SetupPage() {
  const { data: ctx } = useSessionContext();
  const router = useRouter();
  const enable = useAction(() => Api.enableProgram(), (r) => `Program started with ${plural(r.requirements, 'starter requirement')}`);

  // Once the program exists, go edit the starter library (or to the overview if it was already on).
  useEffect(() => {
    if (ctx?.program.enabled) router.replace(enable.isSuccess ? '/requirements' : '/dashboard');
  }, [ctx, router, enable.isSuccess]);

  if (!ctx || ctx.program.enabled) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }

  const clients = ctx.clients.map((c) => c.client.name);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Manage your own contractors"
        description={
          clients.length
            ? `${ctx.org.name} already works as a contractor for ${listNames(clients)}. You can also run a program for the subcontractors you bring in, from the same account. Nothing about your client checklists changes.`
            : `Run a compliance program for the subcontractors ${ctx.org.name} brings in.`
        }
      />
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
          <Button color="primary" isLoading={enable.isPending} onPress={() => enable.mutate(undefined)}>
            Start my contractor program
          </Button>
        </div>
      </Card>
    </div>
  );
}
