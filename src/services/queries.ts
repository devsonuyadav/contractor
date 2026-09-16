'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addToast } from '@heroui/toast';
import { apiDelete, apiGet, apiPost, apiPut, errorMessage } from '@/api/client';
import type {
  ActivityEvent,
  AssignmentDetail,
  ClockInfo,
  ContactInfo,
  ContractorDetail,
  ContractorRow,
  ContractorStatus,
  DashboardSummary,
  EhsAccount,
  Evidence,
  GateEntry,
  GateLogEntry,
  GateResult,
  GroupRow,
  InboxEmail,
  OrgMatch,
  OutboxEmail,
  Persona,
  PortalOverview,
  QueueView,
  RequirementContent,
  RequirementRow,
  ReusableDocument,
  RosterView,
  SessionContext,
  SiteRow,
  SubcontractorOption,
  SubscriptionStatus,
} from '@/lib/types';

export const ROOT = 'ezc';

// Queries ------------------------------------------------------------------

export const useClock = () => useQuery({ queryKey: [ROOT, 'clock'], queryFn: () => apiGet<ClockInfo>('Demo/GetClock') });
export const usePersonas = () => useQuery({ queryKey: [ROOT, 'personas'], queryFn: () => apiGet<Persona[]>('Demo/GetPersonas') });
/** Who is signed in, and which sides of the product their company uses. */
export const useSessionContext = (enabled = true) =>
  useQuery({ queryKey: [ROOT, 'session'], queryFn: () => apiGet<SessionContext>('Session/GetContext'), enabled });
export const useDashboard = () => useQuery({ queryKey: [ROOT, 'dashboard'], queryFn: () => apiGet<DashboardSummary>('Dashboard/GetSummary') });
export const useContractors = () => useQuery({ queryKey: [ROOT, 'contractors'], queryFn: () => apiGet<ContractorRow[]>('Contractor/GetList') });
export const useContractor = (id?: string) =>
  useQuery({ queryKey: [ROOT, 'contractor', id], queryFn: () => apiGet<ContractorDetail>('Contractor/Get', { id }), enabled: !!id });
export const useOrgSearch = (q: string) =>
  useQuery({ queryKey: [ROOT, 'org-search', q], queryFn: () => apiGet<OrgMatch[]>('Org/Search', { q }), enabled: q.trim().length >= 2 });
export const usePortalOverview = () => useQuery({ queryKey: [ROOT, 'portal-overview'], queryFn: () => apiGet<PortalOverview>('Portal/GetOverview') });
export const useClientChecklist = (id?: string) =>
  useQuery({ queryKey: [ROOT, 'portal-client', id], queryFn: () => apiGet<ContractorDetail>('Portal/GetClient', { id }), enabled: !!id });
export const useSubcontractorOptions = (id?: string, enabled = true) =>
  useQuery({ queryKey: [ROOT, 'sub-options', id], queryFn: () => apiGet<SubcontractorOption[]>('Portal/GetSubcontractorOptions', { id }), enabled: !!id && enabled });
export const useInbox = () => useQuery({ queryKey: [ROOT, 'inbox'], queryFn: () => apiGet<InboxEmail[]>('Portal/GetInbox') });
export const useRoster = () => useQuery({ queryKey: [ROOT, 'roster'], queryFn: () => apiGet<RosterView>('Worker/GetRoster') });
export const useQueue = (enabled = true) => useQuery({ queryKey: [ROOT, 'queue'], queryFn: () => apiGet<QueueView>('Assignment/GetQueue'), enabled });
export const useAssignment = (id?: string | null) =>
  useQuery({ queryKey: [ROOT, 'assignment', id], queryFn: () => apiGet<AssignmentDetail>('Assignment/Get', { id }), enabled: !!id });
export const useReusable = (id?: string, enabled = true) =>
  useQuery({ queryKey: [ROOT, 'reusable', id], queryFn: () => apiGet<ReusableDocument[]>('Assignment/GetReusable', { id }), enabled: !!id && enabled });
export const useRequirements = () => useQuery({ queryKey: [ROOT, 'requirements'], queryFn: () => apiGet<RequirementRow[]>('ComplianceRequirement/GetList') });
export const useGroups = () => useQuery({ queryKey: [ROOT, 'groups'], queryFn: () => apiGet<GroupRow[]>('RequirementGroup/GetList') });
export const useSites = () => useQuery({ queryKey: [ROOT, 'sites'], queryFn: () => apiGet<SiteRow[]>('Site/GetList') });
export const useActivity = (contractorId?: string) =>
  useQuery({ queryKey: [ROOT, 'activity', contractorId ?? 'all'], queryFn: () => apiGet<ActivityEvent[]>('ComplianceActivity/GetList', { contractor_id: contractorId, limit: 120 }) });
export const useEhsAccounts = () => useQuery({ queryKey: [ROOT, 'ehs-accounts'], queryFn: () => apiGet<EhsAccount[]>('Ehs/GetAccounts') });
export const useOutbox = () => useQuery({ queryKey: [ROOT, 'outbox'], queryFn: () => apiGet<OutboxEmail[]>('Notification/GetOutbox') });
export const useGateRoster = (siteId?: string) =>
  useQuery({ queryKey: [ROOT, 'gate-roster', siteId], queryFn: () => apiGet<GateEntry[]>('Gate/GetRoster', { site_id: siteId }), enabled: !!siteId });
export const useGateLog = (siteId?: string) =>
  useQuery({ queryKey: [ROOT, 'gate-log', siteId ?? 'all'], queryFn: () => apiGet<GateLogEntry[]>('Gate/GetLog', { site_id: siteId }) });

// Mutations ----------------------------------------------------------------

/** Runs an API call, refreshes every query, and toasts the outcome. */
export function useAction<TVars, TRes = unknown>(
  fn: (vars: TVars) => Promise<TRes>,
  success?: string | ((res: TRes, vars: TVars) => string | null | undefined),
) {
  const qc = useQueryClient();
  return useMutation<TRes, unknown, TVars>({
    mutationFn: fn,
    onSuccess: async (res, vars) => {
      await qc.invalidateQueries({ queryKey: [ROOT] });
      const msg = typeof success === 'function' ? success(res, vars) : success;
      if (msg) addToast({ title: msg, color: 'success' });
    },
    onError: (e) => {
      addToast({ title: "That didn't work", description: errorMessage(e), color: 'danger' });
    },
  });
}

export interface NewContractorInput {
  /** Set to add a company that's already on EZForm; otherwise a new company is created from the fields below. */
  org_id?: string;
  name?: string;
  trade?: string;
  contact?: ContactInfo;
  site_ids: string[];
  group_ids: string[];
  tags: string[];
}

export interface ProfilePatch {
  name?: string;
  trade?: string;
  contact?: ContactInfo;
  address?: string;
  website?: string;
  license_no?: string;
  employees_count?: number | string;
}

export interface WorkerInput {
  /** Client side: add the worker to this contractor's crew for you. */
  relationship_id?: string;
  /** Contractor side: the client crews to put the new worker on. */
  crew_for?: string[];
  name: string;
  trade: string;
  email: string;
  phone: string;
}

export interface GroupInput {
  name: string;
  description: string;
  requirement_ids: string[];
}

export interface SiteInput {
  name: string;
  code: string;
  address: string;
  description: string;
  group_ids: string[];
}

export interface SyncResult {
  added: number;
  removed: number;
}

export const Api = {
  advanceClock: (days: number) => apiPost<ClockInfo>('Demo/AdvanceClock', { days }),
  resetDemo: () => apiPost<{ ok: boolean }>('Demo/Reset'),

  requestSubscription: () => apiPost<{ status: SubscriptionStatus }>('Org/RequestSubscription'),
  setSubscription: (b: { org_id: string; active: boolean }) => apiPost<{ status: SubscriptionStatus; requirements: number }>('Ehs/SetSubscription', b),
  updateProfile: (b: ProfilePatch) => apiPut<{ id: string }>('Org/Update', b),

  createContractor: (b: NewContractorInput) => apiPost<{ id: string; added: number; existing: boolean }>('Contractor/Create', b),
  tagContractor: (b: { id: string; tags: string[] }) => apiPut<{ id: string }>('Contractor/Update', b),
  setStatus: (b: { id: string; status: ContractorStatus; note?: string }) => apiPut<{ id: string }>('Contractor/SetStatus', b),
  assignGroups: (b: { contractor_id: string; group_ids: string[] }) => apiPost<SyncResult>('Contractor/AssignGroups', b),
  assignSites: (b: { contractor_id: string; site_ids: string[] }) => apiPost<SyncResult>('Contractor/AssignSites', b),
  submitApplication: (id: string) => apiPost<{ id: string }>('Portal/SubmitApplication', { id }),
  sponsorSubcontractor: (b: { id: string; program_relationship_id: string; site_ids: string[] }) => apiPost<{ id: string; added: number }>('Portal/SponsorSubcontractor', b),

  createWorker: (b: WorkerInput) => apiPost<{ id: string; badge_id: string; added: number }>('Worker/Create', b),
  updateWorker: (b: WorkerInput & { id: string }) => apiPut<{ id: string }>('Worker/Update', b),
  setWorkerActive: (b: { id: string; active: boolean }) => apiPut<SyncResult & { id: string }>('Worker/SetActive', b),
  setCrew: (b: { relationship_id: string; worker_id: string; on_crew: boolean }) => apiPut<SyncResult>('Worker/SetCrew', b),

  createRequirement: (b: RequirementContent) => apiPost<{ id: string }>('ComplianceRequirement/Create', b),
  updateRequirement: (b: RequirementContent & { id: string }) =>
    apiPut<{ version: number; changed: boolean; updated_now: number; pinned: number }>('ComplianceRequirement/Update', b),
  retireRequirement: (id: string) => apiPut<SyncResult>('ComplianceRequirement/Retire', { id }),
  restoreRequirement: (id: string) => apiPut<SyncResult>('ComplianceRequirement/Restore', { id }),
  deleteRequirement: (id: string) => apiDelete<{ ok: boolean }>('ComplianceRequirement/Delete', { id }),

  createGroup: (b: GroupInput) => apiPost<{ id: string }>('RequirementGroup/Create', b),
  updateGroup: (b: GroupInput & { id: string }) => apiPut<SyncResult>('RequirementGroup/Update', b),
  cloneGroup: (id: string) => apiPost<{ id: string }>('RequirementGroup/Clone', { id }),
  deleteGroup: (id: string) => apiDelete<{ ok: boolean }>('RequirementGroup/Delete', { id }),

  createSite: (b: SiteInput) => apiPost<{ id: string }>('Site/Create', b),
  updateSite: (b: SiteInput & { id: string }) => apiPut<SyncResult>('Site/Update', b),

  submit: (b: { id: string; evidence?: Evidence; reuse_assignment_id?: string }) =>
    apiPost<{ auto_approved: boolean; expires_at: string | null; sponsor: string | null }>('Assignment/Submit', b),
  sponsorCheck: (b: { id: string; decision: 'Passed' | 'Rejected'; note?: string }) => apiPost<{ state: string }>('Assignment/SponsorCheck', b),
  review: (b: { id: string; decision: 'Approved' | 'Rejected'; note?: string }) => apiPost<{ state: string }>('Assignment/Review', b),
  requestException: (b: { id: string; reason: string; until: string }) => apiPost<{ ok: boolean }>('Assignment/RequestException', b),
  decideException: (b: { id: string; decision: 'Approved' | 'Denied'; note?: string; until?: string }) =>
    apiPost<{ state: string }>('Assignment/DecideException', b),

  gateCheckIn: (b: { site_id: string; badge_id: string }) => apiPost<GateResult>('Gate/CheckIn', b),
};
