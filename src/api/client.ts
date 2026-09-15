import axios, { AxiosError } from 'axios';
import { mockAdapter } from '@/mock/adapter';
import { readSession } from '@/session/storage';

// Until the ezformsapi controllers exist, requests are answered in the browser.
// Set NEXT_PUBLIC_USE_MOCK_API=false to send them to NEXT_PUBLIC_API_BASE_URL instead.
export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API !== 'false';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '/ezformsapi/api/v1/',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
  ...(USE_MOCK_API ? { adapter: mockAdapter } : {}),
});

api.interceptors.request.use((config) => {
  if (USE_MOCK_API) {
    const session = readSession();
    if (session) config.headers.set('X-Demo-Actor', JSON.stringify(session));
  } else if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_AUTH_TOKEN) {
    // Same convention as the other EZForm apps: the token header is a dev-only stand-in for the host cookie.
    config.headers.set('AuthToken', process.env.NEXT_PUBLIC_AUTH_TOKEN);
  }
  if (config.method?.toLowerCase() === 'get') {
    config.headers.set('Cache-Control', 'no-cache');
    config.headers.set('Pragma', 'no-cache');
  }
  return config;
});

interface Envelope<T> {
  data: T;
  message?: string;
}

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await api.get<Envelope<T>>(url, { params });
  return res.data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.post<Envelope<T>>(url, body ?? {});
  return res.data.data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.put<Envelope<T>>(url, body ?? {});
  return res.data.data;
}

export async function apiDelete<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await api.delete<Envelope<T>>(url, { params });
  return res.data.data;
}

export function errorMessage(e: unknown): string {
  if (e instanceof AxiosError) {
    const msg = (e.response?.data as { message?: string } | undefined)?.message;
    return msg || e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}
