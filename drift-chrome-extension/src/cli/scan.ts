// Headless `scan-pr`, run from the terminal — the EXACT pipeline the side panel
// runs, minus the browser. No GitHub REST API, no git, no `.git` in the archive:
// the diff is reconstructed git-free from GitHub's same-origin `.patch`/`.diff`
// raw endpoints (NOT the REST API), and the scan is the real
// drift-static-profiler.wasm executed in-memory through the WASI shim — byte for
// byte the modules the extension uses (`prDiff`, `githubZip`, `repoZip`, `wasi`).
//
// The single deliberate difference from the side panel: there's no Web Worker.
// A CLI has no UI thread to keep responsive, so the unzip + scan run inline on
// the main thread. The engine call (`runScanPr`) is identical.
//
// This file is side-effect-free (pure exports) so vitest can import `parsePrUrl`
// / `runCli` directly; the executable entry lives in `run.ts`.

import { readFile, writeFile } from 'node:fs/promises';
import { fetchPrHead, fetchPrChangedFiles } from '../core/prDiff';
import { downloadArchive } from '../core/githubZip';
import { unzipRepoArchive } from '../core/repoZip';
import { runScanPr } from '../core/wasi';

/** The bundled release scanner — same artifact the extension ships in its zip. */
export const WASM_URL = new URL('../../public/drift-static-profiler.wasm', import.meta.url);

export type CliOptions = {
  prUrl: string;
  /** Write JSON here; stdout when omitted. */
  out?: string;
  pretty: boolean;
};

export type PrRef = { owner: string; repo: string; number: number };

/** Accepts a full PR URL or the `owner/repo#number` shorthand. */
export function parsePrUrl(input: string): PrRef {
  const url = input.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (url) return { owner: url[1], repo: url[2], number: Number(url[3]) };
  const short = input.match(/^([^/\s]+)\/([^/\s#]+)#(\d+)$/);
  if (short) return { owner: short[1], repo: short[2], number: Number(short[3]) };
  throw new Error(
    `not a GitHub PR reference: "${input}"\n` +
      `  expected https://github.com/<owner>/<repo>/pull/<n>  or  <owner>/<repo>#<n>`,
  );
}

export function parseArgs(argv: string[]): CliOptions {
  let prUrl = '';
  let out: string | undefined;
  let pretty = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pretty') pretty = true;
    else if (a === '--out' || a === '-o') out = argv[++i];
    else if (a.startsWith('--out=')) out = a.slice('--out='.length);
    else if (a.startsWith('-')) throw new Error(`unknown flag: ${a}`);
    else if (!prUrl) prUrl = a;
    else throw new Error(`unexpected argument: ${a}`);
  }
  if (!prUrl) throw new Error('missing <pr-url>');
  return { prUrl, out, pretty };
}

export type RunHooks = { log?: (msg: string) => void; signal?: AbortSignal };

/**
 * Resolve → download → unzip in-memory → run the wasm scanner. Returns the
 * parsed `ScanPrOutput` JSON (identical to what the extension renders). Throws
 * with a useful message on any HTTP/zip/scan failure.
 */
export async function runCli(opts: CliOptions, hooks: RunHooks = {}): Promise<unknown> {
  const log = hooks.log ?? (() => {});
  const { signal } = hooks;
  const { owner, repo, number } = parsePrUrl(opts.prUrl);

  // 1. Resolve head SHA + the git-free diff from the raw .patch/.diff endpoints.
  log(`resolving ${owner}/${repo}#${number} …`);
  const [head, diff] = await Promise.all([
    fetchPrHead(owner, repo, number, signal),
    fetchPrChangedFiles(owner, repo, number, signal),
  ]);
  log(`head ${head.headSha.slice(0, 7)} · ${diff.changedPaths.length} changed file(s)`);

  // 2. Download ONLY the head tree by sha (the diff already gave us the scope).
  const zip = await downloadArchive(owner, repo, head.headSha, (p) => log(p.phase), signal);

  // 3. Unzip in memory + run the real wasm scanner over it (no worker; inline).
  const tree = unzipRepoArchive(zip);
  log(`unzipped ${tree.size} files · scan-pr …`);
  const wasm = await WebAssembly.compile(await readFile(WASM_URL));
  const out = await runScanPr(wasm, tree, {
    changedFiles: diff.changedPaths,
    diffStats: diff.diffStats,
    diffStatus: diff.diffStatus,
    commits: head.commits,
    prTitle: head.title,
    onLog: (line) => log(line),
  });
  const report = JSON.parse(new TextDecoder().decode(out));
  // Attach the literal +/- code diff (collected from the .diff — the scanner has
  // no base tree to produce it) so it travels inside the scan-pr JSON.
  if (report && typeof report === 'object') {
    report.pr_diff = { files: diff.fileDiffs, truncated: diff.diffTruncated || undefined };
  }
  return report;
}

/** CLI body: parse args, scan, emit JSON. Returns the process exit code. */
export async function main(argv: string[]): Promise<number> {
  const opts = parseArgs(argv);
  const report = await runCli(opts, { log: (m) => process.stderr.write(`▸ ${m}\n`) });
  const json = JSON.stringify(report, null, opts.pretty ? 2 : 0);
  if (opts.out) {
    await writeFile(opts.out, json);
    process.stderr.write(`✓ wrote ${opts.out}\n`);
  } else {
    process.stdout.write(json + '\n');
  }
  return 0;
}
