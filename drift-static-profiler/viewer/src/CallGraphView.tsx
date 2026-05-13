// Call Graph view — JetBrains-style box-and-arrow diagram.
//
// Layer 2 of the call-graph stack. This file is presentation-only: it
// consumes the deduped graph + layout from `callGraph.ts` and renders
// them as SVG, plus the pan/zoom/fit toolbar.
//
// What each box shows (static-profile analog of the JetBrains runtime view):
//   - title row:  Class.method        ×{call_site_count}
//   - total row:  Total: {subtree_size} ({percent_total}%)
//   - own row:    Own:   {loc} loc · cx {complexity}
// Color: 3-band heat ramp on percent_total (red → amber → green).

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_LAYOUT,
  buildCallGraph,
  displayName,
  layoutGraph,
  nodeColor,
} from './callGraph';
import type { LayoutResult, PositionedEdge, PositionedNode } from './callGraph';
import type { CallTreeNode } from './types';

interface Props {
  root: CallTreeNode;
  /// Highlighted in the graph; identical to FlameView / CallTreeView.
  selectedId: string | null;
  onSelect: (node: CallTreeNode) => void;
  search: string;
}

type Direction = 'TB' | 'LR';

interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

const IDENTITY: ViewTransform = { zoom: 1, panX: 0, panY: 0 };

export function CallGraphView({ root, selectedId, onSelect, search }: Props) {
  const [direction, setDirection] = useState<Direction>('TB');
  const [view, setView] = useState<ViewTransform>(IDENTITY);

  // The layout is a pure function of the root + direction. Memoize so
  // pan/zoom don't trigger re-layout (panning a 200-node graph would
  // otherwise burn CPU on every mousemove).
  const layout = useMemo<LayoutResult>(
    () => layoutGraph(buildCallGraph(root), { ...DEFAULT_LAYOUT, direction }),
    [root, direction],
  );

  // Reset pan/zoom when the picked root changes — otherwise jumping
  // between entry points strands the viewport on stale coordinates.
  useEffect(() => {
    setView(IDENTITY);
  }, [root.id, direction]);

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
  }, [viewport, layout]);
  // Re-arm auto-fit when the source root or direction changes.
  useEffect(() => {
    autoFitDone.current = false;
  }, [root.id, direction]);

  // ─── Pan / zoom interactions ───────────────────────────────────────
  const dragRef = useRef<{ startX: number; startY: number; pan0: ViewTransform } | null>(null);
  const onMouseDown = (e: React.MouseEvent) => {
    // Skip drags initiated on a node — those are clicks, handled below.
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
    // Zoom centered on cursor — feels right whether you're scrolling a
    // big graph or fine-tuning a single subtree.
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const next = clampZoom(view.zoom * Math.exp(delta));
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    // World coords of the cursor at the current zoom must stay fixed:
    //   (cx - panX) / zoom == (cx - panX') / next
    const panX = cx - (cx - view.panX) * (next / view.zoom);
    const panY = cy - (cy - view.panY) * (next / view.zoom);
    setView({ zoom: next, panX, panY });
  };

  // ─── Search dim ────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const matches = (n: PositionedNode) => {
    if (!q) return true;
    if (n.name.toLowerCase().includes(q)) return true;
    if (n.parentClass && n.parentClass.toLowerCase().includes(q)) return true;
    return false;
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6e717a" />
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
      stroke="#6e717a"
      strokeWidth={1.2}
      markerEnd="url(#cg-arrow)"
    />
  );
}

// ─── Node box ──────────────────────────────────────────────────────────

function NodeBox({
  node,
  selected,
  dimmed,
  onClick,
}: {
  node: PositionedNode;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const color = nodeColor(node.percentTotal);
  const opacity = dimmed ? 0.35 : 1;
  const label = displayName(node);
  const total = `${node.subtreeSize} (${node.percentTotal.toFixed(1)}%)`;
  const own = `${node.loc} loc · cx ${node.complexity}`;

  // SVG <text> doesn't ellipsize on its own — but the displayName helper
  // already trims to fit NODE_W. The right-aligned "×N" badge is sized
  // for up to 4 digits which is enough for any realistic project.
  return (
    <g
      data-node-id={node.id}
      transform={`translate(${node.x} ${node.y})`}
      onClick={onClick}
      style={{ cursor: 'pointer', opacity }}
    >
      <title>
        {label}
        {'\n'}file: {node.file}:{node.line}
        {'\n'}reach: {node.subtreeSize} symbols ({node.percentTotal.toFixed(2)}% of root)
        {'\n'}own: {node.loc} loc · complexity {node.complexity}
        {'\n'}call sites: {node.callCount}
      </title>
      <rect
        x={0}
        y={0}
        width={node.w}
        height={node.h}
        rx={4}
        fill={color.fill}
        stroke={selected ? '#5b8def' : color.border}
        strokeWidth={selected ? 2 : 1}
      />
      {/* Title row: name (left) + ×N (right) */}
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
      {/* Total row */}
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
      {/* Own row */}
      <text
        x={10}
        y={52}
        fill={color.text}
        fontFamily="ui-monospace, monospace"
        fontSize={10.5}
      >
        Own:&nbsp;
        <tspan fontWeight={700}>{own}</tspan>
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
        <LegendSwatch fill="#e26d6d" label="≥40% reach" />
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
          border: '1px solid #3f4147',
          borderRadius: 2,
        }}
      />
      <span style={{ color: '#9ca0a8', fontSize: 10 }}>{label}</span>
    </span>
  );
}

// ─── styles ────────────────────────────────────────────────────────────

const shellStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  height: '100%',
  background: '#1e1f22',
};

const canvasStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  background: '#1e1f22',
  userSelect: 'none',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  background: '#26282c',
  borderBottom: '1px solid #3f4147',
  fontSize: 11,
};

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #3f4147',
  color: '#d7d9dc',
  fontSize: 11,
  padding: '3px 9px',
  borderRadius: 3,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
};

const btnActiveStyle: React.CSSProperties = {
  background: '#3b3f44',
  borderColor: '#5b8def',
  color: '#d7d9dc',
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 18,
  background: '#3f4147',
  margin: '0 4px',
};

const statusStyle: React.CSSProperties = {
  color: '#7e8189',
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
  color: '#7e8189',
  fontStyle: 'italic',
  fontSize: 12,
};
