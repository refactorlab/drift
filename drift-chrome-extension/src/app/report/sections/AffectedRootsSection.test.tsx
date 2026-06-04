// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AffectedRootsSection } from './AffectedRootsSection';
import type { ScanOutput } from '../../../core/scanOutput';

afterEach(cleanup);

const REPORT: ScanOutput = {
  pr_scope: {
    affected_roots: [
      'createTestServer',
      'anon <routes.integration.test.ts:138>',
      'createTestServer', // dup → collapsed
      'OldService.ts',
    ],
  },
  pr_review: {
    architecture_flow: {
      diff_merged_structured: {
        nodes: [
          { id: 'n0', label: 'createTestServer', class: 'added' },
          { id: 'n1', label: 'anon <routes.integration.test.ts:138>', class: 'changed' },
          { id: 'n2', label: 'OldService.ts', class: 'removed' },
        ],
      },
    },
  },
} as ScanOutput;

describe('AffectedRootsSection', () => {
  it('lists impacted symbols with their line/class label + diff status, deduped', () => {
    const { container } = render(<AffectedRootsSection report={REPORT} />);
    expect(screen.getByText('Affected roots')).toBeTruthy();
    const text = container.textContent ?? '';
    // the labels carry the line/class detail the user wants
    expect(text).toContain('createTestServer');
    expect(text).toContain('anon <routes.integration.test.ts:138>');
    // status badges from the structured graph
    for (const s of ['added', 'changed', 'removed']) {
      expect(screen.getAllByText(s).length).toBeGreaterThan(0);
    }
    // dedup: createTestServer appears once in the list (plus possibly the count badge)
    const rows = container.querySelectorAll('.rp-root');
    expect(rows.length).toBe(3);
  });

  it('renders nothing when there are no affected roots', () => {
    const { container } = render(<AffectedRootsSection report={{ pr_scope: { affected_roots: [] } } as ScanOutput} />);
    expect(container.firstChild).toBeNull();
  });
});
