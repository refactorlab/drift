// Business Value — the per-axis impact deltas (money, customer, runtime, …)
// the scanner estimates for the change. Each axis is a card with a signed delta,
// a magnitude bar, and the confidence behind it.

import type { ValueCard, ValueAxis } from '../../../core/scanOutput';
import { Badge, Meter, Section, type Tone } from '../primitives';

function toneFor(a: ValueAxis): Tone {
  if (a.direction === 'up') return 'good';
  if (a.direction === 'down') return 'bad';
  return 'muted';
}

function signed(pct: number): string {
  const r = Math.round(pct * 10) / 10;
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}%`;
}

function AxisCard({ a }: { a: ValueAxis }) {
  const tone = toneFor(a);
  const mag = Math.min(100, Math.abs(a.delta_percent));
  return (
    <div className="rp-axis">
      <div className="rp-axis-top">
        <span className="rp-axis-label">{a.label}</span>
        <span className="rp-axis-delta" style={{ color: `var(--drift-${tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : 'fg-muted'})` }}>
          {signed(a.delta_percent)} {a.direction === 'up' ? '▲' : a.direction === 'down' ? '▼' : ''}
        </span>
      </div>
      {a.subtitle && <div className="rp-axis-sub">{a.subtitle}</div>}
      <Meter percent={mag} tone={tone} />
      {a.confidence && <div className="rp-axis-conf">confidence: {a.confidence}</div>}
    </div>
  );
}

export function ValueSection({ value }: { value?: ValueCard }) {
  const axes = value?.axes ?? [];
  if (axes.length === 0) return null;
  return (
    <Section icon="💸" title="Business value">
      {value?.bottom_line && (
        <p className="rp-prose">
          <Badge tone="info">bottom line</Badge> {value.bottom_line}
        </p>
      )}
      <div className="rp-axes">
        {axes.map((a) => (
          <AxisCard key={a.name} a={a} />
        ))}
      </div>
    </Section>
  );
}
