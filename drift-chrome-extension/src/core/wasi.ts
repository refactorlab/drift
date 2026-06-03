// Run the WASM build of drift-static-profiler's `scan-pr` against an in-memory
// repo, using a WASI shim — the browser equivalent of the WASI runtime the
// proof-of-concept used under Node. The unzipped HEAD tree becomes a virtual
// `/repo`; control files (changed-files, commits, numstat) and the output JSON
// live in a separate `/work` preopen so the scanner's walker never sees them.
//
// This module is environment-agnostic: browser_wasi_shim is pure JS, so the
// identical code path runs in the extension and in vitest (Node).

import {
  WASI,
  File,
  Directory,
  OpenFile,
  PreopenDirectory,
  ConsoleStdout,
  type Inode,
} from '@bjorn3/browser_wasi_shim';
import type { FileTree } from './repoZip';

/** Build a nested {name → File|Directory} map from flat repo-relative paths. */
function nestTree(tree: FileTree): Map<string, Inode> {
  const root = new Map<string, Inode>();
  for (const [path, bytes] of tree) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) continue;
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let next = dir.get(parts[i]);
      if (!(next instanceof Directory)) {
        next = new Directory(new Map<string, Inode>());
        dir.set(parts[i], next);
      }
      dir = (next as Directory).contents;
    }
    dir.set(parts[parts.length - 1], new File(bytes));
  }
  return root;
}

export type ScanPrInputs = {
  changedFiles: string[];
  commits?: string[];
  /** `adds\tdels\tpath` lines (git numstat shape). */
  diffStats?: string;
  /** `git diff --name-status` shape (`A/M/D/T\tpath`, `R<sim>\told\tnew`). Drives
   *  the scanner's BEFORE/AFTER architecture charts + removed-card rendering. */
  diffStatus?: string;
  prTitle?: string;
  prBody?: string;
  onLog?: (line: string) => void;
};

// Commit messages are NUL-separated (the action feeds `git log --format=%B%x00`).
const NUL = String.fromCharCode(0);

/** clap's exit code for a usage error (e.g. an unknown flag). Distinct from the
 *  scanner's own anyhow failures (exit 1), so it reliably signals "this wasm
 *  build doesn't understand an argument we passed". */
const CLAP_USAGE_ERROR = 2;

/**
 * Run `attempt(true)` (with `--diff-status`); if the scanner is an OLDER build
 * that predates the flag, clap rejects it with a usage error (exit 2) — so
 * transparently retry `attempt(false)` instead of failing the whole scan. The
 * native Action guards this with `--help | grep` ([action.yml]); the browser/CLI
 * can't cheaply grep the wasm, so we let it fail-and-fallback (cost is paid ONLY
 * on the rare old-wasm path, never on the happy path). Logged, never silent.
 *
 * Exported for unit testing the policy without a wasm (inject a fake `attempt`).
 */
export async function runWithDiffStatusFallback(
  attempt: (withDiffStatus: boolean) => Promise<Uint8Array>,
  hasDiffStatus: boolean,
  log: (line: string) => void,
): Promise<Uint8Array> {
  if (!hasDiffStatus) return attempt(false);
  try {
    return await attempt(true);
  } catch (e) {
    if ((e as { code?: unknown })?.code === CLAP_USAGE_ERROR) {
      log('note: scanner predates --diff-status; retrying without it (BEFORE/AFTER charts disabled)');
      return attempt(false);
    }
    throw e;
  }
}

/**
 * Execute `scan-pr` and return the raw `out.json` bytes (the ScanPrOutput the
 * renderer consumes). Throws on a non-zero exit or missing output. If a
 * `diffStatus` is supplied but the wasm is too old to accept `--diff-status`,
 * the run transparently retries without it (see `runWithDiffStatusFallback`).
 */
export async function runScanPr(
  wasm: WebAssembly.Module,
  headTree: FileTree,
  inputs: ScanPrInputs,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const log = inputs.onLog ?? (() => {});

  // One self-contained scan attempt. A fresh WASI context + instance per call so
  // a retry never inherits dirty preopen state (e.g. a half-written out.json).
  const attempt = async (withDiffStatus: boolean): Promise<Uint8Array> => {
    const repo = new PreopenDirectory('/repo', nestTree(headTree));

    const work = new Map<string, Inode>();
    work.set('changed.txt', new File(enc.encode(inputs.changedFiles.join('\n') + '\n')));
    if (inputs.commits?.length) work.set('commits.txt', new File(enc.encode(inputs.commits.join(NUL))));
    if (inputs.diffStats) work.set('stats.tsv', new File(enc.encode(inputs.diffStats)));
    if (withDiffStatus && inputs.diffStatus) work.set('status.tsv', new File(enc.encode(inputs.diffStatus)));
    const workDir = new PreopenDirectory('/work', work);

    const args = [
      'drift-static-profiler',
      'scan-pr',
      '/repo',
      '--changed-files',
      '/work/changed.txt',
      '--output',
      '/work/out.json',
      '--pretty',
    ];
    if (inputs.commits?.length) args.push('--commits', '/work/commits.txt');
    if (inputs.diffStats) args.push('--diff-stats', '/work/stats.tsv');
    if (withDiffStatus && inputs.diffStatus) args.push('--diff-status', '/work/status.tsv');
    // `--flag=value` form is immune to a leading `-` in the title/body.
    if (inputs.prTitle != null) args.push(`--pr-title=${inputs.prTitle}`);
    if (inputs.prBody != null) args.push(`--pr-body=${inputs.prBody}`);

    const wasi = new WASI(args, ['DRIFT_PROGRESS=off'], [
      new OpenFile(new File(new Uint8Array())), // fd 0 stdin
      ConsoleStdout.lineBuffered(log), // fd 1 stdout
      ConsoleStdout.lineBuffered(log), // fd 2 stderr
      repo, // fd 3 → /repo
      workDir, // fd 4 → /work
    ]);

    // Module overload → resolves to the Instance directly (the bytes overload is
    // the one that returns `{ module, instance }`).
    const instance = await WebAssembly.instantiate(wasm, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    // browser_wasi_shim's start() returns the exit code (it swallows the
    // WASIProcExit thrown by proc_exit). A guard catch covers shim variants.
    let code: number;
    try {
      code = wasi.start(instance as Parameters<WASI['start']>[0]);
    } catch (e) {
      const c = (e as { code?: unknown })?.code;
      if (typeof c === 'number') code = c;
      else throw e;
    }
    if (code !== 0) {
      // Tag the error with the exit code so the fallback can recognise a clap
      // usage error (exit 2) vs a real scan failure.
      const err = new Error(`scan-pr exited with code ${code}`) as Error & { code?: number };
      err.code = code;
      throw err;
    }

    const out = workDir.dir.contents.get('out.json');
    if (!(out instanceof File)) throw new Error('scan-pr produced no output file');
    return out.data;
  };

  return runWithDiffStatusFallback(attempt, !!inputs.diffStatus, log);
}
