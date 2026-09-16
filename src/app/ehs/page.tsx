'use client';

import { Button, Chip, Spinner } from '@heroui/react';
import { CheckIcon } from '@heroicons/react/24/outline';
import { Card, EmptyState, PageHeader, Stat } from '@/components/ui';
import { fmtDate } from '@/lib/dates';
import { plural } from '@/lib/describe';
import type { EhsAccount, SubscriptionStatus } from '@/lib/types';
import { Api, useAction, useEhsAccounts } from '@/services/queries';

const META: Record<SubscriptionStatus, { label: string; color: 'success' | 'warning' | 'default' }> = {
  ACTIVE: { label: 'Subscribed', color: 'success' },
  REQUESTED: { label: 'Asked for access', color: 'warning' },
  NONE: { label: 'Contractor only', color: 'default' },
};

function When({ a }: { a: EhsAccount }) {
  if (a.subscription === 'ACTIVE') return <>Since {fmtDate(a.since)}</>;
  if (a.subscription === 'REQUESTED') return <>Asked {fmtDate(a.requested_at)}{a.requested_by ? ` by ${a.requested_by}` : ''}</>;
  return <span className="text-ink-3">—</span>;
}

/** EHSSoftware.io staff decide which customers can manage their own contractors. */
export default function EhsPage() {
  const { data, isLoading } = useEhsAccounts();
  const set = useAction(Api.setSubscription, (res, vars) =>
    vars.active ? `Turned on${res.requirements ? ` with ${plural(res.requirements, 'starter requirement')}` : ''}` : 'Turned off',
  );
  const busy = (id: string) => set.isPending && set.variables?.org_id === id;
  const waiting = data?.filter((a) => a.subscription === 'REQUESTED').length ?? 0;
  const active = data?.filter((a) => a.subscription === 'ACTIVE').length ?? 0;

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Every company on EZForm. Working as a contractor is free; managing your own contractors needs a subscription, which you turn on here."
      />
      <div className="mb-5 grid grid-cols-2 gap-4 sm:max-w-lg">
        <Stat label="Waiting for you" value={waiting} tone={waiting ? 'warn' : 'neutral'} />
        <Stat label="Subscribed" value={active} tone="good" />
      </div>
      <Card bodyClass="p-0">
        {isLoading || !data ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : !data.length ? (
          <EmptyState title="No companies yet" />
        ) : (
          <div className="table-scroll">
            <table className="data-table min-w-[860px]">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Since / asked</th>
                  <th>Using EZForm for</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id} className={a.subscription === 'REQUESTED' ? 'bg-amber-50/50' : undefined}>
                    <td>
                      <p className="font-medium text-ink">{a.name}</p>
                      <p className="text-[12px] text-ink-3">
                        {a.trade} · {a.contact.name} · {a.contact.email}
                      </p>
                    </td>
                    <td>
                      <Chip size="sm" variant="flat" color={META[a.subscription].color} className="font-medium">
                        {META[a.subscription].label}
                      </Chip>
                    </td>
                    <td className="text-[12.5px] text-ink-2">
                      <When a={a} />
                    </td>
                    <td className="text-[12.5px] text-ink-2">
                      {[a.contractors ? plural(a.contractors, 'contractor') : '', a.clients ? `works for ${plural(a.clients, 'client')}` : '', a.workers ? plural(a.workers, 'worker') : '']
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        {a.subscription === 'ACTIVE' ? (
                          <Button size="sm" variant="light" color="danger" isLoading={busy(a.id)} onPress={() => set.mutate({ org_id: a.id, active: false })}>
                            Turn off
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            color="primary"
                            variant={a.subscription === 'REQUESTED' ? 'solid' : 'flat'}
                            startContent={<CheckIcon className="h-4 w-4" />}
                            isLoading={busy(a.id)}
                            onPress={() => set.mutate({ org_id: a.id, active: true })}
                          >
                            {a.subscription === 'REQUESTED' ? 'Approve' : 'Turn on'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
