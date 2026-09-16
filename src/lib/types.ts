// Domain model for contractor compliance.
//
// Every company is an Organization. A company never has a fixed "client" or "contractor"
// type: the role belongs to a Relationship between two organizations. The same company can
// run its own contractor program (client side of some relationships) and work for other
// companies (contractor side of others).
//
//   Organization ── owns ──> requirement library, groups, sites      (its program, as a client)
//   Organization ── owns ──> company profile, workers, members        (shared across every client)
//   Relationship (client org → contractor org) ── status, sites, groups, crew
//   Assignment   (relationship × requirement × worker) ── evidence, approval, renewals
//
// Flow-down: a relationship can be sponsored by another relationship with the same client. When Delta
// brings its subcontractor Ironwood onto Riverside work, Riverside→Ironwood is sponsored by Riverside→Delta:
// Ironwood inherits Delta's Riverside requirements, Delta checks Ironwood's paperwork before Riverside
// reviews it, and the gate needs the whole chain (Riverside→Delta, Delta→Ironwood, Riverside→Ironwood) to hold.
//
// Scores, queues and dashboards are derived from assignments at read time.

export type ContractorStatus = 'New' | 'Pending' | 'Approved' | 'Denied';
export type RequirementType = 'FORM' | 'DOCUMENT' | 'TRAINING' | 'SIGNOFF';
export type AppliesTo = 'COMPANY' | 'WORKER';
export type PeriodUnit = 'days' | 'months' | 'years';

export type Validity =
  | { kind: 'NONE' }
  | { kind: 'DOCUMENT_DATE' }
  | { kind: 'PERIOD'; every: number; unit: PeriodUnit };

export type FormFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'yesno' | 'checkbox' | 'table';

export interface TableColumn {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date';
}

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  help?: string;
  options?: string[];
  columns?: TableColumn[];
  min_rows?: number;
}

export interface FormSection {
  id: string;
  title: string;
  fields: FormField[];
}

export interface FormSchema {
  sections: FormSection[];
}

export interface TrainingSlide {
  id: string;
  title: string;
  body: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
}

export interface TrainingContent {
  duration_min: number;
  slides: TrainingSlide[];
  quiz: QuizQuestion[];
  pass_mark: number;
}

export interface PolicyContent {
  body: string;
  confirm_text: string;
}

export interface RequirementContent {
  title: string;
  type: RequirementType;
  description: string;
  applies_to: AppliesTo;
  validity: Validity;
  scored: boolean;
  needs_review: boolean;
  document_hint?: string;
  form?: FormSchema;
  training?: TrainingContent;
  policy?: PolicyContent;
  /** Extension point: answer a FORM requirement with an EZForm template instead of the built-in form. */
  ezform_template_id?: string | null;
  /**
   * Whether subcontractors brought in by a contractor are asked for this too. A program setting,
   * not part of the versioned content: changing it doesn't create a new version.
   */
  flows_down?: boolean;
}

export interface Requirement extends RequirementContent {
  id: string;
  /** The organization whose program this requirement belongs to. */
  org_id: string;
  version: number;
  created_at: string;
  updated_at: string;
  retired?: boolean;
}

/** Copy of a requirement taken when an assignment cycle opens; library edits don't reach it. */
export interface RequirementSnapshot extends RequirementContent {
  requirement_id: string;
  version: number;
}

export interface RequirementGroup {
  id: string;
  org_id: string;
  name: string;
  description: string;
  requirement_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  org_id: string;
  name: string;
  code: string;
  address: string;
  description: string;
  group_ids: string[];
  created_at: string;
}

export interface ContactInfo {
  name: string;
  title?: string;
  email: string;
  phone: string;
}

/** What a company says about itself. Owned by the company, shown to every client. */
export interface CompanyProfile {
  name: string;
  trade: string;
  contact: ContactInfo;
  address: string;
  website?: string;
  license_no?: string;
  employees_count?: number;
}

/** Managing your own contractors is a paid EZForm feature: EHSSoftware.io turns it on. */
export type SubscriptionStatus = 'NONE' | 'REQUESTED' | 'ACTIVE';

export interface Organization extends CompanyProfile {
  id: string;
  short: string;
  created_at: string;
  /** Set once the company runs its own contractor program (has a library and sites). */
  program_enabled: boolean;
  subscription: SubscriptionStatus;
  subscription_requested_at?: string | null;
  subscription_requested_by?: string;
  subscription_since?: string | null;
  /** EHSSoftware.io staff. They manage subscriptions instead of contractors. */
  is_ehs?: boolean;
  /**
   * A client a contractor added itself: the company has no account and nobody signs in for it.
   * Only the contractor that created it can see it.
   */
  private_owner_id?: string;
}

/** A person who signs in for an organization. They can act on both sides of it. */
export interface Member {
  id: string;
  org_id: string;
  name: string;
  title: string;
  email: string;
}

/** A client organization's record of a contractor organization. Everything the client decides lives here. */
export interface Relationship {
  id: string;
  client_id: string;
  contractor_id: string;
  status: ContractorStatus;
  status_note?: string;
  status_changed_at?: string;
  site_ids: string[];
  group_ids: string[];
  tags: string[];
  /** Workers the contractor has put on this client's crew. Worker requirements go to them only. */
  worker_ids: string[];
  created_at: string;
  invited_by: string;
  profile_submitted_at?: string | null;
  /**
   * Set when a contractor brought this company in as its subcontractor: the id of the sponsor's own
   * relationship with the same client. Null for companies the client engaged directly.
   */
  sponsor_id?: string | null;
  /** The contractor keeps this record itself: it writes the list and nobody reviews what it uploads. */
  self_managed?: boolean;
}

/** A relationship seen with the contractor's profile flattened in: what screens call "a contractor". */
export interface Contractor extends Relationship, CompanyProfile {
  client_name: string;
  /** The contractor that brought this company in, when it's a subcontractor. */
  sponsor: { relationship_id: string; org_id: string; name: string } | null;
}

export interface Worker {
  id: string;
  /** The employer. A worker belongs to one company and can be on several clients' crews. */
  org_id: string;
  name: string;
  trade: string;
  email: string;
  phone: string;
  badge_id: string;
  active: boolean;
  created_at: string;
}

export interface StoredFile {
  name: string;
  size: number;
  type: string;
  data_url?: string | null;
}

export type Evidence =
  | { kind: 'FORM'; answers: Record<string, unknown> }
  | { kind: 'DOCUMENT'; file: StoredFile; issued_at?: string | null; expires_at?: string | null; reference?: string }
  | { kind: 'TRAINING'; score: number; passed: boolean; attempts: number; trainee: string }
  | { kind: 'SIGNOFF'; signed_name: string; signature: string; acknowledged: boolean };

export type ReminderMark = '30' | '7' | 'expired';

export interface Approval {
  approved_at: string;
  approved_by: string;
  expires_at: string | null;
  evidence: Evidence;
  submitted_at: string;
  submitted_by: string;
  version: number;
  reminders: ReminderMark[];
  auto?: boolean;
}

export type SubmissionStatus = 'OPEN' | 'SUBMITTED' | 'REJECTED' | 'CLOSED';

export interface Submission {
  status: SubmissionStatus;
  opened_at: string;
  due_at: string | null;
  is_renewal: boolean;
  evidence?: Evidence;
  submitted_at?: string;
  submitted_by?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  note?: string;
  /** For a subcontractor: the sponsoring contractor passed this on to the client. */
  sponsor_check?: { at: string; by: string; org_name: string; note?: string };
}

export interface ExceptionRequest {
  status: 'REQUESTED' | 'APPROVED' | 'DENIED';
  reason: string;
  requested_until: string;
  requested_at: string;
  requested_by: string;
  decided_at?: string;
  decided_by?: string;
  note?: string;
  until?: string;
}

export interface HistoryEntry {
  at: string;
  by: string;
  action: string;
  note?: string;
}

/** One row per relationship × requirement (× worker for worker-level requirements). */
export interface Assignment {
  id: string;
  relationship_id: string;
  worker_id: string | null;
  requirement_id: string;
  sources: string[];
  req: RequirementSnapshot;
  assigned_at: string;
  /** What currently counts toward compliance. Survives renewal cycles until replaced. */
  approval: Approval | null;
  /** The work item currently open for the contractor (first cycle or a renewal). */
  submission: Submission;
  exception: ExceptionRequest | null;
  history: HistoryEntry[];
  previous: Approval[];
  removed?: boolean;
}

/** Which side of the relationship acted: the client's staff ('admin'), the contractor, or the system. */
export type ActorRole = 'admin' | 'contractor' | 'system';
export type Tone = 'good' | 'warn' | 'bad' | 'info';

export interface ActivityEvent {
  id: string;
  at: string;
  actor: string;
  role: ActorRole;
  /** The program (client organization) the event belongs to. */
  client_id: string;
  relationship_id?: string;
  assignment_id?: string;
  text: string;
  tone?: Tone;
}

export type EmailKind =
  | 'INVITE'
  | 'REMINDER_30'
  | 'REMINDER_7'
  | 'EXPIRED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXCEPTION'
  | 'STATUS'
  | 'APPLICATION';

export interface OutboxEmail {
  id: string;
  at: string;
  to: string;
  to_name: string;
  subject: string;
  body: string;
  kind: EmailKind;
  client_id: string;
  relationship_id?: string;
  audience: 'admin' | 'contractor';
  /** The company a contractor-side email went to (a contractor, or a sponsor about its subcontractor). */
  to_org_id?: string;
}

export interface InboxEmail extends OutboxEmail {
  client_name: string;
}

export interface CheckIn {
  id: string;
  at: string;
  site_id: string;
  badge_id: string;
  worker_id: string | null;
  relationship_id: string | null;
  result: 'CLEAR' | 'BLOCKED';
  reasons: string[];
}

export interface DemoDB {
  schema: number;
  clock_offset_days: number;
  last_sweep_day: string | null;
  seq: number;
  orgs: Organization[];
  members: Member[];
  relationships: Relationship[];
  workers: Worker[];
  requirements: Requirement[];
  groups: RequirementGroup[];
  sites: Site[];
  assignments: Assignment[];
  activity: ActivityEvent[];
  outbox: OutboxEmail[];
  checkins: CheckIn[];
}

// ---------------------------------------------------------------------------
// Read models returned by the API
// ---------------------------------------------------------------------------

export type SlotState = 'NOT_STARTED' | 'SUBMITTED' | 'REJECTED' | 'APPROVED' | 'EXPIRING' | 'EXPIRED' | 'WAIVED';

export interface SlotView extends Assignment {
  state: SlotState;
  compliant: boolean;
  expires_in_days: number | null;
  due_in_days: number | null;
  overdue: boolean;
  renewal_open: boolean;
  /** Submitted, and the client can review it now. */
  awaiting_review: boolean;
  /** Submitted by a subcontractor and waiting for its sponsor's check first. */
  awaiting_sponsor: boolean;
  sponsor_name?: string;
  exception_pending: boolean;
  needs_action: boolean;
  waived_until: string | null;
  contractor_name: string;
  client_name: string;
  worker_name?: string;
}

export interface Score {
  compliant: number;
  total: number;
  pct: number | null;
}

export interface ContractorRow extends Contractor {
  company_score: Score;
  worker_score: Score;
  open_items: number;
  awaiting_review: number;
  exceptions: number;
  expiring: number;
  expired: number;
  worker_count: number;
  site_names: string[];
  group_names: string[];
  awaiting_sponsor: number;
  subcontractors: number;
}

export interface WorkerView extends Worker {
  score: Score;
  clear: boolean;
  slots: SlotView[];
}

export interface OrgSummary {
  id: string;
  name: string;
  short: string;
}

/** One relationship in full. The client's admin and the contractor both read this shape. */
export interface ContractorDetail {
  contractor: ContractorRow;
  client: OrgSummary;
  /** The crew for this client. */
  workers: WorkerView[];
  slots: SlotView[];
  sites: Site[];
  groups: RequirementGroup[];
  activity: ActivityEvent[];
  emails: OutboxEmail[];
  /** Subcontractors this contractor brought onto the client's work, with what's waiting on its check. */
  subcontractors: ContractorRow[];
  sponsor_checks: SlotView[];
  /** Groups inherited from the sponsor, for a subcontractor. */
  inherited_groups: RequirementGroup[];
  /** Sites a subcontractor can be put on: the sponsor's sites with this client. */
  sponsor_site_ids: string[] | null;
  /** For a client you keep yourself: the list you wrote, which only you can see. */
  own_requirements: Requirement[];
}

export type TaskKind = 'REVIEW' | 'EXCEPTION' | 'APPLICATION' | 'SPONSOR_CHECK';

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  subtitle: string;
  at: string;
  relationship_id: string;
  assignment_id?: string;
}

export interface DashboardSummary {
  today: string;
  status_counts: Record<ContractorStatus, number>;
  kpis: {
    contractors: number;
    approved: number;
    waiting_on_you: number;
    expiring_30: number;
    expired: number;
    avg_company_score: number | null;
    avg_worker_score: number | null;
  };
  tasks: Task[];
  activity: ActivityEvent[];
  expiring: SlotView[];
  roster: ContractorRow[];
}

export interface QueueView {
  reviews: SlotView[];
  exceptions: SlotView[];
  applications: ContractorRow[];
  /** Your subcontractors' submissions for your clients, waiting for your check before the client sees them. */
  flow_down: SlotView[];
}

export interface AssignmentDetail {
  slot: SlotView;
  contractor: Contractor;
  client: OrgSummary;
  /** Which side the viewer is on for this item. */
  viewer: 'client' | 'contractor' | 'sponsor';
  worker: Worker | null;
  latest: Requirement | null;
  source_names: string[];
}

export interface RequirementRow extends Requirement {
  in_use: number;
  contractors: number;
  group_names: string[];
}

export interface GroupRow extends RequirementGroup {
  contractors: number;
  site_names: string[];
}

export interface SiteRow extends Site {
  contractors: { id: string; name: string; status: ContractorStatus }[];
  workers_total: number;
  workers_clear: number;
  group_names: string[];
}

export interface GateEntry {
  worker: Worker;
  contractor: Contractor;
  clear: boolean;
  reasons: string[];
}

export interface GateLogEntry extends CheckIn {
  worker_name: string | null;
  contractor_name: string | null;
}

export interface GateResult {
  result: 'CLEAR' | 'BLOCKED';
  reasons: string[];
  worker: Worker | null;
  contractor: Contractor | null;
  site: Site;
  checkin: CheckIn;
}

export interface SweepSummary {
  reminders: number;
  expired: number;
  renewals: number;
}

export interface ClockInfo {
  today: string;
  offset_days: number;
  summary?: SweepSummary;
}

/** A demo login: one member of one organization, with what that organization does. */
export interface Persona {
  member_id: string;
  name: string;
  title: string;
  org_id: string;
  org_name: string;
  runs_program: boolean;
  contractors: number;
  clients: number;
  is_ehs: boolean;
}

export type Session = { member_id: string };

export interface ClientLink {
  id: string;
  client: OrgSummary;
  status: ContractorStatus;
  open_items: number;
  sponsor_name: string | null;
}

/** Who is signed in and which sides of the product their organization uses. Drives the navigation. */
export interface SessionContext {
  member: Member;
  org: Organization;
  program: { enabled: boolean; contractors: number; waiting: number; subscription: SubscriptionStatus };
  clients: ClientLink[];
  /** Signed in as EHSSoftware.io staff. */
  is_ehs: boolean;
}

/** One customer in the EHSSoftware.io subscription list. */
export interface EhsAccount {
  id: string;
  name: string;
  trade: string;
  contact: ContactInfo;
  subscription: SubscriptionStatus;
  requested_at?: string | null;
  requested_by?: string;
  since?: string | null;
  contractors: number;
  clients: number;
  workers: number;
}

/** A client, as the contractor sees the relationship. */
export interface ClientRow {
  id: string;
  client: OrgSummary;
  status: ContractorStatus;
  status_note?: string;
  company_score: Score;
  worker_score: Score;
  open_items: number;
  waiting_on_client: number;
  expired: number;
  crew: number;
  site_names: string[];
  invited_at: string;
  profile_submitted_at?: string | null;
  sponsor_name: string | null;
  subcontractors: number;
  /** Added and kept by you, for a client that doesn't use EZForm. */
  self_managed: boolean;
}

export interface PortalOverview {
  org: Organization;
  clients: ClientRow[];
  /** Everything that needs the contractor's action, across all clients. */
  action: SlotView[];
}

export interface Deployment {
  relationship_id: string;
  client: OrgSummary;
  status: ContractorStatus;
  on_crew: boolean;
  score: Score | null;
  clear: boolean | null;
  reasons: string[];
  open_items: number;
  slots: SlotView[];
}

/** A worker on the company roster, with where they're deployed. */
export interface RosterWorker extends Worker {
  deployments: Deployment[];
}

export interface RosterView {
  org: Organization;
  workers: RosterWorker[];
  /** One entry per client relationship: id is the relationship, name the client. */
  clients: { id: string; name: string; status: ContractorStatus }[];
}

/** A document the same company already had approved by another client, offered for reuse. */
export interface ReusableDocument {
  assignment_id: string;
  client_name: string;
  title: string;
  same_title: boolean;
  approved_at: string;
  evidence: Extract<Evidence, { kind: 'DOCUMENT' }>;
}

/** One of the sponsor's own approved contractors it could bring onto a client's work. */
export interface SubcontractorOption {
  program_relationship_id: string;
  org_id: string;
  name: string;
  trade: string;
  crew: number;
  /** Why it can't be brought in, if it can't. */
  blocked: string | null;
}

/** A company found in the directory when a client adds a contractor. */
export interface OrgMatch {
  id: string;
  name: string;
  trade: string;
  contact_name: string;
  contact_email: string;
  runs_program: boolean;
}
