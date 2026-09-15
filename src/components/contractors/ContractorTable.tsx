'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Chip } from '@heroui/react';
import type { ContractorRow } from '@/lib/types';
import { ScoreBar, StatusChip } from '@/components/ui';

function Attention({ r }: { r: ContractorRow }) {
  const chips: { label: string; color: 'danger' | 'warning' | 'primary' | 'secondary' | 'default' }[] = [];
  if (r.expired) chips.push({ label: `${r.expired} expired`, color: 'danger' });
  if (r.awaiting_review) chips.push({ label: `${r.awaiting_review} to review`, color: 'primary' });
  if (r.awaiting_sponsor && r.sponsor) chips.push({ label: `${r.awaiting_sponsor} with ${r.sponsor.name.split(' ')[0]}`, color: 'default' });
  if (r.exceptions) chips.push({ label: `${r.exceptions} exception`, color: 'secondary' });
  if (r.expiring) chips.push({ label: `${r.expiring} expiring`, color: 'warning' });
  if (r.open_items && !chips.length) chips.push({ label: `${r.open_items} open`, color: 'default' });
  if (!chips.length) return <span className="text-ink-3">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <Chip key={c.label} size="sm" variant="flat" color={c.color}>
          {c.label}
        </Chip>
      ))}
    </div>
  );
}

export default function ContractorTable({ rows, showTags = false }: { rows: ContractorRow[]; showTags?: boolean }) {
  const router = useRouter();
  return (
    <div className="table-scroll">
      <table className="data-table min-w-[900px]">
        <thead>
          <tr>
            <th>Contractor</th>
            <th>Status</th>
            <th>Company compliance</th>
            <th>Worker compliance</th>
            <th>Needs attention</th>
            <th>Sites</th>
            {showTags && <th>Tags</th>}
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="clickable" onClick={() => router.push(`/contractors/${r.id}`)}>
              <td>
                <p className="font-medium text-ink">{r.name}</p>
                <p className="text-[12px] text-ink-3">
                  {r.trade} · {r.worker_count} {r.worker_count === 1 ? 'worker' : 'workers'}
                  {r.subcontractors ? ` · ${r.subcontractors} ${r.subcontractors === 1 ? 'sub' : 'subs'}` : ''}
                </p>
                {r.sponsor && <p className="text-[12px] text-primary-700">↳ Subcontractor of {r.sponsor.name}</p>}
              </td>
              <td>
                <StatusChip status={r.status} />
              </td>
              <td>
                <ScoreBar score={r.company_score} />
              </td>
              <td>
                <ScoreBar score={r.worker_score} />
              </td>
              <td>
                <Attention r={r} />
              </td>
              <td className="max-w-[220px] text-[12.5px] text-ink-2">{r.site_names.length ? r.site_names.join(', ') : <span className="text-ink-3">None</span>}</td>
              {showTags && (
                <td>
                  <div className="flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <Chip key={t} size="sm" variant="bordered">
                        {t}
                      </Chip>
                    ))}
                  </div>
                </td>
              )}
              <td className="text-right">
                <Link href={`/contractors/${r.id}`} className="text-[13px] font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
