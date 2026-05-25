import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";

import { loadScanEntry, loadStaticScanSummary } from "../lib/tauri";

// Viewer components — single source of truth, imported in-place via the
// tsconfig include list so there's no fork to maintain. The desktop-ui
// owns the page shell (data plumbing, routing, responsive layout); the
// viewer owns the visualisation primitives.
import { CallGraphView } from "../../../../drift-static-profiler/viewer/src/CallGraphView";
import type { CallGraphAdapter } from "../../../../drift-static-profiler/viewer/src/callGraph";
import { CallTreeView } from "../../../../drift-static-profiler/viewer/src/CallTreeView";
import { DetailsPane } from "../../../../drift-static-profiler/viewer/src/DetailsPane";
import { FlameView } from "../../../../drift-static-profiler/viewer/src/FlameView";
import { Help } from "../../../../drift-static-profiler/viewer/src/Help";
import { HotPaths } from "../../../../drift-static-profiler/viewer/src/HotPaths";
import { Insights } from "../../../../drift-static-profiler/viewer/src/Insights";
import { RootsView } from "../../../../drift-static-profiler/viewer/src/RootsView";
import { ScanReport as ViewerScanReport } from "../../../../drift-static-profiler/viewer/src/ScanReport";
import { Smells } from "../../../../drift-static-profiler/viewer/src/Smells";
import { Statistics } from "../../../../drift-static-profiler/viewer/src/Statistics";
import { SummaryBar } from "../../../../drift-static-profiler/viewer/src/SummaryBar";
import { TIPS } from "../../../../drift-static-profiler/viewer/src/tooltips";
import type {
  CallTreeNode,
  FindingKind,
  Report,
  Summary,
} from "../../../../drift-static-profiler/viewer/src/types";
import {
  Splitter,
  useResizablePanel,
} from "../../../../drift-static-profiler/viewer/src/useResizableColumns";

/**
 * In-app profiler dashboard.
 *
 * **Why this page exists.** The desktop-ui's curated `ScanReportPage` is
 * the *narrative* surface — findings list, LLM "Study this" output, one
 * row per problem. The dashboard is the *exploratory* surface — flame
 * graph, call tree, call graph neighborhood, hot paths, smells, structured
 * insights. Two complementary views for the same scan, one click apart.
 *
 * **Why no iframe.** Embedding the bundled viewer SPA in an `<iframe>`
 * works but feels foreign inside the desktop app — separate router state,
 * no shared theme, no shared focus model. Instead, the page composes the
 * viewer's own React components (imported from
 * `drift-static-profiler/viewer/src/...` via the tsconfig include list)
 * directly into the desktop window. There's exactly one implementation of
 * the flame graph + call tree across the two surfaces; the desktop
 * dashboard inherits every viewer improvement automatically.
 *
 * **Data flow.** Mirrors the viewer's two-tier load:
 *
 *   1. Tier 1 (this effect) — `loadStaticScanSummary(scanId)` returns
 *      the envelope with each entry stripped to its HEADER (counts +
 *      file:line, no children/findings). KB-sized payload, fast first
 *      paint.
 *   2. Tier 2 (background prefetch) — `loadScanEntry(scanId, idx)` for
 *      each entry, bounded concurrency, populates a per-index cache.
 *      Insights/RootsView/Statistics walk every entry, so this is the
 *      difference between "0 insights" and the real number.
 *
 * Same algorithm as the viewer's `App.tsx`; we use Tauri IPC instead of
 * HTTP because the desktop runtime already owns those commands.
 *
 * **Responsive layout.** The dashboard uses a 4-grid layout (toolbar /
 * main+sidebar via two columns, with two horizontal resizers). At narrow
 * viewports (< 900px) the right sidebar reflows below the main column —
 * the DetailsPane stays useful but no longer steals horizontal space from
 * the flame graph. Resizable splitters are hidden at that breakpoint.
 */

type FlameMode = "kind" | "category" | "complexity" | "smells";
type BottomTab =
  | "report"
  | "tree"
  | "graph"
  | "roots"
  | "hot"
  | "smells"
  | "insights"
  | "stats";

/**
 * Adapter that lets the generic `CallGraphView` render a static
 * `CallTreeNode`. Module-scope so React doesn't re-layout the graph on
 * every parent render — `CallGraphView`'s layout memo keys on identity.
 */
const STATIC_PROFILE_GRAPH_ADAPTER: CallGraphAdapter<CallTreeNode> = {
  getId: (n) => n.id,
  getChildren: (n) => n.children,
  getRootTotal: (root) => Math.max(1, root.subtree_size || 1),
  build: (n, level, rootTotal) => ({
    id: n.id,
    name: n.name,
    parentClass: n.parent_class,
    file: n.file,
    line: n.line,
    level,
    callCount: n.call_site_count,
    totalValue: n.subtree_size,
    percentTotal: (n.subtree_size / rootTotal) * 100,
    totalDisplay: String(n.subtree_size),
    secondaryLabel: "Own",
    secondaryDisplay: `${n.loc} loc · cx ${n.complexity}`,
    source: n,
  }),
};

/// Tab threshold mirror of the viewer's heuristic: when the scan has many
/// entries (the `make scan-roots` signature), default to the Roots tab so
/// the user sees the list of every entry rather than one detail at random.
const ROOTS_TAB_THRESHOLD = 5;

/// Cap on parallel `loadScanEntry` IPC calls during the background
/// prefetch. Mirrors the viewer's value — 4 is the sweet spot for a
/// localhost-backed source (each entry is a disk read on the Rust side
/// plus a CBOR decode; higher values serialize on the kernel anyway).
const PREFETCH_CONCURRENCY = 4;

/**
 * Functional Map-insert — preserves React's identity invariant for state
 * updates. `setLoadedEntries(mapWith(prev, idx, node))` is the Map
 * equivalent of `setState({...prev, [idx]: node})`.
 */
function mapWith<K, V>(m: Map<K, V>, key: K, value: V): Map<K, V> {
  const next = new Map(m);
  next.set(key, value);
  return next;
}

/**
 * Run `task` against every index in `[0, count)` with at most
 * `concurrency` tasks in flight at once. Same shape as the viewer's
 * background prefetcher — cap prevents a roots-mode scan with 200 entries
 * from spawning 200 concurrent IPC calls.
 */
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
        /* per-task failure is non-fatal; the UI shows partial data */
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, worker),
  );
}

export default function DashboardPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();

  // --- 1. Summary load (Tier 1) ---------------------------------------
  // KB-sized envelope with header-only entries. The page lights up once
  // this resolves; entries' subtrees come in lazily below.
  const [report, setReport] = useState<Report | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- 2. Per-entry cache (Tier 2) ------------------------------------
  // Keyed on entry index. Populated by two writers: the priority-fetch
  // effect (active entry first, so the flame view lights up immediately)
  // and the bounded prefetcher (every other entry in parallel).
  const [loadedEntries, setLoadedEntries] = useState<Map<number, CallTreeNode>>(
    new Map(),
  );
  const [activeRootLoading, setActiveRootLoading] = useState(false);
  // Mirror to a ref so the long-running prefetch worker reads the latest
  // map without restarting on every entry resolution.
  const loadedEntriesRef = useRef(loadedEntries);
  useEffect(() => {
    loadedEntriesRef.current = loadedEntries;
  }, [loadedEntries]);

  // In-flight dedupe — the priority effect and the prefetch worker both
  // consult this BEFORE firing a fetch, to avoid a double `loadScanEntry`
  // for the same idx (~MB redundant transfer per active-entry switch).
  const inFlightRef = useRef<Set<number>>(new Set());

  // --- 3. UI state -----------------------------------------------------
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CallTreeNode | null>(null);
  const [search, setSearch] = useState("");
  const [flameMode, setFlameMode] = useState<FlameMode>("kind");
  const [bottomTab, setBottomTab] = useState<BottomTab>("tree");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [flameZoomKey, setFlameZoomKey] = useState(0);
  const [insightsKindFilter, setInsightsKindFilter] = useState<
    FindingKind[] | null
  >(null);

  // Layout (drag-to-resize), persisted between sessions.
  const [sidebarWidth, setSidebarWidth] = useResizablePanel(
    "drift.dashboard.sidebarWidth",
    340,
    { min: 220, max: 900 },
  );
  const [bottomHeight, setBottomHeight] = useResizablePanel(
    "drift.dashboard.bottomHeight",
    360,
    { min: 140, max: 1200 },
  );
  const sidebarStart = useRef(sidebarWidth);
  const bottomStart = useRef(bottomHeight);

  // Responsive — collapse the sidebar below the main column on narrow
  // viewports so the flame graph keeps the full window width. The
  // breakpoint matches the desktop-ui's other reflow rules in globals.css.
  const isNarrow = useNarrowViewport(900);

  // --- 4. Load summary on mount + scan change --------------------------
  useEffect(() => {
    if (!scanId) return;
    let cancelled = false;
    setReport(null);
    setLoadError(null);
    setSelected(null);
    setLoadedEntries(new Map());
    inFlightRef.current = new Set();
    const summaryTag = `[dashboard] load summary ${scanId.slice(0, 8)}`;
    console.time(summaryTag);
    (async () => {
      try {
        const tStart = performance.now();
        const env = await loadStaticScanSummary(scanId);
        const tIpc = performance.now();
        if (cancelled) return;
        // Heal the IPC wire shape ONCE at the boundary — summary missing
        // arrays + entry headers missing `children`/`findings`. After
        // this line, every consumer can treat `Report` as fully-fielded.
        const normalizedReport = normalizeReport(env.report as Report);
        const tNorm = performance.now();
        console.log(
          `${summaryTag} ✓ ipc+decompress=${(tIpc - tStart).toFixed(0)}ms ` +
            `normalize=${(tNorm - tIpc).toFixed(0)}ms ` +
            `entries=${normalizedReport.entries.length}`,
        );
        // Alphabetise entries by qualified name — same ordering the viewer
        // uses, so the entry dropdown matches the standalone surface.
        const sorted = [...normalizedReport.entries].sort((a, b) => {
          const aName =
            (a.parent_class ? `${a.parent_class}.` : "") + a.name;
          const bName =
            (b.parent_class ? `${b.parent_class}.` : "") + b.name;
          return aName.localeCompare(bName);
        });
        setReport({ ...normalizedReport, entries: sorted });
        // Default-entry policy: match the standalone viewer — alphabetic
        // first entry. `<module>` / `<clinit>` sort first (ASCII `<` is
        // before letters), which is also the natural starting point for
        // exploring a script's runtime structure. A "lightest by reach"
        // heuristic seemed clever (avoid huge entries) but made the
        // default unpredictable across scans — losing the "open dashboard,
        // see what the viewer would show" UX contract.
        setActiveRootId(sorted[0]?.id ?? null);
        // Tab-default policy mirrors the viewer: findings present → Scan
        // Report tab; many entries → Roots tab; else default to Call Tree.
        const hasFindings =
          Object.keys(normalizedReport.summary.findings_by_kind ?? {}).length > 0
          || (normalizedReport.summary.findings_top?.length ?? 0) > 0;
        if (hasFindings) {
          setBottomTab("report");
        } else if (sorted.length >= ROOTS_TAB_THRESHOLD) {
          setBottomTab("roots");
        } else {
          setBottomTab("tree");
        }
      } catch (e) {
        console.warn(`${summaryTag} ✗`, e);
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        console.timeEnd(summaryTag);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  // --- 5. Priority fetch — active entry first --------------------------
  // Instrumented: this is where the dashboard most often "hangs" — the
  // active entry's expanded subtree can be 5K-20K nodes after frame
  // decompression, and module-level entries (Python `<module>`, Java
  // `<clinit>`) reach every symbol in the project. We log per-step
  // wall-clock so we can pinpoint whether the latency is in the IPC,
  // the frontend decompress, or the React render.
  useEffect(() => {
    if (!scanId || !report || !activeRootId) return;
    const idx = report.entries.findIndex((r) => r.id === activeRootId);
    if (idx < 0) return;
    // Read via the ref, not the `loadedEntries` state — `loadedEntries`
    // must NOT be in this effect's deps. If it were, every prefetch
    // landing for an UNRELATED idx would tear this effect down mid-fetch,
    // flip our `cancelled` flag to true, and silently drop the active
    // entry's result on the floor while leaving `activeRootLoading: true`.
    // The visible symptom was "Loading call tree for <module>…" forever
    // until a tab toggle re-triggered the prefetch loop and re-fetched
    // the same data the priority path had already loaded and discarded.
    if (loadedEntriesRef.current.has(idx)) return;
    if (inFlightRef.current.has(idx)) return;
    let cancelled = false;
    inFlightRef.current.add(idx);
    setActiveRootLoading(true);
    const entryName = report.entries[idx]?.name ?? `idx ${idx}`;
    const tag = `[dashboard] load entry "${entryName}" (idx ${idx})`;
    console.time(tag);
    const tIpcStart = performance.now();
    loadScanEntry(scanId, idx)
      .then((node) => {
        if (cancelled) return;
        const tIpcEnd = performance.now();
        const tNormStart = performance.now();
        const normalized = normalizeSubtree(node as CallTreeNode);
        const tNormEnd = performance.now();
        const nodeCount = countSubtreeNodes(normalized);
        console.log(
          `${tag} ✓ ipc+decompress=${(tIpcEnd - tIpcStart).toFixed(0)}ms ` +
            `normalize=${(tNormEnd - tNormStart).toFixed(0)}ms ` +
            `nodes=${nodeCount}`,
        );
        setLoadedEntries((prev) => mapWith(prev, idx, normalized));
      })
      .catch((e) => {
        console.warn(`${tag} ✗`, e);
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        console.timeEnd(tag);
        inFlightRef.current.delete(idx);
        // Always clear the spinner. If we got cancelled because the user
        // switched to a different entry, that switch's own effect re-arms
        // the spinner; leaving it `true` here just strands the UI.
        setActiveRootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scanId, activeRootId, report]);

  // --- 6. Tab-driven prefetch — load all entries ONLY when needed -----
  // The Insights / RootsView / Statistics / Scan-Report tabs walk EVERY
  // entry's `findings` / `children` aggregates. Eagerly prefetching all
  // entries at mount made the dashboard hang on huge scans (each entry
  // is a 1-5MB IPC payload + tree-walk normalisation). We now prefetch
  // ONLY when the user actually opens a tab that consumes every entry.
  // The active-entry priority fetch (effect #5) already covers the
  // FlameView / CallTree / Smells tabs — those only need one entry's
  // subtree, and that's the first thing we load.
  //
  // Trade-off: switching to Roots tab on a cold dashboard incurs a
  // short "loading…" delay while we fan out the per-entry fetches.
  // That's a much better default than spending 30s prefetching MB of
  // call-tree data the user might never look at.
  const tabNeedsAllEntries =
    bottomTab === "roots"
    || bottomTab === "insights"
    || bottomTab === "stats"
    || bottomTab === "report";
  useEffect(() => {
    if (!scanId || !report) return;
    if (!tabNeedsAllEntries) return;
    let cancelled = false;
    void forEachConcurrent(
      report.entries.length,
      PREFETCH_CONCURRENCY,
      async (idx) => {
        if (cancelled) return;
        if (loadedEntriesRef.current.has(idx)) return;
        if (inFlightRef.current.has(idx)) return;
        inFlightRef.current.add(idx);
        try {
          const node = await loadScanEntry(scanId, idx);
          if (cancelled) return;
          setLoadedEntries((prev) =>
            prev.has(idx)
              ? prev
              : mapWith(prev, idx, normalizeSubtree(node as CallTreeNode)),
          );
        } finally {
          inFlightRef.current.delete(idx);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [scanId, report, tabNeedsAllEntries]);

  // --- 7. Patched report — single source of truth for renderers --------
  // Header-only entries swap for full subtrees as `loadedEntries` fills.
  // Memoised so unrelated re-renders don't churn the nodeIndex walk.
  const patchedReport = useMemo<Report | null>(() => {
    if (!report) return null;
    if (loadedEntries.size === 0) return report;
    const entries = report.entries.map(
      (entry, idx) => loadedEntries.get(idx) ?? entry,
    );
    return { ...report, entries };
  }, [report, loadedEntries]);

  const activeRoot = useMemo<CallTreeNode | null>(() => {
    if (!patchedReport || !activeRootId) return null;
    const idx = patchedReport.entries.findIndex((r) => r.id === activeRootId);
    if (idx < 0) return null;
    return loadedEntries.get(idx) ?? null;
  }, [patchedReport, activeRootId, loadedEntries]);

  // Cross-root index — same as viewer. Lets clicks in HotPaths /
  // Statistics jump into the right entry-point tree.
  const nodeIndex = useMemo(() => {
    const byId = new Map<string, { rootId: string; node: CallTreeNode }>();
    const byFileLine = new Map<
      string,
      { rootId: string; node: CallTreeNode }
    >();
    const byName = new Map<string, { rootId: string; node: CallTreeNode }>();
    if (!patchedReport) return { byId, byFileLine, byName };
    for (const root of patchedReport.entries) {
      // Defensive walk: when `loadStaticScanSummary` returns header-only
      // entries the `children` field is absent (the Rust summary endpoint
      // strips it for wire size). The prefetch effect later replaces each
      // header with the full subtree from `loadScanEntry`, but until then
      // an entry's `children` legitimately doesn't exist. Coerce with
      // `?? []` instead of crashing the entire page render.
      const walk = (n: CallTreeNode) => {
        if (!byId.has(n.id)) byId.set(n.id, { rootId: root.id, node: n });
        const fl = `${n.file}:${n.line}`;
        if (!byFileLine.has(fl)) byFileLine.set(fl, { rootId: root.id, node: n });
        const fullName = (n.parent_class ? `${n.parent_class}.` : "") + n.name;
        if (!byName.has(fullName)) byName.set(fullName, { rootId: root.id, node: n });
        if (!byName.has(n.name)) byName.set(n.name, { rootId: root.id, node: n });
        for (const c of n.children ?? []) walk(c);
      };
      walk(root);
    }
    return { byId, byFileLine, byName };
  }, [patchedReport]);

  const jump = useCallback(
    (lookup: { id?: string; file?: string; line?: number; name?: string }) => {
      let hit: { rootId: string; node: CallTreeNode } | undefined;
      if (lookup.id) hit = nodeIndex.byId.get(lookup.id);
      if (!hit && lookup.file && typeof lookup.line === "number") {
        hit = nodeIndex.byFileLine.get(`${lookup.file}:${lookup.line}`);
      }
      if (!hit && lookup.name) hit = nodeIndex.byName.get(lookup.name);
      if (!hit) return;
      if (hit.rootId !== activeRootId) setActiveRootId(hit.rootId);
      setSelected(hit.node);
    },
    [nodeIndex, activeRootId],
  );

  const jumpTo = useCallback((id: string) => jump({ id }), [jump]);

  // --- 8. Resize observer for the flame canvas -------------------------
  const flameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 320 });
  useEffect(() => {
    if (!flameRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const r = e.contentRect;
        setSize({
          w: Math.max(320, Math.floor(r.width)),
          h: Math.max(180, Math.floor(r.height)),
        });
      }
    });
    ro.observe(flameRef.current);
    return () => ro.disconnect();
  }, []);

  // --- 9. Bump-tick reducer for any non-React mutation we might add ----
  // (Kept here as a future-proof seam for streaming-friendly updates, in
  //  case we ever subscribe to in-flight scan events from this page.)
  const [, _bump] = useReducer((n: number) => (n + 1) | 0, 0);
  void _bump;

  // --- 10. Render -------------------------------------------------------
  return (
    <div className="dashboard-page">
      <DashboardToolbar
        scanId={scanId}
        report={report}
        activeRootId={activeRootId}
        setActiveRootId={(id) => {
          setActiveRootId(id);
          setSelected(null);
        }}
        search={search}
        setSearch={setSearch}
        flameMode={flameMode}
        setFlameMode={setFlameMode}
        onBack={() =>
          navigate(scanId ? `/scan/${encodeURIComponent(scanId)}` : "/")
        }
      />

      <SummaryBar
        summary={report?.summary ?? null}
        activeCategory={categoryFilter}
        onToggleCategory={(c) =>
          setCategoryFilter((prev) => (prev === c ? null : c))
        }
      />

      {loadError && (
        <div className="dashboard-error" role="alert">
          Failed to load scan: {loadError}
        </div>
      )}

      <div
        className={isNarrow ? "dashboard-body dashboard-body--narrow" : "dashboard-body"}
        style={
          // Wide layout: main column (1fr) | vertical splitter (6px) |
          // sidebar (sidebarWidth px). Narrow layout: single column, no
          // splitter — sidebar reflows under main via the --narrow class.
          isNarrow
            ? { gridTemplateColumns: "1fr" }
            : { gridTemplateColumns: `1fr 6px ${sidebarWidth}px` }
        }
      >
        <div
          className="dashboard-main"
          style={{
            // toolbar (auto) | flame (1fr) | tabs (auto) | h-splitter (6) | bottom
            gridTemplateRows: `auto 1fr auto 6px ${bottomHeight}px`,
          }}
        >
          <div className="dashboard-pane-head">
            <Help text={TIPS.flame_graph}>FLAME GRAPH</Help>
            <span className="dashboard-pane-sub">
              · <Help
                  text={
                    flameMode === "kind"
                      ? TIPS.flame_mode_kind
                      : flameMode === "category"
                        ? TIPS.flame_mode_category
                        : flameMode === "complexity"
                          ? TIPS.flame_mode_complexity
                          : TIPS.flame_mode_smells
                  }
                >
                  color by {flameMode === "kind"
                    ? "symbol kind"
                    : flameMode === "category"
                      ? "resource category"
                      : flameMode === "complexity"
                        ? "complexity"
                        : "smells"}
                </Help>
            </span>
            {categoryFilter && (
              <span className="dashboard-filter-chip" title={TIPS.toolbar_filter_chip}>
                filter: {categoryFilter}
                <button
                  type="button"
                  className="dashboard-filter-chip-close"
                  onClick={() => setCategoryFilter(null)}
                  title="Clear the category filter"
                >
                  ×
                </button>
              </span>
            )}
            <button
              type="button"
              className="dashboard-reset-btn"
              onClick={() => setFlameZoomKey((k) => k + 1)}
              title="Reset zoom to full flame graph (click any frame to zoom in again)"
            >
              ↺ zoom
            </button>
            {selected && (
              <button
                type="button"
                className="dashboard-reset-btn"
                style={{ marginLeft: 4 }}
                onClick={() => {
                  setSelected(activeRoot);
                  setFlameZoomKey((k) => k + 1);
                }}
                title={TIPS.toolbar_back_to_root}
              >
                ← back to root
              </button>
            )}
          </div>

          <div ref={flameRef} className="dashboard-flame-panel">
            {activeRoot && (
              <FlameView
                key={`${activeRootId ?? ""}-${flameZoomKey}`}
                root={activeRoot}
                search={search}
                mode={flameMode}
                categoryFilter={categoryFilter}
                onSelect={setSelected}
                height={size.h}
                width={size.w}
              />
            )}
            {!activeRoot && activeRootLoading && (
              <FlameLoading
                entryLabel={
                  report?.entries.find((r) => r.id === activeRootId)?.name ??
                  "entry"
                }
              />
            )}
            {!activeRoot && !activeRootLoading && (
              <div className="dashboard-empty">
                {report ? "Pick an entry to view its flame graph." : "Loading scan…"}
              </div>
            )}
          </div>

          <div className="dashboard-tabs" role="tablist">
            <DashboardTab
              active={bottomTab === "report"}
              onClick={() => setBottomTab("report")}
              tip="One-screen scan report — health score, findings breakdown, hot zones, entry points."
            >
              Scan Report
            </DashboardTab>
            <DashboardTab
              active={bottomTab === "tree"}
              onClick={() => setBottomTab("tree")}
              tip={TIPS.tab_call_tree}
            >
              Call Tree
            </DashboardTab>
            <DashboardTab
              active={bottomTab === "graph"}
              onClick={() => setBottomTab("graph")}
              tip={TIPS.tab_call_graph}
            >
              Call Graph
            </DashboardTab>
            <DashboardTab
              active={bottomTab === "roots"}
              onClick={() => setBottomTab("roots")}
              tip={TIPS.tab_roots}
            >
              Roots{report?.entries.length ? ` (${report.entries.length})` : ""}
            </DashboardTab>
            <DashboardTab
              active={bottomTab === "hot"}
              onClick={() => setBottomTab("hot")}
              tip={TIPS.tab_hot_paths}
            >
              Hot Paths{report?.summary.hot_paths.length
                ? ` (${report.summary.hot_paths.length})`
                : ""}
            </DashboardTab>
            <DashboardTab
              active={bottomTab === "smells"}
              onClick={() => setBottomTab("smells")}
              tip={TIPS.tab_smells}
            >
              Smells{smellsCount(activeRoot) ? ` (${smellsCount(activeRoot)})` : ""}
            </DashboardTab>
            <DashboardTab
              active={bottomTab === "insights"}
              onClick={() => setBottomTab("insights")}
              tip="Structured findings — N+1, blocking I/O, recursion, etc. with severity, evidence, and remediation hints."
            >
              Insights{findingsCount(report)
                ? ` (${findingsCount(report)})`
                : ""}
            </DashboardTab>
            <DashboardTab
              active={bottomTab === "stats"}
              onClick={() => setBottomTab("stats")}
              tip={TIPS.tab_statistics}
            >
              Statistics
            </DashboardTab>
          </div>

          {!isNarrow && (
            <Splitter
              orientation="horizontal"
              onDragStart={() => {
                bottomStart.current = bottomHeight;
              }}
              onDrag={(dy) => setBottomHeight(bottomStart.current - dy)}
            />
          )}

          <div className="dashboard-bottom-panel">
            {bottomTab === "report" && (
              <ViewerScanReport
                report={patchedReport}
                onJump={jump}
                onShowKind={(kind) => {
                  setInsightsKindFilter([kind]);
                  setBottomTab("insights");
                }}
                onPickRoot={(id) => {
                  setActiveRootId(id);
                  setSelected(null);
                  setBottomTab("tree");
                }}
              />
            )}
            {bottomTab === "tree" && activeRoot && (
              <CallTreeView
                root={activeRoot}
                search={search}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
            )}
            {bottomTab === "graph" && activeRoot && (
              <CallGraphView<CallTreeNode>
                root={activeRoot}
                adapter={STATIC_PROFILE_GRAPH_ADAPTER}
                search={search}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
            )}
            {bottomTab === "roots" && (
              <RootsView
                roots={report?.entries ?? []}
                activeRootId={activeRootId}
                onSelect={(id) => {
                  setActiveRootId(id);
                  setSelected(null);
                }}
              />
            )}
            {bottomTab === "hot" && (
              <HotPaths
                paths={report?.summary.hot_paths ?? []}
                onJump={(name) => jump({ name })}
              />
            )}
            {bottomTab === "smells" && (
              <Smells root={activeRoot} onSelect={setSelected} />
            )}
            {bottomTab === "insights" && (
              <Insights
                report={patchedReport}
                presetKinds={insightsKindFilter ?? undefined}
                onJump={jump}
              />
            )}
            {bottomTab === "stats" && (
              <Statistics summary={report?.summary ?? null} onJump={jump} />
            )}
          </div>
        </div>

        {!isNarrow && (
          <Splitter
            orientation="vertical"
            onDragStart={() => {
              sidebarStart.current = sidebarWidth;
            }}
            onDrag={(dx) => setSidebarWidth(sidebarStart.current - dx)}
          />
        )}

        <div className="dashboard-sidebar">
          <DetailsPane
            node={selected ?? activeRoot}
            onJumpTo={jumpTo}
            onJumpExternal={(file, line) => jump({ file, line })}
          />
        </div>
      </div>
    </div>
  );
}

// ---------- Subcomponents ---------------------------------------------------

interface ToolbarProps {
  scanId: string | undefined;
  report: Report | null;
  activeRootId: string | null;
  setActiveRootId: (id: string) => void;
  search: string;
  setSearch: (s: string) => void;
  flameMode: FlameMode;
  setFlameMode: (m: FlameMode) => void;
  onBack: () => void;
}

function DashboardToolbar({
  scanId,
  report,
  activeRootId,
  setActiveRootId,
  search,
  setSearch,
  flameMode,
  setFlameMode,
  onBack,
}: ToolbarProps) {
  // Entry dropdown filter — same UX as the viewer: search narrows the
  // entry list, the active selection is always kept in the dropdown even
  // if filtered out, so the <select> value stays valid.
  const entries = report?.entries ?? [];
  const filteredRoots = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    const matched = entries.filter((r) => {
      const name = ((r.parent_class ? `${r.parent_class}.` : "") + r.name).toLowerCase();
      const file = r.file.toLowerCase();
      if (name.includes(q) || file.includes(q)) return true;
      if (`${file}:${name}`.includes(q)) return true;
      if (`${file}:${r.line}`.includes(q)) return true;
      return false;
    });
    if (activeRootId && !matched.find((r) => r.id === activeRootId)) {
      const active = entries.find((r) => r.id === activeRootId);
      if (active) matched.unshift(active);
    }
    return matched;
  }, [entries, search, activeRootId]);

  return (
    <div className="dashboard-toolbar">
      <button
        type="button"
        className="ghost-btn"
        onClick={onBack}
        title={scanId ? "Back to the scan report" : "Back to home"}
      >
        ← Back
      </button>
      <div className="dashboard-brand">
        <Help text={TIPS.brand}>profiler dashboard</Help>
      </div>
      {scanId && (
        <span className="dashboard-scan-id muted">
          scan <code>{scanId.slice(0, 8)}…</code>
        </span>
      )}

      <label className="dashboard-label">
        <Help text={TIPS.toolbar_entry}>Entry</Help>
      </label>
      <select
        value={activeRootId ?? ""}
        onChange={(e) => setActiveRootId(e.target.value)}
        className="dashboard-select dashboard-select--wide"
        disabled={filteredRoots.length === 0}
        title={TIPS.toolbar_entry}
      >
        {filteredRoots.map((r) => (
          <option key={r.id} value={r.id}>
            {(r.parent_class ? `${r.parent_class}.` : "") + r.name} — {r.file}:{r.line}
          </option>
        ))}
      </select>

      <label className="dashboard-label">
        <Help text={TIPS.toolbar_color}>Color</Help>
      </label>
      <select
        value={flameMode}
        onChange={(e) => setFlameMode(e.target.value as FlameMode)}
        className="dashboard-select"
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
        onChange={(e) => setSearch(e.target.value)}
        placeholder="search…"
        title={TIPS.toolbar_search}
        className="dashboard-input"
      />
    </div>
  );
}

function DashboardTab({
  active,
  onClick,
  children,
  tip,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tip?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={tip}
      className={active ? "dashboard-tab dashboard-tab--active" : "dashboard-tab"}
    >
      {tip ? <Help text={tip}>{children}</Help> : children}
    </button>
  );
}

/**
 * Loading affordance for the flame panel. Shows the entry name being
 * loaded so the user has signal beyond "spinner spinning", and surfaces
 * a "this entry is huge — try picking a smaller one" hint after 3s.
 *
 * Why the 3s hint matters: heavy entries (Python `<module>`, Java
 * `<clinit>`, anything with reach across the whole project) can take
 * tens of seconds to load even on small scans because the subtree
 * transitively contains every reachable symbol. The default-entry
 * picker tries to avoid these, but a user who clicks the dropdown and
 * picks them explicitly should see a clear explanation, not a frozen
 * spinner.
 */
function FlameLoading({ entryLabel }: { entryLabel: string }) {
  const [showSlow, setShowSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowSlow(true), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="dashboard-empty dashboard-empty--column"
      role="status"
      aria-live="polite"
    >
      <span className="dashboard-spinner" aria-hidden />
      <div className="dashboard-loading-text">
        <div>
          Loading call tree for{" "}
          <code className="dashboard-loading-name">{entryLabel}</code>…
        </div>
        {showSlow && (
          <div className="dashboard-loading-slow muted">
            This entry has a large reachable subtree. For a faster view,
            pick a more specific function from the Entry dropdown above —
            module-level entries (Python <code>&lt;module&gt;</code>, Java{" "}
            <code>&lt;clinit&gt;</code>) reach the whole project.
          </div>
        )}
      </div>
    </div>
  );
}


// ---------- Helpers ---------------------------------------------------------

/**
 * Coerce a `Report` from the IPC wire shape into the fully-fielded form
 * the viewer's components expect.
 *
 * The Rust `load_static_scan_summary` endpoint strips empty arrays and
 * absent records from BOTH the top-level `Report.entries[*]` (no
 * `children`/`findings`/`external_calls`/`callers`) AND the
 * `Report.summary` (no `hot_paths`/`top_callers`/`dead_code`/etc. when
 * they'd be empty). The viewer's components were written against the
 * canonical JSON-file shape where those fields are always present as
 * empty arrays — they walk `.length` and iterate without nil checks.
 *
 * We heal the shape difference once, at the IPC boundary, instead of
 * sprinkling `?? []` across the whole render tree. This is the
 * Single-Responsibility seam: one place owns the wire→memory adapter,
 * and the rest of the page treats `Report` as a total type.
 */
function normalizeReport(report: Report): Report {
  return {
    ...report,
    summary: normalizeSummary(report.summary),
    entries: report.entries.map(normalizeHeaderEntry),
  };
}

/**
 * Required fields per `Summary` (see viewer/src/types.ts): coerce missing
 * arrays to `[]` and missing records to `{}`. Optional Phase-E fields
 * (`findings_by_kind?`, `roots_overview?`, …) stay optional — the viewer
 * already nil-checks those.
 */
function normalizeSummary(summary: Summary | null | undefined): Summary {
  const s = (summary ?? {}) as Partial<Summary>;
  return {
    languages: s.languages ?? [],
    files: s.files ?? 0,
    symbols: s.symbols ?? 0,
    edges: s.edges ?? 0,
    categories: s.categories ?? {},
    top_callers: s.top_callers ?? [],
    top_callees: s.top_callees ?? [],
    hot_paths: s.hot_paths ?? [],
    dead_code: s.dead_code ?? [],
    pagerank_top: s.pagerank_top ?? [],
    recursive_symbols: s.recursive_symbols ?? [],
    // Optional fields — pass through unchanged.
    language_breakdown: s.language_breakdown,
    profiled_language: s.profiled_language,
    profiled_language_percent: s.profiled_language_percent,
    findings_by_kind: s.findings_by_kind,
    findings_top: s.findings_top,
    findings_by_category: s.findings_by_category,
    findings_by_orm_family: s.findings_by_orm_family,
    findings_top_by_category: s.findings_top_by_category,
    roots_overview: s.roots_overview,
    immediate_fixes: s.immediate_fixes,
    refactor_candidates: s.refactor_candidates,
    entry_declarations: s.entry_declarations,
  };
}

/**
 * Total coercion for a single `CallTreeNode`.
 *
 * The viewer's components were written against the canonical JSON file
 * shape where every required `CallTreeNode` field is present (with `[]`
 * / `0` / `false` for "absent"). The Rust IPC summary endpoint strips
 * empties to save wire bytes AND the Schema v1.2 compact format moves
 * symbol-intrinsic fields (`kind`, `complexity`, `loc`, `pagerank`,
 * `callers`, …) onto `Frame` — they only re-hydrate when a node has a
 * complete Frame on the wire. Header-only entries returned by
 * `load_static_scan_summary` therefore commonly arrive with `kind`,
 * `complexity`, and friends as `undefined`.
 *
 * This function is **total** — it returns a value that satisfies the
 * `CallTreeNode` contract for every required field. Consumers downstream
 * (FlameView, CallTreeView, RootsView, Insights, …) never need to
 * `?? defaultValue` because the boundary already did.
 *
 * Defaults are semantically neutral so "header-only" rows render as
 * "best guess" instead of crashing or showing NaN. The background
 * prefetch overwrites with real data once `load_scan_entry` resolves
 * each index.
 */
function normalizeHeaderEntry(entry: CallTreeNode): CallTreeNode {
  // Fast path — well-formed wire data already satisfies the contract. The
  // existence of `kind` is our sentinel; if it's present the rest of the
  // shape is almost always present too (it's part of the same struct in
  // the Rust serializer). Skipping the allocation here is a 2-5× speedup
  // on large subtrees where every node passes through this function.
  if (
    typeof entry.kind === "string" &&
    Array.isArray(entry.children) &&
    Array.isArray(entry.callers) &&
    Array.isArray(entry.external_calls)
  ) {
    return entry;
  }
  const e = entry as Partial<CallTreeNode> & { [k: string]: unknown };
  return {
    // Identity
    id: typeof e.id === "string" ? e.id : "",
    name: typeof e.name === "string" ? e.name : "",
    kind: (e.kind ?? "Function") as CallTreeNode["kind"],
    file: typeof e.file === "string" ? e.file : "",
    line: typeof e.line === "number" ? e.line : 0,
    depth: typeof e.depth === "number" ? e.depth : 0,
    parent_class: typeof e.parent_class === "string" ? e.parent_class : null,
    children: Array.isArray(e.children) ? e.children : [],
    truncated_reason:
      typeof e.truncated_reason === "string" ? e.truncated_reason : null,
    // Call graph
    callers: Array.isArray(e.callers) ? e.callers : [],
    callers_count: typeof e.callers_count === "number" ? e.callers_count : 0,
    callees_count: typeof e.callees_count === "number" ? e.callees_count : 0,
    subtree_size: typeof e.subtree_size === "number" ? e.subtree_size : 1,
    // Categories
    category_self: (e.category_self ?? null) as CallTreeNode["category_self"],
    categories_reached:
      e.categories_reached && typeof e.categories_reached === "object"
        ? (e.categories_reached as Record<string, number>)
        : {},
    external_calls: Array.isArray(e.external_calls) ? e.external_calls : [],
    // Phase A — code quality
    complexity: typeof e.complexity === "number" ? e.complexity : 0,
    loc: typeof e.loc === "number" ? e.loc : 0,
    nesting_depth: typeof e.nesting_depth === "number" ? e.nesting_depth : 0,
    parameter_count:
      typeof e.parameter_count === "number" ? e.parameter_count : 0,
    is_async: typeof e.is_async === "boolean" ? e.is_async : false,
    // Phase B — graph-derived
    call_site_count:
      typeof e.call_site_count === "number" ? e.call_site_count : 0,
    is_recursive: typeof e.is_recursive === "boolean" ? e.is_recursive : false,
    pagerank: typeof e.pagerank === "number" ? e.pagerank : 0,
    // Phase C — tree percentages
    percent_total: typeof e.percent_total === "number" ? e.percent_total : 0,
    percent_parent:
      typeof e.percent_parent === "number" ? e.percent_parent : 0,
    // Phase D — risk flags
    n_plus_one_risk:
      typeof e.n_plus_one_risk === "boolean" ? e.n_plus_one_risk : false,
    blocking_in_async:
      typeof e.blocking_in_async === "boolean" ? e.blocking_in_async : false,
    // Phase E — optional findings
    findings: Array.isArray(e.findings) ? e.findings : [],
    // Entry labels — optional
    entry_labels: Array.isArray(e.entry_labels) ? e.entry_labels : undefined,
  };
}

/**
 * Deep variant — recursively coerces missing arrays on every node in a
 * subtree. Used after `loadScanEntry` so any node at any depth has the
 * arrays the viewer's renderers expect. Cheap: only allocates new
 * objects for nodes that actually needed coercion.
 */
function normalizeSubtree(node: CallTreeNode): CallTreeNode {
  const fixed = normalizeHeaderEntry(node);
  if (fixed.children.length === 0) return fixed;
  let mutated = false;
  const nextChildren = fixed.children.map((c) => {
    const f = normalizeSubtree(c);
    if (f !== c) mutated = true;
    return f;
  });
  return mutated ? { ...fixed, children: nextChildren } : fixed;
}

/**
 * Walk a subtree and count nodes. Used only for diagnostic logging so
 * the user can see how big "<module>" really expanded to — a 562KB
 * compact scan can expand into 5K-20K JS objects after decompression.
 */
function countSubtreeNodes(node: CallTreeNode | null | undefined): number {
  if (!node) return 0;
  let n = 1;
  for (const c of node.children ?? []) n += countSubtreeNodes(c);
  return n;
}

function smellsCount(node: CallTreeNode | null): number {
  if (!node) return 0;
  let n = 0;
  const visit = (x: CallTreeNode) => {
    if (x.n_plus_one_risk) n++;
    if (x.blocking_in_async) n++;
    if (x.is_recursive) n++;
    for (const c of x.children ?? []) visit(c);
  };
  visit(node);
  return n;
}

function findingsCount(report: Report | null): number {
  if (!report) return 0;
  const byKind = report.summary.findings_by_kind;
  if (byKind) return Object.values(byKind).reduce((a, b) => a + b, 0);
  let n = 0;
  const visit = (x: CallTreeNode) => {
    n += x.findings?.length ?? 0;
    for (const c of x.children ?? []) visit(c);
  };
  for (const e of report.entries) visit(e);
  return n;
}

/**
 * `window.matchMedia`-backed boolean — true when the viewport is below
 * `maxPx`. SSR-safe (returns false if `window` is missing).
 */
function useNarrowViewport(maxPx: number): boolean {
  const query = `(max-width: ${maxPx}px)`;
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    // Safari < 14 fallback
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);
  return narrow;
}
