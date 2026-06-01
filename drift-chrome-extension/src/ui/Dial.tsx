// A small SVG radial gauge — the interactive equivalent of the quickchart
// radialGauge images in the static comment.

import type { Gauge } from '../core/types';

const TONE_COLOR: Record<Gauge['tone'], string> = {
  good: 'var(--drift-good)',
  warn: 'var(--drift-warn)',
  bad: 'var(--drift-bad-soft)',
  info: 'var(--drift-info)',
};

export function Dial({ gauge, size = 64 }: { gauge: Gauge; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  // When there's no natural fraction (raw counts), show a full faint ring.
  const frac = gauge.fraction ?? 1;
  const dash = circ * 0.75; // 270° arc
  const filled = dash * frac;
  const color = TONE_COLOR[gauge.tone];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${gauge.label} ${gauge.display}`}>
      <g transform={`rotate(135 ${cx} ${cy})`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--drift-track)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
        {gauge.fraction !== null && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ}`}
          />
        )}
      </g>
    </svg>
  );
}
