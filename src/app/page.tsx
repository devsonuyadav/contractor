'use client';

import Link from 'next/link';
import { Button, Spinner } from '@heroui/react';
import { BriefcaseIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
import { Card, EmptyState, PageHeader, StateChip } from '@/components/ui';
import { fmtDate } from '@/lib/dates';
import { itemLabel, itemWhen } from '@/lib/describe';
import type { Item } from '@/lib/types';
import { useHome, useSessionContext } from '@/services/queries';

const SHOW = 5;

function ItemList({ title, items, names, hrefBase, empty, review = false }: { title: string; items: Item[]; names: Record<string, string>; hrefBase: string; empty: string; review?: boolean }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">
        {title} {items.length ? `(${items.length})` : ''}
      </p>
      {items.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {items.slice(0, SHOW).map((i) => (
            <li key={i.key}>
              <Link href={`${hrefBase}/${i.link_id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 transition-colors hover:bg-primary-50/60">
                <span className="min-w-0 flex-1 basis-52">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{itemLabel(i)}</span>
                  <span className="block truncate text-[12px] text-ink-3">
                    {[names[i.link_id], review ? `Uploaded ${fmtDate(i.pending?.uploaded_at)}${i.ok ? ' · new copy' : ''}` : itemWhen(i)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <StateChip state={review ? 'WAITING' : i.state} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[13px] text-ink-3">{empty}</p>
      )}
      {items.length > SHOW && <p className="mt-1.5 text-[12px] text-ink-3">and {items.length - SHOW} more</p>}
    </div>
  );
}

function Summary({ good, total, word }: { good: number; total: number; word: string }) {
  return (
    <p className="text-[13.5px] text-ink-2">
      <span className="tabular text-[22px] font-semibold text-ink">{good}</span> of {total} {word} have everything in place
    </p>
  );
}

export default function HomePage() {
  const { data: ctx } = useSessionContext();
  const { data } = useHome();
  if (!data || !ctx) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }
  const { contractors, clients, names } = data;

  return (
    <>
      <PageHeader
        title={`Hi ${ctx.user.name.split(' ')[0]}`}
        description={`${data.company.name} can work both ways: other companies work for you, and you work for other companies.`}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          title={
            <span className="flex items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 text-ink-3" />
              My contractors
            </span>
          }
          subtitle="Companies that work for you. You approve what they upload."
          actions={
            <Button as={Link} href="/contractors" size="sm" variant="flat">
              Open
            </Button>
          }
        >
          {contractors.total ? (
            <div className="flex flex-col gap-4">
              <Summary good={contractors.compliant} total={contractors.total} word="contractors" />
              <ItemList title="Waiting for your review" items={contractors.to_review} names={names} hrefBase="/contractors" empty="Nothing to review." review />
              <ItemList title="Expired or expiring soon" items={contractors.problems} names={names} hrefBase="/contractors" empty="Nothing expiring in the next 30 days." />
            </div>
          ) : (
            <EmptyState
              title="Nobody works for you yet"
              body="Add a contractor to collect their insurance and their people's training before they start work."
              action={
                <Button as={Link} href="/contractors" color="primary" size="sm">
                  Add a contractor
                </Button>
              }
            />
          )}
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2">
              <BriefcaseIcon className="h-5 w-5 text-ink-3" />
              My clients
            </span>
          }
          subtitle="Companies you work for. Keep your documents current before they flag you."
          actions={
            <Button as={Link} href="/clients" size="sm" variant="flat">
              Open
            </Button>
          }
        >
          {clients.total ? (
            <div className="flex flex-col gap-4">
              <Summary good={clients.compliant} total={clients.total} word="clients" />
              <ItemList title="To do" items={clients.todo} names={names} hrefBase="/clients" empty="Nothing missing." />
              <ItemList title="Expiring soon" items={clients.expiring} names={names} hrefBase="/clients" empty="Nothing expiring in the next 30 days." />
            </div>
          ) : (
            <EmptyState
              title="You don't work for other companies yet"
              body="When a company on EZForm adds you as a contractor, it shows up here. You can also add a client yourself to track what they ask for."
              action={
                <Button as={Link} href="/clients" color="primary" size="sm">
                  Add a client
                </Button>
              }
            />
          )}
        </Card>
      </div>
    </>
  );
}
