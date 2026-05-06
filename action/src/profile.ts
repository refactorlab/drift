import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { info } from './core.ts';

export type Issue = {
  severity: 'high' | 'medium' | 'low';
  title: string;
  filePath: string;
  lineNumber?: number;
  category?: string;
  impactMs: number;
  problem?: string;
  codeBefore?: string;
  codeAfter?: string;
};

export type ProfileReport = {
  p95LatencyMs: number;
  cpuPct: number;
  dbQueries: number;
  dbNPlusOne: number;
  cacheHitRate: number;
  issues: Issue[];
  flame?: unknown;
  raw?: unknown;
};

export async function runProfile(command: string): Promise<ProfileReport> {
  const dir = mkdtempSync(join(tmpdir(), 'drift-'));
  const reportPath = join(dir, 'report.json');

  info(`> ${command}`);
  const res = spawnSync(command, {
    shell: true,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, DRIFT_REPORT_PATH: reportPath },
  });

  if (res.status !== 0) {
    throw new Error(`Profile command exited with status ${res.status}`);
  }

  const raw = readFileSync(reportPath, 'utf8');
  const parsed = JSON.parse(raw) as ProfileReport;

  if (typeof parsed.p95LatencyMs !== 'number') {
    throw new Error('Profile report missing required field "p95LatencyMs"');
  }
  return parsed;
}
