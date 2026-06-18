import { describe, expect, it } from 'vitest';
import {
  buildFileCorrelation,
  correlationContext,
  fallbackOverview,
  isDescriptiveWhy,
  resolveOverview,
  type FileCorrelation,
} from './fileBriefing';
import type { ScanRecord } from '../state/scanHistory';
import type { HandoverStep } from '../state/handoverSession';
import type { FileSymbol } from './scrollPlan';

const step = (over: Partial<HandoverStep> = {}): HandoverStep => ({
  path: 'src/app/LivePipelineRun.tsx',
  code: 'M',
  tier: 'critical',
  rationale: 'Key file',
  additions: 371,
  deletions: 103,
  ...over,
});

const SYMBOLS: FileSymbol[] = [
  { name: 'loadWasmModule', kind: 'function', line: 53, end_line: 57 },
  { name: 'fmtMs', kind: 'function', line: 82, end_line: 85 },
];

const rec = (scan: unknown): ScanRecord => ({ url: 'u', sha: 's', scan } as unknown as ScanRecord);

describe('isDescriptiveWhy', () => {
  it('keeps prose, drops graph metrics', () => {
    expect(isDescriptiveWhy('Runs the live PR scan and renders progress')).toBe(true);
    expect(isDescriptiveWhy('744 root(s) reach this file')).toBe(false);
    expect(isDescriptiveWhy('120 node(s)')).toBe(false);
    expect(isDescriptiveWhy('')).toBe(false);
    expect(isDescriptiveWhy(undefined)).toBe(false);
  });
});

describe('buildFileCorrelation', () => {
  it('pulls the descriptive key-why, matched root, and FILE-SCOPED call-graph nodes', () => {
    const corr = buildFileCorrelation(
      rec({
        pr_scope: { affected_roots: ['src/app', 'src/core'] },
        pr_review: {
          visual_summary: { key_files: { groups: [{ name: 'g', files: [{ path: 'src/app/LivePipelineRun.tsx', why: 'Runs the live PR scan' }] }] } },
          architecture_flow: {
            diff_merged_structured: {
              nodes: [
                { id: '1', label: 'loadWasmModule', class: 'added' }, // matches a symbol → kept
                { id: '2', label: 'DuplexCascade', class: 'added' }, // unrelated → dropped (no whole-PR theme leak)
              ],
            },
            data_structures: [{ name: 'fmtMs', kind: 'new' }],
          },
        },
      }),
      step(),
      SYMBOLS,
    );
    expect(corr.keyWhy).toBe('Runs the live PR scan');
    expect(corr.root).toBe('src/app');
    expect(corr.touchedNodes).toEqual(['loadWasmModule']);
    expect(corr.touchedNodes).not.toContain('DuplexCascade');
    expect(corr.dataStructures).toEqual(['fmtMs']);
  });

  it('drops a graph-metric key-why', () => {
    const corr = buildFileCorrelation(
      rec({ pr_review: { visual_summary: { key_files: { groups: [{ name: 'g', files: [{ path: 'src/app/LivePipelineRun.tsx', why: '744 root(s) reach this file' }] }] } } } }),
      step(),
      SYMBOLS,
    );
    expect(corr.keyWhy).toBe('');
  });
});

describe('correlationContext', () => {
  it('renders the present signals as a compact block; empty when nothing file-specific', () => {
    const ctx = correlationContext({ keyWhy: 'Runs the scan', root: 'src/app', touchedNodes: ['loadWasmModule'], dataStructures: [], tier: 'critical' });
    expect(ctx).toContain('How this file fits the change:');
    expect(ctx).toContain('Runs the scan');
    expect(ctx).toContain('src/app');
    expect(ctx).toContain('loadWasmModule');
    expect(correlationContext({ keyWhy: '', root: '', touchedNodes: [], dataStructures: [], tier: 'support' })).toBe('');
  });
});

describe('fallbackOverview', () => {
  const corr = (over: Partial<FileCorrelation> = {}): FileCorrelation => ({ keyWhy: '', root: '', touchedNodes: [], dataStructures: [], tier: 'core', ...over });

  it('Level 1 carries the flow role (key-why), not just +/−', () => {
    const o = fallbackOverview(step(), corr({ keyWhy: 'Runs the live PR scan and renders progress' }), SYMBOLS);
    expect(o.prChange).toContain('modifies LivePipelineRun.tsx');
    expect(o.prChange).toContain('Runs the live PR scan and renders progress');
  });

  it('Level 1 uses the area it lives under — NEVER the circular "wired into the call-graph" line', () => {
    // The call-graph node list is no longer the headline (it read as noise in the bug report);
    // touchedNodes alone leaves a clean structural line, while the root names where it lives.
    const fromNodes = fallbackOverview(step(), corr({ touchedNodes: ['loadWasmModule', 'fmtMs'] }), SYMBOLS).prChange;
    expect(fromNodes).not.toContain('wired into');
    expect(fromNodes).not.toContain('call-graph');
    expect(fallbackOverview(step(), corr({ root: 'src/app' }), SYMBOLS).prChange).toContain('src/app');
  });

  it('Level 1 is a clean structural line when there is NO correlation signal', () => {
    const o = fallbackOverview(step({ path: 'src/core/riskSummary.ts', additions: 12, deletions: 3 }), corr(), SYMBOLS);
    expect(o.prChange).toBe('This PR modifies riskSummary.ts (+12/−3).');
    expect(o.prChange).not.toMatch(/root\(s\)/);
  });

  it('Level 2 names real symbols and the root flow', () => {
    const o = fallbackOverview(step(), corr({ root: 'src/app' }), SYMBOLS);
    expect(o.purpose).toContain('Defines loadWasmModule, fmtMs.');
    expect(o.purpose).toContain('src/app');
  });

  it('Level 2 drops synthetic <module> symbols', () => {
    const o = fallbackOverview(step(), corr(), [{ name: '<module>', kind: 'module', line: 1, end_line: 9 }, ...SYMBOLS]);
    expect(o.purpose).not.toContain('<module>');
    expect(o.purpose).toContain('loadWasmModule');
  });
});

describe('resolveOverview', () => {
  const corr: FileCorrelation = { keyWhy: 'Runs the live PR scan', root: 'src/app', touchedNodes: [], dataStructures: [], tier: 'critical' };

  it('keeps the model words when present', () => {
    const o = resolveOverview('PR: Adds estimated download progress.\nFILE: Renders the live run.\nDETAIL: Polls the scanner.', step(), corr, SYMBOLS);
    expect(o.prChange).toBe('Adds estimated download progress.');
    expect(o.purpose).toContain('Renders the live run.');
    expect(o.purpose).toContain('Polls the scanner.');
  });

  it('falls back to the correlation-grounded line when the model gives no header', () => {
    const o = resolveOverview('prose with no tags at all', step(), corr, SYMBOLS);
    expect(o.prChange).toContain('modifies LivePipelineRun.tsx');
    expect(o.prChange).toContain('Runs the live PR scan');
    expect(o.purpose).toContain('Defines loadWasmModule, fmtMs.');
  });
});
