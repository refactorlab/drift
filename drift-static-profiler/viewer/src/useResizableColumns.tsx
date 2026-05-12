import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drag-to-resize column widths with localStorage persistence.
 *
 * Each column has a stable `id`, a `defaultWidth`, and an optional
 * `minWidth`. The hook returns the current pixel widths and a
 * `startResize` factory that wires up the mouse-drag dance for the
 * given column id. Widths are stored under `storageKey` so they
 * survive reloads.
 *
 * Double-clicking the handle resets just that column's width.
 */

export interface ColumnDef {
  id: string;
  defaultWidth: number;
  minWidth?: number;
}

export interface ResizableColumns {
  widths: Record<string, number>;
  startResize: (id: string) => (e: React.MouseEvent) => void;
  resetColumn: (id: string) => void;
}

const DEFAULT_MIN_WIDTH = 24;

export function useResizableColumns(
  storageKey: string,
  columns: ColumnDef[],
): ResizableColumns {
  const defaults = useRef<Record<string, number>>({});
  defaults.current = Object.fromEntries(columns.map(c => [c.id, c.defaultWidth]));

  const mins = useRef<Record<string, number>>({});
  mins.current = Object.fromEntries(
    columns.map(c => [c.id, c.minWidth ?? DEFAULT_MIN_WIDTH]),
  );

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    let stored: Record<string, number> = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) stored = JSON.parse(raw) as Record<string, number>;
    } catch {
      // ignore — fall back to defaults
    }
    const out: Record<string, number> = {};
    for (const c of columns) {
      const v = stored[c.id];
      out[c.id] = typeof v === 'number' && Number.isFinite(v) ? v : c.defaultWidth;
    }
    return out;
  });

  // Avoid stale closures: read the current width through a ref so a second
  // drag on the same column starts from the right baseline.
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      // localStorage may be unavailable (private mode, quota); silently degrade
    }
  }, [widths, storageKey]);

  const startResize = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth =
        widthsRef.current[id] ?? defaults.current[id] ?? 80;
      const minWidth = mins.current[id] ?? DEFAULT_MIN_WIDTH;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const next = Math.max(minWidth, Math.round(startWidth + delta));
        setWidths(w => (w[id] === next ? w : { ...w, [id]: next }));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [],
  );

  const resetColumn = useCallback((id: string) => {
    const def = defaults.current[id];
    if (def !== undefined) {
      setWidths(w => ({ ...w, [id]: def }));
    }
  }, []);

  return { widths, startResize, resetColumn };
}

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onReset?: () => void;
}

/**
 * Visibly distinguishable 10px-wide drag handle at a column's right edge.
 *
 * The previous "invisible until hover" approach was undiscoverable — the
 * user couldn't see where to grab. This version:
 *   • Always shows a vertical line just inside the cell's right edge
 *   • Brightens on hover; turns blue while actively dragging
 *   • Kept ENTIRELY inside the cell (right: 0, width: 10) because parent
 *     cells have `overflow: hidden` for text-ellipsis and would clip a
 *     handle that extended past the edge
 *   • zIndex: 5 to sit above adjacent cells in the same row
 *   • Uses <div> (block-level) instead of <span> for predictable
 *     absolute-positioning width
 */
export function ResizeHandle({ onMouseDown, onReset }: ResizeHandleProps) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);

  // Hover/active brighten the line so users see they're targeting the handle.
  const accent = active ? '#5b8def' : hover ? '#d7d9dc' : '#5b5e64';

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(e) => {
        setActive(true);
        const onUp = () => {
          setActive(false);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mouseup', onUp);
        onMouseDown(e);
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset?.();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Drag to resize • double-click to reset"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        // Sit at the right edge, entirely inside the cell (overflow:hidden
        // on the cell would otherwise clip an externally-positioned handle).
        right: 0,
        width: 10,
        cursor: 'col-resize',
        userSelect: 'none',
        zIndex: 5,
        // 2px-wide vertical line at the rightmost 2px of the 10px hit area —
        // visually sits flush with the column boundary while leaving 8px of
        // grab area to the left of it.
        background:
          `linear-gradient(90deg, transparent 0, transparent 8px, ${accent} 8px, ${accent} 10px)`,
      }}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Layout panel resizing — sidebar width + bottom panel height.
// Same drag-with-localStorage-persistence dance, applied to one number
// instead of a map.
// ───────────────────────────────────────────────────────────────────────────

export function useResizablePanel(
  storageKey: string,
  defaultValue: number,
  opts: { min?: number; max?: number } = {},
): [number, (next: number) => void] {
  const min = opts.min ?? 80;
  const max = opts.max ?? 4000;

  const [value, setValue] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n)) return clamp(n, min, max);
      }
    } catch {
      // ignore
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {
      // ignore
    }
  }, [storageKey, value]);

  const setClamped = useCallback(
    (next: number) => setValue(clamp(next, min, max)),
    [min, max],
  );

  return [value, setClamped];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

interface SplitterProps {
  /**
   * `vertical` = a vertical line you drag horizontally (between left/right panes).
   * `horizontal` = a horizontal line you drag vertically (between top/bottom panes).
   */
  orientation: 'vertical' | 'horizontal';
  /** Called once at mousedown — parent should snapshot whatever state it'll mutate. */
  onDragStart?: () => void;
  /**
   * Called repeatedly during the drag with the cumulative mouse delta in the
   * relevant axis (px from drag start). Parent applies this to the snapshot
   * captured in onDragStart.
   */
  onDrag: (deltaPx: number) => void;
  /** Optional callback when the drag ends. */
  onDragEnd?: () => void;
}

/**
 * Layout splitter — a thin, visibly-distinguishable bar that sits between
 * two panes and resizes them when dragged. Mirrors the column ResizeHandle
 * but for grid-level layout.
 *
 *   <Splitter orientation="vertical"   onDrag={dx => setSidebarWidth(w0 - dx)} />
 *   <Splitter orientation="horizontal" onDrag={dy => setBottomHeight(h0 - dy)} />
 */
export function Splitter({ orientation, onDragStart, onDrag, onDragEnd }: SplitterProps) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const isVertical = orientation === 'vertical';
  const accent = active ? '#5b8def' : hover ? '#d7d9dc' : '#3f4147';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(true);
    onDragStart?.();
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: MouseEvent) => {
      const delta = isVertical ? ev.clientX - startX : ev.clientY - startY;
      onDrag(delta);
    };
    const onUp = () => {
      setActive(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onDragEnd?.();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = isVertical ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={isVertical ? 'Drag to resize sidebar' : 'Drag to resize panel height'}
      style={{
        // The splitter occupies its own grid track (6px wide/tall). The
        // visible line is 2px, centered.
        width: isVertical ? 6 : '100%',
        height: isVertical ? '100%' : 6,
        cursor: isVertical ? 'col-resize' : 'row-resize',
        userSelect: 'none',
        background: isVertical
          ? `linear-gradient(90deg, transparent 0, transparent 2px, ${accent} 2px, ${accent} 4px, transparent 4px, transparent 6px)`
          : `linear-gradient(0deg,  transparent 0, transparent 2px, ${accent} 2px, ${accent} 4px, transparent 4px, transparent 6px)`,
        zIndex: 3,
        flexShrink: 0,
      }}
    />
  );
}
