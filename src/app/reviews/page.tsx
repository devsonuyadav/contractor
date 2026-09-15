'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Chip, Spinner, Tab, Tabs } from '@heroui/react';
import { InboxStackIcon } from '@heroicons/react/24/outline';
import ReviewModal from '@/components/review/ReviewModal';
import { Card, EmptyState, PageHeader, ScoreBar, TypeBadge } from '@/components/ui';
import { daysUntil, fmtDate, timeAgo } from '@/lib/dates';
import { useClock, useQueue } from '@/services/queries';

type TabKey = 'reviews' | 'exceptions' | 'applications' | 'flow_down';

export default function ReviewsPage() {
  const { data, isLoading } = useQueue();
  const { data: clock } = useClock();
  const [tab, setTab] = useState<TabKey>('reviews');
  const [openId, setOpenId] = useState<string | null>(null);
  const now = clock?.today ?? new Date().toISOString();

  const counts = { reviews: data?.reviews.length ?? 0, exceptions: data?.exceptions.length ?? 0, applications: data?.applications.length ?? 0, flow_down: data?.flow_down.length ?? 0 };
  const showFlowDown = counts.flow_down > 0 || tab === 'flow_down';

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Submissions to approve or send back, exception requests to decide, new applications, and your subcontractors' paperwork to check for your clients. Oldest first."
      />
      <Card bodyClass="p-0">
        <div className="border-b border-line px-4 pt-2">
          <Tabs
            aria-label="Queue"
            variant="underlined"
            color="primary"
            selectedKey={tab}
            onSelectionChange={(k) => setTab(String(k) as TabKey)}
            classNames={{ base: 'max-w-full', tabList: 'gap-6 max-w-full overflow-x-auto', tab: 'px-0 h-11 w-auto shrink-0', cursor: 'w-full' }}
          >
            <Tab key="reviews" title={<TabTitle label="Submissions" count={counts.reviews} />} />
            <Tab key="exceptions" title={<TabTitle label="Exception requests" count={counts.exceptions} />} />
            <Tab key="applications" title={<TabTitle label="Applications" count={counts.applications} />} />
            {showFlowDown ? <Tab key="flow_down" title={<TabTitle label="Subcontractor checks" count={counts.flow_down} />} /> : null}
          </Tabs>
        </div>

        {isLoading || !data ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : tab === 'reviews' ? (
          data.reviews.length ? (
            <div className="table-scroll">
              <table className="data-table min-w-[820px]">
                <thead>
                  <tr>
                    <th>Requirement</th>
                    <th>Contractor</th>
                    <th>Submitted</th>
                    <th>If approved</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {data.reviews.map((s) => {
                    const ev = s.submission.evidence;
                    const exp =
                      s.req.validity.kind === 'DOCUMENT_DATE' && ev?.kind === 'DOCUMENT'
                        ? `Valid until ${fmtDate(ev.expires_at)}`
                        : s.req.validity.kind === 'PERIOD'
                          ? `Valid for ${s.req.validity.every} ${s.req.validity.unit}`
                          : "Doesn't expire";
                    return (
                      <tr key={s.id} className="clickable" onClick={() => setOpenId(s.id)}>
                        <td>
                          <div className="flex items-center gap-2">
                            <TypeBadge type={s.req.type} label={false} />
                            <span className="font-medium text-ink">{s.req.title}</span>
                            {s.submission.is_renewal && (
                              <Chip size="sm" variant="flat">
                                Renewal
                              </Chip>
                            )}
                          </div>
                        </td>
                        <td>
                          <p className="text-ink">{s.contractor_name}</p>
                          {s.worker_name && <p className="text-[12px] text-ink-3">{s.worker_name}</p>}
                          {s.submission.sponsor_check && (
                            <p className="text-[12px] text-success-700">
                              Sub of {s.sponsor_name} · checked by {s.submission.sponsor_check.by}
                            </p>
                          )}
                        </td>
                        <td className="text-ink-2">
                          {timeAgo(s.submission.submitted_at ?? s.assigned_at, now)}
                          <p className="text-[12px] text-ink-3">by {s.submission.submitted_by}</p>
                        </td>
                        <td className="text-[12.5px] text-ink-2">{exp}</td>
                        <td className="text-right">
                          <Button size="sm" color="primary" variant="flat" onPress={() => setOpenId(s.id)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={InboxStackIcon} title="No submissions waiting" body="New uploads, forms and renewals that need a reviewer land here." />
          )
        ) : tab === 'flow_down' ? (
          data.flow_down.length ? (
            <>
              <p className="border-b border-line px-4 py-3 text-[13px] text-ink-3">
                Subcontractors you brought onto a client&apos;s work send their paperwork to you first. Pass it on to the client, or send it back.
              </p>
              <div className="table-scroll">
                <table className="data-table min-w-[820px]">
                  <thead>
                    <tr>
                      <th>Requirement</th>
                      <th>Subcontractor</th>
                      <th>For client</th>
                      <th>Submitted</th>
                      <th className="w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.flow_down.map((s) => (
                      <tr key={s.id} className="clickable" onClick={() => setOpenId(s.id)}>
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
                        <td className="text-ink-2">{s.client_name}</td>
                        <td className="text-ink-2">
                          {timeAgo(s.submission.submitted_at ?? s.assigned_at, now)}
                          <p className="text-[12px] text-ink-3">by {s.submission.submitted_by}</p>
                        </td>
                        <td className="text-right">
                          <Button size="sm" color="primary" variant="flat" onPress={() => setOpenId(s.id)}>
                            Check
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState icon={InboxStackIcon} title="Nothing to check" body="Your subcontractors' submissions for your clients land here before the client sees them." />
          )
        ) : tab === 'exceptions' ? (
          data.exceptions.length ? (
            <div className="table-scroll">
              <table className="data-table min-w-[820px]">
                <thead>
                  <tr>
                    <th>Requirement</th>
                    <th>Contractor</th>
                    <th>Until</th>
                    <th>Reason</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {data.exceptions.map((s) => (
                    <tr key={s.id} className="clickable" onClick={() => setOpenId(s.id)}>
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
                      <td className="tabular whitespace-nowrap text-ink-2">
                        {fmtDate(s.exception?.requested_until)}
                        <p className="text-[12px] text-ink-3">{s.exception ? `${daysUntil(s.exception.requested_until, now)} days` : ''}</p>
                      </td>
                      <td className="max-w-[360px] text-[12.5px] text-ink-2">
                        <p className="line-clamp-2">{s.exception?.reason}</p>
                      </td>
                      <td className="text-right">
                        <Button size="sm" color="warning" variant="flat" onPress={() => setOpenId(s.id)}>
                          Decide
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No exception requests" body="When a contractor can't meet a requirement in time, their request for a waiver shows up here." />
          )
        ) : data.applications.length ? (
          <div className="table-scroll">
            <table className="data-table min-w-[820px]">
              <thead>
                <tr>
                  <th>Contractor</th>
                  <th>Submitted</th>
                  <th>Company items done</th>
                  <th>Still open</th>
                  <th className="w-36" />
                </tr>
              </thead>
              <tbody>
                {data.applications.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="font-medium text-ink">{c.name}</p>
                      <p className="text-[12px] text-ink-3">
                        {c.trade} · {c.sponsor ? `Subcontractor for ${c.sponsor.name}` : c.contact.name}
                      </p>
                    </td>
                    <td className="text-ink-2">{c.profile_submitted_at ? timeAgo(c.profile_submitted_at, now) : '—'}</td>
                    <td>
                      <ScoreBar score={c.company_score} />
                    </td>
                    <td className="text-ink-2">
                      {c.open_items} to do · {c.awaiting_review} to review
                    </td>
                    <td className="text-right">
                      <Button as={Link} href={`/contractors/${c.id}`} size="sm" color="primary" variant="flat">
                        Open application
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No applications waiting" body="Contractors appear here after they submit their company profile." />
        )}
      </Card>
      <ReviewModal assignmentId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function TabTitle({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex items-center gap-2">
      {label}
      <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold ${count ? 'bg-primary text-white' : 'bg-gray-100 text-ink-3'}`}>{count}</span>
    </span>
  );
}
