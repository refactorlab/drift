// Reusable live-PR-scan CORE — the no-UI, no-audio counterpart of the pipeline
// inlined in LivePipelineRun.tsx. Extracted so the agentic chat can RUN A SCAN
// as a tool call (with progress + cancellation) and read its changed-file list,
// without dragging in React state, the step UI, or TTS.
//
// It runs the same stages LivePipelineRun does (resolve → download → scan →
// render) against the SAME cached compiled WASM module (scannerStore) and the
// SAME abort-aware helpers, and persists the result to scanHistory so the rest of
// the app (and the chat's "scan ran" state) sees it. The repo download itself is
// not byte-cached (GitHub gives no size up front), but the compiled scanner and
// the per-PR result ARE cached — a re-scan never recompiles the wasm and a prior
// scan's file list is read straight from history (no network).

import { fetchPrHead, fetchPrChangedFiles, fetchPrBody, changedRangesFromHunks, type ChangedFileStatus } from './prDiff';
import { downloadArchive } from './githubZip';
import { unzipRepoArchive } from './repoZip';
import { putPrFiles, buildPrFileEntries } from '../state/prFileStore';
import { ghWebBase } from './githubHost';
import { getCachedZipSize, setCachedZipSize } from './downloadSizeEstimate';
import { scanInWorker } from './scanWorkerClient';
import { loadScannerModule } from './scannerStore';
import { scanToReport } from './scanReport';
import { buildNarration, summaryLine, type LiveScanMeta } from './liveSummary';
import { addScan, getHistoryForPr, type ScanRecord } from '../state/scanHistory';
import { logger } from './debug';
import type { DriftReport } from './types';

const dbg = logger('scan');

/** PR identity (matches state/activePr.ts's PrId). */
export interface ScanTargetPr {
  owner: string;
  repo: string;
  number: number;
  host: string;
}

export interface LiveScanProgress {
  /** Coarse stage id, for a UI step indicator. */
  step: 'resolve' | 'download' | 'scan' | 'render';
  note: string;
}

export interface LiveScanResult {
  id: string;
  url: string;
  owner: string;
  repo: string;
  number: number;
  title: string | null;
  sha: string;
  /** Changed file paths at HEAD (the list `list_changed_files` reports). */
  changedFiles: string[];
  /** Per-file status (code + path + add/del counts). */
  changedStatus: ChangedFileStatus[];
  changedCount: number;
  /** True if the diff was line-budget-truncated (very large PR). */
  truncated: boolean;
  /** Commit messages (subject + body), oldest→newest — the PR's stated intent. */
  commits: string[];
  /** The PR's opening-comment body (author's description), or null. */
  description: string | null;
  report: DriftReport | null;
  narration: string;
  /** One-line summary, e.g. "2/5 confidence · −2.2% drift". */
  caption: string;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** The web URL of a PR (for history keys + grounding). */
export function prUrl(pr: ScanTargetPr): string {
  return `${ghWebBase(pr.host)}/${pr.owner}/${pr.repo}/pull/${pr.number}`;
}

/**
 * Run the full live scan for `pr`. Honors `signal` at every stage (resolve,
 * download, scan-worker — the worker is terminated on abort). Streams coarse
 * progress via `onProgress`. Persists the result to scanHistory and resolves
 * with the structured result. Throws AbortError if cancelled.
 */
export async function runLiveScan(
  pr: ScanTargetPr,
  opts: { signal?: AbortSignal; onProgress?: (p: LiveScanProgress) => void } = {},
): Promise<LiveScanResult> {
  const { owner, repo, number, host } = pr;
  const signal = opts.signal;
  const startedAt = Date.now();
  const log = (step: LiveScanProgress['step'], note: string) => opts.onProgress?.({ step, note });
  const url = prUrl(pr);

  dbg.log(`▶ runLiveScan ${owner}/${repo}#${number}`);

  // 1. Resolve head sha + diff + body from the stable .patch/.diff endpoints.
  log('resolve', 'resolving head + changed files…');
  const tResolve = dbg.time('resolve');
  const estimatePromise = getCachedZipSize(owner, repo).catch(() => undefined);
  const [head, diff, prBody] = await Promise.all([
    fetchPrHead(owner, repo, number, signal, host),
    fetchPrChangedFiles(owner, repo, number, signal, host),
    fetchPrBody(owner, repo, number, signal, host),
  ]);
  const title = head.title ?? null;
  tResolve();
  dbg.log(`resolve → head ${head.headSha.slice(0, 7)} · ${diff.changedPaths.length} files${diff.diffTruncated ? ' (truncated)' : ''}`);
  log('resolve', `head ${head.headSha.slice(0, 7)} · ${diff.changedPaths.length} changed file(s)`);

  // 2. Download the HEAD tree zip (cached size → exact-ish % after the first run).
  log('download', 'downloading head tree…');
  const tDl = dbg.time('download');
  const estimatedTotal = await estimatePromise.catch(() => undefined);
  const zipBytes = await downloadArchive(
    owner,
    repo,
    head.headSha,
    (p) => log('download', `downloading… ${fmtBytes(p.bytes)}`),
    signal,
    estimatedTotal,
    host,
  );
  tDl();
  dbg.log(`download → ${fmtBytes(zipBytes.length)} (estimate ${estimatedTotal ? fmtBytes(estimatedTotal) : 'none'})`);
  log('download', `${fmtBytes(zipBytes.length)} downloaded`);
  void setCachedZipSize(owner, repo, zipBytes.length);

  // 3. Unzip + execute the scanner in a worker (terminated on abort).
  log('scan', 'running static profiler…');
  const tScan = dbg.time('scan');
  const wasm = await loadScannerModule();
  const scanJson = await scanInWorker(
    zipBytes,
    wasm,
    {
      changedFiles: diff.changedPaths,
      commits: head.commits,
      diffStats: diff.diffStats,
      diffStatus: diff.diffStatus,
      diffHunks: JSON.stringify(changedRangesFromHunks(diff.fileDiffs)),
      prTitle: title ?? undefined,
      prBody,
    },
    { signal, onProgress: (p) => log('scan', p.message) },
  );
  tScan();

  // 4. Attach the literal code diff to the scan JSON (same as LivePipelineRun) so
  //    the report + any downstream consumer has the +/- lines.
  log('render', 'building report…');
  const scan: unknown = scanJson;
  if (scan && typeof scan === 'object') {
    (scan as Record<string, unknown>).pr_diff = { files: diff.fileDiffs, truncated: diff.diffTruncated || undefined };
    if (prBody) (scan as Record<string, unknown>).pr_description = prBody;
  }

  const report = scanToReport(scanJson, url);
  const meta: LiveScanMeta = { owner, repo, number, title, changedFiles: diff.changedPaths.length };
  const narration = report ? buildNarration(report, meta) : '';
  const caption = report ? summaryLine(report, meta) : `${diff.changedPaths.length} changed file(s)`;

  const ts = Date.now();
  const id = `${url}@${head.headSha}@${ts}`;
  dbg.log(`✓ scan done in ${ts - startedAt}ms · ${report ? report.verdictLabel || report.verdict : 'no verdict'} · ${diff.changedPaths.length} files`);

  // 5. Persist to history so `scan ran` is true app-wide and the file list is
  //    readable from cache later (getHistoryForPr) with no rescan.
  if (report) {
    const record: ScanRecord = {
      id,
      url,
      owner,
      repo,
      number,
      title,
      sha: head.headSha,
      ts,
      durationMs: ts - startedAt,
      caption,
      verdict: report.verdict,
      verdictLabel: report.verdictLabel,
      report,
      scan,
      narration,
      changedFiles: diff.changedPaths.length,
      changedStatus: diff.entries,
      commits: head.commits,
      description: prBody ?? null,
    };
    await addScan(record).catch(() => {});
  }

  // 5b. Cache the changed files (content @ HEAD + diff) to IndexedDB so the
  //     iterative agent's read_file is instant + offline. We reuse the ZIP we
  //     already downloaded; the unzipped tree drops out of scope right after, so
  //     nothing large is retained in RAM. Best-effort — never fail the scan.
  try {
    log('render', 'caching changed files…');
    const tree = unzipRepoArchive(zipBytes);
    const entries = buildPrFileEntries(tree, diff.fileDiffs, diff.changedPaths);
    await putPrFiles(url, head.headSha, entries);
    dbg.log(`cached ${entries.length} changed file(s) to prFileStore`);
  } catch (e) {
    dbg.warn(`prFileStore cache failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    id,
    url,
    owner,
    repo,
    number,
    title,
    sha: head.headSha,
    changedFiles: diff.changedPaths,
    changedStatus: diff.entries,
    changedCount: diff.changedPaths.length,
    truncated: !!diff.diffTruncated,
    commits: head.commits,
    description: prBody ?? null,
    report,
    narration,
    caption,
  };
}

/** Read the most recent scan for a PR from history (no network), or null. */
export async function latestScanForPr(pr: ScanTargetPr): Promise<ScanRecord | null> {
  const hist = await getHistoryForPr(prUrl(pr)).catch(() => [] as ScanRecord[]);
  return hist[0] ?? null;
}
