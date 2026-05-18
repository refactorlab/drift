import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchScanEntry, fetchScanSummary } from '../api/scanApi';
import { decompressReport } from '../decompress';
import { FIXTURES } from '../fixtures';
import { useUserScans } from '../userScans';
import type { CallTreeNode, FixtureSpec, Report } from '../types';

// Module-level caches so a route round-trip (dashboard → detail →
// back) doesn't re-fetch. Summaries are small + immutable per scan, so
// caching forever is safe; entries similarly. Both clear automatically
// when the user reloads the page.
const summaryCache = new Map<string, Report>();
const entryCache = new Map<string, CallTreeNode>(); // key: `${scanKey}#${idx}`

/**
 * Shared report-loading hook. Every page route uses this so the
 * fetch/cache/error story is identical across them.
 *
 * Reads `:fixtureKey` from the route, fetches the matching JSON with
 * `cache: 'no-store'` (so `make refresh` is immediately visible), and
 * returns the parsed `Report` plus the resolved `FixtureSpec`.
 *
 * Fixture resolution checks the built-in `FIXTURES` array first, then
 * falls back to user scans from `/fixtures/scans/index.json` (populated
 * by `make scan`). While the user-scan list is still loading, the hook
 * stays in `loading: true` rather than erroring out — otherwise a hard
 * refresh on a user-scan URL would briefly show "unknown fixture".
 */
export function useReport(): {
  report: Report | null;
  fixture: FixtureSpec | null;
  fixtureKey: string | null;
  error: string | null;
  loading: boolean;
} {
  const { fixtureKey } = useParams<{ fixtureKey: string }>();
  const { scans: userScans, loading: scansLoading } = useUserScans();
  const builtIn = fixtureKey ? FIXTURES.find((f) => f.key === fixtureKey) : undefined;
  const fromScans = fixtureKey ? userScans.find((f) => f.key === fixtureKey) : undefined;
  const fixture = builtIn ?? fromScans ?? null;
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
    setReport(null);
    // Wait for the user-scans index before deciding the key is unknown —
    // otherwise a direct hit on `/scan/ktor/report` would error during
    // the index fetch.
    if (!fixture) {
      if (scansLoading) return;
      setError(fixtureKey ? `unknown fixture: ${fixtureKey}` : 'no fixture key in URL');
      return;
    }
    setLoading(true);
    fetch(fixture.json, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: unknown) => {
        // drift-lab saves scans as a StoredScan envelope ({scan_id,
        // saved_at, report}); built-in fixtures are the bare Report;
        // both can ship in legacy 1.0 inline form or compact 1.1
        // (string_table + frames). Unwrap envelope first, then run
        // through `decompressReport` so the rest of the viewer keeps
        // seeing the canonical denormalized shape.
        const inner =
          data && typeof data === 'object' &&
          'report' in (data as Record<string, unknown>) &&
          !('entries' in (data as Record<string, unknown>))
            ? (data as { report: unknown }).report
            : data;
        setReport(decompressReport(inner));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [fixture?.json, fixtureKey, scansLoading]);

  return { report, fixture, fixtureKey: fixtureKey ?? null, error, loading };
}

/**
 * Dashboard-grade loader. Fetches just the SUMMARY projection from the
 * drift-lab HTTP server when available (each entry's `children` is
 * stripped, with all subtree findings pre-aggregated onto the entry
 * root). Falls back to the full fixture URL for built-in demos.
 *
 * Compared to {@link useReport}: ~10–100× smaller payload, sub-100 ms
 * dashboard paint on multi-MB scans, while keeping
 * `flattenFindings(report)` totals exact thanks to the server-side
 * aggregation contract.
 *
 * Use this for any view that does NOT need a per-entry call tree — the
 * scan report page, summary cards, hot zones, immediate fixes,
 * refactor candidates, etc.
 */
export function useScanSummary(): {
  report: Report | null;
  fixture: FixtureSpec | null;
  fixtureKey: string | null;
  error: string | null;
  loading: boolean;
} {
  const { fixtureKey } = useParams<{ fixtureKey: string }>();
  const { scans: userScans, loading: scansLoading } = useUserScans();
  const builtIn = fixtureKey ? FIXTURES.find((f) => f.key === fixtureKey) : undefined;
  const fromScans = fixtureKey ? userScans.find((f) => f.key === fixtureKey) : undefined;
  const fixture = builtIn ?? fromScans ?? null;
  const [report, setReport] = useState<Report | null>(() =>
    fixtureKey ? (summaryCache.get(fixtureKey) ?? null) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
    if (!fixtureKey) {
      setReport(null);
      setError('no fixture key in URL');
      return;
    }
    // Warm cache hit — paint immediately, no fetch.
    const cached = summaryCache.get(fixtureKey);
    if (cached) {
      setReport(cached);
      return;
    }
    setReport(null);
    if (!fixture) {
      if (scansLoading) return;
      setError(`unknown fixture: ${fixtureKey}`);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchScanSummary(fixtureKey, fixture.json)
      .then((s) => {
        if (cancelled) return;
        summaryCache.set(fixtureKey, s.report);
        setReport(s.report);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureKey, fixture?.json, scansLoading]);

  return { report, fixture, fixtureKey: fixtureKey ?? null, error, loading };
}

/**
 * Lazy per-entry loader. Fetches one entry's FULL subtree (children +
 * external_calls + findings intact). Cached per `(scanKey, idx)` so a
 * tab switch between entries doesn't re-fetch.
 *
 * Pair with {@link useScanSummary} on drilldown pages: summary first
 * (for the header / picker / aggregates), then this hook for the
 * active entry's flame view / call tree.
 *
 * `entryIndex === null` means "no selection yet" — the hook returns
 * `{entry: null, loading: false}` and never fetches. Selecting an
 * entry triggers the fetch on the next render.
 */
export function useScanEntry(
  scanKey: string | null,
  entryIndex: number | null,
  fixtureJsonUrl: string | null,
): { entry: CallTreeNode | null; loading: boolean; error: string | null } {
  const cacheKey =
    scanKey !== null && entryIndex !== null ? `${scanKey}#${entryIndex}` : null;
  const [entry, setEntry] = useState<CallTreeNode | null>(() =>
    cacheKey ? (entryCache.get(cacheKey) ?? null) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
    if (!scanKey || entryIndex === null || !fixtureJsonUrl) {
      setEntry(null);
      return;
    }
    const key = `${scanKey}#${entryIndex}`;
    const cached = entryCache.get(key);
    if (cached) {
      setEntry(cached);
      return;
    }
    setEntry(null);
    let cancelled = false;
    setLoading(true);
    fetchScanEntry(scanKey, entryIndex, fixtureJsonUrl)
      .then((n) => {
        if (cancelled) return;
        entryCache.set(key, n);
        setEntry(n);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scanKey, entryIndex, fixtureJsonUrl]);

  return { entry, loading, error };
}

/** Drop a scan's cached entries — call when the scan is deleted so a
 *  re-create with the same key starts cold. The summary cache is also
 *  cleared. */
export function invalidateScanCache(scanKey: string): void {
  summaryCache.delete(scanKey);
  for (const k of Array.from(entryCache.keys())) {
    if (k.startsWith(`${scanKey}#`)) entryCache.delete(k);
  }
}

/**
 * Walk all entry trees in preorder and build a flat list of findings —
 * each entry is `{node, finding, idx}` where `idx` is the stable
 * position the URL uses (`/scan/:key/finding/:idx`).
 *
 * Note for summary reports: `useScanSummary` returns a Report whose
 * entry roots carry the subtree-aggregate findings (and empty
 * children). `flattenFindings(summary)` therefore returns the same
 * total count `flattenFindings(fullReport)` would — sevCounts /
 * healthScore stay exact. The per-finding URL (`/finding/:idx`) lives
 * in pages that use `useReport` (full load), so finding-index ordering
 * remains stable across the codebase.
 */
export function flattenFindings(
  report: Report | null,
): { node: import('../types').CallTreeNode; finding: import('../types').Finding; idx: number }[] {
  if (!report) return [];
  const out: ReturnType<typeof flattenFindings> = [];
  let idx = 0;
  const walk = (n: import('../types').CallTreeNode) => {
    for (const f of n.findings ?? []) {
      out.push({ node: n, finding: f, idx: idx++ });
    }
    for (const c of n.children) walk(c);
  };
  for (const e of report.entries) walk(e);
  return out;
}

/** Find a node by its `id` (`file::class::name`) anywhere in the tree. */
export function findNodeById(
  report: Report | null,
  id: string,
): import('../types').CallTreeNode | null {
  if (!report) return null;
  const walk = (n: import('../types').CallTreeNode): import('../types').CallTreeNode | null => {
    if (n.id === id) return n;
    for (const c of n.children) {
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  };
  for (const e of report.entries) {
    const hit = walk(e);
    if (hit) return hit;
  }
  return null;
}
