import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchScanEntry, fetchScanSummary } from './api/scanApi';
import { FIXTURES } from './fixtures';
import { useUserScans } from './userScans';
import { FlameView } from './FlameView';
import { CallTreeView } from './CallTreeView';
import { DetailsPane } from './DetailsPane';
import { SummaryBar } from './SummaryBar';
import { HotPaths } from './HotPaths';
import { Smells } from './Smells';
import { Statistics } from './Statistics';
import { RootsView } from './RootsView';
import { Insights } from './Insights';
import { ScanReport } from './ScanReport';
import { CallGraphView } from './CallGraphView';
import { TIPS } from './tooltips';
import { Help } from './Help';
import { Splitter, useResizablePanel } from './useResizableColumns';
import {
  buildEntryPointFilterOptions,
  filterEntriesByDeclSource,
} from './types';
import type { CallTreeNode, EntryDecl, FindingKind, Report } from './types';

type FlameMode = 'kind' | 'category' | 'complexity' | 'smells';
type BottomTab = 'report' | 'tree' | 'graph' | 'roots' | 'hot' | 'smells' | 'insights' | 'stats';

/// Functional Map-insert — preserves React's identity invariant for
/// `useState<Map>`. `setLoadedEntries(mapWith(prev, idx, node))` is
/// the equivalent of `setState({...prev, [idx]: node})` for Maps.
function mapWith<K, V>(m: Map<K, V>, key: K, value: V): Map<K, V> {
  const next = new Map(m);
  next.set(key, value);
  return next;
}

/// Run `task` against every index in `[0, count)` with at most
/// `concurrency` tasks in flight at once. Used by the background
/// entry-prefetch so a legacy 200-entry "roots-mode" scan doesn't fire
/// 200 concurrent HTTP requests at the bundled axum server. Each worker
/// pulls the next index from a shared cursor; when the cursor reaches
/// `count` workers exit. Per-task errors are swallowed (intentional —
/// the prefetch is best-effort).
async function forEachConcurrent(
  count: number,
  concurrency: number,
  task: (index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (cursor < count) {
      const i = cursor++;
      try {
        await task(i);
      } catch {
        /* per-task errors are silent — the caller's UI degrades gracefully */
      }
    }
  };
  const workers = Array.from({ length: Math.max(1, concurrency) }, worker);
  await Promise.all(workers);
}

/// Maximum entry fetches in flight at once during background prefetch.
/// Picked at 4 because:
///   • Typical scans have 1–10 entries → cap rarely kicks in.
///   • Pathological "roots-mode" scans have 100–200 entries → with no
///     cap the browser would saturate the kernel network queue AND
///     hammer the bundled axum server with O(entries) concurrent file
///     reads. At 4 in-flight the server stays responsive AND total
///     wall time stays close to optimal on commodity SSDs.
///   • Higher values (8, 16) don't help on a single localhost server —
///     the file reads serialize on the kernel anyway.
const PREFETCH_CONCURRENCY = 4;

export function App() {
  // Fixture identity now lives in the URL (`/scan/:fixtureKey`). The
  // dropdown changes call `navigate(`/scan/<key>`)` instead of setState
  // so refresh / back / share all work.
  const params = useParams<{ fixtureKey: string }>();
  const navigate = useNavigate();
  // User scans live in /fixtures/scans/index.json and are loaded
  // asynchronously. Until they arrive, a URL like `/scan/ktor` won't
  // match any built-in fixture but should still fetch
  // /fixtures/scans/ktor.json — handled below by an optimistic
  // synthesized FixtureSpec.
  const { scans: userScans } = useUserScans();
  const allFixtures = useMemo(() => [...FIXTURES, ...userScans], [userScans]);
  const matched = params.fixtureKey
    ? allFixtures.find(f => f.key === params.fixtureKey)
    : undefined;
  const fixtureKey = matched?.key ?? params.fixtureKey ?? FIXTURES[0].key;
  const setFixtureKey = (k: string) => navigate(`/scan/${k}`);
  // Default to the Roots tab when the loaded report has many entries (the
  // signature of `make scan-roots` output, where the entry dropdown alone
  // would be unwieldy). Threshold matches "more than what a `make scan`
  // produces" without forcing a schema field.
  const ROOTS_TAB_THRESHOLD = 5;
  const [report, setReport] = useState<Report | null>(null);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CallTreeNode | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flameMode, setFlameMode] = useState<FlameMode>('kind');
  const [bottomTab, setBottomTab] = useState<BottomTab>('tree');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [flameZoomKey, setFlameZoomKey] = useState(0);
  // When the ScanReport's findings breakdown is clicked, the Insights tab
  // opens pre-filtered to that kind. Stored as a list so the Smells
  // migration in step 13 can use the same plumbing for its preset.
  const [insightsKindFilter, setInsightsKindFilter] = useState<FindingKind[] | null>(null);

  // Layout sizes — persisted to localStorage, dragged via Splitter components.
  // Defaults match the prior hard-coded grid (`1fr 340px` body, even vertical split).
  const [sidebarWidth, setSidebarWidth] = useResizablePanel(
    'drift.layout.sidebarWidth', 340, { min: 220, max: 900 },
  );
  const [bottomHeight, setBottomHeight] = useResizablePanel(
    'drift.layout.bottomHeight', 360, { min: 140, max: 1200 },
  );
  // Snapshot starting size at drag begin so onDrag deltas are applied to a
  // stable baseline instead of an already-updated value.
  const sidebarStart = useRef(sidebarWidth);
  const bottomStart = useRef(bottomHeight);

  // If the URL key didn't match any known fixture YET (built-in list is
  // empty for user-scan keys until the index loads), synthesize a
  // FixtureSpec pointing at /fixtures/scans/<key>.json so the fetch
  // proceeds optimistically. Once the index loads and `matched` resolves,
  // the proper label/description take over.
  const fixture = matched ?? (
    params.fixtureKey
      ? {
          key: params.fixtureKey,
          label: params.fixtureKey,
          json: `/fixtures/scans/${params.fixtureKey}.json`,
          description: 'Local scan',
        }
      : FIXTURES[0]
  );

  // For scan-fed fixtures (user scans under scans/, plus the legacy
  // `roots` key from old `make scan-roots ROOTS_NAME=roots` runs),
  // replace the generic static label with the last path segment of the
  // folder that was actually scanned. Lets the user see ".../ktor"
  // instead of just the bare key.
  const isUserScan = userScans.some(s => s.key === fixtureKey);
  const fixtureLabel = useMemo(() => {
    const root = report?.generator?.source_root;
    if (root && (isUserScan || fixtureKey === 'roots')) {
      const base = root.replace(/[/\\]+$/, '').split(/[/\\]/).pop();
      if (base) return `.../${base}`;
    }
    return fixture.label;
  }, [report, fixtureKey, fixture.label, isUserScan]);

  // Two-tier load.
  //
  // Tier 1 (this effect) — fetch only the SUMMARY: per-entry headers
  // (name, file:line, kind, subtree_size, counts) + the aggregate
  // rollups (`summary.findings_top`, `roots_overview`, `top_callers`,
  // …). The drift-lab HTTP server projects this server-side; for
  // built-in fixtures and `vite dev` we fall back to the bare fixture
  // URL and project client-side. Total wire payload: KB–tens-of-KB
  // even for 250 MB scans.
  //
  // Tier 2 (the separate effect below) — once `activeRootId` is set,
  // fetch THAT entry's full subtree. Cached per (scanKey, entryIdx) by
  // `fetchScanEntry`, so switching back to a previously-viewed entry
  // is instant.
  //
  // The render builds a "patched" report where the active entry is
  // swapped in with its full subtree; all other entries stay header-
  // only. Components that walk the tree (`FlameView`, `CallTreeView`,
  // `Smells`, etc.) see real data only for the active entry — which is
  // exactly what they render anyway.
  useEffect(() => {
    setError(null);
    setSelected(null);
    setReport(null);
    let cancelled = false;
    fetchScanSummary(fixtureKey, fixture.json)
      .then(({ report: summaryReport }) => {
        if (cancelled) return;
        // Sort entry headers alphabetically — same UX as the old full
        // load, just over the slim header list.
        const sorted = [...summaryReport.entries].sort((a, b) => {
          const aName = (a.parent_class ? `${a.parent_class}.` : '') + a.name;
          const bName = (b.parent_class ? `${b.parent_class}.` : '') + b.name;
          return aName.localeCompare(bName);
        });
        setReport({ ...summaryReport, entries: sorted });
        setActiveRootId(sorted[0]?.id ?? null);
        // Tab-default policy: report > roots > tree. (Same heuristic as
        // before; `summary.findings_by_kind` + `findings_top` are
        // already in the summary response.)
        const hasFindings =
          Object.keys(summaryReport.summary.findings_by_kind ?? {}).length > 0
          || (summaryReport.summary.findings_top?.length ?? 0) > 0;
        if (hasFindings) {
          setBottomTab('report');
        } else if (sorted.length >= ROOTS_TAB_THRESHOLD) {
          setBottomTab('roots');
        }
      })
      .catch(e => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [fixture.json, fixtureKey]);

  // Tier 2 — per-entry cache populated incrementally. Three writers:
  //   1. Selection-change effect (below): priority-fetches the active
  //      entry first so the flame/tree views light up immediately.
  //   2. Background-prefetch effect (below that): fetches every OTHER
  //      entry in parallel after the summary lands. Insights /
  //      Statistics / RootsView / `nodeIndex` walk all entries; without
  //      this they'd silently undercount (e.g. "Insights (37)" tab
  //      header but 0 rows because every entry's `findings` is `[]`
  //      in the summary projection).
  //   3. Resolved entries get patched into `patchedReport` so every
  //      consumer that reads `report.entries[*].children/findings/…`
  //      sees real data as it arrives. The summary's header-only
  //      entries remain visible for not-yet-loaded ones — the UI
  //      degrades gracefully (counts at zero, no crash).
  const [loadedEntries, setLoadedEntries] = useState<Map<number, CallTreeNode>>(new Map());
  const [activeRootLoading, setActiveRootLoading] = useState(false);
  // Mirror `loadedEntries` into a ref so the long-running prefetch
  // worker can read the latest value without being a dep of its
  // effect. Without this, the prefetch effect would either restart on
  // every entry resolution (re-firing all fetches) or read a stale
  // snapshot captured at effect-start time (re-fetching already-loaded
  // entries).
  const loadedEntriesRef = useRef(loadedEntries);
  useEffect(() => {
    loadedEntriesRef.current = loadedEntries;
  }, [loadedEntries]);

  // In-flight dedupe: the active-fetch effect and the background
  // prefetch worker both check `loadedEntries.has(idx)` BEFORE firing a
  // fetch. Nothing stops them from both passing that check
  // simultaneously and double-fetching the same entry — wasted
  // bandwidth (one ~5 MB redundant request per active-entry switch).
  // This ref is the single in-flight registry; both writers consult it
  // before firing and add to it before the await. Refs (not state) so
  // an add/remove never schedules a re-render.
  const inFlightRef = useRef<Set<number>>(new Set());

  // Reset the cache when the fixture changes (different scan → different
  // entries — stale cache would yield wrong data).
  useEffect(() => {
    setLoadedEntries(new Map());
    inFlightRef.current = new Set();
  }, [fixtureKey]);

  // Priority fetch — active entry first. Skipped when the entry is
  // already in the cache (e.g. user navigates back to a previously
  // active root) OR currently being fetched by the background worker.
  useEffect(() => {
    if (!report || !activeRootId) return;
    const idx = report.entries.findIndex(r => r.id === activeRootId);
    if (idx < 0) return;
    if (loadedEntries.has(idx)) return;
    if (inFlightRef.current.has(idx)) return;
    let cancelled = false;
    inFlightRef.current.add(idx);
    setActiveRootLoading(true);
    fetchScanEntry(fixtureKey, idx, fixture.json)
      .then(node => {
        if (cancelled) return;
        setLoadedEntries(prev => mapWith(prev, idx, node));
      })
      .catch(e => { if (!cancelled) setError(String(e)); })
      .finally(() => {
        inFlightRef.current.delete(idx);
        if (!cancelled) setActiveRootLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeRootId, fixtureKey, fixture.json, report, loadedEntries]);

  // Background prefetch — every entry, with bounded concurrency.
  // Fires once per summary load. Each resolved entry trickles into
  // `loadedEntries` so Insights/RootsView/nodeIndex update
  // incrementally as data arrives.
  //
  // Why we prefetch instead of waiting for tab click: Insights and
  // RootsView walk EVERY entry's `findings` / `children` to render
  // their tables. Without prefetch, clicking those tabs would either
  // (a) lag while N fetches finish, or (b) silently show partial data.
  // (a) is bad UX; (b) is worse — users see "0 insights" when 37 exist.
  // Eager prefetch trades a few seconds of background bandwidth for
  // "everything just works" once the user clicks around.
  //
  // Concurrency cap: see `PREFETCH_CONCURRENCY`. Without it, a 200-
  // entry roots-mode scan would fire 200 concurrent fetches and
  // saturate the localhost server.
  useEffect(() => {
    if (!report) return;
    let cancelled = false;
    void forEachConcurrent(report.entries.length, PREFETCH_CONCURRENCY, async (idx) => {
      if (cancelled) return;
      // Skip if another writer (the active-root priority effect) beat
      // us to it OR is currently fetching this idx. The in-flight set
      // is the only way to dedupe the latter case — `loadedEntries`
      // only reflects completed fetches.
      if (loadedEntriesRef.current.has(idx)) return;
      if (inFlightRef.current.has(idx)) return;
      inFlightRef.current.add(idx);
      try {
        const node = await fetchScanEntry(fixtureKey, idx, fixture.json);
        if (cancelled) return;
        setLoadedEntries(prev => (prev.has(idx) ? prev : mapWith(prev, idx, node)));
      } finally {
        inFlightRef.current.delete(idx);
      }
    });
    return () => { cancelled = true; };
  }, [report, fixtureKey, fixture.json]);

  // `patchedReport` — single source of truth for every consumer below.
  // Header-only entries (from the summary) get swapped for full
  // subtrees as `loadedEntries` fills in. Memoised so unrelated
  // re-renders don't churn the nodeIndex walk.
  const patchedReport = useMemo<Report | null>(() => {
    if (!report) return null;
    if (loadedEntries.size === 0) return report;
    const entries = report.entries.map((entry, idx) => loadedEntries.get(idx) ?? entry);
    return { ...report, entries };
  }, [report, loadedEntries]);

  // The "active root" the flame/tree views consume. Headers don't have
  // a meaningful subtree, so we hand back null while the priority
  // fetch is in flight — every consumer below already handles `null`.
  const activeRoot = useMemo<CallTreeNode | null>(() => {
    if (!patchedReport || !activeRootId) return null;
    const idx = patchedReport.entries.findIndex(r => r.id === activeRootId);
    if (idx < 0) return null;
    return loadedEntries.get(idx) ?? null;
  }, [patchedReport, activeRootId, loadedEntries]);

  // Cross-root index: for every reachable node, remember (root id, node ref).
  // Lets us jump from Statistics/HotPaths into the right entry-point tree.
  // Walks `patchedReport` so cross-entry jumps from Statistics/HotPaths
  // hit the loaded entries' real subtrees as soon as the background
  // prefetch resolves them. Header-only entries (not yet loaded)
  // contribute just themselves to the index — better than nothing, and
  // they're upgraded incrementally as `loadedEntries` fills in.
  const nodeIndex = useMemo(() => {
    const byId = new Map<string, { rootId: string; node: CallTreeNode }>();
    const byFileLine = new Map<string, { rootId: string; node: CallTreeNode }>();
    const byName = new Map<string, { rootId: string; node: CallTreeNode }>();
    if (!patchedReport) return { byId, byFileLine, byName };
    for (const root of patchedReport.entries) {
      const walk = (n: CallTreeNode) => {
        if (!byId.has(n.id)) byId.set(n.id, { rootId: root.id, node: n });
        const fl = `${n.file}:${n.line}`;
        if (!byFileLine.has(fl)) byFileLine.set(fl, { rootId: root.id, node: n });
        const fullName = (n.parent_class ? `${n.parent_class}.` : '') + n.name;
        if (!byName.has(fullName)) byName.set(fullName, { rootId: root.id, node: n });
        if (!byName.has(n.name)) byName.set(n.name, { rootId: root.id, node: n });
        for (const c of n.children) walk(c);
      };
      walk(root);
    }
    return { byId, byFileLine, byName };
  }, [patchedReport]);

  const flameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 320 });
  useEffect(() => {
    if (!flameRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const r = e.contentRect;
        setSize({ w: Math.max(320, Math.floor(r.width)), h: Math.max(180, Math.floor(r.height)) });
      }
    });
    ro.observe(flameRef.current);
    return () => ro.disconnect();
  }, []);

  // Jump by id, falling back to (file:line) or name; switches active root if needed.
  const jump = (lookup: { id?: string; file?: string; line?: number; name?: string }) => {
    let hit: { rootId: string; node: CallTreeNode } | undefined;
    if (lookup.id) hit = nodeIndex.byId.get(lookup.id);
    if (!hit && lookup.file && typeof lookup.line === 'number') {
      hit = nodeIndex.byFileLine.get(`${lookup.file}:${lookup.line}`);
    }
    if (!hit && lookup.name) hit = nodeIndex.byName.get(lookup.name);
    if (!hit) return;
    if (hit.rootId !== activeRootId) setActiveRootId(hit.rootId);
    setSelected(hit.node);
  };

  const jumpTo = (id: string) => jump({ id });

  return (
    <div style={appStyle}>
      <Toolbar
        fixtureKey={fixtureKey}
        setFixtureKey={setFixtureKey}
        fixtureLabel={fixtureLabel}
        roots={report?.entries ?? []}
        entryDecls={report?.summary?.entry_declarations ?? []}
        activeRootId={activeRootId}
        setActiveRootId={setActiveRootId}
        search={search}
        setSearch={setSearch}
        flameMode={flameMode}
        setFlameMode={setFlameMode}
        description={fixture.description}
      />
      <SummaryBar
        summary={report?.summary ?? null}
        activeCategory={categoryFilter}
        onToggleCategory={(c) => setCategoryFilter(prev => (prev === c ? null : c))}
      />
      <div
        style={{
          ...bodyStyle,
          // 1fr | splitter | sidebarWidthpx — drag splitter to resize the right pane.
          gridTemplateColumns: `1fr 6px ${sidebarWidth}px`,
        }}
      >
        <div
          style={{
            ...mainStyle,
            // toolbar(auto) | flame(1fr) | tabs(auto) | bottomSplitter(6px) | bottom(bottomHeightpx)
            gridTemplateRows: `auto 1fr auto 6px ${bottomHeight}px`,
          }}
        >
          <div style={paneHeaderStyle}>
            <Help text={TIPS.flame_graph}>FLAME GRAPH</Help>
            <span style={{ marginLeft: 12, color: '#6e717a', fontWeight: 400 }}>
              · <Help
                  text={flameMode === 'kind' ? TIPS.flame_mode_kind
                    : flameMode === 'category' ? TIPS.flame_mode_category
                    : flameMode === 'complexity' ? TIPS.flame_mode_complexity
                    : TIPS.flame_mode_smells}
                >
                  color by {flameMode === 'kind' ? 'symbol kind'
                    : flameMode === 'category' ? 'resource category'
                    : flameMode === 'complexity' ? 'complexity'
                    : 'smells'}
                </Help>
            </span>
            {categoryFilter && (
              <span style={filterChipStyle} title={TIPS.toolbar_filter_chip}>
                filter: {categoryFilter}
                <button onClick={() => setCategoryFilter(null)} style={chipCloseStyle} title="Clear the category filter (show all frames at full opacity).">×</button>
              </span>
            )}
            <button
              onClick={() => setFlameZoomKey(k => k + 1)}
              style={resetBtnStyle}
              title="Reset zoom to full flame graph (click any frame to zoom in again)"
            >
              ↺ zoom
            </button>
            {selected && (
              <button onClick={() => { setSelected(activeRoot); setFlameZoomKey(k => k + 1); }} style={{ ...resetBtnStyle, marginLeft: 4 }} title={TIPS.toolbar_back_to_root}>
                ← back to root
              </button>
            )}
          </div>
          <div ref={flameRef} style={flamePanelStyle}>
            {error && <div style={errorStyle}>load error: {error}</div>}
            {!error && activeRoot && (
              <FlameView
                key={`${activeRootId ?? ''}-${flameZoomKey}`}
                root={activeRoot}
                search={search}
                mode={flameMode}
                categoryFilter={categoryFilter}
                onSelect={setSelected}
                height={size.h}
                width={size.w}
              />
            )}
            {!error && !activeRoot && activeRootLoading && (
              <div style={emptyStyle}>loading entry…</div>
            )}
            {!error && !activeRoot && !activeRootLoading && (
              <div style={emptyStyle}>no data</div>
            )}
          </div>
          <div style={tabsStyle}>
            <Tab active={bottomTab === 'report'} onClick={() => setBottomTab('report')} tip="One-screen scan report — health score, findings breakdown, hot zones, entry points.">
              Scan Report
            </Tab>
            <Tab active={bottomTab === 'tree'} onClick={() => setBottomTab('tree')} tip={TIPS.tab_call_tree}>
              Call Tree
            </Tab>
            <Tab active={bottomTab === 'graph'} onClick={() => setBottomTab('graph')} tip={TIPS.tab_call_graph}>
              Call Graph
            </Tab>
            <Tab active={bottomTab === 'roots'} onClick={() => setBottomTab('roots')} tip={TIPS.tab_roots}>
              Roots{report?.entries.length ? ` (${report.entries.length})` : ''}
            </Tab>
            <Tab active={bottomTab === 'hot'} onClick={() => setBottomTab('hot')} tip={TIPS.tab_hot_paths}>
              Hot Paths{report?.summary.hot_paths.length ? ` (${report.summary.hot_paths.length})` : ''}
            </Tab>
            <Tab active={bottomTab === 'smells'} onClick={() => setBottomTab('smells')} tip={TIPS.tab_smells}>
              Smells{smellsCount(activeRoot) ? ` (${smellsCount(activeRoot)})` : ''}
            </Tab>
            <Tab active={bottomTab === 'insights'} onClick={() => setBottomTab('insights')} tip="Structured findings — N+1, blocking I/O, recursion, etc. with severity, evidence, and remediation hints.">
              Insights{findingsCount(report) ? ` (${findingsCount(report)})` : ''}
            </Tab>
            <Tab active={bottomTab === 'stats'} onClick={() => setBottomTab('stats')} tip={TIPS.tab_statistics}>
              Statistics
            </Tab>
          </div>
          <Splitter
            orientation="horizontal"
            onDragStart={() => { bottomStart.current = bottomHeight; }}
            onDrag={(dy) => {
              // Drag handle DOWN (dy > 0) → bottom panel shrinks → height decreases.
              setBottomHeight(bottomStart.current - dy);
            }}
          />
          <div style={bottomPanelStyle}>
            {bottomTab === 'report' && (
              <ScanReport
                report={patchedReport}
                onJump={jump}
                onShowKind={(kind) => {
                  setInsightsKindFilter([kind]);
                  setBottomTab('insights');
                }}
                onPickRoot={(id) => {
                  setActiveRootId(id);
                  setSelected(null);
                  setBottomTab('tree');
                }}
              />
            )}
            {bottomTab === 'tree' && activeRoot && (
              <CallTreeView
                root={activeRoot}
                search={search}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
            )}
            {bottomTab === 'graph' && activeRoot && (
              <CallGraphView
                root={activeRoot}
                search={search}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
            )}
            {bottomTab === 'roots' && (
              <RootsView
                roots={report?.entries ?? []}
                activeRootId={activeRootId}
                onSelect={(id) => { setActiveRootId(id); setSelected(null); }}
              />
            )}
            {bottomTab === 'hot' && (
              <HotPaths paths={report?.summary.hot_paths ?? []} onJump={(name) => jump({ name })} />
            )}
            {bottomTab === 'smells' && (
              <Smells root={activeRoot} onSelect={setSelected} />
            )}
            {bottomTab === 'insights' && (
              <Insights
                report={patchedReport}
                presetKinds={insightsKindFilter ?? undefined}
                onJump={jump}
              />
            )}
            {bottomTab === 'stats' && (
              <Statistics summary={report?.summary ?? null} onJump={jump} />
            )}
          </div>
        </div>
        <Splitter
          orientation="vertical"
          onDragStart={() => { sidebarStart.current = sidebarWidth; }}
          onDrag={(dx) => {
            // Drag handle LEFT (dx < 0) → sidebar GROWS toward the left.
            // Drag handle RIGHT (dx > 0) → sidebar shrinks.
            setSidebarWidth(sidebarStart.current - dx);
          }}
        />
        <div style={sidebarStyle}>
          <DetailsPane node={selected ?? activeRoot} onJumpTo={jumpTo} onJumpExternal={(file, line) => jump({ file, line })} />
        </div>
      </div>
    </div>
  );
}

function smellsCount(node: CallTreeNode | null): number {
  if (!node) return 0;
  let n = 0;
  const visit = (x: CallTreeNode) => {
    if (x.n_plus_one_risk) n++;
    if (x.blocking_in_async) n++;
    if (x.is_recursive) n++;
    for (const c of x.children) visit(c);
  };
  visit(node);
  return n;
}

/// Total number of structured findings across all entry trees. Prefers
/// the cheap `findings_by_kind` rollup when present; falls back to
/// walking the tree for older fixtures.
function findingsCount(report: Report | null): number {
  if (!report) return 0;
  const byKind = report.summary.findings_by_kind;
  if (byKind) return Object.values(byKind).reduce((a, b) => a + b, 0);
  let n = 0;
  const visit = (x: CallTreeNode) => {
    n += x.findings?.length ?? 0;
    for (const c of x.children) visit(c);
  };
  for (const e of report.entries) visit(e);
  return n;
}

function Toolbar(props: {
  fixtureKey: string;
  setFixtureKey: (k: string) => void;
  fixtureLabel: string;
  roots: CallTreeNode[];
  entryDecls: EntryDecl[];
  activeRootId: string | null;
  setActiveRootId: (id: string) => void;
  search: string;
  setSearch: (s: string) => void;
  flameMode: FlameMode;
  setFlameMode: (m: FlameMode) => void;
  description: string;
}) {
  const { fixtureKey, setFixtureKey, fixtureLabel, roots, entryDecls, activeRootId, setActiveRootId, search, setSearch, flameMode, setFlameMode, description } = props;
  // Re-call the hook here (shared module-level cache, so no extra
  // fetch) to build the "your scans" optgroup in the Fixture dropdown.
  const { scans: userScans } = useUserScans();

  // Source-filter dropdown: lets the user narrow the ENTRY picker to
  // roots launched by a specific manifest (Dockerfile, package.json,
  // pyproject, Cargo, deno). Options are derived from this scan's
  // `entry_declarations` — kinds with no matched root in `roots` don't
  // appear, so the dropdown never offers an option that yields zero rows.
  const sourceOptions = useMemo(
    () => buildEntryPointFilterOptions(roots, entryDecls),
    [roots, entryDecls],
  );
  const [sourceFilterValue, setSourceFilterValue] = useState<string>('all');
  const activeSourceFilter = useMemo(
    () => sourceOptions.find((o) => o.value === sourceFilterValue) ?? sourceOptions[0],
    [sourceOptions, sourceFilterValue],
  );
  // If the scan changes and the previously-picked source filter no
  // longer exists, fall back to `all` so the picker doesn't go stale.
  useEffect(() => {
    if (!sourceOptions.some((o) => o.value === sourceFilterValue)) {
      setSourceFilterValue('all');
    }
  }, [sourceOptions, sourceFilterValue]);
  const sourceFilteredRoots = useMemo(
    () =>
      activeSourceFilter
        ? filterEntriesByDeclSource(roots, activeSourceFilter.filter, entryDecls)
        : roots,
    [roots, activeSourceFilter, entryDecls],
  );

  // Filter entry dropdown by search so the user can type to narrow 55+ entries.
  // Always include the active root so the select value stays valid.
  // Source filter runs FIRST, then search narrows further within the
  // source-filtered subset.
  const filteredRoots = useMemo(() => {
    const base = sourceFilteredRoots;
    if (!search) return base;
    const q = search.toLowerCase();
    // Extended match: bare name OR bare file OR `file:name` (stack-frame
    // paste from another tool) OR `file:line` (terminal / IDE
    // go-to-line paste). The combined forms make it natural to search
    // for "src/router/index.ts:handler" or "src/foo.ts:47" and land on
    // the right row, instead of getting an empty list because the colon
    // never appears inside a single field.
    const matched = base.filter(r => {
      const name = ((r.parent_class ? `${r.parent_class}.` : '') + r.name).toLowerCase();
      const file = r.file.toLowerCase();
      if (name.includes(q) || file.includes(q)) return true;
      if (`${file}:${name}`.includes(q)) return true;
      if (`${file}:${r.line}`.includes(q)) return true;
      return false;
    });
    // Ensure the active selection is always present in the list — even
    // if it was filtered out by source or search — so the <select>
    // value stays valid until the user picks something else.
    if (activeRootId && !matched.find(r => r.id === activeRootId)) {
      const active = roots.find(r => r.id === activeRootId);
      if (active) matched.unshift(active);
    }
    return matched;
  }, [sourceFilteredRoots, roots, search, activeRootId]);

  const showSourceFilter = sourceOptions.length > 1;

  return (
    <div style={toolbarStyle}>
      <div style={brandStyle}>
        <Help text={TIPS.brand}>drift · static profiler</Help>
      </div>
      <label style={labelStyle}>
        <Help text={TIPS.toolbar_fixture}>Fixture</Help>
      </label>
      <select
        value={fixtureKey}
        onChange={e => setFixtureKey(e.target.value)}
        style={selectStyle}
        title={TIPS.toolbar_fixture}
      >
        {userScans.length > 0 && (
          <optgroup label="your scans">
            {userScans.map(f => (
              <option key={f.key} value={f.key} title={f.description}>
                {f.key === fixtureKey ? fixtureLabel : f.label}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="built-in fixtures">
          {FIXTURES.map(f => (
            <option key={f.key} value={f.key} title={f.description}>
              {f.key === fixtureKey ? fixtureLabel : f.label}
            </option>
          ))}
        </optgroup>
      </select>
      {showSourceFilter && (
        <>
          <label style={labelStyle}>
            <Help text="Narrow the Entry picker to roots launched by a specific manifest (Dockerfile, package.json, pyproject, deno, Cargo). Options come from this scan; categories with no matched root are hidden.">
              Source
            </Help>
          </label>
          <select
            value={sourceFilterValue}
            onChange={(e) => setSourceFilterValue(e.target.value)}
            style={selectStyle}
            title="Filter the Entry dropdown by which manifest declares each root"
            aria-label="Filter entry points by source manifest"
          >
            {sourceOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </>
      )}
      <label style={labelStyle}>
        <Help text={TIPS.toolbar_entry}>Entry</Help>
      </label>
      <select
        value={activeRootId ?? ''}
        onChange={e => setActiveRootId(e.target.value)}
        style={{ ...selectStyle, minWidth: 280 }}
        title={TIPS.toolbar_entry}
      >
        {filteredRoots.map(r => (
          <option key={r.id} value={r.id}>
            {(r.parent_class ? `${r.parent_class}.` : '') + r.name} — {r.file}:{r.line}
          </option>
        ))}
      </select>
      <label style={labelStyle}>
        <Help text={TIPS.toolbar_color}>Color</Help>
      </label>
      <select
        value={flameMode}
        onChange={e => setFlameMode(e.target.value as FlameMode)}
        style={selectStyle}
        title={TIPS.toolbar_color}
      >
        <option value="kind" title={TIPS.flame_mode_kind}>by kind</option>
        <option value="category" title={TIPS.flame_mode_category}>by category</option>
        <option value="complexity" title={TIPS.flame_mode_complexity}>by complexity</option>
        <option value="smells" title={TIPS.flame_mode_smells}>smells only</option>
      </select>
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="search…"
        title={TIPS.toolbar_search}
        style={inputStyle}
      />
      <span style={descStyle} title={description}>{description}</span>
    </div>
  );
}

function Tab({ active, onClick, children, tip }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tip?: string;
}) {
  // Wrap the visible label in <Help> so the user gets the same instant
  // rich-popover affordance (dotted underline + styled tooltip) we use
  // everywhere else. Native `title=` is too slow and invisible to be the
  // primary discovery affordance on the main nav strip.
  // The Help wrapper handles hover/focus to show the popover; the button's
  // onClick still fires for normal navigation because clicks bubble up.
  return (
    <button onClick={onClick} title={tip} style={{ ...tabStyle, ...(active ? tabActiveStyle : {}) }}>
      {tip ? <Help text={tip}>{children}</Help> : children}
    </button>
  );
}

// --- styles ---

const appStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr',
  height: '100vh',
  background: '#1e1f22',
  color: '#d7d9dc',
};
const bodyStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 340px',
  overflow: 'hidden',
};
const mainStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto 1fr',
  overflow: 'hidden',
};
const sidebarStyle: React.CSSProperties = { overflow: 'hidden' };
const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 16px',
  background: '#26282c',
  borderBottom: '1px solid #3f4147',
  flexWrap: 'wrap',
};
const brandStyle: React.CSSProperties = { fontWeight: 600, color: '#9ca0a8', letterSpacing: 0.3, marginRight: 8 };
const labelStyle: React.CSSProperties = { color: '#7e8189', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 };
const selectStyle: React.CSSProperties = {
  background: '#1e1f22',
  color: '#d7d9dc',
  border: '1px solid #3f4147',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 12,
};
const inputStyle: React.CSSProperties = { ...selectStyle, width: 160 };
const descStyle: React.CSSProperties = { marginLeft: 'auto', color: '#7e8189', fontSize: 11, fontStyle: 'italic' };
const paneHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: '#7e8189',
  padding: '6px 12px', background: '#26282c', borderBottom: '1px solid #3f4147',
  textTransform: 'uppercase',
};
const flamePanelStyle: React.CSSProperties = { background: '#1e1f22', overflow: 'hidden', minHeight: 180 };
const tabsStyle: React.CSSProperties = {
  display: 'flex', gap: 0, background: '#26282c', borderTop: '1px solid #3f4147', borderBottom: '1px solid #3f4147',
};
const tabStyle: React.CSSProperties = {
  padding: '6px 14px', background: 'transparent', border: 'none', color: '#9ca0a8',
  fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer', fontWeight: 600,
};
const tabActiveStyle: React.CSSProperties = { color: '#d7d9dc', borderBottom: '2px solid #5b8def' };
const bottomPanelStyle: React.CSSProperties = { overflow: 'hidden', background: '#1e1f22' };
const errorStyle: React.CSSProperties = { color: '#ff7e7e', padding: 16, fontFamily: 'monospace' };
const emptyStyle: React.CSSProperties = { color: '#6e717a', padding: 16, fontStyle: 'italic' };
const filterChipStyle: React.CSSProperties = {
  marginLeft: 12, padding: '2px 8px', borderRadius: 3, background: '#3a3326',
  color: '#ffd569', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4,
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const chipCloseStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#ffd569', cursor: 'pointer',
  fontSize: 14, lineHeight: 1, padding: 0,
};
const resetBtnStyle: React.CSSProperties = {
  marginLeft: 'auto', background: 'transparent', border: '1px solid #3f4147',
  color: '#9ca0a8', fontSize: 10, padding: '2px 8px', borderRadius: 3,
  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.4,
};
