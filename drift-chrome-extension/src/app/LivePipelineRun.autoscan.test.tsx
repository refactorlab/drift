import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { installChromeMock } from '../test/chromeMock';

// The headline behaviour: opening the panel auto-handles the active PR ONCE per
// session — replay the latest scan if one exists, else run a fresh scan — and
// never re-fires on a return visit.

// ── Voice engine + TTS stubs (run() synthesizes a spoken summary). ──
const synthesize = vi.fn(async ({ voice }: { voice?: string }) => ({
  wav: new Uint8Array([82, 73, 70, 70]), durationSeconds: 1, sampleRate: 24000,
  voice: voice || 'af_heart', spoken: 's',
}));
vi.mock('../core/ttsEngine', () => ({
  getSharedTtsProvider: () => ({ id: 'fake', label: 'Fake', isAvailable: async () => true, synthesize }),
  __resetSharedTtsProvider: () => {},
}));
vi.mock('../core/ttsStore', () => ({ isTtsAvailable: async () => true }));

// ── PR identity + I/O edges (mocked so run() completes deterministically). ──
vi.mock('../state/activePr', () => ({ useActivePr: () => ({ owner: 'acme', repo: 'web', number: 7 }) }));
const fetchPrHead = vi.fn(async () => ({ headSha: 'deadbeefcafe', title: 'A PR', commits: ['feat: x'] }));
vi.mock('../core/prDiff', () => ({
  fetchPrHead: (...a: unknown[]) => fetchPrHead(...(a as [])),
  fetchPrChangedFiles: vi.fn(async () => ({
    changedPaths: ['a.ts'], diffStats: '1\t0\ta.ts', diffStatus: 'M\ta.ts',
    entries: [{ path: 'a.ts', status: 'M', adds: 1, dels: 0 }],
    fileDiffs: [{ newPath: 'a.ts', oldPath: 'a.ts', status: 'M', hunks: [], truncated: false }],
    diffTruncated: false,
  })),
  fetchPrBody: vi.fn(async () => 'PR body'),
}));
vi.mock('../core/githubZip', () => ({ downloadArchive: vi.fn(async () => new Uint8Array([1, 2, 3])) }));
vi.mock('../core/scanWorkerClient', () => ({ scanInWorker: vi.fn(async () => ({ pr_review: {} })) }));
vi.mock('../core/scannerStore', () => ({ loadScannerModule: vi.fn(async () => ({})) }));
vi.mock('../core/scanReport', () => ({
  scanToReport: vi.fn(() => ({
    found: true, verdict: 'address', verdictLabel: 'Address before merge', effortLabel: null,
    mergeConfidence: { value: 2, outOf: 5 }, gauges: [], blastRadius: null,
    criticalCount: null, metricCount: 3, sections: [], prUrl: '', scrapedAt: 0,
  })),
}));
vi.mock('../core/liveSummary', () => ({
  buildNarration: vi.fn(() => 'One file changed. Address before merge.'),
  summaryLine: vi.fn(() => '2/5 confidence · 1 file'),
}));
vi.mock('./report/ScanReportView', () => ({ ScanReportView: () => <div data-testid="report" /> }));
vi.mock('./SpokenSummary', () => ({ SpokenSummary: () => <div data-testid="spoken" /> }));
vi.mock('./TopRisks', () => ({ TopRisks: () => <div data-testid="top-risks" /> }));

import { LivePipelineRun } from './LivePipelineRun';
import { addScan, getHistoryForPr, type ScanRecord } from '../state/scanHistory';
import { __resetSessionScans } from '../state/sessionScan';
import type { DriftReport } from '../core/types';

const report: DriftReport = {
  found: true, verdict: 'review', verdictLabel: 'Review carefully', effortLabel: null,
  mergeConfidence: null, gauges: [], blastRadius: null, criticalCount: null,
  metricCount: null, sections: [], prUrl: '', scrapedAt: 0,
};

function record(over: Partial<ScanRecord>): ScanRecord {
  const url = 'https://github.com/acme/web/pull/7';
  return {
    id: `${url}@sha@${over.ts ?? 1000}`, url, owner: 'acme', repo: 'web', number: 7,
    title: null, sha: 'abcdef1234567', ts: 1000, durationMs: 10, caption: 'reviewed',
    verdict: 'review', verdictLabel: 'Review carefully', report, scan: {}, narration: '',
    changedFiles: 1, changedStatus: [], commits: [], ...over,
  };
}

describe('LivePipelineRun — auto-scan on open (session-gated)', () => {
  beforeEach(() => {
    installChromeMock();
    __resetSessionScans();
    fetchPrHead.mockClear();
    synthesize.mockClear();
    URL.createObjectURL = vi.fn(() => 'blob:fake') as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    window.HTMLMediaElement.prototype.play = vi.fn(async () => {}) as unknown as HTMLMediaElement['play'];
    window.HTMLMediaElement.prototype.pause = vi.fn(() => {}) as unknown as HTMLMediaElement['pause'];
  });
  afterEach(cleanup);

  it('auto-LOADS the latest scan when the PR already has history (no fresh scan)', async () => {
    await addScan(record({ ts: 1000 }));
    await addScan(record({ ts: 2000, id: 'https://github.com/acme/web/pull/7@sha@2000', caption: 'newest' }));

    render(<LivePipelineRun onBack={() => {}} />); // autoScan defaults on

    // The newest scan is replayed on its own — the hero badges it "Past scan".
    await screen.findByText('Past scan');
    expect(fetchPrHead).not.toHaveBeenCalled(); // loaded from history, did not re-scan
  });

  it('auto-RUNS a fresh scan when the PR has no history, and never re-fires that session', async () => {
    render(<LivePipelineRun onBack={() => {}} />);

    // The scan kicks off without any click and completes, persisting a record.
    await waitFor(() => expect(fetchPrHead).toHaveBeenCalledTimes(1));
    await waitFor(async () =>
      expect(await getHistoryForPr('https://github.com/acme/web/pull/7')).toHaveLength(1),
    );

    // Returning to the same PR this session (remount) must NOT scan again.
    cleanup();
    render(<LivePipelineRun onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('↻ Re-run')).toBeTruthy());
    expect(fetchPrHead).toHaveBeenCalledTimes(1); // still one — the session guard held
  });
});
