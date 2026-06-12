import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { installChromeMock } from '../test/chromeMock';

// The cross-PR picker: every PR with saved scans (plus the active tab's PR)
// becomes a row. Clicking the active PR's row loads its latest scan in place;
// clicking a DIFFERENT PR navigates the browser there (so useActivePr re-grounds
// the whole panel) and defers the load until we land. These tests drive the REAL
// selectPr wiring against the in-memory storage + chrome.tabs mock.

// useActivePr reads from mutable hoisted state, so a test can simulate the
// browser landing on a new PR (re-rendering then flows exactly as the real
// tabs/webNavigation-driven hook would). This is what exercises the deferred
// navigate→load handoff end to end — a constant mock never could.
// `mock`-prefixed so vitest allows it inside the hoisted vi.mock factory.
let mockActivePr: { owner: string; repo: string; number: number } | null = {
  owner: 'acme', repo: 'web', number: 7,
};
vi.mock('../state/activePr', () => ({ useActivePr: () => mockActivePr }));
// Keep the heavy report + audio surfaces out of the picker test.
vi.mock('./report/ScanReportView', () => ({ ScanReportView: () => <div data-testid="report" /> }));
vi.mock('./SpokenSummary', () => ({ SpokenSummary: () => <div data-testid="spoken" /> }));
// The top-risks card owns its own async (Claude/brain) — out of scope for the picker.
vi.mock('./TopRisks', () => ({ TopRisks: () => <div data-testid="top-risks" /> }));

import { LivePipelineRun } from './LivePipelineRun';
import { addScan, type ScanRecord } from '../state/scanHistory';
import type { DriftReport } from '../core/types';

const report: DriftReport = {
  found: true, verdict: 'review', verdictLabel: 'Review carefully', effortLabel: null,
  mergeConfidence: null, gauges: [], blastRadius: null, criticalCount: null,
  metricCount: null, sections: [], prUrl: '', scrapedAt: 0,
};

function record(over: Partial<ScanRecord>): ScanRecord {
  const url = over.url ?? 'https://github.com/acme/web/pull/7';
  return {
    id: `${url}@sha@${over.ts ?? 1000}`,
    url, owner: 'acme', repo: 'web', number: 7, title: null,
    sha: 'abcdef1234567', ts: 1000, durationMs: 1234,
    caption: 'reviewed', verdict: 'review', verdictLabel: 'Review carefully',
    report, scan: {}, narration: '', changedFiles: 1, changedStatus: [], commits: [],
    ...over,
  };
}

describe('LivePipelineRun — cross-PR picker', () => {
  beforeEach(() => {
    installChromeMock();
    mockActivePr = { owner: 'acme', repo: 'web', number: 7 }; // reset the active tab
  });
  afterEach(cleanup);

  it('clicking the active PR row (already scanned) loads its latest scan in place', async () => {
    await addScan(record({ ts: 1000 }));
    await addScan(record({ ts: 2000, id: 'https://github.com/acme/web/pull/7@sha@2000', caption: 'newest' }));

    render(<LivePipelineRun onBack={() => {}} autoScan={false} />);

    // The active PR shows as a scanned row → its run button reads "Re-run".
    await waitFor(() => expect(screen.getByText('↻ Re-run')).toBeTruthy());

    fireEvent.click(screen.getByTitle('Load the latest scan for this PR'));
    await waitFor(() => expect(screen.getByText('Past scan')).toBeTruthy());
  });

  it('lists a different scanned PR and navigates the browser to it on click', async () => {
    await addScan(
      record({
        url: 'https://github.com/foo/bar/pull/9',
        id: 'https://github.com/foo/bar/pull/9@sha@3000',
        owner: 'foo', repo: 'bar', number: 9, ts: 3000,
      }),
    );

    // Spy on the tab navigation the picker triggers for a non-active PR.
    const update = vi.fn(async () => ({ id: 1 }));
    (chrome.tabs as unknown as { update: typeof update }).update = update;

    render(<LivePipelineRun onBack={() => {}} autoScan={false} />);

    // The other PR appears as its own picker row…
    await waitFor(() => expect(screen.getByText('foo/bar #9')).toBeTruthy());

    // …and clicking it navigates the active GitHub tab to that PR's page.
    fireEvent.click(screen.getByTitle('Open this PR and load its latest scan'));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
        url: 'https://github.com/foo/bar/pull/9',
      })),
    );
  });

  it('completes the deferred load once the tab lands on the picked PR', async () => {
    await addScan(
      record({
        url: 'https://github.com/foo/bar/pull/9',
        id: 'https://github.com/foo/bar/pull/9@sha@3000',
        owner: 'foo', repo: 'bar', number: 9, ts: 3000, caption: 'foobar latest',
      }),
    );
    (chrome.tabs as unknown as { update: () => Promise<unknown> }).update = vi.fn(async () => ({ id: 1 }));

    const { rerender } = render(<LivePipelineRun onBack={() => {}} autoScan={false} />);
    await waitFor(() => expect(screen.getByText('foo/bar #9')).toBeTruthy());

    // 1. Pick the other PR — this only stashes the intent + fires navigation;
    //    nothing is loaded yet because the tab hasn't actually moved.
    fireEvent.click(screen.getByTitle('Open this PR and load its latest scan'));
    expect(screen.queryByText('Past scan')).toBeNull();

    // 2. Simulate the browser arriving on foo/bar #9 (what webNavigation/tabs
    //    events do in the extension → useActivePr updates → re-render). The
    //    deferred load must now fire on its own.
    mockActivePr = { owner: 'foo', repo: 'bar', number: 9 };
    rerender(<LivePipelineRun onBack={() => {}} autoScan={false} />);
    await waitFor(() => expect(screen.getByText('Past scan')).toBeTruthy());

    // The landed PR is now the active row, badged "current tab".
    expect(screen.getByText('current tab')).toBeTruthy();
  });
});
