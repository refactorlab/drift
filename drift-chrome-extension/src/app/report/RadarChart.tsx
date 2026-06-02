// A hand-rolled SVG radar plotting every quality gauge on one polar grid, so the
// PR's whole risk shape is legible at a glance — the further a vertex reaches,
// the higher that metric's score. No chart library: just trig + SVG.

export interface RadarAxis {
  label: string;
  score: number; // 0..100
}

const RINGS = 4;

function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function shortLabel(s: string): string {
  return s.length > 22 ? `${s.slice(0, 20)}…` : s;
}

export function RadarChart({ axes, size = 300 }: { axes: RadarAxis[]; size?: number }) {
  if (axes.length < 3) return null;
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.31;
  const n = axes.length;
  const angleAt = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  // Graticule rings (concentric polygons) + radial spokes.
  const rings = Array.from({ length: RINGS }, (_, ri) => {
    const r = (R * (ri + 1)) / RINGS;
    const pts = axes.map((_, i) => polar(cx, cy, r, angleAt(i)).map((v) => v.toFixed(1)).join(',')).join(' ');
    return pts;
  });

  const dataPts = axes.map((a, i) => {
    const r = (Math.max(0, Math.min(100, a.score)) / 100) * R;
    return polar(cx, cy, r, angleAt(i));
  });
  const dataPoly = dataPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <svg className="rp-radar" width="100%" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Quality metrics radar">
      {rings.map((pts, i) => (
        <polygon key={i} points={pts} className="rp-radar-ring" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = polar(cx, cy, R, angleAt(i));
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="rp-radar-spoke" />;
      })}
      <polygon points={dataPoly} className="rp-radar-area" />
      {dataPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.4} className="rp-radar-dot" />
      ))}
      {axes.map((a, i) => {
        const angle = angleAt(i);
        const [lx, ly] = polar(cx, cy, R + 12, angle);
        const cos = Math.cos(angle);
        const anchor = Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end';
        return (
          <text key={i} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" className="rp-radar-label">
            {shortLabel(a.label)}
          </text>
        );
      })}
    </svg>
  );
}
