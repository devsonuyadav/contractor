'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, Button, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@heroui/react';
import { addToast } from '@heroui/toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  BuildingOffice2Icon,
  BriefcaseIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  HomeIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { errorMessage } from '@/api/client';
import type { IconType } from '@/components/ui';
import { fmtWeekday } from '@/lib/dates';
import { initials, plural } from '@/lib/describe';
import type { Persona } from '@/lib/types';
import { Api, ROOT, useClock, usePersonas, useSessionContext } from '@/services/queries';
import { useSession } from '@/session/SessionProvider';
import { DEFAULT_SESSION } from '@/session/storage';

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
  badge?: number;
}

interface NavSection {
  title: string;
  hint: string;
  items: NavItem[];
}

const isActive = (href: string, path: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { session, ready, signIn } = useSession();
  const pathname = usePathname() || '/';
  const { data: ctx, isError } = useSessionContext(ready);

  // A login created in the demo disappears on reset; fall back to the default login instead of spinning.
  useEffect(() => {
    if (isError && session?.user_id !== DEFAULT_SESSION.user_id) signIn(DEFAULT_SESSION);
  }, [isError, session, signIn]);

  const sections: NavSection[] = ctx
    ? [
        { title: '', hint: '', items: [{ href: '/', label: 'Home', icon: HomeIcon }] },
        {
          title: 'My contractors',
          hint: 'Companies that work for you',
          items: [
            { href: '/contractors', label: 'Contractors', icon: BuildingOffice2Icon, badge: ctx.to_review },
            { href: '/requirements', label: 'What I ask for', icon: ClipboardDocumentListIcon },
            { href: '/check-in', label: 'Who can work', icon: ShieldCheckIcon },
          ],
        },
        {
          title: 'My clients',
          hint: 'Companies you work for',
          items: [{ href: '/clients', label: 'Clients', icon: BriefcaseIcon, badge: ctx.todo }],
        },
        {
          title: 'My company',
          hint: '',
          items: [{ href: '/people', label: 'My people', icon: UserGroupIcon }],
        },
      ]
    : [];
  const flat = sections.flatMap((s) => s.items);

  return (
    <>
      <TopBar />
      {ready && ctx && (
        <>
          <aside className="fixed bottom-0 left-0 top-16 z-20 hidden w-60 flex-col border-r border-line bg-white md:flex">
            <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Main">
              {sections.map((sec) => (
                <div key={sec.title || 'home'} className="pt-4">
                  {sec.title && (
                    <div className="px-3 pb-1.5">
                      <p className="eyebrow">{sec.title}</p>
                      {sec.hint && <p className="text-[11.5px] text-ink-3">{sec.hint}</p>}
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    {sec.items.map((item) => (
                      <NavLink key={item.href} item={item} active={isActive(item.href, pathname)} />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <p className="border-t border-line px-5 py-3 text-[11.5px] leading-snug text-ink-3">
              Demo data lives in this browser. Switch company from the login menu, and move the date forward to see things expire.
            </p>
          </aside>
          <nav className="fixed inset-x-0 top-16 z-20 flex gap-1 overflow-x-auto border-b border-line bg-white px-2 py-1.5 md:hidden" aria-label="Main">
            {flat.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, pathname)} compact />
            ))}
          </nav>
        </>
      )}
      <main className="flex min-h-screen flex-col pt-[6.75rem] md:pl-60 md:pt-16">
        <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 md:px-8">
          {!ready || !ctx ? (
            <div className="grid place-items-center py-24">
              <Spinner />
            </div>
          ) : (
            children
          )}
        </div>
        <footer className="flex h-12 items-center justify-center border-t border-line bg-white px-5 text-[12px] text-ink-3">Copyright © Wise Businessware. All rights reserved.</footer>
      </main>
    </>
  );
}

function NavLink({ item, active, compact = false }: { item: NavItem; active: boolean; compact?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        active ? 'bg-primary-50 font-medium text-primary' : 'text-ink-2 hover:bg-gray-100'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className={compact ? 'whitespace-nowrap' : 'flex-1 truncate'}>{item.label}</span>
      {item.badge ? (
        <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold ${active ? 'bg-primary text-white' : 'bg-primary-100 text-primary-700'}`}>{item.badge}</span>
      ) : null}
    </Link>
  );
}

function TopBar() {
  const { ready } = useSession();
  const { data: ctx } = useSessionContext(ready);
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white px-4 shadow-sm">
      <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[13px] font-bold text-white">EZ</span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-[14.5px] font-semibold text-ink">Contractor Compliance</span>
          <span className="block text-[11px] text-ink-3">EZForm module · demo</span>
        </span>
      </Link>
      <div className="hidden flex-1 justify-center lg:flex">
        <span className="text-[20px] font-bold tracking-[0.5px] text-gray-800">{ctx?.company.name ?? ''}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {ready && <ClockMenu />}
        {ready && <PersonaMenu />}
      </div>
    </header>
  );
}

function ClockMenu() {
  const { data } = useClock();
  const qc = useQueryClient();
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      await qc.resetQueries({ queryKey: [ROOT] });
      addToast({ title: done, color: 'primary' });
      setConfirmReset(false);
    } catch (e) {
      addToast({ title: "That didn't work", description: errorMessage(e), color: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Button size="sm" variant="flat" className="font-medium" startContent={busy ? <Spinner size="sm" /> : <ClockIcon className="h-4 w-4" />}>
            <span className="hidden sm:inline">{data ? fmtWeekday(data.today) : '…'}</span>
            {data && data.offset_days > 0 && (
              <Chip size="sm" color="warning" variant="flat" className="h-5">
                +{data.offset_days}d
              </Chip>
            )}
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Demo date"
          onAction={(key) => {
            if (key === 'reset') setConfirmReset(true);
            else void run(() => Api.advanceClock(Number(key)), `Moved forward ${plural(Number(key), 'day')}`);
          }}
        >
          <DropdownSection title="Move the date forward" showDivider>
            <DropdownItem key="7">+7 days</DropdownItem>
            <DropdownItem key="30" description="Things start to expire">
              +30 days
            </DropdownItem>
          </DropdownSection>
          <DropdownSection title="Demo data">
            <DropdownItem key="reset" className="text-danger" color="danger" description="Back to the starting data, dated today">
              Reset demo data
            </DropdownItem>
          </DropdownSection>
        </DropdownMenu>
      </Dropdown>
      <Modal isOpen={confirmReset} onOpenChange={setConfirmReset} size="sm">
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>Reset the demo data?</ModalHeader>
              <ModalBody>
                <p className="text-ink-2">Everything you changed in this browser goes back to the starting data.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={close}>
                  Keep my changes
                </Button>
                <Button color="danger" isLoading={busy} onPress={() => void run(Api.resetDemo, 'Demo data reset')}>
                  Reset
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}

function roleLine(p: Persona): string {
  const parts = [p.contractors ? `hires ${plural(p.contractors, 'contractor')}` : '', p.clients ? `works for ${plural(p.clients, 'client')}` : ''].filter(Boolean);
  return parts.join(' · ') || 'Nothing set up yet';
}

function PersonaMenu() {
  const { session, signIn } = useSession();
  const { data: personas } = usePersonas();
  const me = personas?.find((p) => p.user_id === session?.user_id);

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Switch demo login"
        >
          <Avatar name={me?.name ?? '?'} getInitials={initials} size="sm" classNames={{ base: 'bg-primary text-white' }} />
          <span className="hidden text-left leading-tight lg:block">
            <span className="block text-[13px] font-medium text-ink">{me?.name ?? '…'}</span>
            <span className="block max-w-[190px] truncate text-[11px] text-ink-3">{me?.company_name ?? ''}</span>
          </span>
          <ChevronDownIcon className="h-4 w-4 text-ink-3" />
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Demo logins" className="max-h-[70vh] overflow-y-auto" onAction={(key) => signIn({ user_id: String(key) }, '/')}>
        <DropdownSection title="Sign in as">
          {(personas ?? []).map((p) => (
            <DropdownItem key={p.user_id} description={`${p.company_name} · ${roleLine(p)}`}>
              {p.name}
            </DropdownItem>
          ))}
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  );
}
