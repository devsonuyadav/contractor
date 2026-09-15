import type { FormField, FormSchema } from './types';

export type TableRow = Record<string, string>;

export function isAnswered(field: FormField, value: unknown): boolean {
  switch (field.type) {
    case 'checkbox':
      return value === true;
    case 'yesno':
      return value === 'Yes' || value === 'No';
    case 'number':
      return value !== '' && value !== null && value !== undefined && !Number.isNaN(Number(value));
    case 'table': {
      const rows = Array.isArray(value) ? (value as TableRow[]) : [];
      const filled = rows.filter((r) => Object.values(r ?? {}).some((x) => String(x ?? '').trim() !== ''));
      return filled.length >= Math.max(1, field.min_rows ?? 1);
    }
    default:
      return typeof value === 'string' ? value.trim() !== '' : value !== null && value !== undefined;
  }
}

/** Labels of required questions that still need an answer. */
export function missingAnswers(schema: FormSchema | undefined, answers: Record<string, unknown> | undefined): string[] {
  if (!schema) return [];
  const out: string[] = [];
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.required && !isAnswered(field, answers?.[field.id])) out.push(field.label);
    }
  }
  return out;
}

export function countQuestions(schema: FormSchema | undefined): number {
  return schema?.sections.reduce((n, s) => n + s.fields.length, 0) ?? 0;
}
