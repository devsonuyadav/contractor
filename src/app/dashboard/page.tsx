'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Chip, Spinner } from '@heroui/react';
import {
  BuildingOffice2Icon,
  ClipboardDocumentListIcon,
  DocumentMagnifyingGlassIcon,
  ArrowTurnDownRightIcon,
  ExclamationTriangleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import ActivityFeed from '@/components/activity/ActivityFeed';
import AddContractorModal from '@/components/contractors/AddContractorModal';
import ContractorTable from '@/components/contractors/ContractorTable';
import ReviewModal from '@/components/review/ReviewModal';
import { Card, Donut, EmptyState, PageHeader, StateChip, Stat, STATUS_COLORS, TypeBadge } from '@/components/ui';
import { fmtDate, fmtWeekday, relDays, timeAgo } from '@/lib/dates';
import { possessive, TASK_META } from '@/lib/describe';
import type { ContractorStatus, Task } from '@/lib/types';
import { useDashboard, useSessionContext } from '@/services/queries';

const STATUS_ORDER: ContractorStatus[] = ['Approved', 'Pending', 'New', 'Denied'];

const TASK_ICON = {
  REVIEW: DocumentMagnifyingGlassIcon,
  EXCEPTION: ExclamationTriangleIcon,
  APPLICATION: BuildingOffice2Icon,
  SPONSOR_CHECK: ArrowTurnDownRightIcon,
} as const;

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const { data: ctx } = useSessionContext();
  const router = useRouter();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }

  const k = data.kpis;
  const openTask = (t: Task) => {
    if (t.assignment_id) setReviewId(t.assignment_id);
    else router.push(`/contractors/${t.relationship_id}`);
  };

  return (
    <>
      <PageHeader
        title="Contractor compliance"
        description={`${possessive(ctx?.org.name ?? 'Your company')} approved-contractor program as of ${fmtWeekday(data.today)}.`}
        actions={
          <>
            <Button as={Link} href="/requirements" variant="flat" startContent={<ClipboardDocumentListIcon className="h-4 w-4" />}>
              Manage requirements
            </Button>
            <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setAdding(true)}>
              Add contractor
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Contractors" value={k.contractors} hint={`${k.approved} approved to work`} href="/contractors" />
        <Stat label="Waiting on you" value={k.waiting_on_you} hint="Reviews, exceptions, applications" tone={k.waiting_on_you ? 'info' : 'neutral'} href="/reviews" />
        <Stat label="Expiring in 30 days" value={k.expiring_30} hint="Renewals already open" tone={k.expiring_30 ? 'warn' : 'neutral'} />
        <Stat label="Expired" value={k.expired} hint="These workers are stopped at the gate" tone={k.expired ? 'bad' : 'good'} href="/gate" />
        <Stat
          label="Average compliance"
          value={k.avg_company_score === null ? '—' : `${k.avg_company_score}%`}
          hint={`Approved contractors · workers ${k.avg_worker_score ?? '—'}%`}
          tone="good"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[290px_minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Contractors by status">
          <div className="flex flex-col items-center gap-4">
            <Donut
              segments={STATUS_ORDER.map((s) => ({ key: s, value: data.status_counts[s], color: STATUS_COLORS[s] }))}
              label={k.contractors}
              sublabel="contractors"
            />
            <ul className="grid w-full grid-cols-2 gap-x-5 gap-y-1.5 text-[13px]">
              {STATUS_ORDER.map((s) => (
                <li key={s}>
                  <Link href={`/contractors?status=${s}`} className="flex items-center gap-2 rounded hover:text-primary">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[s] }} aria-hidden />
                    {s}
                    <span className="tabular ml-auto font-medium text-ink">{data.status_counts[s]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card
          title="Waiting on you"
          subtitle={data.tasks.length ? `${data.tasks.length} open, oldest first` : undefined}
          actions={
            <Link href="/reviews" className="text-[13px] font-medium text-primary hover:underline">
              Open queue
            </Link>
          }
          bodyClass="p-0"
        >
          {data.tasks.length ? (
            <ul className="max-h-[340px] divide-y divide-line overflow-y-auto">
              {data.tasks.map((t) => {
                const Icon = TASK_ICON[t.kind];
                return (
                  <li key={t.id}>
                    <button type="button" onClick={() => openTask(t)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary-50/60">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{t.title}</span>
                        <span className="block truncate text-[12px] text-ink-3">
                          {TASK_META[t.kind].label} · {t.subtitle}
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[11.5px] text-ink-3">{timeAgo(t.at, data.today)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="All caught up" body="Nothing is waiting for a decision." />
          )}
        </Card>

        <Card title="Recent activity" bodyClass="p-0">
          <ActivityFeed events={data.activity} now={data.today} />
        </Card>
      </div>

      <Card title="Expiring and expired" subtitle="Renewals open 30 days before anything expires, and reminders go out at 30 and 7 days." bodyClass="p-0" className="mb-6">
        {data.expiring.length ? (
          <div className="table-scroll">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Contractor</th>
                  <th>Expiry</th>
                  <th>State</th>
                  <th>Renewal</th>
                </tr>
              </thead>
              <tbody>
                {data.expiring.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => setReviewId(s.id)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <TypeBadge type={s.req.type} label={false} />
                        <span className="font-medium text-ink">{s.req.title}</span>
                      </div>
                    </td>
                    <td>
                      <p className="text-ink">{s.contractor_name}</p>
                      {s.worker_name && <p className="text-[12px] text-ink-3">{s.worker_name}</p>}
                    </td>
                    <td className={`tabular ${s.state === 'EXPIRED' ? 'font-medium text-danger' : 'text-ink-2'}`}>
                      {fmtDate(s.approval?.expires_at)} <span className="text-ink-3">({relDays(s.expires_in_days ?? 0)})</span>
                    </td>
                    <td>
                      <StateChip state={s.state} />
                    </td>
                    <td className="text-[12.5px]">
                      {s.awaiting_review ? (
                        <Chip size="sm" variant="flat" color="primary">
                          Submitted, needs review
                        </Chip>
                      ) : s.exception_pending ? (
                        <Chip size="sm" variant="flat" color="secondary">
                          Exception requested
                        </Chip>
                      ) : (
                        <span className="text-ink-3">Waiting on contractor</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nothing expiring in the next 30 days" />
        )}
      </Card>

      <Card
        title="Contractors needing attention"
        actions={
          <Link href="/contractors" className="text-[13px] font-medium text-primary hover:underline">
            All contractors
          </Link>
        }
        bodyClass="p-0"
      >
        <ContractorTable rows={data.roster.slice(0, 8)} />
      </Card>

      <ReviewModal assignmentId={reviewId} onClose={() => setReviewId(null)} />
      <AddContractorModal isOpen={adding} onClose={() => setAdding(false)} onCreated={(id) => router.push(`/contractors/${id}`)} />
    </>
  );
}
