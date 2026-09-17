'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@heroui/react';
import { addToast } from '@heroui/toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  ChartPieIcon,
  CheckBadgeIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CreditCardIcon,
  EnvelopeIcon,
  InboxStackIcon,
  MapPinIcon,
  PlusCircleIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
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
  /** A client under "My compliance". */
  child?: boolean;
  active: (path: string) => boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/** Client-side screens need the company to run its own program. */
const PROGRAM_ROUTES = ['/dashboard', '/contractors', '/reviews', '/requirements', '/sites', '/gate', '/emails'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { session, ready, signIn } = useSession();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { data: ctx, isError } = useSessionContext(ready);

  // A login created in the demo disappears on reset; fall back to the default login instead of spinning.
  useEffect(() => {
    if (isError && session?.member_id !== DEFAULT_SESSION.member_id) signIn(DEFAULT_SESSION);
  }, [isError, session, signIn]);
  const onProgramRoute = PROGRAM_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const onEhsRoute = pathname.startsWith('/ehs');
  const blocked = !!ctx && ((onProgramRoute && !ctx.program.enabled) || (onEhsRoute && !ctx.is_ehs) || (ctx.is_ehs && !onEhsRoute && pathname !== '/'));

  useEffect(() => {
    if (blocked) router.replace(ctx?.is_ehs ? '/ehs' : '/setup');
  }, [blocked, ctx, router]);

  const sections: NavSection[] = [];
  if (ctx?.is_ehs) {
    sections.push({ title: 'EHSSoftware.io', items: [{ href: '/ehs', label: 'Subscriptions', icon: CreditCardIcon, active: (p) => p.startsWith('/ehs') }] });
  } else if (ctx?.program.enabled) {
    sections.push({
      title: 'Your contractors',
      items: [
        { href: '/dashboard', label: 'Overview', icon: ChartPieIcon, active: (p) => p.startsWith('/dashboard') },
        { href: '/contractors', label: 'Contractors', icon: BuildingOffice2Icon, badge: undefined, active: (p) => p.startsWith('/contractors') },
        { href: '/reviews', label: 'Review queue', icon: InboxStackIcon, badge: ctx.program.waiting, active: (p) => p.startsWith('/reviews') },
        { href: '/requirements', label: 'Requirements', icon: ClipboardDocumentListIcon, active: (p) => p.startsWith('/requirements') },
        { href: '/sites', label: 'Projects & sites', icon: MapPinIcon, active: (p) => p.startsWith('/sites') },
        { href: '/gate', label: 'Gate check-in', icon: ShieldCheckIcon, active: (p) => p.startsWith('/gate') },
        { href: '/emails', label: 'Emails & reminders', icon: EnvelopeIcon, active: (p) => p.startsWith('/emails') },
      ],
    });
  }
  // Every company can edit its own profile; the crew roster and the contractor inbox only matter once it works for someone.
  if (ctx && !ctx.is_ehs) {
    sections.push({
      title: '',
      items: [
        ...(ctx.clients.length
          ? [
              {
                href: '/portal',
                label: 'My compliance',
                icon: Squares2X2Icon,
                badge: ctx.clients.reduce((n, c) => n + c.open_items, 0),
                active: (p: string) => p === '/portal',
              },
              ...ctx.clients.map((c) => ({
                href: `/portal/clients/${c.id}`,
                label: c.client.name,
                icon: CheckBadgeIcon,
                badge: c.open_items,
                child: true,
                active: (p: string) => p.startsWith(`/portal/clients/${c.id}`),
              })),
            ]
          : []),
        ...(ctx.clients.length ? [{ href: '/portal/workers', label: 'Workers', icon: UserGroupIcon, active: (p: string) => p.startsWith('/portal/workers') }] : []),
        { href: '/portal/profile', label: 'Company profile', icon: BuildingOfficeIcon, active: (p) => p.startsWith('/portal/profile') },
        ...(ctx.clients.length ? [{ href: '/portal/emails', label: 'Inbox', icon: EnvelopeIcon, active: (p: string) => p.startsWith('/portal/emails') }] : []),
      ],
    });
  }
  if (ctx && !ctx.is_ehs && !ctx.program.enabled) {
    sections.push({
      title: '',
      items: [{ href: '/setup', label: 'Manage your own contractors', icon: PlusCircleIcon, active: (p) => p.startsWith('/setup') }],
    });
  }
  const flat = sections.flatMap((sec) => sec.items);
  const waitForRedirect = !ready || !session || !ctx || blocked;

  return (
    <>
      <TopBar />
      {ready && ctx && (
        <>
          <aside className="fixed bottom-0 left-0 top-16 z-20 hidden w-60 flex-col border-r border-line bg-white md:flex">
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gray-100 text-[12px] font-semibold text-ink-2">{ctx.org.short}</span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{ctx.org.name}</span>
                <span className="block truncate text-[11.5px] text-ink-3">
                  {ctx.is_ehs ? 'EZForm staff' : orgRoleLine(ctx.program.enabled, ctx.program.contractors, ctx.clients.length)}
                </span>
              </span>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Main">
              {sections.map((sec) => (
                <div key={sec.title || sec.items[0].href} className="pt-4">
                  {sec.title && <p className="eyebrow px-3 pb-1">{sec.title}</p>}
                  <div className="space-y-0.5">
                    {sec.items.map((item) => (
                      <NavLink key={item.href} item={item} active={item.active(pathname)} />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <p className="border-t border-line px-5 py-3 text-[11.5px] leading-snug text-ink-3">
              Demo data is saved in this browser. Switch companies from the login menu; use the date menu to move time forward.
            </p>
          </aside>
          <nav className="fixed inset-x-0 top-16 z-20 flex gap-1 overflow-x-auto border-b border-line bg-white px-2 py-1.5 md:hidden" aria-label="Main">
            {flat.map((item) => (
              <NavLink key={item.href} item={item} active={item.active(pathname)} compact />
            ))}
          </nav>
        </>
      )}
      <main className="flex min-h-screen flex-col pt-[6.75rem] md:pl-60 md:pt-16">
        <div className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 md:px-8">
          {waitForRedirect ? (
            <div className="grid place-items-center py-24">
              <Spinner />
            </div>
          ) : (
            children
          )}
        </div>
        <footer className="flex h-12 items-center justify-center border-t border-line bg-white px-5 text-[12px] text-ink-3">
          Copyright © Wise Businessware. All rights reserved.
        </footer>
      </main>
    </>
  );
}

export function orgRoleLine(runsProgram: boolean, contractors: number, clients: number): string {
  const parts = [runsProgram ? `${plural(contractors, 'contractor')}` : '', clients ? `works for ${plural(clients, 'client')}` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No clients or contractors yet';
}

function NavLink({ item, active, compact = false }: { item: NavItem; active: boolean; compact?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-3 rounded-lg py-2 pr-3 text-[13.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        item.child && !compact ? 'pl-8' : 'pl-3'
      } ${active ? 'bg-primary-50 font-medium text-primary' : 'text-ink-2 hover:bg-gray-100'}`}
    >
      <Icon className={`${item.child && !compact ? 'h-4 w-4' : 'h-5 w-5'} shrink-0`} />
      <span className={compact ? 'whitespace-nowrap' : 'flex-1 truncate'}>{item.label}</span>
      {item.badge ? (
        <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold ${active ? 'bg-primary text-white' : 'bg-primary-100 text-primary-700'}`}>
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function TopBar() {
  const { ready } = useSession();
  const { data: ctx } = useSessionContext(ready);
  const home = '/';
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white px-4 shadow-sm">
      <Link href={home} className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[13px] font-bold text-white">EZ</span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-[14.5px] font-semibold text-ink">Contractor Compliance</span>
          <span className="block text-[11px] text-ink-3">EZForm module · demo data</span>
        </span>
      </Link>
      <div className="hidden flex-1 justify-center lg:flex">
        <span className="text-[20px] font-bold tracking-[0.5px] text-gray-800">{ctx?.org.name ?? ''}</span>
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

  const advance = async (days: number) => {
    setBusy(true);
    try {
      const res = await Api.advanceClock(days);
      await qc.invalidateQueries({ queryKey: [ROOT] });
      const s = res.summary;
      addToast({
        title: `It's now ${fmtWeekday(res.today)}`,
        description: s ? `Nightly check: ${plural(s.renewals, 'renewal')} opened, ${plural(s.reminders, 'reminder')} sent, ${s.expired} expired.` : undefined,
        color: 'primary',
      });
    } catch (e) {
      addToast({ title: "Couldn't move the date", description: errorMessage(e), color: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await Api.resetDemo();
      await qc.resetQueries({ queryKey: [ROOT] });
      setConfirmReset(false);
      addToast({ title: 'Demo data reset', description: 'Back to the seeded companies and programs, dated today.', color: 'success' });
    } catch (e) {
      addToast({ title: "Couldn't reset", description: errorMessage(e), color: 'danger' });
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
            else void advance(Number(key));
          }}
        >
          <DropdownSection title="Move the demo date forward" showDivider>
            <DropdownItem key="1" description="Runs the nightly renewal and reminder check">
              +1 day
            </DropdownItem>
            <DropdownItem key="7">+7 days</DropdownItem>
            <DropdownItem key="30">+30 days</DropdownItem>
          </DropdownSection>
          <DropdownSection title="Demo data">
            <DropdownItem key="reset" className="text-danger" color="danger" description="Back to the seeded data, dated today">
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
                <p className="text-ink-2">Everything you've changed in this browser goes back to the seeded companies, requirements and dates.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={close}>
                  Keep my changes
                </Button>
                <Button color="danger" isLoading={busy} onPress={() => void reset()}>
                  Reset demo data
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}

function PersonaMenu() {
  const { session, signIn } = useSession();
  const { data: personas } = usePersonas();
  const me = personas?.find((p) => p.member_id === session?.member_id);
  const staff = personas?.filter((p) => p.is_ehs) ?? [];
  // Running a program is one capability; whether they also work for clients is just their relationships,
  // and the description line already says so.
  const withProgram = personas?.filter((p) => !p.is_ehs && p.runs_program) ?? [];
  const contractors = personas?.filter((p) => !p.is_ehs && !p.runs_program) ?? [];
  const describe = (p: Persona) => (p.is_ehs ? `${p.title} · turns subscriptions on` : `${p.title}, ${p.org_name} · ${orgRoleLine(p.runs_program, p.contractors, p.clients)}`);

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Switch demo login"
        >
          <Avatar
            name={me?.name ?? '?'}
            getInitials={initials}
            size="sm"
            classNames={{ base: me && !me.runs_program ? 'bg-amber-500 text-white' : 'bg-primary text-white' }}
          />
          <span className="hidden text-left leading-tight lg:block">
            <span className="block text-[13px] font-medium text-ink">{me?.name ?? '…'}</span>
            <span className="block max-w-[190px] truncate text-[11px] text-ink-3">{me?.org_name ?? ''}</span>
          </span>
          <ChevronDownIcon className="h-4 w-4 text-ink-3" />
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Demo logins" className="max-h-[70vh] overflow-y-auto" onAction={(key) => signIn({ member_id: String(key) })}>
        <DropdownSection title="EHSSoftware.io staff" showDivider>
          {staff.map((p) => (
            <DropdownItem key={p.member_id} description={describe(p)}>
              {p.name}
            </DropdownItem>
          ))}
        </DropdownSection>
        <DropdownSection title="Companies with a program" showDivider>
          {withProgram.map((p) => (
            <DropdownItem key={p.member_id} description={describe(p)}>
              {p.name}
            </DropdownItem>
          ))}
        </DropdownSection>
        <DropdownSection title="Contractors">
          {contractors.map((p) => (
            <DropdownItem key={p.member_id} description={describe(p)}>
              {p.name}
            </DropdownItem>
          ))}
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  );
}
