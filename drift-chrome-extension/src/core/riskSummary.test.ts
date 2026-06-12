import { describe, it, expect } from 'vitest';
import {
  deriveTopRisks,
  parseRiskLines,
  buildRiskUserContent,
  summarizeRisksWithBrain,
} from './riskSummary';
import type { DriftReport } from './types';

const baseReport: DriftReport = {
  found: true, verdict: 'review', verdictLabel: 'Review carefully', effortLabel: null,
  mergeConfidence: { value: 2, outOf: 5 }, gauges: [], blastRadius: null,
  criticalCount: null, metricCount: null, sections: [], prUrl: null, scrapedAt: 0,
};

describe('deriveTopRisks — on-device ranking', () => {
  it('ranks act_before_merge above other quadrants and caps at three', () => {
    const scan = {
      pr_review: {
        visual_summary: {
          risks: {
            items: [
              { label: 'Acceptable nit', likelihood: 0.9, severity: 0.9, quadrant: 'acceptable' },
              { label: 'Must fix auth', likelihood: 0.3, severity: 0.4, quadrant: 'act_before_merge' },
              { label: 'Watch this', likelihood: 0.8, severity: 0.6, quadrant: 'monitor_closely' },
              { label: 'Doc it', likelihood: 0.5, severity: 0.5, quadrant: 'document_and_ship' },
            ],
          },
        },
      },
    };
    const risks = deriveTopRisks(scan, baseReport);
    expect(risks).toHaveLength(3);
    expect(risks[0].text).toBe('Must fix auth'); // act_before_merge wins regardless of low score
    expect(risks[1].text).toBe('Watch this'); // monitor_closely next
    expect(risks.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('buckets severity into high/moderate/low', () => {
    const scan = {
      pr_review: { visual_summary: { risks: { items: [
        { label: 'Severe', likelihood: 1, severity: 0.8, quadrant: 'act_before_merge' },
        { label: 'Mid', likelihood: 1, severity: 0.4, quadrant: 'monitor_closely' },
        { label: 'Mild', likelihood: 1, severity: 0.1, quadrant: 'acceptable' },
      ] } } },
    };
    const risks = deriveTopRisks(scan, baseReport);
    expect(risks.find((r) => r.text === 'Severe')?.severity).toBe('high');
    expect(risks.find((r) => r.text === 'Mid')?.severity).toBe('moderate');
    expect(risks.find((r) => r.text === 'Mild')?.severity).toBe('low');
  });

  it('falls back to high/critical code suggestions when there are no risk items', () => {
    const scan = {
      pr_review: {
        code_suggestions: [
          { category: 'A', file: 'a.ts', confidence: 0.5, severity: 'low', why_it_matters: 'minor' },
          { category: 'A', file: 'pay.ts', confidence: 0.7, severity: 'critical', why_it_matters: 'Payments can double-charge' },
          { category: 'A', file: 'auth.ts', confidence: 0.9, severity: 'high', why_it_matters: 'Session not rotated' },
        ],
      },
    };
    const risks = deriveTopRisks(scan, baseReport);
    expect(risks).toHaveLength(2); // only critical + high
    expect(risks[0].text).toBe('Payments can double-charge'); // critical first
    expect(risks[0].file).toBe('pay.ts');
    expect(risks[0].severity).toBe('high');
  });

  it('falls back to critical metrics when neither risks nor suggestions exist', () => {
    const report: DriftReport = {
      ...baseReport,
      sections: [
        { index: 1, title: 'LLM Complexity', metrics: [
          { name: 'Token footprint', level: 'critical', percent: 90, direction: 'up' },
          { name: 'Readability', level: 'moderate', percent: 50, direction: 'down' },
        ] },
      ],
    };
    const risks = deriveTopRisks({ pr_review: {} }, report);
    expect(risks).toHaveLength(1);
    expect(risks[0].text).toContain('Token footprint');
  });

  it('returns an empty list for a clean scan', () => {
    expect(deriveTopRisks({ pr_review: {} }, baseReport)).toEqual([]);
  });

  it('ranks deterministically when a malformed item is missing numeric fields', () => {
    const scan = {
      pr_review: { visual_summary: { risks: { items: [
        { label: 'No numbers' }, // missing likelihood/severity → must not poison the sort
        { label: 'Real worst', likelihood: 0.9, severity: 0.9, quadrant: 'act_before_merge' },
      ] } } },
    };
    const risks = deriveTopRisks(scan, baseReport);
    expect(risks[0].text).toBe('Real worst'); // act_before_merge still wins; no NaN scrambling
    expect(risks.find((r) => r.text === 'No numbers')?.severity).toBe('low');
  });
});

describe('parseRiskLines', () => {
  it('parses three numbered lines and strips markdown', () => {
    const out = parseRiskLines('1. **Auth** bypass risk\n2) N+1 query in users\n3. Missing test for retry');
    expect(out.map((r) => r.text)).toEqual([
      'Auth bypass risk',
      'N+1 query in users',
      'Missing test for retry',
    ]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('ignores preamble and caps at three', () => {
    const out = parseRiskLines('Here are the risks:\n1. one\n2. two\n3. three\n4. four');
    expect(out).toHaveLength(3);
  });

  it('returns [] when nothing parses', () => {
    expect(parseRiskLines('no numbered lines here')).toEqual([]);
  });

  it('tolerates bold / bullet prefixes the model adds despite instructions', () => {
    const out = parseRiskLines('**1. Race on save**\n- 2. N+1 query\n* 3) Missing retry test');
    expect(out.map((r) => r.text)).toEqual(['Race on save', 'N+1 query', 'Missing retry test']);
  });
});

describe('buildRiskUserContent', () => {
  it('packs verdict and risk items into compact JSON', () => {
    const scan = {
      pr_review: { visual_summary: { risks: { items: [
        { label: 'Risk A', likelihood: 0.5, severity: 0.6, quadrant: 'act_before_merge' },
      ] } } },
    };
    const json = JSON.parse(buildRiskUserContent(scan, baseReport));
    expect(json.verdict).toBe('Review carefully');
    expect(json.merge_confidence).toBe('2/5');
    expect(json.risks[0].label).toBe('Risk A');
  });
});

// A fetch that streams a single SSE data event then done — exercises the real
// streamBrain SSE parser the same way the live brain would.
function sseFetch(text: string): typeof fetch {
  return (async () => {
    const enc = new TextEncoder();
    const body = `data: ${JSON.stringify({ text })}\n\nevent: done\n\n`;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode(body));
        c.close();
      },
    });
    return new Response(stream, { status: 200 });
  }) as unknown as typeof fetch;
}

describe('summarizeRisksWithBrain', () => {
  it('returns the parsed top-3 when the brain replies', async () => {
    const out = await summarizeRisksWithBrain({
      scan: { pr_review: {} },
      report: baseReport,
      fetchImpl: sseFetch('1. First\n2. Second\n3. Third'),
    });
    expect(out?.map((r) => r.text)).toEqual(['First', 'Second', 'Third']);
  });

  it('returns null when the brain is unreachable', async () => {
    const out = await summarizeRisksWithBrain({
      scan: { pr_review: {} },
      report: baseReport,
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    expect(out).toBeNull();
  });

  it('returns null when the reply has no parseable lines', async () => {
    const out = await summarizeRisksWithBrain({
      scan: { pr_review: {} },
      report: baseReport,
      fetchImpl: sseFetch('Sorry, I could not find anything.'),
    });
    expect(out).toBeNull();
  });
});
