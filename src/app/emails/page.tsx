'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chip, Input, Select, SelectItem, Spinner } from '@heroui/react';
import { EnvelopeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { fmtDateTime, timeAgo } from '@/lib/dates';
import type { EmailKind } from '@/lib/types';
import { useClock, useOutbox } from '@/services/queries';

const KIND_LABEL: Record<EmailKind, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'secondary' }> = {
  INVITE: { label: 'Invitation', color: 'primary' },
  REMINDER_30: { label: '30-day reminder', color: 'warning' },
  REMINDER_7: { label: '7-day reminder', color: 'warning' },
  EXPIRED: { label: 'Expired', color: 'danger' },
  SUBMITTED: { label: 'Needs review', color: 'primary' },
  APPROVED: { label: 'Approved', color: 'success' },
  REJECTED: { label: 'Sent back', color: 'danger' },
  EXCEPTION: { label: 'Exception', color: 'secondary' },
  STATUS: { label: 'Status change', color: 'default' },
  APPLICATION: { label: 'Application', color: 'primary' },
};

export default function EmailsPage() {
  const { data, isLoading } = useOutbox();
  const { data: clock } = useClock();
  const [audience, setAudience] = useState<'all' | 'contractor' | 'admin'>('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const now = clock?.today ?? new Date().toISOString();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((e) => (audience === 'all' || e.audience === audience) && (!term || `${e.subject} ${e.to_name} ${e.to}`.toLowerCase().includes(term)));
  }, [data, audience, q]);

  useEffect(() => {
    if (rows.length && !rows.some((r) => r.id === openId)) setOpenId(rows[0].id);
  }, [rows, openId]);

  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Emails & reminders"
        description="Everything the module would send: invitations, review requests, decisions, and the 30-day, 7-day and expiry reminders from the nightly check. In the demo nothing leaves the browser."
      />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <Input
            id="email-search"
            aria-label="Search emails"
            placeholder="Search subject or recipient"
            startContent={<MagnifyingGlassIcon className="h-4 w-4 text-ink-3" />}
            variant="bordered"
            value={q}
            onValueChange={setQ}
            className="w-full sm:max-w-xs"
          />
          <Select
            id="email-audience"
            aria-label="Recipients"
            variant="bordered"
            className="w-full sm:w-56"
            selectedKeys={[audience]}
            onSelectionChange={(keys) => setAudience((keys === 'all' ? 'all' : String(Array.from(keys)[0] ?? 'all')) as typeof audience)}
          >
            <SelectItem key="all">All recipients</SelectItem>
            <SelectItem key="contractor">To contractors</SelectItem>
            <SelectItem key="admin">To your team</SelectItem>
          </Select>
          <span className="ml-auto text-[12.5px] text-ink-3">{rows.length} emails</span>
        </div>
        {isLoading ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : rows.length ? (
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <ul className="max-h-[640px] divide-y divide-line overflow-y-auto border-b border-line md:border-b-0 md:border-r">
              {rows.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(e.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${e.id === openId ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] text-ink-3">To {e.to_name}</span>
                      <span className="shrink-0 text-[11.5px] text-ink-3">{timeAgo(e.at, now)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] font-medium text-ink">{e.subject}</span>
                    <Chip size="sm" variant="flat" color={KIND_LABEL[e.kind].color} className="mt-1">
                      {KIND_LABEL[e.kind].label}
                    </Chip>
                  </button>
                </li>
              ))}
            </ul>
            <article className="min-w-0 p-5">
              {open ? (
                <>
                  <h2 className="text-[17px] font-semibold text-ink">{open.subject}</h2>
                  <p className="mt-1 text-[12.5px] text-ink-3">
                    To {open.to_name} &lt;{open.to}&gt; · {fmtDateTime(open.at)}
                  </p>
                  <div className="mt-4 whitespace-pre-wrap rounded-lg border border-line bg-[#FAFAFD] p-4 text-[13.5px] leading-relaxed text-ink-2">{open.body}</div>
                </>
              ) : (
                <EmptyState icon={EnvelopeIcon} title="Pick an email" />
              )}
            </article>
          </div>
        ) : (
          <EmptyState icon={EnvelopeIcon} title="No emails match" />
        )}
      </Card>
    </>
  );
}
