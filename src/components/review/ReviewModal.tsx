'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner, Textarea } from '@heroui/react';
import { Api, useAction, useAssignment } from '@/services/queries';
import { describeValidity, possessive, TYPE_META } from '@/lib/describe';
import { fmtDate, fmtDateTime, fromDateInput, toDateInput } from '@/lib/dates';
import { currentEvidence, expiryIfApproved, slotWhen } from '@/lib/slot';
import EvidenceView from './EvidenceView';
import { Callout, KV, StateChip, Timeline, TypeIconTile } from '@/components/ui';

/**
 * Review of one assignment. The client approves or sends back a submission and decides exceptions.
 * A sponsoring contractor opens its subcontractor's submission here to check it before the client sees it.
 */
export default function ReviewModal({ assignmentId, onClose }: { assignmentId: string | null; onClose: () => void }) {
  const { data, isLoading } = useAssignment(assignmentId);
  const [note, setNote] = useState('');
  const [exNote, setExNote] = useState('');
  const [until, setUntil] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);

  useEffect(() => {
    setNote('');
    setExNote('');
    setShowCurrent(false);
  }, [assignmentId]);

  useEffect(() => {
    if (data?.slot.exception?.status === 'REQUESTED') setUntil(toDateInput(data.slot.exception.requested_until));
  }, [data?.slot.exception]);

  const review = useAction(
    (v: { decision: 'Approved' | 'Rejected' }) => Api.review({ id: assignmentId!, decision: v.decision, note }),
    (_r, v) => (v.decision === 'Approved' ? 'Approved' : 'Sent back to the contractor'),
  );
  const check = useAction(
    (v: { decision: 'Passed' | 'Rejected' }) => Api.sponsorCheck({ id: assignmentId!, decision: v.decision, note }),
    (_r, v) => (v.decision === 'Passed' ? `Passed to ${data?.client.name ?? 'the client'}` : 'Sent back to your subcontractor'),
  );
  const decide = useAction(
    (v: { decision: 'Approved' | 'Denied' }) =>
      Api.decideException({ id: assignmentId!, decision: v.decision, note: exNote, until: until ? fromDateInput(until) : undefined }),
    (_r, v) => (v.decision === 'Approved' ? 'Exception granted' : 'Exception denied'),
  );

  const s = data?.slot;
  const pendingExpiry = s ? expiryIfApproved(s) : undefined;
  const submitted = s?.submission.status === 'SUBMITTED';
  const shown = s ? (submitted ? s.submission.evidence : currentEvidence(s)) : null;
  const asSponsor = data?.viewer === 'sponsor';
  const asClient = data?.viewer === 'client';
  const sponsorCheck = s?.submission.sponsor_check;

  return (
    <Modal isOpen={!!assignmentId} onOpenChange={(open) => !open && onClose()} size="5xl" scrollBehavior="inside" backdrop="opaque">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-start gap-3 border-b border-line">
              {s ? (
                <>
                  <TypeIconTile type={s.req.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-semibold leading-snug text-ink">
                      {s.req.title}
                      {s.submission.is_renewal && s.awaiting_review ? <span className="font-normal text-ink-3"> · renewal</span> : null}
                    </p>
                    <p className="text-[13px] font-normal text-ink-3">
                      {asClient ? (
                        <Link href={`/contractors/${s.relationship_id}`} className="text-primary hover:underline" onClick={onClose}>
                          {s.contractor_name}
                        </Link>
                      ) : (
                        s.contractor_name
                      )}
                      {s.worker_name ? ` · ${s.worker_name}` : ''} · {TYPE_META[s.req.type].label}
                      {s.sponsor_name ? ` · for ${s.client_name}, via ${s.sponsor_name}` : ''}
                    </p>
                  </div>
                  <StateChip state={s.state} />
                </>
              ) : (
                <span>Loading…</span>
              )}
            </ModalHeader>
            <ModalBody className="py-5">
              {isLoading || !data || !s ? (
                <div className="grid place-items-center py-16">
                  <Spinner />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0 space-y-4">
                    {asSponsor && s.awaiting_sponsor && (
                      <Callout tone="info" title={`Check this before ${s.client_name} sees it`}>
                        {s.contractor_name} is your subcontractor on {s.client_name} work. Pass it on if it meets {possessive(s.client_name)} requirement, or send it back with a note.
                      </Callout>
                    )}
                    {asClient && s.awaiting_sponsor && (
                      <Callout tone="warn" title={`Waiting for ${possessive(s.sponsor_name ?? 'the sponsor')} check`}>
                        {s.contractor_name} is {possessive(s.sponsor_name ?? 'a contractor')} subcontractor, so {s.sponsor_name} checks its paperwork first. You can review it now instead; the history will note that.
                      </Callout>
                    )}
                    {asClient && submitted && sponsorCheck && (
                      <Callout tone="good" title={`Checked by ${sponsorCheck.by} (${sponsorCheck.org_name}) on ${fmtDate(sponsorCheck.at)}`}>
                        {sponsorCheck.note ? `“${sponsorCheck.note}”` : `${sponsorCheck.org_name} passed it on without a note.`}
                      </Callout>
                    )}

                    {asClient && s.exception_pending && s.exception && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="font-semibold text-amber-900">Exception requested until {fmtDate(s.exception.requested_until)}</p>
                        <p className="mt-1 text-[13px] text-amber-900">“{s.exception.reason}”</p>
                        <p className="mt-1 text-[12px] text-amber-800">
                          {s.exception.requested_by} · {fmtDateTime(s.exception.requested_at)}
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                          <Input
                            type="date"
                            label="Exception ends"
                            labelPlacement="outside"
                            placeholder=" "
                            variant="bordered"
                            value={until}
                            onValueChange={setUntil}
                            classNames={{ inputWrapper: 'bg-white' }}
                          />
                          <Input
                            label="Note to the contractor"
                            labelPlacement="outside"
                            placeholder="Required if you deny it"
                            variant="bordered"
                            value={exNote}
                            onValueChange={setExNote}
                            classNames={{ inputWrapper: 'bg-white' }}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <Button
                            color="danger"
                            variant="flat"
                            isLoading={decide.isPending && decide.variables?.decision === 'Denied'}
                            onPress={() => decide.mutate({ decision: 'Denied' }, { onSuccess: onClose })}
                          >
                            Deny exception
                          </Button>
                          <Button
                            color="warning"
                            isLoading={decide.isPending && decide.variables?.decision === 'Approved'}
                            onPress={() => decide.mutate({ decision: 'Approved' }, { onSuccess: onClose })}
                          >
                            Grant until {until ? fmtDate(fromDateInput(until)) : '…'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {s.state === 'REJECTED' && s.submission.note && (
                      <Callout tone="bad" title={`Sent back by ${s.submission.reviewed_by} on ${fmtDate(s.submission.reviewed_at)}`}>
                        “{s.submission.note}”
                      </Callout>
                    )}

                    <div>
                      <p className="eyebrow mb-2">{submitted ? 'Submitted for review' : s.approval ? 'Approved evidence' : 'Latest submission'}</p>
                      <EvidenceView evidence={shown} req={s.req} />
                    </div>

                    {submitted && s.approval && (
                      <div className="rounded-lg border border-line">
                        <button type="button" className="w-full px-3 py-2 text-left text-[13px] font-medium text-ink-2" onClick={() => setShowCurrent((v) => !v)}>
                          {showCurrent ? 'Hide' : 'Compare with'} what's approved now (valid until {fmtDate(s.approval.expires_at)})
                        </button>
                        {showCurrent && (
                          <div className="border-t border-line p-3">
                            <EvidenceView evidence={s.approval.evidence} req={s.req} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <aside className="space-y-5">
                    <div className="rounded-xl border border-line bg-[#FAFAFD] p-4">
                      <KV
                        labelWidth="7.5rem"
                        items={[
                          ['Status', slotWhen(s) || '—'],
                          ['Applies to', s.worker_name ? `Worker: ${s.worker_name}` : 'The company'],
                          ['Validity', describeValidity(s.req.validity)],
                          ['Counts to score', s.req.scored ? 'Yes' : 'No'],
                          [
                            'Version',
                            <>
                              v{s.req.version}
                              {data.latest && data.latest.version !== s.req.version ? <span className="text-ink-3"> (library is on v{data.latest.version})</span> : null}
                            </>,
                          ],
                          ['Assigned', fmtDate(s.assigned_at)],
                          ...(s.submission.submitted_at ? ([['Submitted', `${fmtDateTime(s.submission.submitted_at)} by ${s.submission.submitted_by}`]] as [string, string][]) : []),
                          ...(pendingExpiry !== undefined ? ([['If approved', pendingExpiry ? `Valid until ${fmtDate(pendingExpiry)}` : "Doesn't expire"]] as [string, string][]) : []),
                          ['Required by', data.source_names.join(', ') || '—'],
                        ]}
                      />
                    </div>
                    {s.previous.length > 0 && (
                      <div>
                        <p className="eyebrow mb-2">Earlier approvals</p>
                        <ul className="space-y-1.5 text-[13px]">
                          {s.previous.map((p, i) => (
                            <li key={i} className="flex justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                              <span>Approved {fmtDate(p.approved_at)}</span>
                              <span className="text-ink-3">{p.expires_at ? `expired ${fmtDate(p.expires_at)}` : 'no expiry'}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <p className="eyebrow mb-2">History</p>
                      <Timeline entries={s.history} />
                    </div>
                  </aside>
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex-col items-stretch gap-3 border-t border-line sm:flex-row sm:items-end">
              {asSponsor && s?.awaiting_sponsor ? (
                <>
                  <Textarea
                    aria-label="Note to your subcontractor"
                    placeholder={`Note. Required if you send it back; passed to ${s.client_name} otherwise.`}
                    minRows={1}
                    maxRows={4}
                    variant="bordered"
                    value={note}
                    onValueChange={setNote}
                    className="flex-1"
                  />
                  <div className="flex shrink-0 gap-2">
                    <Button
                      color="danger"
                      variant="flat"
                      isLoading={check.isPending && check.variables?.decision === 'Rejected'}
                      onPress={() => check.mutate({ decision: 'Rejected' }, { onSuccess: onClose })}
                    >
                      Send back
                    </Button>
                    <Button color="primary" isLoading={check.isPending && check.variables?.decision === 'Passed'} onPress={() => check.mutate({ decision: 'Passed' }, { onSuccess: onClose })}>
                      Pass to {s.client_name}
                    </Button>
                  </div>
                </>
              ) : asClient && submitted ? (
                <>
                  <Textarea
                    aria-label="Note to the contractor"
                    placeholder="Note to the contractor. Required if you send it back."
                    minRows={1}
                    maxRows={4}
                    variant="bordered"
                    value={note}
                    onValueChange={setNote}
                    className="flex-1"
                  />
                  <div className="flex shrink-0 gap-2">
                    <Button
                      color="danger"
                      variant="flat"
                      isLoading={review.isPending && review.variables?.decision === 'Rejected'}
                      onPress={() => review.mutate({ decision: 'Rejected' }, { onSuccess: onClose })}
                    >
                      Send back
                    </Button>
                    <Button
                      color="primary"
                      isLoading={review.isPending && review.variables?.decision === 'Approved'}
                      onPress={() => review.mutate({ decision: 'Approved' }, { onSuccess: onClose })}
                    >
                      Approve
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex w-full justify-end">
                  <Button variant="flat" onPress={onClose}>
                    Close
                  </Button>
                </div>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
