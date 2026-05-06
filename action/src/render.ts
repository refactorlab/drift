import type { ScanResponse } from './api.ts';

export const ANNOTATION_LEVEL = {
  high: 'failure',
  medium: 'warning',
  low: 'notice',
} as const;

export const STICKY_MARKER = '<!-- drift:sticky-comment -->';

export function annotationLevel(severity: 'high' | 'medium' | 'low'): 'failure' | 'warning' | 'notice' {
  return ANNOTATION_LEVEL[severity] ?? 'notice';
}

export function checkConclusion(
  verdict: ScanResponse['verdict'],
): 'success' | 'failure' | 'neutral' {
  if (verdict === 'regression') return 'failure';
  if (verdict === 'error') return 'neutral';
  return 'success';
}

export function shouldFail(
  verdict: ScanResponse['verdict'],
  failOn: 'never' | 'regression' | 'any',
): boolean {
  if (failOn === 'any') return verdict !== 'pass';
  if (failOn === 'regression') return verdict === 'regression';
  return false;
}

export function checkTitle(scan: ScanResponse): string {
  if (scan.verdict === 'pass') return `OK · p95 ${scan.p95LatencyMs}ms`;
  if (scan.verdict === 'regression') {
    const delta = scan.p95LatencyMs - scan.p95BaselineMs;
    return `Regression · p95 +${delta}ms vs baseline`;
  }
  return 'Drift could not complete';
}

export function checkSummary(scan: ScanResponse): string {
  const top = scan.issues
    .slice(0, 10)
    .map(
      (i) =>
        `- **${i.severity}** \`${i.filePath}${i.lineNumber ? `:${i.lineNumber}` : ''}\` — ${i.title} (+${i.impactMs}ms)`,
    )
    .join('\n');

  return [
    `**Verdict:** ${scan.verdict} — ${scan.verdictSub}`,
    '',
    '| metric | this PR | baseline |',
    '|---|---:|---:|',
    `| p95 latency | ${scan.p95LatencyMs}ms | ${scan.p95BaselineMs}ms |`,
    `| CPU | ${scan.cpuPct}% | ${scan.cpuBaselinePct}% |`,
    `| DB queries | ${scan.dbQueries} | — |`,
    `| N+1 queries | ${scan.dbNPlusOne} | — |`,
    `| Cache hit rate | ${scan.cacheHitRate}% | — |`,
    '',
    top ? '### Top issues' : '',
    top,
    '',
    `[Open full report →](${scan.url})`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function commentBody(scan: ScanResponse): string {
  const emoji =
    scan.verdict === 'pass' ? '🟢' : scan.verdict === 'regression' ? '🔴' : '⚪';
  const delta = scan.p95LatencyMs - scan.p95BaselineMs;
  const deltaStr = delta >= 0 ? `+${delta}ms` : `${delta}ms`;

  const issues = scan.issues
    .slice(0, 5)
    .map(
      (i) =>
        `- **${i.severity}** \`${i.filePath}${i.lineNumber ? `:${i.lineNumber}` : ''}\` — ${i.title} (+${i.impactMs}ms)`,
    )
    .join('\n');

  return [
    STICKY_MARKER,
    `## ${emoji} Drift performance scan`,
    `**${scan.verdict.toUpperCase()}** — ${scan.verdictSub}`,
    '',
    `| metric | this PR | baseline | delta |`,
    `|---|---:|---:|---:|`,
    `| p95 latency | ${scan.p95LatencyMs}ms | ${scan.p95BaselineMs}ms | ${deltaStr} |`,
    `| CPU | ${scan.cpuPct}% | ${scan.cpuBaselinePct}% | — |`,
    `| DB queries | ${scan.dbQueries} | — | — |`,
    `| N+1 | ${scan.dbNPlusOne} | — | — |`,
    `| Cache hit rate | ${scan.cacheHitRate}% | — | — |`,
    '',
    issues ? '### Top hotspots' : '',
    issues,
    '',
    `[Open full report →](${scan.url})`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function annotationsFor(scan: ScanResponse) {
  return scan.issues.slice(0, 50).map((issue) => ({
    path: issue.filePath,
    start_line: issue.lineNumber ?? 1,
    end_line: issue.lineNumber ?? 1,
    annotation_level: annotationLevel(issue.severity),
    title: issue.title,
    message: `${issue.problem ?? issue.title}\n+${issue.impactMs}ms`,
  }));
}
