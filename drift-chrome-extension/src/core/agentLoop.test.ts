import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the architecture tools' DATA dependencies so the loop runs without a real
// scan / IndexedDB / brain. We assert the TOOL ORCHESTRATION: that get_pr_architecture
// flipping architectureKnown is visible to the SAME turn's next route, which is the
// only way explain_architecture (gated on architectureKnown) can fire here.
vi.mock('./runLiveScan', () => ({
  runLiveScan: vi.fn(),
  latestScanForPr: vi.fn(async () => ({
    url: 'u',
    sha: 's',
    owner: 'o',
    repo: 'r',
    number: 1,
    changedFiles: 2,
    changedStatus: [],
    commits: [],
    verdict: 'review',
    verdictLabel: 'Review',
  })),
}));
vi.mock('../state/prFileStore', () => ({ listPrFiles: vi.fn(async () => [{ path: 'a.ts', status: 'M' }]) }));
vi.mock('../agents/architecture', () => ({ buildArchitectureOverview: vi.fn(() => 'ARCH MAP') }));
vi.mock('../agents/iterative-agent', () => ({
  runIterativeAgent: vi.fn(async () => ({ answer: 'DEEP ANSWER', readPaths: ['a.ts'] })),
}));

import { runAgentTurn } from './agentLoop';
import type { BrainRuntime } from './brainRuntime';
import type { ChatTurn } from './chatContext';
import type { PrToolState } from './chatTools';
import { buildArchitectureOverview } from '../agents/architecture';
import { runIterativeAgent } from '../agents/iterative-agent';

const mockBuildArch = vi.mocked(buildArchitectureOverview);
const mockRunIterative = vi.mocked(runIterativeAgent);

function scriptedBrain(decisions: string[], answer: string): BrainRuntime {
  let i = 0;
  return {
    async complete() {
      return decisions[i++] ?? '{"tool":"none"}';
    },
    async generate(_m: ChatTurn[], opts?: { onToken?: (t: string) => void }) {
      opts?.onToken?.(answer);
      return answer;
    },
    interrupt() {},
    free() {},
  };
}

const STATE: PrToolState = {
  pr: { owner: 'o', repo: 'r', number: 1, host: 'github.com' },
  url: 'u',
  title: 't',
  scanRan: true,
  scanRunning: false,
  changedCount: 2,
  architectureKnown: false, // host state never flips during this synchronous turn
};

beforeEach(() => {
  mockBuildArch.mockClear();
  mockRunIterative.mockClear();
});

describe('runAgentTurn — architecture tool chain', () => {
  it('chains get_pr_architecture → explain_architecture within ONE turn via the in-turn state patch', async () => {
    const patches: Array<Partial<PrToolState>> = [];
    const brain = scriptedBrain(
      ['{"tool":"get_pr_architecture"}', '{"tool":"explain_architecture"}', '{"tool":"none"}'],
      'FINAL',
    );
    const answer = await runAgentTurn({
      brain,
      persona: 'P',
      history: [],
      userText: 'walk me through the architecture',
      getState: () => STATE, // always architectureKnown:false — only the in-turn patch unlocks explain
      signal: new AbortController().signal,
      events: { onToken: () => {}, onStatePatch: (p) => patches.push(p) },
    });

    expect(mockBuildArch).toHaveBeenCalled(); // get_pr_architecture ran
    expect(mockRunIterative).toHaveBeenCalledTimes(1); // explain_architecture ran SAME turn
    expect(patches).toContainEqual({ architectureKnown: true });
    expect(answer).toBe('FINAL');
  });

  it('short-circuits a meta/capability question to a direct answer — never routes, never scans', async () => {
    const complete = vi.fn(async () => '{"tool":"run_live_pr_scan"}'); // router WOULD scan if asked
    const brain: BrainRuntime = {
      complete,
      async generate(_m, opts?: { onToken?: (t: string) => void }) {
        opts?.onToken?.('CAPS');
        return 'CAPS';
      },
      interrupt() {},
      free() {},
    };
    const answer = await runAgentTurn({
      brain,
      persona: 'P',
      history: [],
      userText: 'Cool functions can you run?', // the exact misroute from the bug report
      getState: () => STATE,
      signal: new AbortController().signal,
      events: { onToken: () => {} },
    });
    expect(complete).not.toHaveBeenCalled(); // guard fired before the router
    expect(mockRunIterative).not.toHaveBeenCalled();
    expect(answer).toBe('CAPS');
  });

  it('passes the live question into the iterative agent', async () => {
    const brain = scriptedBrain(['{"tool":"explain_architecture"}', '{"tool":"none"}'], 'X');
    await runAgentTurn({
      brain,
      persona: 'P',
      history: [],
      userText: 'how does the worker boot?',
      getState: () => ({ ...STATE, architectureKnown: true }), // already mapped
      signal: new AbortController().signal,
      events: { onToken: () => {} },
    });
    expect(mockRunIterative).toHaveBeenCalledWith(expect.objectContaining({ question: 'how does the worker boot?', url: 'u', sha: 's' }));
  });
});
