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
  prTitle?: string;
  prBody?: string;
  onLog?: (line: string) => void;
};

// Commit messages are NUL-separated (the action feeds `git log --format=%B%x00`).
const NUL = String.fromCharCode(0);

/**
 * Execute `scan-pr` and return the raw `out.json` bytes (the ScanPrOutput the
 * renderer consumes). Throws on a non-zero exit or missing output.
 */
export async function runScanPr(
  wasm: WebAssembly.Module,
  headTree: FileTree,
  inputs: ScanPrInputs,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const repo = new PreopenDirectory('/repo', nestTree(headTree));

  const work = new Map<string, Inode>();
  work.set('changed.txt', new File(enc.encode(inputs.changedFiles.join('\n') + '\n')));
  if (inputs.commits?.length) work.set('commits.txt', new File(enc.encode(inputs.commits.join(NUL))));
  if (inputs.diffStats) work.set('stats.tsv', new File(enc.encode(inputs.diffStats)));
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
  // `--flag=value` form is immune to a leading `-` in the title/body.
  if (inputs.prTitle != null) args.push(`--pr-title=${inputs.prTitle}`);
  if (inputs.prBody != null) args.push(`--pr-body=${inputs.prBody}`);

  const log = inputs.onLog ?? (() => {});
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
  if (code !== 0) throw new Error(`scan-pr exited with code ${code}`);

  const out = workDir.dir.contents.get('out.json');
  if (!(out instanceof File)) throw new Error('scan-pr produced no output file');
  return out.data;
}
