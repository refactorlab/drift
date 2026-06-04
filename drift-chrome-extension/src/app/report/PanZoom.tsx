// Graph viewport — a NATIVE-SCROLL responsive container for the scanner's
// diagrams. Rethought from the transform-based pan/zoom, which left dead space:
// a fitted graph floated in a fixed-height box. Here the SVG renders at
// width:100% (fills the card — no side gaps) and the box height SHRINKS to the
// content (capped at max-height, scroll beyond) — so there's never empty canvas.
//
// Pan = native scroll (scrollbars / trackpad / drag). Zoom = scaling the canvas
// width; scrollbars then pan the enlarged graph. No transform math, no fit logic
// to get wrong.
//
// Export-safe: under ForceExpandContext (the off-screen copy the HTML export
// snapshots) it renders the child plainly — no scroll box — so exported diagrams
// are complete and full-size.

import { useContext, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { ForceExpandContext } from './primitives';

const ZOOM_STEP = 1.3;
const ZOOM_MAX = 5;

export function PanZoom({ children }: { children: ReactNode }) {
  const forceExpand = useContext(ForceExpandContext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [zoom, setZoom] = useState(1); // 1 = fit-to-width (the floor — no gaps)
  const [dragging, setDragging] = useState(false);

  // The export snapshot wants the raw, unclipped diagram — skip the viewport.
  if (forceExpand) return <>{children}</>;

  // Drag-to-pan, implemented as native scroll so there's no transform to fight.
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const s = scrollRef.current;
    if (!s) return;
    drag.current = { x: e.clientX, y: e.clientY, left: s.scrollLeft, top: s.scrollTop };
    setDragging(true);
    s.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const s = scrollRef.current;
    if (!d || !s) return;
    s.scrollLeft = d.left - (e.clientX - d.x);
    s.scrollTop = d.top - (e.clientY - d.y);
  };
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    setDragging(false);
    scrollRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const round = (z: number) => Math.round(z * 100) / 100;

  return (
    <div className="rp-graph">
      <div
        className={`rp-graph-scroll${dragging ? ' dragging' : ''}`}
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="rp-graph-canvas" style={{ width: `${zoom * 100}%` }}>
          {children}
        </div>
      </div>
      {/* Controls — stop pointerdown so a click never starts a drag-pan. */}
      <div className="rp-graph-ctrls" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setZoom((z) => round(Math.min(ZOOM_MAX, z * ZOOM_STEP)))}
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => round(Math.max(1, z / ZOOM_STEP)))}
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
        <button type="button" onClick={() => setZoom(1)} aria-label="Fit width" title="Fit width">
          ⤢
        </button>
        <span className="rp-graph-pct">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}
