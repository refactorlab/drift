// Persistent history of live scans, so a past report can be replayed without
// re-downloading the tree and re-running the WASM profiler — and so re-running
// a PR is one click. Stored as a single newest-first list in
// chrome.storage.local, capped per-PR and overall to stay well inside quota.

import type { DriftReport } from '../core/types';
import type { ChangedFileStatus } from '../core/prDiff';

const STORAGE_KEY = 'drift:scan-history';
/** Keep at most this many scans for any single PR (newest win). */
export const MAX_PER_PR = 10;
/** Hard ceiling across all PRs, to bound storage growth. */
export const MAX_TOTAL = 40;

export interface ScanRecord {
  /** Stable id: PR url + head sha + timestamp. */
  id: string;
  url: string;
  owner: string;
  repo: string;
  number: number;
  title: string | null;
  /** Head sha the scan ran against. */
  sha: string;
  /** When the scan finished (epoch ms). */
  ts: number;
  /** Wall-clock cost of the run, for the history row. */
  durationMs: number;
  /** One-line caption, e.g. "2/5 confidence · −2.2% drift · 0 risks · 35 files". */
  caption: string;
  verdict: DriftReport['verdict'];
  verdictLabel: string;
  /** Parsed report — drives the summary cards + grounds the chat. */
  report: DriftReport;
  /** Raw scan-pr.json (ScanPrOutput) — replays the native React report. */
  scan: unknown;
  /** Spoken-summary script for the past run. */
  narration: string;
  changedFiles: number;
  /** Per-file git status (the literal diff) so a replayed report shows the
   *  Changed-files section without re-fetching. Optional for older records. */
  changedStatus?: ChangedFileStatus[];
  /** Commit messages (subject + body) so a replay shows the Commits section. */
  commits?: string[];
  /** Distinct commit-author display names ("who wrote the PR") so a replayed
   *  call/brief still names the author. Optional for older records. */
  authors?: string[];
}

/** Newest-first, then trimmed to MAX_PER_PR per PR and MAX_TOTAL overall. */
export function capRecords(records: ScanRecord[]): ScanRecord[] {
  const sorted = [...records].sort((a, b) => b.ts - a.ts);
  const perPr = new Map<string, number>();
  const kept: ScanRecord[] = [];
  for (const r of sorted) {
    const n = perPr.get(r.url) ?? 0;
    if (n >= MAX_PER_PR) continue;
    perPr.set(r.url, n + 1);
    kept.push(r);
    if (kept.length >= MAX_TOTAL) break;
  }
  return kept;
}

export async function getHistory(): Promise<ScanRecord[]> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const list = (data[STORAGE_KEY] as ScanRecord[] | undefined) ?? [];
  return capRecords(list);
}

/** Scans for one PR url, newest first. */
export async function getHistoryForPr(url: string): Promise<ScanRecord[]> {
  return (await getHistory()).filter((r) => r.url === url);
}

/** One row in the cross-PR picker: a PR plus its scan count and latest verdict. */
export interface PrGroup {
  url: string;
  owner: string;
  repo: string;
  number: number;
  title: string | null;
  /** Number of saved scans for this PR. */
  count: number;
  /** When the most recent scan finished (epoch ms) — drives recency sort + "x ago". */
  lastTs: number;
  /** Verdict of the most recent scan — drives the row's status dot. */
  lastVerdict: DriftReport['verdict'];
  lastVerdictLabel: string;
}

/** Collapse a flat scan list into one row per PR (newest scan wins the metadata),
 *  sorted most-recently-scanned first. Shared by the Live-scan PR picker and the
 *  Settings "Saved scans" manager so the two never diverge. */
export function groupHistoryByPr(records: ScanRecord[]): PrGroup[] {
  const byUrl = new Map<string, ScanRecord[]>();
  for (const r of records) {
    const list = byUrl.get(r.url);
    if (list) list.push(r);
    else byUrl.set(r.url, [r]);
  }
  return [...byUrl.values()]
    .map((recs) => {
      const latest = recs.reduce((a, b) => (b.ts > a.ts ? b : a));
      return {
        url: latest.url,
        owner: latest.owner,
        repo: latest.repo,
        number: latest.number,
        title: latest.title,
        count: recs.length,
        lastTs: latest.ts,
        lastVerdict: latest.verdict,
        lastVerdictLabel: latest.verdictLabel,
      };
    })
    .sort((a, b) => b.lastTs - a.lastTs);
}

/** All scanned PRs as picker rows, newest-scanned first. */
export async function getPrGroups(): Promise<PrGroup[]> {
  return groupHistoryByPr(await getHistory());
}

export async function addScan(record: ScanRecord): Promise<ScanRecord[]> {
  const existing = await getHistory();
  const next = capRecords([record, ...existing]);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function removeScan(id: string): Promise<ScanRecord[]> {
  const next = (await getHistory()).filter((r) => r.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function clearHistoryForPr(url: string): Promise<ScanRecord[]> {
  const next = (await getHistory()).filter((r) => r.url !== url);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}
