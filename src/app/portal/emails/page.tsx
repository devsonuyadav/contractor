'use client';

import { useMemo, useState } from 'react';
import { Chip, Select, SelectItem, Spinner } from '@heroui/react';
import { ChevronDownIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { fmtDateTime } from '@/lib/dates';
import type { ChipColor } from '@/lib/describe';
import type { EmailKind } from '@/lib/types';
import { useInbox, usePortalOverview } from '@/services/queries';

const KIND: Record<EmailKind, { label: string; color: ChipColor }> = {
  INVITE: { label: 'Invitation', color: 'primary' },
  REMINDER_30: { label: 'Renewal reminder', color: 'warning' },
  REMINDER_7: { label: 'Final reminder', color: 'warning' },
  EXPIRED: { label: 'Expired', color: 'danger' },
  SUBMITTED: { label: 'Submitted', color: 'default' },
  APPROVED: { label: 'Approved', color: 'success' },
  REJECTED: { label: 'Action needed', color: 'danger' },
  EXCEPTION: { label: 'Exception', color: 'secondary' },
  STATUS: { label: 'Status', color: 'primary' },
  APPLICATION: { label: 'Application', color: 'default' },
};

export default function PortalEmails() {
  const { data, isLoading } = useInbox();
  const { data: overview } = usePortalOverview();
  const [open, setOpen] = useState<string | null>(null);
  const [client, setClient] = useState('all');
  const emails = useMemo(() => (data ?? []).filter((e) => client === 'all' || e.client_id === client), [data, client]);

  if (isLoading || !data || !overview) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }

  const clients = overview.clients;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description={`Messages your clients sent to ${overview.org.contact.email}: invitations, reminders and review decisions. In the demo, nothing leaves your browser.`}
      />
      <Card bodyClass="p-0">
        {clients.length > 1 && (
          <div className="flex items-center gap-3 border-b border-line p-4">
            <Select
              id="inbox-client"
              aria-label="Client"
              variant="bordered"
              className="w-full sm:w-64"
              selectedKeys={[client]}
              onSelectionChange={(keys) => setClient(keys === 'all' ? 'all' : String(Array.from(keys)[0] ?? 'all'))}
            >
              {[{ key: 'all', label: 'All clients' }, ...clients.map((c) => ({ key: c.client.id, label: c.client.name }))].map((o) => (
                <SelectItem key={o.key}>{o.label}</SelectItem>
              ))}
            </Select>
            <span className="ml-auto text-[12.5px] text-ink-3">{emails.length} emails</span>
          </div>
        )}
        {emails.length ? (
          <ul className="divide-y divide-line">
            {emails.map((e) => {
              const isOpen = open === e.id;
              const kind = KIND[e.kind];
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : e.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <EnvelopeIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{e.subject}</p>
                      <p className="text-[12px] text-ink-3">
                        From {e.client_name} · {fmtDateTime(e.at)} · to {e.to_name}
                      </p>
                    </div>
                    <Chip size="sm" variant="flat" color={kind.color} className="hidden shrink-0 sm:inline-flex">
                      {kind.label}
                    </Chip>
                    <ChevronDownIcon className={`mt-0.5 h-4 w-4 shrink-0 text-ink-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:pl-12">
                      <p className="whitespace-pre-wrap rounded-lg border border-line bg-[#FAFAFD] p-4 text-[13.5px] leading-relaxed text-ink-2">{e.body}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={EnvelopeIcon} title="No emails yet" body="When a client invites you, reminds you about a renewal or reviews a submission, the email shows up here." />
        )}
      </Card>
    </div>
  );
}
