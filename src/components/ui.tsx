'use client';

import Link from 'next/link';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { Chip, Progress as ProgressBar } from '@heroui/react';
import type { ItemState, Progress } from '@/lib/types';
import { STATE_META } from '@/lib/describe';

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

export function StateChip({ state }: { state: ItemState }) {
  const m = STATE_META[state];
  return (
    <Chip size="sm" variant="flat" color={m.color} className="font-medium">
      {m.label}
    </Chip>
  );
}

/** "5 of 7 done" with a bar. */
export function ProgressLine({ progress, className = 'min-w-[150px]' }: { progress: Progress; className?: string }) {
  if (!progress.total) return <span className="text-ink-3">Nothing asked yet</span>;
  const pct = Math.round((progress.done * 100) / progress.total);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ProgressBar aria-label="Done" size="sm" value={pct} color={pct === 100 ? 'success' : pct >= 60 ? 'warning' : 'danger'} className="flex-1" />
      <span className="tabular whitespace-nowrap text-[12.5px] text-ink-2">
        {progress.done} of {progress.total}
      </span>
    </div>
  );
}

export function CompliantChip({ compliant, progress }: { compliant: boolean; progress?: Progress }) {
  if (progress && !progress.total) return null;
  return (
    <Chip size="sm" variant="flat" color={compliant ? 'success' : 'danger'} className="font-medium">
      {compliant ? 'All good' : 'Missing items'}
    </Chip>
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

export function Stat({ label, value, hint, tone = 'neutral', href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info'; href?: string }) {
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
