// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderOverview, STICKY_MARKER } from '@drift/render';
import { WasmScanProvider, type PrInput } from './scanProvider';
import { diffTrees } from './diffTrees';
import { unzipRepoArchive } from './repoZip';
import { zipSync, strToU8 } from 'fflate';
import type { FileTree } from './repoZip';

// The full in-browser pipeline, exercised in JS against the REAL compiled
// scanner: base+head trees → local diff → drift-static-profiler.wasm scan-pr →
// ScanPrOutput → action renderer. If the release wasm isn't built, skip.
const WASM = fileURLToPath(
  new URL(
    '../../../drift-static-profiler/target/wasm32-wasip1/release/drift-static-profiler.wasm',
    import.meta.url,
  ),
);
const haveWasm = existsSync(WASM);
const loadWasm = () => WebAssembly.compile(readFileSync(WASM));

const u8 = (s: string) => strToU8(s);

const BASE: FileTree = new Map([
  ['src/app.py', u8('def handler(req):\n    return process(req)\n\ndef process(req):\n    return 1\n')],
  ['README.md', u8('# demo\n')],
]);
// HEAD modifies process() to add a DB loop, and adds a new file.
const HEAD: FileTree = new Map([
  [
    'src/app.py',
    u8(
      'def handler(req):\n    return process(req)\n\ndef process(req):\n    rows = db_query("SELECT * FROM orders")\n    for r in rows:\n        enrich(r)\n    return rows\n\ndef db_query(sql): ...\ndef enrich(r): ...\n',
    ),
  ],
  ['README.md', u8('# demo\n')],
  ['src/util.py', u8('def helper():\n    return 2\n')],
]);

const describeIf = haveWasm ? describe : describe.skip;

describeIf('WasmScanProvider — real scan-pr in JS', () => {
  it('diffs trees, runs the wasm scanner, and renders the PR comment', async () => {
    // 1. Diff base vs head (the no-git, no-API changed-files step).
    const diff = diffTrees(BASE, HEAD);
    expect(diff.changedPaths).toContain('src/app.py'); // modified
    expect(diff.changedPaths).toContain('src/util.py'); // added
    expect(diff.diffStats).toMatch(/\d+\t\d+\tsrc\/app\.py/);

    // 2. Execute the real WASM scanner over the in-memory HEAD tree.
    const pr: PrInput = {
      owner: 'demo',
      repo: 'demo',
      number: 1,
      title: 'feat: add order enrichment loop',
      baseRef: 'main',
      headRef: 'feature',
      baseSha: '0',
      headSha: '1',
      changedFiles: diff.changedPaths,
      diffStats: diff.diffStats,
    };
    const provider = new WasmScanProvider(loadWasm);
    expect(await provider.isAvailable()).toBe(true);

    const report = (await provider.scan({ pr, headTree: HEAD })) as {
      schema_version: string;
      pr_scope: { changed_files: string[]; affected_roots: string[] };
      pr_review?: unknown;
    };

    // 3. It produced a real ScanPrOutput with the right scope.
    expect(report.schema_version).toMatch(/^1\./);
    expect(report.pr_scope.changed_files).toContain('src/app.py');
    expect(report.pr_scope.affected_roots.length).toBeGreaterThan(0);

    // 4. The action renderer turns it into the sticky PR comment.
    const md = renderOverview(report, { ctx: { owner: pr.owner, repo: pr.repo, prTitle: pr.title } });
    expect(md.startsWith(STICKY_MARKER)).toBe(true);
    expect(md.length).toBeGreaterThan(500);
  }, 60_000);

  it('round-trips a synthetic GitHub archive zip through unzipRepoArchive', () => {
    // GitHub wraps entries in a `repo-sha/` top dir; unzipRepoArchive strips it.
    const zipped = zipSync({
      'demo-abc123/src/app.py': u8('def f(): ...\n'),
      'demo-abc123/README.md': u8('# x\n'),
    });
    const tree = unzipRepoArchive(zipped);
    expect([...tree.keys()].sort()).toEqual(['README.md', 'src/app.py']);
  });
});
