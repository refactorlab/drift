// End-to-end (logic-layer) test of the summary_presentation_deck path: the router
// selects the tool, the agent loop runs it, and the `onDeck` event delivers a real
// ExplainerDoc to the host — exercising router → loop → tool → event in one go.

import { describe, it, expect, vi } from 'vitest';
import type { ScanRecord } from '../state/scanHistory';
import type { BrainRuntime } from './brainRuntime';
import type { ExplainerDoc } from '../agents/explainerDoc';

const REC = {
  id: 'x',
  url: 'https://github.com/o/r/pull/7',
  owner: 'o',
  repo: 'r',
  number: 7,
  title: 'BYO Gemini chat brain',
  sha: 'abc',
  ts: 0,
  durationMs: 0,
  caption: '2/5 confidence',
  verdict: 'address',
  verdictLabel: 'Address before merge',
  report: { verdict: 'address', verdictLabel: 'Address before merge' },
  scan: {
    pr_scope: { affected_roots: ['src/core'] },
    pr_review: {
      visual_summary: { key_files: { groups: [{ name: 'g', files: [{ path: 'src/core/auth.ts', why: 'Auth rewrite' }] }] } },
      architecture_flow: { diff_merged_structured: { nodes: [{ id: '1', label: 'login.ts', class: 'changed' }] } },
    },
  },
  narration: '',
  changedFiles: 2,
  changedStatus: [
    { path: 'src/core/auth.ts', code: 'M', additions: 50, deletions: 10 },
    { path: 'src/core/login.ts', code: 'M', additions: 30, deletions: 5 },
  ],
} as unknown as ScanRecord;

// Mock the scan lookup the tool calls (latestScanForPr) so no chrome/network is needed.
vi.mock('./runLiveScan', () => ({
  runLiveScan: vi.fn(),
  latestScanForPr: vi.fn(async () => REC),
}));

import { runAgentTurn } from './agentLoop';
import { EMPTY_PR_STATE, type PrToolState } from './chatTools';

const state: PrToolState = {
  ...EMPTY_PR_STATE,
  pr: { owner: 'o', repo: 'r', number: 7, host: 'github.com' },
  url: 'https://github.com/o/r/pull/7',
  title: 'BYO Gemini chat brain',
  scanRan: true,
};

// Fake brain: the router asks complete() for a tool decision; we pick the deck.
const brain: BrainRuntime = {
  generate: vi.fn(async () => ''),
  complete: vi.fn(async () => '{"tool":"summary_presentation_deck"}'),
  interrupt: vi.fn(),
  free: vi.fn(),
} as unknown as BrainRuntime;

describe('agent loop → summary_presentation_deck (end to end)', () => {
  it('routes to the deck tool and delivers a playable ExplainerDoc via onDeck', async () => {
    let deck: ExplainerDoc | null = null;
    let content = '';
    const tools: Array<{ name: string; ok: boolean }> = [];

    const reply = await runAgentTurn({
      brain,
      persona: 'drift',
      history: [],
      userText: 'show me a summary deck of this PR',
      getState: () => state,
      signal: new AbortController().signal,
      events: {
        onToken: (d) => (content += d),
        onToolStart: (name) => tools.push({ name, ok: false }),
        onToolEnd: (name, ok) => tools.push({ name, ok }),
        onDeck: (d) => (deck = d),
      },
    });

    // the tool ran
    expect(tools.some((t) => t.name === 'summary_presentation_deck' && t.ok)).toBe(true);
    // a real doc was delivered
    expect(deck).not.toBeNull();
    const doc = deck as unknown as ExplainerDoc;
    expect(doc.slides.length).toBeGreaterThan(0);
    expect(doc.slides[0].kind).toBe('overview');
    expect(doc.verdict).toBe('address');
    // the deck slide also has questions with citations (grounded)
    expect(doc.slides[0].questions?.every((q) => (q.cites?.length ?? 0) > 0)).toBe(true);
    // the user-facing reply names the deck
    expect(reply.toLowerCase()).toContain('deck');
    expect(content.toLowerCase()).toContain('deck');
  });
});
