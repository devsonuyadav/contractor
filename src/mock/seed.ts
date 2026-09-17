// Demo data, seeded relative to today so dates stay current.
//
// Three companies run contractor programs, and one of them also works for the other two:
//   Riverside Energy     client of 12 contractors (the original demo)
//   Northwind Utilities  client of Delta Mechanical and Redline Excavation
//   Delta Mechanical     contractor to Riverside and Northwind, and client of its own subcontractors,
//                        Ironwood Welding and Kestrel Insulation
// Delta has also brought Ironwood onto Riverside's turbine shutdown as its subcontractor: Riverside's
// requirements flow down to Ironwood through Delta, and Delta checks Ironwood's paperwork before Riverside does.
import type { Approval, Assignment, ContactInfo, ContractorStatus, DemoDB, Evidence, Member, Relationship, RequirementContent } from '@/lib/types';
import { DAY_MS, addPeriod, dayKey, fmtDate, plusDays } from '@/lib/dates';
import { firstName, possessive } from '@/lib/describe';
import * as C from './content';
import { addActivity, addEmail, emailSponsor, gateCheck, inviteEmail, labelOf, shortName, sponsorEmails, sweep, syncRelationship } from './logic';
import { certificateDataUrl, hashString, mulberry32, signatureDataUrl } from './svg';

export const SCHEMA = 10;

export const DEFAULT_MEMBER = 'M-PRIYA';

interface OrgSpec {
  id: string;
  name: string;
  trade: string;
  created: number;
  contact: ContactInfo;
  address: string;
  domain: string;
  license?: string;
  employees?: number;
  prefix: string;
  program?: boolean;
  /** Left out: no subscription. 'REQUESTED' is waiting for EHSSoftware.io to decide. */
  subscription?: 'REQUESTED';
  /** EHSSoftware.io staff, who turn subscriptions on. */
  ehs?: boolean;
  /** The login for the company. Defaults to the main contact. */
  member?: { id: string; name: string; title: string; email: string };
  /** As a client: who its contractors hear from, and a line added to its invitations. */
  programContact?: ContactInfo;
  inviteNote?: string;
  workers: { name: string; trade: string; addedAgo?: number }[];
}

interface RelSpec {
  id: string;
  client: string;
  contractor: string;
  status: ContractorStatus;
  created: number;
  statusAgo?: number;
  note?: string;
  profileAgo?: number;
  sites: string[];
  groups: string[];
  tags: string[];
  /** 1-based positions in the contractor's worker list; omitted means the whole roster. */
  crew?: number[];
  /** For a subcontractor: the relationship of the contractor that brought it in. */
  sponsor?: string;
}

const ORGS: OrgSpec[] = [
  {
    id: 'O-EHS', name: 'EHSSoftware.io', trade: 'EHS software', created: 1200, ehs: true,
    contact: { name: 'Sam Rivera', title: 'Customer Success', email: 'sam.rivera@ehssoftware.io', phone: '(555) 010-9000' },
    address: 'EHSSoftware.io', domain: 'ehssoftware.io', prefix: 'EHS',
    member: { id: 'M-EHS', name: 'Sam Rivera', title: 'Customer Success, EHSSoftware.io', email: 'sam.rivera@ehssoftware.io' },
    workers: [],
  },
  {
    id: 'O-RIVERSIDE', name: 'Riverside Energy', trade: 'Power generation', created: 900, program: true,
    contact: { name: 'Priya Nair', title: 'EHS Manager', email: 'priya.nair@riverside-energy.example', phone: '(555) 010-0100' },
    address: '400 River Rd, Riverside', domain: 'riverside-energy.example', prefix: 'RVE',
    member: { id: 'M-PRIYA', name: 'Priya Nair', title: 'EHS Manager', email: 'priya.nair@riverside-energy.example' },
    programContact: { name: 'Riverside Energy EHS team', title: 'Contractor compliance', email: 'contractors@riverside-energy.example', phone: '(555) 010-0110' },
    inviteNote: 'Questions about insurance or the prequalification questionnaire? Call the EHS team before you upload anything.',
    workers: [],
  },
  {
    id: 'O-NORTHWIND', name: 'Northwind Utilities', trade: 'Water utility', created: 700, program: true,
    contact: { name: 'Grace Liu', title: 'Contractor Safety Coordinator', email: 'grace.liu@northwind-utilities.example', phone: '(555) 010-0200' },
    address: '1 Reservoir Way, Northwind', domain: 'northwind-utilities.example', prefix: 'NWU',
    member: { id: 'M-GRACE', name: 'Grace Liu', title: 'Contractor Safety Coordinator', email: 'grace.liu@northwind-utilities.example' },
    programContact: { name: 'Grace Liu', title: 'Contractor Safety Coordinator', email: 'grace.liu@northwind-utilities.example', phone: '(555) 010-0200' },
    workers: [],
  },
  {
    id: 'O-DELTA', name: 'Delta Mechanical Services', trade: 'Mechanical', created: 900, program: true,
    contact: { name: 'Chen Wei', title: 'General Manager', email: 'chen@deltamech.example', phone: '(555) 010-2890' },
    address: '210 Turbine Rd, Riverside', domain: 'deltamech.example', license: 'MC-77310', employees: 61, prefix: 'DMS',
    member: { id: 'M-CHEN', name: 'Chen Wei', title: 'General Manager', email: 'chen@deltamech.example' },
    workers: [
      { name: 'Chen Wei', trade: 'Mechanical lead' },
      { name: 'Maria Santos', trade: 'Pipefitter' },
      { name: 'Erik Larsen', trade: 'Millwright' },
      { name: 'Fatima Zahra', trade: 'Welder' },
      { name: 'Jonas Berg', trade: 'Pipefitter', addedAgo: 6 },
      { name: 'Ruth Okonkwo', trade: 'Welder' },
    ],
  },
  {
    id: 'O-ORTEGA', name: 'Ortega Roofing', trade: 'Roofing', created: 820, subscription: 'REQUESTED',
    contact: { name: 'Luis Ortega', title: 'Owner', email: 'luis@ortegaroofing.example', phone: '(555) 010-2231' },
    address: '1180 Mill Creek Rd, Riverside', domain: 'ortegaroofing.example', license: 'RC-448812', employees: 14, prefix: 'ORT',
    workers: [
      { name: 'Luis Ortega', trade: 'Foreman' },
      { name: 'Dana Whitfield', trade: 'Roofer' },
      { name: 'Sam Okafor', trade: 'Roofer' },
      { name: 'Priyanka Rao', trade: 'Labourer', addedAgo: 5 },
    ],
  },
  {
    id: 'O-BRIGHT', name: 'Brightline Electrical', trade: 'Electrical', created: 760,
    contact: { name: 'Aisha Karim', title: 'Operations Manager', email: 'aisha@brightline-electric.example', phone: '(555) 010-4410' },
    address: '77 Foundry Ave, Riverside', domain: 'brightline-electric.example', license: 'EC-20931', employees: 32, prefix: 'BRL',
    workers: [
      { name: 'Aisha Karim', trade: 'Lead electrician' },
      { name: 'Tom Becker', trade: 'Electrician' },
      { name: 'Mei Lin', trade: 'Electrician' },
      { name: 'Jordan Price', trade: 'Apprentice electrician', addedAgo: 10 },
    ],
  },
  {
    id: 'O-KEYSTONE', name: 'Keystone Scaffolding', trade: 'Scaffolding', created: 20,
    contact: { name: 'Andre Novak', title: 'Director', email: 'andre@keystonescaffold.example', phone: '(555) 010-7720' },
    address: '12 Quarry Ln, Eastgate', domain: 'keystonescaffold.example', employees: 21, prefix: 'KSS',
    workers: [
      { name: 'Andre Novak', trade: 'Scaffold supervisor' },
      { name: 'Lena Fischer', trade: 'Scaffolder' },
      { name: 'Omar Haddad', trade: 'Scaffolder' },
    ],
  },
  {
    id: 'O-SUMMIT', name: 'Summit Crane & Rigging', trade: 'Crane & rigging', created: 700,
    contact: { name: 'Paul Keller', title: 'Operations Director', email: 'paul@summitcrane.example', phone: '(555) 010-3388' },
    address: '900 Industrial Pkwy, Port Riverside', domain: 'summitcrane.example', license: 'CR-5521', employees: 48, prefix: 'SCR',
    workers: [
      { name: 'Grace Mwangi', trade: 'Crane operator' },
      { name: 'Pete Romano', trade: 'Rigger / signal person' },
      { name: 'Hugo Brandt', trade: 'Crane operator' },
    ],
  },
  {
    id: 'O-CLEAR', name: 'Clearwater Environmental', trade: 'Environmental services', created: 640,
    contact: { name: 'Nadia Petrov', title: 'Project Manager', email: 'nadia@clearwater-env.example', phone: '(555) 010-6671' },
    address: '3 Wetland Way, Riverside', domain: 'clearwater-env.example', employees: 26, prefix: 'CWE',
    workers: [
      { name: 'Nadia Petrov', trade: 'Site lead' },
      { name: 'Ben Carter', trade: 'Technician' },
      { name: 'Kofi Mensah', trade: 'Technician' },
    ],
  },
  {
    id: 'O-IRONWOOD', name: 'Ironwood Welding & Fabrication', trade: 'Welding', created: 400,
    contact: { name: 'Sean Doyle', title: 'Owner', email: 'sean@ironwoodfab.example', phone: '(555) 010-9912' },
    address: '4 Forge Row, Eastgate', domain: 'ironwoodfab.example', license: 'WF-30417', employees: 6, prefix: 'IWF',
    workers: [
      { name: 'Sean Doyle', trade: 'Welder / owner' },
      { name: 'Ana Costa', trade: 'Welder' },
    ],
  },
  {
    id: 'O-APEX', name: 'Apex Painting & Coatings', trade: 'Painting', created: 12,
    contact: { name: 'Rosa Delgado', title: 'Owner', email: 'rosa@apexcoatings.example', phone: '(555) 010-5543' },
    address: '48 Canal St, Riverside', domain: 'apexcoatings.example', employees: 9, prefix: 'APX',
    workers: [
      { name: 'Rosa Delgado', trade: 'Painter' },
      { name: 'Ian Murphy', trade: 'Painter' },
    ],
  },
  {
    id: 'O-PINE', name: 'Pinecrest Janitorial', trade: 'Janitorial', created: 520,
    contact: { name: 'Joy Adeyemi', title: 'Account Manager', email: 'joy@pinecrest-clean.example', phone: '(555) 010-1167' },
    address: '5 Elm Court, Riverside', domain: 'pinecrest-clean.example', employees: 40, prefix: 'PCJ',
    workers: [
      { name: 'Joy Adeyemi', trade: 'Supervisor' },
      { name: 'Carlos Ruiz', trade: 'Cleaner' },
      { name: 'Hannah Schultz', trade: 'Cleaner' },
    ],
  },
  {
    id: 'O-NORTH', name: 'Northgate Security', trade: 'Security', created: 60,
    contact: { name: 'Derek Mills', title: 'Owner', email: 'derek@northgatesecurity.example', phone: '(555) 010-8844' },
    address: '19 Watch Hill, Eastgate', domain: 'northgatesecurity.example', employees: 12, prefix: 'NGS',
    workers: [
      { name: 'Derek Mills', trade: 'Security officer' },
      { name: 'Anita Shah', trade: 'Security officer' },
    ],
  },
  {
    id: 'O-REDLINE', name: 'Redline Excavation', trade: 'Excavation', created: 480,
    contact: { name: 'Mike Donovan', title: 'Owner', email: 'mike@redline-dig.example', phone: '(555) 010-4476' },
    address: 'Unit 4, Gravel Pit Rd', domain: 'redline-dig.example', license: 'EX-1188', employees: 18, prefix: 'RLE',
    workers: [
      { name: 'Mike Donovan', trade: 'Excavator operator' },
      { name: 'Tariq Aziz', trade: 'Labourer' },
      { name: 'Olivia Brooks', trade: 'Banksman' },
    ],
  },
  {
    id: 'O-BLUEWAVE', name: 'Bluewave Plumbing', trade: 'Plumbing', created: 9,
    contact: { name: 'Tessa Byrne', title: 'Office Manager', email: 'tessa@bluewave-plumbing.example', phone: '(555) 010-3301' },
    address: '', domain: 'bluewave-plumbing.example', prefix: 'BWP', workers: [],
  },
  {
    id: 'O-KESTREL', name: 'Kestrel Insulation', trade: 'Insulation', created: 30,
    contact: { name: 'Marta Kowalski', title: 'Owner', email: 'marta@kestrel-insulation.example', phone: '(555) 010-6120' },
    address: '22 Loft St, Northwind', domain: 'kestrel-insulation.example', employees: 7, prefix: 'KIN',
    workers: [
      { name: 'Marta Kowalski', trade: 'Insulator / owner' },
      { name: 'Dev Patel', trade: 'Insulator' },
    ],
  },
];

const RELS: RelSpec[] = [
  // Riverside Energy's program
  { id: 'RE-ORTEGA', client: 'O-RIVERSIDE', contractor: 'O-ORTEGA', status: 'Approved', created: 820, statusAgo: 800, sites: ['S-TURBINE'], groups: ['G-BASE'], tags: ['Preferred'] },
  { id: 'RE-BRIGHT', client: 'O-RIVERSIDE', contractor: 'O-BRIGHT', status: 'Approved', created: 760, statusAgo: 740, sites: ['S-HARBOR'], groups: ['G-BASE', 'G-ELEC'], tags: ['Night shift'] },
  { id: 'RE-KEYSTONE', client: 'O-RIVERSIDE', contractor: 'O-KEYSTONE', status: 'Pending', created: 20, profileAgo: 3, sites: ['S-TURBINE'], groups: ['G-BASE', 'G-HIGHRISK'], tags: [] },
  { id: 'RE-SUMMIT', client: 'O-RIVERSIDE', contractor: 'O-SUMMIT', status: 'Approved', created: 700, statusAgo: 690, sites: ['S-HARBOR', 'S-TANK'], groups: ['G-BASE', 'G-CRANE'], tags: ['Union', 'Heavy lift'] },
  { id: 'RE-CLEAR', client: 'O-RIVERSIDE', contractor: 'O-CLEAR', status: 'Approved', created: 640, statusAgo: 620, sites: ['S-TANK'], groups: ['G-BASE', 'G-ENV'], tags: [] },
  { id: 'RE-APEX', client: 'O-RIVERSIDE', contractor: 'O-APEX', status: 'Pending', created: 12, profileAgo: 6, sites: ['S-HQ'], groups: ['G-BASE'], tags: [] },
  { id: 'RE-DELTA', client: 'O-RIVERSIDE', contractor: 'O-DELTA', status: 'Approved', created: 900, statusAgo: 880, sites: ['S-TURBINE', 'S-TANK'], groups: ['G-BASE', 'G-HIGHRISK'], tags: ['Preferred', 'Union'], crew: [1, 2, 3, 4] },
  // Delta's welding sub on the turbine shutdown: sponsored by Delta, waiting for Riverside's approval.
  { id: 'RE-IRONWOOD', client: 'O-RIVERSIDE', contractor: 'O-IRONWOOD', status: 'Pending', created: 5, sites: ['S-TURBINE'], groups: [], tags: [], sponsor: 'RE-DELTA' },
  { id: 'RE-PINE', client: 'O-RIVERSIDE', contractor: 'O-PINE', status: 'Approved', created: 520, statusAgo: 505, sites: ['S-HQ'], groups: ['G-LIGHT'], tags: ['Evening'] },
  {
    id: 'RE-NORTH', client: 'O-RIVERSIDE', contractor: 'O-NORTH', status: 'Denied', created: 60, statusAgo: 40, profileAgo: 55, sites: [], groups: ['G-LIGHT'], tags: [],
    note: "Couldn't provide workers' compensation coverage for the guards they planned to bring on site.",
  },
  { id: 'RE-REDLINE', client: 'O-RIVERSIDE', contractor: 'O-REDLINE', status: 'Approved', created: 480, statusAgo: 470, sites: ['S-TANK'], groups: ['G-BASE', 'G-HIGHRISK'], tags: ['Civil'] },
  { id: 'RE-BLUEWAVE', client: 'O-RIVERSIDE', contractor: 'O-BLUEWAVE', status: 'New', created: 9, sites: [], groups: ['G-BASE'], tags: [] },
  // Northwind Utilities' program
  { id: 'NW-DELTA', client: 'O-NORTHWIND', contractor: 'O-DELTA', status: 'Approved', created: 300, statusAgo: 290, sites: ['NS-PUMP'], groups: ['NG-BASE'], tags: [], crew: [1, 4, 5] },
  { id: 'NW-REDLINE', client: 'O-NORTHWIND', contractor: 'O-REDLINE', status: 'Pending', created: 10, profileAgo: 4, sites: ['NS-PUMP'], groups: ['NG-BASE'], tags: [], crew: [1] },
  // Delta Mechanical's own program for its subcontractors
  { id: 'DM-IRONWOOD', client: 'O-DELTA', contractor: 'O-IRONWOOD', status: 'Approved', created: 400, statusAgo: 390, sites: ['DS-TURBINE'], groups: ['DG-BASE', 'DG-HOT'], tags: ['Welding sub'] },
  { id: 'DM-KESTREL', client: 'O-DELTA', contractor: 'O-KESTREL', status: 'Pending', created: 30, profileAgo: 2, sites: ['DS-PUMP'], groups: ['DG-BASE'], tags: [] },
];

const ISSUERS: Record<string, [string, string]> = {
  COI: ['Certificate of liability insurance', 'Harborline Mutual Insurance'],
  WC: ["Workers' compensation coverage", 'State Workers Insurance Fund'],
  SAFEPROG: ['Health & safety program', 'Company document'],
  FORKLIFT: ['Operator certification', 'LiftSafe Training Co.'],
  CRANE: ['Operator certification', 'National Crane Operator Board'],
  SPILL: ['Spill response plan', 'Company document'],
  LICENSE: ['Business licence', 'State Licensing Board'],
  WELD: ['Welder qualification record', 'American Welding Society'],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const issuerKey = (rid: string) => rid.split('-').slice(1).join('-');

export function buildSeed(): DemoDB {
  const rnd = mulberry32(20260911);
  const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));
  const base = new Date();
  base.setHours(9, 0, 0, 0);
  const T = base.getTime();
  const at = (daysAgo: number, hoursAgo = 0) => new Date(T - daysAgo * DAY_MS - hoursAgo * 3_600_000).toISOString();
  const ahead = (days: number) => new Date(T + days * DAY_MS).toISOString();
  const now = at(0);
  const minIso = (a: string, b: string) => (a < b ? a : b);

  const db: DemoDB = {
    schema: SCHEMA,
    clock_offset_days: 0,
    last_sweep_day: null,
    seq: 1000,
    orgs: [],
    members: [],
    relationships: [],
    workers: [],
    requirements: [],
    groups: [],
    sites: [],
    assignments: [],
    activity: [],
    outbox: [],
    checkins: [],
  };

  // ---------------------------------------------------------------- companies, logins, rosters
  for (const s of ORGS) {
    db.orgs.push({
      id: s.id,
      name: s.name,
      short: shortName(s.name),
      trade: s.trade,
      contact: s.contact,
      address: s.address,
      website: s.address ? `https://${s.domain}` : undefined,
      license_no: s.license,
      employees_count: s.employees,
      created_at: at(s.created),
      program_enabled: !!s.program,
      subscription: s.program ? 'ACTIVE' : s.subscription === 'REQUESTED' ? 'REQUESTED' : 'NONE',
      subscription_since: s.program ? at(s.created - 20) : null,
      subscription_requested_at: s.subscription === 'REQUESTED' ? at(2) : null,
      subscription_requested_by: s.subscription === 'REQUESTED' ? (s.member?.name ?? s.contact.name) : undefined,
      is_ehs: s.ehs || undefined,
      program_contact: s.programContact,
      invite_note: s.inviteNote,
    });
    const m: Member = s.member
      ? { ...s.member, org_id: s.id }
      : { id: `M-${s.id.slice(2)}`, org_id: s.id, name: s.contact.name, title: s.contact.title ?? '', email: s.contact.email };
    db.members.push(m);
    s.workers.forEach((w, i) =>
      db.workers.push({
        id: `${s.id}-W${i + 1}`,
        org_id: s.id,
        name: w.name,
        trade: w.trade,
        email: `${firstName(w.name).toLowerCase()}@${s.domain}`,
        phone: `(555) 01${between(10, 99)}-${between(1000, 9999)}`,
        badge_id: `${s.prefix}-${1001 + i}`,
        active: true,
        created_at: at(w.addedAgo ?? Math.max(1, s.created - 2)),
      }),
    );
  }
  const org = (id: string) => db.orgs.find((o) => o.id === id)!;
  const adminOf = (clientId: string) => db.members.find((m) => m.org_id === clientId)!;

  // ---------------------------------------------------------------- libraries
  const req = (orgId: string, id: string, content: RequirementContent, version = 1, updatedAgo = 540) => {
    db.requirements.push({ id, org_id: orgId, version, created_at: at(560), updated_at: at(updatedAgo), ...content });
  };
  const group = (orgId: string, id: string, name: string, description: string, requirementIds: string[]) =>
    db.groups.push({ id, org_id: orgId, name, description, requirement_ids: requirementIds, created_at: at(500), updated_at: at(500) });
  const site = (orgId: string, id: string, name: string, code: string, address: string, description: string, groupIds: string[]) =>
    db.sites.push({ id, org_id: orgId, name, code, address, description, group_ids: groupIds, created_at: at(450) });

  const RE = 'O-RIVERSIDE';
  req(RE, 'R-COI', { title: 'Certificate of Liability Insurance', type: 'DOCUMENT', description: 'Proof of general liability insurance for the company.', applies_to: 'COMPANY', validity: { kind: 'DOCUMENT_DATE' }, scored: true, needs_review: true, document_hint: C.HINTS.COI });
  req(RE, 'R-WC', { title: "Workers' Compensation Certificate", type: 'DOCUMENT', description: "Workers' compensation coverage for everyone the contractor brings on site.", applies_to: 'COMPANY', validity: { kind: 'DOCUMENT_DATE' }, scored: true, needs_review: true, document_hint: C.HINTS.WC });
  req(RE, 'R-PREQ', { title: 'Contractor Prequalification Questionnaire', type: 'FORM', description: 'Safety performance, programs and incident history, reviewed by the EHS team every year.', applies_to: 'COMPANY', validity: { kind: 'PERIOD', every: 1, unit: 'years' }, flows_down: false, scored: true, needs_review: true, form: C.PREQ_FORM }, 2, 60);
  req(RE, 'R-SAFEPROG', { title: 'Written Safety Program', type: 'DOCUMENT', description: "The contractor's own health and safety program or manual.", applies_to: 'COMPANY', validity: { kind: 'NONE' }, flows_down: false, scored: true, needs_review: true, document_hint: C.HINTS.SAFEPROG });
  req(RE, 'R-SITERULES', { title: 'Site Safety Rules Acknowledgement', type: 'SIGNOFF', description: 'Read and sign the Riverside Energy site safety rules once a year.', applies_to: 'COMPANY', validity: { kind: 'PERIOD', every: 1, unit: 'years' }, scored: true, needs_review: false, policy: C.SITE_RULES });
  req(RE, 'R-DRUG', { title: 'Drug & Alcohol Policy', type: 'SIGNOFF', description: 'Accept the drug and alcohol policy on behalf of the company.', applies_to: 'COMPANY', validity: { kind: 'NONE' }, scored: true, needs_review: false, policy: C.DRUG_POLICY });
  req(RE, 'R-ORIENT', { title: 'Contractor Safety Orientation', type: 'TRAINING', description: 'Stop-work authority, hazard reporting, PPE, permits and emergencies.', applies_to: 'WORKER', validity: { kind: 'PERIOD', every: 1, unit: 'years' }, scored: true, needs_review: false, training: C.ORIENTATION });
  req(RE, 'R-HEIGHTS', { title: 'Working at Heights', type: 'TRAINING', description: 'Fall protection, harness inspection and rescue planning.', applies_to: 'WORKER', validity: { kind: 'PERIOD', every: 3, unit: 'years' }, scored: true, needs_review: false, training: C.HEIGHTS });
  req(RE, 'R-CONFINED', { title: 'Confined Space Entry Awareness', type: 'TRAINING', description: 'Atmospheric hazards, entry permits, attendants and rescue.', applies_to: 'WORKER', validity: { kind: 'PERIOD', every: 2, unit: 'years' }, scored: true, needs_review: false, training: C.CONFINED });
  req(RE, 'R-FORKLIFT', { title: 'Forklift Operator Certificate', type: 'DOCUMENT', description: 'Operator certification for powered industrial trucks.', applies_to: 'WORKER', validity: { kind: 'DOCUMENT_DATE' }, scored: true, needs_review: true, document_hint: C.HINTS.FORKLIFT });
  req(RE, 'R-CRANE', { title: 'Crane Operator Certification', type: 'DOCUMENT', description: 'Certification for the crane type being operated.', applies_to: 'WORKER', validity: { kind: 'DOCUMENT_DATE' }, scored: true, needs_review: true, document_hint: C.HINTS.CRANE });
  req(RE, 'R-SPILL', { title: 'Spill Response Plan', type: 'DOCUMENT', description: 'Site-specific spill response plan for environmental work.', applies_to: 'COMPANY', validity: { kind: 'PERIOD', every: 1, unit: 'years' }, scored: true, needs_review: true, document_hint: C.HINTS.SPILL });
  req(RE, 'R-QSA', { title: 'Quarterly Safety Self-Assessment', type: 'FORM', description: 'Hours, recordables and near misses for the quarter. Tracked, not scored.', applies_to: 'COMPANY', validity: { kind: 'PERIOD', every: 3, unit: 'months' }, flows_down: false, scored: false, needs_review: true, form: C.QSA_FORM });
  req(RE, 'R-LICENSE', { title: 'Business Licence', type: 'DOCUMENT', description: 'Current state business or trade licence.', applies_to: 'COMPANY', validity: { kind: 'DOCUMENT_DATE' }, scored: true, needs_review: true, document_hint: C.HINTS.LICENSE });
  req(RE, 'R-NFPA', { title: 'Electrical Safe Work Practices (NFPA 70E)', type: 'TRAINING', description: 'Arc flash boundaries, electrically safe work conditions and PPE categories.', applies_to: 'WORKER', validity: { kind: 'PERIOD', every: 3, unit: 'years' }, scored: true, needs_review: false, training: C.NFPA });
  req(RE, 'R-HARBOR', { title: 'Harbor Terminal Site Induction', type: 'TRAINING', description: 'Pier 4 access, exclusion zones and marine emergencies.', applies_to: 'WORKER', validity: { kind: 'PERIOD', every: 1, unit: 'years' }, scored: true, needs_review: false, training: C.HARBOR });

  group(RE, 'G-BASE', 'Baseline: all contractors', 'Insurance, prequalification and site rules that every contractor needs before starting work.', ['R-COI', 'R-WC', 'R-PREQ', 'R-SITERULES', 'R-DRUG']);
  group(RE, 'G-HIGHRISK', 'High-risk work', 'Worker training for work at height and in confined spaces.', ['R-HEIGHTS', 'R-CONFINED']);
  group(RE, 'G-CRANE', 'Crane & rigging', 'Operator certification and fall protection for lifting crews.', ['R-CRANE', 'R-HEIGHTS']);
  group(RE, 'G-ELEC', 'Electrical work', 'Safe work practices for anyone working on or near energised equipment.', ['R-NFPA']);
  group(RE, 'G-ENV', 'Environmental services', 'Spill response and a written safety program for waste and remediation work.', ['R-SPILL', 'R-SAFEPROG']);
  group(RE, 'G-HARBOR', 'Harbor Terminal site pack', 'Site induction and orientation for anyone badging in at Pier 4.', ['R-HARBOR', 'R-ORIENT']);
  group(RE, 'G-LIGHT', 'Light services', 'Janitorial, security and other low-risk services.', ['R-COI', 'R-SITERULES', 'R-ORIENT']);
  group(RE, 'G-YARD', 'Yard & logistics', 'Lift truck operators and yard crews.', ['R-FORKLIFT', 'R-ORIENT']);

  site(RE, 'S-HARBOR', 'Harbor Terminal Expansion', 'HTE-26', 'Pier 4, 2 Harbor Rd', 'New berth and crane rail installation. Access through Gate H2.', ['G-HARBOR']);
  site(RE, 'S-TURBINE', 'Riverside Plant: Turbine Hall Shutdown', 'RVS-TH', '400 River Rd, Riverside', 'Planned outage: turbine overhaul, roofing and scaffolding.', ['G-HIGHRISK']);
  site(RE, 'S-TANK', 'North Yard Tank Farm', 'NY-TF', 'North Yard, Access Rd 7', 'Tank cleaning and inspection, with confined space entries most days.', ['G-HIGHRISK']);
  site(RE, 'S-HQ', 'Head Office Fit-out', 'HQ-FO', '55 Commerce St', 'Office refurbishment with low-risk trades.', []);

  const NW = 'O-NORTHWIND';
  req(NW, 'N-COI', { title: 'Certificate of Liability Insurance', type: 'DOCUMENT', description: 'General liability insurance naming Northwind Utilities as additional insured.', applies_to: 'COMPANY', validity: { kind: 'DOCUMENT_DATE' }, scored: true, needs_review: true, document_hint: C.rebrand(C.HINTS.COI, 'Northwind Utilities') }, 1, 300);
  req(NW, 'N-HANDBOOK', { title: 'Northwind Contractor Safety Handbook', type: 'SIGNOFF', description: 'Read and accept the handbook once a year.', applies_to: 'COMPANY', validity: { kind: 'PERIOD', every: 1, unit: 'years' }, scored: true, needs_review: false, policy: C.rebrand(C.SITE_RULES, 'Northwind Utilities') }, 1, 300);
  req(NW, 'N-ORIENT', { title: 'Northwind Site Orientation', type: 'TRAINING', description: 'Treatment plant hazards, chlorine areas, PPE and emergencies.', applies_to: 'WORKER', validity: { kind: 'PERIOD', every: 1, unit: 'years' }, scored: true, needs_review: false, training: C.rebrand(C.ORIENTATION, 'Northwind Utilities') }, 1, 300);
  group(NW, 'NG-BASE', 'Northwind contractor baseline', 'Insurance, the safety handbook and site orientation for every contractor.', ['N-COI', 'N-HANDBOOK', 'N-ORIENT']);
  site(NW, 'NS-PUMP', 'Pump Station 3 Retrofit', 'NW-PS3', '18 Canal Rd, Northwind', 'Pump and valve replacement with live chlorine dosing nearby.', []);

  const DM = 'O-DELTA';
  req(DM, 'D-COI', { title: 'Certificate of Liability Insurance', type: 'DOCUMENT', description: 'General liability insurance naming Delta Mechanical Services as additional insured.', applies_to: 'COMPANY', validity: { kind: 'DOCUMENT_DATE' }, scored: true, needs_review: true, document_hint: C.rebrand(C.HINTS.COI, 'Delta Mechanical Services') }, 1, 420);
  req(DM, 'D-WC', { title: "Workers' Compensation Certificate", type: 'DOCUMENT', description: 'Coverage for everyone the subcontractor brings onto a Delta job.', applies_to: 'COMPANY', validity: { kind: 'DOCUMENT_DATE' }, scored: true, needs_review: true, document_hint: C.HINTS.WC }, 1, 420);
  req(DM, 'D-RULES', { title: 'Delta Safe Work Rules', type: 'SIGNOFF', description: "Delta's rules for subcontractors, which include our clients' site rules.", applies_to: 'COMPANY', validity: { kind: 'PERIOD', every: 1, unit: 'years' }, scored: true, needs_review: false, policy: C.rebrand(C.SITE_RULES, 'Delta Mechanical Services') }, 1, 420);
  req(DM, 'D-HOTWORK', { title: 'Hot Work Permit Training', type: 'TRAINING', description: 'Permits, the 11-metre rule and fire watch.', applies_to: 'WORKER', validity: { kind: 'PERIOD', every: 2, unit: 'years' }, scored: true, needs_review: false, training: C.HOT_WORK }, 1, 420);
  req(DM, 'D-WELD', { title: 'Welder Qualification Record', type: 'DOCUMENT', description: 'Current welder qualification for the processes used on Delta jobs.', applies_to: 'WORKER', validity: { kind: 'DOCUMENT_DATE' }, scored: true, needs_review: true, document_hint: C.WELD_CERT_HINT }, 1, 420);
  group(DM, 'DG-BASE', 'Subcontractor baseline', 'Insurance and Delta Safe Work Rules for every subcontractor.', ['D-COI', 'D-WC', 'D-RULES']);
  group(DM, 'DG-HOT', 'Hot work crews', 'Hot work training and welder qualifications.', ['D-HOTWORK', 'D-WELD']);
  site(DM, 'DS-TURBINE', 'Riverside Turbine Hall: Delta mechanical package', 'DMS-2611', '400 River Rd, Riverside', "Delta's piping and pump scope inside Riverside Energy's shutdown.", ['DG-HOT']);
  site(DM, 'DS-PUMP', 'Northwind Pump Station 3: piping', 'DMS-2618', '18 Canal Rd, Northwind', "Delta's piping and insulation scope for Northwind Utilities.", []);

  // ---------------------------------------------------------------- relationships
  const orgSpec = (id: string) => ORGS.find((o) => o.id === id)!;
  for (const r of RELS) {
    const c = orgSpec(r.contractor);
    const admin = adminOf(r.client);
    const crewIds = (r.crew ?? c.workers.map((_, i) => i + 1)).map((n) => `${r.contractor}-W${n}`);
    const rel: Relationship = {
      id: r.id,
      client_id: r.client,
      contractor_id: r.contractor,
      status: r.status,
      status_note: r.note,
      status_changed_at: r.statusAgo !== undefined ? at(r.statusAgo) : r.profileAgo !== undefined ? at(r.profileAgo) : undefined,
      site_ids: r.sites,
      group_ids: r.groups,
      tags: r.tags,
      worker_ids: crewIds,
      created_at: at(r.created),
      invited_by: r.sponsor ? `${adminOf(db.relationships.find((x) => x.id === r.sponsor)!.contractor_id).name} (${org(db.relationships.find((x) => x.id === r.sponsor)!.contractor_id).name})` : admin.name,
      profile_submitted_at: r.sponsor ? at(r.created) : r.profileAgo !== undefined ? at(r.profileAgo) : r.status === 'Approved' ? at(Math.max(1, r.created - 4)) : null,
      sponsor_id: r.sponsor ?? null,
    };
    db.relationships.push(rel);
    syncRelationship(db, rel.id, admin.name, at(r.created));
    // Workers hired later were assigned their items when they joined.
    for (const a of db.assignments.filter((x) => x.relationship_id === rel.id && x.worker_id)) {
      const w = db.workers.find((x) => x.id === a.worker_id)!;
      if (a.assigned_at < w.created_at) {
        a.assigned_at = w.created_at;
        a.submission.opened_at = w.created_at;
        a.submission.due_at = plusDays(w.created_at, 14);
        a.history[0].at = w.created_at;
      }
    }
    const client = org(r.client);
    const contractor = org(r.contractor);
    if (r.sponsor) {
      const sponsorOrg = org(db.relationships.find((x) => x.id === r.sponsor)!.contractor_id);
      const sponsorAdmin = adminOf(sponsorOrg.id);
      addActivity(db, { at: at(r.created), actor: sponsorAdmin.name, role: 'contractor', client_id: client.id, relationship_id: rel.id, text: `${sponsorAdmin.name} brought ${contractor.name} onto ${possessive(client.name)} work as ${possessive(sponsorOrg.name)} subcontractor`, tone: 'info' });
      sponsorEmails(db, rel, sponsorAdmin.name, at(r.created));
      continue;
    }
    if (r.created <= 45) addActivity(db, { at: at(r.created), actor: admin.name, role: 'admin', client_id: client.id, relationship_id: rel.id, text: `${admin.name} invited ${contractor.name}`, tone: 'info' });
    if (r.status === 'New' || r.status === 'Pending') inviteEmail(db, rel, at(r.created), c.created > r.created);
    if (r.profileAgo !== undefined) {
      addActivity(db, { at: at(r.profileAgo), actor: contractor.contact.name, role: 'contractor', client_id: client.id, relationship_id: rel.id, text: `${contractor.name} submitted their application`, tone: 'info' });
      addEmail(db, { at: at(r.profileAgo), to: admin.email, to_name: admin.name, subject: `Application submitted: ${contractor.name}`, body: `${contractor.contact.name} submitted ${contractor.name}'s application.`, kind: 'APPLICATION', client_id: client.id, relationship_id: rel.id, audience: 'admin' });
    }
    if (r.status === 'Denied' && r.statusAgo !== undefined) {
      addActivity(db, { at: at(r.statusAgo), actor: admin.name, role: 'admin', client_id: client.id, relationship_id: rel.id, text: `${admin.name} changed ${contractor.name} from Pending to Denied`, tone: 'bad' });
    }
  }

  // ---------------------------------------------------------------- scenario helpers
  const relOf = (a: Assignment) => db.relationships.find((r) => r.id === a.relationship_id)!;
  const contractorOfA = (a: Assignment) => org(relOf(a).contractor_id);
  const worker = (id: string | null) => (id ? db.workers.find((w) => w.id === id) ?? null : null);
  const slot = (relId: string, rid: string, workerNo?: number): Assignment => {
    const rel = db.relationships.find((r) => r.id === relId)!;
    const wid = workerNo === undefined ? null : `${rel.contractor_id}-W${workerNo}`;
    const a = db.assignments.find((x) => x.relationship_id === relId && x.requirement_id === rid && x.worker_id === wid && !x.removed);
    if (!a) throw new Error(`seed: no assignment for ${relId} / ${rid} / ${wid}`);
    return a;
  };
  const submitter = (a: Assignment) => {
    const w = worker(a.worker_id);
    return w && a.req.type === 'TRAINING' ? w.name : contractorOfA(a).contact.name;
  };
  const reset = (a: Assignment) => {
    a.approval = null;
    a.previous = [];
    a.exception = null;
    a.submission = { status: 'OPEN', opened_at: a.assigned_at, due_at: plusDays(a.assigned_at, 14), is_renewal: false };
    a.history = [{ at: a.assigned_at, by: adminOf(relOf(a).client_id).name, action: 'Assigned' }];
  };

  const evidence = (a: Assignment, completedAt: string, expiresAt: string | null): Evidence => {
    const c = contractorOfA(a);
    const w = worker(a.worker_id);
    switch (a.req.type) {
      case 'DOCUMENT': {
        const [kicker, issuer] = ISSUERS[issuerKey(a.requirement_id)] ?? ['Certificate', 'Issuing authority'];
        const reference = `${issuerKey(a.requirement_id)}-${between(100000, 999999)}`;
        const issued = expiresAt ? addPeriod(expiresAt, -1, 'years') : plusDays(completedAt, -between(5, 30));
        const holder = w ? `${w.name}, ${c.name}` : c.name;
        return {
          kind: 'DOCUMENT',
          file: {
            name: `${slug(a.req.title)}-${slug(w ? w.name : c.name)}.pdf`,
            size: between(90_000, 640_000),
            type: 'image/svg+xml',
            data_url: certificateDataUrl({ kicker, title: a.req.title, holder, reference, issuer, issued: fmtDate(issued), expires: expiresAt ? fmtDate(expiresAt) : null }),
          },
          issued_at: issued,
          expires_at: expiresAt,
          reference,
        };
      }
      case 'FORM':
        return { kind: 'FORM', answers: C.sampleAnswers(a.req.form!, c.contact.name, rnd, c.employees_count ?? 12) };
      case 'TRAINING': {
        const t = a.req.training!;
        const n = t.quiz.length;
        const correct = rnd() < 0.35 && ((n - 1) / n) * 100 >= t.pass_mark ? n - 1 : n;
        return { kind: 'TRAINING', score: Math.round((correct / n) * 100), passed: true, attempts: rnd() > 0.8 ? 2 : 1, trainee: w ? w.name : c.contact.name };
      }
      case 'SIGNOFF':
        return { kind: 'SIGNOFF', signed_name: c.contact.name, signature: signatureDataUrl(c.contact.name, hashString(c.id)), acknowledged: true };
    }
  };

  const approve = (a: Assignment, opts: { completedAgo?: number; expiresIn?: number } = {}) => {
    const v = a.req.validity;
    const assignedAgo = Math.floor((T - Date.parse(a.assigned_at)) / DAY_MS);
    const defaultAgo = () => (assignedAgo < 26 ? between(0, Math.max(0, assignedAgo - 1)) : between(25, Math.min(200, assignedAgo)));
    let completed: string;
    let expires: string | null = null;
    if (v.kind === 'PERIOD') {
      if (opts.expiresIn !== undefined) {
        expires = ahead(opts.expiresIn);
        completed = addPeriod(expires, -v.every, v.unit);
      } else {
        completed = at(opts.completedAgo ?? defaultAgo(), between(1, 7));
        expires = addPeriod(completed, v.every, v.unit);
      }
    } else if (v.kind === 'DOCUMENT_DATE') {
      completed = at(opts.completedAgo ?? defaultAgo(), between(1, 7));
      expires = ahead(opts.expiresIn ?? between(95, 330));
    } else {
      completed = at(opts.completedAgo ?? defaultAgo(), between(1, 7));
    }
    const rel = relOf(a);
    const c = org(rel.contractor_id);
    const admin = adminOf(rel.client_id);
    const label = labelOf(a, worker(a.worker_id));
    const auto = !a.req.needs_review;
    const by = submitter(a);
    const approvedAt = auto ? completed : minIso(new Date(Date.parse(completed) + between(3, 30) * 3_600_000).toISOString(), now);
    const approvedBy = auto ? 'Automatic' : admin.name;
    a.approval = { approved_at: approvedAt, approved_by: approvedBy, expires_at: expires, evidence: evidence(a, completed, expires), submitted_at: completed, submitted_by: by, version: a.req.version, reminders: [], auto };
    a.submission = { status: 'CLOSED', opened_at: a.assigned_at, due_at: null, is_renewal: false, reviewed_at: approvedAt, reviewed_by: approvedBy };
    a.history = [
      { at: a.assigned_at, by: admin.name, action: 'Assigned' },
      { at: completed, by, action: 'Submitted' },
      { at: approvedAt, by: approvedBy, action: auto ? 'Auto-approved' : 'Approved' },
    ];
    if ((T - Date.parse(approvedAt)) / DAY_MS <= 30) {
      const base = { client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id };
      if (auto) {
        addActivity(db, { at: approvedAt, actor: by, role: 'contractor', ...base, text: `${c.name} completed ${label}`, tone: 'good' });
      } else {
        addActivity(db, { at: completed, actor: by, role: 'contractor', ...base, text: `${c.name} submitted ${label}`, tone: 'info' });
        addActivity(db, { at: approvedAt, actor: admin.name, role: 'admin', ...base, text: `${admin.name} approved ${label} for ${c.name}`, tone: 'good' });
      }
    }
  };

  const submit = (a: Assignment, daysAgo: number, hoursAgo = 2) => {
    const when = at(daysAgo, hoursAgo);
    const rel = relOf(a);
    const c = org(rel.contractor_id);
    const admin = adminOf(rel.client_id);
    const label = labelOf(a, worker(a.worker_id));
    const by = submitter(a);
    const renewal = !!a.approval;
    const expires = a.req.validity.kind === 'DOCUMENT_DATE' ? ahead(between(300, 365)) : null;
    if (renewal) a.history.push({ at: at(daysAgo + 4), by: 'System', action: `Renewal opened (version ${a.req.version})` });
    a.submission = {
      status: 'SUBMITTED',
      opened_at: renewal ? at(daysAgo + 4) : a.assigned_at,
      due_at: renewal ? a.approval!.expires_at : plusDays(a.assigned_at, 14),
      is_renewal: renewal,
      evidence: evidence(a, when, expires),
      submitted_at: when,
      submitted_by: by,
    };
    a.history.push({ at: when, by, action: renewal ? 'Renewal submitted' : 'Submitted' });
    addActivity(db, { at: when, actor: by, role: 'contractor', client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id, text: `${c.name} submitted ${label}${renewal ? ' (renewal)' : ''}`, tone: 'info' });
    if (rel.sponsor_id) {
      emailSponsor(db, rel, 'SUBMITTED', `Check before ${org(rel.client_id).name} sees it: ${label} (${c.name})`, `${by} submitted ${label} for ${c.name}, your subcontractor on ${org(rel.client_id).name} work.`, when);
    } else {
      addEmail(db, { at: when, to: admin.email, to_name: admin.name, subject: `Ready for review: ${label} (${c.name})`, body: `${by} submitted ${label} for ${c.name}.`, kind: 'SUBMITTED', client_id: rel.client_id, relationship_id: rel.id, audience: 'admin' });
    }
  };

  const sendBack = (a: Assignment, submittedAgo: number, rejectedAgo: number, note: string) => {
    submit(a, submittedAgo, 5);
    const when = at(rejectedAgo, 1);
    const rel = relOf(a);
    const c = org(rel.contractor_id);
    const admin = adminOf(rel.client_id);
    const label = labelOf(a, worker(a.worker_id));
    a.submission = { ...a.submission, status: 'REJECTED', reviewed_at: when, reviewed_by: admin.name, note };
    a.history.push({ at: when, by: admin.name, action: 'Sent back', note });
    addActivity(db, { at: when, actor: admin.name, role: 'admin', client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id, text: `${admin.name} sent back ${label} to ${c.name}`, tone: 'warn' });
    addEmail(db, { at: when, to: c.contact.email, to_name: c.contact.name, subject: `Action needed: ${label}`, body: `Hi ${firstName(c.contact.name)},\n\n${admin.name} reviewed ${label} and needs a change before it can be approved:\n\n"${note}"\n\nFix it and resubmit from your checklist.`, kind: 'REJECTED', client_id: rel.client_id, relationship_id: rel.id, audience: 'contractor', to_org_id: c.id });
  };

  const askException = (a: Assignment, requestedAgo: number, untilIn: number, reason: string) => {
    const when = at(requestedAgo, 3);
    const rel = relOf(a);
    const c = org(rel.contractor_id);
    const admin = adminOf(rel.client_id);
    const label = labelOf(a, worker(a.worker_id));
    a.exception = { status: 'REQUESTED', reason, requested_until: ahead(untilIn), requested_at: when, requested_by: c.contact.name };
    a.history.push({ at: when, by: c.contact.name, action: 'Exception requested', note: reason });
    addActivity(db, { at: when, actor: c.contact.name, role: 'contractor', client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id, text: `${c.name} requested an exception for ${label}`, tone: 'warn' });
    addEmail(db, { at: when, to: admin.email, to_name: admin.name, subject: `Exception requested: ${label} (${c.name})`, body: `${c.contact.name} asked for an exception until ${fmtDate(ahead(untilIn))}:\n\n"${reason}"`, kind: 'EXCEPTION', client_id: rel.client_id, relationship_id: rel.id, audience: 'admin' });
  };

  const grantException = (a: Assignment, requestedAgo: number, decidedAgo: number, untilIn: number, reason: string, note: string) => {
    askException(a, requestedAgo, untilIn, reason);
    const when = at(decidedAgo, 2);
    const admin = adminOf(relOf(a).client_id);
    a.exception = { ...a.exception!, status: 'APPROVED', decided_at: when, decided_by: admin.name, note, until: ahead(untilIn) };
    a.history.push({ at: when, by: admin.name, action: `Exception granted until ${fmtDate(ahead(untilIn))}`, note });
  };

  const approveAll = (relId: string) =>
    db.assignments
      .filter((a) => a.relationship_id === relId && !a.removed)
      .forEach((a) => {
        reset(a);
        approve(a);
      });

  // ---------------------------------------------------------------- Riverside Energy scenarios
  // Ortega Roofing: approved. Insurance renewal due in 12 days, one lapsed course, a new hire with nothing done.
  approveAll('RE-ORTEGA');
  const coi = slot('RE-ORTEGA', 'R-COI');
  reset(coi);
  approve(coi, { expiresIn: 12 });
  const current = coi.approval!;
  const prevExpires = addPeriod(current.expires_at!, -1, 'years');
  const prevSubmitted = addPeriod(current.submitted_at, -1, 'years');
  const previous: Approval = { ...current, approved_at: addPeriod(current.approved_at, -1, 'years'), submitted_at: prevSubmitted, expires_at: prevExpires, evidence: evidence(coi, prevSubmitted, prevExpires), reminders: ['30', '7'] };
  coi.previous = [previous];
  const rules = slot('RE-ORTEGA', 'R-SITERULES');
  reset(rules);
  approve(rules, { expiresIn: 38 });
  const danaConfined = slot('RE-ORTEGA', 'R-CONFINED', 2);
  reset(danaConfined);
  approve(danaConfined, { expiresIn: -3 });
  reset(slot('RE-ORTEGA', 'R-HEIGHTS', 4));
  reset(slot('RE-ORTEGA', 'R-CONFINED', 4));

  // Brightline Electrical: approved. Workers' comp renewal waiting for review; the apprentice hasn't done the harbor induction.
  approveAll('RE-BRIGHT');
  const bwc = slot('RE-BRIGHT', 'R-WC');
  reset(bwc);
  approve(bwc, { expiresIn: 20 });
  submit(bwc, 1, 3);
  reset(slot('RE-BRIGHT', 'R-HARBOR', 4));
  const meiOrient = slot('RE-BRIGHT', 'R-ORIENT', 3);
  reset(meiOrient);
  approve(meiOrient, { expiresIn: 25 });

  // Keystone Scaffolding: application pending with three submissions in the review queue.
  submit(slot('RE-KEYSTONE', 'R-COI'), 2, 5);
  submit(slot('RE-KEYSTONE', 'R-WC'), 2, 4);
  submit(slot('RE-KEYSTONE', 'R-PREQ'), 1, 6);
  approve(slot('RE-KEYSTONE', 'R-SITERULES'), { completedAgo: 3 });
  approve(slot('RE-KEYSTONE', 'R-DRUG'), { completedAgo: 3 });
  approve(slot('RE-KEYSTONE', 'R-HEIGHTS', 1), { completedAgo: 2 });
  approve(slot('RE-KEYSTONE', 'R-HEIGHTS', 2), { completedAgo: 1 });

  // Summit Crane & Rigging: an operator's certification lapsed and he's asked for an exception; the rigger has a standing waiver.
  approveAll('RE-SUMMIT');
  const hugo = slot('RE-SUMMIT', 'R-CRANE', 3);
  reset(hugo);
  approve(hugo, { expiresIn: -4 });
  askException(hugo, 1, 21, `Hugo's recertification exam is booked for ${fmtDate(ahead(14))}. Until then he'll only operate under a certified operator's direct supervision.`);
  const pete = slot('RE-SUMMIT', 'R-CRANE', 2);
  reset(pete);
  grantException(pete, 41, 40, 325, 'Pete works as a rigger and signal person. He does not operate cranes.', 'Approved for rigging and signalling only. Revisit at the annual audit.');

  // Clearwater Environmental: last year's prequalification lapsed and the renewal was sent back.
  approveAll('RE-CLEAR');
  const cprq = slot('RE-CLEAR', 'R-PREQ');
  reset(cprq);
  approve(cprq, { expiresIn: -5 });
  sendBack(cprq, 3, 2, "Section 2 is missing last year's EMR figures. Add them and resubmit.");

  // Apex Painting & Coatings: application pending, insurance certificate sent back.
  sendBack(slot('RE-APEX', 'R-COI'), 5, 4, 'The certificate must name Riverside Energy as additional insured. Ask your broker for an updated certificate.');
  submit(slot('RE-APEX', 'R-WC'), 1, 1);
  approve(slot('RE-APEX', 'R-SITERULES'), { completedAgo: 6 });
  approve(slot('RE-APEX', 'R-DRUG'), { completedAgo: 6 });

  // Delta Mechanical: fully compliant with Riverside.
  approveAll('RE-DELTA');

  // Pinecrest Janitorial: one cleaner's orientation lapses in 9 days.
  approveAll('RE-PINE');
  const hannah = slot('RE-PINE', 'R-ORIENT', 3);
  reset(hannah);
  approve(hannah, { expiresIn: 9 });

  // Northgate Security: denied.
  approve(slot('RE-NORTH', 'R-COI'), { completedAgo: 50 });
  approve(slot('RE-NORTH', 'R-SITERULES'), { completedAgo: 52 });

  // Redline Excavation: approved, but the insurance certificate expired five days ago.
  approveAll('RE-REDLINE');
  const rcoi = slot('RE-REDLINE', 'R-COI');
  reset(rcoi);
  approve(rcoi, { expiresIn: -5 });

  // ---------------------------------------------------------------- Northwind Utilities scenarios
  // Delta: approved. Insurance renewal due in 9 days; Jonas just joined the Northwind crew and hasn't done orientation.
  approveAll('NW-DELTA');
  const nwCoi = slot('NW-DELTA', 'N-COI');
  reset(nwCoi);
  approve(nwCoi, { expiresIn: 9 });
  reset(slot('NW-DELTA', 'N-ORIENT', 5));

  // Redline: applied four days ago with a new insurance certificate.
  submit(slot('NW-REDLINE', 'N-COI'), 1, 4);
  approve(slot('NW-REDLINE', 'N-HANDBOOK'), { completedAgo: 4 });
  approve(slot('NW-REDLINE', 'N-ORIENT', 1), { completedAgo: 3 });

  // ---------------------------------------------------------------- Delta Mechanical's own program
  // Ironwood Welding: Delta's approved welding sub. Its certificate is what Riverside can reuse.
  approveAll('DM-IRONWOOD');
  const ironCoi = slot('DM-IRONWOOD', 'D-COI');
  reset(ironCoi);
  approve(ironCoi, { completedAgo: 60, expiresIn: 205 });
  const anaWeld = slot('DM-IRONWOOD', 'D-WELD', 2);
  reset(anaWeld);
  approve(anaWeld, { expiresIn: 18 });

  // Ironwood on Riverside work, through Delta: signoffs and Sean's trainings are done, its workers' comp
  // certificate is waiting for Delta's check, and the insurance certificate can reuse the copy Delta approved.
  approve(slot('RE-IRONWOOD', 'R-SITERULES'), { completedAgo: 4 });
  approve(slot('RE-IRONWOOD', 'R-DRUG'), { completedAgo: 4 });
  approve(slot('RE-IRONWOOD', 'R-HEIGHTS', 1), { completedAgo: 3 });
  approve(slot('RE-IRONWOOD', 'R-CONFINED', 1), { completedAgo: 3 });
  submit(slot('RE-IRONWOOD', 'R-WC'), 1, 5);

  // Kestrel Insulation: applied two days ago; its insurance is waiting for Chen's review.
  submit(slot('DM-KESTREL', 'D-COI'), 1, 2);
  approve(slot('DM-KESTREL', 'D-RULES'), { completedAgo: 2 });

  // Tonight's sweep has already run: renewals open, reminders sent, expiries flagged.
  sweep(db, now);
  db.last_sweep_day = dayKey(now);

  // This morning at the gates.
  const gate = (clientId: string, siteId: string, badge: string, h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);
    gateCheck(db, clientId, siteId, badge, d.toISOString());
  };
  gate(RE, 'S-TURBINE', 'ORT-1001', 6, 42);
  gate(RE, 'S-TURBINE', 'ORT-1002', 6, 47);
  gate(RE, 'S-TURBINE', 'DMS-1001', 6, 51);
  gate(RE, 'S-TURBINE', 'DMS-1002', 6, 53);
  gate(RE, 'S-HARBOR', 'BRL-1001', 7, 2);
  gate(RE, 'S-HARBOR', 'SCR-1001', 7, 10);
  gate(RE, 'S-TANK', 'RLE-1001', 7, 15);
  gate(RE, 'S-TANK', 'SCR-1003', 7, 21);
  gate(RE, 'S-TANK', 'CWE-1002', 7, 33);
  gate(RE, 'S-HARBOR', 'BRL-1004', 7, 40);
  gate(RE, 'S-TURBINE', 'IWF-1001', 7, 44);
  gate(NW, 'NS-PUMP', 'DMS-1001', 7, 5);
  gate(NW, 'NS-PUMP', 'DMS-1005', 7, 9);
  gate(DM, 'DS-TURBINE', 'IWF-1001', 6, 30);
  gate(DM, 'DS-TURBINE', 'IWF-1002', 6, 31);

  db.activity.sort((a, b) => b.at.localeCompare(a.at));
  db.outbox.sort((a, b) => b.at.localeCompare(a.at));
  db.checkins.sort((a, b) => b.at.localeCompare(a.at));
  return db;
}
