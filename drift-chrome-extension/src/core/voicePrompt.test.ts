import { describe, it, expect } from 'vitest';
import {
  serializeScan,
  serializeDiff,
  serializeReviewBrief,
  buildVoiceSystemPrompt,
  buildCallInstruction,
  isLowSignalPath,
  VOICE_DIFF_PER_FILE_CHARS,
  REFUSAL,
} from './voicePrompt';
import { emptyReport, type DriftReport, type Gauge, type PrContext } from './types';
import type { FileDiff } from './prDiff';
import type { ReviewBrief } from './scanOutput';

function gauge(key: string, display: string): Gauge {
  return { key, label: key, display, fraction: null, tone: 'info' };
}

function ctxWith(report: DriftReport): PrContext {
  return {
    pr: { owner: 'acme', repo: 'webapp', number: 142, title: 'Add billing retry', url: 'u' },
    report,
    artifacts: [],
    detectedAt: 0,
  };
}

function fullReport(): DriftReport {
  return {
    ...emptyReport(),
    found: true,
    verdict: 'address',
    verdictLabel: 'Address before merge',
    effortLabel: 'High risk · 60 min+ review',
    mergeConfidence: { value: 3, outOf: 5 },
    gauges: [gauge('drift', '+5.5%'), gauge('risks', '2'), gauge('suggestions', '4')],
    blastRadius: 100,
    criticalCount: 1,
    metricCount: 18,
    sections: [
      {
        index: 1,
        title: 'LLM Complexity',
        metrics: [
          { name: 'Token footprint', level: 'critical', percent: 90, direction: 'up' },
          { name: 'Nesting depth', level: 'low', percent: 10, direction: 'down' },
          { name: 'Coupling', level: 'moderate', percent: 50, direction: 'up' },
        ],
      },
    ],
  };
}

describe('serializeScan', () => {
  it('includes PR identity, verdict, confidence, headline gauges and critical counts', () => {
    const out = serializeScan(ctxWith(fullReport()));
    expect(out).toContain('PR: acme/webapp #142 — Add billing retry');
    expect(out).toContain('Verdict: Address before merge (High risk · 60 min+ review)');
    expect(out).toContain('Merge confidence: 3 out of 5');
    expect(out).toContain('Drift: +5.5%');
    expect(out).toContain('Risks: 2');
    expect(out).toContain('1 critical of 18 metrics | blast radius 100');
  });

  it('lists notable metrics worst-first and drops low-severity ones', () => {
    const out = serializeScan(ctxWith(fullReport()));
    const critIdx = out.indexOf('Token footprint');
    const modIdx = out.indexOf('Coupling');
    expect(critIdx).toBeGreaterThan(-1);
    expect(modIdx).toBeGreaterThan(critIdx); // critical before moderate
    expect(out).not.toContain('Nesting depth'); // low severity is dropped
  });

  it('degrades to PR-only when no report was found', () => {
    const out = serializeScan(ctxWith({ ...emptyReport(), found: false }));
    expect(out).toContain('PR: acme/webapp #142');
    expect(out).toContain('No scan report is available');
    expect(out).not.toContain('Verdict');
  });
});

function fileDiff(over: Partial<FileDiff> & Pick<FileDiff, 'path'>): FileDiff {
  return { status: 'M', additions: 0, deletions: 0, hunks: [], ...over };
}

function ctxWithDiff(files: FileDiff[], truncated = false): PrContext {
  return { ...ctxWith({ ...emptyReport(), found: true }), prDiff: { files, truncated } };
}

describe('serializeDiff', () => {
  const files = [
    fileDiff({
      path: 'src/billing.ts',
      status: 'M',
      additions: 12,
      deletions: 3,
      hunks: [
        {
          header: '@@ -1,3 +1,4 @@',
          lines: [
            { type: 'context', text: 'function charge() {' },
            { type: 'del', text: '  retry(1);' },
            { type: 'add', text: '  retry(3);' },
          ],
        },
      ],
    }),
    fileDiff({ path: 'README.md', status: 'A', additions: 40, deletions: 0 }),
    fileDiff({ path: 'old/util.ts', oldPath: 'old/util.ts', status: 'D', additions: 0, deletions: 9 }),
  ];

  it('lists changed files largest-first with status and line counts', () => {
    const out = serializeDiff(ctxWithDiff(files));
    expect(out).toContain('PR: acme/webapp #142 — Add billing retry');
    expect(out).toContain('3 changed file(s), +52 −12 lines');
    const readmeIdx = out.indexOf('README.md'); // 40 changes → first
    const billingIdx = out.indexOf('src/billing.ts'); // 15 changes → after
    expect(readmeIdx).toBeGreaterThan(-1);
    expect(billingIdx).toBeGreaterThan(readmeIdx);
    expect(out).toContain('(added, +40 −0)');
    expect(out).toContain('(deleted, +0 −9)');
  });

  it('embeds the literal +/- hunk lines', () => {
    const out = serializeDiff(ctxWithDiff(files));
    expect(out).toContain('--- src/billing.ts ---');
    expect(out).toContain('@@ -1,3 +1,4 @@');
    expect(out).toContain('+  retry(3);');
    expect(out).toContain('−  retry(1);');
  });

  it('flags a truncated diff and degrades when there is no diff', () => {
    expect(serializeDiff(ctxWithDiff(files, true))).toContain('(diff truncated)');
    const none = serializeDiff(ctxWithDiff([]));
    expect(none).toContain('PR: acme/webapp #142');
    expect(none).toContain('No code diff is available');
  });

  it('char-budgets a huge file per-file and flags it trimmed', () => {
    // Each line ~20 chars; enough lines to blow past the per-file char cap.
    const perLine = 'x'.repeat(18); // "+" + 18 + "\n" ≈ 20 chars
    const count = Math.ceil(VOICE_DIFF_PER_FILE_CHARS / 20) + 500;
    const huge = fileDiff({
      path: 'big.ts',
      additions: count,
      hunks: [
        {
          header: '@@ big @@',
          lines: Array.from({ length: count }, (_, i) => ({ type: 'add' as const, text: `${i}-${perLine}` })),
        },
      ],
    });
    const out = serializeDiff(ctxWithDiff([huge]));
    expect(out).toContain('file trimmed');
    expect(out).toContain('diff trimmed to fit the context');
    expect(out).not.toContain(`${count - 1}-${perLine}`); // the last line is past the per-file cap
  });

  it('lists generated files but emits real changes before them', () => {
    const generated = fileDiff({
      path: 'package-lock.json',
      additions: 9000,
      hunks: [{ header: '@@ lock @@', lines: [{ type: 'add', text: '"resolved": "..."' }] }],
    });
    const real = fileDiff({
      path: 'src/app.ts',
      additions: 3,
      hunks: [{ header: '@@ app @@', lines: [{ type: 'add', text: 'export const x = 1;' }] }],
    });
    // `generated` is "bigger", so size-ordering alone would put it first; the
    // low-signal split must override that and emit src/app.ts first.
    const out = serializeDiff(ctxWithDiff([generated, real]));
    expect(isLowSignalPath('package-lock.json')).toBe(true);
    expect(isLowSignalPath('src/app.ts')).toBe(false);
    expect(out).toContain('package-lock.json (modified, +9000 −0, generated)'); // listed + tagged
    expect(out.indexOf('--- src/app.ts ---')).toBeLessThan(out.indexOf('--- package-lock.json (generated) ---'));
  });
});

describe('buildVoiceSystemPrompt', () => {
  it('embeds the rules, the literal refusal string, and the diff grounding', () => {
    const p = buildVoiceSystemPrompt(
      ctxWithDiff([fileDiff({ path: 'src/billing.ts', additions: 1, deletions: 1 })]),
    );
    expect(p).toContain(REFUSAL);
    expect(p).toContain('1 to 3 short spoken sentences');
    expect(p).toContain('=== DIFF');
    expect(p).toContain('src/billing.ts');
  });

  it('grounds ONLY on the code diff — never the metrics report', () => {
    const p = buildVoiceSystemPrompt(
      ctxWithDiff([fileDiff({ path: 'src/billing.ts', additions: 1, deletions: 1 })]),
    );
    expect(p).toContain('Changed files (largest first):');
    expect(p).not.toContain('Notable metrics');
    expect(p).not.toContain('Merge confidence');
  });

  it('tells the user to run a live scan when the context has no diff (no metrics leak)', () => {
    // A scraped-comment context (metrics only, no pr_diff) must NOT ground on metrics.
    const p = buildVoiceSystemPrompt(ctxWith(fullReport()));
    expect(p).not.toContain('Token footprint');
    expect(p).toContain('run a live scan');
  });

  it('handles a null context gracefully', () => {
    const p = buildVoiceSystemPrompt(null);
    expect(p).toContain('No pull request is loaded');
    expect(p).toContain('run a live scan');
  });
});

describe('buildCallInstruction', () => {
  it('gives Andy a phone persona, the refusal string, and the diff grounding', () => {
    const p = buildCallInstruction(
      ctxWithDiff([fileDiff({ path: 'src/billing.ts', additions: 1, deletions: 1 })]),
    );
    expect(p).toContain('calling to walk someone through the review of acme/webapp #142');
    expect(p).toContain('Open the call');
    expect(p).toContain(REFUSAL);
    expect(p).toContain('=== DIFF');
    expect(p).toContain('src/billing.ts');
  });

  it('grounds ONLY on the diff — never the metrics report', () => {
    const p = buildCallInstruction(ctxWith(fullReport()));
    expect(p).not.toContain('Token footprint');
    expect(p).toContain('live scan');
  });

  it('handles a null context gracefully', () => {
    const p = buildCallInstruction(null);
    expect(p).toContain('a GitHub pull request');
    expect(p).toContain('live scan');
  });
});

const brief: ReviewBrief = {
  authors: ['Ada Lovelace'],
  description: 'Adds exponential backoff to charge retries.',
  qualityBand: 'C — do not merge as-is',
  counts: ['2 features', '1 bug fix', '3 new test files'],
  risks: [{ label: 'Double-charge on retry', quadrant: 'act_before_merge' }],
  suggestions: [{ file: 'billing/charge.ts', line: 42, severity: 'critical', why: 'Retry can double-charge' }],
  keyFiles: ['billing/charge.ts — holds the retry logic'],
  uncoveredRoots: ['billing/charge.ts::charge'],
  reliabilityGaps: ['No timeout on the retry loop'],
  techDebt: ['charge (complex)'],
  duplication: 2,
  affectedRoots: ['billing', 'api'],
  valueBottomLine: 'Reduces failed charges; small added complexity.',
  commits: ['feat: add backoff'],
};

function ctxRich(files: FileDiff[]): PrContext {
  return { ...ctxWith(fullReport()), prDiff: { files, truncated: false }, reviewBrief: brief };
}

describe('serializeReviewBrief', () => {
  it('serializes the merge-readiness headline and every brief section', () => {
    const out = serializeReviewBrief(ctxRich([fileDiff({ path: 'billing/charge.ts', additions: 5, deletions: 1 })]));
    expect(out).toContain('Author: Ada Lovelace');
    expect(out).toContain('Verdict: Address before merge');
    expect(out).toContain('Merge confidence: 3 out of 5');
    expect(out).toContain('Quality band: C — do not merge as-is');
    expect(out).toContain('Critical metrics: Token footprint');
    expect(out).toContain('Double-charge on retry [act before merge]');
    expect(out).toContain('billing/charge.ts:42 — critical: Retry can double-charge');
    expect(out).toContain('Untested entry points: billing/charge.ts::charge');
    expect(out).toContain('Reliability / edge-case gaps:');
    expect(out).toContain('Value versus cost: Reduces failed charges');
  });

  it('returns "" when there is no report and no brief', () => {
    const out = serializeReviewBrief(ctxWithDiff([fileDiff({ path: 'a.ts' })]));
    expect(out).toBe('');
  });
});

describe('buildCallInstruction — enriched with the review brief', () => {
  it('includes the REVIEW BRIEF block above the DIFF and broadens what Andy can answer', () => {
    const p = buildCallInstruction(ctxRich([fileDiff({ path: 'billing/charge.ts', additions: 5, deletions: 1 })]));
    expect(p).toContain('=== REVIEW BRIEF');
    expect(p).toContain('Double-charge on retry');
    expect(p).toContain('billing/charge.ts:42');
    expect(p).toContain('test-coverage gaps'); // the broadened capabilities line
    expect(p).toContain('review brief or the diff'); // refusal scope now spans both
    // Brief is pinned BEFORE the literal diff.
    expect(p.indexOf('=== REVIEW BRIEF')).toBeLessThan(p.indexOf('=== DIFF'));
    expect(p).toContain(REFUSAL);
  });
});
