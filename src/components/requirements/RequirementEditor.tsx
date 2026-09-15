'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Radio,
  RadioGroup,
  Select,
  SelectItem,
  Switch,
  Textarea,
} from '@heroui/react';
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import FormRenderer from '@/components/forms/FormRenderer';
import { Callout, TYPE_ICON } from '@/components/ui';
import { describeValidity, plural, TYPE_META } from '@/lib/describe';
import type {
  FormField,
  FormFieldType,
  FormSchema,
  PeriodUnit,
  PolicyContent,
  RequirementContent,
  RequirementRow,
  RequirementType,
  TrainingContent,
  Validity,
} from '@/lib/types';
import { Api, useAction } from '@/services/queries';

const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const FIELD_TYPES: { key: FormFieldType; label: string }[] = [
  { key: 'text', label: 'Short answer' },
  { key: 'textarea', label: 'Paragraph' },
  { key: 'number', label: 'Number' },
  { key: 'date', label: 'Date' },
  { key: 'yesno', label: 'Yes / No' },
  { key: 'select', label: 'Dropdown' },
  { key: 'checkbox', label: 'Tick box' },
  { key: 'table', label: 'Table' },
];

function blank(type: RequirementType): RequirementContent {
  const base = { title: '', type, description: '', applies_to: 'COMPANY' as const, scored: true, ezform_template_id: null, flows_down: true };
  switch (type) {
    case 'DOCUMENT':
      return { ...base, validity: { kind: 'DOCUMENT_DATE' }, needs_review: true, document_hint: '' };
    case 'FORM':
      return {
        ...base,
        validity: { kind: 'PERIOD', every: 1, unit: 'years' },
        needs_review: true,
        form: { sections: [{ id: uid('s'), title: 'Questions', fields: [{ id: uid('f'), label: '', type: 'text', required: true }] }] },
      };
    case 'TRAINING':
      return {
        ...base,
        applies_to: 'WORKER',
        validity: { kind: 'PERIOD', every: 1, unit: 'years' },
        needs_review: false,
        training: { duration_min: 15, pass_mark: 80, slides: [{ id: uid('s'), title: '', body: '' }], quiz: [{ id: uid('q'), prompt: '', options: ['', ''], answer: 0 }] },
      };
    case 'SIGNOFF':
      return { ...base, validity: { kind: 'PERIOD', every: 1, unit: 'years' }, needs_review: false, policy: { body: '', confirm_text: 'I have read and accept this policy.' } };
  }
}

function fromRow(r: RequirementRow): RequirementContent {
  return JSON.parse(
    JSON.stringify({
      title: r.title,
      type: r.type,
      description: r.description,
      applies_to: r.applies_to,
      validity: r.validity,
      scored: r.scored,
      needs_review: r.needs_review,
      document_hint: r.document_hint,
      form: r.form,
      training: r.training,
      policy: r.policy,
      ezform_template_id: r.ezform_template_id ?? null,
      flows_down: r.flows_down !== false,
    }),
  ) as RequirementContent;
}

export default function RequirementEditor({ isOpen, editing, onClose }: { isOpen: boolean; editing: RequirementRow | null; onClose: () => void }) {
  const [draft, setDraft] = useState<RequirementContent | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(editing ? fromRow(editing) : null);
  }, [isOpen, editing]);

  const create = useAction((c: RequirementContent) => Api.createRequirement(c), (_r, c) => `${c.title} added to the library`);
  const update = useAction(
    (c: RequirementContent) => Api.updateRequirement({ ...c, id: editing!.id }),
    (r) =>
      r.changed
        ? `Saved as version ${r.version}. ${r.updated_now ? `${plural(r.updated_now, 'unstarted item')} updated now; ` : ''}${r.pinned ? `${plural(r.pinned, 'item')} keep their version until renewal.` : ''}`
        : 'No changes to save',
  );
  const busy = create.isPending || update.isPending;
  const set = (patch: Partial<RequirementContent>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="4xl" scrollBehavior="inside">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-0.5">
              {editing ? `Edit ${editing.title}` : draft ? `New ${TYPE_META[draft.type].label.toLowerCase()} requirement` : 'What should contractors do?'}
              <span className="text-[13px] font-normal text-ink-3">
                {editing ? `Version ${editing.version} · ${TYPE_META[editing.type].label}` : draft ? TYPE_META[draft.type].examples : 'Pick the kind of evidence you need. You can’t change the type later.'}
              </span>
            </ModalHeader>
            <ModalBody className="gap-5 pb-6">
              {!draft ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(Object.keys(TYPE_META) as RequirementType[]).map((t) => {
                    const Icon = TYPE_ICON[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDraft(blank(t))}
                        className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-left transition-colors hover:border-primary hover:bg-primary-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block font-semibold text-ink">{TYPE_META[t].label}</span>
                          <span className="block text-[12.5px] text-ink-3">{TYPE_META[t].examples}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Editor draft={draft} set={set} editing={editing} />
              )}
            </ModalBody>
            {draft && (
              <ModalFooter className="border-t border-line">
                {!editing && (
                  <Button variant="light" className="mr-auto" onPress={() => setDraft(null)}>
                    Change type
                  </Button>
                )}
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" isLoading={busy} isDisabled={!draft.title.trim()} onPress={() => (editing ? update : create).mutate(draft, { onSuccess: onClose })}>
                  {editing ? 'Save changes' : 'Create requirement'}
                </Button>
              </ModalFooter>
            )}
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

function Editor({ draft, set, editing }: { draft: RequirementContent; set: (p: Partial<RequirementContent>) => void; editing: RequirementRow | null }) {
  const v = draft.validity;
  const setValidity = (next: Validity) => set({ validity: next });
  return (
    <>
      {editing && editing.in_use > 0 && (
        <Callout tone="warn" title={`Assigned to ${plural(editing.contractors, 'contractor')} (${plural(editing.in_use, 'item')})`}>
          Items nobody has started yet switch to the new version when you save. Everything already submitted or approved keeps the version it was done against, and picks up the new one at its next renewal.
        </Callout>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Input id="req-title" label="Title" labelPlacement="outside" placeholder="e.g. Certificate of Liability Insurance" variant="bordered" isRequired value={draft.title} onValueChange={(title) => set({ title })} />
        <RadioGroup id="req-applies" label="Who does it" orientation="horizontal" value={draft.applies_to} onValueChange={(a) => set({ applies_to: a as 'COMPANY' | 'WORKER' })} classNames={{ label: 'text-[13px] text-ink' }}>
          <Radio value="COMPANY" description="One per contractor">
            The company
          </Radio>
          <Radio value="WORKER" description="Every worker, e.g. training">
            Each worker
          </Radio>
        </RadioGroup>
      </div>
      <Textarea id="req-description" label="What it's for" labelPlacement="outside" placeholder="Shown to the contractor on their checklist" variant="bordered" minRows={2} value={draft.description} onValueChange={(description) => set({ description })} />

      <div className="rounded-xl border border-line bg-[#FAFAFD] p-4">
        <p className="mb-3 text-[13px] font-medium text-ink">How long it stays valid</p>
        <RadioGroup
          id="req-validity"
          aria-label="Validity"
          value={v.kind}
          onValueChange={(k) => {
            if (k === 'NONE') setValidity({ kind: 'NONE' });
            if (k === 'DOCUMENT_DATE') setValidity({ kind: 'DOCUMENT_DATE' });
            if (k === 'PERIOD') setValidity({ kind: 'PERIOD', every: v.kind === 'PERIOD' ? v.every : 1, unit: v.kind === 'PERIOD' ? v.unit : 'years' });
          }}
        >
          <Radio value="NONE">Doesn't expire</Radio>
          {draft.type === 'DOCUMENT' && <Radio value="DOCUMENT_DATE">Expires on the date printed on the document (the contractor enters it)</Radio>}
          <Radio value="PERIOD">For a fixed period after it's completed</Radio>
        </RadioGroup>
        {v.kind === 'PERIOD' && (
          <div className="ml-7 mt-2 flex items-center gap-2">
            <span className="text-[13px] text-ink-2">Valid for</span>
            <Input
              id="req-every"
              aria-label="Number"
              type="number"
              min={1}
              variant="bordered"
              size="sm"
              className="w-20"
              value={String(v.every)}
              onValueChange={(x) => setValidity({ kind: 'PERIOD', every: Math.max(1, Number(x) || 1), unit: v.unit })}
            />
            <Select
              id="req-unit"
              aria-label="Unit"
              size="sm"
              variant="bordered"
              className="w-32"
              selectedKeys={[v.unit]}
              onSelectionChange={(keys) => {
                const u = keys === 'all' ? 'years' : (String(Array.from(keys)[0] ?? 'years') as PeriodUnit);
                setValidity({ kind: 'PERIOD', every: v.every, unit: u });
              }}
            >
              <SelectItem key="days">days</SelectItem>
              <SelectItem key="months">months</SelectItem>
              <SelectItem key="years">years</SelectItem>
            </Select>
          </div>
        )}
        <p className="mt-3 text-[12.5px] text-ink-3">
          {describeValidity(v)}.{v.kind !== 'NONE' && ' A renewal opens 30 days before it expires, with reminders at 30 and 7 days.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Switch id="req-scored" isSelected={draft.scored} onValueChange={(scored) => set({ scored })}>
          <span className="text-[13px]">
            Counts toward the compliance score
            <span className="block text-[12px] text-ink-3">Scored items also decide who gets through the gate.</span>
          </span>
        </Switch>
        <Switch id="req-review" isSelected={draft.needs_review} onValueChange={(needs_review) => set({ needs_review })}>
          <span className="text-[13px]">
            A reviewer approves each submission
            <span className="block text-[12px] text-ink-3">Off: it counts as soon as it's completed.</span>
          </span>
        </Switch>
        <Switch id="req-flows-down" isSelected={draft.flows_down !== false} onValueChange={(flows_down) => set({ flows_down })}>
          <span className="text-[13px]">
            Ask subcontractors too
            <span className="block text-[12px] text-ink-3">Off: only contractors you engage directly. Changing this doesn&apos;t create a new version.</span>
          </span>
        </Switch>
      </div>

      {draft.type === 'DOCUMENT' && (
        <Textarea
          id="req-hint"
          label="What to upload"
          labelPlacement="outside"
          placeholder="e.g. General liability, minimum $2M per occurrence, with us named as additional insured"
          variant="bordered"
          minRows={2}
          value={draft.document_hint ?? ''}
          onValueChange={(document_hint) => set({ document_hint })}
        />
      )}
      {draft.type === 'FORM' && draft.form && <FormSchemaEditor schema={draft.form} onChange={(form) => set({ form })} ezformId={draft.ezform_template_id ?? ''} onEzform={(ezform_template_id) => set({ ezform_template_id })} />}
      {draft.type === 'TRAINING' && draft.training && <TrainingEditor training={draft.training} onChange={(training) => set({ training })} />}
      {draft.type === 'SIGNOFF' && draft.policy && <PolicyEditor policy={draft.policy} onChange={(policy) => set({ policy })} />}
    </>
  );
}

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function FormSchemaEditor({ schema, onChange, ezformId, onEzform }: { schema: FormSchema; onChange: (s: FormSchema) => void; ezformId: string; onEzform: (id: string | null) => void }) {
  const [preview, setPreview] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const setSection = (si: number, patch: Partial<FormSchema['sections'][number]>) => onChange({ sections: schema.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) });
  const setField = (si: number, fi: number, patch: Partial<FormField>) => setSection(si, { fields: schema.sections[si].fields.map((f, i) => (i === fi ? { ...f, ...patch } : f)) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink">Questions</p>
        <Button size="sm" variant="flat" startContent={<EyeIcon className="h-4 w-4" />} onPress={() => setPreview((p) => !p)}>
          {preview ? 'Back to editing' : 'Preview as contractor'}
        </Button>
      </div>
      {preview ? (
        <div className="rounded-xl border border-line p-4">
          <FormRenderer schema={schema} value={answers} onChange={setAnswers} />
        </div>
      ) : (
        <>
          {schema.sections.map((section, si) => (
            <div key={section.id} className="rounded-xl border border-line">
              <div className="flex items-center gap-2 border-b border-line bg-[#FAFAFD] px-3 py-2">
                <span className="text-[12px] text-ink-3">Section {si + 1}</span>
                <Input aria-label="Section title" size="sm" variant="bordered" value={section.title} onValueChange={(title) => setSection(si, { title })} className="max-w-sm" />
                <div className="ml-auto flex gap-1">
                  <Button isIconOnly size="sm" variant="light" aria-label="Move section up" onPress={() => onChange({ sections: move(schema.sections, si, -1) })}>
                    <ArrowUpIcon className="h-4 w-4" />
                  </Button>
                  <Button isIconOnly size="sm" variant="light" aria-label="Move section down" onPress={() => onChange({ sections: move(schema.sections, si, 1) })}>
                    <ArrowDownIcon className="h-4 w-4" />
                  </Button>
                  <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Delete section" isDisabled={schema.sections.length <= 1} onPress={() => onChange({ sections: schema.sections.filter((_, i) => i !== si) })}>
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <ul className="divide-y divide-line">
                {section.fields.map((f, fi) => (
                  <li key={f.id} className="grid grid-cols-1 gap-2 p-3 md:grid-cols-[minmax(0,1fr)_150px_auto]">
                    <Input aria-label="Question" size="sm" variant="bordered" placeholder="Question text" value={f.label} onValueChange={(label) => setField(si, fi, { label })} />
                    <Select
                      aria-label="Answer type"
                      size="sm"
                      variant="bordered"
                      selectedKeys={[f.type]}
                      onSelectionChange={(keys) => {
                        const t = (keys === 'all' ? 'text' : String(Array.from(keys)[0] ?? 'text')) as FormFieldType;
                        setField(si, fi, {
                          type: t,
                          options: t === 'select' ? f.options ?? ['Option 1', 'Option 2'] : undefined,
                          columns: t === 'table' ? f.columns ?? [{ id: uid('c'), label: 'Column 1', type: 'text' }] : undefined,
                        });
                      }}
                    >
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t.key}>{t.label}</SelectItem>
                      ))}
                    </Select>
                    <div className="flex items-center gap-1">
                      <Switch size="sm" isSelected={!!f.required} onValueChange={(required) => setField(si, fi, { required })} aria-label="Required">
                        <span className="text-[12px]">Required</span>
                      </Switch>
                      <Button isIconOnly size="sm" variant="light" aria-label="Move question up" onPress={() => setSection(si, { fields: move(section.fields, fi, -1) })}>
                        <ArrowUpIcon className="h-4 w-4" />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" aria-label="Move question down" onPress={() => setSection(si, { fields: move(section.fields, fi, 1) })}>
                        <ArrowDownIcon className="h-4 w-4" />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Delete question" isDisabled={section.fields.length <= 1 && schema.sections.length <= 1} onPress={() => setSection(si, { fields: section.fields.filter((_, i) => i !== fi) })}>
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    {f.type === 'select' && (
                      <Input
                        aria-label="Options"
                        size="sm"
                        variant="bordered"
                        className="md:col-span-3"
                        description="Options, separated by commas"
                        value={(f.options ?? []).join(', ')}
                        onValueChange={(x) => setField(si, fi, { options: x.split(',').map((o) => o.trim()).filter(Boolean) })}
                      />
                    )}
                    {f.type === 'table' && (
                      <div className="grid grid-cols-1 gap-2 md:col-span-3 md:grid-cols-[minmax(0,1fr)_140px]">
                        <Input
                          aria-label="Columns"
                          size="sm"
                          variant="bordered"
                          description="Columns, separated by commas"
                          value={(f.columns ?? []).map((c) => c.label).join(', ')}
                          onValueChange={(x) => {
                            const labels = x.split(',').map((o) => o.trim()).filter(Boolean);
                            setField(si, fi, { columns: labels.map((label, i) => ({ id: f.columns?.find((c) => c.label === label)?.id ?? `c${i + 1}`, label, type: f.columns?.find((c) => c.label === label)?.type ?? 'text' })) });
                          }}
                        />
                        <Input aria-label="Minimum rows" size="sm" type="number" min={0} variant="bordered" description="Minimum rows" value={String(f.min_rows ?? 0)} onValueChange={(x) => setField(si, fi, { min_rows: Math.max(0, Number(x) || 0) })} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-3 py-2">
                <Button size="sm" variant="light" color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setSection(si, { fields: [...section.fields, { id: uid('f'), label: '', type: 'text', required: false }] })}>
                  Add question
                </Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="flat" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => onChange({ sections: [...schema.sections, { id: uid('s'), title: `Section ${schema.sections.length + 1}`, fields: [{ id: uid('f'), label: '', type: 'text', required: false }] }] })}>
            Add section
          </Button>
        </>
      )}
      <div className="rounded-xl border border-dashed border-line-2 border-line p-4">
        <Input
          id="req-ezform"
          label="Use an EZForm template instead (optional)"
          labelPlacement="outside"
          placeholder="EZForm template ID"
          variant="bordered"
          value={ezformId}
          onValueChange={(x) => onEzform(x.trim() || null)}
          description="Once the ezformsapi integration is live, contractors fill this template in EZForm, with its stages and submit rules, and the finished record becomes the evidence. The built-in questions above are the fallback."
        />
      </div>
    </div>
  );
}

function TrainingEditor({ training, onChange }: { training: TrainingContent; onChange: (t: TrainingContent) => void }) {
  const set = (patch: Partial<TrainingContent>) => onChange({ ...training, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input id="tr-duration" type="number" label="Length in minutes" labelPlacement="outside" placeholder=" " variant="bordered" value={String(training.duration_min)} onValueChange={(x) => set({ duration_min: Math.max(1, Number(x) || 1) })} />
        <Input id="tr-pass" type="number" label="Pass mark (%)" labelPlacement="outside" placeholder=" " variant="bordered" value={String(training.pass_mark)} onValueChange={(x) => set({ pass_mark: Math.min(100, Math.max(1, Number(x) || 1)) })} />
      </div>
      <div>
        <p className="mb-2 text-[13px] font-medium text-ink">Slides</p>
        <ol className="space-y-3">
          {training.slides.map((s, i) => (
            <li key={s.id} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[12px] text-ink-3">Slide {i + 1}</span>
                <div className="ml-auto flex gap-1">
                  <Button isIconOnly size="sm" variant="light" aria-label="Move slide up" onPress={() => set({ slides: move(training.slides, i, -1) })}>
                    <ArrowUpIcon className="h-4 w-4" />
                  </Button>
                  <Button isIconOnly size="sm" variant="light" aria-label="Move slide down" onPress={() => set({ slides: move(training.slides, i, 1) })}>
                    <ArrowDownIcon className="h-4 w-4" />
                  </Button>
                  <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Delete slide" isDisabled={training.slides.length <= 1} onPress={() => set({ slides: training.slides.filter((_, j) => j !== i) })}>
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Input aria-label="Slide title" size="sm" variant="bordered" placeholder="Slide title" value={s.title} onValueChange={(title) => set({ slides: training.slides.map((x, j) => (j === i ? { ...x, title } : x)) })} />
              <Textarea aria-label="Slide text" variant="bordered" minRows={2} placeholder="What people need to know" className="mt-2" value={s.body} onValueChange={(body) => set({ slides: training.slides.map((x, j) => (j === i ? { ...x, body } : x)) })} />
            </li>
          ))}
        </ol>
        <Button size="sm" variant="light" color="primary" className="mt-2" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => set({ slides: [...training.slides, { id: uid('s'), title: '', body: '' }] })}>
          Add slide
        </Button>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-medium text-ink">Quiz</p>
        <ol className="space-y-3">
          {training.quiz.map((q, i) => (
            <li key={q.id} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[12px] text-ink-3">Question {i + 1}</span>
                <Button isIconOnly size="sm" variant="light" color="danger" className="ml-auto" aria-label="Delete question" isDisabled={training.quiz.length <= 1} onPress={() => set({ quiz: training.quiz.filter((_, j) => j !== i) })}>
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
              <Input aria-label="Question" size="sm" variant="bordered" placeholder="Question" value={q.prompt} onValueChange={(prompt) => set({ quiz: training.quiz.map((x, j) => (j === i ? { ...x, prompt } : x)) })} />
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_200px]">
                <Textarea
                  aria-label="Answer options"
                  variant="bordered"
                  minRows={2}
                  description="One option per line"
                  value={q.options.join('\n')}
                  onValueChange={(x) => {
                    const options = x.split('\n');
                    set({ quiz: training.quiz.map((y, j) => (j === i ? { ...y, options, answer: Math.min(y.answer, Math.max(0, options.length - 1)) } : y)) });
                  }}
                />
                <Select
                  aria-label="Correct answer"
                  size="sm"
                  variant="bordered"
                  description="Correct answer"
                  selectedKeys={[String(q.answer)]}
                  onSelectionChange={(keys) => {
                    const a = keys === 'all' ? 0 : Number(Array.from(keys)[0] ?? 0);
                    set({ quiz: training.quiz.map((y, j) => (j === i ? { ...y, answer: a } : y)) });
                  }}
                >
                  {q.options.map((o, oi) => (
                    <SelectItem key={String(oi)}>{o.trim() || `Option ${oi + 1}`}</SelectItem>
                  ))}
                </Select>
              </div>
            </li>
          ))}
        </ol>
        <Button size="sm" variant="light" color="primary" className="mt-2" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => set({ quiz: [...training.quiz, { id: uid('q'), prompt: '', options: ['', ''], answer: 0 }] })}>
          Add question
        </Button>
      </div>
    </div>
  );
}

function PolicyEditor({ policy, onChange }: { policy: PolicyContent; onChange: (p: PolicyContent) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Textarea
        id="policy-body"
        label="Policy text"
        labelPlacement="outside"
        placeholder="Paste the policy people need to read before signing"
        variant="bordered"
        minRows={8}
        maxRows={20}
        value={policy.body}
        onValueChange={(body) => onChange({ ...policy, body })}
      />
      <Input
        id="policy-confirm"
        label="What they confirm by signing"
        labelPlacement="outside"
        placeholder="I have read and accept this policy."
        variant="bordered"
        value={policy.confirm_text}
        onValueChange={(confirm_text) => onChange({ ...policy, confirm_text })}
      />
    </div>
  );
}
