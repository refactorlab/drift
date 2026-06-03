// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parsePrUrl, parseArgs, WASM_URL } from './scan';
import { runScanPr } from '../core/wasi';
import { parseUnifiedDiff } from '../core/prDiff';
import { strToU8 } from 'fflate';
import type { FileTree } from '../core/repoZip';

describe('CLI arg parsing (pure, no network)', () => {
  it('parses a full PR URL', () => {
    expect(parsePrUrl('https://github.com/octo/repo/pull/42')).toEqual({
      owner: 'octo',
      repo: 'repo',
      number: 42,
    });
  });
  it('parses owner/repo#n shorthand', () => {
    expect(parsePrUrl('octo/repo#7')).toEqual({ owner: 'octo', repo: 'repo', number: 7 });
  });
  it('rejects non-PR input', () => {
    expect(() => parsePrUrl('https://github.com/octo/repo')).toThrow();
  });
  it('parses flags: --pretty and -o/--out', () => {
    expect(parseArgs(['octo/repo#1', '--pretty'])).toMatchObject({ pretty: true });
    expect(parseArgs(['octo/repo#1', '-o', 'x.json'])).toMatchObject({ out: 'x.json' });
    expect(parseArgs(['octo/repo#1', '--out=y.json'])).toMatchObject({ out: 'y.json' });
  });
  it('requires a PR reference', () => {
    expect(() => parseArgs(['--pretty'])).toThrow(/missing/);
  });
});

// End-to-end against the REAL bundled wasm: prove a git-free `--diff-status`
// (with a deletion the HEAD tree doesn't contain) flows through runScanPr and
// makes the architecture flow render the red removed-card node. Skips if the
// bundled scanner isn't present.
const haveWasm = existsSync(fileURLToPath(WASM_URL));
const describeIf = haveWasm ? describe : describe.skip;

describeIf('diff-status reaches the wasm scanner', () => {
  it('renders a removed-card for a D-status file absent from HEAD', async () => {
    const HEAD: FileTree = new Map([
      [
        'src/app.py',
        strToU8('def handler(req):\n    return process(req)\n\ndef process(req):\n    return 1\n'),
      ],
    ]);
    // A diff that modifies app.py and DELETES gone.py (not in the HEAD tree).
    const diff = parseUnifiedDiff(`diff --git a/src/app.py b/src/app.py
--- a/src/app.py
+++ b/src/app.py
@@ -1 +1,2 @@
-    return 1
+    return process(req)
+    return 2
diff --git a/src/gone.py b/src/gone.py
deleted file mode 100644
--- a/src/gone.py
+++ /dev/null
@@ -1,2 +0,0 @@
-def gone():
-    pass
`);
    expect(diff.changedPaths).toEqual(['src/app.py']); // delete excluded from scope
    expect(diff.diffStatus).toContain('D\tsrc/gone.py');

    const wasm = await WebAssembly.compile(readFileSync(fileURLToPath(WASM_URL)));
    const out = await runScanPr(wasm, HEAD, {
      changedFiles: diff.changedPaths,
      diffStats: diff.diffStats,
      diffStatus: diff.diffStatus,
      prTitle: 'feat: tweak handler, drop gone.py',
    });
    const report = JSON.parse(new TextDecoder().decode(out));
    const json = JSON.stringify(report);

    expect(report.pr_scope.changed_files).toContain('src/app.py');
    expect(report.pr_scope.changed_files).not.toContain('src/gone.py');
    // The deletion surfaces as a removed-card in the BEFORE chart — the whole
    // reason --diff-status exists. (Without the flag it would be absent.)
    expect(json).toContain('gone.py');
    expect(json).toMatch(/removed/);
  }, 60_000);
});
