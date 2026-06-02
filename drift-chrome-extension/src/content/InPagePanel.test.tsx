import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { installChromeMock, type ChromeMock } from '../test/chromeMock';
import { InPagePanel } from './InPagePanel';
import { emptyReport, type ArtifactRef, type DriftReport } from '../core/types';

// A comment-scraped report: authoritative headline (Merge 0/5), no sections yet.
const scraped: DriftReport = {
  ...emptyReport(),
  found: true,
  verdict: 'address',
  verdictLabel: 'Address before merge',
  mergeConfidence: { value: 0, outOf: 5 },
  prUrl: 'https://github.com/o/r/pull/70',
  sections: [],
};

const scanRef: ArtifactRef = {
  name: 'pr-scan.json',
  url: 'https://github.com/o/r/actions/runs/9/artifacts/2',
  kind: 'scan-report',
};

// Real ScanPrOutput shape with composite 0.33/band E and two grouped gauges.
const scanJson = JSON.stringify({
  pr_review_ext: {
    pr_quality: {
      composite: { score: 0.33, band: 'E', label: 'do not merge as-is' },
      gauges: [
        { group: 'LLM Complexity', label: 'Token footprint', score: 59, level: 'moderate', arrow: '↑' },
        { group: 'Operational', label: 'Blast radius', score: 100, level: 'critical', arrow: '↑' },
      ],
    },
  },
  pr_review: { visual_summary: { risks: [] }, code_suggestions: [] },
});

const openLens = () => fireEvent.click(screen.getByTitle('Drift Lens — PR health'));

describe('<InPagePanel> — lens load flow', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });
  afterEach(() => cleanup());

  it('renders nothing when there is no Drift report', () => {
    const { container } = render(<InPagePanel report={emptyReport()} artifacts={[]} />);
    expect(container.querySelector('.drift-launcher')).toBeNull();
  });

  it('notifies detected scan files + audio on the launcher', () => {
    render(<InPagePanel report={scraped} artifacts={[scanRef]} hasAudio />);
    expect(screen.getByText('Merge 0/5')).toBeTruthy();
    expect(screen.getByTitle('1 scan file(s) detected')).toBeTruthy();
    expect(screen.getByTitle('Spoken summary available')).toBeTruthy();
  });

  it('auto-downloads on open, shows a loading state, then renders ALL scan params', async () => {
    mock.setResponder((msg) => {
      const m = msg as { type?: string };
      if (m.type === 'FETCH_ARTIFACT') return { ok: true, fetched: { ok: true, text: scanJson, bytes: 2048 } };
      return { ok: true };
    });
    render(<InPagePanel report={scraped} artifacts={[scanRef]} />);

    openLens();
    // Downloading state appears immediately.
    expect(await screen.findByText(/Downloading full scan/i)).toBeTruthy();

    // Once loaded, every grouped param from the JSON is rendered…
    await waitFor(() => expect(screen.getByText('Token footprint')).toBeTruthy());
    expect(screen.getByText('Blast radius')).toBeTruthy();
    expect(screen.getByText('LLM Complexity')).toBeTruthy();
    expect(screen.getByText('Operational')).toBeTruthy();
    // …the footer reflects the JSON source…
    expect(screen.getByText(/Complexity & Risk from pr-scan\.json/i)).toBeTruthy();
    // …and the headline merge-confidence is the comment's 0/5, NOT composite-derived 2/5.
    expect(screen.getByText('Merge 0/5')).toBeTruthy();
    expect(screen.queryByText('Merge 2/5')).toBeNull();
  });

  it('keeps the scraped report and offers retry when the download fails', async () => {
    mock.setResponder(() => ({ ok: true, fetched: { ok: false, error: 'HTTP 404' } }));
    render(<InPagePanel report={scraped} artifacts={[scanRef]} />);

    openLens();
    await waitFor(() => expect(screen.getByText(/Couldn’t load the full scan/i)).toBeTruthy());
    expect(screen.getByText(/HTTP 404/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
    // Headline still shown from the comment.
    expect(screen.getByText('Address before merge')).toBeTruthy();
  });
});
