import type {
  CreateDreamRequest,
  CreateOfferingRequest,
  Dream,
  EnterRequest,
  EnterResponse,
  InboxItem,
  KnockRequest,
  KnockResponse,
  MeResponse,
  MyDreamItem,
  Offering,
  PatchEpitaphRequest,
  PulseRequest,
  PulseResponse,
  ResurrectCodeResponse,
  ResurrectRequest,
  ResurrectResponse,
  SaveTombRequest,
  SaveTombResponse,
  TombDetail,
  TombListItem,
  ZhashiResponse,
} from './types';

export const TOKEN_KEY = 'afterme:token';
export const DEFAULT_ERROR = '阴间服务器开小差了，请稍后再试。';

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token == null) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearToken() {
  setToken(null);
}

function messageFromBody(body: unknown, fallback = DEFAULT_ERROR): string {
  if (body && typeof body === 'object') {
    const m = (body as { message?: unknown; error?: unknown }).message
      ?? (body as { message?: unknown; error?: unknown }).error;
    if (typeof m === 'string' && m.trim()) return m;
  }
  return fallback;
}

type RequestOpts = {
  auth?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
};

function buildUrl(path: string, query?: RequestOpts['query']): string {
  const base = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v == null) continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

async function request<T>(method: string, path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  const auth = opts.auth !== false;
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(DEFAULT_ERROR, 0);
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (res.status === 401) {
    clearToken();
    throw new ApiError(messageFromBody(body, DEFAULT_ERROR), 401, body);
  }

  if (!res.ok) {
    throw new ApiError(messageFromBody(body, DEFAULT_ERROR), res.status, body);
  }

  return body as T;
}

export function get<T>(path: string, opts?: Omit<RequestOpts, 'body'>) {
  return request<T>('GET', path, opts);
}

export function post<T>(path: string, body?: unknown, opts?: Omit<RequestOpts, 'body'>) {
  return request<T>('POST', path, { ...opts, body });
}

export function patch<T>(path: string, body?: unknown, opts?: Omit<RequestOpts, 'body'>) {
  return request<T>('PATCH', path, { ...opts, body });
}

/* ---------- typed endpoint helpers (REFACTOR §8) ---------- */

export function enter(data: EnterRequest) {
  return post<EnterResponse>('/enter', data, { auth: false });
}

export function me(timezone?: string) {
  return get<MeResponse>('/me', { query: { timezone } });
}

export function resurrect(data: ResurrectRequest) {
  return post<ResurrectResponse>('/resurrect', data, { auth: false });
}

export async function listTombs() {
  const res = await get<{ tombs: TombListItem[] }>('/tombs');
  return res.tombs ?? [];
}

export async function getTomb(code: string) {
  const res = await get<{ tomb: TombDetail }>(`/tombs/${encodeURIComponent(code)}`);
  return res.tomb;
}

export function saveTomb(data: SaveTombRequest) {
  return post<SaveTombResponse>('/me/tomb', data);
}

export async function patchEpitaph(data: PatchEpitaphRequest) {
  const res = await patch<{ tomb: TombDetail }>('/me/tomb/epitaph', data);
  return res;
}

export function zhashi() {
  return post<ZhashiResponse>('/me/tomb/zhashi');
}

export function knock(data: KnockRequest) {
  return post<KnockResponse>('/me/tomb/knock', data);
}

export function regenerateResurrectCode() {
  return post<ResurrectCodeResponse>('/me/resurrect-code');
}

export async function createOffering(code: string, data: CreateOfferingRequest) {
  const res = await post<{ offering: Offering }>(
    `/tombs/${encodeURIComponent(code)}/offerings`,
    data,
  );
  return res.offering;
}

export async function inbox() {
  const res = await get<{ offerings: InboxItem[] }>('/me/inbox');
  return res.offerings ?? [];
}

export async function createDream(offeringId: number, data: CreateDreamRequest) {
  const res = await post<{ dream: Dream }>(`/offerings/${offeringId}/dream`, data);
  return res.dream;
}

export async function myDreams(): Promise<MyDreamItem[]> {
  const res = await get<{
    offerings: Array<
      Offering & {
        tomb?: { id: number; code: string; name: string; is_npc?: boolean } | null;
        dream?: Dream | null;
      }
    >;
  }>('/me/dreams');
  return (res.offerings ?? []).map((o) => {
    const dream = o.dream
      ? {
          ...o.dream,
          tomb_name: o.dream.tomb_name ?? o.tomb?.name,
          tomb_code: o.dream.tomb_code ?? o.tomb?.code,
        }
      : null;
    return { offering: o, dream };
  });
}

export async function markDreamRead(dreamId: number) {
  await post<{ dream: Dream }>(`/dreams/${dreamId}/read`);
  return { ok: true as const };
}

export function pulse(data: PulseRequest) {
  return post<PulseResponse>('/pulse', data);
}
