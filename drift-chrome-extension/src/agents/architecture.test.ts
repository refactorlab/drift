import { describe, it, expect } from 'vitest';
import { buildArchitectureOverview, ARCHITECTURE_TOKEN_CAP } from './architecture';
import { countTokens } from '../core/chatContext';
import type { ScanRecord } from '../state/scanHistory';
import type { ScanOutput } from '../core/scanOutput';

const scan: ScanOutput = {
  pr_scope: { affected_roots: ['src/core/runLiveScan.ts', 'src/agents/iterative-agent.ts'] },
  pr_review: {
    architecture_flow: {
      data_structures: [{ name: 'PrFileEntry', kind: 'new', scope: 'state' }],
      diff_merged_structured: {
        nodes: [
          { id: '1', label: 'runIterativeAgent', class: 'added' },
          { id: '2', label: 'untouched', class: 'muted' },
        ],
      },
    },
    business_logic: { summary: 'Adds an iterative file-reading agent.' },
    visual_summary: {
      key_files: { groups: [{ name: 'core', files: [{ path: 'src/agents/iterative-agent.ts', why: 'the loop' }] }] },
    },
  },
  pr_review_ext: {
    tests_in_graph: { uncovered_roots: ['src/agents/architecture.ts'] },
    nfr_edge_cases: { reliability_gaps: ['no retry on read failure'] },
    tech_debt: { high_complexity: [{ symbol: 'runIterativeAgent', file: 'iterative-agent.ts' }] },
  },
};

const record = {
  owner: 'o',
  repo: 'r',
  number: 12,
  title: 'Add iterative agent',
  verdict: 'review',
  verdictLabel: 'Review recommended',
  changedFiles: 2,
  changedStatus: [
    { code: 'A', path: 'src/agents/iterative-agent.ts', additions: 100, deletions: 0 },
    { code: 'M', path: 'src/core/chatTools.ts', additions: 40, deletions: 2 },
  ],
  commits: ['feat: iterative agent\n\nbody text', 'test: add coverage'],
  scan,
} as unknown as ScanRecord;

describe('buildArchitectureOverview', () => {
  it('surfaces the profiler architecture sections + commit intent + readable files', () => {
    const out = buildArchitectureOverview(record);
    expect(out).toContain('o/r#12');
    expect(out).toContain('Affected roots:');
    expect(out).toContain('Key files:');
    expect(out).toContain('the loop'); // key-file WHY
    expect(out).toContain('PrFileEntry');
    expect(out).toContain('runIterativeAgent [added]'); // graph delta, muted node excluded
    expect(out).not.toContain('untouched');
    expect(out).toContain('Adds an iterative file-reading agent.');
    expect(out).toContain('Uncovered roots:');
    expect(out).toContain('Reliability gaps:');
    expect(out).toContain('feat: iterative agent'); // commit SUBJECT only (no body)
    expect(out).not.toContain('body text');
    expect(out).toContain('Changed files (readable):');
    expect(out).toContain('A src/agents/iterative-agent.ts');
  });

  it('stays within the token cap', () => {
    expect(countTokens(buildArchitectureOverview(record))).toBeLessThanOrEqual(ARCHITECTURE_TOKEN_CAP);
  });

  it('falls back to changed files when the scan has no graph', () => {
    const bare = { ...record, scan: {} } as unknown as ScanRecord;
    const out = buildArchitectureOverview(bare);
    expect(out).toContain('Changed files (readable):');
    expect(out).toContain('Commit intent:');
  });
});
