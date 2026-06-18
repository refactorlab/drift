import { describe, expect, it } from 'vitest';
import { buildDeepDivePrompt, deepDiveOverview, parseDeepDiveAnswer, rankSectionsByQuery } from './deepDive';
import type { PresentSection } from './scrollPlan';
import type { FileCorrelation } from './fileBriefing';
import type { HandoverStep } from '../state/handoverSession';

const sec = (label: string, ref: string, name?: string): PresentSection => ({
  startLine: 1,
  endLine: 5,
  label,
  name,
  note: '',
  ref,
});

const SECTIONS: PresentSection[] = [
  sec('loadWasmModule', 'function loadWasmModule() { return loadScannerModule(); }', 'loadWasmModule'),
  sec('fmtMs', 'function fmtMs(ms) { /* format milliseconds */ }', 'fmtMs'),
  sec('fmtBytes', 'function fmtBytes(n) { /* KB MB GB */ }', 'fmtBytes'),
  sec('lines 200–210', '+ const retry = withRetry(fetchScan);'),
];

describe('rankSectionsByQuery', () => {
  it('keeps the sections matching the question, in reading order', () => {
    const r = rankSectionsByQuery(SECTIONS, 'how does fmtMs format the milliseconds?', 3);
    expect(r.map((s) => s.label)).toContain('fmtMs');
    expect(r.length).toBeLessThanOrEqual(3);
  });

  it('matches on the code text, not just the label (the retry question)', () => {
    const r = rankSectionsByQuery(SECTIONS, 'explain the retry logic', 2);
    expect(r.some((s) => s.ref.includes('withRetry'))).toBe(true);
  });

  it('returns ALL sections for a generic deepen with no matching tokens', () => {
    expect(rankSectionsByQuery(SECTIONS, 'go deeper please').length).toBe(SECTIONS.length);
    expect(rankSectionsByQuery(SECTIONS, 'tell me more').length).toBe(SECTIONS.length);
  });

  it('keeps the top-N by score and restores reading order', () => {
    const r = rankSectionsByQuery(SECTIONS, 'fmtMs fmtBytes loadWasmModule', 2);
    expect(r).toHaveLength(2);
    // original indices preserved (ascending), not score order
    const idx = r.map((s) => SECTIONS.indexOf(s));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
});

describe('parseDeepDiveAnswer', () => {
  it('extracts the ANSWER line', () => {
    expect(parseDeepDiveAnswer('ANSWER: It caches the module then reuses it.\n[H0] note')).toBe('It caches the module then reuses it.');
    expect(parseDeepDiveAnswer('answer - lower case works too')).toBe('lower case works too');
    expect(parseDeepDiveAnswer('[H0] no answer line here')).toBe('');
  });
});

describe('deepDiveOverview', () => {
  const step: HandoverStep = { path: 'src/app/LivePipelineRun.tsx', code: 'M', tier: 'critical', rationale: 'k', additions: 5, deletions: 1 };
  const corr: FileCorrelation = { keyWhy: 'Runs the live PR scan', root: 'src/app', touchedNodes: [], dataStructures: [], tier: 'critical' };

  it('uses the answer as Level 1 and marks the depth in Level 2', () => {
    const o = deepDiveOverview('It loads the WASM scanner once and caches it.', step, corr, [], 2);
    expect(o.prChange).toBe('It loads the WASM scanner once and caches it.');
    expect(o.purpose).toContain('Deeper dive (level 2)');
    expect(o.purpose).toContain('LivePipelineRun.tsx');
  });

  it('falls back to the grounded change line when the model gave no answer', () => {
    const o = deepDiveOverview('', step, corr, [], 1);
    expect(o.prChange).toContain('modifies LivePipelineRun.tsx');
    expect(o.prChange).toContain('Runs the live PR scan');
  });
});

describe('buildDeepDivePrompt', () => {
  it('embeds the question and the focused spots', () => {
    const step: HandoverStep = { path: 'a.ts', code: 'M', tier: 'core', rationale: 'k', additions: 1, deletions: 0 };
    const p = buildDeepDivePrompt(step, 'why retry?', '[H0] foo');
    expect(p).toContain('a.ts');
    expect(p).toContain('why retry?');
    expect(p).toContain('[H0] foo');
  });
});
