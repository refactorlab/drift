import { useMemo, useState } from "react";

import type { EventLogTreeNode } from "../lib/tauri";

/**
 * Snakeviz-style icicle chart. Top row is `<root>`; each function below
 * occupies the horizontal slice of its parent in proportion to its
 * inclusive duration. Click a node to "zoom" so it becomes the new root —
 * snakeviz semantics. The breadcrumb at the top steps back up the chain.
 *
 * Why hand-rolled SVG and not a chart library: every dep added to a
 * Tauri build hits both the JS bundle and the Rust webview surface. The
 * icicle layout is ~80 lines of math; a chart lib would be 200KB+ of
 * vendor JS for what's effectively a stacked-rectangle visitor.
 */
export interface IcicleChartProps {
  root: EventLogTreeNode;
  rowHeight?: number;
  height?: number;
  /** Called when the user clicks a node (e.g. to drill the table view). */
  onNodeClick?: (node: EventLogTreeNode, breadcrumb: string[]) => void;
}

interface Rect {
  node: EventLogTreeNode;
  x: number;
  y: number;
  width: number;
  depth: number;
  /** Breadcrumb path from the *current zoom root* to this node. */
  path: string[];
}

const COLORS = [
  "#ff6b3d",
  "#ff9558",
  "#ffb547",
  "#ffd073",
  "#ffe199",
  "#f6c87a",
  "#e8a44f",
  "#d77f3a",
];

function colorFor(name: string, depth: number): string {
  let h = depth * 17;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

function formatUs(us: number): string {
  if (us < 1) return "0 μs";
  if (us < 1_000) return `${us.toFixed(0)} μs`;
  if (us < 1_000_000) return `${(us / 1_000).toFixed(2)} ms`;
  return `${(us / 1_000_000).toFixed(3)} s`;
}

export default function IcicleChart(props: IcicleChartProps): JSX.Element {
  const { root, rowHeight = 22, height = 360, onNodeClick } = props;
  const [zoomPath, setZoomPath] = useState<string[]>([]);
  const [hover, setHover] = useState<Rect | null>(null);

  const zoomRoot = useMemo(() => {
    let cur: EventLogTreeNode = root;
    for (const seg of zoomPath) {
      const next = cur.children.find((c) => c.name === seg);
      if (!next) break;
      cur = next;
    }
    return cur;
  }, [root, zoomPath]);

  const rects = useMemo<Rect[]>(() => {
    const width = 1000; // arbitrary user-space width; SVG scales via viewBox
    const out: Rect[] = [];
    const visit = (
      node: EventLogTreeNode,
      x: number,
      width: number,
      depth: number,
      path: string[],
    ) => {
      out.push({ node, x, y: depth * rowHeight, width, depth, path });
      const total = node.children.reduce((s, c) => s + c.value, 0);
      if (total <= 0 || width < 0.5) return;
      let cx = x;
      for (const child of node.children) {
        const cw = (child.value / total) * width;
        if (cw < 0.5) continue;
        visit(child, cx, cw, depth + 1, [...path, child.name]);
        cx += cw;
      }
    };
    visit(zoomRoot, 0, width, 0, []);
    return out;
  }, [zoomRoot, rowHeight]);

  const maxDepth = useMemo(
    () => rects.reduce((m, r) => Math.max(m, r.depth), 0),
    [rects],
  );
  const svgHeight = Math.max(height, (maxDepth + 1) * rowHeight + 4);

  const handleClick = (r: Rect) => {
    setZoomPath((prev) => [...prev, ...r.path]);
    onNodeClick?.(r.node, [...zoomPath, ...r.path]);
  };

  return (
    <div className="icicle-wrap">
      <div className="icicle-breadcrumb">
        <button
          type="button"
          className="icicle-crumb"
          onClick={() => setZoomPath([])}
          disabled={zoomPath.length === 0}
        >
          {root.name}
        </button>
        {zoomPath.map((seg, i) => (
          <span key={`${i}-${seg}`}>
            <span className="icicle-crumb-sep">›</span>
            <button
              type="button"
              className="icicle-crumb"
              onClick={() => setZoomPath(zoomPath.slice(0, i + 1))}
            >
              {seg}
            </button>
          </span>
        ))}
        {zoomPath.length > 0 && (
          <button
            type="button"
            className="icicle-reset"
            onClick={() => setZoomPath([])}
          >
            reset zoom
          </button>
        )}
      </div>

      <div className="icicle-svg-wrap">
        <svg
          className="icicle-svg"
          viewBox={`0 0 1000 ${svgHeight}`}
          preserveAspectRatio="none"
          style={{ height: svgHeight }}
        >
          {rects.map((r) => (
            <g
              key={`${r.depth}-${r.path.join("/")}`}
              transform={`translate(${r.x},${r.y})`}
              onClick={() => handleClick(r)}
              onMouseEnter={() => setHover(r)}
              onMouseLeave={() => setHover((h) => (h === r ? null : h))}
              style={{ cursor: r.node.children.length > 0 ? "pointer" : "default" }}
            >
              <rect
                width={Math.max(0, r.width - 0.5)}
                height={Math.max(0, rowHeight - 1)}
                fill={r.depth === 0 ? "#555" : colorFor(r.node.name, r.depth)}
                opacity={hover && hover !== r ? 0.65 : 0.95}
                rx={1.5}
              />
              {r.width > 60 && (
                <text
                  x={6}
                  y={rowHeight / 2 + 4}
                  fontSize={11}
                  fill={r.depth === 0 ? "#fff" : "#1a1a1a"}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {clip(r.node.name, Math.floor((r.width - 12) / 7))}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="icicle-tooltip">
        {hover ? (
          <>
            <strong>{hover.node.name}</strong>
            <span className="muted">
              {" "}· {formatUs(hover.node.value)} inclusive · {formatUs(hover.node.selfValue)} self · {hover.node.ncalls} call{hover.node.ncalls === 1 ? "" : "s"}
            </span>
            {hover.node.file && (
              <span className="muted">
                {" "}· {hover.node.file}
                {hover.node.line ? `:${hover.node.line}` : ""}
              </span>
            )}
          </>
        ) : (
          <span className="muted">
            Hover a bar to inspect, click to zoom (snakeviz-style).
          </span>
        )}
      </div>
    </div>
  );
}

function clip(s: string, maxChars: number): string {
  if (maxChars <= 1) return "";
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(1, maxChars - 1)) + "…";
}
