'use client';

import Link from 'next/link';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { Chip, Progress, Tooltip } from '@heroui/react';
import { AcademicCapIcon, ArrowUpTrayIcon, DocumentTextIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import type { ContractorStatus, HistoryEntry, RequirementType, Score, SlotState } from '@/lib/types';
import { STATE_META, STATUS_META, TYPE_META } from '@/lib/describe';
import { fmtDateTime } from '@/lib/dates';

export type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: { href: string; label: string }[];
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumbs && (
          <nav className="mb-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3" aria-label="Breadcrumb">
            {crumbs.map((c) => (
              <span key={c.href} className="flex items-center gap-1.5">
                <Link href={c.href} className="hover:text-primary hover:underline">
                  {c.label}
                </Link>
                <span aria-hidden>/</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[24px] font-semibold leading-tight text-ink">{title}</h1>
        {description && <div className="mt-1 max-w-3xl text-ink-2">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClass = 'p-4',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[14.5px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="text-[12px] text-ink-3">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function StatusChip({ status, size = 'sm' }: { status: ContractorStatus; size?: 'sm' | 'md' }) {
  const m = STATUS_META[status];
  return (
    <Tooltip content={m.hint} delay={400}>
      <Chip size={size} variant="flat" color={m.color} className="font-medium">
        {status}
      </Chip>
    </Tooltip>
  );
}

export function StateChip({ state, extra }: { state: SlotState; extra?: string }) {
  const m = STATE_META[state];
  return (
    <Chip size="sm" variant="flat" color={m.color} className="font-medium">
      {m.label}
      {extra ? ` · ${extra}` : ''}
    </Chip>
  );
}

export const TYPE_ICON: Record<RequirementType, IconType> = {
  FORM: DocumentTextIcon,
  DOCUMENT: ArrowUpTrayIcon,
  TRAINING: AcademicCapIcon,
  SIGNOFF: PencilSquareIcon,
};

export function TypeBadge({ type, label = true }: { type: RequirementType; label?: boolean }) {
  const Icon = TYPE_ICON[type];
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-2" title={TYPE_META[type].label}>
      <Icon className="h-4 w-4 shrink-0 text-ink-3" />
      {label && <span>{TYPE_META[type].short}</span>}
    </span>
  );
}

export function TypeIconTile({ type, className = '' }: { type: RequirementType; className?: string }) {
  const Icon = TYPE_ICON[type];
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary ${className}`}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function scoreColor(pct: number): 'success' | 'primary' | 'warning' | 'danger' {
  if (pct >= 100) return 'success';
  if (pct >= 75) return 'primary';
  if (pct >= 50) return 'warning';
  return 'danger';
}

export function ScoreBar({ score, width = 'min-w-[130px]' }: { score: Score; width?: string }) {
  if (score.pct === null) return <span className="text-ink-3">—</span>;
  return (
    <Tooltip content={`${score.compliant} of ${score.total} scored items compliant`} delay={300}>
      <div className={`flex items-center gap-2 ${width}`}>
        <span className="tabular w-10 text-right font-medium text-ink">{score.pct}%</span>
        <Progress aria-label="Compliance score" size="sm" value={score.pct} color={scoreColor(score.pct)} className="flex-1" />
      </div>
    </Tooltip>
  );
}

export interface DonutSegment {
  key: string;
  value: number;
  color: string;
}

export function Donut({
  segments,
  size = 164,
  thickness = 20,
  label,
  sublabel,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  label?: ReactNode;
  sublabel?: string;
}) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((n, s) => n + s.value, 0) || 1;
  const gap = shown.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={sublabel ?? 'Chart'}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF0F6" strokeWidth={thickness} />
      {shown.map((s) => {
        const len = (s.value / total) * circ;
        const dash = Math.max(0, len - gap);
        const el = (
          <circle
            key={s.key}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
      {label !== undefined && (
        <text x="50%" y="49%" textAnchor="middle" dominantBaseline="middle" fill="#1A202C" style={{ fontSize: 28, fontWeight: 600 }}>
          {label}
        </text>
      )}
      {sublabel && (
        <text x="50%" y="64%" textAnchor="middle" fill="#6E7191" style={{ fontSize: 11 }}>
          {sublabel}
        </text>
      )}
    </svg>
  );
}

export function EmptyState({ title, body, action, icon: Icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: IconType }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {Icon && <Icon className="h-8 w-8 text-ink-3" />}
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="max-w-md text-[13px] text-ink-3">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function KV({ items, labelWidth = '9.5rem' }: { items: [ReactNode, ReactNode][]; labelWidth?: string }) {
  return (
    <dl className="grid gap-x-4 gap-y-2 text-[13px]" style={{ gridTemplateColumns: `${labelWidth} minmax(0,1fr)` }}>
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Timeline({ entries }: { entries: HistoryEntry[] }) {
  const list = [...entries].reverse();
  return (
    <ol className="relative space-y-3 border-l border-line pl-4">
      {list.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ${i === 0 ? 'bg-primary' : 'bg-gray-300'}`} />
          <p className="text-[13px] text-ink">
            <span className="font-medium">{e.action}</span>
            <span className="text-ink-3"> · {e.by}</span>
          </p>
          <p className="text-[11.5px] text-ink-3">{fmtDateTime(e.at)}</p>
          {e.note && <p className="mt-1 rounded-md bg-gray-50 px-2 py-1.5 text-[12.5px] text-ink-2">“{e.note}”</p>}
        </li>
      ))}
    </ol>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
  href?: string;
}) {
  const bar = { neutral: 'bg-gray-300', good: 'bg-success', warn: 'bg-warning', bad: 'bg-danger', info: 'bg-primary' }[tone];
  const inner = (
    <div className="card relative h-full overflow-hidden px-4 py-3.5">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className="tabular mt-0.5 text-[26px] font-semibold leading-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'bad' | 'good'; title?: ReactNode; children?: ReactNode }) {
  const styles = {
    info: 'bg-primary-50 border-primary-200 text-primary-800',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
    bad: 'bg-red-50 border-red-200 text-red-900',
    good: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  }[tone];
  return (
    <div className={`rounded-lg border px-3.5 py-3 text-[13px] ${styles}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
    </div>
  );
}

export const STATUS_COLORS: Record<ContractorStatus, string> = {
  Approved: '#12A150',
  Pending: '#E3A008',
  New: '#A1A1AA',
  Denied: '#E5484D',
};
