'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addToast } from '@heroui/toast';
import { apiDelete, apiGet, apiPost, errorMessage } from '@/api/client';
import type {
  CheckInRow,
  ClockInfo,
  CompanyMatch,
  HomeView,
  LinkDetail,
  LinkRow,
  PeopleView,
  Persona,
  RequirementFor,
  RequirementRow,
  SessionContext,
  StoredFile,
  UploadStatus,
} from '@/lib/types';

export const ROOT = 'ezc';

// Queries ------------------------------------------------------------------

export const useClock = () => useQuery({ queryKey: [ROOT, 'clock'], queryFn: () => apiGet<ClockInfo>('Demo/GetClock') });
export const usePersonas = () => useQuery({ queryKey: [ROOT, 'personas'], queryFn: () => apiGet<Persona[]>('Demo/GetPersonas') });
export const useSessionContext = (enabled = true) =>
  useQuery({ queryKey: [ROOT, 'session'], queryFn: () => apiGet<SessionContext>('Session/GetContext'), enabled });
export const useHome = () => useQuery({ queryKey: [ROOT, 'home'], queryFn: () => apiGet<HomeView>('Home/Get') });

export const useContractors = () => useQuery({ queryKey: [ROOT, 'contractors'], queryFn: () => apiGet<LinkRow[]>('Contractor/GetList') });
export const useContractor = (id?: string) =>
  useQuery({ queryKey: [ROOT, 'contractor', id], queryFn: () => apiGet<LinkDetail>('Contractor/Get', { id }), enabled: !!id });
export const useCompanySearch = (q: string) =>
  useQuery({ queryKey: [ROOT, 'company-search', q], queryFn: () => apiGet<CompanyMatch[]>('Contractor/Search', { q }), enabled: q.trim().length >= 2 });
export const useRequirements = () => useQuery({ queryKey: [ROOT, 'requirements'], queryFn: () => apiGet<RequirementRow[]>('Requirement/GetList') });
export const useCheckIn = () => useQuery({ queryKey: [ROOT, 'checkin'], queryFn: () => apiGet<CheckInRow[]>('CheckIn/GetList') });

export const useClients = () => useQuery({ queryKey: [ROOT, 'clients'], queryFn: () => apiGet<LinkRow[]>('Client/GetList') });
export const useClient = (id?: string) =>
  useQuery({ queryKey: [ROOT, 'client', id], queryFn: () => apiGet<LinkDetail>('Client/Get', { id }), enabled: !!id });
export const usePeople = () => useQuery({ queryKey: [ROOT, 'people'], queryFn: () => apiGet<PeopleView>('Person/GetList') });

// Mutations ----------------------------------------------------------------

/** Runs an API call, refreshes every query, and toasts the outcome. */
export function useAction<TVars, TRes = unknown>(fn: (vars: TVars) => Promise<TRes>, success?: string | ((res: TRes, vars: TVars) => string | null | undefined)) {
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

export interface RequirementInput {
  id?: string;
  /** For a client you track yourself. */
  link_id?: string;
  title: string;
  for: RequirementFor;
  has_expiry: boolean;
  hint: string;
}

export interface NewContractorInput {
  /** A company already on EZForm; otherwise a new one is created from the fields below. */
  company_id?: string;
  name?: string;
  trade?: string;
  contact_name?: string;
  email?: string;
}

export interface NewClientInput {
  name: string;
  trade?: string;
  requirements: Omit<RequirementInput, 'id' | 'link_id'>[];
}

export interface UploadInput {
  link_id: string;
  requirement_id: string;
  person_id: string | null;
  file: StoredFile;
  expires_at: string | null;
}

export const Api = {
  advanceClock: (days: number) => apiPost<ClockInfo>('Demo/AdvanceClock', { days }),
  resetDemo: () => apiPost<{ ok: boolean }>('Demo/Reset'),

  createContractor: (b: NewContractorInput) => apiPost<{ id: string; existing: boolean }>('Contractor/Create', b),
  review: (b: { id: string; decision: 'APPROVED' | 'REJECTED'; note?: string }) => apiPost<{ status: UploadStatus }>('Upload/Review', b),

  saveRequirement: (b: RequirementInput) => apiPost<{ id: string }>('Requirement/Save', b),
  deleteRequirement: (id: string) => apiDelete<{ ok: boolean }>('Requirement/Delete', { id }),

  createClient: (b: NewClientInput) => apiPost<{ id: string }>('Client/Create', b),
  upload: (b: UploadInput) => apiPost<{ status: UploadStatus }>('Upload/Create', b),

  savePerson: (b: { id?: string; name: string; job: string }) => apiPost<{ id: string; badge_id: string }>('Person/Save', b),
  deletePerson: (id: string) => apiDelete<{ ok: boolean }>('Person/Delete', { id }),
};
