'use client';

import { Button } from '@heroui/react';
import { ArrowTopRightOnSquareIcon, CheckCircleIcon, DocumentIcon } from '@heroicons/react/24/outline';
import type { Evidence, RequirementSnapshot } from '@/lib/types';
import { fmtDate } from '@/lib/dates';
import { fmtBytes, openDataUrl } from '@/lib/slot';
import FormRenderer from '@/components/forms/FormRenderer';
import { EmptyState, KV } from '@/components/ui';

export default function EvidenceView({ evidence, req }: { evidence: Evidence | null | undefined; req: RequirementSnapshot }) {
  if (!evidence) return <EmptyState title="Nothing submitted yet" />;
  switch (evidence.kind) {
    case 'DOCUMENT':
      return <DocumentEvidence ev={evidence} />;
    case 'FORM':
      return req.form ? <FormRenderer schema={req.form} value={evidence.answers} readOnly /> : <p className="text-ink-3">This form has no questions.</p>;
    case 'TRAINING':
      return <TrainingEvidence ev={evidence} req={req} />;
    case 'SIGNOFF':
      return <SignoffEvidence ev={evidence} req={req} />;
  }
}

function DocumentEvidence({ ev }: { ev: Extract<Evidence, { kind: 'DOCUMENT' }> }) {
  const url = ev.file.data_url ?? null;
  const isImage = !!url && url.startsWith('data:image');
  const isPdf = !!url && url.startsWith('data:application/pdf');
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-line bg-white p-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-gray-100 text-ink-3">
          <DocumentIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{ev.file.name}</p>
          <p className="text-[12px] text-ink-3">{fmtBytes(ev.file.size)}</p>
        </div>
        {url && (
          <Button size="sm" variant="flat" endContent={<ArrowTopRightOnSquareIcon className="h-4 w-4" />} onPress={() => void openDataUrl(url)}>
            Open
          </Button>
        )}
      </div>
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url!} alt={`Preview of ${ev.file.name}`} className="w-full rounded-lg border border-line bg-white" />
      )}
      {isPdf && <iframe title={`Preview of ${ev.file.name}`} src={url!} className="h-[460px] w-full rounded-lg border border-line bg-white" />}
      {!url && <p className="rounded-lg bg-gray-50 px-3 py-6 text-center text-[12.5px] text-ink-3">The demo didn't keep a preview of this file.</p>}
      <KV
        items={[
          ['Reference', ev.reference || '—'],
          ['Issued', fmtDate(ev.issued_at)],
          ['Expires', ev.expires_at ? fmtDate(ev.expires_at) : 'No expiry date'],
        ]}
      />
    </div>
  );
}

function TrainingEvidence({ ev, req }: { ev: Extract<Evidence, { kind: 'TRAINING' }>; req: RequirementSnapshot }) {
  const t = req.training;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-lg border border-line bg-white p-4">
        <span className="tabular text-[34px] font-semibold leading-none text-ink">{ev.score}%</span>
        <div>
          <p className="flex items-center gap-1.5 font-medium text-success-600">
            <CheckCircleIcon className="h-5 w-5" /> Passed
          </p>
          <p className="text-[12.5px] text-ink-3">Pass mark {t?.pass_mark ?? '—'}% · {ev.attempts === 1 ? 'first attempt' : `${ev.attempts} attempts`}</p>
        </div>
      </div>
      <KV
        items={[
          ['Trainee', ev.trainee],
          ['Course', t ? `${t.slides.length} slides, ${t.quiz.length}-question quiz, about ${t.duration_min} min` : '—'],
        ]}
      />
    </div>
  );
}

function SignoffEvidence({ ev, req }: { ev: Extract<Evidence, { kind: 'SIGNOFF' }>; req: RequirementSnapshot }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="text-[12px] text-ink-3">Signed by</p>
        <p className="font-medium text-ink">{ev.signed_name}</p>
        <div className="mt-2 border-b border-ink/40 pb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ev.signature} alt={`Signature of ${ev.signed_name}`} className="h-20 max-w-full object-contain object-left" />
        </div>
      </div>
      {req.policy && (
        <>
          <p className="flex items-start gap-2 text-[13px] text-ink">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
            {req.policy.confirm_text}
          </p>
          <details className="rounded-lg border border-line bg-gray-50 px-3 py-2">
            <summary className="cursor-pointer text-[13px] font-medium text-ink-2">Policy text they signed</summary>
            <p className="prose-policy mt-2">{req.policy.body}</p>
          </details>
        </>
      )}
    </div>
  );
}
