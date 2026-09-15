'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button, Chip, Input, Select, SelectItem, Spinner } from '@heroui/react';
import { CheckCircleIcon, QrCodeIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { dayKey, fmtShort, fmtTime } from '@/lib/dates';
import type { GateResult } from '@/lib/types';
import { Api, useAction, useClock, useGateLog, useGateRoster, useSites } from '@/services/queries';

export default function GatePage() {
  const { data: sites } = useSites();
  const { data: clock } = useClock();
  const [siteId, setSiteId] = useState<string>('');
  const [badge, setBadge] = useState('');
  const [result, setResult] = useState<GateResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const roster = useGateRoster(siteId || undefined);
  const log = useGateLog(siteId || undefined);

  useEffect(() => {
    if (siteId || !sites?.length) return;
    const fromUrl = new URLSearchParams(window.location.search).get('site');
    setSiteId(sites.some((s) => s.id === fromUrl) ? fromUrl! : sites[0].id);
  }, [sites, siteId]);

  const check = useAction((b: string) => Api.gateCheckIn({ site_id: siteId, badge_id: b }));
  const scan = (b: string) => {
    if (!b.trim() || !siteId) return;
    check.mutate(b, {
      onSuccess: (r) => {
        setResult(r);
        setBadge('');
        inputRef.current?.focus();
      },
    });
  };

  const site = sites?.find((s) => s.id === siteId);

  return (
    <>
      <PageHeader
        title="Gate check-in"
        description="Scan a badge to check the worker, their company and this site in one go. In EZForm this is the Scan User field on the site sign-in form; here you can type a badge ID or tap a name to simulate a scan."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card>
            <form
              className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)_auto] md:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                scan(badge);
              }}
            >
              <Select
                id="gate-site"
                label="Site"
                labelPlacement="outside"
                variant="bordered"
                selectedKeys={siteId ? [siteId] : []}
                onSelectionChange={(keys) => {
                  setSiteId(keys === 'all' ? '' : String(Array.from(keys)[0] ?? ''));
                  setResult(null);
                }}
              >
                {(sites ?? []).map((s) => (
                  <SelectItem key={s.id}>{s.name}</SelectItem>
                ))}
              </Select>
              <Input
                id="gate-badge"
                ref={inputRef}
                label="Badge ID"
                labelPlacement="outside"
                placeholder="Scan or type, e.g. ORT-1002"
                variant="bordered"
                autoFocus
                startContent={<QrCodeIcon className="h-4 w-4 text-ink-3" />}
                value={badge}
                onValueChange={setBadge}
              />
              <Button type="submit" color="primary" isLoading={check.isPending} isDisabled={!badge.trim() || !siteId}>
                Check in
              </Button>
            </form>
          </Card>

          {result ? (
            <div
              role="status"
              className={`overflow-hidden rounded-xl border-2 ${result.result === 'CLEAR' ? 'border-success bg-success-50' : 'border-danger bg-danger-50'}`}
            >
              <div className="flex items-center gap-4 p-5">
                {result.result === 'CLEAR' ? <CheckCircleIcon className="h-14 w-14 shrink-0 text-success" /> : <XCircleIcon className="h-14 w-14 shrink-0 text-danger" />}
                <div className="min-w-0">
                  <p className={`text-[26px] font-bold leading-tight ${result.result === 'CLEAR' ? 'text-success-700' : 'text-danger-700'}`}>
                    {result.result === 'CLEAR' ? 'Clear to enter' : 'Stop: not cleared'}
                  </p>
                  <p className="text-[15px] text-ink">
                    {result.worker ? result.worker.name : `Badge ${result.checkin.badge_id}`}
                    {result.contractor ? (
                      <>
                        {' · '}
                        <Link href={`/contractors/${result.contractor.id}`} className="text-primary hover:underline">
                          {result.contractor.name}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <p className="text-[12.5px] text-ink-3">
                    {result.site.name} · {fmtTime(result.checkin.at)} · badge {result.checkin.badge_id}
                  </p>
                </div>
              </div>
              {result.reasons.length > 0 && (
                <ul className="space-y-1 border-t border-danger-200 bg-white/70 px-5 py-3 text-[13.5px] text-danger-800">
                  {result.reasons.map((r) => (
                    <li key={r} className="flex gap-2">
                      <span aria-hidden>•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="card grid place-items-center px-6 py-12 text-center text-ink-3">
              <QrCodeIcon className="mb-2 h-10 w-10" />
              <p>Scan a badge to see if the worker can come in.</p>
            </div>
          )}

          <Card title="Check-ins at this site" subtitle="Latest first" bodyClass="p-0">
            {log.isLoading ? (
              <div className="grid place-items-center py-10">
                <Spinner />
              </div>
            ) : log.data?.length ? (
              <div className="table-scroll">
                <table className="data-table min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Worker</th>
                      <th>Result</th>
                      <th>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.data.map((k) => (
                      <tr key={k.id}>
                        <td className="tabular whitespace-nowrap text-ink-2">{clock && dayKey(k.at) === dayKey(clock.today) ? fmtTime(k.at) : `${fmtShort(k.at)}, ${fmtTime(k.at)}`}</td>
                        <td>
                          <p className="text-ink">{k.worker_name ?? k.badge_id}</p>
                          <p className="text-[12px] text-ink-3">{k.contractor_name ?? 'Unknown badge'}</p>
                        </td>
                        <td>
                          <Chip size="sm" variant="flat" color={k.result === 'CLEAR' ? 'success' : 'danger'}>
                            {k.result === 'CLEAR' ? 'Clear' : 'Stopped'}
                          </Chip>
                        </td>
                        <td className="max-w-[360px] text-[12.5px] text-ink-2">{k.reasons.join('; ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No check-ins yet" />
            )}
          </Card>
        </div>

        <Card title="Expected crews" subtitle={site ? `Workers from contractors assigned to ${site.name}. Tap to simulate a scan.` : undefined} bodyClass="p-0">
          {roster.isLoading ? (
            <div className="grid place-items-center py-10">
              <Spinner />
            </div>
          ) : roster.data?.length ? (
            <ul className="max-h-[720px] divide-y divide-line overflow-y-auto">
              {roster.data.map((e) => (
                <li key={e.worker.id}>
                  <button type="button" onClick={() => scan(e.worker.badge_id)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary-50/60">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${e.clear ? 'bg-success' : 'bg-danger'}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-ink">{e.worker.name}</span>
                      <span className="block truncate text-[12px] text-ink-3">
                        {e.contractor.name} · {e.worker.badge_id}
                      </span>
                      {!e.clear && <span className="block truncate text-[12px] text-danger-600">{e.reasons[0]}</span>}
                    </span>
                    <Chip size="sm" variant="flat" color={e.clear ? 'success' : 'danger'}>
                      {e.clear ? 'Clear' : 'Blocked'}
                    </Chip>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No crews expected" body="Assign contractors to this site from their page." />
          )}
        </Card>
      </div>
    </>
  );
}
