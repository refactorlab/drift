import type {
  ScanResponse, ScanListItem, ImprovementsResponse,
  ArchitectureSuggestion, RepoListItem, DepartmentListItem, DashboardResponse,
} from './types';

class UnauthorizedError extends Error {
  constructor() { super('unauthenticated'); }
}

let onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401) {
    onUnauthorized?.();
    throw new UnauthorizedError();
  }
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed (${res.status})`);
  }
  return res.json();
}

const get = <T>(path: string) => request<T>(path);
const send = <T>(path: string, method: string, body?: unknown) =>
  request<T>(path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });

export const fetchDashboard = () => get<DashboardResponse>('/api/dashboard');
export const fetchScansList = () => get<ScanListItem[]>('/api/scans');
export const fetchScan = (prNumber: number) =>
  get<ScanResponse>(`/api/scans/${prNumber}`);
export const fetchImprovements = () => get<ImprovementsResponse>('/api/improvements');
export const fetchArchitectureSuggestions = () =>
  get<ArchitectureSuggestion[]>('/api/architecture-suggestions');
export const fetchRepos = () => get<RepoListItem[]>('/api/repos');
export const fetchDepartments = () => get<DepartmentListItem[]>('/api/departments');

export const triggerAutofix = (prNumber: number) =>
  send<{ ok: boolean; message: string; estimatedSavingsMs: number; fixPrNumber: number }>(
    `/api/scans/${prNumber}/autofix`,
    'POST',
  );

export const updatePR = (
  id: number,
  body: { businessValue?: number; hoursSaved?: number; improvement?: string; status?: string },
) => send(`/api/prs/${id}`, 'PATCH', body);
