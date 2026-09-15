// Rules for the demo API. Checklists, states and totals are worked out at read time from
// requirements, people and uploads, so nothing has to be kept in sync.
import type {
  CheckInRow,
  Company,
  CompanyMatch,
  DemoDB,
  HomeView,
  Item,
  ItemState,
  Link,
  LinkDetail,
  LinkRow,
  PeopleView,
  Person,
  Persona,
  Requirement,
  RequirementFor,
  RequirementRow,
  Session,
  SessionContext,
  StoredFile,
  Upload,
  User,
} from '@/lib/types';
import { DAY_MS, daysUntil, fmtDate } from '@/lib/dates';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));

/** Approved items this close to expiry show as expiring. */
export const EXPIRING_DAYS = 30;

export interface Me {
  user: User;
  company: Company;
}

export function nowIso(db: DemoDB): string {
  return new Date(Date.now() + db.clock_offset_days * DAY_MS).toISOString();
}

export function newId(db: DemoDB, prefix: string): string {
  db.seq += 1;
  return `${prefix}-${db.seq}`;
}

export function resolveMe(db: DemoDB, s: Session | null): Me | null {
  const user = s?.user_id ? db.users.find((u) => u.id === s.user_id) : undefined;
  const company = user && db.companies.find((c) => c.id === user.company_id);
  return user && company ? { user, company } : null;
}

function find<T extends { id: string }>(list: T[], id: string, what: string): T {
  const hit = list.find((x) => x.id === id);
  if (!hit) throw new HttpError(404, `That ${what} doesn't exist any more.`);
  return hit;
}

export const findCompany = (db: DemoDB, id: string) => find(db.companies, id, 'company');
export const findLink = (db: DemoDB, id: string) => find(db.links, id, 'record');
export const findRequirement = (db: DemoDB, id: string) => find(db.requirements, id, 'requirement');
export const findPerson = (db: DemoDB, id: string) => find(db.people, id, 'person');
export const findUpload = (db: DemoDB, id: string) => find(db.uploads, id, 'upload');

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

/** A client's own list applies to every contractor it adds; a self-tracked client has the list the contractor entered. */
export function requirementsFor(db: DemoDB, link: Link): Requirement[] {
  return db.requirements
    .filter((r) => (link.added_by === 'CONTRACTOR' ? r.link_id === link.id : r.company_id === link.client_id && r.link_id === null))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export const peopleOf = (db: DemoDB, companyId: string) =>
  db.people.filter((p) => p.company_id === companyId).sort((a, b) => a.name.localeCompare(b.name));

function itemOf(db: DemoDB, link: Link, r: Requirement, person: Person | null, now: string): Item {
  const uploads = db.uploads
    .filter((u) => u.link_id === link.id && u.requirement_id === r.id && u.person_id === (person?.id ?? null))
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  const approved = uploads.find((u) => u.status === 'APPROVED') ?? null;
  const pending = uploads[0] && uploads[0].status !== 'APPROVED' ? uploads[0] : null;
  const expiresIn = approved?.expires_at ? daysUntil(approved.expires_at, now) : null;
  const valid = !!approved && (expiresIn === null || expiresIn >= 0);

  let state: ItemState;
  if (valid) state = expiresIn !== null && expiresIn <= EXPIRING_DAYS ? 'EXPIRING' : 'OK';
  else if (pending?.status === 'WAITING') state = 'WAITING';
  else if (pending?.status === 'REJECTED') state = 'REJECTED';
  else if (approved) state = 'EXPIRED';
  else state = 'MISSING';

  return {
    key: `${link.id}:${r.id}:${person?.id ?? 'company'}`,
    link_id: link.id,
    requirement: r,
    person,
    state,
    ok: valid,
    approved,
    pending,
    expires_in_days: expiresIn,
  };
}

const RANK: Record<ItemState, number> = { REJECTED: 0, EXPIRED: 1, MISSING: 2, WAITING: 3, EXPIRING: 4, OK: 5 };
const byState = (a: Item, b: Item) => RANK[a.state] - RANK[b.state] || a.requirement.title.localeCompare(b.requirement.title);

export function itemsFor(db: DemoDB, link: Link, now: string): Item[] {
  const reqs = requirementsFor(db, link);
  const people = peopleOf(db, link.contractor_id);
  const out: Item[] = [];
  for (const r of reqs) {
    if (r.for === 'COMPANY') out.push(itemOf(db, link, r, null, now));
    else for (const p of people) out.push(itemOf(db, link, r, p, now));
  }
  return out;
}

export function stateWords(i: Item): string {
  switch (i.state) {
    case 'MISSING':
      return 'not uploaded';
    case 'WAITING':
      return 'waiting for review';
    case 'REJECTED':
      return 'sent back';
    case 'EXPIRED':
      return `expired ${fmtDate(i.approved?.expires_at)}`;
    case 'EXPIRING':
      return `expires ${fmtDate(i.approved?.expires_at)}`;
    case 'OK':
      return 'done';
  }
}

function rowOf(db: DemoDB, link: Link, viewerId: string, now: string): LinkRow {
  const items = itemsFor(db, link, now);
  const done = items.filter((i) => i.ok).length;
  return {
    id: link.id,
    added_by: link.added_by,
    company: findCompany(db, link.client_id === viewerId ? link.contractor_id : link.client_id),
    progress: { done, total: items.length },
    compliant: done === items.length,
    to_review: items.filter((i) => i.pending?.status === 'WAITING').length,
    expiring: items.filter((i) => i.state === 'EXPIRING').length,
    problems: items.filter((i) => i.state === 'MISSING' || i.state === 'REJECTED' || i.state === 'EXPIRED').length,
    people: peopleOf(db, link.contractor_id).length,
  };
}

const myContractorLinks = (db: DemoDB, companyId: string) => db.links.filter((l) => l.client_id === companyId && l.added_by === 'CLIENT');
const myClientLinks = (db: DemoDB, companyId: string) => db.links.filter((l) => l.contractor_id === companyId);

const byName = (a: LinkRow, b: LinkRow) => a.company.name.localeCompare(b.company.name);

export function contractorList(db: DemoDB, me: Me, now: string): LinkRow[] {
  return myContractorLinks(db, me.company.id).map((l) => rowOf(db, l, me.company.id, now)).sort(byName);
}

export function clientList(db: DemoDB, me: Me, now: string): LinkRow[] {
  return myClientLinks(db, me.company.id).map((l) => rowOf(db, l, me.company.id, now)).sort(byName);
}

export function linkDetail(db: DemoDB, link: Link, me: Me, now: string): LinkDetail {
  const items = itemsFor(db, link, now);
  const people = peopleOf(db, link.contractor_id).map((person) => {
    const mine = items.filter((i) => i.person?.id === person.id).sort(byState);
    return { person, ok: mine.every((i) => i.ok), items: mine };
  });
  return {
    row: rowOf(db, link, me.company.id, now),
    viewer: link.client_id === me.company.id ? 'client' : 'contractor',
    reviewed: link.added_by === 'CLIENT',
    company_items: items.filter((i) => !i.person).sort(byState),
    people,
    own_requirements: link.added_by === 'CONTRACTOR' ? requirementsFor(db, link) : [],
  };
}

/** The client's side of a link it created. */
export function asClient(db: DemoDB, me: Me, linkId: string): Link {
  const link = findLink(db, linkId);
  if (link.client_id !== me.company.id || link.added_by !== 'CLIENT') throw new HttpError(403, "That contractor doesn't work for you.");
  return link;
}

export function asContractor(db: DemoDB, me: Me, linkId: string): Link {
  const link = findLink(db, linkId);
  if (link.contractor_id !== me.company.id) throw new HttpError(403, "You don't work for that client.");
  return link;
}

// ---------------------------------------------------------------------------
// Home, check-in, people
// ---------------------------------------------------------------------------

export function home(db: DemoDB, me: Me, now: string): HomeView {
  const names: Record<string, string> = {};
  const contractorLinks = myContractorLinks(db, me.company.id);
  const clientLinks = myClientLinks(db, me.company.id);
  const cItems = contractorLinks.flatMap((l) => {
    names[l.id] = findCompany(db, l.contractor_id).name;
    return itemsFor(db, l, now);
  });
  const kItems = clientLinks.flatMap((l) => {
    names[l.id] = findCompany(db, l.client_id).name;
    return itemsFor(db, l, now);
  });
  const soonest = (a: Item, b: Item) => (a.approved?.expires_at ?? '').localeCompare(b.approved?.expires_at ?? '');
  return {
    today: now,
    company: me.company,
    contractors: {
      total: contractorLinks.length,
      compliant: contractorLinks.filter((l) => itemsFor(db, l, now).every((i) => i.ok)).length,
      to_review: cItems.filter((i) => i.pending?.status === 'WAITING').sort((a, b) => a.pending!.uploaded_at.localeCompare(b.pending!.uploaded_at)),
      problems: cItems.filter((i) => (i.state === 'EXPIRED' || i.state === 'EXPIRING') && i.pending?.status !== 'WAITING').sort(soonest),
    },
    clients: {
      total: clientLinks.length,
      compliant: clientLinks.filter((l) => itemsFor(db, l, now).every((i) => i.ok)).length,
      todo: kItems.filter((i) => i.state === 'MISSING' || i.state === 'REJECTED' || i.state === 'EXPIRED').sort(byState),
      expiring: kItems.filter((i) => i.state === 'EXPIRING' && !i.pending).sort(soonest),
    },
    names,
  };
}

export function checkIn(db: DemoDB, me: Me, now: string): CheckInRow[] {
  const rows: CheckInRow[] = [];
  for (const link of myContractorLinks(db, me.company.id)) {
    const contractor = findCompany(db, link.contractor_id);
    const items = itemsFor(db, link, now);
    const companyReasons = items.filter((i) => !i.person && !i.ok).map((i) => `Company: ${i.requirement.title} ${stateWords(i)}`);
    for (const person of peopleOf(db, contractor.id)) {
      const reasons = [...companyReasons, ...items.filter((i) => i.person?.id === person.id && !i.ok).map((i) => `${i.requirement.title} ${stateWords(i)}`)];
      rows.push({ person, contractor, link_id: link.id, allowed: reasons.length === 0, reasons });
    }
  }
  return rows.sort((a, b) => Number(a.allowed) - Number(b.allowed) || a.person.name.localeCompare(b.person.name));
}

export function peopleView(db: DemoDB, me: Me, now: string): PeopleView {
  const links = myClientLinks(db, me.company.id);
  const byLink = new Map(links.map((l) => [l.id, itemsFor(db, l, now)]));
  return {
    company: me.company,
    people: peopleOf(db, me.company.id).map((p) => ({
      ...p,
      clients: links.map((l) => ({
        link_id: l.id,
        name: findCompany(db, l.client_id).name,
        ok: (byLink.get(l.id) ?? []).filter((i) => i.person?.id === p.id).every((i) => i.ok),
      })),
    })),
  };
}

export function requirementList(db: DemoDB, me: Me): RequirementRow[] {
  const contractors = myContractorLinks(db, me.company.id).length;
  return db.requirements
    .filter((r) => r.company_id === me.company.id && r.link_id === null)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((r) => ({ ...r, contractors }));
}

export function sessionContext(db: DemoDB, me: Me, now: string): SessionContext {
  const h = home(db, me, now);
  return {
    user: me.user,
    company: me.company,
    contractors: h.contractors.total,
    clients: h.clients.total,
    to_review: h.contractors.to_review.length,
    todo: h.clients.todo.length,
  };
}

export function personas(db: DemoDB): Persona[] {
  return db.users.map((u) => {
    const c = findCompany(db, u.company_id);
    return {
      user_id: u.id,
      name: u.name,
      title: u.title,
      company_name: c.name,
      contractors: myContractorLinks(db, c.id).length,
      clients: myClientLinks(db, c.id).length,
    };
  });
}

export function searchCompanies(db: DemoDB, me: Me, q: string): CompanyMatch[] {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  const taken = new Set(myContractorLinks(db, me.company.id).map((l) => l.contractor_id));
  return db.companies
    .filter((c) => c.on_ezform && c.id !== me.company.id && !taken.has(c.id) && c.name.toLowerCase().includes(term))
    .slice(0, 5)
    .map((c) => ({ id: c.id, name: c.name, trade: c.trade }));
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase() || 'CO'
  );
}

/** Add a company to work for you. A company already on EZForm is linked, not copied. */
export function createContractor(db: DemoDB, me: Me, body: Record<string, unknown>, now: string): { id: string; existing: boolean } {
  let contractorId = str(body.company_id);
  const existing = !!contractorId;
  if (existing) {
    const c = findCompany(db, contractorId);
    if (!c.on_ezform) throw new HttpError(400, 'Pick a company from the list.');
    if (c.id === me.company.id) throw new HttpError(400, "You can't add your own company as a contractor.");
  } else {
    const name = str(body.name).trim();
    const contact = str(body.contact_name).trim();
    const email = str(body.email).trim();
    if (!name) throw new HttpError(400, 'Enter the company name.');
    if (!contact) throw new HttpError(400, "Enter the contact person's name.");
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    const match = db.companies.find((c) => c.on_ezform && c.name.toLowerCase() === name.toLowerCase());
    if (match) throw new HttpError(409, `${match.name} is already on EZForm. Pick it from the list instead.`);
    const company: Company = { id: newId(db, 'C'), name, trade: str(body.trade).trim() || 'Contractor', contact_name: contact, email, phone: str(body.phone).trim(), on_ezform: true, created_at: now };
    db.companies.push(company);
    // The contact signs in when they accept the invitation.
    db.users.push({ id: newId(db, 'U'), company_id: company.id, name: contact, title: 'Main contact' });
    contractorId = company.id;
  }
  if (db.links.some((l) => l.client_id === me.company.id && l.contractor_id === contractorId && l.added_by === 'CLIENT')) {
    throw new HttpError(409, 'That company already works for you.');
  }
  const link: Link = { id: newId(db, 'L'), client_id: me.company.id, contractor_id: contractorId, added_by: 'CLIENT', created_at: now };
  db.links.push(link);
  return { id: link.id, existing };
}

function requirementFields(body: Record<string, unknown>): { title: string; for: RequirementFor; has_expiry: boolean; hint: string } {
  const title = str(body.title).trim();
  if (!title) throw new HttpError(400, 'Give the requirement a name.');
  const f = str(body.for);
  if (f !== 'COMPANY' && f !== 'PERSON') throw new HttpError(400, 'Choose who it is for: the company or each person.');
  return { title, for: f, has_expiry: body.has_expiry === true, hint: str(body.hint).trim() };
}

/** Track a client that isn't on EZForm: you enter what it asks for, and your uploads count straight away. */
export function createClient(db: DemoDB, me: Me, body: Record<string, unknown>, now: string): { id: string } {
  const name = str(body.name).trim();
  if (!name) throw new HttpError(400, "Enter the client's name.");
  const already = myClientLinks(db, me.company.id).find((l) => findCompany(db, l.client_id).name.toLowerCase() === name.toLowerCase());
  if (already) throw new HttpError(409, `${name} is already one of your clients.`);
  const list = Array.isArray(body.requirements) ? (body.requirements as Record<string, unknown>[]).map(requirementFields) : [];
  const company: Company = { id: newId(db, 'C'), name, trade: str(body.trade).trim(), contact_name: str(body.contact_name).trim(), email: str(body.email).trim(), phone: '', on_ezform: false, created_at: now };
  db.companies.push(company);
  const link: Link = { id: newId(db, 'L'), client_id: company.id, contractor_id: me.company.id, added_by: 'CONTRACTOR', created_at: now };
  db.links.push(link);
  for (const r of list) db.requirements.push({ id: newId(db, 'R'), company_id: company.id, link_id: link.id, ...r, created_at: now });
  return { id: link.id };
}

/** Your own list (asked of every contractor), or a list you keep for a client you track yourself. */
export function saveRequirement(db: DemoDB, me: Me, body: Record<string, unknown>, now: string): { id: string } {
  const fields = requirementFields(body);
  const id = str(body.id);
  if (id) {
    const r = findRequirement(db, id);
    assertCanEdit(db, me, r);
    Object.assign(r, fields);
    return { id };
  }
  const linkId = str(body.link_id);
  let companyId = me.company.id;
  if (linkId) {
    const link = asContractor(db, me, linkId);
    if (link.added_by !== 'CONTRACTOR') throw new HttpError(403, `${findCompany(db, link.client_id).name} sets its own requirements.`);
    companyId = link.client_id;
  }
  const r: Requirement = { id: newId(db, 'R'), company_id: companyId, link_id: linkId || null, ...fields, created_at: now };
  db.requirements.push(r);
  return { id: r.id };
}

function assertCanEdit(db: DemoDB, me: Me, r: Requirement) {
  const ok = r.link_id ? findLink(db, r.link_id).contractor_id === me.company.id : r.company_id === me.company.id;
  if (!ok) throw new HttpError(403, "You can't change another company's requirements.");
}

export function deleteRequirement(db: DemoDB, me: Me, id: string): { ok: true } {
  const r = findRequirement(db, id);
  assertCanEdit(db, me, r);
  db.requirements = db.requirements.filter((x) => x.id !== id);
  db.uploads = db.uploads.filter((u) => u.requirement_id !== id);
  return { ok: true };
}

function nextBadge(db: DemoDB, company: Company): string {
  const prefix = initialsOf(company.name);
  const used = db.people.filter((p) => p.company_id === company.id).map((p) => Number(p.badge_id.split('-')[1]) || 0);
  return `${prefix}-${String(Math.max(1000, ...used) + 1)}`;
}

export function savePerson(db: DemoDB, me: Me, body: Record<string, unknown>, now: string): { id: string; badge_id: string } {
  const name = str(body.name).trim();
  if (!name) throw new HttpError(400, "Enter the person's name.");
  const job = str(body.job).trim() || 'Worker';
  const id = str(body.id);
  if (id) {
    const p = findPerson(db, id);
    if (p.company_id !== me.company.id) throw new HttpError(403, "That person isn't on your team.");
    Object.assign(p, { name, job });
    return { id, badge_id: p.badge_id };
  }
  const p: Person = { id: newId(db, 'P'), company_id: me.company.id, name, job, badge_id: nextBadge(db, me.company), created_at: now };
  db.people.push(p);
  return { id: p.id, badge_id: p.badge_id };
}

export function deletePerson(db: DemoDB, me: Me, id: string): { ok: true } {
  const p = findPerson(db, id);
  if (p.company_id !== me.company.id) throw new HttpError(403, "That person isn't on your team.");
  db.people = db.people.filter((x) => x.id !== id);
  db.uploads = db.uploads.filter((u) => u.person_id !== id);
  return { ok: true };
}

function readFile(v: unknown): StoredFile {
  const f = (v ?? {}) as Partial<StoredFile>;
  if (!f.name) throw new HttpError(400, 'Attach the file first.');
  return { name: str(f.name), size: Number(f.size) || 0, type: str(f.type), data_url: typeof f.data_url === 'string' ? f.data_url : null };
}

export function upload(db: DemoDB, me: Me, body: Record<string, unknown>, now: string): { status: Upload['status'] } {
  const link = asContractor(db, me, str(body.link_id));
  const r = findRequirement(db, str(body.requirement_id));
  if (!requirementsFor(db, link).some((x) => x.id === r.id)) throw new HttpError(400, "That isn't on this client's list.");
  const personId = r.for === 'PERSON' ? str(body.person_id) : '';
  if (r.for === 'PERSON') {
    const p = findPerson(db, personId);
    if (p.company_id !== me.company.id) throw new HttpError(403, "That person isn't on your team.");
  }
  const waiting = db.uploads.some((u) => u.link_id === link.id && u.requirement_id === r.id && u.person_id === (personId || null) && u.status === 'WAITING');
  if (waiting) throw new HttpError(409, 'The last upload is still waiting for review.');
  const file = readFile(body.file);
  let expires: string | null = null;
  if (r.has_expiry) {
    expires = str(body.expires_at);
    if (!expires) throw new HttpError(400, 'Enter the expiry date shown on the document.');
    if (daysUntil(expires, now) <= 0) throw new HttpError(400, 'That expiry date has passed. Upload a current copy.');
  }
  const reviewed = link.added_by === 'CLIENT';
  const u: Upload = {
    id: newId(db, 'F'),
    link_id: link.id,
    requirement_id: r.id,
    person_id: personId || null,
    file,
    expires_at: expires,
    uploaded_at: now,
    uploaded_by: me.user.name,
    status: reviewed ? 'WAITING' : 'APPROVED',
  };
  db.uploads.push(u);
  return { status: u.status };
}

export function review(db: DemoDB, me: Me, body: Record<string, unknown>, now: string): { status: Upload['status'] } {
  const u = findUpload(db, str(body.id));
  asClient(db, me, u.link_id);
  if (u.status !== 'WAITING') throw new HttpError(409, "This upload isn't waiting for review any more.");
  const decision = str(body.decision);
  const note = str(body.note).trim();
  if (decision === 'REJECTED' && !note) throw new HttpError(400, 'Tell the contractor what needs to change.');
  if (decision !== 'APPROVED' && decision !== 'REJECTED') throw new HttpError(400, 'Choose approve or send back.');
  Object.assign(u, { status: decision, reviewed_at: now, reviewed_by: me.user.name, note: note || undefined });
  return { status: u.status };
}
