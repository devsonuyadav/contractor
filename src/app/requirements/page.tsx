'use client';

import { useMemo, useState } from 'react';
import { Button, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Select, SelectItem, Spinner, Tab, Tabs } from '@heroui/react';
import { EllipsisHorizontalIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { ConfirmModal } from '@/components/contractors/ContractorModals';
import GroupEditor from '@/components/requirements/GroupEditor';
import RequirementEditor from '@/components/requirements/RequirementEditor';
import { Card, EmptyState, PageHeader, TypeBadge } from '@/components/ui';
import { describeApplies, describeValidity, plural, TYPE_META } from '@/lib/describe';
import type { GroupRow, RequirementRow, RequirementType } from '@/lib/types';
import { Api, useAction, useGroups, useRequirements } from '@/services/queries';

type TabKey = 'library' | 'groups';

export default function RequirementsPage() {
  const { data: requirements, isLoading } = useRequirements();
  const { data: groups } = useGroups();
  const [tab, setTab] = useState<TabKey>('library');
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('all');
  const [editor, setEditor] = useState<{ open: boolean; row: RequirementRow | null }>({ open: false, row: null });
  const [groupEditor, setGroupEditor] = useState<{ open: boolean; row: GroupRow | null }>({ open: false, row: null });
  const [confirm, setConfirm] = useState<{ kind: 'retire' | 'delete' | 'delete-group'; id: string; title: string } | null>(null);

  const retire = useAction((id: string) => Api.retireRequirement(id), (r) => `Retired. Removed from ${plural(r.removed, 'checklist item')}.`);
  const restore = useAction((id: string) => Api.restoreRequirement(id), (r) => `Restored. ${plural(r.added, 'checklist item')} assigned again.`);
  const remove = useAction((id: string) => Api.deleteRequirement(id), 'Requirement deleted');
  const cloneGroup = useAction((id: string) => Api.cloneGroup(id), 'Group cloned. Rename it and adjust the requirements.');
  const deleteGroup = useAction((id: string) => Api.deleteGroup(id), 'Group deleted');

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (requirements ?? []).filter((r) => (type === 'all' || r.type === type) && (!term || `${r.title} ${r.description}`.toLowerCase().includes(term)));
  }, [requirements, q, type]);

  const runConfirm = () => {
    if (!confirm) return;
    const done = { onSuccess: () => setConfirm(null) };
    if (confirm.kind === 'retire') retire.mutate(confirm.id, done);
    if (confirm.kind === 'delete') remove.mutate(confirm.id, done);
    if (confirm.kind === 'delete-group') deleteGroup.mutate(confirm.id, done);
  };

  return (
    <>
      <PageHeader
        title="Requirements"
        description="The library of things contractors must do, and the groups you assign to contractors and sites. Changes never rewrite what's already been approved."
        actions={
          tab === 'library' ? (
            <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setEditor({ open: true, row: null })}>
              Create requirement
            </Button>
          ) : (
            <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setGroupEditor({ open: true, row: null })}>
              Create group
            </Button>
          )
        }
      />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 pt-2">
          <Tabs aria-label="Requirements" variant="underlined" color="primary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as TabKey)} classNames={{ base: 'max-w-full', tabList: 'gap-6 max-w-full overflow-x-auto', tab: 'px-0 h-11 w-auto shrink-0', cursor: 'w-full' }}>
            <Tab key="library" title={`Library (${requirements?.filter((r) => !r.retired).length ?? 0})`} />
            <Tab key="groups" title={`Groups (${groups?.length ?? 0})`} />
          </Tabs>
          {tab === 'library' && (
            <div className="flex flex-wrap gap-2 pb-2">
              <Input id="req-search" aria-label="Search requirements" size="sm" variant="bordered" placeholder="Search" startContent={<MagnifyingGlassIcon className="h-4 w-4 text-ink-3" />} value={q} onValueChange={setQ} className="w-48" />
              <Select
                id="req-type"
                aria-label="Type"
                size="sm"
                variant="bordered"
                className="w-44"
                selectedKeys={[type]}
                onSelectionChange={(keys) => setType(keys === 'all' ? 'all' : String(Array.from(keys)[0] ?? 'all'))}
              >
                {[{ key: 'all', label: 'All types' }, ...(Object.keys(TYPE_META) as RequirementType[]).map((t) => ({ key: t, label: TYPE_META[t].label }))].map((o) => (
                  <SelectItem key={o.key}>{o.label}</SelectItem>
                ))}
              </Select>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : tab === 'library' ? (
          rows.length ? (
            <div className="table-scroll">
              <table className="data-table min-w-[1020px]">
                <thead>
                  <tr>
                    <th>Requirement</th>
                    <th>Type</th>
                    <th>Who</th>
                    <th>Validity</th>
                    <th>Scored</th>
                    <th>Review</th>
                    <th>In use</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={`clickable ${r.retired ? 'opacity-55' : ''}`} onClick={() => setEditor({ open: true, row: r })}>
                      <td className="max-w-[340px]">
                        <p className="font-medium text-ink">
                          {r.title}
                          {r.retired && (
                            <Chip size="sm" variant="flat" className="ml-2 h-5">
                              Retired
                            </Chip>
                          )}
                        </p>
                        <p className="truncate text-[12px] text-ink-3">{r.description}</p>
                      </td>
                      <td>
                        <TypeBadge type={r.type} />
                      </td>
                      <td className="text-ink-2">
                        {describeApplies(r.applies_to)}
                        {r.flows_down === false && <p className="text-[12px] text-ink-3">Direct contractors only</p>}
                      </td>
                      <td className="max-w-[220px] text-[12.5px] text-ink-2">{describeValidity(r.validity)}</td>
                      <td>{r.scored ? 'Yes' : <span className="text-ink-3">No</span>}</td>
                      <td>{r.needs_review ? 'Reviewer' : <span className="text-ink-3">Automatic</span>}</td>
                      <td className="text-[12.5px]">
                        {r.in_use ? (
                          <>
                            <p className="text-ink">{plural(r.contractors, 'contractor')}</p>
                            <p className="max-w-[200px] truncate text-ink-3">{r.group_names.join(', ')}</p>
                          </>
                        ) : r.group_names.length ? (
                          <p className="text-ink-3">In {r.group_names.join(', ')}</p>
                        ) : (
                          <span className="text-ink-3">Not in use</span>
                        )}
                        <p className="text-[11.5px] text-ink-3">v{r.version}</p>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Dropdown placement="bottom-end">
                          <DropdownTrigger>
                            <Button isIconOnly size="sm" variant="light" aria-label={`Actions for ${r.title}`}>
                              <EllipsisHorizontalIcon className="h-5 w-5" />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu
                            aria-label="Requirement actions"
                            onAction={(k) => {
                              if (k === 'edit') setEditor({ open: true, row: r });
                              if (k === 'retire') setConfirm({ kind: 'retire', id: r.id, title: r.title });
                              if (k === 'restore') restore.mutate(r.id);
                              if (k === 'delete') setConfirm({ kind: 'delete', id: r.id, title: r.title });
                            }}
                          >
                            <DropdownItem key="edit">Edit</DropdownItem>
                            {r.retired ? (
                              <DropdownItem key="restore">Restore</DropdownItem>
                            ) : (
                              <DropdownItem key="retire" description="Stop asking for it everywhere">
                                Retire
                              </DropdownItem>
                            )}
                            <DropdownItem key="delete" className="text-danger" color="danger" description="Only if it was never used">
                              Delete
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No requirements match" body="Clear the filters, or create a requirement." />
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {(groups ?? []).map((g) => (
              <article key={g.id} className="flex flex-col rounded-xl border border-line bg-white">
                <header className="flex items-start justify-between gap-2 px-4 pt-4">
                  <div>
                    <h3 className="text-[14.5px] font-semibold text-ink">{g.name}</h3>
                    <p className="mt-0.5 text-[12.5px] text-ink-3">{g.description}</p>
                  </div>
                  <Dropdown placement="bottom-end">
                    <DropdownTrigger>
                      <Button isIconOnly size="sm" variant="light" aria-label={`Actions for ${g.name}`}>
                        <EllipsisHorizontalIcon className="h-5 w-5" />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label="Group actions"
                      onAction={(k) => {
                        if (k === 'edit') setGroupEditor({ open: true, row: g });
                        if (k === 'clone') cloneGroup.mutate(g.id);
                        if (k === 'delete') setConfirm({ kind: 'delete-group', id: g.id, title: g.name });
                      }}
                    >
                      <DropdownItem key="edit">Edit</DropdownItem>
                      <DropdownItem key="clone">Clone</DropdownItem>
                      <DropdownItem key="delete" className="text-danger" color="danger">
                        Delete
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </header>
                <ul className="flex-1 space-y-1.5 px-4 py-3">
                  {g.requirement_ids.map((rid) => {
                    const r = requirements?.find((x) => x.id === rid);
                    if (!r) return null;
                    return (
                      <li key={rid} className="flex items-center gap-2 text-[13px] text-ink-2">
                        <TypeBadge type={r.type} label={false} />
                        <span className={r.retired ? 'line-through' : ''}>{r.title}</span>
                        {r.applies_to === 'WORKER' && <span className="text-[11.5px] text-ink-3">each worker</span>}
                      </li>
                    );
                  })}
                </ul>
                <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[12px] text-ink-3">
                  <span>
                    {plural(g.contractors, 'contractor')}
                    {g.site_names.length ? ` · sites: ${g.site_names.join(', ')}` : ''}
                  </span>
                  <Button size="sm" variant="light" color="primary" onPress={() => setGroupEditor({ open: true, row: g })}>
                    Edit
                  </Button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </Card>

      <RequirementEditor isOpen={editor.open} editing={editor.row} onClose={() => setEditor({ open: false, row: null })} />
      <GroupEditor isOpen={groupEditor.open} editing={groupEditor.row} requirements={requirements ?? []} onClose={() => setGroupEditor({ open: false, row: null })} />
      <ConfirmModal
        isOpen={!!confirm}
        title={confirm?.kind === 'retire' ? `Retire ${confirm?.title}?` : `Delete ${confirm?.title}?`}
        body={
          confirm?.kind === 'retire'
            ? 'It comes off every checklist, including approved items, and stops counting toward scores. You can restore it later.'
            : confirm?.kind === 'delete'
              ? 'This can only be done if it was never assigned. Otherwise retire it.'
              : 'This only works if no contractor or site uses the group.'
        }
        action={confirm?.kind === 'retire' ? 'Retire' : 'Delete'}
        color="danger"
        busy={retire.isPending || remove.isPending || deleteGroup.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </>
  );
}
