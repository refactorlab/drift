// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { zipSync, strToU8 } from 'fflate';

// Mock the engine so this test covers ONLY the worker's forwarding contract:
// every input (esp. diffStatus) must reach runScanPr, and the result must be
// posted back as `done`. The real engine is covered by wasmScan/cli tests.
const runScanPr = vi.fn();
vi.mock('./wasi', () => ({ runScanPr: (...a: unknown[]) => runScanPr(...a) }));

import { runScanJob, appendScannerReason } from './scanWorker';
import type { ScanWorkerMessage, ScanWorkerRequest } from './scanWorker';

describe('appendScannerReason — surfaces WHY behind an exit code', () => {
  it('appends clap\'s usage line so "exited with code 2" is not a dead end', () => {
    const tail = ['scan-pr · 800 files', "error: unexpected argument '--frobnicate' found", 'tip: …'];
    expect(appendScannerReason('scan-pr exited with code 2', tail)).toBe(
      "scan-pr exited with code 2 — error: unexpected argument '--frobnicate' found",
    );
  });

  it('prefers the most telling line (error/panic) over the last line', () => {
    const tail = ['error: invalid value for --pretty', 'some trailing info line'];
    expect(appendScannerReason('exited with code 2', tail)).toMatch(/invalid value for --pretty$/);
  });

  it('falls back to the last line when nothing matches the reason pattern', () => {
    expect(appendScannerReason('exited with code 1', ['just progress', 'last breadcrumb'])).toBe(
      'exited with code 1 — last breadcrumb',
    );
  });

  it('returns the base error unchanged when there is no log tail', () => {
    expect(appendScannerReason('boom', [])).toBe('boom');
  });

  it('does not duplicate a reason already contained in the base message', () => {
    expect(appendScannerReason('error: bad thing happened', ['error: bad thing happened'])).toBe(
      'error: bad thing happened',
    );
  });
});

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
