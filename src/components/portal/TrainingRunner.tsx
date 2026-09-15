'use client';

import { useState } from 'react';
import { Button, Progress, Radio, RadioGroup, Spinner } from '@heroui/react';
import type { Evidence, RequirementSnapshot } from '@/lib/types';
import { Callout } from '@/components/ui';

type Phase = 'slides' | 'quiz' | 'result';

interface Result {
  score: number;
  wrong: string[];
  passed: boolean;
}

export default function TrainingRunner({
  req,
  trainee,
  busy,
  onSubmit,
}: {
  req: RequirementSnapshot;
  trainee: string;
  busy: boolean;
  onSubmit: (ev: Evidence) => void;
}) {
  const t = req.training;
  const [phase, setPhase] = useState<Phase>('slides');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attempts, setAttempts] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  if (!t || !t.slides.length) return <Callout tone="warn">This course has no content yet.</Callout>;

  const total = t.slides.length;
  const slide = t.slides[Math.min(idx, total - 1)];
  const allAnswered = t.quiz.every((q) => answers[q.id] !== undefined && answers[q.id] !== '');

  const submitPass = (score: number, n: number) => onSubmit({ kind: 'TRAINING', score, passed: true, attempts: n, trainee });

  const check = () => {
    const wrong = t.quiz.filter((q) => Number(answers[q.id]) !== q.answer).map((q) => q.id);
    const score = Math.round(((t.quiz.length - wrong.length) / t.quiz.length) * 100);
    const n = attempts + 1;
    const passed = score >= t.pass_mark;
    setAttempts(n);
    setResult({ score, wrong, passed });
    setPhase('result');
    if (passed) submitPass(score, n);
  };

  const restartQuiz = () => {
    setAnswers({});
    setResult(null);
    setPhase('quiz');
  };

  if (phase === 'slides') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-3">
          <span>
            Slide {idx + 1} of {total}
          </span>
          <span>
            About {t.duration_min} min · pass mark {t.pass_mark}%
          </span>
        </div>
        <Progress aria-label="Course progress" size="sm" value={((idx + 1) / (total + 1)) * 100} />
        <article className="min-h-[180px] rounded-xl border border-line bg-[#FAFAFD] p-6">
          <h3 className="text-[18px] font-semibold text-ink">{slide.title}</h3>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{slide.body}</p>
        </article>
        <div className="flex justify-between gap-2">
          <Button variant="flat" isDisabled={idx === 0} onPress={() => setIdx((i) => Math.max(0, i - 1))}>
            Back
          </Button>
          {idx < total - 1 ? (
            <Button color="primary" onPress={() => setIdx((i) => i + 1)}>
              Next
            </Button>
          ) : (
            <Button color="primary" onPress={() => setPhase('quiz')}>
              Start the quiz
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'quiz') {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Progress aria-label="Course progress" size="sm" value={(total / (total + 1)) * 100} />
          <p className="text-[13px] text-ink-2">
            Answer all {t.quiz.length} questions. You need {t.pass_mark}% to pass.
            {attempts ? ` This is attempt ${attempts + 1}.` : ''}
          </p>
        </div>
        {t.quiz.map((q, i) => (
          <RadioGroup
            key={q.id}
            id={`quiz-${q.id}`}
            label={`${i + 1}. ${q.prompt}`}
            value={answers[q.id] ?? ''}
            onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            classNames={{ label: 'text-[14px] font-medium text-ink' }}
          >
            {q.options.map((o, oi) => (
              <Radio key={oi} value={String(oi)}>
                {o}
              </Radio>
            ))}
          </RadioGroup>
        ))}
        <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
          <Button
            variant="flat"
            onPress={() => {
              setPhase('slides');
              setIdx(0);
            }}
          >
            Review the slides
          </Button>
          <Button color="primary" isDisabled={!allAnswered} onPress={check}>
            Check answers
          </Button>
        </div>
      </div>
    );
  }

  // Result
  if (!result) return null;
  if (result.passed) {
    return (
      <div className="space-y-4">
        <Callout tone="good" title={`You passed with ${result.score}%`}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" /> Saving your completion…
            </span>
          ) : (
            'Your completion is being recorded.'
          )}
        </Callout>
        {!busy && (
          <div className="flex justify-end">
            <Button color="primary" onPress={() => submitPass(result.score, attempts)}>
              Save my result
            </Button>
          </div>
        )}
      </div>
    );
  }
  const wrongPrompts = t.quiz.filter((q) => result.wrong.includes(q.id)).map((q) => q.prompt);
  return (
    <div className="space-y-4">
      <Callout tone="bad" title={`You scored ${result.score}%. You need ${t.pass_mark}% to pass.`}>
        <p>Have another look at these:</p>
        <ul className="mt-1 list-disc pl-5">
          {wrongPrompts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px]">Attempts so far: {attempts}</p>
      </Callout>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="flat"
          onPress={() => {
            setResult(null);
            setPhase('slides');
            setIdx(0);
          }}
        >
          Review the slides
        </Button>
        <Button color="primary" onPress={restartQuiz}>
          Try the quiz again
        </Button>
      </div>
    </div>
  );
}
