'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import FormRenderer from '@/components/forms/FormRenderer';
import { Callout } from '@/components/ui';
import { isAnswered } from '@/lib/forms';
import type { Evidence, RequirementSnapshot } from '@/lib/types';

type Answers = Record<string, unknown>;

export default function FormFill({
  req,
  assignmentId,
  busy,
  initial,
  onSubmit,
}: {
  req: RequirementSnapshot;
  assignmentId: string;
  busy: boolean;
  /** Last answers (a sent-back or previous submission) to start from. */
  initial?: Answers;
  onSubmit: (ev: Evidence, onDone: () => void) => void;
}) {
  const key = `ezc-draft-${assignmentId}`;
  const [answers, setAnswers] = useState<Answers>({});
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [missing, setMissing] = useState<string[]>([]);
  const [source, setSource] = useState<'draft' | 'previous' | null>(null);
  const loaded = useRef(false);
  const schema = req.form;

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        setAnswers(JSON.parse(raw) as Answers);
        setSource('draft');
        return;
      }
    } catch {
      // storage unavailable: start fresh
    }
    if (initial && Object.keys(initial).length) {
      setAnswers(initial);
      setSource('previous');
    }
  }, [key, initial]);

  useEffect(() => {
    if (!loaded.current || Object.keys(answers).length === 0) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(answers));
    } catch {
      // drafts are a convenience; ignore storage failures
    }
  }, [key, answers]);

  if (!schema) return <Callout tone="warn">This form has no questions yet.</Callout>;

  const fields = schema.sections.flatMap((s) => s.fields.map((f) => ({ f, section: s.id })));

  const change = (next: Answers) => {
    setAnswers(next);
    if (invalid.size) {
      const still = new Set(
        [...invalid].filter((id) => {
          const hit = fields.find((x) => x.f.id === id);
          return hit ? !isAnswered(hit.f, next[id]) : false;
        }),
      );
      setInvalid(still);
      setMissing(fields.filter((x) => still.has(x.f.id)).map((x) => x.f.label));
    }
  };

  const submit = () => {
    const bad = fields.filter((x) => x.f.required && !isAnswered(x.f, answers[x.f.id]));
    if (bad.length) {
      setInvalid(new Set(bad.map((x) => x.f.id)));
      setMissing(bad.map((x) => x.f.label));
      document.getElementById(`sec-${bad[0].section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    onSubmit({ kind: 'FORM', answers }, () => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // nothing to clean up
      }
    });
  };

  return (
    <div className="space-y-5">
      {source === 'draft' && <Callout>We restored the answers you saved in this browser.</Callout>}
      {source === 'previous' && <Callout>We&apos;ve filled in your last answers. Check them and update anything that has changed.</Callout>}
      {missing.length > 0 && (
        <Callout tone="bad" title={`Answer ${missing.length === 1 ? 'this question' : `these ${missing.length} questions`} to submit`}>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Callout>
      )}
      <FormRenderer schema={schema} value={answers} onChange={change} invalid={invalid} />
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        <span className="text-[12px] text-ink-3">Your answers are saved in this browser as you type.</span>
        <Button color="primary" isLoading={busy} onPress={submit}>
          {req.needs_review ? 'Submit for review' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
