// Route table for the demo API. Paths follow the ezformsapi Controller/Action convention,
// so the screens can switch to the real API without changing their calls.
import type { DemoDB, Session } from '@/lib/types';
import { loadDb, resetDb, saveDb } from './db';
import * as L from './logic';

type Params = Record<string, unknown>;
type Body = Record<string, unknown>;
type Handler = (db: DemoDB, me: L.Me, now: string, params: Params, body: Body) => unknown;

const { str, HttpError } = L;

const routes: Record<string, Handler> = {
  'GET Session/GetContext': (db, me, now) => L.sessionContext(db, me, now),
  'GET Home/Get': (db, me, now) => L.home(db, me, now),

  // Companies that work for me
  'GET Contractor/GetList': (db, me, now) => L.contractorList(db, me, now),
  'GET Contractor/Get': (db, me, now, p) => L.linkDetail(db, L.asClient(db, me, str(p.id)), me, now),
  'GET Contractor/Search': (db, me, _now, p) => L.searchCompanies(db, me, str(p.q)),
  'POST Contractor/Create': (db, me, now, _p, b) => L.createContractor(db, me, b, now),
  'POST Upload/Review': (db, me, now, _p, b) => L.review(db, me, b, now),
  'GET CheckIn/GetList': (db, me, now) => L.checkIn(db, me, now),

  'GET Requirement/GetList': (db, me) => L.requirementList(db, me),
  'POST Requirement/Save': (db, me, now, _p, b) => L.saveRequirement(db, me, b, now),
  'DELETE Requirement/Delete': (db, me, _now, p) => L.deleteRequirement(db, me, str(p.id)),

  // Companies I work for
  'GET Client/GetList': (db, me, now) => L.clientList(db, me, now),
  'GET Client/Get': (db, me, now, p) => L.linkDetail(db, L.asContractor(db, me, str(p.id)), me, now),
  'POST Client/Create': (db, me, now, _p, b) => L.createClient(db, me, b, now),
  'POST Upload/Create': (db, me, now, _p, b) => L.upload(db, me, b, now),

  // My team
  'GET Person/GetList': (db, me, now) => L.peopleView(db, me, now),
  'POST Person/Save': (db, me, now, _p, b) => L.savePerson(db, me, b, now),
  'DELETE Person/Delete': (db, me, _now, p) => L.deletePerson(db, me, str(p.id)),
};

/** Demo-only routes that don't need a signed-in user. */
function demoRoute(method: string, path: string, body: Body): { hit: boolean; data?: unknown } {
  const key = `${method} ${path}`;
  if (key === 'POST Demo/Reset') {
    resetDb();
    return { hit: true, data: { ok: true } };
  }
  const db = loadDb();
  if (key === 'GET Demo/GetClock') return { hit: true, data: { today: L.nowIso(db), offset_days: db.clock_offset_days } };
  if (key === 'GET Demo/GetPersonas') return { hit: true, data: L.personas(db) };
  if (key === 'POST Demo/AdvanceClock') {
    const days = Math.max(1, Math.min(365, Number(body.days) || 1));
    db.clock_offset_days += days;
    saveDb(db);
    return { hit: true, data: { today: L.nowIso(db), offset_days: db.clock_offset_days } };
  }
  return { hit: false };
}

export function handle(method: string, path: string, params: Params, body: Body, actor: Session | null): unknown {
  const demo = demoRoute(method, path, body);
  if (demo.hit) return demo.data;

  const handler = routes[`${method} ${path}`];
  if (!handler) throw new HttpError(404, `No such endpoint: ${method} ${path}`);
  const db = loadDb();
  const me = L.resolveMe(db, actor);
  if (!me) throw new HttpError(401, 'Sign in to continue.');
  const result = handler(db, me, L.nowIso(db), params, body);
  if (method !== 'GET') saveDb(db);
  return result;
}
