import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScanReportView } from './ScanReportView';
import sample from '../__fixtures__/sampleScan.json';

// Mermaid is heavy and needs real layout; stub it so the report renders fast and
// the diagram cards just receive an inert SVG. We're testing OUR composition,
// not Mermaid's output.
vi.mock('../../core/mermaid', () => ({
  renderMermaid: async () => '<svg data-testid="mmd" />',
  effectiveMermaidTheme: () => 'light',
}));

describe('ScanReportView (native report from scan-pr.json)', () => {
  it('renders the verdict, KPIs and the complexity report from the real fixture', () => {
    render(<ScanReportView scan={sample} />);

    // Verdict banner from composite.
    expect(screen.getByText('do not merge as-is')).toBeTruthy();
    expect(screen.getByText(/PR health E/)).toBeTruthy();

    // Headline KPI dials.
    expect(screen.getByText('Merge confidence')).toBeTruthy();

    // Complexity & Risk Report + a known metric label + its group. ("Token
    // footprint" appears in both the radar axis and its metric row.)
    expect(screen.getByText('Complexity & Risk Report')).toBeTruthy();
    expect(screen.getAllByText('Token footprint').length).toBeGreaterThan(0);
    expect(screen.getByText('LLM Complexity')).toBeTruthy();
  });

  it('shows a graceful empty state for a non-scan payload', () => {
    render(<ScanReportView scan={{ nope: true }} />);
    expect(screen.getByText(/No structured scan data/i)).toBeTruthy();
  });

  it('renders only the sections present (no markdown anywhere)', () => {
    const { container } = render(<ScanReportView scan={sample} />);
    // No raw markdown fences / sticky markers leaked into the DOM.
    expect(container.textContent).not.toContain('```');
    expect(container.textContent).not.toContain('<!--');
  });
});
