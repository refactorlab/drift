// CHANGE COLLECTOR — guarantees a handover step has the REAL per-file diff to summarize.
//
// SINGLE RESPONSIBILITY: return ONE changed file's unified-diff text. The caller prefers the
// scan's cached diff; when that's missing — a key file dropped by the file store's size /
// eviction budget, or a head-sha the cache never held — this FETCHES the PR's `.diff` from
// GitHub (the SAME same-origin endpoint the scanner uses, so private repos authenticate via
// the session cookie) and extracts this file's hunks. Without it, a file with no cached diff
// produced meaningless "Change in <symbol>" notes — there was no before/after to ground on.
//
// One PR-diff download is MEMOISED per (url, sha), so it serves every file in the walkthrough
// from a single fetch, and it is BEST-EFFORT: any failure resolves to '' so the walkthrough
// degrades gracefully (to the symbol map) instead of throwing.

import type { PrId } from '../core/prRefs';
import { fetchPrChangedFiles, type DiffResult } from '../core/prDiff';
import { fileDiffToText } from '../state/prFileStore';
import { logger } from '../core/debug';

const log = logger('change-collector');

/** Memoised PR-diff fetches, keyed by `${url}@${sha}` — one download per walkthrough. */
const cache = new Map<string, Promise<DiffResult | null>>();

/** Drop the memo (tests, and a hard re-scan). */
export function resetChangeCollectorCache(): void {
  cache.clear();
}

function fetchOnce(pr: PrId, url: string, sha: string, signal: AbortSignal): Promise<DiffResult | null> {
  const key = `${url}@${sha}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchPrChangedFiles(pr.owner, pr.repo, pr.number, signal, pr.host).catch((e) => {
      log.warn(`collect diff failed for ${url}`, e);
      cache.delete(key); // a transient network error shouldn't poison the PR — allow a retry
      return null;
    });
    cache.set(key, p);
  }
  return p;
}

/** This file's diff text within the PR diff — matched exact-first, then a path-boundary-safe
 *  suffix (the leading "/" stops `voicePrompt.ts` matching `…/voicePrompt.test.ts`). */
function findFileDiff(result: DiffResult, path: string): string {
  const hit =
    result.fileDiffs.find((d) => d.path === path) ??
    result.fileDiffs.find((d) => d.path.endsWith('/' + path) || path.endsWith('/' + d.path));
  return hit ? fileDiffToText(hit) : '';
}

export interface CollectFileDiffInput {
  pr: PrId;
  /** The PR web URL — the memo key together with `sha`. */
  url: string;
  /** The scanned head sha — keys the memo so a moved PR re-fetches. */
  sha: string;
  /** The changed file's path at HEAD. */
  path: string;
  signal: AbortSignal;
}

/** The file's unified-diff text from GitHub's `.diff`, or '' when unavailable. Best-effort —
 *  never throws. */
export async function collectFileDiff(input: CollectFileDiffInput): Promise<string> {
  const result = await fetchOnce(input.pr, input.url, input.sha, input.signal);
  if (!result) return '';
  const text = findFileDiff(result, input.path);
  log(`collect ${input.path}: ${text ? `${text.split('\n').length} diff line(s)` : 'not in PR diff'}`);
  return text;
}
