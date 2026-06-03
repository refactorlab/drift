// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { zipSync, strToU8 } from 'fflate';

// Mock the engine so this test covers ONLY the worker's forwarding contract:
// every input (esp. diffStatus) must reach runScanPr, and the result must be
// posted back as `done`. The real engine is covered by wasmScan/cli tests.
const runScanPr = vi.fn();
vi.mock('./wasi', () => ({ runScanPr: (...a: unknown[]) => runScanPr(...a) }));

import { runScanJob } from './scanWorker';
import type { ScanWorkerMessage, ScanWorkerRequest } from './scanWorker';

beforeEach(() => runScanPr.mockReset());

// GitHub archive: entries are wrapped in a `repo-sha/` top dir.
const zip = zipSync({ 'r-abc/src/app.py': strToU8('def f(): ...\n') }).buffer as ArrayBuffer;

describe('runScanJob — the worker forwards inputs (incl. diffStatus) to the engine', () => {
  it('passes diffStatus through to runScanPr and posts the result as done', async () => {
    runScanPr.mockResolvedValue(new TextEncoder().encode('{"ok":true}'));
    const posted: ScanWorkerMessage[] = [];
    const req: ScanWorkerRequest = {
      zip,
      wasm: {} as WebAssembly.Module, // unused — engine is mocked
      inputs: {
        changedFiles: ['src/app.py'],
        diffStats: '1\t0\tsrc/app.py',
        diffStatus: 'M\tsrc/app.py\nD\tsrc/gone.py',
        prTitle: 't',
      },
    };

    await runScanJob(req, (msg) => posted.push(msg));

    // The engine saw the FULL inputs, diffStatus included.
    expect(runScanPr).toHaveBeenCalledTimes(1);
    const [, tree, inputs] = runScanPr.mock.calls[0];
    expect((tree as Map<string, unknown>).has('src/app.py')).toBe(true); // unzip happened
    expect(inputs).toMatchObject({ diffStatus: 'M\tsrc/app.py\nD\tsrc/gone.py' });

    // It reported progress and finished with `done`.
    expect(posted.some((m) => m.type === 'progress' && m.phase === 'unzip')).toBe(true);
    const done = posted.find((m) => m.type === 'done');
    expect(done).toBeDefined();
  });

  it('posts an error message instead of crashing when the job fails', async () => {
    runScanPr.mockResolvedValue(new Uint8Array()); // unreached — unzip fails first
    const posted: ScanWorkerMessage[] = [];
    const corrupt = new Uint8Array([0, 1, 2, 3, 4, 5]).buffer; // not a valid zip
    await runScanJob(
      { zip: corrupt, wasm: {} as WebAssembly.Module, inputs: { changedFiles: [] } },
      (msg) => posted.push(msg),
    );
    expect(posted.at(-1)?.type).toBe('error'); // caught + reported, no throw
    expect(runScanPr).not.toHaveBeenCalled(); // failed before reaching the engine
  });
});
