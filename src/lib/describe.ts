import type { AppliesTo, ContractorStatus, RequirementType, SlotState, TaskKind, Validity } from './types';

export type ChipColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

export const TYPE_META: Record<RequirementType, { label: string; short: string; examples: string; action: string }> = {
  FORM: {
    label: 'Form',
    short: 'Form',
    examples: 'Prequalification questionnaires, incident history, self-assessments',
    action: 'Fill in',
  },
  DOCUMENT: {
    label: 'Document upload',
    short: 'Document',
    examples: 'Insurance certificates, licences, operator cards, permits',
    action: 'Upload',
  },
  TRAINING: {
    label: 'Training',
    short: 'Training',
    examples: 'Site orientation, working at heights, task-specific courses',
    action: 'Take course',
  },
  SIGNOFF: {
    label: 'Policy signoff',
    short: 'Signoff',
    examples: 'Site safety rules, drug & alcohol policy, code of conduct',
    action: 'Read & sign',
  },
};

export const STATUS_META: Record<ContractorStatus, { color: ChipColor; hint: string }> = {
  New: { color: 'default', hint: "Invited, but hasn't submitted an application yet." },
  Pending: { color: 'warning', hint: 'Application submitted and waiting for a decision.' },
  Approved: { color: 'success', hint: 'Approved to work, as long as they stay compliant.' },
  Denied: { color: 'danger', hint: 'Not approved to work.' },
};

export const STATE_META: Record<SlotState, { label: string; color: ChipColor }> = {
  NOT_STARTED: { label: 'Not started', color: 'default' },
  SUBMITTED: { label: 'Awaiting review', color: 'primary' },
  REJECTED: { label: 'Sent back', color: 'danger' },
  APPROVED: { label: 'Approved', color: 'success' },
  EXPIRING: { label: 'Expiring', color: 'warning' },
  EXPIRED: { label: 'Expired', color: 'danger' },
  WAIVED: { label: 'Exception', color: 'secondary' },
};

export const TASK_META: Record<TaskKind, { label: string }> = {
  REVIEW: { label: 'Submission' },
  EXCEPTION: { label: 'Exception request' },
  APPLICATION: { label: 'Application' },
  SPONSOR_CHECK: { label: 'Subcontractor check' },
};

export function describeValidity(v: Validity): string {
  if (v.kind === 'NONE') return "Doesn't expire";
  if (v.kind === 'DOCUMENT_DATE') return 'Expires on the date shown on the document';
  const unit = v.every === 1 ? v.unit.replace(/s$/, '') : v.unit;
  return `Valid for ${v.every} ${unit} after completion`;
}

export function describeApplies(a: AppliesTo): string {
  return a === 'COMPANY' ? 'Once per company' : 'Each worker';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Riverside Energy's", "Delta Mechanical Services'". */
export function possessive(name: string): string {
  return /s$/i.test(name.trim()) ? `${name}'` : `${name}'s`;
}

/** The name people use in running text after the first full mention: "Delta" for "Delta Mechanical Services". */
export function shortOrg(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "A", "A and B", "A, B and C". */
export function listNames(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
