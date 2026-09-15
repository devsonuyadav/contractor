// Domain model for contractor compliance (simple version).
//
// Every company can work both ways from one account:
//   My contractors  companies that work for you. You list what you need, they upload it, you approve it.
//   My clients      companies you work for. They tell you what they need, you upload it and keep it current.
//                   A client that isn't on EZForm can be added by you; then you enter its requirements
//                   yourself and your uploads count as soon as you add them.
//
//   Company ── users (people who sign in) and people (the team whose training and certificates are tracked)
//   Link    ── client company ← contractor company, added by one of the two
//   Upload  ── a file for one link × requirement (× person)
//
// People belong to their own company, so they are internal to it. A client sees a contractor's
// people as external users.

export type RequirementFor = 'COMPANY' | 'PERSON';

export interface Company {
  id: string;
  name: string;
  trade: string;
  contact_name: string;
  email: string;
  phone: string;
  /** False for a client a contractor added itself: it has no account and nobody signs in for it. */
  on_ezform: boolean;
  created_at: string;
}

/** Someone who signs in for a company. */
export interface User {
  id: string;
  company_id: string;
  name: string;
  title: string;
}

/** A member of a company's team. Tracked, but doesn't need to sign in. */
export interface Person {
  id: string;
  company_id: string;
  name: string;
  job: string;
  badge_id: string;
  created_at: string;
}

export interface Requirement {
  id: string;
  /** The company asking for it: the client. */
  company_id: string;
  /** Set when a contractor entered this for a client that isn't on EZForm; it then applies to that link only. */
  link_id: string | null;
  title: string;
  for: RequirementFor;
  has_expiry: boolean;
  hint: string;
  created_at: string;
}

export interface Link {
  id: string;
  client_id: string;
  contractor_id: string;
  /** CLIENT: the client invited the contractor and reviews uploads. CONTRACTOR: the contractor tracks a client itself. */
  added_by: 'CLIENT' | 'CONTRACTOR';
  created_at: string;
}

export interface StoredFile {
  name: string;
  size: number;
  type: string;
  data_url?: string | null;
}

export type UploadStatus = 'WAITING' | 'APPROVED' | 'REJECTED';

export interface Upload {
  id: string;
  link_id: string;
  requirement_id: string;
  person_id: string | null;
  file: StoredFile;
  expires_at: string | null;
  uploaded_at: string;
  uploaded_by: string;
  status: UploadStatus;
  reviewed_at?: string;
  reviewed_by?: string;
  note?: string;
}

export interface DemoDB {
  schema: number;
  clock_offset_days: number;
  seq: number;
  companies: Company[];
  users: User[];
  people: Person[];
  requirements: Requirement[];
  links: Link[];
  uploads: Upload[];
}

// ---------------------------------------------------------------------------
// Read models returned by the API
// ---------------------------------------------------------------------------

export type ItemState = 'MISSING' | 'WAITING' | 'REJECTED' | 'OK' | 'EXPIRING' | 'EXPIRED';

/** One line of a checklist: a requirement for the company, or for one person. */
export interface Item {
  key: string;
  link_id: string;
  requirement: Requirement;
  person: Person | null;
  state: ItemState;
  /** Counts right now: approved and not expired. */
  ok: boolean;
  /** What currently counts. */
  approved: Upload | null;
  /** A newer upload that is waiting for review or was sent back. */
  pending: Upload | null;
  expires_in_days: number | null;
}

export interface Progress {
  done: number;
  total: number;
}

/** A link seen from either side, with its checklist totals. */
export interface LinkRow {
  id: string;
  added_by: Link['added_by'];
  /** The other company. */
  company: Company;
  progress: Progress;
  compliant: boolean;
  to_review: number;
  expiring: number;
  problems: number;
  people: number;
}

export interface LinkDetail {
  row: LinkRow;
  /** Which side the viewer is on. */
  viewer: 'client' | 'contractor';
  /** The client reviews uploads; false when the contractor tracks the client itself. */
  reviewed: boolean;
  company_items: Item[];
  people: { person: Person; ok: boolean; items: Item[] }[];
  /** Requirements the contractor entered itself, for a client that isn't on EZForm. */
  own_requirements: Requirement[];
}

export interface RequirementRow extends Requirement {
  contractors: number;
}

export interface HomeView {
  today: string;
  company: Company;
  contractors: { total: number; compliant: number; to_review: Item[]; problems: Item[] };
  clients: { total: number; compliant: number; todo: Item[]; expiring: Item[] };
  /** Item lines need the other company's name. */
  names: Record<string, string>;
}

export interface CheckInRow {
  person: Person;
  contractor: Company;
  link_id: string;
  allowed: boolean;
  reasons: string[];
}

export interface PeopleView {
  company: Company;
  people: (Person & { clients: { link_id: string; name: string; ok: boolean }[] })[];
}

export interface CompanyMatch {
  id: string;
  name: string;
  trade: string;
}

export interface ClockInfo {
  today: string;
  offset_days: number;
}

export interface Persona {
  user_id: string;
  name: string;
  title: string;
  company_name: string;
  contractors: number;
  clients: number;
}

export type Session = { user_id: string };

export interface SessionContext {
  user: User;
  company: Company;
  contractors: number;
  clients: number;
  to_review: number;
  todo: number;
}
