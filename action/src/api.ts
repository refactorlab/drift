import type { ProfileReport } from './profile';

export type ScanResponse = {
  id: number;
  url: string;
  verdict: 'pass' | 'regression' | 'error';
  verdictSub: string;
  p95LatencyMs: number;
  p95BaselineMs: number;
  cpuPct: number;
  cpuBaselinePct: number;
  dbQueries: number;
  dbNPlusOne: number;
  cacheHitRate: number;
  issues: Array<{
    severity: 'high' | 'medium' | 'low';
    title: string;
    filePath: string;
    lineNumber?: number;
    impactMs: number;
    problem?: string;
  }>;
};

export type IngestPayload = {
  repo: { owner: string; name: string };
  pr: {
    number: number;
    title: string;
    branch: string;
    baseBranch: string;
    author: string;
    url: string;
    headSha: string;
  };
  baselineRef: string;
  report: ProfileReport;
};

export async function uploadScan(
  apiUrl: string,
  apiToken: string,
  payload: IngestPayload,
): Promise<ScanResponse> {
  const url = `${apiUrl.replace(/\/$/, '')}/api/ingest/scans`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiToken ? { authorization: `Bearer ${apiToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drift ingest failed (${res.status}): ${body}`);
  }
  return (await res.json()) as ScanResponse;
}
