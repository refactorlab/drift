// The seam between the live-scan page and "the thing that actually executes
// drift-static-profiler scan-pr". The ONLY engine is the WASM build of the
// profiler (WasmScanProvider), run in-browser via a WASI shim against the
// unzipped HEAD tree. There is no sample/fixture path in the extension — every
// scan runs the real profiler over real downloaded source. No AI on this path.

import type { FileTree } from './repoZip';
import { runScanPr } from './wasi';

/** The PR scope, resolved without the GitHub API (page scrape + zip diff). */
export type PrInput = {
  owner: string;
  repo: string;
  number: number;
  title?: string;
  body?: string;
  baseRef: string;
  headRef: string;
  baseSha: string;
  headSha: string;
  /** Repo-relative paths changed between base..head (from the local tree diff). */
  changedFiles: string[];
  /** `adds\tdels\tpath` lines (git numstat shape). */
  diffStats?: string;
  /** `git diff --name-status` shape (`A/M/D/T\tpath`, `R<sim>\told\tnew`),
   *  reconstructed git-free from the unified diff. */
  diffStatus?: string;
  /** Commit subjects/bodies between base..head (empty without the API). */
  commits?: string[];
};

export type ScanProgress = {
  /** 0..1 within the scan step, or null when indeterminate. */
  fraction: number | null;
  message: string;
};

export type ScanRequest = {
  pr: PrInput;
  /** The downloaded + unzipped HEAD source tree the scanner walks. */
  headTree: FileTree;
  onProgress?: (p: ScanProgress) => void;
  signal?: AbortSignal;
};

/** Parsed `ScanPrOutput` (the renderer validates shape at runtime). */
export type ScanResult = unknown;

export interface ScanProvider {
  readonly id: string;
  readonly label: string;
  /** True if this engine can run right now (e.g. the .wasm is reachable). */
  isAvailable(): Promise<boolean>;
  /** Execute scan-pr and resolve the ScanPrOutput JSON. */
  scan(req: ScanRequest): Promise<ScanResult>;
}

// ── WASM provider (the real engine) ───────────────────────────────────────
// Loads the compiled drift-static-profiler.wasm and runs scan-pr over the
// in-memory HEAD tree. `loadWasm` is injected so the browser fetches the
// bundled asset while tests read it off disk — identical execution path.
export class WasmScanProvider implements ScanProvider {
  readonly id = 'wasm';
  readonly label = 'Static drift profiler (WASM)';
  private module: Promise<WebAssembly.Module> | null = null;

  constructor(private readonly loadWasm: () => Promise<WebAssembly.Module>) {}

  private get(): Promise<WebAssembly.Module> {
    return (this.module ??= this.loadWasm());
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.get();
      return true;
    } catch {
      this.module = null;
      return false;
    }
  }

  async scan(req: ScanRequest): Promise<ScanResult> {
    if (!req.headTree || req.headTree.size === 0) {
      throw new Error('the WASM scanner needs the downloaded head source tree');
    }
    if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const wasm = await this.get();
    req.onProgress?.({ fraction: null, message: `scan-pr · ${req.headTree.size} files` });
    const out = await runScanPr(wasm, req.headTree, {
      changedFiles: req.pr.changedFiles,
      commits: req.pr.commits,
      diffStats: req.pr.diffStats,
      diffStatus: req.pr.diffStatus,
      prTitle: req.pr.title,
      prBody: req.pr.body,
      onLog: (line) => req.onProgress?.({ fraction: null, message: line.slice(0, 120) }),
    });
    return JSON.parse(new TextDecoder().decode(out));
  }
}

/** The scan engine for this build — the real WASM profiler. */
export function createScanProvider(loadWasm: () => Promise<WebAssembly.Module>): ScanProvider {
  return new WasmScanProvider(loadWasm);
}
