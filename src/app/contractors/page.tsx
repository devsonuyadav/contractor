'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, SelectItem, Spinner, Switch } from '@heroui/react';
import { ArrowDownTrayIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import AddContractorModal from '@/components/contractors/AddContractorModal';
import ContractorTable from '@/components/contractors/ContractorTable';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import type { ContractorRow, ContractorStatus } from '@/lib/types';
import { useContractors, useSessionContext, useSites } from '@/services/queries';

const STATUSES: ContractorStatus[] = ['New', 'Pending', 'Approved', 'Denied'];

function needsAttention(r: ContractorRow): boolean {
  return r.expired > 0 || r.awaiting_review > 0 || r.exceptions > 0 || r.expiring > 0 || r.status === 'Pending';
}

function toCsv(rows: ContractorRow[]): string {
  const head = ['Contractor', 'Trade', 'Status', 'Company compliance %', 'Worker compliance %', 'Workers', 'Open items', 'To review', 'Expiring', 'Expired', 'Sites', 'Tags', 'Contact', 'Email', 'Phone'];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [r.name, r.trade, r.status, r.company_score.pct ?? '', r.worker_score.pct ?? '', r.worker_count, r.open_items, r.awaiting_review, r.expiring, r.expired, r.site_names.join('; '), r.tags.join('; '), r.contact.name, r.contact.email, r.contact.phone]
      .map(esc)
      .join(','),
  );
  return [head.join(','), ...lines].join('\n');
}

export default function ContractorsPage() {
  const { data, isLoading } = useContractors();
  const { data: sites } = useSites();
  const { data: ctx } = useSessionContext();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [site, setSite] = useState<string>('all');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [adding, setAdding] = useState(false);

  // ?status=Approved from the dashboard donut
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    if (s && STATUSES.includes(s as ContractorStatus)) setStatus(s);
  }, []);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (site !== 'all' && !r.site_ids.includes(site)) return false;
      if (attentionOnly && !needsAttention(r)) return false;
      if (term && ![r.name, r.trade, r.contact.name, ...r.tags].some((v) => v.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [data, q, status, site, attentionOnly]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contractors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Contractors"
        description={`Every company invited to work on ${ctx?.org.name ?? 'your'} sites, with their approval status and live compliance.`}
        actions={
          <>
            <Button variant="flat" startContent={<ArrowDownTrayIcon className="h-4 w-4" />} onPress={exportCsv} isDisabled={!rows.length}>
              Export CSV
            </Button>
            <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setAdding(true)}>
              Add contractor
            </Button>
          </>
        }
      />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <Input
            id="contractor-search"
            aria-label="Search contractors"
            placeholder="Search by name, trade, contact or tag"
            startContent={<MagnifyingGlassIcon className="h-4 w-4 text-ink-3" />}
            variant="bordered"
            value={q}
            onValueChange={setQ}
            className="w-full sm:max-w-xs"
          />
          <Select
            id="contractor-status"
            aria-label="Status"
            variant="bordered"
            className="w-full sm:w-44"
            selectedKeys={[status]}
            onSelectionChange={(keys) => setStatus(keys === 'all' ? 'all' : String(Array.from(keys)[0] ?? 'all'))}
          >
            {[{ key: 'all', label: 'All statuses' }, ...STATUSES.map((s) => ({ key: s, label: s }))].map((o) => (
              <SelectItem key={o.key}>{o.label}</SelectItem>
            ))}
          </Select>
          <Select
            id="contractor-site"
            aria-label="Site"
            variant="bordered"
            className="w-full sm:w-64"
            selectedKeys={[site]}
            onSelectionChange={(keys) => setSite(keys === 'all' ? 'all' : String(Array.from(keys)[0] ?? 'all'))}
          >
            {[{ key: 'all', label: 'All projects & sites' }, ...(sites ?? []).map((s) => ({ key: s.id, label: s.name }))].map((o) => (
              <SelectItem key={o.key}>{o.label}</SelectItem>
            ))}
          </Select>
          <Switch id="contractor-attention" size="sm" isSelected={attentionOnly} onValueChange={setAttentionOnly} className="pb-2">
            <span className="text-[13px]">Needs attention</span>
          </Switch>
          <span className="ml-auto pb-2 text-[12.5px] text-ink-3">
            {rows.length} of {data?.length ?? 0}
          </span>
        </div>
        {isLoading ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : rows.length ? (
          <ContractorTable rows={rows} showTags />
        ) : (
          <EmptyState title="No contractors match" body="Clear the filters or add a contractor." />
        )}
      </Card>
      <AddContractorModal isOpen={adding} onClose={() => setAdding(false)} onCreated={(id) => router.push(`/contractors/${id}`)} />
    </>
  );
}
