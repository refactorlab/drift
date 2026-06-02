// Risk quadrant — likelihood (x) × severity (y), the same framing the action's
// mermaid quadrantChart uses, but rendered natively from the structured
// `risks.items[]` so each point is interactive and theme-aware. Top-right =
// "act before merge"; bottom-left = "acceptable".

import type { RiskItem } from '../../core/scanOutput';
import { Badge, type Tone } from './primitives';

const QUADRANT_TONE: Record<string, Tone> = {
  act_before_merge: 'bad',
  monitor_closely: 'warn',
  document_and_ship: 'info',
  acceptable: 'good',
};

const QUADRANT_LABEL: Record<string, string> = {
  act_before_merge: 'Act before merge',
  monitor_closely: 'Monitor closely',
  document_and_ship: 'Document & ship',
  acceptable: 'Acceptable',
};

export function RiskQuadrant({ items, size = 280 }: { items: RiskItem[]; size?: number }) {
  if (!items.length) return null;
  const pad = 26;
  const plot = size - pad * 2;
  const x = (likelihood: number) => pad + Math.max(0, Math.min(1, likelihood)) * plot;
  const y = (severity: number) => pad + (1 - Math.max(0, Math.min(1, severity))) * plot;

  return (
    <div className="rp-risk">
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Risk quadrant">
        {/* quadrant tints */}
        <rect x={pad} y={pad} width={plot / 2} height={plot / 2} className="rp-q rp-q-warn" />
        <rect x={pad + plot / 2} y={pad} width={plot / 2} height={plot / 2} className="rp-q rp-q-bad" />
        <rect x={pad} y={pad + plot / 2} width={plot / 2} height={plot / 2} className="rp-q rp-q-good" />
        <rect x={pad + plot / 2} y={pad + plot / 2} width={plot / 2} height={plot / 2} className="rp-q rp-q-info" />
        {/* axes */}
        <line x1={pad} y1={pad + plot / 2} x2={pad + plot} y2={pad + plot / 2} className="rp-risk-axis" />
        <line x1={pad + plot / 2} y1={pad} x2={pad + plot / 2} y2={pad + plot} className="rp-risk-axis" />
        {/* points */}
        {items.map((r, i) => (
          <circle
            key={i}
            cx={x(r.likelihood)}
            cy={y(r.severity)}
            r={6}
            className={`rp-risk-dot rp-tone-${QUADRANT_TONE[r.quadrant ?? 'acceptable']}`}
          >
            <title>{`${r.label} — likelihood ${(r.likelihood * 100).toFixed(0)}% · severity ${(r.severity * 100).toFixed(0)}%`}</title>
          </circle>
        ))}
        <text x={pad} y={size - 6} className="rp-risk-axislabel">likelihood →</text>
        <text x={6} y={pad - 8} className="rp-risk-axislabel">severity ↑</text>
      </svg>
      <ul className="rp-risk-list">
        {items.map((r, i) => (
          <li key={i}>
            <Badge tone={QUADRANT_TONE[r.quadrant ?? 'acceptable']}>
              {QUADRANT_LABEL[r.quadrant ?? 'acceptable']}
            </Badge>
            <span className="rp-risk-label">{r.label}</span>
            <span className="rp-risk-nums">
              L {(r.likelihood * 100).toFixed(0)}% · S {(r.severity * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
