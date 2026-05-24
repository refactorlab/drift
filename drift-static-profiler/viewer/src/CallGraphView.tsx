// Call Graph view — JetBrains-style box-and-arrow diagram.
//
// Layer 2 of the call-graph stack. This file is presentation-only: it
// consumes the deduped graph + layout from `callGraph.ts` and renders
// them as SVG, plus the pan/zoom/fit toolbar.
//
// Generic over the source-node type so the same renderer is used by:
//   - drift-static-profiler/viewer (TNode = CallTreeNode)
//   - drift-lab/desktop-ui          (TNode = EventLogTreeNode)
//
// Theme is driven by CSS variables — the renderer carries DARK
// defaults (matching the static profiler's existing look), but a host
// app can override any of `--cg-bg`, `--cg-toolbar-bg`,
// `--cg-toolbar-active-bg`, `--cg-border`, `--cg-text`,
// `--cg-text-muted`, `--cg-edge`, `--cg-accent` to get light or any
// other look. The heat-ramp node fills are intentionally NOT themed
// because they're semantic (hot red → mid amber → cool green).
//
// What each box shows is driven by the adapter, not this file. The
// adapter pre-formats `totalDisplay` ("47", "12.4 ms"),
// `secondaryLabel` ("Own", "Self"), and `secondaryDisplay` ("47 loc
// · cx 8", "3.1 ms"). The renderer is host-agnostic.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_LAYOUT,
  buildCallGraph,
  displayName,
  layoutGraph,
  nodeColor,
} from './callGraph';
import type {
  CallGraphAdapter,
  LayoutResult,
  PositionedEdge,
  PositionedNode,
} from './callGraph';

interface Props<TNode> {
  root: TNode;
  adapter: CallGraphAdapter<TNode>;
  /// Highlighted in the graph. Caller computes this from its own
  /// selection state (commonly: `selected?.id ?? null`).
  selectedId: string | null;
  onSelect: (node: TNode) => void;
  /// Free-text filter — non-matching nodes dim to 35% opacity.
  search: string;
}

type Direction = 'TB' | 'LR';

interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

const IDENTITY: ViewTransform = { zoom: 1, panX: 0, panY: 0 };

export function CallGraphView<TNode>({
  root,
  adapter,
  selectedId,
  onSelect,
  search,
}: Props<TNode>) {
  const [direction, setDirection] = useState<Direction>('TB');
  const [view, setView] = useState<ViewTransform>(IDENTITY);

  // The layout is pure over (root, adapter, direction). Memoize so
  // pan/zoom don't trigger re-layout — panning a 200-node graph
  // would otherwise burn CPU on every mousemove.
  const layout = useMemo<LayoutResult<TNode>>(
    () =>
      layoutGraph(buildCallGraph(root, adapter), {
        ...DEFAULT_LAYOUT,
        direction,
      }),
    [root, adapter, direction],
  );

  // Reset pan/zoom when the picked root changes — otherwise jumping
  // between entry points strands the viewport on stale coordinates.
  const rootId = useMemo(() => adapter.getId(root), [root, adapter]);
  useEffect(() => {
    setView(IDENTITY);
  }, [rootId, direction]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 800, h: 480 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const r = e.contentRect;
        setViewport({ w: Math.floor(r.width), h: Math.floor(r.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onFit = () => {
    const padding = 20;
    const sx = (viewport.w - padding * 2) / layout.width;
    const sy = (viewport.h - padding * 2) / layout.height;
    const zoom = Math.min(1, Math.max(0.1, Math.min(sx, sy)));
    const panX = (viewport.w - layout.width * zoom) / 2;
    const panY = (viewport.h - layout.height * zoom) / 2;
    setView({ zoom, panX, panY });
  };

  // Auto-fit the first time we know both viewport size and layout size.
  // After that, the user owns the viewport.
  const autoFitDone = useRef(false);
  useEffect(() => {
    if (autoFitDone.current) return;
    if (viewport.w === 0 || viewport.h === 0) return;
    onFit();
    autoFitDone.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport, layout]);
  useEffect(() => {
    autoFitDone.current = false;
  }, [rootId, direction]);

  // Auto-pan/zoom to the matched nodes whenever the search QUERY
  // changes. Without this, a search "finds" the function (dims
  // everything else) but the user still has to hunt for the bright
  // node — defeats the point of search. We fire ONLY on query change
  // (not on layout/viewport updates) so the user can pan freely
  // afterward without the view snapping back.
  //
  // Behaviour:
  //   - empty query → no-op (don't snap back to the previous fit)
  //   - 0 matches   → no-op (nothing to frame; UX is "user typo'd")
  //   - 1 match     → center it, zoom to a reasonable level
  //   - N matches   → fit the bbox of all matches with padding
  const lastSnappedSearch = useRef<string | null>(null);
  useEffect(() => {
    const q = search.trim();
    if (q === lastSnappedSearch.current) return;
    lastSnappedSearch.current = q;
    if (q === "") return;
    if (viewport.w === 0 || viewport.h === 0) return;

    const hit = layout.nodes.filter(matches);
    if (hit.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of hit) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.w > maxX) maxX = n.x + n.w;
      if (n.y + n.h > maxY) maxY = n.y + n.h;
    }
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);

    const padding = 40;
    const sx = (viewport.w - padding * 2) / bw;
    const sy = (viewport.h - padding * 2) / bh;
    // Clamp: for a single small match we don't want to slam to 4×
    // (cuts off neighbours that give context); cap at 1.5×. For a big
    // sprawling match, the lower bound keeps the view sane.
    const zoom = Math.min(1.5, Math.max(0.3, Math.min(sx, sy)));
    const panX = viewport.w / 2 - (minX + bw / 2) * zoom;
    const panY = viewport.h / 2 - (minY + bh / 2) * zoom;
    setView({ zoom, panX, panY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, layout, viewport]);

  // ─── Pan / zoom interactions ───────────────────────────────────────
  const dragRef = useRef<{ startX: number; startY: number; pan0: ViewTransform } | null>(null);
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node-id]')) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, pan0: view };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setView({
      ...d.pan0,
      panX: d.pan0.panX + (e.clientX - d.startX),
      panY: d.pan0.panY + (e.clientY - d.startY),
    });
  };
  const onMouseUp = () => {
    dragRef.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const next = clampZoom(view.zoom * Math.exp(delta));
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const panX = cx - (cx - view.panX) * (next / view.zoom);
    const panY = cy - (cy - view.panY) * (next / view.zoom);
    setView({ zoom: next, panX, panY });
  };

  // ─── Search dim ────────────────────────────────────────────────────
  // The query is tokenised on whitespace; ALL tokens must match
  // SOMEWHERE on the node (any of: bare name, parent class, full
  // `Class.method`, file path). Tokenising fixes two real failure
  // modes the old single-substring matcher had:
  //
  //   - `OrderService.create_order` (PyCharm-style qualifier) silently
  //     missed because neither `name` nor `parentClass` alone
  //     contained the whole literal. Now we also check the joined
  //     `Class.method` haystack.
  //   - Multi-term searches like `OrderService create` were treated as
  //     one literal substring. Now each token matches independently.
  const tokens = useMemo(
    () =>
      search
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0),
    [search],
  );
  const matches = (n: PositionedNode<TNode>) => {
    if (tokens.length === 0) return true;
    const haystack = [
      n.name,
      n.parentClass,
      n.parentClass ? `${n.parentClass}.${n.name}` : null,
      n.file,
    ]
      .filter((s): s is string => !!s)
      .join(" ")
      .toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  };

  return (
    <div style={shellStyle}>
      <Toolbar
        direction={direction}
        onDirection={setDirection}
        zoom={view.zoom}
        onZoomIn={() => setView({ ...view, zoom: clampZoom(view.zoom * 1.2) })}
        onZoomOut={() => setView({ ...view, zoom: clampZoom(view.zoom / 1.2) })}
        onReset={() => setView(IDENTITY)}
        onFit={onFit}
        nodeCount={layout.nodes.length}
        edgeCount={layout.edges.length}
      />
      <div
        ref={containerRef}
        style={canvasStyle}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <svg
          width={viewport.w}
          height={viewport.h}
          style={{ display: 'block', cursor: dragRef.current ? 'grabbing' : 'grab' }}
        >
          <defs>
            <marker
              id="cg-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--cg-edge, #6e717a)" />
            </marker>
          </defs>
          <g transform={`translate(${view.panX} ${view.panY}) scale(${view.zoom})`}>
            {layout.edges.map((e) => (
              <EdgePath key={`${e.from}->${e.to}`} edge={e} />
            ))}
            {layout.nodes.map((n) => (
              <NodeBox
                key={n.id}
                node={n}
                selected={n.id === selectedId}
                dimmed={!matches(n)}
                onClick={() => onSelect(n.source)}
              />
            ))}
          </g>
        </svg>
        {layout.nodes.length === 0 && <div style={emptyStyle}>nothing reachable from this root</div>}
      </div>
    </div>
  );
}

function clampZoom(z: number): number {
  return Math.min(4, Math.max(0.1, z));
}

// ─── Edge ──────────────────────────────────────────────────────────────

function EdgePath({ edge }: { edge: PositionedEdge }) {
  return (
    <path
      d={edge.path}
      fill="none"
      stroke="var(--cg-edge, #6e717a)"
      strokeWidth={1.2}
      markerEnd="url(#cg-arrow)"
    />
  );
}

// ─── Node box ──────────────────────────────────────────────────────────

function NodeBox<TNode>({
  node,
  selected,
  dimmed,
  onClick,
}: {
  node: PositionedNode<TNode>;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const color = nodeColor(node.percentTotal);
  const opacity = dimmed ? 0.35 : 1;
  const label = displayName(node);
  const total = `${node.totalDisplay} (${node.percentTotal.toFixed(1)}%)`;
  const secondary = node.secondaryDisplay;

  return (
    <g
      data-node-id={node.id}
      transform={`translate(${node.x} ${node.y})`}
      onClick={onClick}
      style={{ cursor: 'pointer', opacity }}
    >
      <title>
        {label}
        {node.file && `\nfile: ${node.file}:${node.line ?? '?'}`}
        {`\ntotal: ${node.totalDisplay} (${node.percentTotal.toFixed(2)}% of root)`}
        {`\n${node.secondaryLabel.toLowerCase()}: ${node.secondaryDisplay}`}
        {`\n${node.callCount > 1 ? 'calls' : 'call'}: ${node.callCount}`}
      </title>
      <rect
        x={0}
        y={0}
        width={node.w}
        height={node.h}
        rx={4}
        fill={color.fill}
        stroke={selected ? 'var(--cg-accent, #5b8def)' : color.border}
        strokeWidth={selected ? 2 : 1}
      />
      <text
        x={10}
        y={18}
        fill={color.text}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize={12}
        fontWeight={700}
      >
        {label}
      </text>
      <text
        x={node.w - 10}
        y={18}
        textAnchor="end"
        fill={color.text}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize={11}
        fontWeight={600}
      >
        ×{node.callCount}
      </text>
      <text
        x={10}
        y={36}
        fill={color.text}
        fontFamily="ui-monospace, monospace"
        fontSize={10.5}
      >
        Total:&nbsp;
        <tspan fontWeight={700}>{total}</tspan>
      </text>
      <text
        x={10}
        y={52}
        fill={color.text}
        fontFamily="ui-monospace, monospace"
        fontSize={10.5}
      >
        {node.secondaryLabel}:&nbsp;
        <tspan fontWeight={700}>{secondary}</tspan>
      </text>
    </g>
  );
}

// ─── Toolbar ───────────────────────────────────────────────────────────

function Toolbar({
  direction,
  onDirection,
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
  nodeCount,
  edgeCount,
}: {
  direction: Direction;
  onDirection: (d: Direction) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
  nodeCount: number;
  edgeCount: number;
}) {
  return (
    <div style={toolbarStyle}>
      <button style={btnStyle} onClick={onZoomIn} title="Zoom in (or scroll up)">+</button>
      <button style={btnStyle} onClick={onZoomOut} title="Zoom out (or scroll down)">−</button>
      <button style={btnStyle} onClick={onReset} title="Reset zoom to 100% and recenter pan">1:1</button>
      <button style={btnStyle} onClick={onFit} title="Fit the whole graph in the viewport">fit</button>
      <span style={dividerStyle} />
      <button
        style={{ ...btnStyle, ...(direction === 'TB' ? btnActiveStyle : {}) }}
        onClick={() => onDirection('TB')}
        title="Top → Bottom layout (callers above, callees below)"
      >
        ⇣ TB
      </button>
      <button
        style={{ ...btnStyle, ...(direction === 'LR' ? btnActiveStyle : {}) }}
        onClick={() => onDirection('LR')}
        title="Left → Right layout (callers left, callees right)"
      >
        ⇢ LR
      </button>
      <span style={dividerStyle} />
      <span style={statusStyle}>
        {nodeCount} nodes · {edgeCount} edges · zoom {(zoom * 100).toFixed(0)}%
      </span>
      <span style={legendStyle}>
        <LegendSwatch fill="#e26d6d" label="≥40%" />
        <LegendSwatch fill="#e0a458" label="5–40%" />
        <LegendSwatch fill="#8fbf9f" label="<5%" />
      </span>
    </div>
  );
}

function LegendSwatch({ fill, label }: { fill: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          background: fill,
          border: '1px solid var(--cg-border, #3f4147)',
          borderRadius: 2,
        }}
      />
      <span style={{ color: 'var(--cg-text-muted, #9ca0a8)', fontSize: 10 }}>{label}</span>
    </span>
  );
}

// ─── styles (theme-aware via CSS vars w/ dark fallbacks) ───────────────

const shellStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  height: '100%',
  background: 'var(--cg-bg, #1e1f22)',
};

const canvasStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  background: 'var(--cg-bg, #1e1f22)',
  userSelect: 'none',
  minHeight: 360,
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  background: 'var(--cg-toolbar-bg, #26282c)',
  borderBottom: '1px solid var(--cg-border, #3f4147)',
  fontSize: 11,
};

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--cg-border, #3f4147)',
  color: 'var(--cg-text, #d7d9dc)',
  fontSize: 11,
  padding: '3px 9px',
  borderRadius: 3,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
};

const btnActiveStyle: React.CSSProperties = {
  background: 'var(--cg-toolbar-active-bg, #3b3f44)',
  borderColor: 'var(--cg-accent, #5b8def)',
  color: 'var(--cg-text, #d7d9dc)',
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 18,
  background: 'var(--cg-border, #3f4147)',
  margin: '0 4px',
};

const statusStyle: React.CSSProperties = {
  color: 'var(--cg-text-muted, #7e8189)',
  fontSize: 10,
  marginLeft: 'auto',
};

const legendStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  marginLeft: 12,
};

const emptyStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  color: 'var(--cg-text-muted, #7e8189)',
  fontStyle: 'italic',
  fontSize: 12,
};
