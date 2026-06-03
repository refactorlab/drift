import { describe, expect, it } from 'vitest';
import { scanExportFilename } from './LivePipelineRun';
import type { LiveScanMeta } from '../core/liveSummary';

const meta = (p: Partial<LiveScanMeta>): LiveScanMeta => ({
  owner: 'acme',
  repo: 'web',
  number: 1423,
  title: null,
  changedFiles: 0,
  ...p,
});

describe('scanExportFilename', () => {
  it('builds a self-describing name from the repo coordinates', () => {
    expect(scanExportFilename(meta({}))).toBe('drift-scan-acme-web-pr1423.json');
  });

  it('sanitises slashes, spaces and punctuation to be filesystem-safe', () => {
    expect(scanExportFilename(meta({ owner: 'My Org/x', repo: 'cool repo!' }))).toBe(
      'drift-scan-My-Org-x-cool-repo-pr1423.json',
    );
  });

  it('falls back to "scan" when the coordinates are empty', () => {
    expect(scanExportFilename(meta({ owner: '', repo: '' }))).toBe('drift-scan-scan-pr1423.json');
  });

  it('omits a missing owner without a leading dash', () => {
    expect(scanExportFilename(meta({ owner: undefined, repo: 'web' }))).toBe(
      'drift-scan-web-pr1423.json',
    );
  });
});
