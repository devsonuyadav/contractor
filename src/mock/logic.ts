// Business rules for the demo API. Everything here mirrors what the .NET endpoints will do:
// assignment generation, snapshots, review, exceptions, the expiry sweep and the gate check.
//
// Every rule is scoped to a relationship (client organization → contractor organization), so
// one company can run its own program and work for other companies at the same time.
import type {
  ActivityEvent,
  Assignment,
  AssignmentDetail,
  CheckIn,
  ClientRow,
  ContactInfo,
  Contractor,
  ContractorDetail,
  ContractorRow,
  ContractorStatus,
  DashboardSummary,
  DemoDB,
  Deployment,
  EmailKind,
  Evidence,
  FormSchema,
  GateEntry,
  GateLogEntry,
  GateResult,
  GroupRow,
  Member,
  EhsAccount,
  Organization,
  OrgMatch,
  OrgSummary,
  OutboxEmail,
  PeriodUnit,
  Persona,
  PolicyContent,
  PortalOverview,
  QueueView,
  Relationship,
  Requirement,
  RequirementContent,
  RequirementRow,
  RequirementSnapshot,
  RequirementType,
  ReusableDocument,
  RosterView,
  Score,
  Session,
  SubscriptionStatus,
  SessionContext,
  Site,
  SiteRow,
  SlotState,
  SlotView,
  SubcontractorOption,
  SweepSummary,
  Task,
  TrainingContent,
  Validity,
  Worker,
  WorkerView,
} from '@/lib/types';
import { DAY_MS, addPeriod, daysUntil, fmtDate, plusDays } from '@/lib/dates';
import { firstName, plural, possessive } from '@/lib/describe';
import { missingAnswers } from '@/lib/forms';
import * as C from './content';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

export const APP_URL = 'https://dev.gowbw.com/ez-contractor';
const DUE_DAYS = 14;
const RENEWAL_WINDOW = 30;

export const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
export const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function nowIso(db: DemoDB): string {
  return new Date(Date.now() + db.clock_offset_days * DAY_MS).toISOString();
}

export function newId(db: DemoDB, prefix: string): string {
  db.seq += 1;
  return `${prefix}-${db.seq.toString(36).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Requirements and snapshots
// ---------------------------------------------------------------------------

export function contentOf(r: RequirementContent): RequirementContent {
  return clone({
    title: r.title,
    type: r.type,
    description: r.description,
    applies_to: r.applies_to,
    validity: r.validity,
    scored: r.scored,
    needs_review: r.needs_review,
    document_hint: r.document_hint,
    form: r.form,
    training: r.training,
    policy: r.policy,
    ezform_template_id: r.ezform_template_id ?? null,
  });
}

export function snapshotOf(r: Requirement): RequirementSnapshot {
  return { ...contentOf(r), requirement_id: r.id, version: r.version };
}

export function computeExpiry(snap: RequirementContent, ev: Evidence, completedAt: string): string | null {
  const v = snap.validity;
  if (v.kind === 'DOCUMENT_DATE') return ev.kind === 'DOCUMENT' ? ev.expires_at ?? null : null;
  if (v.kind === 'PERIOD') return addPeriod(completedAt, v.every, v.unit);
  return null;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export interface Me {
  member: Member;
  org: Organization;
}

export function resolveMe(db: DemoDB, actor: Session | null): Me | null {
  if (!actor?.member_id) return null;
  const member = db.members.find((m) => m.id === actor.member_id);
  const org = member && db.orgs.find((o) => o.id === member.org_id);
  return member && org ? { member, org } : null;
}

export function findOrg(db: DemoDB, id: string): Organization {
  const o = db.orgs.find((x) => x.id === id);
  if (!o) throw new HttpError(404, 'That company no longer exists.');
  return o;
}

export function findRelationship(db: DemoDB, id: string): Relationship {
  const r = db.relationships.find((x) => x.id === id);
  if (!r) throw new HttpError(404, 'That contractor no longer exists.');
  return r;
}

export function findWorker(db: DemoDB, id: string): Worker {
  const w = db.workers.find((x) => x.id === id);
  if (!w) throw new HttpError(404, 'That worker no longer exists.');
  return w;
}

export function findAssignment(db: DemoDB, id: string): Assignment {
  const a = db.assignments.find((x) => x.id === id);
  if (!a) throw new HttpError(404, 'That requirement is no longer assigned.');
  return a;
}

export function findRequirement(db: DemoDB, orgId: string, id: string): Requirement {
  const r = db.requirements.find((x) => x.id === id && x.org_id === orgId);
  if (!r) throw new HttpError(404, 'That requirement no longer exists.');
  return r;
}

function findGroup(db: DemoDB, orgId: string, id: string) {
  const g = db.groups.find((x) => x.id === id && x.org_id === orgId);
  if (!g) throw new HttpError(404, 'That group no longer exists.');
  return g;
}

export function findSite(db: DemoDB, orgId: string, id: string): Site {
  const s = db.sites.find((x) => x.id === id && x.org_id === orgId);
  if (!s) throw new HttpError(404, 'That site no longer exists.');
  return s;
}

export const summaryOf = (o: Organization): OrgSummary => ({ id: o.id, name: o.name, short: o.short });

export function sponsorOf(db: DemoDB, rel: Relationship): { rel: Relationship; org: Organization } | null {
  if (!rel.sponsor_id) return null;
  const sp = db.relationships.find((r) => r.id === rel.sponsor_id);
  const org = sp && db.orgs.find((o) => o.id === sp.contractor_id);
  return sp && org ? { rel: sp, org } : null;
}

/** The sponsor's own record of the subcontractor, in the sponsor's program. */
export function programRelationshipOf(db: DemoDB, rel: Relationship): Relationship | null {
  const sp = sponsorOf(db, rel);
  return sp ? db.relationships.find((r) => r.client_id === sp.org.id && r.contractor_id === rel.contractor_id) ?? null : null;
}

export function contractorOf(db: DemoDB, rel: Relationship): Contractor {
  const org = findOrg(db, rel.contractor_id);
  const client = findOrg(db, rel.client_id);
  const sp = sponsorOf(db, rel);
  return {
    ...rel,
    name: org.name,
    trade: org.trade,
    contact: org.contact,
    address: org.address,
    website: org.website,
    license_no: org.license_no,
    employees_count: org.employees_count,
    client_name: client.name,
    sponsor: sp ? { relationship_id: sp.rel.id, org_id: sp.org.id, name: sp.org.name } : null,
  };
}

function workerOf(db: DemoDB, a: Assignment): Worker | null {
  return a.worker_id ? db.workers.find((w) => w.id === a.worker_id) ?? null : null;
}

export function labelOf(a: Assignment, w?: Worker | null): string {
  return w ? `${a.req.title} (${w.name})` : a.req.title;
}

export function shortName(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? 'CO').slice(0, 2)).toUpperCase();
}

// ---------------------------------------------------------------------------
// Activity feed and outbox
// ---------------------------------------------------------------------------

export function addActivity(db: DemoDB, e: Omit<ActivityEvent, 'id'>): void {
  db.activity.unshift({ id: newId(db, 'EV'), ...e });
  if (db.activity.length > 800) db.activity.length = 800;
}

export function addEmail(db: DemoDB, e: Omit<OutboxEmail, 'id'>): void {
  db.outbox.unshift({ id: newId(db, 'EM'), ...e });
  if (db.outbox.length > 600) db.outbox.length = 600;
}

export const portalUrl = (rel: Relationship) => `${APP_URL}/portal/clients/${rel.id}`;

function emailContractor(db: DemoDB, rel: Relationship, kind: EmailKind, subject: string, body: string, at: string): void {
  const org = findOrg(db, rel.contractor_id);
  addEmail(db, { at, to: org.contact.email, to_name: org.contact.name, subject, body, kind, client_id: rel.client_id, relationship_id: rel.id, audience: 'contractor', to_org_id: org.id });
}

/** Tells the sponsoring contractor about its subcontractor's record with the client. */
export function emailSponsor(db: DemoDB, rel: Relationship, kind: EmailKind, subject: string, body: string, at: string): void {
  const sp = sponsorOf(db, rel);
  if (!sp) return;
  addEmail(db, { at, to: sp.org.contact.email, to_name: sp.org.contact.name, subject, body, kind, client_id: rel.client_id, relationship_id: rel.id, audience: 'contractor', to_org_id: sp.org.id });
}

/** Emails go to the client's first member: in production, whoever owns the program. */
export function emailClient(db: DemoDB, clientId: string, kind: EmailKind, subject: string, body: string, at: string, relId?: string): void {
  const m = db.members.find((x) => x.org_id === clientId);
  if (!m) return;
  addEmail(db, { at, to: m.email, to_name: m.name, subject, body, kind, client_id: clientId, relationship_id: relId, audience: 'admin' });
}

export function inviteEmail(db: DemoDB, rel: Relationship, at: string, existing = false): void {
  const client = findOrg(db, rel.client_id);
  const org = findOrg(db, rel.contractor_id);
  const intro = existing
    ? `${rel.invited_by} at ${client.name} added ${org.name} to their approved contractor program. Your company profile and workers are already on EZForm, so there's nothing to set up again.`
    : `${rel.invited_by} at ${client.name} has invited ${org.name} to join their approved contractor program.`;
  emailContractor(
    db,
    rel,
    'INVITE',
    `You're invited to ${possessive(client.name)} contractor program`,
    `Hi ${firstName(org.contact.name)},\n\n${intro}\n\nTo get started:\n1. Check your company profile and submit your application to ${client.name}.\n2. Choose which of your workers go on the ${client.name} crew.\n3. Work through the checklist: insurance, prequalification, training and policy signoffs.\n\nOpen your checklist: ${portalUrl(rel)}\n\nThanks,\n${client.name}`,
    at,
  );
}

// ---------------------------------------------------------------------------
// Assignment generation
// ---------------------------------------------------------------------------

export function newAssignment(db: DemoDB, relId: string, workerId: string | null, r: Requirement, sources: string[], actor: string, at: string): Assignment {
  return {
    id: newId(db, 'A'),
    relationship_id: relId,
    worker_id: workerId,
    requirement_id: r.id,
    sources,
    req: snapshotOf(r),
    assigned_at: at,
    approval: null,
    submission: { status: 'OPEN', opened_at: at, due_at: plusDays(at, DUE_DAYS), is_renewal: false },
    exception: null,
    history: [{ at, by: actor, action: 'Assigned' }],
    previous: [],
  };
}

/**
 * requirement id → where it comes from ("group:G-BASE", "site:S-TANK", "flow:G-BASE"). Only the client's own
 * library counts. A subcontractor inherits its sponsor's groups ("flow:") plus the groups of the sites it works
 * on, minus requirements the client keeps for direct contractors; groups assigned to it directly always apply.
 */
function requiredFor(db: DemoDB, rel: Relationship): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const sponsored = !!sponsorOf(db, rel);
  const add = (rid: string, src: string, filtered: boolean) => {
    if (filtered && db.requirements.find((r) => r.id === rid)?.flows_down === false) return;
    const list = out.get(rid) ?? [];
    if (!list.includes(src)) list.push(src);
    out.set(rid, list);
  };
  const group = (gid: string) => db.groups.find((g) => g.id === gid && g.org_id === rel.client_id);
  for (const gid of rel.group_ids) group(gid)?.requirement_ids.forEach((rid) => add(rid, `group:${gid}`, false));
  const sp = sponsorOf(db, rel);
  if (sp) for (const gid of sp.rel.group_ids) group(gid)?.requirement_ids.forEach((rid) => add(rid, `flow:${gid}`, true));
  for (const sid of rel.site_ids) {
    const site = db.sites.find((s) => s.id === sid && s.org_id === rel.client_id);
    site?.group_ids.forEach((gid) => group(gid)?.requirement_ids.forEach((rid) => add(rid, `site:${sid}`, sponsored)));
  }
  return out;
}

const onCrew = (rel: Relationship, w: Worker) => w.active && rel.worker_ids.includes(w.id);

/** Brings a relationship's assignments in line with its groups, sites and crew. */
export function syncRelationship(db: DemoDB, relId: string, actor: string, at: string): { added: number; removed: number } {
  const rel = findRelationship(db, relId);
  const need = requiredFor(db, rel);
  const crew = db.workers.filter((w) => w.org_id === rel.contractor_id && onCrew(rel, w));
  const keep = new Set<string>();
  let added = 0;
  let removed = 0;
  for (const [rid, sources] of need) {
    const r = db.requirements.find((x) => x.id === rid && x.org_id === rel.client_id);
    if (!r || r.retired) continue;
    const targets: (string | null)[] = r.applies_to === 'COMPANY' ? [null] : crew.map((w) => w.id);
    for (const wid of targets) {
      let a = db.assignments.find((x) => x.relationship_id === rel.id && x.requirement_id === rid && x.worker_id === wid);
      if (a) {
        if (a.removed) {
          a.removed = false;
          a.history.push({ at, by: actor, action: 'Assigned again' });
          added++;
        }
        a.sources = sources;
      } else {
        a = newAssignment(db, rel.id, wid, r, sources, actor, at);
        db.assignments.push(a);
        added++;
      }
      keep.add(a.id);
    }
  }
  for (const a of db.assignments) {
    if (a.relationship_id !== rel.id || a.removed || keep.has(a.id)) continue;
    const w = workerOf(db, a);
    // Inactive workers and workers taken off this crew keep their records, so coming back restores them.
    if (w && !onCrew(rel, w)) continue;
    a.removed = true;
    a.history.push({ at, by: actor, action: 'No longer required' });
    removed++;
  }
  // Subcontractors inherit from this relationship, so they follow its groups and sites.
  for (const child of db.relationships.filter((r) => r.sponsor_id === rel.id)) {
    child.site_ids = child.site_ids.filter((s) => rel.site_ids.includes(s));
    syncRelationship(db, child.id, actor, at);
  }
  return { added, removed };
}

function usesGroup(db: DemoDB, rel: Relationship, groupId: string): boolean {
  return rel.group_ids.includes(groupId) || rel.site_ids.some((sid) => db.sites.find((s) => s.id === sid)?.group_ids.includes(groupId));
}

export function syncAll(db: DemoDB, actor: string, at: string, only: (r: Relationship) => boolean): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const rel of db.relationships) {
    if (!only(rel)) continue;
    const r = syncRelationship(db, rel.id, actor, at);
    added += r.added;
    removed += r.removed;
  }
  return { added, removed };
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

export interface Ctx {
  db: DemoDB;
  now: string;
  orgs: Map<string, Organization>;
  rels: Map<string, Relationship>;
  workers: Map<string, Worker>;
  slotCache: Map<string, SlotView[]>;
}

export function makeCtx(db: DemoDB, now: string): Ctx {
  return {
    db,
    now,
    orgs: new Map(db.orgs.map((o) => [o.id, o])),
    rels: new Map(db.relationships.map((r) => [r.id, r])),
    workers: new Map(db.workers.map((w) => [w.id, w])),
    slotCache: new Map(),
  };
}

export function viewSlot(a: Assignment, ctx: Ctx): SlotView {
  const now = ctx.now;
  const ap = a.approval;
  const expiresIn = ap?.expires_at ? daysUntil(ap.expires_at, now) : null;
  const apValid = !!ap && (expiresIn === null || expiresIn >= 0);
  const ex = a.exception;
  const waived = !!ex && ex.status === 'APPROVED' && !!ex.until && daysUntil(ex.until, now) >= 0;
  const sub = a.submission.status;

  let state: SlotState;
  if (apValid) state = expiresIn !== null && expiresIn <= RENEWAL_WINDOW ? 'EXPIRING' : 'APPROVED';
  else if (waived) state = 'WAIVED';
  else if (sub === 'SUBMITTED') state = 'SUBMITTED';
  else if (sub === 'REJECTED') state = 'REJECTED';
  else if (ap) state = 'EXPIRED';
  else state = 'NOT_STARTED';

  const open = sub === 'OPEN' || sub === 'REJECTED';
  const exceptionPending = ex?.status === 'REQUESTED';
  const compliant = apValid || waived;
  const dueIn = open && a.submission.due_at ? daysUntil(a.submission.due_at, now) : null;
  const rel = ctx.rels.get(a.relationship_id);
  const w = a.worker_id ? ctx.workers.get(a.worker_id) : undefined;
  const sponsorRel = rel?.sponsor_id ? ctx.rels.get(rel.sponsor_id) : undefined;
  const awaitingSponsor = sub === 'SUBMITTED' && !!sponsorRel && !a.submission.sponsor_check;
  return {
    ...a,
    state,
    compliant,
    expires_in_days: expiresIn,
    due_in_days: dueIn,
    overdue: !compliant && dueIn !== null && dueIn < 0,
    renewal_open: apValid && sub !== 'CLOSED',
    awaiting_review: sub === 'SUBMITTED' && !awaitingSponsor,
    awaiting_sponsor: awaitingSponsor,
    sponsor_name: sponsorRel ? ctx.orgs.get(sponsorRel.contractor_id)?.name : undefined,
    exception_pending: exceptionPending,
    needs_action: open && !exceptionPending && !waived,
    waived_until: waived ? ex!.until ?? null : null,
    contractor_name: (rel && ctx.orgs.get(rel.contractor_id)?.name) ?? '',
    client_name: (rel && ctx.orgs.get(rel.client_id)?.name) ?? '',
    worker_name: w?.name,
  };
}

const STATE_RANK: Record<SlotState, number> = { REJECTED: 0, EXPIRED: 1, NOT_STARTED: 2, EXPIRING: 3, SUBMITTED: 4, WAIVED: 5, APPROVED: 6 };

function slotOrder(a: SlotView, b: SlotView): number {
  return (
    STATE_RANK[a.state] - STATE_RANK[b.state] ||
    a.req.title.localeCompare(b.req.title) ||
    (a.worker_name ?? '').localeCompare(b.worker_name ?? '')
  );
}

export function slotsFor(ctx: Ctx, relId: string): SlotView[] {
  const hit = ctx.slotCache.get(relId);
  if (hit) return hit;
  const rel = ctx.rels.get(relId);
  const out: SlotView[] = [];
  for (const a of ctx.db.assignments) {
    if (a.relationship_id !== relId || a.removed) continue;
    if (a.worker_id) {
      const w = ctx.workers.get(a.worker_id);
      if (!w || !rel || !onCrew(rel, w)) continue;
    }
    out.push(viewSlot(a, ctx));
  }
  out.sort(slotOrder);
  ctx.slotCache.set(relId, out);
  return out;
}

export function scoreOf(slots: SlotView[]): Score {
  const scored = slots.filter((s) => s.req.scored);
  const ok = scored.filter((s) => s.compliant).length;
  return { compliant: ok, total: scored.length, pct: scored.length ? Math.round((ok * 100) / scored.length) : null };
}

const crewOf = (ctx: Ctx, rel: Relationship) => rel.worker_ids.map((id) => ctx.workers.get(id)).filter((w): w is Worker => !!w);

export function contractorRow(rel: Relationship, ctx: Ctx): ContractorRow {
  const slots = slotsFor(ctx, rel.id);
  const company = slots.filter((s) => !s.worker_id);
  const worker = slots.filter((s) => !!s.worker_id);
  return {
    ...contractorOf(ctx.db, rel),
    company_score: scoreOf(company),
    worker_score: scoreOf(worker),
    open_items: slots.filter((s) => s.needs_action).length,
    awaiting_review: slots.filter((s) => s.awaiting_review).length,
    exceptions: slots.filter((s) => s.exception_pending).length,
    expiring: slots.filter((s) => s.state === 'EXPIRING').length,
    expired: slots.filter((s) => s.state === 'EXPIRED').length,
    worker_count: crewOf(ctx, rel).filter((w) => w.active).length,
    site_names: rel.site_ids.map((id) => ctx.db.sites.find((s) => s.id === id)?.name).filter((n): n is string => !!n),
    group_names: rel.group_ids.map((id) => ctx.db.groups.find((g) => g.id === id)?.name).filter((n): n is string => !!n),
    awaiting_sponsor: slots.filter((s) => s.awaiting_sponsor).length,
    subcontractors: ctx.db.relationships.filter((r) => r.sponsor_id === rel.id).length,
  };
}

export function workerViews(ctx: Ctx, rel: Relationship): WorkerView[] {
  const slots = slotsFor(ctx, rel.id);
  return crewOf(ctx, rel)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
    .map((w) => {
      const mine = w.active ? slots.filter((s) => s.worker_id === w.id) : [];
      return { ...w, score: scoreOf(mine), clear: w.active && mine.filter((s) => s.req.scored).every((s) => s.compliant), slots: mine };
    });
}

export function contractorDetail(rel: Relationship, ctx: Ctx, audience: 'admin' | 'contractor'): ContractorDetail {
  const subs = ctx.db.relationships.filter((r) => r.sponsor_id === rel.id);
  const sp = sponsorOf(ctx.db, rel);
  return {
    contractor: contractorRow(rel, ctx),
    client: summaryOf(ctx.orgs.get(rel.client_id)!),
    workers: workerViews(ctx, rel),
    slots: slotsFor(ctx, rel.id),
    sites: ctx.db.sites.filter((s) => rel.site_ids.includes(s.id)),
    groups: ctx.db.groups.filter((g) => rel.group_ids.includes(g.id)),
    activity: ctx.db.activity.filter((e) => e.relationship_id === rel.id).slice(0, 60),
    emails: ctx.db.outbox.filter((e) => e.relationship_id === rel.id && (audience === 'admin' || e.to_org_id === rel.contractor_id)).slice(0, 60),
    subcontractors: subs.map((r) => contractorRow(r, ctx)).sort((a, b) => a.name.localeCompare(b.name)),
    sponsor_checks: audience === 'contractor' ? subs.flatMap((r) => slotsFor(ctx, r.id).filter((s) => s.awaiting_sponsor)) : [],
    inherited_groups: sp ? ctx.db.groups.filter((g) => sp.rel.group_ids.includes(g.id)) : [],
    sponsor_site_ids: sp ? sp.rel.site_ids : null,
  };
}

const relsAsClient = (ctx: Ctx, clientId: string) => ctx.db.relationships.filter((r) => r.client_id === clientId);
const relsAsContractor = (ctx: Ctx, orgId: string) => ctx.db.relationships.filter((r) => r.contractor_id === orgId);

export function contractorList(ctx: Ctx, clientId: string): ContractorRow[] {
  return relsAsClient(ctx, clientId)
    .map((r) => contractorRow(r, ctx))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Subcontractor submissions waiting for this organization's check, across every client it sponsors them with. */
function sponsorQueue(ctx: Ctx, orgId: string): SlotView[] {
  const mine = new Set(relsAsContractor(ctx, orgId).map((r) => r.id));
  return ctx.db.relationships
    .filter((r) => !!r.sponsor_id && mine.has(r.sponsor_id))
    .flatMap((r) => slotsFor(ctx, r.id).filter((s) => s.awaiting_sponsor))
    .sort((a, b) => (a.submission.submitted_at ?? '').localeCompare(b.submission.submitted_at ?? ''));
}

export function queue(ctx: Ctx, clientId: string): QueueView {
  const rels = relsAsClient(ctx, clientId);
  const all = rels.flatMap((r) => slotsFor(ctx, r.id));
  return {
    flow_down: sponsorQueue(ctx, clientId),
    reviews: all
      .filter((s) => s.awaiting_review)
      .sort((a, b) => (a.submission.submitted_at ?? '').localeCompare(b.submission.submitted_at ?? '')),
    exceptions: all
      .filter((s) => s.exception_pending)
      .sort((a, b) => (a.exception?.requested_at ?? '').localeCompare(b.exception?.requested_at ?? '')),
    applications: rels
      .filter((r) => r.status === 'Pending' && !!r.profile_submitted_at)
      .map((r) => contractorRow(r, ctx))
      .sort((a, b) => (a.profile_submitted_at ?? '').localeCompare(b.profile_submitted_at ?? '')),
  };
}

function attention(r: ContractorRow): number {
  return r.expired * 3 + r.awaiting_review * 2 + r.exceptions * 2 + r.open_items + (r.status === 'Pending' ? 2 : 0);
}

export function dashboard(ctx: Ctx, clientId: string): DashboardSummary {
  const rels = relsAsClient(ctx, clientId);
  const rows = rels.map((r) => contractorRow(r, ctx));
  const counts: Record<ContractorStatus, number> = { New: 0, Pending: 0, Approved: 0, Denied: 0 };
  rows.forEach((r) => counts[r.status]++);
  const q = queue(ctx, clientId);
  const tasks: Task[] = [
    ...q.reviews.map((s) => ({
      id: `review-${s.id}`,
      kind: 'REVIEW' as const,
      title: `${s.req.title}${s.submission.is_renewal ? ' (renewal)' : ''}`,
      subtitle: s.worker_name ? `${s.contractor_name} · ${s.worker_name}` : s.contractor_name,
      at: s.submission.submitted_at ?? s.assigned_at,
      relationship_id: s.relationship_id,
      assignment_id: s.id,
    })),
    ...q.exceptions.map((s) => ({
      id: `exception-${s.id}`,
      kind: 'EXCEPTION' as const,
      title: s.req.title,
      subtitle: s.worker_name ? `${s.contractor_name} · ${s.worker_name}` : s.contractor_name,
      at: s.exception?.requested_at ?? s.assigned_at,
      relationship_id: s.relationship_id,
      assignment_id: s.id,
    })),
    ...q.applications.map((c) => ({
      id: `application-${c.id}`,
      kind: 'APPLICATION' as const,
      title: c.name,
      subtitle: `${c.trade} · ${c.company_score.pct ?? 0}% of company items done`,
      at: c.profile_submitted_at ?? c.created_at,
      relationship_id: c.id,
    })),
    ...q.flow_down.map((s) => ({
      id: `sponsor-${s.id}`,
      kind: 'SPONSOR_CHECK' as const,
      title: s.req.title,
      subtitle: `${s.contractor_name}${s.worker_name ? ` · ${s.worker_name}` : ''} · for ${s.client_name}`,
      at: s.submission.submitted_at ?? s.assigned_at,
      relationship_id: s.relationship_id,
      assignment_id: s.id,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const allSlots = rels.filter((r) => r.status !== 'Denied').flatMap((r) => slotsFor(ctx, r.id));
  const approved = rows.filter((r) => r.status === 'Approved');
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
  };
  return {
    today: ctx.now,
    status_counts: counts,
    kpis: {
      contractors: rows.length,
      approved: counts.Approved,
      waiting_on_you: tasks.length,
      expiring_30: allSlots.filter((s) => s.state === 'EXPIRING').length,
      expired: allSlots.filter((s) => s.state === 'EXPIRED').length,
      avg_company_score: avg(approved.map((r) => r.company_score.pct)),
      avg_worker_score: avg(approved.map((r) => r.worker_score.pct)),
    },
    tasks,
    activity: ctx.db.activity.filter((e) => e.client_id === clientId).slice(0, 30),
    expiring: allSlots
      .filter((s) => s.state === 'EXPIRING' || s.state === 'EXPIRED')
      .sort((a, b) => (a.expires_in_days ?? 0) - (b.expires_in_days ?? 0)),
    roster: [...rows].sort((a, b) => attention(b) - attention(a) || a.name.localeCompare(b.name)),
  };
}

export function requirementRows(ctx: Ctx, orgId: string): RequirementRow[] {
  return ctx.db.requirements
    .filter((r) => r.org_id === orgId)
    .map((r) => {
      const slots = ctx.db.assignments.filter((a) => a.requirement_id === r.id && !a.removed);
      return {
        ...r,
        in_use: slots.length,
        contractors: new Set(slots.map((a) => a.relationship_id)).size,
        group_names: ctx.db.groups.filter((g) => g.org_id === orgId && g.requirement_ids.includes(r.id)).map((g) => g.name),
      };
    })
    .sort((a, b) => Number(!!a.retired) - Number(!!b.retired) || a.title.localeCompare(b.title));
}

export function groupRows(ctx: Ctx, orgId: string): GroupRow[] {
  return ctx.db.groups
    .filter((g) => g.org_id === orgId)
    .map((g) => ({
      ...g,
      contractors: relsAsClient(ctx, orgId).filter((r) => usesGroup(ctx.db, r, g.id)).length,
      site_names: ctx.db.sites.filter((s) => s.org_id === orgId && s.group_ids.includes(g.id)).map((s) => s.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function siteRows(ctx: Ctx, orgId: string): SiteRow[] {
  return ctx.db.sites
    .filter((s) => s.org_id === orgId)
    .map((s) => {
      const rels = relsAsClient(ctx, orgId).filter((r) => r.site_ids.includes(s.id));
      const ws = rels.flatMap((r) => crewOf(ctx, r).filter((w) => w.active));
      return {
        ...s,
        contractors: rels.map((r) => ({ id: r.id, name: ctx.orgs.get(r.contractor_id)?.name ?? '', status: r.status })),
        workers_total: ws.length,
        workers_clear: ws.filter((w) => gateEvaluate(ctx, w, s.id).clear).length,
        group_names: s.group_ids.map((id) => ctx.db.groups.find((g) => g.id === id)?.name).filter((n): n is string => !!n),
      };
    });
}

export function assignmentDetail(a: Assignment, ctx: Ctx, viewer: AssignmentDetail['viewer']): AssignmentDetail {
  const rel = ctx.rels.get(a.relationship_id);
  if (!rel) throw new HttpError(404, 'That contractor no longer exists.');
  const sponsorName = sponsorOf(ctx.db, rel)?.org.name;
  return {
    slot: viewSlot(a, ctx),
    contractor: contractorOf(ctx.db, rel),
    client: summaryOf(ctx.orgs.get(rel.client_id)!),
    viewer,
    worker: a.worker_id ? ctx.workers.get(a.worker_id) ?? null : null,
    latest: ctx.db.requirements.find((r) => r.id === a.requirement_id) ?? null,
    source_names: a.sources.map((src) => {
      const [kind, id] = src.split(':');
      if (kind === 'group') return `Group · ${ctx.db.groups.find((g) => g.id === id)?.name ?? id}`;
      if (kind === 'flow') return `From ${sponsorName ?? 'the sponsor'} · ${ctx.db.groups.find((g) => g.id === id)?.name ?? id}`;
      if (kind === 'site') return `Site · ${ctx.db.sites.find((s) => s.id === id)?.name ?? id}`;
      return src;
    }),
  };
}

// ---------------------------------------------------------------------------
// Sessions, both sides of an organization
// ---------------------------------------------------------------------------

export function personas(db: DemoDB): Persona[] {
  return db.members
    .map((m) => {
      const org = db.orgs.find((o) => o.id === m.org_id)!;
      return {
        member_id: m.id,
        name: m.name,
        title: m.title,
        org_id: org.id,
        org_name: org.name,
        runs_program: org.program_enabled,
        is_ehs: !!org.is_ehs,
        contractors: db.relationships.filter((r) => r.client_id === org.id).length,
        clients: db.relationships.filter((r) => r.contractor_id === org.id).length,
      };
    })
    .sort((a, b) => Number(b.runs_program && b.clients > 0) - Number(a.runs_program && a.clients > 0) || Number(b.runs_program) - Number(a.runs_program) || a.org_name.localeCompare(b.org_name));
}

export function sessionContext(ctx: Ctx, me: Me): SessionContext {
  const q = queue(ctx, me.org.id);
  return {
    member: me.member,
    org: me.org,
    program: {
      enabled: me.org.program_enabled,
      contractors: relsAsClient(ctx, me.org.id).length,
      waiting: q.reviews.length + q.exceptions.length + q.applications.length + q.flow_down.length,
      subscription: me.org.subscription,
    },
    is_ehs: !!me.org.is_ehs,
    clients: relsAsContractor(ctx, me.org.id)
      .map((r) => ({
        id: r.id,
        client: summaryOf(ctx.orgs.get(r.client_id)!),
        status: r.status,
        open_items: slotsFor(ctx, r.id).filter((s) => s.needs_action).length,
        sponsor_name: sponsorOf(ctx.db, r)?.org.name ?? null,
      }))
      .sort((a, b) => a.client.name.localeCompare(b.client.name)),
  };
}

export function clientRow(rel: Relationship, ctx: Ctx): ClientRow {
  const slots = slotsFor(ctx, rel.id);
  return {
    id: rel.id,
    client: summaryOf(ctx.orgs.get(rel.client_id)!),
    status: rel.status,
    status_note: rel.status_note,
    company_score: scoreOf(slots.filter((s) => !s.worker_id)),
    worker_score: scoreOf(slots.filter((s) => !!s.worker_id)),
    open_items: slots.filter((s) => s.needs_action).length,
    waiting_on_client: slots.filter((s) => !s.needs_action && (s.awaiting_review || s.exception_pending)).length,
    expired: slots.filter((s) => s.state === 'EXPIRED').length,
    crew: crewOf(ctx, rel).filter((w) => w.active).length,
    site_names: rel.site_ids.map((id) => ctx.db.sites.find((s) => s.id === id)?.name).filter((n): n is string => !!n),
    invited_at: rel.created_at,
    profile_submitted_at: rel.profile_submitted_at,
    sponsor_name: sponsorOf(ctx.db, rel)?.org.name ?? null,
    subcontractors: ctx.db.relationships.filter((r) => r.sponsor_id === rel.id).length,
  };
}

export function portalOverview(ctx: Ctx, org: Organization): PortalOverview {
  const rels = relsAsContractor(ctx, org.id);
  return {
    org,
    clients: rels.map((r) => clientRow(r, ctx)).sort((a, b) => b.open_items - a.open_items || a.client.name.localeCompare(b.client.name)),
    action: rels.flatMap((r) => slotsFor(ctx, r.id).filter((s) => s.needs_action)),
  };
}

/**
 * What a subcontractor needs from the chain above it: the client still approves the sponsor (and has it on the
 * site), the sponsor still approves the subcontractor in its own program, and the sponsor's company items hold.
 */
function sponsorChain(ctx: Ctx, rel: Relationship, siteId?: string): string[] {
  if (!rel.sponsor_id) return [];
  const sp = sponsorOf(ctx.db, rel);
  const employer = ctx.orgs.get(rel.contractor_id)?.name ?? 'This company';
  if (!sp) return ['Its sponsoring contractor no longer works here'];
  const reasons: string[] = [];
  if (sp.rel.status !== 'Approved') reasons.push(`Sponsor ${sp.org.name} isn't approved (${sp.rel.status})`);
  if (siteId && !sp.rel.site_ids.includes(siteId)) reasons.push(`Sponsor ${sp.org.name} isn't assigned to this site`);
  const program = programRelationshipOf(ctx.db, rel);
  if (!program || program.status !== 'Approved') reasons.push(`${sp.org.name} doesn't currently approve ${employer} as a subcontractor`);
  for (const s of slotsFor(ctx, sp.rel.id)) {
    if (!s.worker_id && s.req.scored && !s.compliant) reasons.push(`Sponsor ${sp.org.name}: ${s.req.title} — ${stateWords(s)}`);
  }
  return reasons;
}

/** Whether a crew member could badge in for this client today, ignoring which site. */
function crewClearance(ctx: Ctx, rel: Relationship, w: Worker): { clear: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const client = ctx.orgs.get(rel.client_id)?.name ?? 'the client';
  if (!w.active) reasons.push('Worker is marked inactive');
  if (rel.status !== 'Approved') reasons.push(rel.status === 'Denied' ? `Not approved by ${client}` : `Not approved by ${client} yet (${rel.status})`);
  reasons.push(...sponsorChain(ctx, rel));
  for (const s of slotsFor(ctx, rel.id)) {
    if (!s.req.scored || s.compliant) continue;
    if (s.worker_id && s.worker_id !== w.id) continue;
    reasons.push(`${s.worker_id ? '' : 'Company: '}${s.req.title} — ${stateWords(s)}`);
  }
  return { clear: reasons.length === 0, reasons };
}

export function rosterView(ctx: Ctx, org: Organization): RosterView {
  const rels = relsAsContractor(ctx, org.id).sort((a, b) => (ctx.orgs.get(a.client_id)?.name ?? '').localeCompare(ctx.orgs.get(b.client_id)?.name ?? ''));
  const workers = ctx.db.workers
    .filter((w) => w.org_id === org.id)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
    .map((w) => ({
      ...w,
      deployments: rels.map((rel): Deployment => {
        const on = rel.worker_ids.includes(w.id);
        const slots = on && w.active ? slotsFor(ctx, rel.id).filter((s) => s.worker_id === w.id) : [];
        const gate = on ? crewClearance(ctx, rel, w) : null;
        return {
          relationship_id: rel.id,
          client: summaryOf(ctx.orgs.get(rel.client_id)!),
          status: rel.status,
          on_crew: on,
          score: on ? scoreOf(slots) : null,
          clear: gate ? gate.clear : null,
          reasons: gate?.reasons ?? [],
          open_items: slots.filter((s) => s.needs_action).length,
          slots,
        };
      }),
    }));
  return { org, workers, clients: rels.map((r) => ({ id: r.id, name: ctx.orgs.get(r.client_id)?.name ?? '', status: r.status })) };
}

/** Documents the same company already had approved by another client, for the same company or worker. */
export function reusableDocuments(ctx: Ctx, a: Assignment): ReusableDocument[] {
  if (a.req.type !== 'DOCUMENT') return [];
  const rel = ctx.rels.get(a.relationship_id);
  if (!rel) return [];
  const title = a.req.title.trim().toLowerCase();
  const out: ReusableDocument[] = [];
  for (const other of ctx.db.assignments) {
    if (other.relationship_id === rel.id || other.removed || other.worker_id !== a.worker_id) continue;
    const otherRel = ctx.rels.get(other.relationship_id);
    if (!otherRel || otherRel.contractor_id !== rel.contractor_id) continue;
    const ap = other.approval;
    if (!ap || ap.evidence.kind !== 'DOCUMENT') continue;
    if (ap.expires_at && daysUntil(ap.expires_at, ctx.now) <= 0) continue;
    out.push({
      assignment_id: other.id,
      client_name: ctx.orgs.get(otherRel.client_id)?.name ?? '',
      title: other.req.title,
      same_title: other.req.title.trim().toLowerCase() === title,
      approved_at: ap.approved_at,
      evidence: ap.evidence,
    });
  }
  // The same requirement under the same name is almost always the same certificate. Only fall back to every
  // approved document when no client used that name, so an insurance slot isn't offered a training card.
  const same = out.filter((d) => d.same_title);
  return (same.length ? same : out).sort((x, y) => y.approved_at.localeCompare(x.approved_at));
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

function stateWords(s: SlotView): string {
  switch (s.state) {
    case 'EXPIRED':
      return `expired ${fmtDate(s.approval?.expires_at)}`;
    case 'SUBMITTED':
      return 'waiting for review';
    case 'REJECTED':
      return 'sent back for changes';
    case 'NOT_STARTED':
      return 'not completed';
    default:
      return s.state.toLowerCase();
  }
}

/** The relationship that lets a worker onto a client's site: the site owner must have engaged the worker's employer. */
function relationshipAt(ctx: Ctx, w: Worker, site: Site): Relationship | undefined {
  return ctx.db.relationships.find((r) => r.client_id === site.org_id && r.contractor_id === w.org_id);
}

export function gateEvaluate(ctx: Ctx, w: Worker, siteId: string): { clear: boolean; reasons: string[] } {
  const site = ctx.db.sites.find((s) => s.id === siteId);
  const employer = ctx.orgs.get(w.org_id);
  if (!site || !employer) return { clear: false, reasons: ['Unknown site or employer'] };
  const rel = relationshipAt(ctx, w, site);
  const client = ctx.orgs.get(site.org_id)?.name ?? 'this client';
  if (!rel) return { clear: false, reasons: [`${employer.name} isn't a contractor for ${client}`] };
  const reasons: string[] = [];
  if (!rel.worker_ids.includes(w.id)) reasons.push(`${w.name} isn't on ${possessive(employer.name)} crew for ${client}`);
  if (!w.active) reasons.push('Worker is marked inactive');
  if (rel.status !== 'Approved') reasons.push(rel.status === 'Denied' ? `${employer.name} is not approved` : `${employer.name} isn't approved yet (${rel.status})`);
  if (!rel.site_ids.includes(siteId)) reasons.push(`${employer.name} isn't assigned to this site`);
  reasons.push(...sponsorChain(ctx, rel, siteId));
  if (rel.worker_ids.includes(w.id)) {
    for (const s of slotsFor(ctx, rel.id)) {
      if (!s.req.scored || s.compliant) continue;
      if (s.worker_id && s.worker_id !== w.id) continue;
      reasons.push(`${s.worker_id ? '' : 'Company: '}${s.req.title} — ${stateWords(s)}`);
    }
  }
  return { clear: reasons.length === 0, reasons };
}

export function gateRoster(ctx: Ctx, clientId: string, siteId: string): GateEntry[] {
  if (!siteId) return [];
  findSite(ctx.db, clientId, siteId);
  const rels = relsAsClient(ctx, clientId).filter((r) => r.site_ids.includes(siteId));
  return rels
    .flatMap((rel) =>
      crewOf(ctx, rel)
        .filter((w) => w.active)
        .map((w) => ({ worker: w, contractor: contractorOf(ctx.db, rel), ...gateEvaluate(ctx, w, siteId) })),
    )
    .sort((a, b) => a.contractor.name.localeCompare(b.contractor.name) || a.worker.name.localeCompare(b.worker.name));
}

export function gateLog(ctx: Ctx, clientId: string, siteId: string): GateLogEntry[] {
  const mySites = new Set(ctx.db.sites.filter((s) => s.org_id === clientId).map((s) => s.id));
  return ctx.db.checkins
    .filter((k) => mySites.has(k.site_id) && (!siteId || k.site_id === siteId))
    .slice(0, 60)
    .map((k) => {
      const rel = k.relationship_id ? ctx.rels.get(k.relationship_id) : undefined;
      return {
        ...k,
        worker_name: k.worker_id ? ctx.workers.get(k.worker_id)?.name ?? null : null,
        contractor_name: rel ? ctx.orgs.get(rel.contractor_id)?.name ?? null : k.worker_id ? ctx.orgs.get(ctx.workers.get(k.worker_id)?.org_id ?? '')?.name ?? null : null,
      };
    });
}

export function gateCheck(db: DemoDB, clientId: string, siteId: string, badgeRaw: string, at: string): GateResult {
  const site = findSite(db, clientId, siteId);
  const badge = badgeRaw.trim().toUpperCase();
  if (!badge) throw new HttpError(400, 'Scan or type a badge ID.');
  // Badges are unique across companies, so any EZForm worker can be scanned at any client's gate.
  const w = db.workers.find((x) => x.badge_id.toUpperCase() === badge) ?? null;
  const ctx = makeCtx(db, at);
  const rel = w ? relationshipAt(ctx, w, site) ?? null : null;
  const reasons = w ? gateEvaluate(ctx, w, siteId).reasons : [`Badge ${badge} isn't registered to a contractor worker`];
  const result = reasons.length ? 'BLOCKED' : 'CLEAR';
  const checkin: CheckIn = { id: newId(db, 'CK'), at, site_id: siteId, badge_id: badge, worker_id: w?.id ?? null, relationship_id: rel?.id ?? null, result, reasons };
  db.checkins.unshift(checkin);
  if (db.checkins.length > 400) db.checkins.length = 400;
  if (result === 'BLOCKED') {
    addActivity(db, {
      at,
      actor: 'Gate',
      role: 'system',
      client_id: clientId,
      relationship_id: rel?.id,
      text: `${w ? w.name : badge} was stopped at the ${site.name} gate: ${reasons[0]}${reasons.length > 1 ? ` (+${reasons.length - 1} more)` : ''}`,
      tone: 'bad',
    });
  }
  return { result, reasons, worker: w, contractor: rel ? contractorOf(db, rel) : null, site, checkin };
}

// ---------------------------------------------------------------------------
// Organizations, relationships and workers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Companies already on EZForm that the client could add, so the same company isn't created twice. */
export function searchOrgs(ctx: Ctx, clientId: string, q: string): OrgMatch[] {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  const linked = new Set(relsAsClient(ctx, clientId).map((r) => r.contractor_id));
  const domain = term.includes('@') ? term.split('@')[1] : '';
  return ctx.db.orgs
    .filter((o) => o.id !== clientId && !linked.has(o.id) && !o.is_ehs)
    .filter((o) => o.name.toLowerCase().includes(term) || o.trade.toLowerCase().includes(term) || (!!domain && o.contact.email.toLowerCase().endsWith(`@${domain}`)))
    .slice(0, 6)
    .map((o) => ({ id: o.id, name: o.name, trade: o.trade, contact_name: o.contact.name, contact_email: o.contact.email, runs_program: o.program_enabled }));
}

export function createOrg(db: DemoDB, profile: { name: string; trade: string; contact: ContactInfo }, now: string): { org: Organization; member: Member } {
  if (db.orgs.some((o) => o.name.toLowerCase() === profile.name.toLowerCase())) {
    throw new HttpError(409, `${profile.name} is already on EZForm. Search for it and add the existing company instead.`);
  }
  const org: Organization = {
    id: newId(db, 'O'),
    name: profile.name,
    short: shortName(profile.name),
    trade: profile.trade || 'General contractor',
    contact: profile.contact,
    address: '',
    created_at: now,
    program_enabled: false,
    subscription: 'NONE',
  };
  db.orgs.push(org);
  // The invited contact becomes the company's first login when they accept the invitation.
  const member: Member = { id: newId(db, 'M'), org_id: org.id, name: profile.contact.name, title: profile.contact.title ?? '', email: profile.contact.email };
  db.members.push(member);
  return { org, member };
}

export function createContractor(db: DemoDB, me: Me, body: Record<string, unknown>, now: string): { id: string; added: number; existing: boolean } {
  const by = me.member.name;
  let orgId = str(body.org_id);
  const existing = !!orgId;
  if (existing) {
    const org = findOrg(db, orgId);
    if (org.id === me.org.id) throw new HttpError(400, "You can't add your own company as a contractor.");
  } else {
    const name = str(body.name).trim();
    if (!name) throw new HttpError(400, 'Enter the company name.');
    const contact = (body.contact ?? {}) as Partial<ContactInfo>;
    const contactName = str(contact.name).trim();
    const email = str(contact.email).trim();
    if (!contactName) throw new HttpError(400, "Enter the main contact's name.");
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address for the main contact.');
    orgId = createOrg(db, { name, trade: str(body.trade).trim(), contact: { name: contactName, title: str(contact.title).trim() || undefined, email, phone: str(contact.phone).trim() } }, now).org.id;
  }
  const org = findOrg(db, orgId);
  const existingRel = db.relationships.find((r) => r.client_id === me.org.id && r.contractor_id === orgId);
  if (existingRel) {
    const sp = sponsorOf(db, existingRel);
    throw new HttpError(409, sp ? `${org.name} already works for you as ${possessive(sp.org.name)} subcontractor.` : `${org.name} is already on your roster.`);
  }
  const rel: Relationship = {
    id: newId(db, 'L'),
    client_id: me.org.id,
    contractor_id: orgId,
    status: 'New',
    site_ids: arr(body.site_ids).filter((id) => db.sites.some((s) => s.id === id && s.org_id === me.org.id)),
    group_ids: arr(body.group_ids).filter((id) => db.groups.some((g) => g.id === id && g.org_id === me.org.id)),
    tags: arr(body.tags).map((t) => t.trim()).filter(Boolean),
    worker_ids: [],
    created_at: now,
    invited_by: by,
    profile_submitted_at: null,
  };
  db.relationships.push(rel);
  const { added } = syncRelationship(db, rel.id, by, now);
  inviteEmail(db, rel, now, existing);
  addActivity(db, { at: now, actor: by, role: 'admin', client_id: me.org.id, relationship_id: rel.id, text: `${by} ${existing ? 'added' : 'invited'} ${org.name} with ${plural(added, 'requirement')}`, tone: 'info' });
  return { id: rel.id, added, existing };
}

/** A client can only tag its own record of a contractor; the profile belongs to the contractor. */
export function updateRelationship(db: DemoDB, rel: Relationship, body: Record<string, unknown>): { id: string } {
  if ('tags' in body) rel.tags = arr(body.tags).map((t) => t.trim()).filter(Boolean);
  return { id: rel.id };
}

export function updateOrgProfile(db: DemoDB, me: Me, body: Record<string, unknown>, now: string): { id: string } {
  const o = me.org;
  if ('name' in body) {
    const name = str(body.name).trim();
    if (!name) throw new HttpError(400, 'The company name can’t be empty.');
    if (db.orgs.some((x) => x.id !== o.id && x.name.toLowerCase() === name.toLowerCase())) throw new HttpError(409, `Another company on EZForm is already called ${name}.`);
    o.name = name;
  }
  if ('trade' in body) o.trade = str(body.trade).trim();
  if ('address' in body) o.address = str(body.address).trim();
  if ('website' in body) o.website = str(body.website).trim() || undefined;
  if ('license_no' in body) o.license_no = str(body.license_no).trim() || undefined;
  if ('employees_count' in body) {
    const n = Number(body.employees_count);
    o.employees_count = Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  }
  if (body.contact && typeof body.contact === 'object') {
    const ct = body.contact as Partial<ContactInfo>;
    const email = str(ct.email ?? o.contact.email).trim();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    o.contact = {
      name: str(ct.name ?? o.contact.name).trim() || o.contact.name,
      title: str(ct.title ?? o.contact.title).trim() || undefined,
      email,
      phone: str(ct.phone ?? o.contact.phone).trim(),
    };
  }
  // Every client sees the same profile, so each of them gets the update in its feed.
  for (const rel of db.relationships.filter((r) => r.contractor_id === o.id)) {
    addActivity(db, { at: now, actor: me.member.name, role: 'contractor', client_id: rel.client_id, relationship_id: rel.id, text: `${me.member.name} updated the ${o.name} company profile`, tone: 'info' });
  }
  return { id: o.id };
}

export function setContractorStatus(db: DemoDB, rel: Relationship, status: ContractorStatus, note: string, by: string, now: string): { id: string } {
  if (!['New', 'Pending', 'Approved', 'Denied'].includes(status)) throw new HttpError(400, 'Pick a status.');
  if (status === 'Denied' && !note.trim()) throw new HttpError(400, 'Add a note explaining why the contractor was denied.');
  const prev = rel.status;
  if (prev === status && (rel.status_note ?? '') === note.trim()) return { id: rel.id };
  const org = findOrg(db, rel.contractor_id);
  const client = findOrg(db, rel.client_id);
  rel.status = status;
  rel.status_note = note.trim() || undefined;
  rel.status_changed_at = now;
  addActivity(db, {
    at: now,
    actor: by,
    role: 'admin',
    client_id: rel.client_id,
    relationship_id: rel.id,
    text: `${by} changed ${org.name} from ${prev} to ${status}`,
    tone: status === 'Approved' ? 'good' : status === 'Denied' ? 'bad' : 'info',
  });
  const first = firstName(org.contact.name);
  if (rel.sponsor_id) {
    emailSponsor(db, rel, 'STATUS', `Your subcontractor ${org.name} is now ${status} with ${client.name}`, `${by} changed ${possessive(org.name)} status as your subcontractor on ${client.name} work from ${prev} to ${status}.${note ? `\n\nNote: ${note}` : ''}`, now);
  }
  if (status === 'Approved') {
    emailContractor(db, rel, 'STATUS', `${org.name} is approved to work with ${client.name}`, `Hi ${first},\n\nGood news: ${org.name} is now an approved contractor for ${client.name}. Your ${client.name} crew can badge in at the sites you're assigned to, as long as your checklist stays up to date.${note ? `\n\nNote: ${note}` : ''}\n\n${portalUrl(rel)}`, now);
  } else if (status === 'Denied') {
    emailContractor(db, rel, 'STATUS', `Update on your application to ${client.name}`, `Hi ${first},\n\n${client.name} can't approve ${org.name} at this time.\n\nReason: ${note}\n\nReply to this email if you'd like to discuss it.`, now);
  } else {
    emailContractor(db, rel, 'STATUS', `Your status with ${client.name} is now ${status}`, `Hi ${first},\n\n${possessive(org.name)} status with ${client.name} changed from ${prev} to ${status}.${note ? `\n\nNote: ${note}` : ''}`, now);
  }
  return { id: rel.id };
}

export function assignGroups(db: DemoDB, rel: Relationship, groupIds: string[], by: string, now: string) {
  rel.group_ids = groupIds.filter((g) => db.groups.some((x) => x.id === g && x.org_id === rel.client_id));
  const r = syncRelationship(db, rel.id, by, now);
  addActivity(db, { at: now, actor: by, role: 'admin', client_id: rel.client_id, relationship_id: rel.id, text: `${by} updated ${possessive(findOrg(db, rel.contractor_id).name)} requirement groups (${r.added} added, ${r.removed} removed)`, tone: 'info' });
  return r;
}

export function assignSites(db: DemoDB, rel: Relationship, siteIds: string[], by: string, now: string) {
  const sp = sponsorOf(db, rel);
  // A subcontractor can only work where its sponsor does.
  rel.site_ids = siteIds.filter((s) => db.sites.some((x) => x.id === s && x.org_id === rel.client_id) && (!sp || sp.rel.site_ids.includes(s)));
  const r = syncRelationship(db, rel.id, by, now);
  addActivity(db, { at: now, actor: by, role: 'admin', client_id: rel.client_id, relationship_id: rel.id, text: `${by} updated ${possessive(findOrg(db, rel.contractor_id).name)} sites (${r.added} requirements added, ${r.removed} removed)`, tone: 'info' });
  return r;
}

// ---------------------------------------------------------------------------
// Flow-down: a contractor brings its own subcontractor onto a client's work
// ---------------------------------------------------------------------------

/** The sponsor's own contractors, and whether each can be brought onto this client's work. */
export function subcontractorOptions(ctx: Ctx, sponsorRel: Relationship): SubcontractorOption[] {
  const sponsorOrg = sponsorRel.contractor_id;
  const client = ctx.orgs.get(sponsorRel.client_id)?.name ?? 'the client';
  return ctx.db.relationships
    .filter((r) => r.client_id === sponsorOrg)
    .map((r) => {
      const org = ctx.orgs.get(r.contractor_id)!;
      const existing = ctx.db.relationships.find((x) => x.client_id === sponsorRel.client_id && x.contractor_id === r.contractor_id);
      let blocked: string | null = null;
      if (r.status !== 'Approved') blocked = `You haven't approved them yet (${r.status})`;
      else if (existing) blocked = existing.sponsor_id === sponsorRel.id ? `Already on your ${client} work` : `Already works for ${client}${existing.sponsor_id ? ' through another contractor' : ' directly'}`;
      return { program_relationship_id: r.id, org_id: org.id, name: org.name, trade: org.trade, crew: r.worker_ids.length, blocked };
    })
    .sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked) || a.name.localeCompare(b.name));
}

export function sponsorEmails(db: DemoDB, rel: Relationship, by: string, at: string): void {
  const sp = sponsorOf(db, rel);
  if (!sp) return;
  const client = findOrg(db, rel.client_id);
  const org = findOrg(db, rel.contractor_id);
  const sites = rel.site_ids.map((id) => db.sites.find((s) => s.id === id)?.name).filter(Boolean).join(', ');
  emailContractor(
    db,
    rel,
    'INVITE',
    `${sp.org.name} brought you onto ${possessive(client.name)} work`,
    `Hi ${firstName(org.contact.name)},\n\n${by} at ${sp.org.name} added ${org.name} as their subcontractor for ${client.name}${sites ? ` (${sites})` : ''}.\n\n${client.name} asks its contractors' subcontractors for some of the same things it asks of ${sp.org.name}. Your checklist for ${client.name} is ready. ${sp.org.name} checks what you send before ${client.name} reviews it.\n\nChoose your crew and start here: ${portalUrl(rel)}`,
    at,
  );
  emailClient(
    db,
    rel.client_id,
    'APPLICATION',
    `Subcontractor request: ${org.name} (via ${sp.org.name})`,
    `${by} at ${sp.org.name} wants to bring ${org.name} (${org.trade}) onto your work as their subcontractor${sites ? ` at ${sites}` : ''}.\n\n${org.name} inherits ${possessive(sp.org.name)} requirements. Approve or deny the subcontractor: ${APP_URL}/contractors/${rel.id}`,
    at,
    rel.id,
  );
}

export function sponsorSubcontractor(db: DemoDB, me: Me, sponsorRel: Relationship, body: Record<string, unknown>, now: string) {
  const by = me.member.name;
  if (sponsorRel.sponsor_id) throw new HttpError(400, "A subcontractor can't bring in its own subcontractors yet. Ask the contractor above you to add them.");
  if (sponsorRel.status === 'Denied') throw new HttpError(409, `${findOrg(db, sponsorRel.client_id).name} hasn't approved you, so you can't bring subcontractors onto their work.`);
  const program = db.relationships.find((r) => r.id === str(body.program_relationship_id) && r.client_id === me.org.id);
  if (!program) throw new HttpError(404, 'Pick one of your own contractors.');
  const option = subcontractorOptions(makeCtx(db, now), sponsorRel).find((o) => o.program_relationship_id === program.id);
  if (option?.blocked) throw new HttpError(409, `${option.name}: ${option.blocked}.`);
  const siteIds = arr(body.site_ids).filter((s) => sponsorRel.site_ids.includes(s));
  if (!siteIds.length) throw new HttpError(400, 'Pick at least one of your sites for them to work on.');
  const org = findOrg(db, program.contractor_id);
  const client = findOrg(db, sponsorRel.client_id);
  const rel: Relationship = {
    id: newId(db, 'L'),
    client_id: sponsorRel.client_id,
    contractor_id: org.id,
    status: 'Pending',
    status_changed_at: now,
    site_ids: siteIds,
    group_ids: [],
    tags: [],
    // Start with the crew they already send to the sponsor; they can change it.
    worker_ids: db.workers.filter((w) => w.org_id === org.id && w.active && program.worker_ids.includes(w.id)).map((w) => w.id),
    created_at: now,
    invited_by: `${by} (${me.org.name})`,
    profile_submitted_at: now,
    sponsor_id: sponsorRel.id,
  };
  db.relationships.push(rel);
  const { added } = syncRelationship(db, rel.id, by, now);
  sponsorEmails(db, rel, by, now);
  addActivity(db, { at: now, actor: by, role: 'contractor', client_id: client.id, relationship_id: rel.id, text: `${by} brought ${org.name} onto ${possessive(client.name)} work as ${possessive(me.org.name)} subcontractor (${plural(added, 'requirement')} flowed down)`, tone: 'info' });
  return { id: rel.id, added };
}

/** The sponsor's check of its subcontractor's submission, before the client reviews it. */
export function sponsorCheck(db: DemoDB, me: Me, a: Assignment, decision: string, note: string, now: string) {
  const rel = findRelationship(db, a.relationship_id);
  const sp = sponsorOf(db, rel);
  if (!sp || sp.org.id !== me.org.id) throw new HttpError(403, 'Only the contractor that brought this subcontractor in can check its paperwork.');
  if (a.submission.status !== 'SUBMITTED' || a.submission.sponsor_check) throw new HttpError(409, "This isn't waiting for your check any more.");
  const by = me.member.name;
  const org = findOrg(db, rel.contractor_id);
  const client = findOrg(db, rel.client_id);
  const label = labelOf(a, workerOf(db, a));
  const base = { client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id };
  if (decision === 'Passed') {
    a.submission = { ...a.submission, sponsor_check: { at: now, by, org_name: me.org.name, note: note.trim() || undefined } };
    a.history.push({ at: now, by, action: `Checked by ${me.org.name}, passed to ${client.name}`, note: note.trim() || undefined });
    addActivity(db, { at: now, actor: by, role: 'contractor', ...base, text: `${by} (${me.org.name}) checked ${possessive(org.name)} ${label} and passed it to ${client.name}`, tone: 'info' });
    emailClient(db, client.id, 'SUBMITTED', `Ready for review: ${label} (${org.name}, checked by ${me.org.name})`, `${org.name} submitted ${label} as ${possessive(me.org.name)} subcontractor. ${by} checked it first.${note.trim() ? `\n\nTheir note: ${note.trim()}` : ''}\n\nReview it: ${APP_URL}/reviews`, now, rel.id);
    return { state: 'PASSED' };
  }
  if (decision === 'Rejected') {
    if (!note.trim()) throw new HttpError(400, 'Tell your subcontractor what needs to change.');
    a.submission = { ...a.submission, status: 'REJECTED', reviewed_at: now, reviewed_by: `${by} (${me.org.name})`, note: note.trim() };
    a.history.push({ at: now, by, action: `Sent back by ${me.org.name}`, note: note.trim() });
    addActivity(db, { at: now, actor: by, role: 'contractor', ...base, text: `${by} (${me.org.name}) sent back ${label} to ${org.name}`, tone: 'warn' });
    emailContractor(db, rel, 'REJECTED', `Action needed: ${label} (${client.name})`, `Hi ${firstName(org.contact.name)},\n\n${by} at ${me.org.name} checked ${label} before it went to ${client.name} and needs a change:\n\n"${note.trim()}"\n\nFix it and resubmit: ${portalUrl(rel)}`, now);
    return { state: 'REJECTED' };
  }
  throw new HttpError(400, 'Choose pass or send back.');
}

export function profileGaps(org: Organization): string[] {
  const missing: string[] = [];
  if (!org.trade.trim()) missing.push('trade');
  if (!org.address.trim()) missing.push('business address');
  if (!org.contact.phone.trim()) missing.push('contact phone');
  return missing;
}

export function submitApplication(db: DemoDB, rel: Relationship, by: string, now: string): { id: string } {
  if (rel.status !== 'New') throw new HttpError(409, 'Your application has already been submitted.');
  const org = findOrg(db, rel.contractor_id);
  const client = findOrg(db, rel.client_id);
  const missing = profileGaps(org);
  if (missing.length) throw new HttpError(400, `Add your ${missing.join(', ')} to the company profile before applying.`);
  rel.status = 'Pending';
  rel.profile_submitted_at = now;
  rel.status_changed_at = now;
  addActivity(db, { at: now, actor: by, role: 'contractor', client_id: rel.client_id, relationship_id: rel.id, text: `${org.name} submitted their application`, tone: 'info' });
  emailClient(db, rel.client_id, 'APPLICATION', `Application submitted: ${org.name}`, `${by} submitted ${possessive(org.name)} application to ${client.name}.\n\nReview it: ${APP_URL}/contractors/${rel.id}`, now, rel.id);
  return { id: rel.id };
}

function nextBadge(db: DemoDB, org: Organization): string {
  const mine = db.workers.filter((w) => w.org_id === org.id);
  const prefix = mine[0]?.badge_id.split('-')[0] ?? ((org.name.replace(/[^A-Za-z]/g, '').slice(0, 3) || 'CTR').toUpperCase());
  let n = 1001 + mine.length;
  let badge = `${prefix}-${n}`;
  while (db.workers.some((w) => w.badge_id === badge)) badge = `${prefix}-${++n}`;
  return badge;
}

/** Adds a worker to a company's roster and, optionally, to some of its client crews. */
export function createWorker(db: DemoDB, org: Organization, body: Record<string, unknown>, crewFor: Relationship[], by: string, role: 'admin' | 'contractor', now: string) {
  const name = str(body.name).trim();
  if (!name) throw new HttpError(400, "Enter the worker's name.");
  const w: Worker = {
    id: newId(db, 'W'),
    org_id: org.id,
    name,
    trade: str(body.trade).trim() || 'Worker',
    email: str(body.email).trim(),
    phone: str(body.phone).trim(),
    badge_id: nextBadge(db, org),
    active: true,
    created_at: now,
  };
  db.workers.push(w);
  let added = 0;
  for (const rel of crewFor) {
    if (!rel.worker_ids.includes(w.id)) rel.worker_ids.push(w.id);
    added += syncRelationship(db, rel.id, by, now).added;
    const client = findOrg(db, rel.client_id);
    addActivity(db, { at: now, actor: by, role, client_id: rel.client_id, relationship_id: rel.id, text: `${by} added ${name} to ${possessive(org.name)} ${client.name} crew${added ? ` (${plural(added, 'requirement')} assigned)` : ''}`, tone: 'info' });
  }
  return { id: w.id, badge_id: w.badge_id, added };
}

export function updateWorker(db: DemoDB, w: Worker, body: Record<string, unknown>): { id: string } {
  const name = str(body.name ?? w.name).trim();
  if (!name) throw new HttpError(400, "The worker's name can't be empty.");
  w.name = name;
  w.trade = str(body.trade ?? w.trade).trim();
  w.email = str(body.email ?? w.email).trim();
  w.phone = str(body.phone ?? w.phone).trim();
  return { id: w.id };
}

export function setCrew(db: DemoDB, rel: Relationship, w: Worker, on: boolean, by: string, role: 'admin' | 'contractor', now: string) {
  if (w.org_id !== rel.contractor_id) throw new HttpError(400, `${w.name} doesn't work for this contractor.`);
  const was = rel.worker_ids.includes(w.id);
  if (was === on) return { added: 0, removed: 0 };
  rel.worker_ids = on ? [...rel.worker_ids, w.id] : rel.worker_ids.filter((id) => id !== w.id);
  const r = syncRelationship(db, rel.id, by, now);
  const client = findOrg(db, rel.client_id);
  addActivity(db, {
    at: now,
    actor: by,
    role,
    client_id: rel.client_id,
    relationship_id: rel.id,
    text: on ? `${by} put ${w.name} on the ${client.name} crew${r.added ? ` (${plural(r.added, 'requirement')} assigned)` : ''}` : `${by} took ${w.name} off the ${client.name} crew`,
    tone: 'info',
  });
  return r;
}

export function setWorkerActive(db: DemoDB, w: Worker, active: boolean, by: string, role: 'admin' | 'contractor', now: string) {
  if (w.active === active) return { id: w.id, added: 0, removed: 0 };
  w.active = active;
  const r = syncAll(db, by, now, (rel) => rel.contractor_id === w.org_id);
  const org = findOrg(db, w.org_id);
  for (const rel of db.relationships.filter((x) => x.contractor_id === w.org_id && x.worker_ids.includes(w.id))) {
    addActivity(db, { at: now, actor: by, role, client_id: rel.client_id, relationship_id: rel.id, text: `${by} marked ${w.name} (${org.name}) as ${active ? 'active' : 'inactive'}`, tone: 'info' });
  }
  return { id: w.id, ...r };
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

const TYPES: RequirementType[] = ['FORM', 'DOCUMENT', 'TRAINING', 'SIGNOFF'];
const UNITS: PeriodUnit[] = ['days', 'months', 'years'];

function normalizeContent(b: Record<string, unknown>): RequirementContent {
  const type = str(b.type) as RequirementType;
  if (!TYPES.includes(type)) throw new HttpError(400, 'Pick a requirement type.');
  const raw = (b.validity ?? { kind: 'NONE' }) as Partial<{ kind: string; every: unknown; unit: unknown }>;
  let validity: Validity = { kind: 'NONE' };
  if (raw.kind === 'DOCUMENT_DATE' && type === 'DOCUMENT') validity = { kind: 'DOCUMENT_DATE' };
  if (raw.kind === 'PERIOD') {
    const every = Math.max(1, Math.min(120, Math.round(Number(raw.every) || 1)));
    const unit = UNITS.includes(raw.unit as PeriodUnit) ? (raw.unit as PeriodUnit) : 'years';
    validity = { kind: 'PERIOD', every, unit };
  }
  const content: RequirementContent = {
    title: str(b.title).trim(),
    type,
    description: str(b.description).trim(),
    applies_to: b.applies_to === 'WORKER' ? 'WORKER' : 'COMPANY',
    validity,
    scored: b.scored !== false,
    needs_review: b.needs_review !== false,
    ezform_template_id: str(b.ezform_template_id).trim() || null,
    flows_down: b.flows_down !== false,
  };
  if (type === 'DOCUMENT') content.document_hint = str(b.document_hint).trim();
  if (type === 'FORM') content.form = clone((b.form ?? { sections: [] }) as FormSchema);
  if (type === 'TRAINING') content.training = clone((b.training ?? { duration_min: 10, slides: [], quiz: [], pass_mark: 80 }) as TrainingContent);
  if (type === 'SIGNOFF') content.policy = clone((b.policy ?? { body: '', confirm_text: '' }) as PolicyContent);
  return content;
}

function validateContent(c: RequirementContent): void {
  if (!c.title) throw new HttpError(400, 'Give the requirement a title.');
  if (c.type === 'FORM') {
    const fields = c.form?.sections.flatMap((s) => s.fields) ?? [];
    if (!fields.length) throw new HttpError(400, 'Add at least one question to the form.');
    if (fields.some((f) => !f.label.trim())) throw new HttpError(400, 'Every question needs a label.');
    if (fields.some((f) => f.type === 'select' && !(f.options ?? []).filter(Boolean).length)) throw new HttpError(400, 'Dropdown questions need at least one option.');
    if (fields.some((f) => f.type === 'table' && !(f.columns ?? []).length)) throw new HttpError(400, 'Table questions need at least one column.');
  }
  if (c.type === 'TRAINING') {
    const t = c.training!;
    if (!t.slides.length) throw new HttpError(400, 'Add at least one slide to the course.');
    if (t.slides.some((s) => !s.title.trim() || !s.body.trim())) throw new HttpError(400, 'Every slide needs a title and some text.');
    if (!t.quiz.length) throw new HttpError(400, 'Add at least one quiz question.');
    if (t.quiz.some((q) => !q.prompt.trim() || q.options.filter((o) => o.trim()).length < 2 || q.answer < 0 || q.answer >= q.options.length)) {
      throw new HttpError(400, 'Every quiz question needs a prompt, at least two options and a correct answer.');
    }
    t.pass_mark = Math.max(1, Math.min(100, Math.round(Number(t.pass_mark) || 80)));
  }
  if (c.type === 'SIGNOFF') {
    if (!c.policy?.body.trim()) throw new HttpError(400, 'Paste the policy text people need to read.');
    if (!c.policy.confirm_text.trim()) c.policy.confirm_text = 'I have read and accept this policy.';
  }
}

export function createRequirement(db: DemoDB, orgId: string, body: Record<string, unknown>, by: string, now: string): { id: string } {
  const content = normalizeContent(body);
  validateContent(content);
  const r: Requirement = { id: newId(db, 'R'), org_id: orgId, version: 1, created_at: now, updated_at: now, ...content };
  db.requirements.push(r);
  addActivity(db, { at: now, actor: by, role: 'admin', client_id: orgId, text: `${by} added ${r.title} to the requirement library`, tone: 'info' });
  return { id: r.id };
}

export function updateRequirement(db: DemoDB, orgId: string, id: string, body: Record<string, unknown>, by: string, now: string) {
  const r = findRequirement(db, orgId, id);
  const next = normalizeContent(body);
  if (next.type !== r.type) throw new HttpError(400, "A requirement's type can't be changed. Create a new requirement instead.");
  validateContent(next);
  // Who it flows down to is a program setting, not content: apply it without a new version.
  const flowChanged = (r.flows_down !== false) !== (next.flows_down !== false);
  if (flowChanged) {
    r.flows_down = next.flows_down !== false;
    r.updated_at = now;
    syncAll(db, by, now, (rel) => rel.client_id === orgId && !!rel.sponsor_id);
    addActivity(db, { at: now, actor: by, role: 'admin', client_id: orgId, text: `${by} ${r.flows_down ? 'now asks subcontractors for' : 'stopped asking subcontractors for'} ${r.title}`, tone: 'info' });
  }
  if (JSON.stringify(contentOf(r)) === JSON.stringify(contentOf(next))) return { version: r.version, changed: flowChanged, updated_now: 0, pinned: 0 };
  const appliesChanged = r.applies_to !== next.applies_to;
  delete r.document_hint;
  delete r.form;
  delete r.training;
  delete r.policy;
  Object.assign(r, next, { version: r.version + 1, updated_at: now });
  let updatedNow = 0;
  let pinned = 0;
  for (const a of db.assignments) {
    if (a.requirement_id !== r.id || a.removed) continue;
    // Nothing done yet → pick up the new version now. Anything else keeps its snapshot until renewal.
    if (!a.approval && a.submission.status === 'OPEN' && !a.exception) {
      a.req = snapshotOf(r);
      updatedNow++;
    } else pinned++;
  }
  if (appliesChanged) syncAll(db, by, now, (rel) => rel.client_id === orgId);
  addActivity(db, { at: now, actor: by, role: 'admin', client_id: orgId, text: `${by} updated ${r.title} to version ${r.version}`, tone: 'info' });
  return { version: r.version, changed: true, updated_now: updatedNow, pinned };
}

export function setRequirementRetired(db: DemoDB, orgId: string, id: string, retired: boolean, by: string, now: string) {
  const r = findRequirement(db, orgId, id);
  r.retired = retired;
  r.updated_at = now;
  const res = syncAll(db, by, now, (rel) => rel.client_id === orgId);
  addActivity(db, { at: now, actor: by, role: 'admin', client_id: orgId, text: `${by} ${retired ? 'retired' : 'restored'} ${r.title}`, tone: 'info' });
  return res;
}

export function deleteRequirement(db: DemoDB, orgId: string, id: string): { ok: true } {
  const r = findRequirement(db, orgId, id);
  const groups = db.groups.filter((g) => g.org_id === orgId && g.requirement_ids.includes(id));
  if (groups.length) throw new HttpError(409, `Remove it from ${groups.map((g) => g.name).join(', ')} first, or retire it instead.`);
  if (db.assignments.some((a) => a.requirement_id === id)) throw new HttpError(409, `${r.title} has already been assigned, so it can only be retired.`);
  db.requirements = db.requirements.filter((x) => x.id !== id);
  return { ok: true };
}

function normalizeGroup(db: DemoDB, orgId: string, b: Record<string, unknown>) {
  const name = str(b.name).trim();
  if (!name) throw new HttpError(400, 'Name the group.');
  const ids = arr(b.requirement_ids).filter((id) => db.requirements.some((r) => r.id === id && r.org_id === orgId));
  if (!ids.length) throw new HttpError(400, 'Pick at least one requirement for the group.');
  return { name, description: str(b.description).trim(), requirement_ids: ids };
}

const mineOnly = (db: DemoDB, orgId: string) => db.groups.filter((g) => g.org_id === orgId);

export function createGroup(db: DemoDB, orgId: string, body: Record<string, unknown>, by: string, now: string): { id: string } {
  const g = normalizeGroup(db, orgId, body);
  if (mineOnly(db, orgId).some((x) => x.name.toLowerCase() === g.name.toLowerCase())) throw new HttpError(409, `There's already a group called ${g.name}.`);
  const id = newId(db, 'G');
  db.groups.push({ id, org_id: orgId, ...g, created_at: now, updated_at: now });
  addActivity(db, { at: now, actor: by, role: 'admin', client_id: orgId, text: `${by} created the ${g.name} group`, tone: 'info' });
  return { id };
}

export function updateGroup(db: DemoDB, orgId: string, id: string, body: Record<string, unknown>, by: string, now: string) {
  const g = findGroup(db, orgId, id);
  const next = normalizeGroup(db, orgId, body);
  if (mineOnly(db, orgId).some((x) => x.id !== id && x.name.toLowerCase() === next.name.toLowerCase())) throw new HttpError(409, `There's already a group called ${next.name}.`);
  Object.assign(g, next, { updated_at: now });
  const r = syncAll(db, by, now, (rel) => rel.client_id === orgId && usesGroup(db, rel, g.id));
  addActivity(db, { at: now, actor: by, role: 'admin', client_id: orgId, text: `${by} updated the ${g.name} group (${r.added} assignments added, ${r.removed} removed)`, tone: 'info' });
  return r;
}

export function cloneGroup(db: DemoDB, orgId: string, id: string, by: string, now: string): { id: string } {
  const g = findGroup(db, orgId, id);
  let name = `${g.name} (copy)`;
  let n = 2;
  while (mineOnly(db, orgId).some((x) => x.name === name)) name = `${g.name} (copy ${n++})`;
  const copy = { id: newId(db, 'G'), org_id: orgId, name, description: g.description, requirement_ids: [...g.requirement_ids], created_at: now, updated_at: now };
  db.groups.push(copy);
  addActivity(db, { at: now, actor: by, role: 'admin', client_id: orgId, text: `${by} cloned ${g.name}`, tone: 'info' });
  return { id: copy.id };
}

export function deleteGroup(db: DemoDB, orgId: string, id: string): { ok: true } {
  const g = findGroup(db, orgId, id);
  const cs = db.relationships.filter((r) => r.client_id === orgId && r.group_ids.includes(id));
  const ss = db.sites.filter((s) => s.org_id === orgId && s.group_ids.includes(id));
  if (cs.length || ss.length) {
    const parts = [cs.length ? plural(cs.length, 'contractor') : '', ss.length ? plural(ss.length, 'site') : ''].filter(Boolean);
    throw new HttpError(409, `${g.name} is used by ${parts.join(' and ')}. Unassign it first.`);
  }
  db.groups = db.groups.filter((x) => x.id !== id);
  return { ok: true };
}

function normalizeSite(db: DemoDB, orgId: string, b: Record<string, unknown>) {
  const name = str(b.name).trim();
  if (!name) throw new HttpError(400, 'Name the project or site.');
  return {
    name,
    code: str(b.code).trim().toUpperCase(),
    address: str(b.address).trim(),
    description: str(b.description).trim(),
    group_ids: arr(b.group_ids).filter((id) => db.groups.some((g) => g.id === id && g.org_id === orgId)),
  };
}

export function createSite(db: DemoDB, orgId: string, body: Record<string, unknown>, by: string, now: string): { id: string } {
  const s = normalizeSite(db, orgId, body);
  const id = newId(db, 'S');
  db.sites.push({ id, org_id: orgId, ...s, created_at: now });
  addActivity(db, { at: now, actor: by, role: 'admin', client_id: orgId, text: `${by} created the project ${s.name}`, tone: 'info' });
  return { id };
}

export function updateSite(db: DemoDB, orgId: string, id: string, body: Record<string, unknown>, by: string, now: string) {
  const site = findSite(db, orgId, id);
  Object.assign(site, normalizeSite(db, orgId, body));
  const r = syncAll(db, by, now, (rel) => rel.client_id === orgId && rel.site_ids.includes(id));
  addActivity(db, { at: now, actor: by, role: 'admin', client_id: orgId, text: `${by} updated ${site.name} (${r.added} assignments added, ${r.removed} removed)`, tone: 'info' });
  return r;
}

/**
 * Turns on the client side for a company that until now only worked for others: a starter
 * library it can edit, one baseline group and a first project to assign subcontractors to.
 */
/** Fills a brand new program with a starter library. Called when EHSSoftware.io turns the subscription on. */
function startProgram(db: DemoDB, org: Organization, by: string, now: string): { requirements: number } {
  // Turning a subscription off keeps the library, so only a company that never had one gets the starter set.
  if (org.program_enabled || db.requirements.some((r) => r.org_id === org.id)) {
    org.program_enabled = true;
    return { requirements: 0 };
  }
  const add = (content: RequirementContent) => {
    const r: Requirement = { id: newId(db, 'R'), org_id: org.id, version: 1, created_at: now, updated_at: now, ...content };
    db.requirements.push(r);
    return r.id;
  };
  const ids = [
    add({ title: 'Certificate of Liability Insurance', type: 'DOCUMENT', description: 'Proof of general liability insurance for the company.', applies_to: 'COMPANY', validity: { kind: 'DOCUMENT_DATE' }, scored: true, needs_review: true, document_hint: C.rebrand(C.HINTS.COI, org.name) }),
    add({ title: "Workers' Compensation Certificate", type: 'DOCUMENT', description: 'Coverage for everyone the subcontractor brings on site.', applies_to: 'COMPANY', validity: { kind: 'DOCUMENT_DATE' }, scored: true, needs_review: true, document_hint: C.HINTS.WC }),
    add({ title: `${org.name} Site Safety Rules`, type: 'SIGNOFF', description: `Read and sign ${possessive(org.name)} safety rules once a year.`, applies_to: 'COMPANY', validity: { kind: 'PERIOD', every: 1, unit: 'years' }, scored: true, needs_review: false, policy: C.rebrand(C.SITE_RULES, org.name) }),
    add({ title: 'Safety Orientation', type: 'TRAINING', description: 'Stop-work authority, hazard reporting, PPE, permits and emergencies.', applies_to: 'WORKER', validity: { kind: 'PERIOD', every: 1, unit: 'years' }, scored: true, needs_review: false, training: C.rebrand(C.ORIENTATION, org.name) }),
  ];
  db.groups.push({ id: newId(db, 'G'), org_id: org.id, name: 'Subcontractor baseline', description: 'Insurance, safety rules and orientation for every subcontractor.', requirement_ids: ids, created_at: now, updated_at: now });
  org.program_enabled = true;
  addActivity(db, { at: now, actor: by, role: 'system', client_id: org.id, text: `Contractor program turned on for ${org.name} with ${plural(ids.length, 'starter requirement')}`, tone: 'good' });
  return { requirements: ids.length };
}

// ---------------------------------------------------------------------------
// Subscriptions: EHSSoftware.io decides who can manage their own contractors
// ---------------------------------------------------------------------------

/** A company that only works for others asks EHSSoftware.io to turn the program on. */
export function requestSubscription(db: DemoDB, me: Me, now: string): { status: SubscriptionStatus } {
  const org = me.org;
  if (org.is_ehs) throw new HttpError(400, 'EHSSoftware.io staff manage subscriptions instead.');
  if (org.subscription === 'ACTIVE') return { status: 'ACTIVE' };
  if (org.subscription !== 'REQUESTED') {
    org.subscription = 'REQUESTED';
    org.subscription_requested_at = now;
    org.subscription_requested_by = me.member.name;
  }
  return { status: org.subscription };
}

/** EHSSoftware.io turns a subscription on or off. Turning it on starts the program. */
export function setSubscription(db: DemoDB, orgId: string, active: boolean, by: string, now: string): { status: SubscriptionStatus; requirements: number } {
  const org = findOrg(db, orgId);
  if (org.is_ehs) throw new HttpError(400, "EHSSoftware.io doesn't subscribe to itself.");
  if (!active) {
    org.subscription = 'NONE';
    org.program_enabled = false;
    org.subscription_since = null;
    org.subscription_requested_at = null;
    org.subscription_requested_by = undefined;
    return { status: org.subscription, requirements: 0 };
  }
  const { requirements } = startProgram(db, org, by, now);
  org.subscription = 'ACTIVE';
  org.subscription_since = now;
  org.subscription_requested_at = null;
  return { status: org.subscription, requirements };
}

/** Every customer, with the companies waiting for a decision first. */
export function ehsAccounts(ctx: Ctx): EhsAccount[] {
  const rank = { REQUESTED: 0, ACTIVE: 1, NONE: 2 } as const;
  return ctx.db.orgs
    .filter((o) => !o.is_ehs)
    .map((o) => ({
      id: o.id,
      name: o.name,
      trade: o.trade,
      contact: o.contact,
      subscription: o.subscription,
      requested_at: o.subscription_requested_at ?? null,
      requested_by: o.subscription_requested_by,
      since: o.subscription_since ?? null,
      contractors: relsAsClient(ctx, o.id).length,
      clients: relsAsContractor(ctx, o.id).length,
      workers: ctx.db.workers.filter((w) => w.org_id === o.id).length,
    }))
    .sort((a, b) => rank[a.subscription] - rank[b.subscription] || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Submissions, review and exceptions
// ---------------------------------------------------------------------------

function validateEvidence(snap: RequirementSnapshot, ev: Evidence | undefined, now: string): void {
  if (!ev || typeof ev !== 'object') throw new HttpError(400, 'Nothing was submitted.');
  if (ev.kind !== snap.type) throw new HttpError(400, "That doesn't match what this requirement asks for.");
  switch (ev.kind) {
    case 'DOCUMENT':
      if (!ev.file?.name) throw new HttpError(400, 'Attach the document.');
      if (snap.validity.kind === 'DOCUMENT_DATE') {
        if (!ev.expires_at) throw new HttpError(400, 'Enter the expiry date shown on the document.');
        if (daysUntil(ev.expires_at, now) <= 0) throw new HttpError(400, 'That document has already expired. Upload a current one.');
      }
      break;
    case 'TRAINING': {
      const pass = snap.training?.pass_mark ?? 0;
      if (!ev.passed || ev.score < pass) throw new HttpError(400, `A score of ${pass}% is needed to pass.`);
      break;
    }
    case 'SIGNOFF':
      if (!ev.acknowledged) throw new HttpError(400, "Tick the box to confirm you've read the policy.");
      if (!ev.signed_name?.trim()) throw new HttpError(400, 'Type your full name.');
      if (!ev.signature) throw new HttpError(400, 'Sign in the box.');
      break;
    case 'FORM': {
      const missing = missingAnswers(snap.form, ev.answers);
      if (missing.length) throw new HttpError(400, `Answer the required question${missing.length > 1 ? 's' : ''}: ${missing.slice(0, 3).join('; ')}${missing.length > 3 ? '…' : ''}`);
      break;
    }
  }
}

export function openRenewal(db: DemoDB, a: Assignment, now: string): void {
  const r = db.requirements.find((x) => x.id === a.requirement_id);
  if (r && !r.retired) a.req = snapshotOf(r);
  a.submission = { status: 'OPEN', opened_at: now, due_at: a.approval?.expires_at ?? plusDays(now, DUE_DAYS), is_renewal: true };
  a.history.push({ at: now, by: 'System', action: `Renewal opened (version ${a.req.version})` });
}

export function approveAssignment(db: DemoDB, a: Assignment, by: string, now: string, auto = false, note?: string): void {
  const sub = a.submission;
  if (!sub.evidence) throw new HttpError(409, 'There is nothing to approve yet.');
  const submittedAt = sub.submitted_at ?? now;
  const expires = computeExpiry(a.req, sub.evidence, submittedAt);
  if (a.approval) a.previous.unshift(a.approval);
  a.approval = {
    approved_at: now,
    approved_by: by,
    expires_at: expires,
    evidence: sub.evidence,
    submitted_at: submittedAt,
    submitted_by: sub.submitted_by ?? '',
    version: a.req.version,
    reminders: [],
    auto,
  };
  a.submission = { status: 'CLOSED', opened_at: sub.opened_at, due_at: null, is_renewal: false, reviewed_at: now, reviewed_by: by, note: note?.trim() || undefined };
  if (a.exception?.status === 'REQUESTED') {
    a.exception = null;
    a.history.push({ at: now, by: 'System', action: 'Exception request closed because the item was approved' });
  }
  a.history.push({ at: now, by, action: auto ? 'Auto-approved' : 'Approved', note: note?.trim() || undefined });
  if (expires && daysUntil(expires, now) <= RENEWAL_WINDOW) openRenewal(db, a, now);
}

export function submitAssignment(db: DemoDB, a: Assignment, evidence: Evidence | undefined, by: string, now: string, reusedFrom?: string) {
  if (a.removed) throw new HttpError(409, 'This requirement no longer applies.');
  const sub = a.submission;
  if (sub.status === 'SUBMITTED') throw new HttpError(409, 'This is already waiting for review.');
  if (sub.status === 'CLOSED') throw new HttpError(409, 'Nothing is due for this requirement right now.');
  validateEvidence(a.req, evidence, now);
  const rel = findRelationship(db, a.relationship_id);
  const org = findOrg(db, rel.contractor_id);
  const client = findOrg(db, rel.client_id);
  const label = labelOf(a, workerOf(db, a));
  a.submission = { status: 'SUBMITTED', opened_at: sub.opened_at, due_at: sub.due_at, is_renewal: sub.is_renewal, evidence, submitted_at: now, submitted_by: by };
  a.history.push({ at: now, by, action: sub.is_renewal ? 'Renewal submitted' : sub.status === 'REJECTED' ? 'Resubmitted' : 'Submitted', note: reusedFrom ? `Reused the copy approved by ${reusedFrom}` : undefined });
  if (!a.req.needs_review) {
    approveAssignment(db, a, 'Automatic', now, true);
    addActivity(db, { at: now, actor: by, role: 'contractor', client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id, text: `${org.name} completed ${label}`, tone: 'good' });
    return { auto_approved: true, expires_at: a.approval?.expires_at ?? null, sponsor: null };
  }
  const sp = sponsorOf(db, rel);
  addActivity(db, { at: now, actor: by, role: 'contractor', client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id, text: `${org.name} submitted ${label}${sub.is_renewal ? ' (renewal)' : ''}${reusedFrom ? `, reusing the copy ${reusedFrom} approved` : ''}${sp ? `, waiting on ${possessive(sp.org.name)} check` : ''}`, tone: 'info' });
  if (sp) {
    // A subcontractor's paperwork goes to its sponsor first; the client hears about it once the sponsor passes it on.
    emailSponsor(db, rel, 'SUBMITTED', `Check before ${client.name} sees it: ${label} (${org.name})`, `${by} submitted ${label} for ${org.name}, your subcontractor on ${client.name} work. Check it and pass it on, or send it back.\n\nOpen your review queue: ${APP_URL}/reviews`, now);
  } else {
    emailClient(db, client.id, 'SUBMITTED', `Ready for review: ${label} (${org.name})`, `${by} submitted ${label} for ${org.name}.\n\nReview it: ${APP_URL}/reviews`, now, rel.id);
  }
  return { auto_approved: false, expires_at: null, sponsor: sp?.org.name ?? null };
}

export function reviewAssignment(db: DemoDB, a: Assignment, decision: string, note: string, by: string, now: string) {
  if (a.submission.status !== 'SUBMITTED') throw new HttpError(409, "This item isn't waiting for review any more.");
  const rel = findRelationship(db, a.relationship_id);
  const org = findOrg(db, rel.contractor_id);
  const label = labelOf(a, workerOf(db, a));
  const first = firstName(org.contact.name);
  const sp = sponsorOf(db, rel);
  // The client can review a subcontractor's submission without waiting for the sponsor; the history says so.
  const skipped = sp && !a.submission.sponsor_check ? `Reviewed before ${possessive(sp.org.name)} check` : undefined;
  const withSkip = (n: string) => [n.trim(), skipped].filter(Boolean).join(' · ');
  if (decision === 'Approved') {
    approveAssignment(db, a, by, now, false, withSkip(note));
    const exp = a.approval?.expires_at;
    addActivity(db, { at: now, actor: by, role: 'admin', client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id, text: `${by} approved ${label} for ${org.name}`, tone: 'good' });
    emailContractor(db, rel, 'APPROVED', `Approved: ${label}`, `Hi ${first},\n\n${by} approved ${label}.${exp ? ` It's valid until ${fmtDate(exp)}, and we'll remind you 30 days before it expires.` : ''}${note.trim() ? `\n\nNote from the reviewer: ${note.trim()}` : ''}\n\n${portalUrl(rel)}`, now);
    return { state: 'APPROVED' };
  }
  if (decision === 'Rejected') {
    if (!note.trim()) throw new HttpError(400, 'Tell the contractor what needs to change.');
    a.submission = { ...a.submission, status: 'REJECTED', reviewed_at: now, reviewed_by: by, note: note.trim() };
    a.history.push({ at: now, by, action: 'Sent back', note: withSkip(note) });
    addActivity(db, { at: now, actor: by, role: 'admin', client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id, text: `${by} sent back ${label} to ${org.name}`, tone: 'warn' });
    emailContractor(db, rel, 'REJECTED', `Action needed: ${label}`, `Hi ${first},\n\n${by} reviewed ${label} and needs a change before it can be approved:\n\n"${note.trim()}"\n\nFix it and resubmit from your checklist: ${portalUrl(rel)}`, now);
    return { state: 'REJECTED' };
  }
  throw new HttpError(400, 'Choose approve or send back.');
}

export function requestException(db: DemoDB, a: Assignment, reason: string, until: string, by: string, now: string) {
  if (!reason.trim()) throw new HttpError(400, 'Explain why you need an exception.');
  if (!until) throw new HttpError(400, 'Pick the date the exception should end.');
  const d = daysUntil(until, now);
  if (d <= 0) throw new HttpError(400, 'The end date has to be in the future.');
  if (d > 366) throw new HttpError(400, 'An exception can last a year at most.');
  if (a.exception?.status === 'REQUESTED') throw new HttpError(409, 'An exception request is already waiting for a decision.');
  const v = viewSlot(a, makeCtx(db, now));
  if (v.compliant && !v.renewal_open) throw new HttpError(409, 'This item is already compliant.');
  const rel = findRelationship(db, a.relationship_id);
  const org = findOrg(db, rel.contractor_id);
  const label = labelOf(a, workerOf(db, a));
  a.exception = { status: 'REQUESTED', reason: reason.trim(), requested_until: until, requested_at: now, requested_by: by };
  a.history.push({ at: now, by, action: 'Exception requested', note: reason.trim() });
  addActivity(db, { at: now, actor: by, role: 'contractor', client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id, text: `${org.name} requested an exception for ${label}`, tone: 'warn' });
  emailClient(db, rel.client_id, 'EXCEPTION', `Exception requested: ${label} (${org.name})`, `${by} asked for an exception until ${fmtDate(until)}:\n\n"${reason.trim()}"\n\nDecide in the review queue: ${APP_URL}/reviews`, now, rel.id);
  return { ok: true };
}

export function decideException(db: DemoDB, a: Assignment, decision: string, note: string, until: string, by: string, now: string) {
  const ex = a.exception;
  if (!ex || ex.status !== 'REQUESTED') throw new HttpError(409, 'There is no open exception request for this item.');
  const rel = findRelationship(db, a.relationship_id);
  const org = findOrg(db, rel.contractor_id);
  const label = labelOf(a, workerOf(db, a));
  const first = firstName(org.contact.name);
  if (decision === 'Approved') {
    const end = until || ex.requested_until;
    if (daysUntil(end, now) <= 0) throw new HttpError(400, 'Pick an end date in the future.');
    a.exception = { ...ex, status: 'APPROVED', decided_at: now, decided_by: by, note: note.trim() || undefined, until: end };
    a.history.push({ at: now, by, action: `Exception granted until ${fmtDate(end)}`, note: note.trim() || undefined });
    addActivity(db, { at: now, actor: by, role: 'admin', client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id, text: `${by} granted ${org.name} an exception for ${label} until ${fmtDate(end)}`, tone: 'good' });
    emailContractor(db, rel, 'EXCEPTION', `Exception approved: ${label}`, `Hi ${first},\n\n${by} approved your exception for ${label} until ${fmtDate(end)}.${note.trim() ? `\n\nNote: ${note.trim()}` : ''}\n\nPlease complete it before then.`, now);
    return { state: 'WAIVED' };
  }
  if (decision === 'Denied') {
    if (!note.trim()) throw new HttpError(400, 'Explain why the exception was denied.');
    a.exception = { ...ex, status: 'DENIED', decided_at: now, decided_by: by, note: note.trim() };
    a.history.push({ at: now, by, action: 'Exception denied', note: note.trim() });
    addActivity(db, { at: now, actor: by, role: 'admin', client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id, text: `${by} denied ${possessive(org.name)} exception for ${label}`, tone: 'bad' });
    emailContractor(db, rel, 'EXCEPTION', `Exception denied: ${label}`, `Hi ${first},\n\n${by} couldn't approve an exception for ${label}:\n\n"${note.trim()}"\n\n${portalUrl(rel)}`, now);
    return { state: 'DENIED' };
  }
  throw new HttpError(400, 'Choose approve or deny.');
}

// ---------------------------------------------------------------------------
// The clock: nightly sweep for renewals, reminders and expiries
// ---------------------------------------------------------------------------

export function sweep(db: DemoDB, now: string): SweepSummary {
  const summary: SweepSummary = { reminders: 0, expired: 0, renewals: 0 };
  const rmap = new Map(db.relationships.map((r) => [r.id, r]));
  const omap = new Map(db.orgs.map((o) => [o.id, o]));
  const wmap = new Map(db.workers.map((w) => [w.id, w]));
  for (const a of db.assignments) {
    const ap = a.approval;
    if (a.removed || !ap?.expires_at) continue;
    const rel = rmap.get(a.relationship_id);
    if (!rel || rel.status === 'Denied') continue;
    const org = omap.get(rel.contractor_id);
    const client = omap.get(rel.client_id);
    if (!org || !client) continue;
    const w = a.worker_id ? wmap.get(a.worker_id) : undefined;
    if (a.worker_id && (!w || !onCrew(rel, w))) continue;
    const d = daysUntil(ap.expires_at, now);
    const label = labelOf(a, w);
    const first = firstName(org.contact.name);
    const base = { client_id: rel.client_id, relationship_id: rel.id, assignment_id: a.id };
    if (d <= RENEWAL_WINDOW && a.submission.status === 'CLOSED') {
      openRenewal(db, a, now);
      summary.renewals++;
      addActivity(db, { at: now, actor: 'System', role: 'system', ...base, text: `Renewal opened for ${label} (${org.name}), which expires ${fmtDate(ap.expires_at)}`, tone: 'info' });
    }
    const waiting = a.submission.status === 'SUBMITTED';
    if (d < 0) {
      if (!ap.reminders.includes('expired')) {
        ap.reminders.push('expired');
        summary.expired++;
        addActivity(db, { at: now, actor: 'System', role: 'system', ...base, text: `${label} for ${org.name} expired on ${fmtDate(ap.expires_at)}`, tone: 'bad' });
        emailContractor(db, rel, 'EXPIRED', `Expired: ${label} (${client.name})`, `Hi ${first},\n\n${label} expired on ${fmtDate(ap.expires_at)}. Until it's renewed, ${w ? w.name : 'your crew'} will be stopped at ${possessive(client.name)} gates.\n\nRenew it here: ${portalUrl(rel)}`, now);
        emailClient(db, rel.client_id, 'EXPIRED', `Expired: ${label} (${org.name})`, `${label} for ${org.name} expired on ${fmtDate(ap.expires_at)}.${waiting ? ' A renewal is waiting for your review.' : ''}`, now, rel.id);
      }
    } else if (d <= 7) {
      if (!ap.reminders.includes('7') && !waiting) {
        ap.reminders.push('7');
        summary.reminders++;
        emailContractor(db, rel, 'REMINDER_7', `${d === 0 ? 'Expires today' : `${d} days left`}: ${label} (${client.name})`, `Hi ${first},\n\n${label} for ${org.name} expires on ${fmtDate(ap.expires_at)}. Renew it now so ${w ? w.name : 'your crew'} can keep badging in at ${client.name}.\n\n${portalUrl(rel)}`, now);
      }
    } else if (d <= RENEWAL_WINDOW) {
      if (!ap.reminders.includes('30') && !waiting) {
        ap.reminders.push('30');
        summary.reminders++;
        emailContractor(db, rel, 'REMINDER_30', `Renewal due: ${label} (${client.name})`, `Hi ${first},\n\n${label} for ${org.name} expires on ${fmtDate(ap.expires_at)} (in ${d} days). You can submit the renewal to ${client.name} now.\n\n${portalUrl(rel)}`, now);
      }
    }
  }
  return summary;
}
