// Route table for the demo API. Paths and payloads follow the ezformsapi Controller/Action
// convention so the screens can switch to the real API without changing their calls.
//
// Access follows the relationship, never a fixed role: the signed-in member's organization is the
// client on some relationships and the contractor on others, and each route checks which side it needs.
import type { ContractorStatus, DemoDB, Evidence, Relationship, Session } from '@/lib/types';
import { dayKey } from '@/lib/dates';
import { loadDb, resetDb, saveDb } from './db';
import * as L from './logic';

type Params = Record<string, unknown>;
type Body = Record<string, unknown>;

interface Req {
  params: Params;
  body: Body;
  me: L.Me;
  name: string;
}

type Handler = (db: DemoDB, ctx: L.Ctx, req: Req) => unknown;

const { str, arr, HttpError } = L;

/** The client's side of a relationship: its program owns the decision. */
function asClient(db: DemoDB, req: Req, relId: string): Relationship {
  const rel = L.findRelationship(db, relId);
  if (rel.client_id !== req.me.org.id) throw new HttpError(403, `Only ${L.findOrg(db, rel.client_id).name} can do that.`);
  return rel;
}

/** The contractor's side of a relationship. */
function asContractor(db: DemoDB, req: Req, relId: string): Relationship {
  const rel = L.findRelationship(db, relId);
  if (rel.contractor_id !== req.me.org.id) throw new HttpError(403, "You can only see your own company's records.");
  return rel;
}

function side(db: DemoDB, req: Req, relId: string): { rel: Relationship; role: 'admin' | 'contractor' } {
  const rel = L.findRelationship(db, relId);
  if (rel.client_id === req.me.org.id) return { rel, role: 'admin' };
  if (rel.contractor_id === req.me.org.id) return { rel, role: 'contractor' };
  throw new HttpError(403, "That record belongs to companies you don't work with.");
}

/** The contractor that brought a subcontractor in can see (and check) that subcontractor's record with the client. */
function viewerOf(db: DemoDB, req: Req, relId: string): 'client' | 'contractor' | 'sponsor' {
  const rel = L.findRelationship(db, relId);
  if (rel.client_id === req.me.org.id) return 'client';
  if (rel.contractor_id === req.me.org.id) return 'contractor';
  if (L.sponsorOf(db, rel)?.org.id === req.me.org.id) return 'sponsor';
  throw new HttpError(403, "That record belongs to companies you don't work with.");
}

function program(req: Req): string {
  if (!req.me.org.program_enabled) throw new HttpError(403, `${req.me.org.name} doesn't run a contractor program yet.`);
  return req.me.org.id;
}

function workerOnMyRoster(db: DemoDB, req: Req, id: string) {
  const w = L.findWorker(db, id);
  if (w.org_id !== req.me.org.id) throw new HttpError(403, "That worker isn't on your roster.");
  return w;
}

const routes: Record<string, Handler> = {
  // Session ----------------------------------------------------------------
  'GET Session/GetContext': (_db, ctx, req) => L.sessionContext(ctx, req.me),
  'POST Org/EnableProgram': (db, ctx, req) => L.enableProgram(db, req.me, ctx.now),
  'PUT Org/Update': (db, ctx, req) => L.updateOrgProfile(db, req.me, req.body, ctx.now),
  'GET Org/Search': (_db, ctx, req) => L.searchOrgs(ctx, program(req), str(req.params.q)),

  // Dashboard --------------------------------------------------------------
  'GET Dashboard/GetSummary': (_db, ctx, req) => L.dashboard(ctx, program(req)),

  // Contractors (client side) ----------------------------------------------
  'GET Contractor/GetList': (_db, ctx, req) => L.contractorList(ctx, program(req)),
  'GET Contractor/Get': (db, ctx, req) => L.contractorDetail(asClient(db, req, str(req.params.id)), ctx, 'admin'),
  'POST Contractor/Create': (db, ctx, req) => {
    program(req);
    return L.createContractor(db, req.me, req.body, ctx.now);
  },
  'PUT Contractor/Update': (db, _ctx, req) => L.updateRelationship(db, asClient(db, req, str(req.body.id)), req.body),
  'PUT Contractor/SetStatus': (db, ctx, req) =>
    L.setContractorStatus(db, asClient(db, req, str(req.body.id)), str(req.body.status) as ContractorStatus, str(req.body.note), req.name, ctx.now),
  'POST Contractor/AssignGroups': (db, ctx, req) => L.assignGroups(db, asClient(db, req, str(req.body.contractor_id)), arr(req.body.group_ids), req.name, ctx.now),
  'POST Contractor/AssignSites': (db, ctx, req) => L.assignSites(db, asClient(db, req, str(req.body.contractor_id)), arr(req.body.site_ids), req.name, ctx.now),
  'GET Contractor/CheckCompliance': (db, ctx, req) => {
    program(req);
    const w = L.findWorker(db, str(req.params.worker_id));
    L.findSite(db, req.me.org.id, str(req.params.site_id));
    return L.gateEvaluate(ctx, w, str(req.params.site_id));
  },

  // Portal (contractor side) -----------------------------------------------
  'GET Portal/GetOverview': (_db, ctx, req) => L.portalOverview(ctx, req.me.org),
  'GET Portal/GetClient': (db, ctx, req) => L.contractorDetail(asContractor(db, req, str(req.params.id)), ctx, 'contractor'),
  'POST Portal/SubmitApplication': (db, ctx, req) => L.submitApplication(db, asContractor(db, req, str(req.body.id)), req.name, ctx.now),
  'GET Portal/GetInbox': (db, _ctx, req) =>
    db.outbox.filter((e) => e.audience === 'contractor' && e.to_org_id === req.me.org.id).map((e) => ({ ...e, client_name: L.findOrg(db, e.client_id).name })),
  'GET Portal/GetSubcontractorOptions': (db, ctx, req) => L.subcontractorOptions(ctx, asContractor(db, req, str(req.params.id))),
  'POST Portal/SponsorSubcontractor': (db, ctx, req) => L.sponsorSubcontractor(db, req.me, asContractor(db, req, str(req.body.id)), req.body, ctx.now),

  // Workers ----------------------------------------------------------------
  'GET Worker/GetRoster': (_db, ctx, req) => L.rosterView(ctx, req.me.org),
  'POST Worker/Create': (db, ctx, req) => {
    // A client adding a worker for a contractor puts them straight on its own crew.
    const relId = str(req.body.relationship_id);
    if (relId) {
      const rel = asClient(db, req, relId);
      return L.createWorker(db, L.findOrg(db, rel.contractor_id), req.body, [rel], req.name, 'admin', ctx.now);
    }
    const crew = arr(req.body.crew_for).map((id) => asContractor(db, req, id));
    return L.createWorker(db, req.me.org, req.body, crew, req.name, 'contractor', ctx.now);
  },
  'PUT Worker/Update': (db, _ctx, req) => {
    const w = L.findWorker(db, str(req.body.id));
    const mine = w.org_id === req.me.org.id;
    const theirs = db.relationships.some((r) => r.client_id === req.me.org.id && r.contractor_id === w.org_id && r.worker_ids.includes(w.id));
    if (!mine && !theirs) throw new HttpError(403, "That worker isn't on your roster.");
    return L.updateWorker(db, w, req.body);
  },
  'PUT Worker/SetActive': (db, ctx, req) => L.setWorkerActive(db, workerOnMyRoster(db, req, str(req.body.id)), req.body.active === true, req.name, 'contractor', ctx.now),
  'PUT Worker/SetCrew': (db, ctx, req) => {
    const { rel, role } = side(db, req, str(req.body.relationship_id));
    // A client can take someone off its own crew; only the employer decides who joins one.
    if (role === 'admin' && req.body.on_crew === true) throw new HttpError(403, `Only ${L.findOrg(db, rel.contractor_id).name} can choose who's on its crew.`);
    return L.setCrew(db, rel, L.findWorker(db, str(req.body.worker_id)), req.body.on_crew === true, req.name, role, ctx.now);
  },

  // Requirement library ----------------------------------------------------
  'GET ComplianceRequirement/GetList': (_db, ctx, req) => L.requirementRows(ctx, program(req)),
  'POST ComplianceRequirement/Create': (db, ctx, req) => L.createRequirement(db, program(req), req.body, req.name, ctx.now),
  'PUT ComplianceRequirement/Update': (db, ctx, req) => L.updateRequirement(db, program(req), str(req.body.id), req.body, req.name, ctx.now),
  'PUT ComplianceRequirement/Retire': (db, ctx, req) => L.setRequirementRetired(db, program(req), str(req.body.id), true, req.name, ctx.now),
  'PUT ComplianceRequirement/Restore': (db, ctx, req) => L.setRequirementRetired(db, program(req), str(req.body.id), false, req.name, ctx.now),
  'DELETE ComplianceRequirement/Delete': (db, _ctx, req) => L.deleteRequirement(db, program(req), str(req.params.id)),

  // Groups -----------------------------------------------------------------
  'GET RequirementGroup/GetList': (_db, ctx, req) => L.groupRows(ctx, program(req)),
  'POST RequirementGroup/Create': (db, ctx, req) => L.createGroup(db, program(req), req.body, req.name, ctx.now),
  'PUT RequirementGroup/Update': (db, ctx, req) => L.updateGroup(db, program(req), str(req.body.id), req.body, req.name, ctx.now),
  'POST RequirementGroup/Clone': (db, ctx, req) => L.cloneGroup(db, program(req), str(req.body.id), req.name, ctx.now),
  'DELETE RequirementGroup/Delete': (db, _ctx, req) => L.deleteGroup(db, program(req), str(req.params.id)),

  // Projects & sites -------------------------------------------------------
  'GET Site/GetList': (_db, ctx, req) => L.siteRows(ctx, program(req)),
  'POST Site/Create': (db, ctx, req) => L.createSite(db, program(req), req.body, req.name, ctx.now),
  'PUT Site/Update': (db, ctx, req) => L.updateSite(db, program(req), str(req.body.id), req.body, req.name, ctx.now),

  // Assignments ------------------------------------------------------------
  'GET Assignment/GetQueue': (_db, ctx, req) => L.queue(ctx, program(req)),
  'GET Assignment/Get': (db, ctx, req) => {
    const a = L.findAssignment(db, str(req.params.id));
    return L.assignmentDetail(a, ctx, viewerOf(db, req, a.relationship_id));
  },
  'POST Assignment/SponsorCheck': (db, ctx, req) =>
    L.sponsorCheck(db, req.me, L.findAssignment(db, str(req.body.id)), str(req.body.decision), str(req.body.note), ctx.now),
  'GET Assignment/GetReusable': (db, ctx, req) => {
    const a = L.findAssignment(db, str(req.params.id));
    asContractor(db, req, a.relationship_id);
    return L.reusableDocuments(ctx, a);
  },
  'POST Assignment/Submit': (db, ctx, req) => {
    const a = L.findAssignment(db, str(req.body.id));
    asContractor(db, req, a.relationship_id);
    let evidence = req.body.evidence as Evidence | undefined;
    let reusedFrom: string | undefined;
    const reuseId = str(req.body.reuse_assignment_id);
    if (reuseId) {
      // The server copies the approved evidence itself, so a reused document is exactly what the other client approved.
      const pick = L.reusableDocuments(ctx, a).find((d) => d.assignment_id === reuseId);
      if (!pick) throw new HttpError(409, "That document can't be reused any more. Upload a copy instead.");
      evidence = pick.evidence;
      reusedFrom = pick.client_name;
    }
    return L.submitAssignment(db, a, evidence, req.name, ctx.now, reusedFrom);
  },
  'POST Assignment/Review': (db, ctx, req) => {
    const a = L.findAssignment(db, str(req.body.id));
    asClient(db, req, a.relationship_id);
    return L.reviewAssignment(db, a, str(req.body.decision), str(req.body.note), req.name, ctx.now);
  },
  'POST Assignment/RequestException': (db, ctx, req) => {
    const a = L.findAssignment(db, str(req.body.id));
    asContractor(db, req, a.relationship_id);
    return L.requestException(db, a, str(req.body.reason), str(req.body.until), req.name, ctx.now);
  },
  'POST Assignment/DecideException': (db, ctx, req) => {
    const a = L.findAssignment(db, str(req.body.id));
    asClient(db, req, a.relationship_id);
    return L.decideException(db, a, str(req.body.decision), str(req.body.note), str(req.body.until), req.name, ctx.now);
  },

  // Feed and outbox (client side) ------------------------------------------
  'GET ComplianceActivity/GetList': (db, _ctx, req) => {
    const relId = str(req.params.contractor_id);
    if (relId) side(db, req, relId);
    else program(req);
    const limit = Math.max(1, Math.min(200, Number(req.params.limit) || 60));
    return db.activity.filter((e) => (relId ? e.relationship_id === relId : e.client_id === req.me.org.id)).slice(0, limit);
  },
  'GET Notification/GetOutbox': (db, _ctx, req) => db.outbox.filter((e) => e.client_id === program(req)),

  // Gate -------------------------------------------------------------------
  'GET Gate/GetRoster': (_db, ctx, req) => L.gateRoster(ctx, program(req), str(req.params.site_id)),
  'GET Gate/GetLog': (_db, ctx, req) => L.gateLog(ctx, program(req), str(req.params.site_id)),
  'POST Gate/CheckIn': (db, ctx, req) => L.gateCheck(db, program(req), str(req.body.site_id), str(req.body.badge_id), ctx.now),
};

export function handle(method: string, path: string, params: Params, body: Body, actor: Session | null): unknown {
  if (method === 'POST' && path === 'Demo/Reset') {
    resetDb();
    return { ok: true };
  }
  const db = loadDb();
  const now = L.nowIso(db);
  // The nightly job: run once per (demo) calendar day before serving anything.
  if (db.last_sweep_day !== dayKey(now)) {
    L.sweep(db, now);
    db.last_sweep_day = dayKey(now);
    saveDb(db);
  }
  const route = `${method} ${path}`;
  let result: unknown;
  if (route === 'GET Demo/GetClock') result = { today: now, offset_days: db.clock_offset_days };
  else if (route === 'GET Demo/GetPersonas') result = L.personas(db);
  else if (route === 'POST Demo/AdvanceClock') {
    const days = Math.max(1, Math.min(365, Math.round(Number(body.days) || 1)));
    db.clock_offset_days += days;
    const later = L.nowIso(db);
    const summary = L.sweep(db, later);
    db.last_sweep_day = dayKey(later);
    result = { today: later, offset_days: db.clock_offset_days, summary };
  } else {
    const handler = routes[route];
    if (!handler) throw new HttpError(404, `Not found: ${route}`);
    const me = L.resolveMe(db, actor);
    if (!me) throw new HttpError(401, 'Please sign in.');
    result = handler(db, L.makeCtx(db, now), { params, body, me, name: me.member.name });
  }
  if (method !== 'GET') saveDb(db);
  return result === undefined ? null : JSON.parse(JSON.stringify(result));
}
