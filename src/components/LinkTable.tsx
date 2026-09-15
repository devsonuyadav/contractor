'use client';

import { useRouter } from 'next/navigation';
import { Chip } from '@heroui/react';
import type { LinkRow } from '@/lib/types';
import { plural } from '@/lib/describe';
import { CompliantChip, ProgressLine } from './ui';

/** Contractors (seen by a client) or clients (seen by a contractor). */
export default function LinkTable({ rows, hrefBase, side }: { rows: LinkRow[]; hrefBase: string; side: 'contractors' | 'clients' }) {
  const router = useRouter();
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>{side === 'contractors' ? 'Contractor' : 'Client'}</th>
            <th>Done</th>
            <th>Status</th>
            <th>{side === 'contractors' ? 'Needs you' : 'Needs attention'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const open = () => router.push(`${hrefBase}/${r.id}`);
            return (
              <tr key={r.id} className="clickable" onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()} tabIndex={0}>
                <td>
                  <p className="font-medium text-ink">{r.company.name}</p>
                  <p className="text-[12px] text-ink-3">
                    {[r.company.trade, side === 'contractors' ? plural(r.people, 'person', 'people') : ''].filter(Boolean).join(' · ')}
                    {side === 'clients' && r.added_by === 'CONTRACTOR' && (
                      <Chip size="sm" variant="flat" className="ml-2 h-5 text-[11px]">
                        Tracked by you
                      </Chip>
                    )}
                  </p>
                </td>
                <td>
                  <ProgressLine progress={r.progress} />
                </td>
                <td>
                  <CompliantChip compliant={r.compliant} progress={r.progress} />
                </td>
                <td className="text-[12.5px] text-ink-2">
                  {[
                    side === 'contractors' && r.to_review ? `${r.to_review} to review` : '',
                    side === 'clients' && r.to_review ? `${r.to_review} waiting for ${r.company.name}` : '',
                    r.problems ? `${r.problems} missing or expired` : '',
                    r.expiring ? `${r.expiring} expiring soon` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
