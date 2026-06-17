import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock, type ChromeMock } from '../test/chromeMock';
import { runHandoverTurn } from './handover';
import { getHandoverSession, setHandoverSession } from '../state/handoverSession';
import { diffAnchor, attachAnchors } from '../core/prNavigate';
import { buildHandoverPlan } from './handoverPlan';
import type { ScanRecord } from '../state/scanHistory';
import type { BrainRuntime } from '../core/brainRuntime';
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
  scan: { pr_review: { visual_summary: { key_files: { groups: [{ name: 'g', files: [{ path: 'src/core/auth.ts', why: 'Auth rewrite' }] }] } } } },
} as unknown as ScanRecord;

const BRAIN: BrainRuntime = {
  async generate() {
    return 'EXPLANATION OF THE FILE';
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
    expect(r.content).toMatch(/Proceed to README\.md\?/); // next file teased
    expect((await getHandoverSession(URL))?.cursor).toBe(0);
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
