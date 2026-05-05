import type { ScanResponse } from './types';

export async function fetchScan(prNumber: number): Promise<ScanResponse> {
  const res = await fetch(`/api/scans/${prNumber}`);
  if (!res.ok) throw new Error(`Failed to fetch scan (${res.status})`);
  return res.json();
}

export async function triggerAutofix(prNumber: number): Promise<{
  ok: boolean;
  message: string;
  estimatedSavingsMs: number;
  fixPrNumber: number;
}> {
  const res = await fetch(`/api/scans/${prNumber}/autofix`, { method: 'POST' });
  if (!res.ok) throw new Error(`Autofix failed (${res.status})`);
  return res.json();
}
