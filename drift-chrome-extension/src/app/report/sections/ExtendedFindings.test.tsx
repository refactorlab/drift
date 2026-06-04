// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ExtendedFindings } from './ExtendedFindings';
import type { PrReviewExt } from '../../../core/scanOutput';

afterEach(cleanup);

// Mirrors the real scan-pr.json shape: tech-debt findings carry node_id/kind/
// line (no symbol/file), and a duplication cluster is one symbol repeated
// across files.
const EXT: PrReviewExt = {
  tech_debt: {
    summary_findings_top: [
      {
        kind: 'recursive',
        line: 49,
        severity: 'high',
        node_id:
          '/repo/workspaces/disputes/src/submission-service/adapters/PspAdapterRegistry.ts::PspAdapterRegistry::has',
      },
    ],
  },
  duplication: {
    threshold: 95,
    count: 1,
    clusters: [
      {
        members: [
          { name: 'getAgentTypePromptTemplate', file: 'workspaces/disputes/src/a/DisputeResponseService.ts' },
          { name: 'getAgentTypePromptTemplate', file: 'workspaces/disputes/src/b/ResponseServiceAclHandlerService.ts' },
        ],
      },
    ],
  },
};

function openAll() {
  for (const btn of screen.getAllByRole('button')) fireEvent.click(btn);
}

describe('ExtendedFindings', () => {
  it('derives a real tech-debt symbol from node_id — never the literal "symbol"', () => {
    const { container } = render(<ExtendedFindings ext={EXT} />);
    openAll();
    const text = container.textContent ?? '';
    // the qualified symbol parsed out of the node_id
    expect(text).toContain('PspAdapterRegistry::has');
    // its kind + file:line context
    expect(text).toContain('recursive');
    expect(text).toContain('PspAdapterRegistry.ts:49');
    // the bug we fixed: a list item that is exactly the word "symbol"
    expect(screen.queryByText('symbol')).toBeNull();
  });

  it('shows a duplication cluster as one name + its files, not a repeated name', () => {
    const { container } = render(<ExtendedFindings ext={EXT} />);
    openAll();
    const text = container.textContent ?? '';
    // name appears once, with a copy count and the file basenames
    expect(text).toContain('getAgentTypePromptTemplate · 2 copies');
    expect(text).toContain('DisputeResponseService.ts');
    expect(text).toContain('ResponseServiceAclHandlerService.ts');
    // the old bug: "name · name" repetition
    expect(text).not.toContain('getAgentTypePromptTemplate · getAgentTypePromptTemplate');
  });
});
