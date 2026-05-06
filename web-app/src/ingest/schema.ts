import { z } from 'zod';

export const IssueSchema = z.object({
  severity: z.enum(['high', 'medium', 'low']),
  title: z.string(),
  filePath: z.string(),
  lineNumber: z.number().int().optional(),
  category: z.string().optional(),
  impactMs: z.number().int().nonnegative(),
  problem: z.string().optional(),
  codeBefore: z.string().optional(),
  codeAfter: z.string().optional(),
});

export const ScanIngestSchema = z.object({
  repo: z.object({ owner: z.string(), name: z.string() }),
  pr: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    branch: z.string(),
    baseBranch: z.string(),
    author: z.string(),
    url: z.string().url(),
    headSha: z.string(),
  }),
  baselineRef: z.string(),
  report: z.object({
    p95LatencyMs: z.number().int().nonnegative(),
    cpuPct: z.number().int().min(0).max(100).default(0),
    dbQueries: z.number().int().nonnegative().default(0),
    dbNPlusOne: z.number().int().nonnegative().default(0),
    cacheHitRate: z.number().int().min(0).max(100).default(0),
    issues: z.array(IssueSchema).default([]),
  }),
});

export type ScanIngestPayload = z.infer<typeof ScanIngestSchema>;

export function authorizeBearer(
  authHeader: string | undefined,
  expected: string | undefined,
): boolean {
  if (!expected) return true; // open in dev when unset
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return false;
  return authHeader.slice(7).trim() === expected;
}

export type Verdict = 'pass' | 'regression' | 'error';

export function computeVerdict(p95: number, baseline: number): {
  verdict: Verdict;
  verdictSub: string;
} {
  const threshold = Math.round(baseline * 1.1);
  if (p95 > threshold) {
    return {
      verdict: 'regression',
      verdictSub: `p95 ${p95}ms is +${p95 - baseline}ms vs baseline`,
    };
  }
  return {
    verdict: 'pass',
    verdictSub: `p95 ${p95}ms within tolerance`,
  };
}
