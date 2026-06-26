import { describe, it, expect, vi } from 'vitest';
import { buildExplainerDoc } from './explainerDoc';
import { narrateDeck } from './deckNarrator';
import type { ScanRecord } from '../state/scanHistory';
import type { BrainRuntime } from '../core/brainRuntime';
import type { ChangedFileStatus } from '../core/prDiff';

const file = (path: string, code: ChangedFileStatus['code'], add: number, del = 0): ChangedFileStatus => ({ path, code, additions: add, deletions: del });

const SCAN = {
  pr_scope: { affected_roots: ['src/core'] },
  pr_review: {
    visual_summary: { key_files: { groups: [{ name: 'g', files: [{ path: 'src/core/auth.ts', why: 'Auth rewrite' }] }] } },
    architecture_flow: { diff_merged_structured: { nodes: [{ id: '1', label: 'login.ts', class: 'changed' }] } },
  },
  pr_diff: { files: [{ path: 'src/core/auth.ts', status: 'M', additions: 50, deletions: 10, hunks: [{ header: '@@ -1 +1 @@', lines: [{ type: 'add', text: 'const x = 1;' }] }] }] },
};

const rec = {
  title: 'BYO Gemini chat brain',
  changedStatus: [file('src/core/auth.ts', 'M', 50, 10), file('src/core/login.ts', 'M', 30, 5), file('src/core/auth.test.ts', 'A', 40)],
  changedFiles: 3,
  scan: SCAN,
  report: { verdict: 'address', verdictLabel: 'Address before merge' },
} as unknown as ScanRecord;

function fakeBrain(impl: (calls: number) => Promise<string>): { brain: BrainRuntime; calls: () => number } {
  let n = 0;
  const brain = {
    generate: vi.fn(async () => impl(n++)),
    complete: vi.fn(async () => ''),
    interrupt: vi.fn(),
    free: vi.fn(),
  } as unknown as BrainRuntime;
  return { brain, calls: () => n };
}

describe('narrateDeck', () => {
  it('writes each slide with the brain and re-paces it', async () => {
    const doc = buildExplainerDoc(rec);
    const det0 = doc.slides[0].narration.map((l) => l.text).join(' ');
    const { brain, calls } = fakeBrain(async (i) => `Brain summary for slide ${i} — concise and grounded.`);

    const out = await narrateDeck(rec, doc, { brain });

    expect(calls()).toBeGreaterThanOrEqual(doc.slides.length); // ≥ one agent per slide (+ answers)
    expect(out.slides[0].narration).toHaveLength(1);
    expect(out.slides[0].narration[0].who).toBe('A');
    expect(out.slides[0].narration[0].text).toContain('Brain summary for slide 0');
    expect(out.slides[0].narration[0].text).not.toBe(det0); // replaced the deterministic line
    expect(out.slides[0].durationSec).toBeGreaterThanOrEqual(6);
    expect(out.totalSec).toBe(out.slides.reduce((a, s) => a + s.durationSec, 0));
  });

  it('fills each slide question with a grounded brain answer (no stub placeholder)', async () => {
    const doc = buildExplainerDoc(rec);
    const { brain } = fakeBrain(async () => '1) First answer here. 2) Second answer here. 3) Third answer here.');
    const out = await narrateDeck(rec, doc, { brain });
    const overview = out.slides[0];
    expect(overview.questions!.length).toBeGreaterThan(0);
    expect(overview.questions![0].answer).toBe('First answer here.');
    expect(overview.questions!.every((q) => !!q.answer)).toBe(true);
  });

  it('strips role/markdown noise the weak model prepends', async () => {
    const doc = buildExplainerDoc(rec);
    const { brain } = fakeBrain(async () => '  Assistant: **This PR adds a Gemini brain.**  ');
    const out = await narrateDeck(rec, doc, { brain });
    expect(out.slides[0].narration[0].text).toBe('This PR adds a Gemini brain.');
  });

  it('keeps the deterministic narration when a slide generation fails (soft)', async () => {
    const doc = buildExplainerDoc(rec);
    const before = doc.slides[0].narration.map((l) => l.text);
    const { brain } = fakeBrain(async () => { throw new Error('brain down'); });
    const out = await narrateDeck(rec, doc, { brain });
    expect(out.slides[0].narration.map((l) => l.text)).toEqual(before); // unchanged
  });

  it('respects an aborted signal (no generations)', async () => {
    const doc = buildExplainerDoc(rec);
    const { brain, calls } = fakeBrain(async () => 'should not run');
    const ac = new AbortController();
    ac.abort();
    await narrateDeck(rec, doc, { brain, signal: ac.signal });
    expect(calls()).toBe(0);
  });
});
