import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { installChromeMock } from '../test/chromeMock';

// End-to-end mount test of the live-scan pipeline. We mock the I/O edges (PR
// fetch, zip download, WASM scan, report build) and the VOICE ENGINE, but run the
// REAL run()/openRecord wiring + the REAL SpokenSummary + the REAL history/audio
// persistence (through the in-memory chrome.storage mock). This is what proves the
// user's bug end to end: after a live scan, the spoken summary is READY — never
// stuck "… Synthesizing" — and replaying it does NOT synthesize a second time.

// ── Voice engine: ONE shared fake provider (mirrors getSharedTtsProvider's
//    singleton contract). Both the pipeline's eager synth and SpokenSummary's lazy
//    path resolve to THIS instance, so its call count is the whole app's synth count.
const synthesize = vi.fn(async ({ voice }: { voice?: string }) => ({
  wav: new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]), // "RIFF"… enough to arm a blob
  durationSeconds: 12.3,
  sampleRate: 24000,
  voice: voice || 'af_heart',
  spoken: 'spoken text',
}));
const fakeProvider = { id: 'fake', label: 'Fake', isAvailable: async () => true, synthesize };
vi.mock('../core/ttsEngine', () => ({
  getSharedTtsProvider: () => fakeProvider,
  __resetSharedTtsProvider: () => {},
}));
const isTtsAvailable = vi.fn(async (..._a: unknown[]) => true);
vi.mock('../core/ttsStore', () => ({ isTtsAvailable: (...a: unknown[]) => isTtsAvailable(...a) }));

// ── PR identity + I/O edges ────────────────────────────────────────────────
vi.mock('../state/activePr', () => ({ useActivePr: () => ({ owner: 'acme', repo: 'web', number: 7, host: 'github.com' }) }));
vi.mock('../core/prDiff', () => ({
  fetchPrHead: vi.fn(async () => ({ headSha: 'deadbeefcafe', title: 'A PR', commits: ['feat: x'] })),
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

const DRIFT_REPORT = {
  found: true, verdict: 'address', verdictLabel: 'Address before merge', effortLabel: null,
  mergeConfidence: { value: 2, outOf: 5 }, gauges: [], blastRadius: null,
  criticalCount: null, metricCount: 3, sections: [], prUrl: '', scrapedAt: 0,
};
vi.mock('../core/scanReport', () => ({ scanToReport: vi.fn(() => DRIFT_REPORT) }));
vi.mock('../core/liveSummary', () => ({
  buildNarration: vi.fn(() => 'This PR changes one file. Address before merge.'),
  summaryLine: vi.fn(() => '2/5 confidence · 1 file'),
}));
// The heavy report renderer is irrelevant here — stub it so the test is fast.
vi.mock('./report/ScanReportView', () => ({ ScanReportView: () => <div data-testid="report" /> }));

import { LivePipelineRun } from './LivePipelineRun';
import { getHistoryForPr } from '../state/scanHistory';
import { getSpokenAudio } from '../state/spokenAudio';

describe('LivePipelineRun — live scan → spoken summary is ready, replay never re-synthesizes', () => {
  beforeEach(() => {
    installChromeMock();
    synthesize.mockClear();
    isTtsAvailable.mockClear();
    URL.createObjectURL = vi.fn(() => 'blob:fake') as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    window.HTMLMediaElement.prototype.play = vi.fn(async () => {}) as unknown as HTMLMediaElement['play'];
    window.HTMLMediaElement.prototype.pause = vi.fn(() => {}) as unknown as HTMLMediaElement['pause'];
  });
  afterEach(cleanup);

  it('after a live scan the card shows "Listen" (never stuck synthesizing), persists the WAV, and replay reuses it', async () => {
    render(<LivePipelineRun onBack={() => {}} />);

    fireEvent.click(screen.getByText('▶ Run scan'));

    // 1. Run completes → the result + spoken summary appear. The card is READY:
    //    "▶ Listen" is shown and "… Synthesizing" is NOT — the eager audio armed it.
    await waitFor(() => expect(screen.getByText('▶ Listen')).toBeTruthy(), { timeout: 5000 });
    expect(screen.queryByText('… Synthesizing')).toBeNull();

    // 2. Exactly ONE synthesis happened (the pipeline's eager step) — the card did
    //    not kick off a second one ("loading again").
    expect(synthesize).toHaveBeenCalledTimes(1);

    // 3. The WAV was persisted against the scan record (eager-save), so a future
    //    replay — even after a reload — is instant.
    const url = 'https://github.com/acme/web/pull/7';
    const hist = await getHistoryForPr(url);
    expect(hist).toHaveLength(1);
    expect(await getSpokenAudio(hist[0].id)).not.toBeNull();

    // 4. Replay the just-run scan from its history row. It must NOT synthesize
    //    again — the card reuses the in-memory/persisted clip and stays ready.
    fireEvent.click(screen.getByTitle(/Replay scan of/));
    await waitFor(() => expect(screen.getByText('Past scan')).toBeTruthy());
    expect(screen.getByText('▶ Listen')).toBeTruthy();
    expect(screen.queryByText('… Synthesizing')).toBeNull();
    expect(synthesize).toHaveBeenCalledTimes(1); // still 1 — no second model run
  });

  it('pressing Listen plays instantly (uses the armed clip, no extra synthesis)', async () => {
    render(<LivePipelineRun onBack={() => {}} />);
    fireEvent.click(screen.getByText('▶ Run scan'));
    await waitFor(() => expect(screen.getByText('▶ Listen')).toBeTruthy(), { timeout: 5000 });

    fireEvent.click(screen.getByText('▶ Listen'));
    // Straight to Pause (playing) — never the "… Synthesizing" state, and no new synth.
    await waitFor(() => expect(screen.getByText('❚❚ Pause')).toBeTruthy());
    expect(synthesize).toHaveBeenCalledTimes(1);
  });
});
