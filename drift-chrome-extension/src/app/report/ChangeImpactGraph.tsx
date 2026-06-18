// The CHANGE-IMPACT GRAPH view — an interactive, file-scoped diagram rendered inline
// in a handover file message.
//
// SINGLE RESPONSIBILITY: render a {@link FileGraph} as pan/zoom SVG and play the BUILD
// — it reveals the nodes ONE BY ONE in topological order (a node's source/parent always
// appears first, so every edge draws FROM an already-visible node TO the new one), with a
// soft tick per node (Web Audio, see uiChime) and the camera smoothly zooming out from the
// first node to the whole file scope. Clicking a node focuses its branch. Dark by default;
// a toggle flips to light.
//
// All graph MATH lives in core/changeImpactGraph + core/graphLayout (pure, tested);
// this file is just the view + interaction. No CDN/deps — bundled React + SVG only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reachable, type FileGraph } from '../../core/changeImpactGraph';
import { boundsOf, layoutGraph, levelBounds, type GraphLayout, type PlacedNode } from '../../core/graphLayout';
import { resumeChime, tick } from '../../core/uiChime';
import './ChangeImpactGraph.css';

const REDUCED = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** Fallback accent per diff-class when the scan ships no matching class_def. */
const FALLBACK_STROKE: Record<string, string> = { added: '#3fb950', changed: '#d29922', removed: '#f85149', unchanged: '#5a6577' };
const DEFAULT_STROKE = '#5a6577';
/** Legend order — only the classes actually present in the graph are shown. */
const LEGEND_ORDER = ['added', 'changed', 'removed', 'unchanged'];

const clipLabel = (s: string): string => (s.length > 38 ? s.slice(0, 36) + '…' : s);
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Per-node dwell during the build — slower for a small graph (so each pop is felt),
 *  faster for a big one (so it never drags). */
const buildStepMs = (n: number): number => Math.round(Math.max(36, Math.min(95, 2600 / Math.max(1, n))));

/** Cubic edge path with horizontal control handles (smooth even for back-edges). */
function edgePath(points: Array<{ x: number; y: number }>): string {
  const [a, b] = points;
  if (!a || !b) return '';
  const dx = Math.max(26, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

interface Props {
  graph: FileGraph;
  /** The effective default for sound: voice mode passes true (auto-on); text mode
   *  passes the user's "Diagram sounds" setting. The inline ♪ can override per-session. */
  soundEnabled: boolean;
}

export function ChangeImpactGraph({ graph, soundEnabled }: Props) {
  const layout = useMemo<GraphLayout>(() => layoutGraph(graph), [graph]);
  const seeds = useMemo(() => new Set(graph.seeds), [graph]);
  // Reveal ORDER: left-to-right (by column x, then y) — a node's source/parent (to its
  // left) reveals first, so its incoming edge draws from a node that's already on screen.
  const order = useMemo(() => [...layout.nodes].sort((a, b) => a.x - b.x || a.y - b.y).map((p) => p.id), [layout]);
  const total = order.length;
  const fullBounds = useMemo(() => levelBounds(layout, layout.maxLevel), [layout]);

  const strokeByClass = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of graph.classDefs) m.set(c.name, c.stroke);
    return m;
  }, [graph]);
  const strokeFor = (cls?: string): string => (cls && (strokeByClass.get(cls) ?? FALLBACK_STROKE[cls])) || DEFAULT_STROKE;
  const presentClasses = useMemo(() => {
    const present = new Set(graph.nodes.map((n) => n.cls).filter(Boolean) as string[]);
    return LEGEND_ORDER.filter((c) => present.has(c));
  }, [graph]);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sound, setSound] = useState(soundEnabled);
  // How many nodes (in `order`) are revealed so far — the build frontier.
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const revealedSet = useMemo(() => new Set(order.slice(0, revealed)), [order, revealed]);

  // Voice mode (soundEnabled=true) forces sound on; a settings change re-syncs the default.
  useEffect(() => setSound(soundEnabled), [soundEnabled]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const view = useRef({ k: 1, x: 0, y: 0 });
  const raf = useRef(0);
  const buildTimer = useRef<number | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  // ── Camera (transform applied straight to the <g> for smoothness, like a map) ──
  const apply = useCallback(() => {
    const v = view.current;
    gRef.current?.setAttribute('transform', `translate(${v.x},${v.y}) scale(${v.k})`);
  }, []);
  const animateTo = useCallback(
    (t: { k: number; x: number; y: number }, dur = 520) => {
      cancelAnimationFrame(raf.current);
      if (REDUCED || dur <= 0) {
        view.current = { ...t };
        apply();
        return;
      }
      const s = { ...view.current };
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = easeInOut(k);
        view.current = { k: s.k + (t.k - s.k) * e, x: s.x + (t.x - s.x) * e, y: s.y + (t.y - s.y) * e };
        apply();
        if (k < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    },
    [apply],
  );
  const fitBounds = useCallback(
    (b: { x0: number; y0: number; x1: number; y1: number }, dur = 520) => {
      const el = wrapRef.current;
      if (!el) return;
      const pad = 34;
      const bw = Math.max(1, b.x1 - b.x0);
      const bh = Math.max(1, b.y1 - b.y0);
      const k = Math.min(2.4, Math.max(0.15, Math.min((el.clientWidth - pad * 2) / bw, (el.clientHeight - pad * 2) / bh)));
      animateTo({ k, x: (el.clientWidth - (b.x0 + b.x1) * k) / 2, y: (el.clientHeight - (b.y0 + b.y1) * k) / 2 }, dur);
    },
    [animateTo],
  );
  /** Bounds of the first `count` revealed nodes (the build frontier) — drives the zoom. */
  const prefixBounds = useCallback((count: number) => boundsOf(layout, new Set(order.slice(0, Math.max(1, count)))), [layout, order]);

  const stopBuild = useCallback(() => {
    if (buildTimer.current != null) {
      clearTimeout(buildTimer.current);
      buildTimer.current = null;
    }
    setPlaying(false);
  }, []);

  // Play the build: reveal nodes one-by-one from `from`, ticking each, while the camera
  // zooms from the first node out to the whole file over the build's duration.
  const playBuild = useCallback(
    (from = 0) => {
      stopBuild();
      setSelected(null);
      setRevealed(from);
      if (from >= total) {
        fitBounds(fullBounds, 520);
        return;
      }
      const stepMs = buildStepMs(total);
      fitBounds(prefixBounds(Math.max(1, from)), 0); // snap onto the current frontier (zoomed in)…
      fitBounds(fullBounds, Math.max(700, (total - from) * stepMs)); // …then ease out to the whole file
      setPlaying(true);
      let c = from;
      const revealNext = () => {
        c += 1;
        setRevealed(c);
        if (soundRef.current) {
          resumeChime();
          tick();
        }
        if (c >= total) {
          setPlaying(false);
          buildTimer.current = null;
          return;
        }
        buildTimer.current = window.setTimeout(revealNext, stepMs);
      };
      buildTimer.current = window.setTimeout(revealNext, stepMs);
    },
    [total, fullBounds, prefixBounds, fitBounds, stopBuild],
  );

  // First paint: run the build (or, with reduced motion, show the whole file at once).
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (REDUCED) {
        setRevealed(total);
        fitBounds(fullBounds, 0);
        return;
      }
      playBuild(0);
    }, 60);
    return () => {
      clearTimeout(t);
      stopBuild();
    };
    // Re-run only when the underlying graph changes.
  }, [graph]); // eslint-disable-line react-hooks/exhaustive-deps

  // A node click focuses its branch (callers + callees / ancestors + descendants).
  useEffect(() => {
    if (!selected) return;
    const ids = new Set<string>([...reachable(graph.edges, selected, 'down'), ...reachable(graph.edges, selected, 'up')]);
    fitBounds(boundsOf(layout, ids), 520);
    if (soundRef.current) {
      resumeChime();
      tick();
    }
  }, [selected, graph, layout, fitBounds]);

  // Pan (drag) + zoom (wheel) — ignore drags that start on a node so clicks still register.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let drag: { x: number; y: number; vx: number; vy: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element)?.closest('.cig-node')) return;
      drag = { x: e.clientX, y: e.clientY, vx: view.current.x, vy: view.current.y };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      view.current.x = drag.vx + (e.clientX - drag.x);
      view.current.y = drag.vy + (e.clientY - drag.y);
      apply();
    };
    const onUp = () => {
      drag = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const b = el.getBoundingClientRect();
      const mx = e.clientX - b.left;
      const my = e.clientY - b.top;
      const v = view.current;
      const k = Math.min(3, Math.max(0.1, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      view.current = { k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) };
      apply();
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [apply]);

  const down = useMemo(() => (selected ? reachable(graph.edges, selected, 'down') : null), [selected, graph]);
  const up = useMemo(() => (selected ? reachable(graph.edges, selected, 'up') : null), [selected, graph]);

  type Ring = 'select' | 'down' | 'up' | 'seed' | null;
  const nodeView = (p: PlacedNode): { shown: boolean; dim: boolean; ring: Ring } => {
    const shown = revealedSet.has(p.id);
    if (!selected) return { shown, dim: false, ring: seeds.has(p.id) ? 'seed' : null };
    if (p.id === selected) return { shown, dim: false, ring: 'select' };
    if (down?.has(p.id)) return { shown, dim: false, ring: 'down' };
    if (up?.has(p.id)) return { shown, dim: false, ring: 'up' };
    return { shown, dim: true, ring: null };
  };
  const edgeView = (from: string, to: string): { shown: boolean; sel: string } => {
    const shown = revealedSet.has(from) && revealedSet.has(to);
    if (!selected) return { shown, sel: '' };
    if (down?.has(from) && down?.has(to)) return { shown, sel: 'down' };
    if (up?.has(from) && up?.has(to)) return { shown, sel: 'up' };
    return { shown, sel: 'dim' };
  };

  const pickNode = (id: string) => {
    resumeChime();
    if (revealed < total) {
      stopBuild();
      setRevealed(total); // a click means "show me everything", then focus the branch
    }
    setSelected((cur) => (cur === id ? null : id));
  };
  const seekTo = (count: number) => {
    stopBuild();
    setRevealed(count);
    fitBounds(count >= total ? fullBounds : prefixBounds(count), 420);
  };
  const toggleSound = () => {
    setSound((on) => {
      const next = !on;
      if (next) {
        resumeChime();
        tick();
      }
      return next;
    });
  };

  return (
    <div className="cig" data-graph-theme={theme}>
      <div className="cig-stage" ref={wrapRef} onClick={() => setSelected(null)}>
        <svg className="cig-canvas">
          <defs>
            <marker id="cig-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#3a4660" />
            </marker>
            <marker id="cig-arrow-down" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#5b8cff" />
            </marker>
            <marker id="cig-arrow-up" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#9b8cff" />
            </marker>
          </defs>
          <g ref={gRef}>
            {layout.edges.map((e, i) => {
              const { shown, sel } = edgeView(e.from, e.to);
              const marker = sel === 'down' ? 'cig-arrow-down' : sel === 'up' ? 'cig-arrow-up' : 'cig-arrow';
              return (
                <path
                  key={i}
                  className={`cig-edge${shown ? ' shown' : ''}${sel ? ' ' + sel : ''}`}
                  d={edgePath(e.points)}
                  pathLength={1}
                  markerEnd={shown ? `url(#${marker})` : undefined}
                />
              );
            })}
            {layout.nodes.map((p) => {
              const v = nodeView(p);
              const col = strokeFor(p.node.cls);
              return (
                <g
                  key={p.id}
                  className={`cig-node${v.shown ? ' shown' : ''}${v.ring ? ' ' + v.ring : ''}`}
                  style={{ opacity: v.dim ? 0.14 : 1, pointerEvents: v.shown && !v.dim ? 'auto' : 'none', ['--cig-col' as string]: col }}
                  transform={`translate(${p.x - p.w / 2},${p.y - p.h / 2})`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    pickNode(p.id);
                  }}
                >
                  <g className="cig-card-anim">
                    <rect
                      className="cig-card"
                      width={p.w}
                      height={p.h}
                      rx="8"
                      stroke={v.ring ? col : 'var(--cig-border)'}
                      strokeWidth={v.ring === 'select' ? 1.9 : 1.2}
                      strokeDasharray={p.node.cls === 'removed' ? '4 3' : undefined}
                    />
                    <rect x="0" y="6" width="3" height={p.h - 12} rx="1.5" fill={col} />
                    <text className="cig-lbl" x={p.w / 2 + 2} y={p.h / 2 + 0.5} textAnchor="middle">
                      {clipLabel(p.node.label)}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="cig-ctrls">
          <button onClick={() => playBuild(0)} title="Replay the build" aria-label="Replay">
            ↻
          </button>
          <button
            className={playing ? 'on' : ''}
            onClick={() => (playing ? stopBuild() : playBuild(revealed >= total ? 0 : revealed))}
            title={playing ? 'Pause' : 'Play the build'}
            aria-label="Play or pause"
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button className={sound ? 'on' : ''} onClick={toggleSound} title="Toggle reveal sound" aria-label="Toggle sound">
            ♪
          </button>
          <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} title="Toggle light / dark" aria-label="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button onClick={() => fitBounds(fullBounds, 560)} title="Fit to screen" aria-label="Fit">
            ⤢
          </button>
        </div>

        <div className="cig-legend">
          {presentClasses.map((c) => (
            <span key={c} className="cig-legend-item">
              <i style={{ background: strokeFor(c) }} />
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* The BUILD timeline — one segment per node; scrub to reveal up to any point. */}
      <div className="cig-scope" role="group" aria-label="Build progress">
        <span className="cig-scope-label">Change</span>
        <div className="cig-scope-track">
          {order.map((id, i) => (
            <button
              key={id}
              type="button"
              className={`cig-scope-seg${i === revealed - 1 ? ' active' : i < revealed - 1 ? ' done' : ''}`}
              onClick={() => seekTo(i + 1)}
              title={`Reveal ${i + 1} of ${total}`}
              aria-label={`Reveal up to node ${i + 1}`}
            />
          ))}
        </div>
        <span className="cig-scope-label">File scope</span>
        <span className="cig-scope-pos">{total ? `${revealed}/${total}` : 'scope'}</span>
      </div>
      <div className="cig-hint">click a node to focus its branch · scroll to zoom · drag to pan</div>
    </div>
  );
}
