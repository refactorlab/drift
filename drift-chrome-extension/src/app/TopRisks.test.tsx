import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import type { DriftReport } from '../core/types';

// Keep deriveTopRisks real (it's the on-device fallback we want to render), but
// stub the brain hop so we control the upgrade timing without any network.
vi.mock('../core/riskSummary', async (orig) => {
  const actual = await orig<typeof import('../core/riskSummary')>();
  return { ...actual, summarizeRisksWithBrain: vi.fn() };
});

import { TopRisks, __resetRiskCache } from './TopRisks';
import { summarizeRisksWithBrain } from '../core/riskSummary';

const report: DriftReport = {
  found: true, verdict: 'review', verdictLabel: 'Review carefully', effortLabel: null,
  mergeConfidence: null, gauges: [], blastRadius: null, criticalCount: null,
  metricCount: null, sections: [], prUrl: null, scrapedAt: 0,
};

// A scan whose on-device ranking yields one derived risk.
const scan = {
  pr_review: {
    visual_summary: { risks: { items: [
      { label: 'Derived risk', likelihood: 0.9, severity: 0.9, quadrant: 'act_before_merge' },
    ] } },
  },
};

describe('TopRisks', () => {
  beforeEach(() => {
    __resetRiskCache();
    vi.mocked(summarizeRisksWithBrain).mockReset();
  });
  afterEach(cleanup);

  it('paints the on-device ranking first, then upgrades to Claude', async () => {
    let resolve!: (v: { rank: number; text: string }[]) => void;
    vi.mocked(summarizeRisksWithBrain).mockReturnValue(
      new Promise((r) => { resolve = r; }),
    );

    render(<TopRisks scanId="s1" scan={scan} report={report} />);

    // On-device fallback is visible immediately, badged as analyzing while the
    // brain request is in flight.
    expect(screen.getByText('Derived risk')).toBeTruthy();
    expect(screen.getByText('analyzing…')).toBeTruthy();

    // Brain replies → the card swaps to Claude's one-liners + the Claude badge.
    resolve([{ rank: 1, text: 'Claude flagged a payments bug' }]);
    await screen.findByText('Claude flagged a payments bug');
    expect(screen.getByText('✦ Claude')).toBeTruthy();
    expect(screen.queryByText('Derived risk')).toBeNull();
  });

  it('keeps the on-device list and shows the hint when the brain is offline', async () => {
    vi.mocked(summarizeRisksWithBrain).mockResolvedValue(null);

    render(<TopRisks scanId="s2" scan={scan} report={report} />);

    await waitFor(() => expect(screen.getByText('on-device')).toBeTruthy());
    expect(screen.getByText('Derived risk')).toBeTruthy();
    expect(screen.getByText(/Start drift-brain/)).toBeTruthy();
  });

  it('shows a clean-PR message when the scan flags nothing', async () => {
    vi.mocked(summarizeRisksWithBrain).mockResolvedValue(null);
    render(<TopRisks scanId="s3" scan={{ pr_review: {} }} report={report} />);
    await waitFor(() => expect(screen.getByText(/looks clean/)).toBeTruthy());
  });
});
