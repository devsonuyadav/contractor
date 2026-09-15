'use client';

import { Button, Checkbox, Input, Radio, RadioGroup, Select, SelectItem, Textarea } from '@heroui/react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { FormField, FormSchema } from '@/lib/types';
import type { TableRow } from '@/lib/forms';
import { fmtDate } from '@/lib/dates';

type Answers = Record<string, unknown>;

const dateText = (v: string) => (v ? fmtDate(new Date(`${v}T12:00:00`).toISOString()) : '—');

export default function FormRenderer({
  schema,
  value,
  onChange,
  readOnly = false,
  invalid,
}: {
  schema: FormSchema;
  value: Answers;
  onChange?: (next: Answers) => void;
  readOnly?: boolean;
  invalid?: Set<string>;
}) {
  return (
    <div className="space-y-7">
      {schema.sections.map((section, i) => (
        <section key={section.id} aria-labelledby={`sec-${section.id}`}>
          <h3 id={`sec-${section.id}`} className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
            <span className="grid h-5 w-5 place-items-center rounded bg-primary-50 text-[11px] text-primary">{i + 1}</span>
            {section.title}
          </h3>
          {/* flex gap, not space-y: space-y's margin-top overrides the room HeroUI reserves for outside labels */}
          <div className={readOnly ? 'flex flex-col gap-3' : 'flex flex-col gap-6'}>
            {section.fields.map((f) =>
              readOnly ? (
                <ReadField key={f.id} field={f} value={value[f.id]} />
              ) : (
                <EditField key={f.id} field={f} value={value[f.id]} invalid={!!invalid?.has(f.id)} onChange={(v) => onChange?.({ ...value, [f.id]: v })} />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function EditField({ field: f, value, invalid, onChange }: { field: FormField; value: unknown; invalid: boolean; onChange: (v: unknown) => void }) {
  const common = {
    id: `field-${f.id}`,
    label: f.label,
    labelPlacement: 'outside' as const,
    isRequired: f.required,
    description: f.help,
    isInvalid: invalid,
    errorMessage: invalid ? 'This question needs an answer.' : undefined,
    variant: 'bordered' as const,
  };
  const text = value === undefined || value === null ? '' : String(value);
  switch (f.type) {
    case 'text':
      return <Input {...common} placeholder=" " value={text} onValueChange={onChange} />;
    case 'number':
      return <Input {...common} type="number" placeholder=" " value={text} onValueChange={onChange} className="max-w-xs" />;
    case 'date':
      return <Input {...common} type="date" placeholder=" " value={text} onValueChange={onChange} className="max-w-xs" />;
    case 'textarea':
      return <Textarea {...common} placeholder=" " minRows={3} value={text} onValueChange={onChange} />;
    case 'select':
      return (
        <Select
          {...common}
          placeholder="Choose one"
          className="max-w-md"
          selectedKeys={text ? [text] : []}
          onSelectionChange={(keys) => {
            const k = keys === 'all' ? '' : Array.from(keys)[0];
            onChange(k ? String(k) : '');
          }}
        >
          {(f.options ?? []).map((o) => (
            <SelectItem key={o}>{o}</SelectItem>
          ))}
        </Select>
      );
    case 'yesno':
      return (
        <RadioGroup
          id={`field-${f.id}`}
          label={f.label}
          isRequired={f.required}
          description={f.help}
          orientation="horizontal"
          value={text}
          onValueChange={onChange}
          isInvalid={invalid}
          errorMessage={invalid ? 'Choose yes or no.' : undefined}
          classNames={{ label: 'text-[13px] text-ink' }}
        >
          <Radio value="Yes">Yes</Radio>
          <Radio value="No">No</Radio>
        </RadioGroup>
      );
    case 'checkbox':
      return (
        <div>
          <Checkbox id={`field-${f.id}`} isSelected={value === true} onValueChange={onChange} isInvalid={invalid}>
            <span className="text-[13px]">
              {f.label}
              {f.required && <span className="text-danger"> *</span>}
            </span>
          </Checkbox>
          {invalid && <p className="mt-1 text-tiny text-danger">Tick this box to continue.</p>}
        </div>
      );
    case 'table':
      return <TableField field={f} value={value} invalid={invalid} onChange={onChange} />;
  }
}

function TableField({ field: f, value, invalid, onChange }: { field: FormField; value: unknown; invalid: boolean; onChange: (v: unknown) => void }) {
  const cols = f.columns ?? [];
  const rows = Array.isArray(value) ? (value as TableRow[]) : [];
  const minRows = Math.max(1, f.min_rows ?? 1);
  const shown: TableRow[] = rows.length >= minRows ? rows : [...rows, ...Array.from({ length: minRows - rows.length }, () => ({}))];
  const setCell = (ri: number, cid: string, v: string) => onChange(shown.map((r, i) => (i === ri ? { ...r, [cid]: v } : r)));
  return (
    <div>
      <p className="mb-1 text-[13px] text-ink">
        {f.label}
        {f.required && <span className="text-danger"> *</span>}
      </p>
      {f.help && <p className="mb-2 text-[12px] text-ink-3">{f.help}</p>}
      <div id={`field-${f.id}`} className={`table-scroll rounded-lg border ${invalid ? 'border-danger' : 'border-line'}`}>
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.id} className="border-b border-line bg-[#FAFAFD] px-2 py-2 text-left text-[12px] font-medium text-ink-3">
                  {c.label}
                </th>
              ))}
              <th className="w-10 border-b border-line bg-[#FAFAFD]" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r, ri) => (
              <tr key={ri} className="border-b border-line last:border-b-0">
                {cols.map((c) => (
                  <td key={c.id} className="px-1.5 py-1.5">
                    <input
                      aria-label={`${c.label}, row ${ri + 1}`}
                      type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                      step={c.type === 'number' ? 'any' : undefined}
                      value={r[c.id] ?? ''}
                      onChange={(e) => setCell(ri, c.id, e.target.value)}
                      className="w-full min-w-[90px] rounded-md border border-transparent bg-gray-50 px-2 py-1.5 outline-none focus:border-primary focus:bg-white"
                    />
                  </td>
                ))}
                <td className="px-1 text-center">
                  <button
                    type="button"
                    onClick={() => onChange(shown.filter((_, i) => i !== ri))}
                    disabled={shown.length <= minRows}
                    className="rounded p-1 text-ink-3 hover:text-danger disabled:opacity-30"
                    aria-label={`Remove row ${ri + 1}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="sm" variant="light" color="primary" className="mt-1.5" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => onChange([...shown, {}])}>
        Add row
      </Button>
      {invalid && <p className="text-tiny text-danger">{minRows > 1 ? `Fill in at least ${minRows} rows.` : 'Add at least one row.'}</p>}
    </div>
  );
}

function ReadField({ field: f, value }: { field: FormField; value: unknown }) {
  if (f.type === 'table') {
    const cols = f.columns ?? [];
    const rows = (Array.isArray(value) ? value : []) as TableRow[];
    const filled = rows.filter((r) => Object.values(r ?? {}).some((x) => String(x ?? '').trim()));
    return (
      <div>
        <p className="mb-1 text-[12.5px] text-ink-3">{f.label}</p>
        {filled.length ? (
          <div className="table-scroll rounded-lg border border-line">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c.id} className="border-b border-line bg-[#FAFAFD] px-3 py-1.5 text-left text-[12px] font-medium text-ink-3">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filled.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-b-0">
                    {cols.map((c) => (
                      <td key={c.id} className="tabular px-3 py-1.5 text-ink">
                        {c.type === 'date' ? dateText(r[c.id] ?? '') : r[c.id] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-ink-2">None reported</p>
        )}
      </div>
    );
  }
  let text: string;
  if (f.type === 'checkbox') text = value === true ? '✓ Confirmed' : 'Not confirmed';
  else if (f.type === 'date') text = dateText(String(value ?? ''));
  else text = value === undefined || value === null || String(value).trim() === '' ? '—' : String(value);
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-dashed border-line pb-2 last:border-b-0 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:gap-4">
      <p className="text-[12.5px] text-ink-3">{f.label}</p>
      <p className="whitespace-pre-wrap text-[13.5px] text-ink">{text}</p>
    </div>
  );
}
