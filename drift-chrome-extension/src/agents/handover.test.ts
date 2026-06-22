import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, type ChromeMock } from '../test/chromeMock';
// A changed file with one hunk (new-side lines 1–6) so the step explanation takes
// the hunk-walk path and builds a real scroll plan.
vi.mock('../state/prFileStore', () => ({
  getPrFile: vi.fn(async () => ({ path: 'src/core/auth.ts', status: 'M', content: 'x', diff: '@@ -1,3 +1,6 @@ class Auth\n ctx\n+a\n+b\n+c' })),
}));
// The change collector hits GitHub's `.diff` only when the cache lacks a diff — stub it so
// the suite stays hermetic (those cases fall through to the symbol / synthetic-diff path).
vi.mock('./changeCollector', () => ({ collectFileDiff: vi.fn(async () => '') }));
import { runHandoverTurn } from './handover';
import { getHandoverSession, setHandoverSession } from '../state/handoverSession';
import { diffAnchor, attachAnchors } from '../core/prNavigate';
import { buildHandoverPlan } from './handoverPlan';
import type { ScanRecord } from '../state/scanHistory';
import type { BrainRuntime } from '../core/brainRuntime';
import type { ChatTurn } from '../core/chatContext';
import type { PrId } from '../core/prRefs';

const PR: PrId = { owner: 'o', repo: 'r', number: 70, host: 'github.com' };
const URL = 'https://github.com/o/r/pull/70';

// A scan where auth.ts is the key (critical) file and README is minor.
const REC = {
  url: URL,
  owner: 'o',
  repo: 'r',
  number: 70,
  title: 'T',
  sha: 'sha-head',
  verdict: 'review',
  verdictLabel: 'Review',
  changedFiles: 2,
  commits: [],
  changedStatus: [
    { code: 'M', path: 'src/core/auth.ts', additions: 20, deletions: 4 },
    { code: 'M', path: 'README.md', additions: 1, deletions: 0 },
  ],
  scan: {
    pr_review: { visual_summary: { key_files: { groups: [{ name: 'g', files: [{ path: 'src/core/auth.ts', why: 'Auth rewrite' }] }] } } },
    // The profiler's tree-sitter symbol map for the changed file — beats anchor here.
    pr_symbols: [{ path: 'src/core/auth.ts', symbols: [{ name: 'Auth', kind: 'class', line: 1, end_line: 6 }] }],
  },
} as unknown as ScanRecord;

// The overview is now produced by TWO dedicated agents (Level 1 + Level 2) plus the
// Level-3 annotator — three SEPARATE generations. This fake brain answers each by the
// system prompt it receives, so the test exercises the real per-agent contract.
const BRAIN: BrainRuntime = {
  async generate(messages) {
    const sys = messages.find((m) => m.role === 'system')?.content ?? '';
    if (/LEVEL 1/.test(sys)) return 'Adds retry to the auth flow.';
    if (/LEVEL 2/.test(sys)) return 'Authenticates the user. Validates the session token.';
    return '[H0] EXPLANATION OF THE FILE'; // the Level-3 annotator
  },
  async complete() {
    return '';
  },
  interrupt() {},
  free() {},
};

const turn = (userText: string) =>
  runHandoverTurn({ pr: PR, url: URL, rec: REC, userText, brain: BRAIN, signal: new AbortController().signal, onProgress: () => {} });

describe('runHandoverTurn', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
    mock.setActiveTab({ id: 9, url: URL }); // on the Conversation tab → route auto-detects to /files
  });

  it('START presents the tiered plan, navigates to the changes overview, and waits', async () => {
    const r = await turn('walk me through this PR');
    expect(r.handoverActive).toBe(true);
    expect(r.content).toMatch(/Critical:/);
    expect(r.content).toContain('src/core/auth.ts');
    expect(r.content).toMatch(/First up: src\/core\/auth\.ts/);
    // A condensed spoken variant exists for voice — names the first file but NOT the full list.
    expect(r.spoken).toMatch(/First up: src\/core\/auth\.ts/);
    expect(r.spoken).not.toMatch(/Critical:/);
    expect(r.spoken!.length).toBeLessThan(r.content.length);
    // Navigated the tab to the changes overview (auto-detected /files route).
    expect(mock.lastTabUpdate()?.props.url).toBe('https://github.com/o/r/pull/70/files');
    // Session persisted at the overview (cursor -1).
    expect((await getHandoverSession(URL))?.cursor).toBe(-1);
  });

  it('NEXT advances to the first file, navigates to its diff anchor, and explains it', async () => {
    await turn('walk me through this PR'); // seed the session
    mock.setActiveTab({ id: 9, url: URL });
    const r = await turn('next');
    const anchor = await diffAnchor('src/core/auth.ts');
    expect(mock.lastTabUpdate()?.props.url).toBe(`https://github.com/o/r/pull/70/files#${anchor}`);
    expect(r.content).toContain('EXPLANATION OF THE FILE');
    // The spoken/text content carries ALL THREE levels — Level 1 (PR change), Level 2
    // (what the file does), Level 3 (the section notes). Level 2 was being dropped, so
    // voice never read "what the file does" even though it's shown visually.
    expect(r.content).toContain('Adds retry to the auth flow.'); // Level 1
    expect(r.content).toContain('Authenticates the user.'); // Level 2 (FILE)
    expect(r.content).toContain('Validates the session token.'); // Level 2 (DETAIL)
    expect(r.content).toMatch(/Proceed to README\.md\?/); // next file teased
    expect((await getHandoverSession(URL))?.cursor).toBe(0);
  });

  it('builds + injects a DWELL-SCROLL plan from the file diff hunks, and returns clickable beats', async () => {
    await turn('walk me through this PR');
    mock.setActiveTab({ id: 9, url: URL });
    const r = await turn('next');
    await new Promise((res) => setTimeout(res, 0)); // let the fire-and-forget plan inject settle
    const inject = mock.lastExecuteScript();
    expect(inject?.args).toHaveLength(5); // [anchor, path, offset, plan, leadDelay]
    const plan = inject?.args?.[3] as Array<{ startLine: number; endLine: number; dwellMs: number; sweep?: boolean }>;
    // Beat 0 is the OVERVIEW sweep: it starts at the file TOP (line 1) and slow-scrolls down
    // to the first change (line 2), paced to the Level 1 + Level 2 reading time (its OWN
    // timeline segment now, not folded into the first change's dwell).
    expect(plan[0]).toMatchObject({ startLine: 1, endLine: 2, sweep: true });
    expect(plan[0].dwellMs).toBeGreaterThan(3000); // ~13-word overview at 225 wpm
    // Beat 1 is the first CHANGE — anchored on the changed lines (`+a/+b/+c` at new-side
    // 2–4), not the leading context line at the hunk top.
    expect(plan[1]).toMatchObject({ startLine: 2, endLine: 4 });
    // The clickable presentation comes back on the result (drives the message buttons),
    // anchored on the REAL tree-sitter symbol (label + name for sub-line highlight).
    expect(r.presentation?.path).toBe('src/core/auth.ts');
    expect(r.presentation?.beats[0]).toMatchObject({ label: 'Overview', sweep: true });
    expect(r.presentation?.beats[1]).toMatchObject({ label: 'Auth', name: 'Auth', startLine: 2, endLine: 4 });
    // Level 3: the MODEL's `[H0]` annotation is what fills the first change's section note.
    expect(r.presentation?.beats[1].note).toContain('EXPLANATION OF THE FILE');
    // The 3-LEVEL overview rides on the presentation: Level 1 (PR change) from the model's
    // `PR:` line, Level 2 (purpose) from its `FILE:` + `DETAIL:` lines.
    expect(r.presentation?.overview?.prChange).toContain('Adds retry');
    expect(r.presentation?.overview?.purpose).toContain('Authenticates the user');
    expect(r.presentation?.overview?.purpose).toContain('Validates the session token');
  });

  it('paces dwell by SPEAKING speed in voice mode (155 wpm dwells longer than text 225 wpm)', async () => {
    // Measured on the first CHANGE beat (beats[1]) — beats[0] is the overview, whose dwell is
    // floored at ~10s once the intro header is folded in, so it can't show the wpm scaling.
    const firstChangeDwell = async (mode: 'text' | 'voice') => {
      const seed = (t: string) =>
        runHandoverTurn({ pr: PR, url: URL, rec: REC, userText: t, brain: BRAIN, signal: new AbortController().signal, onProgress: () => {}, mode });
      await seed('walk me through this PR'); // (re)start → cursor -1
      mock.setActiveTab({ id: 9, url: URL });
      return (await seed('next')).presentation?.beats[1].dwellMs ?? 0; // → file 1 (auth.ts), first change
    };
    const textDwell = await firstChangeDwell('text');
    const voiceDwell = await firstChangeDwell('voice');
    expect(voiceDwell).toBeGreaterThan(textDwell); // same words, slower rate → longer dwell
  });

  it('folds the intro header reading time into the START beat (≥10s, so the reader can read it)', async () => {
    await turn('walk me through this PR');
    mock.setActiveTab({ id: 9, url: URL });
    const r = await turn('next');
    const overview = r.presentation?.beats[0];
    expect(overview?.sweep).toBe(true);
    expect(overview?.dwellMs).toBeGreaterThanOrEqual(10000); // intro + Level 1 + Level 2, floored
  });

  it('STILL presents from symbols when the diff cache is empty (the "fell to prose" bug)', async () => {
    const { getPrFile } = await import('../state/prFileStore');
    // No diff at all for this file (stale cache) — symbols must still drive the beats.
    vi.mocked(getPrFile).mockResolvedValueOnce({ path: 'src/core/auth.ts', status: 'M', content: 'x', diff: '' });
    await turn('walk me through this PR');
    mock.setActiveTab({ id: 9, url: URL });
    const r = await turn('next');
    expect(r.presentation?.beats.length).toBeGreaterThan(0); // NOT empty → buttons render
    expect(r.presentation?.beats[0]).toMatchObject({ label: 'Overview', sweep: true });
    expect(r.presentation?.beats[1]).toMatchObject({ label: 'Auth', name: 'Auth' });
    // The symbol path ALSO asks the model for the 3-level header, so the overview is the
    // MODEL's words (from `FILE:`/`DETAIL:`), not a deterministic symbol list.
    expect(r.presentation?.overview?.prChange).toContain('Adds retry');
    expect(r.presentation?.overview?.purpose).toContain('Authenticates the user');
  });

  it('never shows a graph-metric Level 1 or a <module> symbol — clean fallback when the model gives no header', async () => {
    const { getPrFile } = await import('../state/prFileStore');
    // Real multi-line content so the section fallback note is the symbol's SIGNATURE line.
    const lines = Array.from({ length: 30 }, (_, i) => `  line ${i + 1}`);
    lines[9] = 'export function sevBucket(score) {'; // line 10 → sevBucket
    lines[21] = 'export function round2(n) {'; //        line 22 → round2
    vi.mocked(getPrFile).mockResolvedValueOnce({ path: 'src/core/riskSummary.ts', status: 'M', content: lines.join('\n'), diff: '' });
    const rec = {
      ...REC,
      changedStatus: [{ code: 'M', path: 'src/core/riskSummary.ts', additions: 12, deletions: 3 }],
      scan: {
        // The scan's key-file `why` is a GRAPH METRIC ("744 root(s) reach this file") — it
        // became the unhelpful Level 1 in the bug report; it must NOT be used verbatim.
        pr_review: { visual_summary: { key_files: { groups: [{ name: 'g', files: [{ path: 'src/core/riskSummary.ts', why: '744 root(s) reach this file' }] }] } } },
        pr_symbols: [
          {
            path: 'src/core/riskSummary.ts',
            symbols: [
              { name: '<module>', kind: 'module', line: 1, end_line: 200 }, // the tree-sitter file node — must be filtered
              { name: 'sevBucket', kind: 'function', line: 10, end_line: 20 },
              { name: 'round2', kind: 'function', line: 22, end_line: 30 },
            ],
          },
        ],
      },
    } as unknown as ScanRecord;
    // A model that returns NOTHING for every agent → exercises BOTH the deterministic
    // overview fallback (Level 1/2) AND the symbol-beat fallback (Level 3).
    const dumbBrain: BrainRuntime = { async generate() { return ''; }, async complete() { return ''; }, interrupt() {}, free() {} };
    const run = (t: string) => runHandoverTurn({ pr: PR, url: URL, rec, userText: t, brain: dumbBrain, signal: new AbortController().signal, onProgress: () => {} });
    await run('walk me through this PR');
    mock.setActiveTab({ id: 9, url: URL });
    const r = await run('next');
    // Level 1 is NEVER the graph metric → a clean structural one-liner instead.
    expect(r.presentation?.overview?.prChange).not.toMatch(/root\(s\)/);
    expect(r.presentation?.overview?.prChange).toMatch(/modifies riskSummary\.ts/);
    // Level 2 + every section label drop the tree-sitter file node.
    expect(r.presentation?.overview?.purpose).not.toContain('<module>');
    expect(r.presentation?.overview?.purpose).toContain('sevBucket');
    expect(r.presentation?.beats.every((b) => b.label !== '<module>' && b.name !== '<module>')).toBe(true);
    // Level 3 fallback (model gave no [H<n>]) is the symbol's SIGNATURE line, NEVER the bare
    // "The function X." the old symbol-pick fallback produced.
    expect(r.presentation?.beats.every((b) => !/^The (function|class|method) /.test(b.note))).toBe(true);
    // beats[0] is the overview sweep; beats[1] is the first symbol section.
    expect(r.presentation?.beats[1].note).toContain('export function sevBucket');
  });

  it('grounds a no-symbol / no-diff file in its REAL content (synthetic diff), never the PR theme', async () => {
    // The reported bug: a NEW file whose per-file diff was dropped by the size budget,
    // with no tree-sitter symbols, fell to a prose path where the small model INVENTED
    // functions that aren't in the file (e.g. "getAudioPath"/"playVoicePrompt"). Now we
    // synthesize an all-added diff from the file's CONTENT, so the walkthrough grounds on
    // real lines — and the whole-PR theme (call-graph delta) is never in the prompt.
    const { getPrFile } = await import('../state/prFileStore');
    const file = {
      path: 'src/core/reviewBrief.ts',
      status: 'A',
      content: 'export function buildReviewBrief(scan: ScanOutput): ReviewBrief { /* compact brief */ }',
      diff: '', // no cached diff + no symbols → grounds on the content (synthetic diff)
    };
    vi.mocked(getPrFile).mockResolvedValueOnce(file); // one read now: buildPresentation only

    const prompts: string[] = [];
    const capturingBrain: BrainRuntime = {
      async generate(messages: ChatTurn[]) {
        prompts.push(messages.map((m) => m.content).join('\n'));
        // The model's 3-level header — its words become the overview (Level 1 + Level 2).
        return 'PR: Adds the review-brief builder.\nFILE: Builds a compact ReviewBrief from the scan output.\nDETAIL: It distills risk, suggestions, and tests.\n[L1: buildReviewBrief] Builds the brief.';
      },
      async complete() {
        return '';
      },
      interrupt() {},
      free() {},
    };

    const rec = {
      ...REC,
      title: 'feat: vendor volley-core voice turn-taking WASM',
      commits: ['feat: vendor volley-core voice turn-taking WASM'],
      changedFiles: 1,
      changedStatus: [{ code: 'A', path: 'src/core/reviewBrief.ts', additions: 140, deletions: 0 }],
      scan: {
        pr_review: {
          visual_summary: { key_files: { groups: [{ name: 'g', files: [{ path: 'src/core/reviewBrief.ts', why: 'Builds the compact review brief' }] }] } },
          // The call-graph delta — the PR-level theme that leaked into the file prompt before the fix.
          architecture_flow: { diff_merged_structured: { nodes: [{ id: 'n1', label: 'DuplexCascade', class: 'added' }, { id: 'n2', label: 'turnTakingWasm', class: 'added' }] } },
        },
        // NO pr_symbols → grounds on the synthetic diff from the file's content.
      },
    } as unknown as ScanRecord;

    const run = (userText: string) =>
      runHandoverTurn({ pr: PR, url: URL, rec, userText, brain: capturingBrain, signal: new AbortController().signal, onProgress: () => {} });

    await run('walk me through this PR');
    mock.setActiveTab({ id: 9, url: URL });
    const r = await run('next');

    const prompt = prompts.join('\n');
    // The whole-PR call-graph theme must NOT be injected into a single-file walkthrough…
    expect(prompt).not.toContain('DuplexCascade');
    expect(prompt).not.toContain('turnTakingWasm');
    // …it grounds on the file's own REAL content (lines the model can cite + navigate).
    expect(prompt).toContain('buildReviewBrief');
    // It produces grounded BEATS (not a prose hallucination) and the MODEL's words land in
    // the 3-level overview (Level 2 = what the file does).
    expect(r.presentation?.beats.length).toBeGreaterThan(0);
    expect(r.presentation?.overview?.purpose).toContain('compact ReviewBrief');
    expect(r.presentation?.overview?.prChange).toContain('review-brief builder');
  });

  it('says it could not read the file rather than HALLUCINATE when there is no diff / symbols / content', async () => {
    const { getPrFile } = await import('../state/prFileStore');
    vi.mocked(getPrFile).mockResolvedValueOnce(null); // nothing cached for this file
    const rec = {
      ...REC,
      changedFiles: 1,
      changedStatus: [{ code: 'A', path: 'src/core/mystery.ts', additions: 5, deletions: 0 }],
      scan: { pr_review: {} }, // no pr_symbols
    } as unknown as ScanRecord;
    const run = (userText: string) =>
      runHandoverTurn({ pr: PR, url: URL, rec, userText, brain: BRAIN, signal: new AbortController().signal, onProgress: () => {} });
    await run('walk me through this PR');
    mock.setActiveTab({ id: 9, url: URL });
    const r = await run('next');
    expect(r.presentation?.beats?.length ?? 0).toBe(0); // no fabricated beats
    expect(r.content).toMatch(/couldn't read|could not read/i);
  });

  it('does NOT leak an ADJACENT file\'s symbols (voicePrompt.ts must not match voicePrompt.test.ts)', async () => {
    const rec = {
      ...REC,
      changedStatus: [{ code: 'M', path: 'src/core/voicePrompt.ts', additions: 10, deletions: 0 }],
      scan: {
        pr_review: { visual_summary: { key_files: { groups: [{ name: 'g', files: [{ path: 'src/core/voicePrompt.ts', why: 'voice prompt' }] }] } } },
        pr_symbols: [
          // The TEST file is listed FIRST and shares the basename stem — the old loose
          // endsWith() match returned ITS symbols for voicePrompt.ts.
          { path: 'src/core/voicePrompt.test.ts', symbols: [{ name: 'testHelper', kind: 'function', line: 5, end_line: 9 }] },
          { path: 'src/core/voicePrompt.ts', symbols: [{ name: 'buildVoiceSystemPrompt', kind: 'function', line: 30, end_line: 60 }] },
        ],
      },
    } as unknown as ScanRecord;
    const run = (t: string) => runHandoverTurn({ pr: PR, url: URL, rec, userText: t, brain: BRAIN, signal: new AbortController().signal, onProgress: () => {} });
    await run('walk me through this PR');
    mock.setActiveTab({ id: 9, url: URL });
    // Empty diff → the symbol path (the hunk path would anchor on the diff's line range,
    // not the symbol's). The symbol must still be voicePrompt.ts's own, never the test file's.
    const { getPrFile } = await import('../state/prFileStore');
    vi.mocked(getPrFile).mockResolvedValueOnce({ path: 'src/core/voicePrompt.ts', status: 'M', content: 'x', diff: '' });
    const r = await run('next');
    // beats[0] is the overview sweep; beats[1] MUST be voicePrompt.ts's own first symbol,
    // not the adjacent test file's.
    expect(r.presentation?.beats[1]).toMatchObject({ name: 'buildVoiceSystemPrompt', startLine: 30, endLine: 60 });
  });

  it('DEEPER builds a focused, repeatable sub-timeline on the CURRENT file (a new timeline)', async () => {
    // A brain that answers the question in the deep-dive shape (ANSWER: … then [H<n>]).
    const deepBrain: BrainRuntime = {
      async generate() {
        return 'ANSWER: It wraps the auth call in a retry so a flaky network is tolerated.\n[H0] The retry guards validateSession.';
      },
      async complete() {
        return '';
      },
      interrupt() {},
      free() {},
    };
    const run = (t: string) =>
      runHandoverTurn({ pr: PR, url: URL, rec: REC, userText: t, brain: deepBrain, signal: new AbortController().signal, onProgress: () => {} });
    await run('walk me through this PR');
    mock.setActiveTab({ id: 9, url: URL });
    await run('next'); // → file 1 (auth.ts)
    mock.setActiveTab({ id: 9, url: `https://github.com/o/r/pull/70/files#${await diffAnchor('src/core/auth.ts')}` });

    const r = await run('go deeper on the retry logic');
    // Stayed on the current file, produced a fresh focused timeline (clickable beats).
    expect(r.presentation?.path).toBe('src/core/auth.ts');
    expect(r.presentation?.beats.length).toBeGreaterThan(0);
    expect(r.presentation?.intro).toMatch(/Deeper on src\/core\/auth\.ts — depth 1/);
    // Level 1 is the ANSWER to the question (not the generic walkthrough overview).
    expect(r.presentation?.overview?.prChange).toContain('wraps the auth call in a retry');
    expect(r.presentation?.overview?.purpose).toContain('Deeper dive (level 1)');
    // The cursor stays put and the per-file depth is recorded — ask again to go deeper.
    const s1 = await getHandoverSession(URL);
    expect(s1?.cursor).toBe(0);
    expect(s1?.focus?.depth).toBe(1);
    const r2 = await run('tell me more');
    expect(r2.presentation?.intro).toMatch(/depth 2/); // deeper and deeper
    expect((await getHandoverSession(URL))?.focus?.depth).toBe(2);
  });

  it('DEEPER at the overview asks to open a file first', async () => {
    await turn('walk me through this PR'); // cursor -1 (overview)
    const r = await turn('go deeper');
    expect(r.presentation).toBeUndefined();
    expect(r.content).toMatch(/open one|name a file/i);
  });

  it('moving to the NEXT file clears the deep-dive focus', async () => {
    await turn('walk me through this PR');
    mock.setActiveTab({ id: 9, url: URL });
    await turn('next');
    await turn('go deeper');
    expect((await getHandoverSession(URL))?.focus?.depth).toBe(1);
    await turn('next'); // → README.md
    expect((await getHandoverSession(URL))?.focus).toBeUndefined();
  });

  it('GOTO an unknown file does not navigate and lists the plan', async () => {
    await turn('walk me through this PR');
    const before = mock.lastTabUpdate();
    const r = await turn('go to nonexistent.xyz');
    expect(r.content).toMatch(/don't see "nonexistent\.xyz"/);
    expect(mock.lastTabUpdate()).toBe(before); // no navigation
  });

  it('STOP clears the session', async () => {
    await turn('walk me through this PR');
    const r = await turn('stop');
    expect(r.handoverActive).toBe(false);
    expect(await getHandoverSession(URL)).toBeNull();
  });

  it('rebuilds a stale session when the scanned head moved', async () => {
    // Persist a session bound to an OLD sha; the turn should rebuild against REC.sha.
    await setHandoverSession({
      prUrl: URL,
      sha: 'OLD-sha',
      steps: await attachAnchors(buildHandoverPlan({ ...REC, changedStatus: [{ code: 'M', path: 'gone.ts', additions: 1, deletions: 0 }] } as ScanRecord)),
      cursor: 0,
      status: 'active',
      startedAt: 0,
    });
    await turn('where are we');
    const s = await getHandoverSession(URL);
    expect(s?.sha).toBe('sha-head'); // rebuilt
    expect(s?.steps.some((x) => x.path === 'src/core/auth.ts')).toBe(true);
    expect(s?.steps.some((x) => x.path === 'gone.ts')).toBe(false);
  });

  it("START skips navigation when already on the PR's changes page", async () => {
    mock.setActiveTab({ id: 9, url: 'https://github.com/o/r/pull/70/files' });
    await turn('walk me through this PR');
    expect(mock.lastTabUpdate()).toBeNull(); // no redundant reload
  });
});
