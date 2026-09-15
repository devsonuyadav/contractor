'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import DocumentUpload from '@/components/portal/DocumentUpload';
import ExceptionRequestModal from '@/components/portal/ExceptionRequestModal';
import FormFill from '@/components/portal/FormFill';
import PolicySignoff from '@/components/portal/PolicySignoff';
import TrainingRunner from '@/components/portal/TrainingRunner';
import EvidenceView from '@/components/review/EvidenceView';
import { Callout, Card, EmptyState, KV, StateChip, Timeline, TypeBadge, TypeIconTile } from '@/components/ui';
import { fmtDate } from '@/lib/dates';
import { describeValidity, TYPE_META } from '@/lib/describe';
import { slotWhen } from '@/lib/slot';
import type { Evidence, SlotView } from '@/lib/types';
import { Api, useAction, useAssignment, useClock, useReusable } from '@/services/queries';

const DO_TITLE: Record<SlotView['req']['type'], string> = {
  DOCUMENT: 'Upload the document',
  FORM: 'Fill in the form',
  TRAINING: 'Take the course',
  SIGNOFF: 'Read and sign',
};

export default function PortalItemPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : undefined;
  const router = useRouter();
  const { data, isLoading, isError } = useAssignment(id);
  const { data: clock } = useClock();
  const [askException, setAskException] = useState(false);
  const tenant = data?.client.name ?? 'the client';
  const back = data ? `/portal/clients/${data.slot.relationship_id}` : '/portal';
  const today = clock?.today ?? new Date().toISOString();
  const openNow = !!data && (data.slot.submission.status === 'OPEN' || data.slot.submission.status === 'REJECTED') && !data.slot.removed;
  const { data: reusable } = useReusable(id, openNow && data?.slot.req.type === 'DOCUMENT');

  const submit = useAction(
    (v: { evidence?: Evidence; reuse?: string }) => Api.submit({ id: id!, evidence: v.evidence, reuse_assignment_id: v.reuse }),
    (r) => (r.auto_approved ? `Done. ${r.expires_at ? `Valid until ${fmtDate(r.expires_at)}` : "It doesn't expire"}.` : r.sponsor ? `Sent to ${r.sponsor} to check first.` : `Sent to ${tenant} for review.`),
  );
  const send = (evidence: Evidence, onDone?: () => void) =>
    submit.mutate(
      { evidence },
      {
        onSuccess: () => {
          onDone?.();
          router.push(back);
        },
      },
    );
  const reuse = (assignmentId: string) => submit.mutate({ reuse: assignmentId }, { onSuccess: () => router.push(back) });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState
        title="We couldn't find that requirement"
        body="It may have been removed from your checklist."
        action={
          <Button as={Link} href="/portal" variant="flat">
            Back to your clients
          </Button>
        }
      />
    );
  }

  const s = data.slot;
  const req = s.req;
  const worker = data.worker;
  const contractor = data.contractor;
  const open = s.submission.status === 'OPEN' || s.submission.status === 'REJECTED';
  const canAskException = open && !s.removed && !s.exception_pending && (!s.compliant || s.renewal_open);
  const ex = s.exception;
  const previousAnswers =
    (s.submission.evidence?.kind === 'FORM' ? s.submission.evidence.answers : undefined) ??
    (s.approval?.evidence.kind === 'FORM' ? s.approval.evidence.answers : undefined);

  return (
    <div className="space-y-6">
      <div>
        <Link href={back} className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-primary">
          <ArrowLeftIcon className="h-4 w-4" /> {tenant} checklist
        </Link>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <TypeIconTile type={req.type} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold leading-tight text-ink">{req.title}</h1>
            {req.description && <p className="mt-0.5 max-w-3xl text-ink-2">{req.description}</p>}
            {worker && (
              <p className="mt-1 text-[13px] text-ink-3">
                For {worker.name} · badge {worker.badge_id}
              </p>
            )}
          </div>
          <StateChip state={s.state} extra={s.exception_pending ? 'exception requested' : undefined} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {s.removed && (
            <Callout tone="warn" title="This no longer applies to you">
              {tenant} removed it from your requirement groups or sites. There&apos;s nothing to do.
            </Callout>
          )}

          {s.state === 'REJECTED' && (
            <Callout tone="bad" title={`Sent back by ${s.submission.reviewed_by ?? tenant} on ${fmtDate(s.submission.reviewed_at)}`}>
              <p>“{s.submission.note}”</p>
              <p className="mt-1">Fix it below and resubmit.</p>
            </Callout>
          )}

          {s.state === 'EXPIRED' && open && (
            <Callout tone="bad" title={`This expired on ${fmtDate(s.approval?.expires_at)}`}>
              Until it&apos;s renewed, {worker ? worker.name : 'your crew'} will be stopped at the gate.
            </Callout>
          )}

          {s.state === 'NOT_STARTED' && s.overdue && (
            <Callout tone="warn" title={`This was due on ${fmtDate(s.submission.due_at)}`}>
              Complete it as soon as you can.
            </Callout>
          )}

          {s.renewal_open && s.approval && (
            <Callout title="Renewal">
              Your current approval is valid until {fmtDate(s.approval.expires_at)}. Submitting the renewal now doesn&apos;t change that until {tenant} approves it.
            </Callout>
          )}

          {ex?.status === 'REQUESTED' && (
            <Callout tone="warn" title={`Exception requested until ${fmtDate(ex.requested_until)}`}>
              {tenant} hasn&apos;t decided yet. You can still complete the requirement meanwhile.
            </Callout>
          )}
          {ex?.status === 'APPROVED' && (
            <Callout tone="info" title={s.waived_until ? `Exception granted until ${fmtDate(ex.until)}` : `Your exception ended on ${fmtDate(ex.until)}`}>
              {ex.note ? `“${ex.note}” ` : ''}
              {s.waived_until ? 'Complete the requirement before then.' : 'Complete the requirement now.'}
            </Callout>
          )}
          {ex?.status === 'DENIED' && (
            <Callout tone="bad" title="Exception denied">
              {ex.note ? `“${ex.note}”` : `${tenant} couldn't approve an exception for this.`}
            </Callout>
          )}

          {open && !s.removed && (
            <Card title={DO_TITLE[req.type]} bodyClass="p-5">
              {req.type === 'DOCUMENT' && (
                <DocumentUpload req={req} today={today} busy={submit.isPending} onSubmit={(ev) => send(ev)} reusable={reusable} onReuse={reuse} />
              )}
              {req.type === 'FORM' && (
                <FormFill req={req} assignmentId={s.id} busy={submit.isPending} initial={previousAnswers} onSubmit={(ev, done) => send(ev, done)} />
              )}
              {req.type === 'TRAINING' && (
                <TrainingRunner req={req} trainee={worker?.name ?? contractor.contact.name} busy={submit.isPending} onSubmit={(ev) => send(ev)} />
              )}
              {req.type === 'SIGNOFF' && (
                <PolicySignoff req={req} defaultName={contractor.contact.name} busy={submit.isPending} onSubmit={(ev) => send(ev)} />
              )}
            </Card>
          )}

          {s.submission.status === 'SUBMITTED' && (
            <Card title="Your submission" bodyClass="p-5 space-y-4">
              <Callout>
                {s.awaiting_sponsor
                  ? `Waiting for ${s.sponsor_name} to check it. Then it goes to ${tenant} for review.`
                  : s.submission.sponsor_check
                    ? `${s.submission.sponsor_check.org_name} checked it on ${fmtDate(s.submission.sponsor_check.at)}. Now it's with ${tenant} for review.`
                    : `Waiting for ${tenant} to review it. We'll email you when it's done.`}
              </Callout>
              <EvidenceView evidence={s.submission.evidence} req={req} />
            </Card>
          )}

          {!open && !s.awaiting_review && s.approval && (
            <Card title="Approved" bodyClass="p-5 space-y-4">
              <KV
                items={[
                  ['Approved', `${fmtDate(s.approval.approved_at)}${s.approval.auto ? ' (automatically)' : ` by ${s.approval.approved_by}`}`],
                  ['Valid until', s.approval.expires_at ? fmtDate(s.approval.expires_at) : "Doesn't expire"],
                ]}
              />
              <EvidenceView evidence={s.approval.evidence} req={req} />
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card title="About this requirement" bodyClass="p-4">
            <KV
              labelWidth="6.5rem"
              items={[
                [
                  'Type',
                  <span key="type" className="inline-flex items-center gap-1.5">
                    <TypeBadge type={req.type} label={false} />
                    {TYPE_META[req.type].label}
                  </span>,
                ],
                ['Client', tenant],
                ['For', worker ? worker.name : `${contractor.name} (company)`],
                ['Validity', describeValidity(req.validity)],
                ['Status', slotWhen(s) || '—'],
                ['Review', req.needs_review ? (s.sponsor_name ? `${s.sponsor_name}, then ${tenant}` : `Checked by ${tenant}`) : 'Completes as soon as you finish'],
                ['Counts to score', req.scored ? 'Yes' : 'No'],
                ['Required by', data.source_names.join(', ') || '—'],
              ]}
            />
            {canAskException && (
              <div className="mt-4 border-t border-line pt-3">
                <Button variant="light" color="warning" size="sm" className="px-2" onPress={() => setAskException(true)}>
                  Can&apos;t meet this requirement?
                </Button>
                <p className="px-2 text-[12px] text-ink-3">Ask {tenant} for an exception.</p>
              </div>
            )}
          </Card>
          <details className="card group">
            <summary className="cursor-pointer list-none px-4 py-3 text-[14px] font-semibold text-ink">
              History <span className="font-normal text-ink-3">({s.history.length})</span>
            </summary>
            <div className="border-t border-line p-4">
              <Timeline entries={s.history} />
            </div>
          </details>
        </aside>
      </div>

      {id && (
        <ExceptionRequestModal
          isOpen={askException}
          onClose={() => setAskException(false)}
          assignmentId={id}
          title={worker ? `${req.title} · ${worker.name}` : req.title}
          tenant={tenant}
          today={today}
        />
      )}
    </div>
  );
}
