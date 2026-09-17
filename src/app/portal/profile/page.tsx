'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Input, Spinner, Textarea } from '@heroui/react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Card, PageHeader, StatusChip } from '@/components/ui';
import { fmtDate } from '@/lib/dates';
import { possessive } from '@/lib/describe';
import type { Organization } from '@/lib/types';
import { Api, useAction, usePortalOverview, useSessionContext } from '@/services/queries';

interface ProfileForm {
  name: string;
  address: string;
  website: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  trade: string;
  license_no: string;
  employees_count: string;
  program_name: string;
  program_title: string;
  program_email: string;
  program_phone: string;
  invite_note: string;
}

const fromOrg = (o: Organization): ProfileForm => ({
  name: o.name,
  address: o.address,
  website: o.website ?? '',
  contact_name: o.contact.name,
  contact_title: o.contact.title ?? '',
  contact_email: o.contact.email,
  contact_phone: o.contact.phone,
  trade: o.trade,
  license_no: o.license_no ?? '',
  employees_count: o.employees_count ? String(o.employees_count) : '',
  program_name: o.program_contact?.name ?? '',
  program_title: o.program_contact?.title ?? '',
  program_email: o.program_contact?.email ?? '',
  program_phone: o.program_contact?.phone ?? '',
  invite_note: o.invite_note ?? '',
});

/**
 * One profile per company, in three blocks: who you are, what a client weighs up before engaging you,
 * and what your own contractors see coming from you. A company fills only the blocks its roles need.
 */
export default function PortalProfile() {
  const { data, isLoading } = usePortalOverview();
  const { data: ctx } = useSessionContext();
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data && !dirty) setForm(fromOrg(data.org));
  }, [data, dirty]);

  const save = useAction(
    () =>
      Api.updateProfile({
        name: form!.name,
        address: form!.address,
        website: form!.website,
        contact: { name: form!.contact_name, title: form!.contact_title, email: form!.contact_email, phone: form!.contact_phone },
        trade: form!.trade,
        license_no: form!.license_no,
        employees_count: form!.employees_count,
        program_contact: { name: form!.program_name, title: form!.program_title, email: form!.program_email, phone: form!.program_phone },
        invite_note: form!.invite_note,
      }),
    'Profile saved',
  );
  const apply = useAction(
    (v: { id: string; client: string }) => Api.submitApplication(v.id),
    (_r, v) => `Application sent to ${v.client}`,
  );

  if (isLoading || !data || !form || !ctx) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }

  const o = data.org;
  const runsProgram = ctx.program.enabled;
  const worksForClients = data.clients.length > 0 || !runsProgram;
  const set = (k: keyof ProfileForm) => (v: string) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    setDirty(true);
  };
  const checks = [
    { label: 'Trade', ok: !!o.trade.trim() },
    { label: 'Business address', ok: !!o.address.trim() },
    { label: 'Contact phone', ok: !!o.contact.phone.trim() },
  ];
  const complete = checks.every((x) => x.ok);
  const newApps = data.clients.filter((c) => c.status === 'New');
  const description = worksForClients
    ? runsProgram
      ? `${o.name} works for other companies and runs its own contractor program, so this profile has both sides. One copy on EZForm: a change here reaches every client at once.`
      : `What every client sees about ${o.name}. You keep one profile on EZForm, so a change here reaches all of them at once.`
    : `Your company details, and what the contractors you invite see coming from ${o.name}.`;

  return (
    <div className="space-y-6">
      <PageHeader title="Company profile" description={description} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, { onSuccess: () => setDirty(false) });
        }}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <Card title="Company" subtitle="Who you are. Everyone you work with sees this." bodyClass="p-5">
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Input id="profile-name" label="Company name" labelPlacement="outside" placeholder=" " variant="bordered" isRequired value={form.name} onValueChange={set('name')} />
                  <Input id="profile-website" label="Website" labelPlacement="outside" placeholder="https://" variant="bordered" value={form.website} onValueChange={set('website')} />
                </div>
                <Textarea
                  id="profile-address"
                  label="Business address"
                  labelPlacement="outside"
                  placeholder="Street, city"
                  variant="bordered"
                  minRows={2}
                  isRequired={worksForClients}
                  value={form.address}
                  onValueChange={set('address')}
                />
                <div>
                  <p className="eyebrow mb-3">Main contact</p>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Input id="profile-contact-name" label="Name" labelPlacement="outside" placeholder=" " variant="bordered" isRequired value={form.contact_name} onValueChange={set('contact_name')} />
                    <Input id="profile-contact-title" label="Job title" labelPlacement="outside" placeholder="e.g. Owner" variant="bordered" value={form.contact_title} onValueChange={set('contact_title')} />
                    <Input
                      id="profile-contact-email"
                      type="email"
                      label="Email"
                      labelPlacement="outside"
                      placeholder=" "
                      variant="bordered"
                      isRequired
                      value={form.contact_email}
                      onValueChange={set('contact_email')}
                    />
                    <Input
                      id="profile-contact-phone"
                      label="Phone"
                      labelPlacement="outside"
                      placeholder="(555) 010-0000"
                      variant="bordered"
                      isRequired={worksForClients}
                      value={form.contact_phone}
                      onValueChange={set('contact_phone')}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {worksForClients && (
              <Card title="As a contractor" subtitle="What a client weighs up before engaging you. Insurance, training and safety records aren't here: each client asks for those as requirements, so they carry an expiry date and get reviewed." bodyClass="p-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <Input id="profile-trade" label="Trade" labelPlacement="outside" placeholder="e.g. Roofing" variant="bordered" isRequired value={form.trade} onValueChange={set('trade')} />
                  <Input id="profile-licence" label="Licence number" labelPlacement="outside" placeholder="Optional" variant="bordered" value={form.license_no} onValueChange={set('license_no')} />
                  <Input
                    id="profile-employees"
                    type="number"
                    label="Employees"
                    labelPlacement="outside"
                    placeholder=" "
                    variant="bordered"
                    min={0}
                    value={form.employees_count}
                    onValueChange={set('employees_count')}
                  />
                </div>
              </Card>
            )}

            {runsProgram && (
              <Card title="As a client" subtitle={`What the contractors ${o.name} invites see. Leave the contact empty to use your own details.`} bodyClass="p-5">
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Input
                      id="program-contact-name"
                      label="Contact for contractors"
                      labelPlacement="outside"
                      placeholder="e.g. Priya Nair"
                      variant="bordered"
                      value={form.program_name}
                      onValueChange={set('program_name')}
                    />
                    <Input id="program-contact-title" label="Job title" labelPlacement="outside" placeholder="e.g. EHS Manager" variant="bordered" value={form.program_title} onValueChange={set('program_title')} />
                    <Input
                      id="program-contact-email"
                      type="email"
                      label="Email"
                      labelPlacement="outside"
                      placeholder="compliance@yourcompany.com"
                      variant="bordered"
                      value={form.program_email}
                      onValueChange={set('program_email')}
                    />
                    <Input id="program-contact-phone" label="Phone" labelPlacement="outside" placeholder="(555) 010-0000" variant="bordered" value={form.program_phone} onValueChange={set('program_phone')} />
                  </div>
                  <Textarea
                    id="program-invite-note"
                    label="Note added to invitations"
                    labelPlacement="outside"
                    placeholder="e.g. Questions about insurance? Call the EHS team before you upload."
                    variant="bordered"
                    minRows={2}
                    value={form.invite_note}
                    onValueChange={set('invite_note')}
                  />
                </div>
              </Card>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
              {dirty && <span className="text-[12px] text-ink-3">You have unsaved changes.</span>}
              {dirty && (
                <Button
                  variant="light"
                  onPress={() => {
                    setForm(fromOrg(o));
                    setDirty(false);
                  }}
                >
                  Discard
                </Button>
              )}
              <Button color="primary" type="submit" isLoading={save.isPending} isDisabled={!dirty}>
                Save profile
              </Button>
            </div>
          </div>

          <aside className="space-y-4">
            {worksForClients && (
              <Card title="Clients who see this profile" bodyClass="p-0">
                {data.clients.length ? (
                  <ul className="divide-y divide-line">
                    {data.clients.map((c) => (
                      <li key={c.id} className="space-y-1.5 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/portal/clients/${c.id}`} className="min-w-0 flex-1 truncate font-medium text-ink hover:text-primary">
                            {c.client.name}
                          </Link>
                          <StatusChip status={c.status} />
                        </div>
                        {c.sponsor_name && <p className="text-[12px] text-primary-700">Through {c.sponsor_name}</p>}
                        <p className="text-[12px] text-ink-3">
                          {c.status === 'New'
                            ? `Invited ${fmtDate(c.invited_at)}, application not sent`
                            : c.profile_submitted_at
                              ? `Applied ${fmtDate(c.profile_submitted_at)}`
                              : `Working with them since ${fmtDate(c.invited_at)}`}
                        </p>
                        {c.status === 'New' && (
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            isDisabled={!complete || dirty}
                            isLoading={apply.isPending && apply.variables?.id === c.id}
                            onPress={() => apply.mutate({ id: c.id, client: c.client.name })}
                          >
                            Submit application
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-[13px] text-ink-3">No clients yet. When a company adds you as a contractor, it sees this profile.</p>
                )}
              </Card>
            )}

            {newApps.length > 0 && (
              <Card title="Before you apply" bodyClass="p-4 space-y-3">
                <ul className="space-y-1.5 text-[13px]">
                  {checks.map((x) => (
                    <li key={x.label} className="flex items-center gap-2">
                      {x.ok ? <CheckCircleIcon className="h-4 w-4 text-success-600" /> : <XCircleIcon className="h-4 w-4 text-ink-3" />}
                      <span className={x.ok ? 'text-ink' : 'text-ink-3'}>{x.label}</span>
                    </li>
                  ))}
                </ul>
                {dirty && <p className="text-[12px] text-ink-3">Save your changes first.</p>}
              </Card>
            )}

            {runsProgram && (
              <Card title="Your contractors" bodyClass="p-4 space-y-2">
                <p className="text-[13px] text-ink-2">
                  {ctx.program.contractors ? `${ctx.program.contractors} companies work for ${o.name}.` : `No contractors yet.`} What you ask of them lives in{' '}
                  <Link href="/requirements" className="text-primary hover:underline">
                    requirements
                  </Link>
                  , not here.
                </p>
                <p className="text-[12px] text-ink-3">{possessive(o.name)} invitations and reminders are signed with the contact above.</p>
              </Card>
            )}
          </aside>
        </div>
      </form>
    </div>
  );
}
