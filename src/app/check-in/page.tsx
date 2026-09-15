'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Chip, Input, Spinner } from '@heroui/react';
import { CheckCircleIcon, MagnifyingGlassIcon, NoSymbolIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Card, EmptyState, PageHeader, Stat } from '@/components/ui';
import { useCheckIn } from '@/services/queries';

export default function CheckInPage() {
  const { data } = useCheckIn();
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((r) => !term || [r.person.name, r.person.badge_id, r.contractor.name].some((v) => v.toLowerCase().includes(term)));
  }, [data, q]);
  const allowed = (data ?? []).filter((r) => r.allowed).length;

  return (
    <>
      <PageHeader
        title="Who can work today"
        description="Every person from your contractors. Someone can work only if their company's items and their own items are all done. Search a name or badge number at the gate."
      />
      {!data ? (
        <div className="grid place-items-center py-24">
          <Spinner />
        </div>
      ) : !data.length ? (
        <Card>
          <EmptyState icon={ShieldCheckIcon} title="No contractor people yet" body="Add a contractor, and their people show up here." />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <Stat label="Can work" value={allowed} tone="good" />
            <Stat label="Can't work" value={data.length - allowed} tone="bad" />
          </div>
          <Card bodyClass="p-0">
            <div className="border-b border-line p-4">
              <Input
                id="checkin-search"
                aria-label="Search by name, badge or company"
                placeholder="Name, badge number or company"
                startContent={<MagnifyingGlassIcon className="h-4 w-4 text-ink-3" />}
                variant="bordered"
                value={q}
                onValueChange={setQ}
                className="sm:max-w-sm"
              />
            </div>
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.person.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                  {r.allowed ? <CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-success" /> : <NoSymbolIcon className="mt-0.5 h-6 w-6 shrink-0 text-danger" />}
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="font-medium text-ink">
                      {r.person.name} <span className="font-normal text-ink-3">· {r.person.badge_id}</span>
                    </p>
                    <p className="text-[12.5px] text-ink-3">
                      {r.person.job} ·{' '}
                      <Link href={`/contractors/${r.link_id}`} className="hover:text-primary hover:underline">
                        {r.contractor.name}
                      </Link>
                    </p>
                    {!r.allowed && (
                      <ul className="mt-1 list-disc pl-5 text-[12.5px] text-red-900">
                        {r.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Chip size="sm" variant="flat" color={r.allowed ? 'success' : 'danger'} className="font-medium">
                    {r.allowed ? 'Can work' : "Can't work"}
                  </Chip>
                </li>
              ))}
              {!rows.length && <li className="px-4 py-6 text-center text-ink-3">Nobody matches “{q}”.</li>}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
