/**
 * Two-tier scan loader for the viewer.
 *
 * Why this exists: the dashboard at `/scan/:key/report` only needs the
 * `Report.summary` rollups + per-entry headers; it never inspects
 * `entries[*].children`. On a real user project the full envelope can
 * be 50–500 MB (one observed user scan: 1.72 GB), so eagerly fetching
 * it for the dashboard is wasteful (slow paint, big GC pressure,
 * sometimes outright OOM in the renderer).
 *
 * The drift-lab HTTP server exposes:
 *   • `GET /api/scans/{key}/summary` — envelope with each entry
 *     stripped to its HEADER (`children`, `findings`, `external_calls`,
 *     `callers` all empty). The summary's `roots_overview[*]` carries
 *     per-root `findings_by_severity` + `findings_total`, so the
 *     dashboard computes sevCounts/healthScore by summing those —
 *     never walking the call tree.
 *   • `GET /api/scans/{key}/entry/{idx}` — one entry's full subtree,
 *     fetched lazily on drill-in.
 *
 * Built-in fixtures (the language demos shipped with the repo) don't go
 * through this API — they live at `/fixtures/<key>.json` as bare
 * `Report` JSON and are small enough (KB-tens-of-KB) that projecting
 * them client-side is fine. The helpers below detect which path applies
 * by trying the API first, then falling back to the fixture URL.
 */

import { decompressEntry, decompressReport } from '../decompress';
import type { CallTreeNode, Finding, Report } from '../types';

/** Inner Report inside a `StoredScan` envelope. We treat the envelope as
 *  opaque on the wire and only carry the fields the dashboard reads. */
interface StoredScanLike {
  scan_id?: string;
  scanId?: string;
  saved_at?: string;
  savedAt?: string;
  report: Report;
  picker_roots?: unknown;
  pickerRoots?: unknown;
}

/** Result of {@link fetchScanSummary}. Same shape the legacy
 *  `useReport` returned, but with every entry stripped to its HEADER —
 *  `children` / `findings` / `external_calls` / `callers` are all
 *  empty. Consumers needing the full subtree must call
 *  {@link fetchScanEntry} per entry. */
export interface ScanSummary {
  report: Report;
}

/** Try the drift-lab HTTP server's summary endpoint first (fast, server
 *  pre-strips the payload). If it 404s (built-in fixture or no server),
 *  fall back to the bare fixture URL and project the summary
 *  client-side. Both paths produce the same in-memory shape, so callers
 *  don't branch on source. */
export async function fetchScanSummary(
  scanKey: string,
  fixtureJsonUrl: string,
): Promise<ScanSummary> {
  // Path 1 — bundled HTTP server. User scans live here; the response is
  // already an envelope with stripped + aggregated entries.
  const apiUrl = `/api/scans/${encodeURIComponent(scanKey)}/summary`;
  const apiTry = await tryFetchJson(apiUrl);
  if (apiTry.ok) {
    return { report: unwrapReport(apiTry.value) };
  }

  // Path 2 — bare fixture URL. Built-in fixtures + any environment
  // without the HTTP server (pure vite dev) take this fallback. The
  // fixture body is the full Report; we project to the summary shape
  // on the client because it's small enough that the projection is
  // cheap.
  const r = await fetch(fixtureJsonUrl, { cache: 'no-store' });
  if (!r.ok) throw new Error(`fetch ${fixtureJsonUrl} → HTTP ${r.status}`);
  const data = (await r.json()) as Report | StoredScanLike;
  const fullReport = unwrapReport(data);
  return { report: projectSummaryClientSide(fullReport) };
}

/** Fetch one entry's FULL subtree. Lazy companion to
 *  {@link fetchScanSummary}. */
export async function fetchScanEntry(
  scanKey: string,
  entryIndex: number,
  fixtureJsonUrl: string,
): Promise<CallTreeNode> {
  // Path 1 — drift-lab HTTP server. Sidecar may arrive in legacy
  // bare-`CallTreeNode` form or new 1.1 `CompactEntryDoc` form;
  // `decompressEntry` handles both.
  const apiUrl = `/api/scans/${encodeURIComponent(scanKey)}/entry/${entryIndex}`;
  const apiTry = await tryFetchJson(apiUrl);
  if (apiTry.ok) {
    return decompressEntry(apiTry.value);
  }
  // Path 2 — fall back to the fixture URL and pick the entry out
  // ourselves. This costs a full-Report fetch, but it's the right
  // behavior for built-in fixtures (no API endpoint exists for them).
  const r = await fetch(fixtureJsonUrl, { cache: 'no-store' });
  if (!r.ok) throw new Error(`fetch ${fixtureJsonUrl} → HTTP ${r.status}`);
  const data = (await r.json()) as Report | StoredScanLike;
  const fullReport = unwrapReport(data);
  const entry = fullReport.entries[entryIndex];
  if (!entry) {
    throw new Error(
      `entry_index ${entryIndex} out of range (have ${fullReport.entries.length})`,
    );
  }
  return entry;
}

/** Mirror of `useReport`'s envelope unwrap: drift-lab writes scans as a
 *  `StoredScan` envelope, built-in fixtures ship the bare Report. Detect
 *  by checking for a top-level `entries` field — only the Report has it
 *  at the root. After unwrapping we ALWAYS run the result through
 *  `decompressReport` so the rest of the viewer keeps seeing the
 *  denormalized 1.0 shape regardless of whether the wire payload was
 *  legacy or 1.1 interned. */
function unwrapReport(data: unknown): Report {
  let inner: unknown;
  if (
    data &&
    typeof data === 'object' &&
    'report' in (data as Record<string, unknown>) &&
    !('entries' in (data as Record<string, unknown>))
  ) {
    inner = (data as { report: unknown }).report;
  } else {
    inner = data;
  }
  return decompressReport(inner);
}

/** Try a fetch + JSON parse, return Ok/Err discriminated. Treats every
 *  non-2xx (including 404 when the API endpoint isn't mounted) as a
 *  fall-back signal so the caller can try the fixture path. Network
 *  errors are also Err — we don't crash the dashboard on a transient
 *  fetch failure. */
async function tryFetchJson(
  url: string,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return { ok: false };
    return { ok: true, value: await r.json() };
  } catch {
    return { ok: false };
  }
}

/** Client-side projection mirroring the Rust `load_envelope_summary`
 *  behavior: strip each entry down to its HEADER — empty `children`,
 *  `findings`, `external_calls`, and `callers`. The dashboard derives
 *  global sevCounts from `summary.roots_overview` (per-root counts
 *  already emitted by the analyzer), so a full subtree walk is never
 *  needed.
 *
 *  Used only on the fallback (built-in fixture) path so the dashboard
 *  code path stays identical regardless of source. Pure function —
 *  accepts a Report, returns a new Report (does not mutate input). */
function projectSummaryClientSide(report: Report): Report {
  const entries = report.entries.map((entry) => ({
    ...entry,
    children: [] as CallTreeNode[],
    findings: [] as Finding[],
    external_calls: [],
    callers: [],
  }));
  return { ...report, entries };
}
