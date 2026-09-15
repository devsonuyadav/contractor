// Demo data, dated relative to today.
//
//   Riverside Energy     a power plant. Hires Ortega Roofing, Delta Mechanical and Keystone Scaffolding.
//   Delta Mechanical     works both ways: a contractor for Riverside (which reviews its uploads) and for
//                        Harbor Chemicals (not on EZForm, so Delta tracks it itself), and hires Ironwood Welding.
//   Ortega Roofing, Keystone Scaffolding, Ironwood Welding   contractors only.
import type { Company, DemoDB, Link, Person, Requirement, Upload, User } from '@/lib/types';
import { DAY_MS, fmtDate } from '@/lib/dates';
import { certificateDataUrl } from './svg';

export const SCHEMA = 20;
export const DEFAULT_USER = 'U-PRIYA';

const ago = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();

function company(id: string, name: string, trade: string, contact: string, email: string, on_ezform = true): Company {
  return { id, name, trade, contact_name: contact, email, phone: on_ezform ? '(555) 010-0100' : '', on_ezform, created_at: ago(400) };
}

const COMPANIES: Company[] = [
  company('C-RIVERSIDE', 'Riverside Energy', 'Power plant', 'Priya Nair', 'priya.nair@riverside-energy.example'),
  company('C-DELTA', 'Delta Mechanical', 'Mechanical contractor', 'Chen Wei', 'chen@deltamech.example'),
  company('C-ORTEGA', 'Ortega Roofing', 'Roofing', 'Luis Ortega', 'luis@ortegaroofing.example'),
  company('C-KEYSTONE', 'Keystone Scaffolding', 'Scaffolding', 'Andre Mills', 'andre@keystonescaffold.example'),
  company('C-IRONWOOD', 'Ironwood Welding', 'Welding', 'Sean Doyle', 'sean@ironwoodfab.example'),
  company('C-HARBOR', 'Harbor Chemicals', 'Chemical plant', 'Gate office', '', false),
];

const USERS: User[] = [
  { id: 'U-PRIYA', company_id: 'C-RIVERSIDE', name: 'Priya Nair', title: 'EHS Manager' },
  { id: 'U-CHEN', company_id: 'C-DELTA', name: 'Chen Wei', title: 'Operations Manager' },
  { id: 'U-LUIS', company_id: 'C-ORTEGA', name: 'Luis Ortega', title: 'Owner' },
  { id: 'U-ANDRE', company_id: 'C-KEYSTONE', name: 'Andre Mills', title: 'Safety Coordinator' },
  { id: 'U-SEAN', company_id: 'C-IRONWOOD', name: 'Sean Doyle', title: 'Owner' },
];

function person(id: string, company_id: string, name: string, job: string, badge: string, addedAgo = 200): Person {
  return { id, company_id, name, job, badge_id: badge, created_at: ago(addedAgo) };
}

const PEOPLE: Person[] = [
  person('P-DANA', 'C-ORTEGA', 'Dana Brooks', 'Roofer', 'OR-1001'),
  person('P-TOM', 'C-ORTEGA', 'Tom Ortega', 'Foreman', 'OR-1002'),
  person('P-PRIYANKA', 'C-ORTEGA', 'Priyanka Rao', 'Roofer', 'OR-1003', 3),
  person('P-JONAS', 'C-DELTA', 'Jonas Berg', 'Pipefitter', 'DM-1001'),
  person('P-MARIA', 'C-DELTA', 'Maria Lopez', 'Millwright', 'DM-1002'),
  person('P-KEVIN', 'C-DELTA', 'Kevin Tran', 'Welder', 'DM-1003'),
  person('P-SAM', 'C-KEYSTONE', 'Sam Cole', 'Scaffolder', 'KS-1001', 10),
  person('P-LEE', 'C-KEYSTONE', 'Lee Park', 'Scaffolder', 'KS-1002', 10),
  person('P-RAVI', 'C-IRONWOOD', 'Ravi Patel', 'Welder', 'IW-1001'),
  person('P-NORA', 'C-IRONWOOD', 'Nora Quinn', 'Welder', 'IW-1002'),
];

const LINKS: Link[] = [
  { id: 'L-RIV-ORTEGA', client_id: 'C-RIVERSIDE', contractor_id: 'C-ORTEGA', added_by: 'CLIENT', created_at: ago(380) },
  { id: 'L-RIV-DELTA', client_id: 'C-RIVERSIDE', contractor_id: 'C-DELTA', added_by: 'CLIENT', created_at: ago(390) },
  { id: 'L-RIV-KEYSTONE', client_id: 'C-RIVERSIDE', contractor_id: 'C-KEYSTONE', added_by: 'CLIENT', created_at: ago(12) },
  { id: 'L-DELTA-IRONWOOD', client_id: 'C-DELTA', contractor_id: 'C-IRONWOOD', added_by: 'CLIENT', created_at: ago(300) },
  { id: 'L-HARBOR-DELTA', client_id: 'C-HARBOR', contractor_id: 'C-DELTA', added_by: 'CONTRACTOR', created_at: ago(250) },
];

function req(id: string, company_id: string, title: string, f: Requirement['for'], has_expiry: boolean, hint = '', link_id: string | null = null): Requirement {
  return { id, company_id, link_id, title, for: f, has_expiry, hint, created_at: ago(395) };
}

const REQUIREMENTS: Requirement[] = [
  // Riverside's list: asked of every contractor it adds
  req('R-RIV-GL', 'C-RIVERSIDE', 'Liability insurance certificate', 'COMPANY', true, 'At least $2M per occurrence, with Riverside Energy named as additional insured.'),
  req('R-RIV-WC', 'C-RIVERSIDE', "Workers' comp insurance", 'COMPANY', true, 'Current certificate from your insurer.'),
  req('R-RIV-300', 'C-RIVERSIDE', 'OSHA 300A injury summary', 'COMPANY', false, 'Last calendar year.'),
  req('R-RIV-ORIENT', 'C-RIVERSIDE', 'Site safety orientation', 'PERSON', true, 'Completion certificate from the Riverside orientation.'),
  req('R-RIV-HEIGHTS', 'C-RIVERSIDE', 'Working at heights training', 'PERSON', true, 'Fall protection course certificate.'),
  // Delta's list for its own contractors
  req('R-DEL-GL', 'C-DELTA', 'Liability insurance certificate', 'COMPANY', true, 'Naming Delta Mechanical as additional insured.'),
  req('R-DEL-RULES', 'C-DELTA', 'Signed site safety rules', 'COMPANY', false, 'Delta safety rules, signed by the owner.'),
  req('R-DEL-WELD', 'C-DELTA', 'Welding certification (AWS)', 'PERSON', true, 'SMAW certification card.'),
  // What Harbor Chemicals asks of Delta, entered by Delta because Harbor isn't on EZForm
  req('R-HAR-INS', 'C-HARBOR', 'Insurance certificate for Harbor', 'COMPANY', true, 'Harbor asks for a fresh certificate every policy year.', 'L-HARBOR-DELTA'),
  req('R-HAR-OSHA10', 'C-HARBOR', 'OSHA 10 card', 'PERSON', false, '', 'L-HARBOR-DELTA'),
  req('R-HAR-HAZMAT', 'C-HARBOR', 'Hazmat awareness training', 'PERSON', true, 'Renewed every year.', 'L-HARBOR-DELTA'),
];

const NAMES: Record<string, string> = Object.fromEntries([...COMPANIES, ...PEOPLE].map((x) => [x.id, x.name]));
const UPLOADER: Record<string, string> = { 'C-ORTEGA': 'Luis Ortega', 'C-DELTA': 'Chen Wei', 'C-KEYSTONE': 'Andre Mills', 'C-IRONWOOD': 'Sean Doyle' };
const REVIEWER: Record<string, string> = { 'C-RIVERSIDE': 'Priya Nair', 'C-DELTA': 'Chen Wei' };

let seq = 0;

/** An upload with a generated certificate image, so "View file" shows something. */
function up(linkId: string, reqId: string, personId: string | null, o: { status?: Upload['status']; uploadedAgo?: number; expiresIn?: number | null; note?: string }): Upload {
  const link = LINKS.find((l) => l.id === linkId)!;
  const r = REQUIREMENTS.find((x) => x.id === reqId)!;
  const status = o.status ?? 'APPROVED';
  const uploadedAt = ago(o.uploadedAgo ?? 60);
  const expires = o.expiresIn === undefined || o.expiresIn === null ? null : ahead(o.expiresIn);
  const holder = personId ? NAMES[personId] : NAMES[link.contractor_id];
  seq += 1;
  const reviewed = status !== 'WAITING' && link.added_by === 'CLIENT';
  return {
    id: `F-${seq}`,
    link_id: linkId,
    requirement_id: reqId,
    person_id: personId,
    file: {
      name: `${r.title.replace(/[^A-Za-z0-9]+/g, '-').replace(/-$/, '')}${personId ? `-${holder.split(' ')[0]}` : ''}.svg`,
      size: 2400,
      type: 'image/svg+xml',
      data_url: certificateDataUrl({
        kicker: personId ? 'Certificate of completion' : 'Certificate',
        title: r.title,
        holder,
        reference: `REF-${1000 + seq * 7}`,
        issuer: personId ? 'SafeWork Training Co.' : 'Keel Mutual Insurance',
        issued: fmtDate(uploadedAt),
        expires: expires ? fmtDate(expires) : null,
      }),
    },
    expires_at: expires,
    uploaded_at: uploadedAt,
    uploaded_by: UPLOADER[link.contractor_id],
    status,
    ...(reviewed ? { reviewed_at: ago(Math.max(0, (o.uploadedAgo ?? 60) - 1)), reviewed_by: REVIEWER[link.client_id] } : {}),
    ...(o.note ? { note: o.note } : {}),
  };
}

function uploads(): Upload[] {
  seq = 0;
  return [
    // Riverside ← Ortega: workers' comp expiring, Dana's heights training expired, Priyanka is new
    up('L-RIV-ORTEGA', 'R-RIV-GL', null, { uploadedAgo: 120, expiresIn: 245 }),
    up('L-RIV-ORTEGA', 'R-RIV-WC', null, { uploadedAgo: 345, expiresIn: 20 }),
    up('L-RIV-ORTEGA', 'R-RIV-300', null, { uploadedAgo: 200 }),
    up('L-RIV-ORTEGA', 'R-RIV-ORIENT', 'P-DANA', { uploadedAgo: 215, expiresIn: 150 }),
    up('L-RIV-ORTEGA', 'R-RIV-HEIGHTS', 'P-DANA', { uploadedAgo: 370, expiresIn: -5 }),
    up('L-RIV-ORTEGA', 'R-RIV-ORIENT', 'P-TOM', { uploadedAgo: 165, expiresIn: 200 }),
    up('L-RIV-ORTEGA', 'R-RIV-HEIGHTS', 'P-TOM', { uploadedAgo: 65, expiresIn: 300 }),

    // Riverside ← Delta: all done; the workers' comp renewal is waiting for review
    up('L-RIV-DELTA', 'R-RIV-GL', null, { uploadedAgo: 65, expiresIn: 300 }),
    up('L-RIV-DELTA', 'R-RIV-WC', null, { uploadedAgo: 357, expiresIn: 8 }),
    up('L-RIV-DELTA', 'R-RIV-WC', null, { status: 'WAITING', uploadedAgo: 1, expiresIn: 373 }),
    up('L-RIV-DELTA', 'R-RIV-300', null, { uploadedAgo: 180 }),
    up('L-RIV-DELTA', 'R-RIV-ORIENT', 'P-JONAS', { uploadedAgo: 265, expiresIn: 100 }),
    up('L-RIV-DELTA', 'R-RIV-HEIGHTS', 'P-JONAS', { uploadedAgo: 265, expiresIn: 100 }),
    up('L-RIV-DELTA', 'R-RIV-ORIENT', 'P-MARIA', { uploadedAgo: 275, expiresIn: 90 }),
    up('L-RIV-DELTA', 'R-RIV-HEIGHTS', 'P-MARIA', { uploadedAgo: 165, expiresIn: 200 }),
    up('L-RIV-DELTA', 'R-RIV-ORIENT', 'P-KEVIN', { uploadedAgo: 305, expiresIn: 60 }),
    up('L-RIV-DELTA', 'R-RIV-HEIGHTS', 'P-KEVIN', { uploadedAgo: 30, expiresIn: 400 }),

    // Riverside ← Keystone: just started
    up('L-RIV-KEYSTONE', 'R-RIV-GL', null, { status: 'WAITING', uploadedAgo: 1, expiresIn: 330 }),
    up('L-RIV-KEYSTONE', 'R-RIV-WC', null, { status: 'REJECTED', uploadedAgo: 4, expiresIn: 2, note: 'This policy ends in two days. Please upload the renewed certificate.' }),
    up('L-RIV-KEYSTONE', 'R-RIV-ORIENT', 'P-SAM', { status: 'WAITING', uploadedAgo: 2, expiresIn: 363 }),

    // Delta ← Ironwood: Nora's certificate was sent back
    up('L-DELTA-IRONWOOD', 'R-DEL-GL', null, { uploadedAgo: 185, expiresIn: 180 }),
    up('L-DELTA-IRONWOOD', 'R-DEL-RULES', null, { uploadedAgo: 290 }),
    up('L-DELTA-IRONWOOD', 'R-DEL-WELD', 'P-RAVI', { uploadedAgo: 330, expiresIn: 400 }),
    up('L-DELTA-IRONWOOD', 'R-DEL-WELD', 'P-NORA', { status: 'REJECTED', uploadedAgo: 6, expiresIn: 700, note: 'This card is for TIG welding. We need the SMAW certification.' }),

    // Harbor ← Delta, tracked by Delta itself: insurance expires soon, two training gaps
    up('L-HARBOR-DELTA', 'R-HAR-INS', null, { uploadedAgo: 353, expiresIn: 12 }),
    up('L-HARBOR-DELTA', 'R-HAR-OSHA10', 'P-JONAS', { uploadedAgo: 240 }),
    up('L-HARBOR-DELTA', 'R-HAR-HAZMAT', 'P-JONAS', { uploadedAgo: 165, expiresIn: 200 }),
    up('L-HARBOR-DELTA', 'R-HAR-OSHA10', 'P-MARIA', { uploadedAgo: 240 }),
    up('L-HARBOR-DELTA', 'R-HAR-HAZMAT', 'P-KEVIN', { uploadedAgo: 368, expiresIn: -3 }),
  ];
}

export function buildSeed(): DemoDB {
  return {
    schema: SCHEMA,
    clock_offset_days: 0,
    seq: 1000,
    companies: structuredClone(COMPANIES),
    users: structuredClone(USERS),
    people: structuredClone(PEOPLE),
    requirements: structuredClone(REQUIREMENTS),
    links: structuredClone(LINKS),
    uploads: uploads(),
  };
}
