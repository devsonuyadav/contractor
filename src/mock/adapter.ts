// axios adapter that answers requests from the in-browser demo API instead of the network.
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { Session } from '@/lib/types';
import { HttpError } from './logic';
import { handle } from './server';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  await wait(80 + Math.random() * 140);
  const method = (config.method ?? 'get').toUpperCase();
  const path = (config.url ?? '').replace(/^\/+/, '').split('?')[0];

  let body: unknown = config.data;
  if (typeof body === 'string' && body.length) {
    try {
      body = JSON.parse(body);
    } catch {
      // leave non-JSON bodies as they are
    }
  }

  let actor: Session | null = null;
  const rawActor = config.headers?.get?.('X-Demo-Actor');
  if (typeof rawActor === 'string') {
    try {
      actor = JSON.parse(rawActor) as Session;
    } catch {
      actor = null;
    }
  }

  try {
    const data = handle(method, path, (config.params ?? {}) as Record<string, unknown>, (body ?? {}) as Record<string, unknown>, actor);
    return { data: { data, message: 'OK' }, status: 200, statusText: 'OK', headers: {}, config };
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : 'Unexpected error';
    if (!(e instanceof HttpError)) console.error('[demo api]', method, path, e);
    const response: AxiosResponse = { data: { message }, status, statusText: 'Error', headers: {}, config };
    throw new AxiosError(message, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, null, response);
  }
};
